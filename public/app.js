const NAV = [
  ["home", "Início"],
  ["cadastrar", "Cadastrar produto"],
  ["buscar", "Escanear para buscar"],
  ["enviar", "Escanear para enviar"],
  ["prova", "Prova de envio"],
  ["entrada", "Entrada manual"],
  ["saida", "Saída manual"],
  ["lista", "Lista de estoque"],
  ["contagem", "Contagem de estoque"],
  ["historico", "Histórico"],
  ["chat", "Chat / Assistente IA"],
];

const CATEGORIES = ["Sutiã", "Calcinha", "Conjunto", "Camisola", "Body", "Meia", "Pijama", "Acessório", "Outro"];
const SIZES = ["PP", "P", "M", "G", "GG", "XG", "36", "38", "40", "42", "44", "46", "Único"];

const state = {
  page: "home",
  products: [],
  movements: [],
  orders: [],
  draft: [],
  lastScan: "",
  editing: null,
  photo: null,
  query: "",
  selectedId: null,
  chat: [],
  chatBusy: false,
};

const $ = (sel) => document.querySelector(sel);
const view = () => $("#view");

function money(n) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&" + "amp;";
    if (c === "<") return "&" + "lt;";
    if (c === ">") return "&" + "gt;";
    if (c === '"') return "&" + "quot;";
    return "&" + "#39;";
  });
}
function when(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR");
}
function toast(msg) {
  const el = $("#toast");
  el.hidden = false;
  el.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2800);
}
function beep(ok = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    o.start(); o.stop(ctx.currentTime + 0.08);
  } catch {}
}
async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Falha na operação.");
  return data;
}
async function load() {
  const data = await api("/api/bootstrap");
  state.products = data.products;
  state.movements = data.movements;
  state.orders = data.orders;
}
function productByBarcode(code) {
  return state.products.find((p) => p.barcode === String(code).trim());
}
function productById(id) {
  return state.products.find((p) => p.id === id);
}
function photoHtml(src, alt) {
  if (!src) return `<div class="ph">sem foto</div>`;
  return `<img src="${esc(src)}" alt="${esc(alt || "")}" loading="lazy" />`;
}
function low(p) {
  return Number(p.stock) <= Number(p.minStock || 0);
}

function setPage(page, extra) {
  state.page = page;
  state.editing = extra?.editing || null;
  state.selectedId = extra?.selectedId || state.selectedId;
  if (page === "cadastrar" && !extra?.editing) state.photo = null;
  render();
}

function renderNav() {
  $("#nav").innerHTML = NAV.map(([id, label]) =>
    `<button data-page="${id}" class="${state.page === id ? "active" : ""}" ${state.page === id ? 'aria-current="page"' : ""}>${label}</button>`
  ).join("");
}

function stats() {
  const products = state.products.length;
  const units = state.products.reduce((s, p) => s + Number(p.stock || 0), 0);
  const value = state.products.reduce((s, p) => s + Number(p.stock || 0) * Number(p.price || 0), 0);
  const alerts = state.products.filter(low).length;
  return `
    <div class="grid-stats">
      <div class="stat"><span>Produtos</span><strong>${products}</strong></div>
      <div class="stat"><span>Peças em estoque</span><strong>${units}</strong></div>
      <div class="stat"><span>Valor de venda</span><strong>${money(value)}</strong></div>
      <div class="stat"><span>Abaixo do mínimo</span><strong>${alerts}</strong></div>
    </div>`;
}

