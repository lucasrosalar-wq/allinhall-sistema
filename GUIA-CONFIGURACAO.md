# Guia de Configuração — Sistema de Conferência All in Hall

Este guia parte do zero. Ao final você terá: uma planilha Google funcionando como
banco de dados, um Web App do Apps Script publicado, e uma página única
(`index.html`, com as abas Conferência, Gestão e Reposição dentro de um só
sistema) publicada e apontando para esse Web App.

Arquivos deste pacote (todos precisam ir juntos para o mesmo lugar — a página
não funciona se algum faltar):
- `Code.gs` — backend (Google Apps Script)
- `index.html` — página única do sistema (login por PIN + as 3 abas)
- `app.css` — estilo visual de tudo
- `shared.js` — navegação entre abas, PIN, funções compartilhadas
- `conferencia.js`, `gestao.js`, `reposicao.js` — lógica de cada aba

---

## Parte 1 — Criar a planilha e o Apps Script

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma planilha em branco.
   Dê um nome, por exemplo **"All in Hall — Conferência"**.
2. No menu, vá em **Extensões > Apps Script**. Isso abre o editor de scripts vinculado
   à planilha.
3. Apague todo o conteúdo do arquivo `Código.gs` que abre por padrão.
4. Abra o arquivo `Code.gs` deste pacote, copie **todo o conteúdo** e cole no editor
   do Apps Script.
5. Clique no ícone de disquete (Salvar projeto). Dê um nome ao projeto, ex:
   "Conferência All in Hall".
6. No topo do editor, no seletor de funções (ao lado do botão "Executar"), escolha
   a função **`configurarPlanilha`**.
7. Clique em **Executar**. Na primeira vez, o Google vai pedir autorização:
   - Clique em "Revisar permissões" → escolha sua conta → "Avançado" →
     "Acessar [nome do projeto] (não seguro)" → "Permitir".
     (Esse aviso aparece porque é um script seu, ainda não verificado pelo Google —
     é normal e seguro, pois você mesmo escreveu/colou o código.)
8. Depois de rodar, deve aparecer um alerta "Planilha configurada com sucesso!".
   Volte na planilha (aba do navegador) e confira que agora existem 5 abas:
   `Ocorrencias`, `DiasFechados`, `Produtos`, `Pessoas`, `Condominios` — já com
   cabeçalhos e dados iniciais (os 108 produtos, as pessoas e os condomínios).

---

## Parte 2 — Definir o PIN de acesso

As duas páginas pedem um PIN antes de mostrar qualquer dado. Por padrão o PIN é
`2026`, mas troque isso:

1. No editor do Apps Script, vá em **Configurações do projeto** (ícone de engrenagem
   na barra lateral esquerda).
2. Role até **Propriedades do script** → **Adicionar propriedade do script**.
3. Propriedade: `PIN` — Valor: escolha um código simples (ex: `4127`).
4. Salvar propriedades do script.

Esse PIN é conferido no servidor a cada chamada — sem ele, ninguém consegue ler ou
gravar dados mesmo tendo o link do Web App.

---

## Parte 3 — Publicar como Web App

1. No editor do Apps Script, clique em **Implantar** (Deploy) → **Nova implantação**.
2. Clique no ícone de engrenagem ao lado de "Selecionar tipo" → escolha **App da Web**.
3. Configure:
   - **Descrição**: "Conferência All in Hall v1"
   - **Executar como**: **Eu** (sua conta)
   - **Quem pode acessar**: **Qualquer pessoa**
4. Clique em **Implantar**.
5. Autorize novamente se for pedido (mesmo processo da Parte 1, passo 7).
6. Copie a **URL do app da Web** que aparece — algo como:
   `https://script.google.com/macros/s/AKfycb.../exec`
   Essa é a URL que vai nos dois arquivos HTML.

**Importante:** sempre que você editar o `Code.gs` depois de publicado, o link só
atualiza se você fizer **Implantar > Gerenciar implantações > (lápis de editar) >
Nova versão > Implantar**. Só criar uma "Nova implantação" do zero gera uma URL
nova (evite isso, para não ter que trocar a URL nos dois HTMLs de novo).

---

## Parte 4 — Configurar a URL do Web App

1. Abra `shared.js` em um editor de texto.
2. Encontre a linha perto do topo:
   ```js
   const URL_WEBAPP = 'COLE_AQUI_A_URL_DO_WEB_APP';
   ```
3. Troque pelo link copiado na Parte 3, passo 6. Fica assim:
   ```js
   const URL_WEBAPP = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```
   (Só precisa mexer em um arquivo — `shared.js` é usado pelas 3 abas dentro
   de `index.html`.)

---

## Parte 5 — Hospedar no GitHub Pages

**Aviso de segurança importante:** a pasta onde você está trabalhando hoje
(`all in hall`) tem vários documentos sensíveis (contratos, CNH, CNPJ, planilhas
financeiras). O GitHub Pages publica **todo o conteúdo de um repositório público**
na internet. Por isso, **não** suba a pasta inteira do projeto — crie um
repositório **novo e separado**, contendo apenas os arquivos deste pacote
(`index.html`, `app.css`, `shared.js`, `conferencia.js`, `gestao.js`,
`reposicao.js`). O `Code.gs` não precisa ir para lá, ele já vive dentro do
Apps Script.

Passo a passo:

