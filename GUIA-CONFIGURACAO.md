# Guia de Configuração — Sistema de Conferência All in Hall

Este guia parte do zero. Ao final você terá: uma planilha Google funcionando como
banco de dados, um Web App do Apps Script publicado, e uma página única
(`index.html`, com as abas Conferência, Gestão, Reposição e Aquisição dentro de
um só sistema) publicada e apontando para esse Web App.

Arquivos deste pacote (todos precisam ir juntos para o mesmo lugar — a página
não funciona se algum faltar):
- `Code.gs` — backend (Google Apps Script)
- `index.html` — página única do sistema (login por PIN + as 3 abas)
- `app.css` — estilo visual de tudo
- `shared.js` — navegação entre abas, PIN, funções compartilhadas
- `conferencia.js`, `gestao.js`, `reposicao.js`, `aquisicao.js` — lógica de cada aba

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
   Volte na planilha (aba do navegador) e confira que agora existem 10 abas:
   `Ocorrencias`, `DiasFechados`, `Produtos`, `Pessoas`, `Condominios`,
   `Reposicoes`, `Compras`, `ComprasItens`, `RegrasMargem` e `DeParaProdutos` —
   já com cabeçalhos e dados iniciais (os 104 produtos com sua faixa de margem,
   as pessoas, os condomínios e as 4 faixas de margem).

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
`reposicao.js`, `aquisicao.js`). O `Code.gs` não precisa ir para lá, ele já vive
dentro do Apps Script.

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
   - `aquisicao.js`
5. Vá em **Settings** (Configurações) do repositório → **Pages** (menu lateral).
6. Em "Build and deployment" → "Source", escolha **Deploy from a branch** →
   branch `main` → pasta `/ (root)` → **Save**.
7. Aguarde 1–2 minutos. A URL do site aparece na mesma tela, algo como:
   `https://seuusuario.github.io/allinhall-sistema/`
8. O sistema completo (as 3 abas) fica nessa única URL — é esse link que você
   salva nos favoritos/tela inicial do tablet, e é esse mesmo link que dá pra
   mandar por WhatsApp como **texto** (nunca o arquivo).

**Ao publicar mudança em `.css` ou `.js`, troque o número da versão.** No topo do
`index.html` os arquivos locais são carregados assim:

```html
<link rel="stylesheet" href="app.css?v=20260730a">
<script src="aquisicao.js?v=20260730a"></script>
```

Esse `?v=` existe por um motivo prático: o GitHub Pages entrega o `index.html`
novo rapidinho, mas o navegador reaproveita o `.css` e o `.js` que já tem
guardados — e a tela fica misturando versão nova com antiga, o que dá a impressão
de que a mudança não subiu. Trocando o número (ex: `20260730a` → `20260730b`), a
URL muda e o navegador é obrigado a buscar tudo de novo.

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
- Colunas: `nome`, `preco`, `ativo`, `categoria`, `margem_pct`, `custo_atual`,
  `data_custo`, `preco_travado`.
- Para adicionar um produto novo: adicione uma linha no final com nome, preço
  (use ponto decimal, ex: `12.50`) e `ativo` = `TRUE`.
- Para remover um produto das listas sem apagar o histórico: mude `ativo`
  para `FALSE` — ele some das telas, mas ocorrências antigas que já usaram
  esse produto continuam intactas.
- Para mudar um preço: edite a coluna `preco` diretamente. Vale para os
  próximos registros; ocorrências já salvas mantêm o valor da época.
- As 5 colunas do fim são da tela de **Aquisição** e é melhor mexer nelas por
  lá, não na mão (veja a seção seguinte). Produto novo que você cadastrar aqui
  nasce **sem faixa de margem** — e sem faixa o sistema não sugere preço pra
  ele, de propósito.

---

## Aquisição — custo do cupom vira preço de venda

A quarta aba do sistema. A ideia: você lança o que pagou, define quanta margem
cada tipo de item aguenta, e o sistema calcula o preço de venda. **Ele sugere,
você aprova** — nunca troca preço sozinho.

### Se a sua planilha já existia antes da Aquisição