function home() {
  return `
    ${stats()}
    <section class="panel">
      <h3>Pedidos</h3>
      <div class="actions">
        ${action("buscar", "blue", iconSearch(), "Escanear<br>para Buscar")}
        ${action("enviar", "blue", iconSend(), "Escanear<br>para Enviar")}
        ${action("prova", "amber", iconPhoto(), "Prova de<br>Envio")}
      </div>
    </section>
    <section class="panel">
      <h3>Estoque</h3>
      <div class="actions">
        ${action("entrada", "blue", iconIn(), "Entrada<br>Manual")}
        ${action("saida", "green", iconOut(), "Saída<br>Manual")}
        ${action("lista", "blue", iconList(), "Lista de<br>Estoque")}
        ${action("contagem", "amber", iconCount(), "Contagem<br>de Estoque")}
      </div>
    </section>
    <section class="panel">
      <div class="row" style="justify-content:space-between">
        <h3 style="margin:0">Cadastro com foto</h3>
        <button class="btn rose" data-page="cadastrar">Novo produto</button>
      </div>
      <p class="muted">Cada peça leva código de barras, foto, tamanho, cor, preço e estoque. O Eyoyo lê o código; o sistema acha a peça.</p>
    </section>`;
}
function action(page, color, svg, label) {
  return `<button class="action" data-page="${page}"><div class="icon ${color}">${svg}</div><span>${label}</span></button>`;
}
function iconSearch() { return `<svg width="32" height="32" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><path d="M8 7h8M8 11h5"/><rect x="6" y="3" width="12" height="18" rx="2"/></svg>`; }
function iconSend() { return `<svg width="32" height="32" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><path d="M4 8h11v10H4zM15 11h4l2 3v4h-6"/><circle cx="8" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/></svg>`; }
function iconPhoto() { return `<svg width="32" height="32" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M3 16l5-4 4 3 3-2 6 4"/></svg>`; }
function iconIn() { return `<svg width="32" height="32" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><path d="M4 11V6h6M4 6l7 7"/><path d="M12 4h8v16H10"/></svg>`; }
function iconOut() { return `<svg width="32" height="32" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><path d="M20 13V6h-6M20 6l-7 7"/><path d="M12 4H4v16h10"/></svg>`; }
function iconList() { return `<svg width="32" height="32" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><path d="M8 7h10M8 12h10M8 17h10"/><path d="M4 7h.01M4 12h.01M4 17h.01"/></svg>`; }
function iconCount() { return `<svg width="32" height="32" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/></svg>`; }
function iconCamera() { return `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 8h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="14" r="3.5"/></svg>`; }