1. Crie uma conta gratuita em [github.com](https://github.com) se ainda não tiver.
2. Clique em **New repository** (Novo repositório).
   - Nome: por exemplo `allinhall-sistema`.
   - Marque como **Public** (necessário para o Pages gratuito). Isso é seguro
     porque o acesso aos dados continua travado pelo PIN (Parte 2) — sem ele
     ninguém lê nem grava nada, mesmo vendo o código HTML/CSS/JS.
   - Não marque nenhuma opção de README/gitignore por enquanto.
3. Crie o repositório.
4. Na tela do repositório vazio, use a opção **"uploading an existing file"**
   (fazer upload de arquivo existente) e envie **todos juntos, de uma vez**:
   - `index.html`
   - `app.css`
   - `shared.js` (já com a URL do Web App preenchida, da Parte 4)
   - `conferencia.js`
   - `gestao.js`
   - `reposicao.js`
5. Vá em **Settings** (Configurações) do repositório → **Pages** (menu lateral).
6. Em "Build and deployment" → "Source", escolha **Deploy from a branch** →
   branch `main` → pasta `/ (root)` → **Save**.
7. Aguarde 1–2 minutos. A URL do site aparece na mesma tela, algo como:
   `https://seuusuario.github.io/allinhall-sistema/`
8. O sistema completo (as 3 abas) fica nessa única URL — é esse link que você
   salva nos favoritos/tela inicial do tablet, e é esse mesmo link que dá pra
   mandar por WhatsApp como **texto** (nunca o arquivo).

Sempre que editar os arquivos depois (ex: trocar a URL do Web App de novo),
edite direto pela interface do GitHub (ícone de lápis) e faça commit — o site
atualiza sozinho em cerca de 1 minuto.

Sempre que precisar atualizar os arquivos (ex: trocar a URL do Web App de novo),
edite o arquivo direto pela interface do GitHub (ícone de lápis) e faça commit —
o site atualiza sozinho em cerca de 1 minuto.

---

## Parte 6 — Testando

1. Abra o link único do site (Parte 5, passo 7). Digite o PIN configurado na
   Parte 2.
2. Se aparecer o calendário do mês atual na aba Conferência, está tudo certo.
3. Toque em um dia → "Registrar ocorrência" → adicione um item de teste → Salvar.
4. Clique em "Monitoramento" na barra lateral e abra a aba Gestão — confira se
   a ocorrência de teste aparece na lista.
5. Depois de confirmar que funciona, use a ação **Cancelar** na ocorrência de
   teste para não deixar lixo na planilha (ou apague a linha direto na aba
   `Ocorrencias`).

---

## Como adicionar/editar produtos, condomínios e pessoas

Tudo isso é feito **direto na planilha Google** (não precisa mexer no código).
As páginas sempre carregam a versão mais recente ao abrir.

### Produtos (aba `Produtos`)
- Colunas: `nome`, `preco`, `ativo`.
- Para adicionar um produto novo: adicione uma linha no final com nome, preço
  (use ponto decimal, ex: `12.50`) e `ativo` = `TRUE`.
- Para remover um produto das listas sem apagar o histórico: mude `ativo`
  para `FALSE` — ele some das telas, mas ocorrências antigas que já usaram
  esse produto continuam intactas.
- Para mudar um preço: edite a coluna `preco` diretamente. Vale para os
  próximos registros; ocorrências já salvas mantêm o valor da época.

### Condomínios (aba `Condominios`)
- Colunas: `nome_oficial`, `nome_curto`, `endereco`, `bairro`, `cidade`,
  `sindico_ou_contato`, `telefone_contato`, `ativo`.
- `nome_curto` é o que aparece nos seletores das páginas — mantenha os que já
  existem (Walk Soho, Walk Brigadeiro, Parque das Pedreiras, Ed Remy) para não
  quebrar ocorrências já registradas com esses nomes.
- `nome_oficial` e `endereco` aparecem no cabeçalho do PDF de notificação — vale
  a pena completar esses campos antes de gerar a primeira cobrança de verdade.
- Para adicionar um condomínio novo: nova linha com `ativo` = `TRUE`.
- Para tirar um condomínio das listas (ex: contrato encerrado): `ativo` = `FALSE`.

### Pessoas (aba `Pessoas`)
- Colunas: `nome`, `condominio`, `contato_whatsapp`, `observacao`.
- Pode adicionar direto na planilha, ou pela página de Gestão: ao clicar em
  "Identificar" numa ocorrência e escolher "+ Cadastrar nova pessoa", ela é
  salva automaticamente aqui.
- `contato_whatsapp`: salve só os números (com DDD), ex: `41999998888`. O
  sistema completa o `55` do Brasil automaticamente ao montar o link do WhatsApp.

---

## Perguntas frequentes

**Uma pessoa está em dois condomínios diferentes, o que faço?**
Cadastre duas linhas em `Pessoas`, uma para cada condomínio, ou deixe o campo
`condominio` em branco — ele é só informativo, não filtra a lista de seleção.

**Errei uma ocorrência e quero apagar de vez (não só cancelar)?**
Vá na aba `Ocorrencias` e apague a linha manualmente. A ação "Cancelar" nas
páginas é preferível, pois mantém o histórico e some das pendências sem perder
o registro.

**Quero trocar o PIN depois de já estar em uso?**
Repita a Parte 2 (Propriedades do script) — não precisa reimplantar o Web App,
o valor é lido a cada chamada.

**A Barby e eu podemos usar ao mesmo tempo sem problema?**
Sim — o backend usa travamento (lock) durante gravações, então duas pessoas
salvando ao mesmo tempo não corrompem os dados; uma delas só espera alguns
milissegundos a mais.