Rode a função `configurarPlanilha` de novo (mesmo passo a passo da Parte 1,
itens 6 e 7). Ela é segura de rodar quantas vezes for: não apaga nada, só
cria as abas que faltam (`Compras`, `ComprasItens`, `RegrasMargem`,
`DeParaProdutos`), acrescenta as colunas novas em `Produtos` e preenche a faixa
de margem dos produtos do catálogo original que ainda estiverem sem faixa.
Faixa que **você** já tiver escolhido nunca é sobrescrita.

Enquanto você não rodar, a tela de Aquisição abre normal e avisa o que falta —
e as outras três telas continuam funcionando sem nenhuma diferença.

### As quatro faixas de margem

A régua é de mercado, não de contabilidade: quanto mais o item é levado por
impulso, menos o morador compara o preço com o mercado da rua — e mais margem
ele suporta.

| Faixa | Padrão | Tipo de item |
|---|---|---|
| Impulso | 68% | chocolate, energético, cerveja, salgadinho |
| Conveniência | 62% | refrigerante, água, snack, higiene de emergência |
| Recorrência | 39% | leite, café, pão, papel higiênico |
| Básico | 104% | arroz, açúcar, óleo, macarrão |

**De onde vêm esses números.** Não são teoria: são a mediana da margem que a
operação já praticava, medida com os custos reais de dois cupons (Muffato e
Assaí, 53 itens, 26 produtos do catálogo). A primeira versão usava uma régua de
supermercado (65/45/30/20) e o resultado era ruim — sugeria cortar 42% no molho
de tomate e 37% no apresuntado. Faz sentido num mercado com concorrente a 50
metros; não faz num minimercado dentro do condomínio, onde o morador desce de
pijama às 23h e não tem com o que comparar.

Calibrado na prática real, o sistema não mexe no nível de preço da operação —
ele alinha quem está fora da linha dos próprios pares. Nos 26 produtos medidos,
16 sobem e 8 descem, e os maiores movimentos são justamente os itens
descolados: Red Bull e chocolate Garoto estão com metade da margem dos outros
itens de impulso (sobem ~27%), e o apresuntado está com quase o triplo da
margem dos outros itens de recorrência (desce 32%).

Duas ressalvas honestas sobre a calibragem:

- **Básico saiu de apenas 2 observações** (molho de tomate e açúcar), e as duas
  apontam para lados opostos. Trate os 104% como provisório e revise conforme
  entrarem mais cupons de itens dessa faixa.
- **A mediana esconde dispersão.** Suas margens variam de 24% a 127% dentro da
  mesma categoria — o que significa que hoje não existe política de preço, e
  sim preço herdado. Alinhar isso é o ponto do sistema, mas o alvo continua
  sendo escolha sua, não da mediana.

Os percentuais são editáveis na aba **Faixas de margem**, e os 104 produtos do
catálogo já vêm classificados — revise, a classificação inicial é um chute
fundamentado, a decisão é sua.

### O dia a dia

1. **Cupons** — importe pelo QR code do cupom (abaixo) ou lance à mão: onde
   comprou, a data e os itens com o custo unitário pago.
   Cada item vinculado a um produto do catálogo atualiza o `custo_atual` dele.
   O código de barras é opcional, mas vale digitar: é por ele que o sistema
   reconhece o item sozinho nos próximos cupons.
2. **Ajuste de preço** — a fila do que ficou fora do alvo. Cada linha mostra
   custo, preço de hoje, a margem que esse preço realmente entrega, a margem
   alvo e o preço sugerido. Marque o que concorda e clique em aplicar.
3. **Faixas de margem** — os percentuais de cada faixa.

### O que o sistema nunca faz sozinho

- **Não troca preço sem você aprovar.** Um cupom com promoção pontual mudaria
  seu preço e ele voltaria na semana seguinte — preço balançando é o morador
  percebendo.
- **Não sugere preço de produto sem faixa.** Sem faixa escolhida, a decisão de
  margem não foi tomada; o sistema não inventa uma.
- **Não mexe em cobrança já registrada.** Ocorrências e Reposições guardam o
  preço do dia em que foram feitas, então mudar o catálogo hoje não altera
  nada que já foi cobrado.

Variação acima de 20% entra na fila destacada em vermelho — quase sempre é
promoção pontual ou custo digitado errado, vale conferir antes de aplicar.

### Importar pelo QR code do cupom (NFC-e)

