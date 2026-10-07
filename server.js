const http = require("http");
const https = require("https");
const os = require("os");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

try { process.loadEnvFile(path.join(__dirname, ".env")); } catch {}

const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || "";
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || "llama-3.3-70b";
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const UPLOADS = path.join(ROOT, "uploads");
const DATA_FILE = path.join(ROOT, "data", "db.json");
const CERT_DIR = path.join(ROOT, "data", "certs");

fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(CERT_DIR, { recursive: true });

function localIPv4s() {
  const list = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) list.push(net.address);
    }
  }
  return list;
}

async function loadOrCreateCert() {
  const keyPath = path.join(CERT_DIR, "key.pem");
  const certPath = path.join(CERT_DIR, "cert.pem");
  try {
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
    }
    const selfsigned = require("selfsigned");
    const attrs = [{ name: "commonName", value: "click-vest-estoque" }];
    const altNames = [
      { type: 2, value: "localhost" },
      { type: 7, ip: "127.0.0.1" },
      ...localIPv4s().map((ip) => ({ type: 7, ip })),
    ];
    const pems = await selfsigned.generate(attrs, {
      days: 3650,
      keySize: 2048,
      extensions: [{ name: "subjectAltName", altNames }],
    });
    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);
    return { key: pems.private, cert: pems.cert };
  } catch (error) {
    console.warn("  Aviso: não foi possível preparar o HTTPS local (", error.message, "). A câmera só funcionará em http://localhost.");
    return null;
  }
}

function emptyDb() {
  return { products: [], movements: [], orders: [] };
}

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const db = JSON.parse(raw);
    db.products = db.products || [];
    db.movements = db.movements || [];
    db.orders = db.orders || [];
    return db;
  } catch {
    const db = emptyDb();
    save(db);
    return db;
  }
}

function save(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function id() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function send(res, status, body, type) {
  const data = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": type || "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 12 * 1024 * 1024) {
        reject(new Error("Arquivo grande demais (máx. 12 MB)."));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("JSON inválido."));
      }
    });
    req.on("error", reject);
  });
}

function savePhoto(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!match) return null;
  const ext = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS, filename), Buffer.from(match[2], "base64"));
  return `/uploads/${filename}`;
}

