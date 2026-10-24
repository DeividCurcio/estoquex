# Click Vest Lingerie — controle de estoque

Sistema local para cadastrar peças com foto e código de barras, ler o Eyoyo via Bluetooth e controlar entrada, saída, envio e contagem.

O leitor Eyoyo, no modo Bluetooth HID, se comporta como teclado. Ele digita o código e manda Enter. Este sistema captura essa leitura. Não precisa de driver.

## O que tem

- Cadastro de produto com foto, código, categoria, tamanho, cor, preço, custo e estoque mínimo
- Geração automática de código de barras no cadastro (com prévia e impressão de etiqueta com foto)
- Leitura de código de barras pela câmera do celular ou webcam, além do leitor Eyoyo
- Escanear para buscar
- Escanear para enviar (baixa o estoque ao confirmar)
- Prova de envio com foto da embalagem
- Entrada manual e saída manual
- Lista de estoque
- Contagem de estoque
- Histórico e backup em JSON
- Layout responsivo (funciona bem no celular, tablet e computador)

## Publicar na internet (Render) e usar no celular

Para abrir o sistema em qualquer lugar pelo link (e não só na rede Wi-Fi da loja), publique-o no Render:

1. Crie uma conta em https://render.com e conecte seu GitHub.
2. Clique em **New +** → **Blueprint** e escolha este repositório. O Render lê o arquivo `render.yaml` e configura tudo (build `npm install`, start `npm start`, disco persistente em `/var/data`).
3. Aguarde o deploy terminar. O Render mostra o endereço, algo como `https://estoquex.onrender.com`. Esse é o link do seu aplicativo.
4. Abra esse link no navegador do celular. Como é HTTPS, a câmera para ler código de barras também funciona.

### Persistência dos dados

Use a variável `DATA_DIR` para definir onde ficam o banco (`db.json`) e as fotos (`uploads/`). No `render.yaml` ela aponta para `/var/data`, que é um **disco persistente**: sem ele, os dados somem a cada novo deploy. Discos persistentes exigem plano pago no Render (o `render.yaml` usa `starter`). No plano gratuito não há disco, então os dados são apagados quando o serviço reinicia; faça backup em JSON com frequência (`/api/backup`).

Outras variáveis: `PORT` (padrão 3000), `HOST` (padrão `0.0.0.0`) e `DISABLE_HTTPS=1` (desliga o HTTPS local autoassinado, que não é necessário em hospedagem). Há também um `Procfile` para outras plataformas.

### Instalar na tela inicial do celular

- **Android (Chrome):** abra o link, toque no menu ⋮ e em **Instalar app** / **Adicionar à tela inicial**.
- **iPhone (Safari):** abra o link, toque em Compartilhar e em **Adicionar à Tela de Início**.

O app abre em tela cheia, como um aplicativo. Ele precisa de internet para acessar os dados do estoque.

## Como abrir no VS Code

1. Instale o Node.js 18 ou mais novo: https://nodejs.org
2. Extraia esta pasta e abra no VS Code: `click-vest-estoque`
3. No terminal do VS Code:

```bash
node server.js
```

4. Abra http://localhost:3000

Os dados ficam em `data/db.json`. As fotos ficam em `uploads/`.

Na primeira vez que o servidor rodar, ele instala a dependência `selfsigned` (já vem configurada no `package.json`). Se faltar, rode `npm install` antes do passo 3.

## Assistente de IA

O menu **Assistente de IA** permite perguntar sobre os produtos e os dados recentes da loja. Ele fica desativado por padrão e não faz chamadas nem gera custos até que URL, modelo e chave de API estejam configurados.

O servidor aceita provedores com API compatível com o formato OpenAI Chat Completions. Copie `.env.example` para `.env` e preencha:

```env
AI_BASE_URL=https://seu-provedor/v1
AI_MODEL=identificador-do-modelo
AI_API_KEY=sua-chave
```

Também é aceito `CEREBRAS_API_KEY` no lugar de `AI_API_KEY`. A chave fica somente no servidor; não a coloque no código do navegador nem compartilhe o arquivo `.env`. Reinicie `node server.js` depois de configurar. O assistente só é ativado quando as três configurações estão preenchidas. A leitura de `.env` usa o recurso do Node.js; use Node 20.6 ou mais novo para carregá-lo automaticamente.

Em cada pergunta, o servidor envia ao provedor os produtos ativos (incluindo preço e custo), os 100 movimentos e os 30 pedidos mais recentes, além das últimas 12 mensagens da conversa. Fotos, dados de clientes e notas de pedidos não são enviados. A conversa fica apenas na memória da página e some ao recarregá-la. O assistente é somente consultivo: não altera estoque nem executa operações.