function formFields(p = {}) {
  return `
    <div class="fields">
      <div class="full">
        <label>Código de barras</label>
        <div class="barcode-row">
          <input name="barcode" data-scan="1" value="${esc(p.barcode || state.lastScan || "")}" placeholder="Escaneie, digite ou gere um código" required />
          <button type="button" class="btn-line" data-cam="barcode" title="Ler com a câmera">${iconCamera()}</button>
          <button type="button" class="btn-line" id="gen-barcode" title="Gerar código novo">Gerar</button>
        </div>
        <div id="barcode-preview" class="barcode-preview"></div>
      </div>
      <div class="full"><label>Nome do produto</label><input name="name" value="${esc(p.name || "")}" placeholder="Ex.: Conjunto renda preto" required /></div>
      <div><label>Categoria</label><select name="category">${CATEGORIES.map((c) => `<option ${p.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
      <div><label>Tamanho</label><select name="size"><option value="">—</option>${SIZES.map((c) => `<option ${p.size === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
      <div><label>Cor</label><input name="color" value="${esc(p.color || "")}" placeholder="Preto, nude, vinho" /></div>
      <div><label>SKU interno</label><input name="sku" value="${esc(p.sku || "")}" /></div>
      <div><label>Preço de venda</label><input name="price" type="number" step="0.01" value="${p.price ?? ""}" /></div>
      <div><label>Custo</label><input name="cost" type="number" step="0.01" value="${p.cost ?? ""}" /></div>
      ${p.id ? "" : `<div><label>Estoque inicial</label><input name="stock" type="number" step="1" value="${p.stock ?? 0}" /></div>`}
      <div><label>Estoque mínimo</label><input name="minStock" type="number" step="1" value="${p.minStock ?? 2}" /></div>
      <div class="full"><label>Observação</label><textarea name="notes">${esc(p.notes || "")}</textarea></div>
    </div>`;
}

function cadastrar() {
  const p = state.editing ? productById(state.editing) : null;
  return `
    <form class="panel form" id="product-form">
      <div>
        ${formFields(p || {})}
        <div class="row" style="margin-top:14px">
          <button class="btn rose" type="submit">${p ? "Salvar alterações" : "Cadastrar produto"}</button>
          ${p ? `<button class="btn-line" type="button" data-print="${p.id}">Imprimir etiqueta</button>` : ""}
          ${p ? `<button class="btn-line" type="button" id="delete-product">Excluir</button>` : ""}
        </div>
      </div>
      <div>
        <label>Foto da peça</label>
        <div class="photo-box" id="photo-box">
          ${state.photo ? `<img src="${state.photo}" alt="prévia" />` : p?.photo ? `<img src="${p.photo}" alt="" />` : `<div><strong>Clique para escolher a foto</strong><p class="muted">JPG ou PNG, de preferência fundo claro</p></div>`}
        </div>
        <input id="photo-input" type="file" accept="image/jpeg,image/png,image/*" hidden />
        <p class="muted">A foto fica salva neste computador, na pasta uploads. Use a câmera do celular para tirar a foto direto daqui.</p>
      </div>
    </form>`;
}

function scanBox(title, text) {
  return `
    <div class="scan-hero">
      <h3 style="margin:0 0 6px">${title}</h3>
      <p style="margin:0 0 12px;color:#ddd4ce">${text}</p>
      <div class="scan-row">
        <input id="scan-input" data-scan="1" placeholder="Escaneie aqui" autocomplete="off" />
        <button type="button" class="btn-line cam-btn" data-cam="1">${iconCamera()} Usar câmera</button>
      </div>
    </div>`;
}

function productCard(p, extra = "") {
  if (!p) return `<div class="empty">Nenhum produto com esse código. <button class="btn rose" data-page="cadastrar">Cadastrar agora</button></div>`;
  return `
    <div class="item">
      ${photoHtml(p.photo, p.name)}
      <div>
        <h4>${esc(p.name)}</h4>
        <p>${esc(p.barcode)} · ${esc(p.category)} ${p.size ? "· " + esc(p.size) : ""} ${p.color ? "· " + esc(p.color) : ""}</p>
        <p>${money(p.price)} · estoque ${p.stock} <span class="badge ${low(p) ? "low" : "ok"}">${low(p) ? "baixo" : "ok"}</span></p>
      </div>
      <div class="row">${extra}<button class="btn-line" data-print="${p.id}" title="Imprimir etiqueta com foto e código de barras">Etiqueta</button><button class="btn-line" data-edit="${p.id}">Editar</button></div>
    </div>`;
}

function buscar() {
  const p = state.lastScan ? productByBarcode(state.lastScan) : null;
  return `
    ${scanBox("Escanear para buscar", "Aponte o Eyoyo para a etiqueta. Se o código existir, a peça aparece com foto e estoque.")}
    <div id="scan-result">${state.lastScan ? productCard(p) : `<div class="empty">Nenhuma leitura ainda.</div>`}</div>`;
}

function enviar() {
  const total = state.draft.reduce((s, i) => s + i.price * i.qty, 0);
  return `
    ${scanBox("Escanear para enviar", "Cada leitura soma 1 peça no pedido. Estoque só baixa quando você confirma o envio.")}
    <section class="panel">
      <div class="fields">
        <div><label>Cliente</label><input id="customer" placeholder="Nome ou pedido do marketplace" /></div>
        <div><label>Canal</label><select id="channel"><option>Balcão</option><option>WhatsApp</option><option>Instagram</option><option>Site</option><option>Marketplace</option></select></div>
        <div class="full"><label>Observação</label><input id="order-note" placeholder="Endereço, embalagem, troca" /></div>
      </div>
      <div class="list" style="margin-top:14px">
        ${state.draft.length ? state.draft.map((i) => `
          <div class="item">
            ${photoHtml(i.photo, i.name)}
            <div><h4>${esc(i.name)}</h4><p>${esc(i.barcode)} · ${money(i.price)}</p></div>
            <div class="row">
              <button class="btn-line" data-qty="${i.productId}" data-dir="-1">−</button>
              <strong>${i.qty}</strong>
              <button class="btn-line" data-qty="${i.productId}" data-dir="1">+</button>
            </div>
          </div>`).join("") : `<div class="empty">Escaneie as peças do pedido.</div>`}
      </div>
      <div class="row" style="margin-top:14px;justify-content:space-between">
        <strong>Total ${money(total)}</strong>
        <div class="row">
          <button class="btn-line" id="clear-draft" type="button">Limpar</button>
          <button class="btn green" id="confirm-order" type="button">Confirmar envio e baixar estoque</button>
        </div>
      </div>
    </section>`;
}

function prova() {
  return `
    <section class="panel">
      <h3>Prova de envio</h3>
      <p class="muted">Escolha o pedido, fotografe a embalagem pronta e anexe. Serve de comprovante se a cliente questionar o envio.</p>
      <div class="list">
        ${state.orders.length ? state.orders.slice(0, 20).map((o) => `
          <div class="item" style="grid-template-columns: 1fr auto">
            <div>
              <h4>${esc(o.code)} · ${esc(o.customer || "Sem nome")}</h4>
              <p>${when(o.createdAt)} · ${o.items.length} item(ns) · ${money(o.total)} · ${o.proofPhoto ? "com prova" : "sem prova"}</p>
            </div>
            <div class="row">
              ${o.proofPhoto ? `<a class="btn-line" href="${o.proofPhoto}" target="_blank">Ver foto</a>` : ""}
              <button class="btn amber" data-proof="${o.id}">Anexar foto</button>
            </div>
          </div>`).join("") : `<div class="empty">Nenhum envio ainda. Use Escanear para enviar.</div>`}
      </div>
      <input id="proof-input" type="file" accept="image/*" capture="environment" hidden />
    </section>`;
}

function stockForm(type) {
  const title = type === "entrada" ? "Entrada manual" : "Saída manual";
  const text = type === "entrada"
    ? "Escaneie a peça que chegou e informe quantas unidades entraram."
    : "Escaneie a peça que saiu e informe a quantidade. O estoque não fica negativo sem confirmação.";
  const p = state.selectedId ? productById(state.selectedId) : state.lastScan ? productByBarcode(state.lastScan) : null;
  return `
    ${scanBox(title, text)}
    <form class="panel" id="stock-form">
      ${p ? productCard(p) : `<div class="empty">Escaneie ou escolha uma peça na lista.</div>`}
      <div class="fields" style="margin-top:14px">
        <div><label>Quantidade</label><input name="qty" type="number" min="1" step="1" value="1" required /></div>
        <div><label>Motivo</label><select name="reason">${type === "entrada"
          ? "<option>Compra</option><option>Devolução</option><option>Ajuste</option>"
          : "<option>Venda balcão</option><option>Perda</option><option>Uso próprio</option><option>Ajuste</option>"}</select></div>
        <div class="full"><label>Observação</label><input name="note" placeholder="NF, fornecedor, cliente" /></div>
      </div>
      <button class="btn ${type === "entrada" ? "rose" : "green"}" style="margin-top:12px">${type === "entrada" ? "Dar entrada" : "Dar saída"}</button>
    </form>`;
}

function lista() {
  const q = state.query.toLowerCase();
  const items = state.products.filter((p) => !q || `${p.name} ${p.barcode} ${p.category} ${p.color} ${p.size}`.toLowerCase().includes(q));
  return `
    <section class="panel">
      <div class="row" style="justify-content:space-between">
        <input class="search" id="search" placeholder="Buscar nome, código, cor" value="${esc(state.query)}" />
        <a class="btn-line" href="/api/backup">Baixar backup</a>
      </div>
      <div class="list" style="margin-top:14px">
        ${items.length ? items.map((p) => productCard(p, `<button class="btn-line" data-select="${p.id}" data-go="entrada">Entrada</button>`)).join("") : `<div class="empty">Nenhum produto. Cadastre a primeira peça.</div>`}
      </div>
    </section>`;
}

function contagem() {
  const p = state.selectedId ? productById(state.selectedId) : state.lastScan ? productByBarcode(state.lastScan) : null;
  return `
    ${scanBox("Contagem de estoque", "Escaneie a peça, conte o que está na arara e grave. O sistema ajusta a diferença.")}
    <form class="panel" id="count-form">
      ${p ? productCard(p) : `<div class="empty">Escaneie a peça que você está contando.</div>`}
      <div class="fields" style="margin-top:14px">
        <div><label>Quantidade contada</label><input name="counted" type="number" min="0" step="1" required /></div>
        <div><label>Observação</label><input name="note" placeholder="Inventário da vitrine" /></div>
      </div>
      <button class="btn amber" style="margin-top:12px">Ajustar estoque</button>
    </form>`;
}

function historico() {
  return `
    <section class="panel">
      <h3>Movimentos</h3>
      <table class="table">
        <thead><tr><th>Quando</th><th>Peça</th><th>Tipo</th><th>Qtd</th><th>Depois</th><th>Nota</th></tr></thead>
        <tbody>
          ${state.movements.length ? state.movements.map((m) => `<tr>
            <td>${when(m.createdAt)}</td><td>${esc(m.name)}</td><td>${esc(m.type)}</td>
            <td>${m.qty > 0 ? "+" : ""}${m.qty}</td><td>${m.after}</td><td>${esc(m.note || "")}</td>
          </tr>`).join("") : `<tr><td colspan="6">Sem movimentos.</td></tr>`}
        </tbody>
      </table>
    </section>`;
}

const CHAT_SYSTEM = "Você é o assistente do EstoqueX, um app de controle de estoque de loja de lingerie. Responda em português, de forma objetiva.";
const CHAT_SUGGESTIONS = [
  "Me ajude a resumir a situação do estoque.",
  "Gere uma descrição de produto para um conjunto de lingerie.",
  "Escreva uma mensagem para um cliente sobre o pedido enviado.",
  "Explique como usar a contagem de estoque.",
];

function chatBubbles() {
  if (!state.chat.length) return `<p class="muted">Envie uma pergunta ou escolha uma sugestão.</p>`;
  return state.chat.map((m) => `<div class="chat-msg ${m.role}"><div class="chat-bubble">${esc(m.content)}</div></div>`).join("")
    + (state.chatBusy ? `<div class="chat-msg assistant"><div class="chat-bubble muted">Pensando...</div></div>` : "");
}

function chat() {
  return `
    <section class="panel">
      <h3>Assistente IA</h3>
      <div class="chat-suggestions">
        ${CHAT_SUGGESTIONS.map((t, i) => `<button type="button" class="btn-line" data-chat-suggest="${i}">${esc(t)}</button>`).join("")}
      </div>
      <div id="chat-thread" class="chat-thread" aria-live="polite">${chatBubbles()}</div>
      <form id="chat-form" class="chat-form">
        <textarea id="chat-input" rows="2" placeholder="Digite sua mensagem..." ${state.chatBusy ? "disabled" : ""}></textarea>
        <button class="btn" id="chat-send" ${state.chatBusy ? "disabled" : ""}>${state.chatBusy ? "Enviando..." : "Enviar"}</button>
      </form>
    </section>`;
}

function refreshChat() {
  const thread = $("#chat-thread");
  if (!thread) return;
  thread.innerHTML = chatBubbles();
  thread.scrollTop = thread.scrollHeight;
  const input = $("#chat-input"), btn = $("#chat-send");
  input.disabled = btn.disabled = state.chatBusy;
  btn.textContent = state.chatBusy ? "Enviando..." : "Enviar";
}

async function sendChat(text) {
  const prompt = String(text || "").trim();
  if (!prompt || state.chatBusy) return;
  state.chat.push({ role: "user", content: prompt });
  state.chatBusy = true;
  const input = $("#chat-input");
  if (input) input.value = "";
  refreshChat();
  try {
    const data = await api("/api/cerebras", { method: "POST", body: { prompt, system: CHAT_SYSTEM } });
    state.chat.push({ role: "assistant", content: data.reply || "(sem resposta)" });
  } catch (err) {
    toast(err.message);
  } finally {
    state.chatBusy = false;
    refreshChat();
    const el = $("#chat-input");
    if (el) el.focus();
  }
}

function bindChat() {
  $("#chat-form").addEventListener("submit", (e) => { e.preventDefault(); sendChat($("#chat-input").value); });
  $("#chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(e.target.value); }
  });
  view().querySelectorAll("[data-chat-suggest]").forEach((b) => {
    b.addEventListener("click", () => sendChat(CHAT_SUGGESTIONS[b.dataset.chatSuggest]));
  });
  const thread = $("#chat-thread");
  thread.scrollTop = thread.scrollHeight;
}

function render() {
  const titles = {
    home: ["Início", "Pedidos, estoque e cadastro com foto"],
    cadastrar: ["Cadastro", "Foto, código de barras e preço"],
    buscar: ["Escanear para buscar", "Leitura do Eyoyo"],
    enviar: ["Escanear para enviar", "Monte o pedido lendo as etiquetas"],
    prova: ["Prova de envio", "Foto da embalagem"],
    entrada: ["Entrada manual", "Chegada de mercadoria"],
    saida: ["Saída manual", "Venda ou perda"],
    lista: ["Lista de estoque", "Todas as peças cadastradas"],
    contagem: ["Contagem de estoque", "Inventário pela leitura"],
    historico: ["Histórico", "Entradas, saídas e envios"],
    chat: ["Chat / Assistente IA", "Tire dúvidas e gere textos com IA"],
  };
  const [title, subtitle] = titles[state.page] || titles.home;
  $("#title").textContent = title;
  $("#subtitle").textContent = subtitle;
  renderNav();
  const pages = { home, cadastrar, buscar, enviar, prova, entrada: () => stockForm("entrada"), saida: () => stockForm("saida"), lista, contagem, historico, chat };
  view().innerHTML = (pages[state.page] || home)();
  const scan = $("#scan-input");
  if (scan) scan.focus();
  if (state.page === "cadastrar") refreshBarcodePreview();
  if (state.page === "chat") bindChat();
  closeSide();
}

function refreshBarcodePreview() {
  const input = view().querySelector("input[name='barcode']");
  const box = $("#barcode-preview");
  if (!input || !box) return;
  const value = input.value.trim();
  if (!value) {
    box.innerHTML = `<p class="muted">Gere ou escaneie um código para ver a prévia.</p>`;
    return;
  }
  box.innerHTML = `<svg id="barcode-svg"></svg>`;
  try {
    window.JsBarcode("#barcode-svg", value, {
      format: "CODE128",
      width: 2,
      height: 60,
      displayValue: true,
      margin: 6,
      fontSize: 16,
    });
  } catch {
    box.innerHTML = `<p class="muted">Não foi possível desenhar este código.</p>`;
  }
}

function generateBarcode() {
  // Prefixo 20 fica na faixa reservada para uso interno de lojas (não conflita com EAN-13 de fabricantes).
  const used = new Set(state.products.map((p) => p.barcode));
  for (let tries = 0; tries < 50; tries++) {
    const body = String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 90) + 10).slice(-2);
    const base = ("20" + body).slice(0, 12);
    const digits = base.split("").map(Number);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += digits[i] * (i % 2 === 0 ? 1 : 3);
    const check = (10 - (sum % 10)) % 10;
    const code = base + check;
    if (!used.has(code)) return code;
  }
  return String(Date.now());
}