function num(value, fallback = 0) {
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function findProduct(db, barcode) {
  const code = String(barcode || "").trim();
  return db.products.find((p) => p.barcode === code && !p.deleted);
}

function stockOf(product) {
  return Number(product.stock) || 0;
}

function applyStock(db, product, delta, type, note, extra = {}) {
  const before = stockOf(product);
  const after = Math.round((before + delta) * 1000) / 1000;
  product.stock = after;
  product.updatedAt = now();
  db.movements.unshift({
    id: id(),
    productId: product.id,
    barcode: product.barcode,
    name: product.name,
    type,
    qty: delta,
    before,
    after,
    note: note || "",
    createdAt: now(),
    ...extra,
  });
  return { before, after };
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

async function callCerebras(messages) {
  if (!CEREBRAS_API_KEY) throw new Error("CEREBRAS_API_KEY não configurada.");
  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + CEREBRAS_API_KEY },
    body: JSON.stringify({ model: CEREBRAS_MODEL, messages, temperature: 0.2 }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "Falha ao chamar a Cerebras.");
  return data?.choices?.[0]?.message?.content || "";
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    send(res, 404, "Não encontrado", "text/plain; charset=utf-8");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname === "/api/health") {
      return send(res, 200, { ok: true, store: "Click Vest Lingerie" });
    }

    if (pathname === "/api/bootstrap" && req.method === "GET") {
      const db = load();
      const products = db.products.filter((p) => !p.deleted);
      return send(res, 200, {
        products,
        movements: db.movements.slice(0, 300),
        orders: db.orders.slice(0, 200),
      });
    }

    if (pathname === "/api/products" && req.method === "POST") {
      const body = await readBody(req);
      const barcode = String(body.barcode || "").trim();
      const name = String(body.name || "").trim();
      if (!barcode || !name) return send(res, 400, { error: "Código de barras e nome são obrigatórios." });
      const db = load();
      if (db.products.some((p) => p.barcode === barcode && !p.deleted)) {
        return send(res, 409, { error: "Já existe um produto com esse código de barras." });
      }
      const product = {
        id: id(),
        barcode,
        name,
        category: body.category || "Outro",
        size: body.size || "",
        color: body.color || "",
        price: num(body.price),
        cost: num(body.cost),
        stock: num(body.stock),
        minStock: num(body.minStock, 2),
        sku: String(body.sku || "").trim(),
        notes: String(body.notes || "").trim(),
        photo: savePhoto(body.photo),
        createdAt: now(),
        updatedAt: now(),
      };
      db.products.unshift(product);
      if (product.stock) {
        db.movements.unshift({
          id: id(),
          productId: product.id,
          barcode: product.barcode,
          name: product.name,
          type: "cadastro",
          qty: product.stock,
          before: 0,
          after: product.stock,
          note: "Estoque inicial no cadastro",
          createdAt: now(),
        });
      }
      save(db);
      return send(res, 201, product);
    }

    if (pathname.startsWith("/api/products/") && req.method === "PUT") {
      const productId = pathname.split("/").pop();
      const body = await readBody(req);
      const db = load();
      const product = db.products.find((p) => p.id === productId && !p.deleted);
      if (!product) return send(res, 404, { error: "Produto não encontrado." });
      const barcode = String(body.barcode || product.barcode).trim();
      if (db.products.some((p) => p.id !== product.id && p.barcode === barcode && !p.deleted)) {
        return send(res, 409, { error: "Já existe outro produto com esse código." });
      }
      product.barcode = barcode;
      product.name = String(body.name || product.name).trim();
      product.category = body.category ?? product.category;
      product.size = body.size ?? product.size;
      product.color = body.color ?? product.color;
      product.price = body.price != null ? num(body.price) : product.price;
      product.cost = body.cost != null ? num(body.cost) : product.cost;
      product.minStock = body.minStock != null ? num(body.minStock) : product.minStock;
      product.sku = body.sku != null ? String(body.sku).trim() : product.sku;
      product.notes = body.notes != null ? String(body.notes).trim() : product.notes;
      if (body.photo) product.photo = savePhoto(body.photo) || product.photo;
      if (body.removePhoto) product.photo = null;
      product.updatedAt = now();
      save(db);
      return send(res, 200, product);
    }

    if (pathname.startsWith("/api/products/") && req.method === "DELETE") {
      const productId = pathname.split("/").pop();
      const db = load();
      const product = db.products.find((p) => p.id === productId && !p.deleted);
      if (!product) return send(res, 404, { error: "Produto não encontrado." });
      product.deleted = true;
      product.updatedAt = now();
      save(db);
      return send(res, 200, { ok: true });
    }

    if (pathname === "/api/stock" && req.method === "POST") {
      const body = await readBody(req);
      const db = load();
      const product = body.productId
        ? db.products.find((p) => p.id === body.productId && !p.deleted)
        : findProduct(db, body.barcode);
      if (!product) return send(res, 404, { error: "Produto não encontrado. Cadastre o código primeiro." });
      const type = body.type === "saida" ? "saida" : body.type === "contagem" ? "contagem" : "entrada";
      if (type === "contagem") {
        const counted = num(body.counted);
        if (counted < 0) return send(res, 400, { error: "A contagem não pode ser negativa." });
        const result = applyStock(db, product, counted - stockOf(product), "contagem", body.note, { reason: "contagem" });
        save(db);
        return send(res, 200, { product, ...result });
      }
      const qty = num(body.qty);
      if (!qty) return send(res, 400, { error: "Informe uma quantidade maior que zero." });
      let delta = type === "saida" ? -Math.abs(qty) : Math.abs(qty);
      if (type === "saida" && stockOf(product) + delta < 0 && !body.force) {
        return send(res, 409, {
          error: `Estoque insuficiente. Disponível: ${stockOf(product)}.`,
          stock: stockOf(product),
        });
      }
      const result = applyStock(db, product, delta, type, body.note, {
        reason: body.reason || "",
      });
      save(db);
      return send(res, 200, { product, ...result });
    }

    if (pathname === "/api/orders" && req.method === "POST") {
      const body = await readBody(req);
      const db = load();
      const lines = Array.isArray(body.items) ? body.items : [];
      if (!lines.length) return send(res, 400, { error: "Escaneie pelo menos um produto." });
      const items = [];
      for (const line of lines) {
        const product = db.products.find((p) => p.id === line.productId && !p.deleted);
        if (!product) return send(res, 404, { error: "Um dos produtos do pedido não existe mais." });
        const qty = num(line.qty);
        if (qty <= 0) continue;
        if (stockOf(product) < qty && !body.force) {
          return send(res, 409, {
            error: `Estoque insuficiente de ${product.name}. Disponível: ${stockOf(product)}.`,
          });
        }
        items.push({ productId: product.id, barcode: product.barcode, name: product.name, qty, price: product.price, photo: product.photo });
      }
      if (!items.length) return send(res, 400, { error: "Nenhum item válido." });
      const order = {
        id: id(),
        code: `CV${Date.now().toString().slice(-8)}`,
        customer: String(body.customer || "").trim(),
        channel: body.channel || "Balcão",
        note: String(body.note || "").trim(),
        status: "enviado",
        items,
        total: items.reduce((sum, item) => sum + item.price * item.qty, 0),
        proofPhoto: null,
        createdAt: now(),
      };
      for (const item of items) {
        const product = db.products.find((p) => p.id === item.productId);
        applyStock(db, product, -item.qty, "envio", `Pedido ${order.code}`, { orderId: order.id });
      }
      db.orders.unshift(order);
      save(db);
      return send(res, 201, order);
    }

    if (pathname.startsWith("/api/orders/") && pathname.endsWith("/proof") && req.method === "POST") {
      const orderId = pathname.split("/")[3];
      const body = await readBody(req);
      const db = load();
      const order = db.orders.find((o) => o.id === orderId);
      if (!order) return send(res, 404, { error: "Pedido não encontrado." });
      order.proofPhoto = savePhoto(body.photo);
      order.proofNote = String(body.note || "").trim();
      order.proofAt = now();
      order.status = "com_prova";
      save(db);
      return send(res, 200, order);
    }

    if (pathname === "/api/network-info" && req.method === "GET") {
      return send(res, 200, {
        httpPort: Number(PORT),
        httpsPort: HTTPS_ENABLED ? Number(HTTPS_PORT) : null,
        addresses: localIPv4s(),
      });
    }

    if (pathname === "/api/cerebras" && req.method === "POST") {
      const body = await readBody(req);
      const prompt = String(body.prompt || "").trim();
      if (!prompt) return send(res, 400, { error: "Informe um prompt." });
      const reply = await callCerebras([
        { role: "system", content: String(body.system || "Você é um assistente útil.") },
        { role: "user", content: prompt },
      ]);
      return send(res, 200, { reply });
    }

    if (pathname === "/api/backup" && req.method === "GET") {
      const db = load();
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=click-vest-backup.json",
      });
      return res.end(JSON.stringify(db, null, 2));
    }

    if (pathname.startsWith("/uploads/")) {
      const file = path.basename(pathname);
      return serveFile(res, path.join(UPLOADS, file));
    }

    const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.normalize(path.join(PUBLIC, rel));
    if (!filePath.startsWith(PUBLIC)) return send(res, 403, "Proibido", "text/plain; charset=utf-8");
    return serveFile(res, filePath);
  } catch (error) {
    return send(res, 500, { error: error.message || "Erro interno." });
  }
}

let HTTPS_ENABLED = false;

const httpServer = http.createServer(handleRequest);
httpServer.listen(PORT, () => {
  console.log("");
  console.log("  Click Vest Lingerie — controle de estoque");
  console.log(`  Abra no navegador: http://localhost:${PORT}`);
});

(async () => {
  const cert = await loadOrCreateCert();
  HTTPS_ENABLED = !!cert;
  if (HTTPS_ENABLED) {
    const httpsServer = https.createServer(cert, handleRequest);
    httpsServer.listen(HTTPS_PORT, () => {
      const ips = localIPv4s();
      console.log(`  Leitor de câmera pelo celular (mesma rede Wi-Fi):`);
      if (ips.length) {
        for (const ip of ips) console.log(`    https://${ip}:${HTTPS_PORT}`);
        console.log("  O certificado é autoassinado: no celular, toque em \"Avançado\" e \"Continuar mesmo assim\" na primeira visita.");
      } else {
        console.log("    Nenhum IP de rede local encontrado. Conecte o computador ao Wi-Fi da loja.");
      }
      console.log("");
    });
  } else {
    console.log("  HTTPS indisponível: a câmera só funciona em http://localhost (neste computador).");
    console.log("");
  }
})();