**Privacidade e acesso:** o app ainda não tem login. Não exponha o servidor diretamente à internet; qualquer pessoa com acesso à rede onde ele está rodando pode acessar as telas e, quando configurado, usar o assistente. Confira os termos de retenção e uso de dados do provedor antes de ativá-lo.

## Sobre o NeMo AutoModel

O [NeMo AutoModel (cobertura LLM, v0.5.0)](https://github.com/NVIDIA-NeMo/Automodel/blob/v0.5.0/docs/model-coverage/llm/index.md) indicado na documentação NVIDIA é uma opção para executar e ajustar modelos compatíveis, incluindo fine-tuning com PEFT/LoRA ou SFT. Ele não é, por si só, um serviço de inferência que o app possa chamar sem implantação. Esta primeira etapa conecta o app a uma API hospedada e usa os dados atuais como contexto; **não treina nem ajusta um modelo**. Para a etapa de fine-tuning serão necessários exemplos de perguntas e respostas revisados e um servidor com GPU NVIDIA/CUDA compatível. Não envie o banco inteiro como dataset de treinamento sem antes preparar, revisar e remover dados desnecessários.

## Usar a câmera do celular para ler código de barras

A câmera só funciona em um endereço seguro (HTTPS) ou em `localhost`. Por isso o servidor também sobe uma versão HTTPS na rede local, com um certificado próprio (autoassinado).

1. Rode `node server.js` no computador. O terminal mostra duas opções, por exemplo:
   - `Local (neste computador): http://localhost:3000`
   - `Rede (celular/tablet, use HTTPS):` [https://192.168.1.8:3443](https://192.168.1.8:3443)
2. No celular, conecte na mesma rede Wi-Fi do computador.
3. Abra o navegador do celular e digite o endereço HTTPS mostrado no terminal (o IP pode mudar a cada rede).
   
Esse endereço é da rede local: só abre enquanto o servidor estiver rodando no computador e o celular estiver conectado à mesma rede Wi-Fi.

4. O navegador vai avisar que o certificado não é confiável ("conexão não é privada" ou parecido). Isso é esperado, porque é um certificado criado pelo próprio sistema, só para uso local. Toque em "Avançado" e depois em "Acessar mesmo assim" (o texto muda conforme o navegador).
5. Pronto: o sistema abre normalmente. Toque no botão de câmera (ícone de câmera) ao lado do campo de código em qualquer tela de leitura ou no cadastro, permita o uso da câmera quando o navegador perguntar, e aponte para o código de barras.
6. Para fechar o leitor de câmera, toque em "Fechar" ou aperte Esc no computador.

No próprio computador, `http://localhost:3000` já funciona para a câmera, sem precisar da versão HTTPS.

Se o computador não achar um IP de rede (por exemplo, sem Wi-Fi), o terminal avisa e o sistema continua funcionando normalmente em `http://localhost:3000`, só sem acesso pelo celular.

## Gerar e imprimir código de barras do produto

1. No cadastro de produto, clique em "Gerar" ao lado do campo de código de barras para criar um código novo e único automaticamente (ou escaneie/digite um código existente).
2. Uma prévia do código de barras aparece abaixo do campo.
3. Depois de salvar o produto, use o botão "Etiqueta" na lista de estoque (ou na tela de edição) para abrir uma janela de impressão com a foto, nome, preço e o código de barras da peça.
4. Permita pop-ups para este site se o navegador bloquear a janela de impressão.
5. Imprima e cole a etiqueta na peça. Esse mesmo código pode ser lido depois pelo Eyoyo ou pela câmera do celular.

## Parear o Eyoyo (Bluetooth HID)

1. Ligue o leitor no botão de cima.
2. Segure o botão de leitura por 8 a 10 segundos, ou dê dois cliques, até a luz azul piscar rápido. Esse é o modo de pareamento.
3. No Windows: Configurações, Bluetooth, Adicionar dispositivo. O nome aparece como Eyoyo, EY-015 ou Scanner HID.
4. Quando conectar, a luz azul fica acesa e ele dá um bip.
5. Teste no Bloco de Notas: a leitura tem que escrever o código e pular a linha.
6. Volte para o sistema, clique no campo de leitura e escaneie.

USB com cabo de dados também funciona, do mesmo jeito. Se o cabo só carrega, a leitura não chega no computador: use Bluetooth.

Use o modo HID, não SPP. SPP não digita no campo.

## Uso no dia a dia

1. Cadastre a peça, cole a etiqueta e escaneie o código no campo do cadastro.
2. Na busca, a leitura mostra foto, preço e estoque.
3. No envio, cada leitura soma 1. Confirme para baixar o estoque.
4. Na prova de envio, anexe a foto do pacote.
5. Contagem: leia a peça, digite o que contou na arara, confirme. O sistema grava a diferença.

Se o código ainda não existe, o sistema abre o cadastro com ele preenchido.