async function fileToDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const max = 1100;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function formData(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  return data;
}

async function onScan(code) {
  const clean = String(code || "").trim();
  if (clean.length < 3) return;
  state.lastScan = clean;
  $("#scan-last").textContent = `Último: ${clean}`;
  $("#dot").classList.remove("wait");
  const scanInput = $("#scan-input");
  if (scanInput) scanInput.value = "";
  const product = productByBarcode(clean);
  beep(!!product);
  if (state.page === "enviar") {
    if (!product) {
      toast("Código não cadastrado. Abrindo cadastro.");
      setPage("cadastrar");
      return;
    }
    const line = state.draft.find((i) => i.productId === product.id);
    if (line) line.qty += 1;
    else state.draft.push({ productId: product.id, barcode: product.barcode, name: product.name, price: product.price, photo: product.photo, qty: 1 });
    toast(`${product.name} +1`);
    render();
    return;
  }
  if (["buscar", "entrada", "saida", "contagem"].includes(state.page)) {
    state.selectedId = product?.id || null;
    if (!product) toast("Produto não cadastrado.");
    render();
    return;
  }
  if (product) {
    state.selectedId = product.id;
    setPage("buscar");
  } else {
    toast("Código novo. Cadastre a peça.");
    setPage("cadastrar");
  }
}