Todo cupom fiscal traz um QR code. Ele abre uma página pública da SEFAZ com o
cupom inteiro: descrição, código, quantidade e valor unitário de cada item. Ler
dali tira a digitação do caminho — e não depende de acesso a sistema de terceiro.

Como usar:

1. Escaneie o QR code do cupom com a câmera do celular.
2. Copie o link que abrir (algo como
   `https://www.fazenda.pr.gov.br/nfce/qrcode?p=4126...`).
3. Cole no campo **Importar cupom fiscal** e clique em **Ler cupom**.
4. Confira a lista que aparece e clique em **Lançar cupom**.

Se o link não funcionar (SEFAZ fora do ar, página pedindo captcha), use a opção
**"Colar o conteúdo da página"**: abra o link no navegador, selecione tudo
(Ctrl+A), copie (Ctrl+C) e cole. O sistema entende tanto o HTML da página quanto
o texto puro que o navegador copia.

**A tela de revisão é obrigatória de propósito.** O sistema lê bem, mas não
decide sozinho a que produto do seu catálogo cada item corresponde. Cada linha
mostra um selo:

- **aprendido** (verde) — vínculo que você já confirmou antes para esse mercado.
- **palpite** (azul) — o sistema deduziu pelo nome. Confira. Ao confirmar, ele
  aprende e na próxima vez esse item vem verde.
- **sem selo** — não teve certeza e deixou em branco. Escolha o produto, ou deixe
  em branco mesmo: o item é lançado no histórico e fica em "Aguardando vínculo".

Cada linha aparece com **o número que o cupom deu ao item**, não uma contagem do
sistema — assim dá para conferir contra o papel sem contar com o dedo. Quando
linhas iguais foram somadas, o número mostra todas de uma vez: `1+2` para duas,
`10…12` para três ou mais (passe o mouse para ver a lista completa).

Você pode ajustar quantidade, custo unitário e vínculo de qualquer linha antes de
lançar, remover linhas que não quer com o ×, e corrigir o mercado, a data e o
documento no topo — útil quando a leitura da página vem com algo torto.

### Desconto do cupom

O cupom quase sempre tem desconto, e ele não aparece em nenhuma linha de item —
o DANFE só informa o total. Nos dois cupons que serviram de base:

| | Soma dos itens | Descontos | Pago de verdade |
|---|---|---|---|
| Muffato | R$ 929,37 | R$ 24,90 | **R$ 904,47** |
| Assaí | R$ 900,75 | R$ 17,70 | **R$ 883,05** |

Lançar os R$ 929,37 deixaria o custo de tudo inflado, e toda sugestão de preço
sairia alta.

Como o sistema não tem como saber em qual item o mercado deu o abatimento, quem
distribui é você — que está com o cupom na mão. Cada linha tem uma coluna
**Desc. da linha** em reais. Preencheu, o custo daquela linha cai só ali.

**O valor é sobre o total da linha, não por unidade** — do jeito que o cupom
mostra. Quem divide pela quantidade é o sistema:

```
10 balas por R$ 100,00, com R$ 20,00 de desconto na compra
  você digita: 20,00
  o sistema entende: R$ 80,00 na linha, R$ 8,00 por unidade

10 refrigerantes por R$ 150,00, com R$ 50,00 de desconto
  você digita: 50,00
  o sistema entende: R$ 100,00 na linha, R$ 10,00 por unidade
```

No topo fica o placar:

```
Soma dos itens no cupom     R$ 929,37
Descontos do cupom        − R$  24,90
Distribuído nas linhas      R$  24,90
Você pagou                  R$ 904,47
Sendo lançado agora         R$ 904,47
```

Enquanto faltar desconto para distribuir, a linha "Distribuído" mostra quanto
falta em vermelho. Quando "Sendo lançado agora" bate com "Você pagou", os dois
ficam verdes — é a conferência que você faria de olho no papel.

Dois atalhos ao lado do placar:

- **Ratear proporcionalmente** preenche a coluna inteira distribuindo o desconto
  pelo valor de cada linha. Serve de ponto de partida: sair de um rateio e
  corrigir duas linhas costuma dar menos trabalho que preencher 33 do zero.
  A sobra de centavos vai na última linha, então a soma fecha exata.
- **Limpar** zera a coluna.

Você não é obrigado a distribuir. Deixando tudo zerado, entra o custo cheio do
cupom — o que faz sentido quando o desconto foi promoção pontual que não vai
repetir, e o custo de tabela representa melhor a próxima compra.

