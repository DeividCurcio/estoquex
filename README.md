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

## Usar a câmera do celular para ler código de barras

A câmera só funciona em um endereço seguro (HTTPS) ou em `localhost`. Por isso o servidor também sobe uma versão HTTPS na rede local, com um certificado próprio (autoassinado).

1. Rode `node server.js` no computador. O terminal mostra duas opções, por exemplo:
   - `Local (neste computador): http://localhost:3000`
   - `Rede (celular/tablet, use HTTPS):` [https://192.168.1.8:3443](https://192.168.1.8:3443)
2. No celular, conecte na mesma rede Wi-Fi do computador.
3. Abra o navegador do celular e digite o endereço HTTPS mostrado no terminal (o IP pode mudar a cada rede).
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