let zxingReader = null;
let cameraTarget = null; // "scan" => feed into onScan(); "barcode" => fill barcode field of the form

function openCameraScanner(target) {
  cameraTarget = target;
  const modal = $("#camera-modal");
  const video = $("#camera-video");
  const status = $("#camera-status");
  modal.hidden = false;
  status.textContent = "Abrindo câmera…";
  if (!window.ZXing) {
    status.textContent = "A biblioteca de câmera não carregou. Recarregue a página.";
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent = "Este navegador não libera a câmera aqui. No celular, acesse pelo endereço https do servidor (veja o README).";
    return;
  }
  zxingReader = new window.ZXing.BrowserMultiFormatReader();
  zxingReader
    .decodeFromVideoDevice(undefined, video, (result) => {
      if (!result) return;
      const code = result.getText();
      closeCameraScanner();
      if (cameraTarget === "barcode") {
        const input = view().querySelector("input[name='barcode']");
        if (input) {
          input.value = code;
          refreshBarcodePreview();
        }
        beep(true);
        toast("Código lido pela câmera.");
      } else {
        onScan(code);
      }
    })
    .then(() => { status.textContent = "Aponte a câmera para o código de barras."; })
    .catch((err) => { status.textContent = "Não foi possível abrir a câmera: " + (err?.message || err); });
}