Na prática o efeito no preço costuma ser pequeno, porque o arredondamento
comercial absorve: com 2,68% de desconto o chocolate Garoto sugere R$ 12,49 com
ou sem desconto; a água cai de R$ 2,99 para R$ 2,89. O que muda de verdade é
você conhecer sua margem real.

O desconto de cada linha fica gravado na aba `ComprasItens`, ao lado do custo
líquido — então ao editar o cupom depois, a coluna volta preenchida e dá para
ver quanto o cupom pedia e quanto foi abatido em cada item.

### Fardo: informe só quantas unidades vêm dentro

Linhas em vermelho são as que o sistema achou que **não são uma unidade de
venda** — porque a descrição diz fardo/pack, ou porque o custo unitário ficou
acima do seu próprio preço de venda.

O caso real: `PACK GUARANA ANT UN — 1 un × R$ 52,99`. Isso é um fardo de 12
latinhas. Entrando como está, o sistema entenderia que uma latinha custa R$ 52,99
e sugeriria vender a **R$ 85,89**.

Na linha vermelha tem um campo **Unidades por fardo**. Digite `12` e clique em
**Desmembrar** — o sistema faz a conta:

```
Fardo de 12 un desmembrado: R$ 52,99 ÷ 12 = R$ 4,42/un
```

Quantidade vira 12, custo unitário vira R$ 4,42, e o total do cupom continua
R$ 929,37 — o valor pago não muda, muda em quantas unidades ele se divide. Aí a
sugestão sai R$ 7,49, que é preço de latinha.

Você só informa o número que o sistema não tem como saber. A conta é dele.

Se o alerta estiver errado — é unidade mesmo, só é um item caro — clique em
**É unidade mesmo** e o aviso sai.

### Lucro previsto por cupom e por mês

Cada cupom lançado mostra três números, e a aba Cupons tem um bloco somando por mês:

```
Custo das compras   R$   675,89
Venda prevista      R$ 1.104,34
Lucro previsto      R$   428,45   (63,4% sobre o custo)
```

**"Previsto" é literal, e a distinção importa.** É o que aquele estoque rende
**se for todo vendido ao preço de hoje** — não é dinheiro que já entrou. Este
sistema não registra venda nenhuma: ele conhece o que entrou (cupom), o que
sumiu da prateleira sem pagar (furo) e o que foi cobrado disso. A venda paga
acontece no sistema da Pináculo.

Só entram na conta os itens vinculados a um produto do catálogo **e** com preço
de venda definido — sem preço não há o que projetar. Os que ficam de fora
aparecem contados, com o custo deles, para a diferença entre o total do cupom e
a base do cálculo nunca ficar sem explicação.

Como o cálculo usa o preço de hoje, aplicar preços na aba Ajuste de preço muda
estes números na hora — e é assim que dá para ver o ajuste valendo em reais. No
cupom real do Muffato, aplicar os 16 preços sugeridos levou o lucro previsto de
R$ 428,45 para R$ 484,02.

### Editar um cupom lançado

No cartão de cada cupom em "Cupons lançados" tem **Editar**. Abre o mesmo bloco de
revisão com tudo carregado: mercado, data, documento, observação e todos os itens.

Dá para corrigir quantidade, custo, vínculo, remover item e mudar o cabeçalho.
Ao salvar, o custo dos produtos daquele cupom é recalculado.

Duas coisas para saber:

- **Produto que você tirar do cupom mantém o custo que estava.** O sistema não tem
  como saber qual era o custo antes daquele lançamento. Para corrigir um custo, o
  caminho é lançar o custo certo.
- **Editar não mexe em preço.** Preço só muda pela aba Ajuste de preço, com a sua
  aprovação — como todo o resto.

**Como o casamento de nome funciona.** A descrição do cupom é abreviada e cada
mercado abrevia diferente. O sistema compara palavra por palavra aceitando
prefixo, que é como abreviação funciona: CHOC casa com CHOCOLATE, PIRAQ com
PIRAQUÊ, JUNG com JUNGLE. Se as duas descrições declaram tamanho e os tamanhos
não batem, não casa — é o que impede Oreo 270g de virar o Oreo 90g do catálogo.
E se dois produtos empatam, não palpita nenhum: ambiguidade fica para você.