function closeCameraScanner() {
  const modal = $("#camera-modal");
  modal.hidden = true;
  if (zxingReader) {
    try { zxingReader.reset(); } catch {}
    zxingReader = null;
  }
}

function printLabel(p) {
  if (!p) return toast("Produto não encontrado para imprimir.");
  const win = window.open("", "_blank", "width=420,height=560");
  if (!win) return toast("O navegador bloqueou a janela de impressão. Permita pop-ups para este site.");
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" />
    <title>Etiqueta · ${esc(p.name)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 14px; color: #111; }
      .label { width: 100%; max-width: 320px; border: 1px solid #ccc; border-radius: 10px; padding: 12px; text-align: center; }
      .label img.photo { width: 100%; max-height: 180px; object-fit: cover; border-radius: 8px; margin-bottom: 8px; background:#eee; }
      .label h1 { font-size: 15px; margin: 4px 0; }
      .label p { font-size: 12px; margin: 2px 0; color: #333; }
      svg { max-width: 100%; }
      @media print { body { padding: 0; } .label { border: 0; } }
    </style></head>
    <body>
      <div class="label">
        ${p.photo ? `<img class="photo" src="${location.origin}${p.photo}" alt="" />` : ""}
        <h1>${esc(p.name)}</h1>
        <p>${esc([p.category, p.size, p.color].filter(Boolean).join(" · "))}</p>
        <p>${money(p.price)}</p>
        <svg id="code"></svg>
      </div>
      <script src="${location.origin}/vendor/jsbarcode.min.js"></script>
      <script>
        JsBarcode("#code", ${JSON.stringify(p.barcode)}, { format: "CODE128", width: 2, height: 64, displayValue: true, fontSize: 16, margin: 6 });
        window.onload = () => setTimeout(() => window.print(), 250);
      </script>
    </body></html>`);
  win.document.close();
}

function closeSide() {
  $("#side")?.classList.remove("open");
  $("#menu-toggle")?.setAttribute("aria-expanded", "false");
}

document.addEventListener("click", async (e) => {
  const page = e.target.closest("[data-page]")?.dataset.page;
  if (page) return setPage(page);
  const edit = e.target.closest("[data-edit]")?.dataset.edit;
  if (edit) return setPage("cadastrar", { editing: edit });
  if (e.target.id === "menu-toggle" || e.target.closest("#menu-toggle")) {
    const side = $("#side");
    const open = side.classList.toggle("open");
    $("#menu-toggle").setAttribute("aria-expanded", String(open));
    return;
  }
  if (e.target.id === "camera-close" || e.target.closest("#camera-close")) return closeCameraScanner();
  if (e.target.id === "camera-modal") return closeCameraScanner();
  const camBtn = e.target.closest("[data-cam]");
  if (camBtn) return openCameraScanner(camBtn.dataset.cam === "barcode" ? "barcode" : "scan");
  if (e.target.id === "gen-barcode") {
    const input = view().querySelector("input[name='barcode']");
    if (input) {
      input.value = generateBarcode();
      refreshBarcodePreview();
    }
    return;
  }
  const printId = e.target.closest("[data-print]")?.dataset.print;
  if (printId) return printLabel(productById(printId));
  const select = e.target.closest("[data-select]");
  if (select) {
    state.selectedId = select.dataset.select;
    return setPage(select.dataset.go || "entrada");
  }
  const qtyBtn = e.target.closest("[data-qty]");
  if (qtyBtn) {
    const line = state.draft.find((i) => i.productId === qtyBtn.dataset.qty);
    if (line) line.qty += Number(qtyBtn.dataset.dir);
    state.draft = state.draft.filter((i) => i.qty > 0);
    return render();
  }
  if (e.target.id === "clear-draft") {
    state.draft = [];
    return render();
  }
  if (e.target.closest("#photo-box")) $("#photo-input")?.click();
  if (e.target.id === "delete-product" && state.editing) {
    if (!confirm("Excluir este produto da lista?")) return;
    await api(`/api/products/${state.editing}`, { method: "DELETE" });
    toast("Produto excluído.");
    state.editing = null;
    await load();
    setPage("lista");
  }
  if (e.target.id === "confirm-order") {
    try {
      const order = await api("/api/orders", {
        method: "POST",
        body: {
          customer: $("#customer")?.value,
          channel: $("#channel")?.value,
          note: $("#order-note")?.value,
          items: state.draft,
        },
      });
      state.draft = [];
      await load();
      toast(`Pedido ${order.code} confirmado.`);
      setPage("prova");
    } catch (err) { toast(err.message); }
  }
  const proof = e.target.closest("[data-proof]")?.dataset.proof;
  if (proof) {
    state.proofOrder = proof;
    $("#proof-input").click();
  }
});

document.addEventListener("change", async (e) => {
  if (e.target.id === "photo-input" && e.target.files[0]) {
    state.photo = await fileToDataUrl(e.target.files[0]);
    render();
  }
  if (e.target.id === "proof-input" && e.target.files[0] && state.proofOrder) {
    const photo = await fileToDataUrl(e.target.files[0]);
    await api(`/api/orders/${state.proofOrder}/proof`, { method: "POST", body: { photo } });
    await load();
    toast("Prova de envio anexada.");
    render();
  }
  if (e.target.id === "search") {
    state.query = e.target.value;
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    state.query = e.target.value;
    const list = view().querySelector(".list");
    if (!list) return;
    const q = state.query.toLowerCase();
    const items = state.products.filter((p) => !q || `${p.name} ${p.barcode} ${p.category} ${p.color} ${p.size}`.toLowerCase().includes(q));
    list.innerHTML = items.length ? items.map((p) => productCard(p, `<button class="btn-line" data-select="${p.id}" data-go="entrada">Entrada</button>`)).join("") : `<div class="empty">Nada encontrado.</div>`;
  }
  if (e.target.name === "barcode" && state.page === "cadastrar") refreshBarcodePreview();
});

document.addEventListener("submit", async (e) => {
  if (e.target.id === "product-form") {
    e.preventDefault();
    const data = formData(e.target);
    if (state.photo) data.photo = state.photo;
    try {
      if (state.editing) await api(`/api/products/${state.editing}`, { method: "PUT", body: data });
      else await api("/api/products", { method: "POST", body: data });
      state.photo = null;
      state.editing = null;
      state.lastScan = "";
      await load();
      toast("Produto salvo.");
      setPage("lista");
    } catch (err) { toast(err.message); }
  }
  if (e.target.id === "stock-form") {
    e.preventDefault();
    const data = formData(e.target);
    const product = state.selectedId ? productById(state.selectedId) : productByBarcode(state.lastScan);
    if (!product) return toast("Escaneie um produto cadastrado.");
    try {
      await api("/api/stock", { method: "POST", body: { productId: product.id, type: state.page, ...data } });
      await load();
      toast(state.page === "entrada" ? "Entrada lançada." : "Saída lançada.");
      render();
    } catch (err) {
      if (err.message.includes("insuficiente") && confirm(err.message + " Lançar mesmo assim?")) {
        await api("/api/stock", { method: "POST", body: { productId: product.id, type: state.page, force: true, ...data } });
        await load();
        toast("Saída lançada.");
        render();
      } else toast(err.message);
    }
  }
  if (e.target.id === "count-form") {
    e.preventDefault();
    const data = formData(e.target);
    const product = state.selectedId ? productById(state.selectedId) : productByBarcode(state.lastScan);
    if (!product) return toast("Escaneie um produto cadastrado.");
    await api("/api/stock", { method: "POST", body: { productId: product.id, type: "contagem", counted: data.counted, note: data.note } });
    await load();
    toast("Contagem aplicada.");
    render();
  }
});

let buffer = "";
let lastKey = 0;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!$("#camera-modal").hidden) return closeCameraScanner();
    return closeSide();
  }
  if (!$("#camera-modal").hidden) return; // câmera aberta: não captura leitura de teclado
  const active = document.activeElement;
  const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT");
  const scanField = active?.dataset?.scan === "1";
  if (typing && !scanField) {
    buffer = "";
    return;
  }
  const now = Date.now();
  if (now - lastKey > 80) buffer = "";
  lastKey = now;
  if (e.key === "Enter") {
    if (buffer.length >= 3) {
      e.preventDefault();
      onScan(buffer);
      buffer = "";
    } else if (scanField && active.value.trim().length >= 3) {
      e.preventDefault();
      onScan(active.value.trim());
      active.value = "";
    }
    return;
  }
  if (e.key.length === 1) buffer += e.key;
});

load().then(render).catch((err) => {
  view().innerHTML = `<div class="panel">Não foi possível carregar. Rode o servidor com <strong>node server.js</strong>.<br>${esc(err.message)}</div>`;
});