Medido nos dois cupons reais (Muffato e Assaí, 53 itens): 33 das 44 descrições
distintas saem pré-vinculadas corretas, e as 11 restantes são ambiguidade
legítima. Relendo o mesmo cupom depois de confirmar, 100% vem como aprendido.

### Armadilhas que aparecem em cupom de verdade

Medidas em cupons reais de Muffato e Assaí — vale conferir ao lançar:

- **Pack não é unidade.** `PACK GUARANA ANT UN — 1 un × R$ 52,99` é um fardo. Se
  entrar como custo unitário, o sistema sugere refrigerante a R$ 76. Lance o
  custo por unidade (divida pelo que vem no fardo).
- **O mesmo produto vem em vários códigos.** Bala Fini apareceu em 4 códigos
  (um por sabor) e o Cookie Piraquê em 2. Se você lançar cada linha separada,
  a última sobrescreve o custo das outras — some as quantidades e lance uma vez.
- **O mesmo produto vem com preços diferentes no mesmo cupom.** Elma Chips 35g
  saiu a 3,49 e a 3,69; Coca lata 310ml a 3,59 e 3,29 no Muffato e 2,99 no
  Assaí. O sistema guarda o **último** custo lançado, então lance o que
  representa melhor a sua compra.
- **Tamanho que não bate é produto diferente.** O cupom trouxe Oreo 270g e o
  catálogo tem Oreo 90g. Não vincule por semelhança de nome: ou é produto novo,
  ou é a embalagem que mudou — e só você sabe qual.

### Casos particulares

- **Item com preço combinado que não pode variar**: use o botão **Travar** na
  linha dele. O sistema para de sugerir preço pra aquele item.
- **Item que foge da faixa**: preencha `margem_pct` na linha dele em `Produtos`.
  Margem própria vence a da faixa.
- **Item do cupom que o sistema não reconheceu**: ele cai em "Aguardando
  vínculo", na aba Cupons. Ligue ao produto do catálogo uma vez — da próxima
  o sistema reconhece sozinho (é a aba `DeParaProdutos` que guarda isso).

### Preparado para a integração com a Pináculo

A estrutura já está montada pra receber importação automática no lugar da
digitação, sem refazer nada:

- `Compras` tem a coluna `origem` — hoje sempre `manual`, é onde uma importação
  se identifica.
- `ComprasItens` guarda `descricao_cupom` e `codigo` separados do `produto` do
  catálogo, que é exatamente o formato que um sistema externo entrega.
- `DeParaProdutos` resolve o problema que toda integração esbarra: o nome que a
  Pináculo usa não é o nome do seu catálogo. Cada vínculo feito à mão fica
  guardado, então a importação acerta mais a cada rodada.
- A chave desse vínculo tem escopo, e isso importa: **o código impresso no cupom
  quase nunca é código de barras** — é o código interno da loja. Nos cupons
  reais, o Assaí chama o Detergente Limpol de `675`. Outro mercado usa `675`
  para outra coisa qualquer. Por isso a chave de código interno fica presa ao
  mercado, e só um GTIN válido (8/12/13/14 dígitos, com dígito verificador
  conferido) gera chave global — esse sim, aprendido num mercado, vale em todos.
- Itens que a importação não souber ligar caem no mesmo balde "Aguardando
  vínculo" que já existe.

A importação de NFC-e (seção acima) já usa exatamente esse caminho, com
`origem: 'nfce'` e o CNPJ do emitente como escopo do de-para. Ou seja: o encaixe
não é teoria, já tem um consumidor real rodando.

Quando o acesso à Pináculo sair, o que falta é uma função que leia os dados de lá
e chame `criarCompra_` com `origem: 'pinaculo'`. O resto do caminho — custo,
margem, sugestão, aprovação — já está pronto e testado.

Vale notar o que a Pináculo agrega e o que não agrega. O **custo de compra** você
já resolve pelo cupom, sem depender de ninguém. O que só ela tem é o **estoque** e
o **giro** — quanto de cada item saiu, em quanto tempo. Isso abre uma régua de
margem bem melhor que a atual: item que gira rápido aguenta margem menor com
lucro total maior, item que encalha precisa de margem maior para valer a
prateleira. Hoje a faixa é definida por tipo de produto; com giro, ela poderia
ser definida por comportamento medido.

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
