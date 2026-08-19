/**
 * Sistema de Conferência de Câmeras — All in Hall
 * Backend em Google Apps Script, vinculado a uma planilha Google.
 *
 * Como usar:
 * 1. Cole este arquivo inteiro no editor do Apps Script (Extensions > Apps Script).
 * 2. Rode a função configurarPlanilha() uma vez pelo editor (autorize quando pedir).
 * 3. Publique como Web App (Deploy > New deployment > Web app).
 * Veja o GUIA-CONFIGURACAO.md para o passo a passo completo.
 */

// ===================== CONFIGURAÇÃO =====================

const NOMES_ABAS = {
  OCORRENCIAS: 'Ocorrencias',
  DIAS_FECHADOS: 'DiasFechados',
  PRODUTOS: 'Produtos',
  PESSOAS: 'Pessoas',
  CONDOMINIOS: 'Condominios',
  REPOSICOES: 'Reposicoes',
  COMPRAS: 'Compras',
  COMPRAS_ITENS: 'ComprasItens',
  REGRAS_MARGEM: 'RegrasMargem',
  DE_PARA: 'DeParaProdutos'
};

const CABECALHOS = {
  Ocorrencias: ['id', 'condominio', 'data_ocorrencia', 'hora', 'pessoa', 'descricao_pessoa', 'itens', 'valor_total', 'observacao', 'status', 'contato_whatsapp', 'data_registro', 'data_cobranca', 'data_pagamento', 'data_prejuizo', 'grupo_cobranca_id'],
  DiasFechados: ['condominio', 'data', 'status_dia', 'registrado_em'],
  Produtos: ['nome', 'preco', 'ativo', 'categoria', 'margem_pct', 'custo_atual', 'data_custo', 'preco_travado'],
  Pessoas: ['nome', 'condominio', 'contato_whatsapp', 'observacao'],
  Condominios: ['nome_oficial', 'nome_curto', 'endereco', 'bairro', 'cidade', 'sindico_ou_contato', 'telefone_contato', 'ativo'],
  Reposicoes: ['id', 'condominio', 'data', 'produto', 'quantidade', 'preco_unit', 'valor_total', 'status', 'pessoa', 'contato_whatsapp', 'data_infracao', 'hora_infracao', 'registrado_em', 'ocorrencia_id'],
  Compras: ['id', 'data', 'mercado', 'documento', 'valor_total', 'observacao', 'origem', 'registrado_em'],
  ComprasItens: ['id', 'compra_id', 'descricao_cupom', 'codigo', 'produto', 'quantidade', 'custo_unit', 'custo_total', 'desconto'],
  RegrasMargem: ['categoria', 'rotulo', 'margem_pct', 'descricao', 'ordem'],
  DeParaProdutos: ['chave', 'descricao_cupom', 'produto', 'origem', 'atualizado_em']
};

const FUSO_HORARIO = 'America/Sao_Paulo';

// PIN padrão usado caso não exista a propriedade PIN nas Propriedades do Script.
// Recomendado trocar em Project Settings > Script Properties > adicionar "PIN".
const PIN_PADRAO = '2026';

// Lista de produtos reaproveitada do gerador-cobranca.html (nome, preço, faixa de margem).
// Usada para popular a aba Produtos uma única vez, em configurarPlanilha(), e para
// preencher a faixa de produtos que ainda estejam sem classificação (ver
// classificarProdutosDoSeed_). A faixa é um chute inicial fundamentado no
// comportamento de compra — revise pela tela de Aquisição, é lá que ela manda.
const PRODUTOS_SEED = [["Detergente Líquido Cristal Limpol Squeeze 500ml", 3.89, "recorrencia"], ["Biscoito Cookie Piraquê 80g - Sabores", 5.89, "impulso"], ["Leite Condensado Frimesa 395g", 7.49, "basico"], ["Atum Gomes da Costa Ralado 170g - Sabores", 10.99, "basico"], ["Bolinho Dr. Oetker Bom pra Mim 50g - Sabores", 7.95, "impulso"], ["Granola Jasmine Integral 250g - Sabores", 13.9, "recorrencia"], ["Maionese Heinz Tradicional 215g", 14.99, "basico"], ["Nescau Achocolatado em Pó 200g", 10.4, "recorrencia"], ["Massa Caseira Galla nº 1 - 400g", 8.69, "basico"], ["Chocolate Garoto 80g - Sabores", 9.89, "impulso"], ["Biscoito Leite Maltado Cobertura Chocolate Piraquê 80g - Sabores", 5.89, "impulso"], ["Papel Higiênico Folha Tripla Branco 20M 4RL Duetto", 10.99, "recorrencia"], ["Água Mineral Crystal Pet 500ml - Sabores", 3.89, "conveniencia"], ["Filtro De Papel 103 Melitta", 4.99, "recorrencia"], ["Bolo de Caneca 67g - Sabores", 4.99, "impulso"], ["Bala Fini Gelatina 90g - Sabores", 8.29, "impulso"], ["Molho de Tomate Heinz 240g", 6.79, "basico"], ["Açúcar Refinado Caravelas 1kg", 5.39, "basico"], ["Torrone Montevergine 90g - Sabores", 5.99, "impulso"], ["Pipoca para Microondas Yoki 100g - Sabores", 7.75, "conveniencia"], ["Snack Crocantíssimo Original 40g - Sabores", 5.69, "impulso"], ["Arroz Branco Urbano 1kg", 7.39, "basico"], ["Smirnoff Ice 275ml", 8.99, "impulso"], ["Refrigerante Guaraná Antarctica Lata 350ml", 5.79, "conveniencia"], ["Snack Pettiz Amendoim Crocante - Sabores", 7.69, "impulso"], ["Extrato de Tomate Elefante Tradicional 135g", 4.99, "basico"], ["Refrigerante Guaraná Antarctica 2L", 13.79, "conveniencia"], ["Refrigerante Sprite Sabores 2L", 13.69, "conveniencia"], ["Refrigerante Laranja Fanta Garrafa 2L", 13.69, "conveniencia"], ["Cerveja Budweiser American Lager 350ml Lata", 6.75, "impulso"], ["Biscoito Recheado Oreo 90g", 5.7, "impulso"], ["Sabão em Pó OMO Lavagem Perfeita 400g", 11.99, "recorrencia"], ["Achocolatado Toddy 200g", 8.99, "recorrencia"], ["Amaciante Concentrado Comfort Frescor Intenso 500ml", 15.99, "recorrencia"], ["Vanish Tira Manchas em Barra White 75g Para Roupas", 10.29, "recorrencia"], ["Óleo de Soja Cocamar 900ml", 11.39, "basico"], ["Salgadinho Time 50g - Sabores", 3.69, "impulso"], ["Creme de Leite Tirol 200g", 4.19, "basico"], ["Cerveja Corona Lata 350ml", 7.89, "impulso"], ["Cereal Matinal Nestlé Sachê 120g - Sabores", 8.99, "recorrencia"], ["Refrigerante Coca-Cola 2L - Sabores", 14.99, "conveniencia"], ["Chocolate Lacta 80g - Sabores", 9.49, "impulso"], ["Barra de Cereal Nutry 20g - Sabores", 2.89, "impulso"], ["Absorvente Mili Proteção Total Suave Com Abas 8un", 7.99, "conveniencia"], ["Chocolate KitKat Nestlé 41,5g - Sabores", 6.99, "impulso"], ["Macarrão Espaguete Ovos Dona Benta 500g", 5.09, "basico"], ["Batata Palha Kisabor 100g", 7.99, "conveniencia"], ["Chocolate Bis Lacta 100,8g - Variados", 7.99, "impulso"], ["Energético Monster 473ml Lata - Sabores", 11.99, "impulso"], ["Álcool Netz Etílico 46° INPM Neutro 500ml", 8.99, "conveniencia"], ["Limpador Multiuso Original Veja Gold 500ml", 7.49, "recorrencia"], ["Toalha Umedecida Levoe 48un", 6.89, "conveniencia"], ["Sachê Pedigree Cães Adultos Raças Pequenas - Sabores", 3.49, "recorrencia"], ["Sachê Whiskas para Gatos Adultos - Sabores", 3.99, "recorrencia"], ["Sabonete Francis Variados 90g", 4.39, "conveniencia"], ["Chocolate Suflair 80g - Variados", 10.49, "impulso"], ["Esponja Brilhus Multiuso Unitária", 2.7, "recorrencia"], ["Creme Dental Colgate Máxima Proteção Anticáries 50g", 5.99, "conveniencia"], ["Energético Red Bull Energy Drink 250ml", 11.99, "impulso"], ["Chá Matte Leão Original - Caixa com 25 Unidades", 7.39, "recorrencia"], ["Leite Tirol UHT Integral Zero Lactose 1 Litro", 6.79, "recorrencia"], ["Macarrão Instantâneo Nissin 85g - Variados", 3.99, "conveniencia"], ["Macarrão Nissin Cup Noodles 64g - Variados", 6.99, "conveniencia"], ["Café Melitta Vácuo 250g - Variados", 24.9, "recorrencia"], ["Refrigerante Coca-Cola Lata 310ml - Sabores", 4.99, "conveniencia"], ["Salgadinho Elma Chips 40g - Variados", 5.99, "impulso"], ["Cerveja Heineken Lata 350ml", 7.69, "impulso"], ["Leite Tirol UHT 1 Litro - Integral", 6.79, "recorrencia"], ["Salgadinho de Batata Pringles Tubo 104g - Diversos", 12.99, "impulso"], ["Apresuntado Seara Fatiado 180g", 12.49, "recorrencia"], ["Leite Moça Condensado Integral Nestlé - Caixinha 395g", 8.99, "basico"], ["Álcool Coperalcool Bacfree 46°INPM Tradicional 500ml", 8.99, "conveniencia"], ["Presunto Levíssimo Fatiado Seara 180g", 11.99, "recorrencia"], ["Sabonete Nivea Com Hidratante Creme Care 90g", 6.99, "conveniencia"], ["Requeijão Catupiry 250g - Sabores", 9.99, "recorrencia"], ["Manteiga Frimesa 200g - Sabores", 14.99, "recorrencia"], ["Sopa 17g Vono - Sabores", 4.79, "conveniencia"], ["Pão de Forma Bauducco Pacote 390g - Sabores", 8.69, "recorrencia"], ["Queijo Mussarela Fatiado 150g", 10.99, "recorrencia"], ["Isotônico Powerade 500ml - Sabores", 7.99, "conveniencia"], ["Protein Parmalat Whey Fit Zero Lactose 250ml - Sabores", 9.9, "impulso"], ["Esponja Multiuso Assolan Pertuto", 3.19, "recorrencia"], ["Papel Higiênico Folha Tripla Mili Prime Comfort 4 Rolos 20m", 10.99, "recorrencia"], ["Macarrão Spaghetti 500g Floriani Grano Duro", 9.69, "basico"], ["Toalhas Umedecidas Mili Prime 50 Unidades", 9.89, "conveniencia"], ["Chiclete Trident X 48,3g - Sabores", 16.79, "impulso"], ["Biscoito BelVita 75g - Sabores", 7.29, "impulso"], ["Chocolate Nestlé Galak 80g", 9.99, "impulso"], ["Água Tônica Antarctica Lata 350ml", 5.39, "conveniencia"], ["Escova de Dentes Oral-B", 7.89, "conveniencia"], ["Chiclete Trident Sem Açúcar 8g - Sabores", 3.59, "impulso"], ["Prestobarba Ultragrip Fixo Az C/2 Masc/Fem", 8.99, "conveniencia"], ["Suco Del Valle Kapo Sabores 200ml", 3.79, "conveniencia"], ["Café Melitta Regiões Brasileiras Vácuo 250g - Sabores", 29.9, "recorrencia"], ["Absorvente com Abas Suave Sempre Livre Adapt Pacote 8 Unidades", 7.89, "conveniencia"], ["Batata Palha Caldo Bom 100g - Sabores", 8.99, "conveniencia"], ["Bebida Jungle 500ml - Sabores", 8.99, "conveniencia"], ["Manteiga de Primeira Qualidade Com Sal 200g - Tirol", 14.99, "recorrencia"], ["Presunto Cozido Fatiado Sadia 200g", 10.99, "recorrencia"], ["Margarina Claybom 250g", 5.99, "recorrencia"], ["Sabonete Phebo Barra Limão Siciliano 100g", 6.49, "conveniencia"], ["Fermento em Pó Royal 100g", 7.49, "basico"], ["Mistura para Bolo Dona Benta 450g - Sabores", 9.99, "basico"], ["Batata Palha Tostally 100g", 7.99, "conveniencia"]];

// Pessoas conhecidas para pré-popular a aba Pessoas (condomínio fica em branco — complete na planilha).
const PESSOAS_SEED = ['Gisele', 'Rui', 'Victoria', 'Gibran', 'Juliana', 'Alice', 'Gabriel', 'Felipe', 'Vinícius', 'Daniela', 'Evaldo'];

// Condomínios para pré-popular a aba Condominios (endereço/contato ficam em branco — complete na planilha).
const CONDOMINIOS_SEED = ['Walk Soho', 'Walk Brigadeiro', 'Parque das Pedreiras', 'Ed Remy'];

// ===================== PRECIFICAÇÃO =====================
// Faixas de margem por comportamento de compra. A lógica é de mercado, não de
// contabilidade: quanto mais o item é comprado por impulso, menos o morador
// compara o preço com o mercado da rua — e mais margem ele suporta.
//
// Os percentuais NÃO são teoria: são a mediana da margem que a operação já
// praticava, medida a partir dos custos reais de dois cupons (Muffato e Assaí,
// 29/07/2026, 53 itens, 26 produtos do catálogo). A primeira versão usava uma
// régua de supermercado (65/45/30/20) e o resultado era ruim — sugeria cortar
// 42% no molho de tomate e 37% no apresuntado. Faz sentido num mercado com
// concorrente a 50 metros; não faz num minimercado dentro do condomínio, onde
// o morador desce de pijama às 23h e não tem com o que comparar.
//
// Calibrado assim, o sistema não muda o nível de preço da operação — ele alinha
// quem está fora da linha dos próprios pares. Revise pela tela de Aquisição
// conforme mais cupons entrarem; Básico em especial saiu de só 2 observações.
const REGRAS_MARGEM_SEED = [
  ['impulso', 'Impulso', 68, 'Chocolate, energético, cerveja, salgadinho. Levado na vontade do momento, quase ninguém compara preço.', 1],
  ['conveniencia', 'Conveniência', 62, 'Refrigerante, água, snack, higiene de emergência. Levado pela praticidade de ter ali.', 2],
  ['recorrencia', 'Recorrência', 39, 'Leite, café, pão, papel higiênico. Levado sempre — o morador sabe quanto custa fora.', 3],
  ['basico', 'Básico', 104, 'Arroz, açúcar, óleo, macarrão. Base medida em poucos itens ainda — confira conforme entrarem mais cupons.', 4]
];

// Terminações de preço "de prateleira". O preço calculado sempre sobe até a
// terminação seguinte — nunca desce, pra não comer a margem alvo por causa do
// arredondamento. Ex: 7,12 -> 7,49 | 7,55 -> 7,89 | 7,91 -> 7,99 | 8,05 -> 8,49.
const TERMINACOES_PRECO_ = [0.49, 0.89, 0.99];

// Variação (pra cima ou pra baixo) a partir da qual a sugestão entra na tela de
// revisão marcada como "confira antes". Não bloqueia nada — só destaca, porque
// salto grande costuma ser cupom com promoção pontual, não mudança real de custo.
const LIMIAR_ALERTA_VARIACAO_PCT = 20;

// ===================== SETUP (rodar uma vez manualmente) =====================

function configurarPlanilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(CABECALHOS).forEach(function (nomeAba) {
    let aba = ss.getSheetByName(nomeAba);
    if (!aba) aba = ss.insertSheet(nomeAba);
    const cabecalho = CABECALHOS[nomeAba];
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
    aba.setFrozenRows(1);
  });

  // Remove a aba padrão "Página1"/"Sheet1" se ainda existir vazia.
  const abaPadrao = ss.getSheetByName('Sheet1') || ss.getSheetByName('Página1');
  if (abaPadrao && ss.getSheets().length > Object.keys(CABECALHOS).length) {
    ss.deleteSheet(abaPadrao);
  }

  const abaProdutos = ss.getSheetByName(NOMES_ABAS.PRODUTOS);
  if (abaProdutos.getLastRow() < 2) {
    const linhas = PRODUTOS_SEED.map(function (p) { return [p[0], p[1], true, p[2], '', '', '', '']; });
    abaProdutos.getRange(2, 1, linhas.length, 8).setValues(linhas);
  } else {
    classificarProdutosDoSeed_();
  }

  const abaPessoas = ss.getSheetByName(NOMES_ABAS.PESSOAS);
  if (abaPessoas.getLastRow() < 2) {
    const linhas = PESSOAS_SEED.map(function (nome) { return [nome, '', '', '']; });
    abaPessoas.getRange(2, 1, linhas.length, 4).setValues(linhas);
  }

  const abaCondominios = ss.getSheetByName(NOMES_ABAS.CONDOMINIOS);
  if (abaCondominios.getLastRow() < 2) {
    const linhas = CONDOMINIOS_SEED.map(function (nome) { return [nome, nome, '', '', 'Curitiba', '', '', true]; });
    abaCondominios.getRange(2, 1, linhas.length, 8).setValues(linhas);
  }

  const abaRegras = ss.getSheetByName(NOMES_ABAS.REGRAS_MARGEM);
  if (abaRegras.getLastRow() < 2) {
    abaRegras.getRange(2, 1, REGRAS_MARGEM_SEED.length, 5).setValues(REGRAS_MARGEM_SEED);
  }

  travarColunasComoTexto_();

  SpreadsheetApp.getUi().alert('Planilha configurada com sucesso! Agora publique como Web App (Deploy > New deployment).');
}

// Numa planilha que já existia antes da Aquisição, os produtos estão todos sem
// faixa de margem — e produto sem faixa não recebe sugestão de preço nenhuma.
// Preenche a faixa dos que estão no catálogo original, sem tocar em quem já tem
// uma faixa escolhida (a decisão da pessoa sempre vence o chute do seed) nem em
// produto que ela mesma cadastrou depois.
function classificarProdutosDoSeed_() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMES_ABAS.PRODUTOS);
  const valores = aba.getDataRange().getValues();
  const cabecalho = valores[0];
  const colNome = cabecalho.indexOf('nome');
  const colCategoria = cabecalho.indexOf('categoria');
  if (colCategoria === -1) return 0;

  const categoriaPorNome = {};
  PRODUTOS_SEED.forEach(function (p) { categoriaPorNome[p[0]] = p[2]; });

  let preenchidos = 0;
  for (let i = 1; i < valores.length; i++) {
    const atual = String(valores[i][colCategoria] || '').trim();
    if (atual) continue;
    const categoria = categoriaPorNome[String(valores[i][colNome])];
    if (!categoria) continue;
    aba.getRange(i + 1, colCategoria + 1).setValue(categoria);
    preenchidos++;
  }
  return preenchidos;
}

// O Sheets converte automaticamente strings como "2026-07-20" ou "10:59" em
// objetos de Data internos, o que quebra as comparações de texto usadas pelo
// sistema (ex: pintar o calendário). Travar essas colunas como "Texto simples"
// (formato '@') faz o Sheets guardar exatamente a string enviada pelo Apps Script.
function travarColunasComoTexto_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const LINHAS_RESERVADAS = 20000;

  const colunasOcorrencias = [3, 4, 12, 13, 14]; // data_ocorrencia, hora, data_registro, data_cobranca, data_pagamento
  const abaOcorrencias = ss.getSheetByName(NOMES_ABAS.OCORRENCIAS);
  colunasOcorrencias.forEach(function (col) {
    abaOcorrencias.getRange(2, col, LINHAS_RESERVADAS, 1).setNumberFormat('@');
  });

  const colunasDiasFechados = [2, 4]; // data, registrado_em
  const abaDiasFechados = ss.getSheetByName(NOMES_ABAS.DIAS_FECHADOS);
  colunasDiasFechados.forEach(function (col) {
    abaDiasFechados.getRange(2, col, LINHAS_RESERVADAS, 1).setNumberFormat('@');
  });

  const colunasReposicoes = [3, 11, 12, 13]; // data, data_infracao, hora_infracao, registrado_em
  const abaReposicoes = ss.getSheetByName(NOMES_ABAS.REPOSICOES);
  colunasReposicoes.forEach(function (col) {
    abaReposicoes.getRange(2, col, LINHAS_RESERVADAS, 1).setNumberFormat('@');
  });

  const abaProdutos = ss.getSheetByName(NOMES_ABAS.PRODUTOS);
  abaProdutos.getRange(2, 7, LINHAS_RESERVADAS, 1).setNumberFormat('@'); // data_custo

  const colunasCompras = [2, 8]; // data, registrado_em
  const abaCompras = ss.getSheetByName(NOMES_ABAS.COMPRAS);
  colunasCompras.forEach(function (col) {
    abaCompras.getRange(2, col, LINHAS_RESERVADAS, 1).setNumberFormat('@');
  });

  const abaDePara = ss.getSheetByName(NOMES_ABAS.DE_PARA);
  abaDePara.getRange(2, 5, LINHAS_RESERVADAS, 1).setNumberFormat('@'); // atualizado_em
}

// ===================== ROTEAMENTO HTTP =====================

function doGet(e) {
  return tratarRequisicao_(e.parameter || {});
}

function doPost(e) {
  let corpo = {};
  try {
    corpo = JSON.parse(e.postData.contents);
  } catch (err) {
    return respostaJson_({ ok: false, erro: 'Corpo da requisição inválido.' });
  }
  return tratarRequisicao_(corpo);
}

function tratarRequisicao_(params) {
  try {
    verificarPin_(params.pin);
    const acao = params.action;

    switch (acao) {
      case 'bootstrap':
        return respostaJson_({ ok: true, dados: obterBootstrap_() });
      case 'calendario':
        return respostaJson_({ ok: true, dados: obterCalendario_(params.condominio, Number(params.ano), Number(params.mes)) });
      case 'ocorrencias':
        return respostaJson_({ ok: true, dados: obterOcorrencias_() });
      case 'fecharDia':
        return respostaJson_({ ok: true, dados: fecharDia_(params) });
      case 'limparDia':
        return respostaJson_({ ok: true, dados: limparDia_(params) });
      case 'criarOcorrencia':
        return respostaJson_({ ok: true, dados: criarOcorrencia_(params) });
      case 'atualizarOcorrencia':
        return respostaJson_({ ok: true, dados: atualizarOcorrencia_(params) });
      case 'excluirOcorrencia':
        return respostaJson_({ ok: true, dados: excluirOcorrencia_(params) });
      case 'criarPessoa':
        return respostaJson_({ ok: true, dados: criarPessoa_(params) });
      case 'reposicoes':
        return respostaJson_({ ok: true, dados: obterReposicoes_() });
      case 'criarReposicao':
        return respostaJson_({ ok: true, dados: criarReposicao_(params) });
      case 'atualizarReposicao':
        return respostaJson_({ ok: true, dados: atualizarReposicao_(params) });
      case 'excluirReposicao':
        return respostaJson_({ ok: true, dados: excluirReposicao_(params) });
      case 'identificarFuroReposicao':
        return respostaJson_({ ok: true, dados: identificarFuroReposicao_(params) });
      case 'aquisicao':
        return respostaJson_({ ok: true, dados: obterAquisicao_() });
      case 'criarCompra':
        return respostaJson_({ ok: true, dados: criarCompra_(params) });
      case 'atualizarCompra':
        return respostaJson_({ ok: true, dados: atualizarCompra_(params) });
      case 'excluirCompra':
        return respostaJson_({ ok: true, dados: excluirCompra_(params) });
      case 'vincularItemCompra':
        return respostaJson_({ ok: true, dados: vincularItemCompra_(params) });
      case 'salvarRegrasMargem':
        return respostaJson_({ ok: true, dados: salvarRegrasMargem_(params) });
      case 'atualizarProduto':
        return respostaJson_({ ok: true, dados: atualizarProduto_(params) });
      case 'aplicarPrecos':
        return respostaJson_({ ok: true, dados: aplicarPrecos_(params) });
      case 'lerNfce':
        return respostaJson_({ ok: true, dados: lerNfce_(params) });
      default:
        return respostaJson_({ ok: false, erro: 'Ação desconhecida: ' + acao });
    }
  } catch (err) {
    return respostaJson_({ ok: false, erro: String(err.message || err) });
  }
}

function respostaJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function verificarPin_(pinRecebido) {
  const pinValido = PropertiesService.getScriptProperties().getProperty('PIN') || PIN_PADRAO;
  if (String(pinRecebido) !== String(pinValido)) {
    throw new Error('PIN inválido.');
  }
}

// ===================== LEITURA =====================

function obterAba_(nome) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!aba) throw new Error('Aba não encontrada: ' + nome);
  return aba;
}

// As abas da Aquisição (Compras, ComprasItens, RegrasMargem, DeParaProdutos) só
// passam a existir depois que configurarPlanilha() roda de novo numa planilha
// antiga. Em vez de estourar erro e derrubar a tela inteira, quem lê essas abas
// usa esta versão — devolve lista vazia, e a tela mostra o aviso pedindo pra
// rodar a configuração. Vale também pras colunas novas de Produtos.
function lerAbaComoObjetosOpcional_(nome) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!aba) return null;
  return lerAbaComoObjetos_(nome);
}

function lerAbaComoObjetos_(nome) {
  const aba = obterAba_(nome);
  const valores = aba.getDataRange().getValues();
  const cabecalho = valores[0];
  const linhas = valores.slice(1).filter(function (linha) { return linha.join('') !== ''; });
  return linhas.map(function (linha, indice) {
    const obj = {};
    cabecalho.forEach(function (chave, i) { obj[chave] = normalizarValorLido_(chave, linha[i]); });
    obj._linha = indice + 2; // linha real na planilha, para updates
    return obj;
  });
}

// Segurança extra: mesmo com as colunas travadas como texto (travarColunasComoTexto_),
// se alguma célula acabar virando um objeto Date (ex: linha criada antes da trava,
// ou digitada manualmente na planilha), devolve a string correspondente em vez do Date,
// para não quebrar as comparações de texto usadas no calendário e nos filtros.
const CAMPOS_DATA_ = { data_ocorrencia: 'data', data: 'data', data_cobranca: 'data', data_pagamento: 'data', data_infracao: 'data', hora: 'hora', hora_infracao: 'hora', data_registro: 'datahora', registrado_em: 'datahora' };

function normalizarValorLido_(chave, valor) {
  if (!(valor instanceof Date)) return valor;
  const tipo = CAMPOS_DATA_[chave];
  if (tipo === 'data') return Utilities.formatDate(valor, FUSO_HORARIO, 'yyyy-MM-dd');
  if (tipo === 'hora') return Utilities.formatDate(valor, FUSO_HORARIO, 'HH:mm');
  if (tipo === 'datahora') return Utilities.formatDate(valor, FUSO_HORARIO, "yyyy-MM-dd'T'HH:mm:ss");
  return valor;
}

function obterBootstrap_() {
  const produtos = lerAbaComoObjetos_(NOMES_ABAS.PRODUTOS)
    .filter(function (p) { return p.ativo === true || p.ativo === 'TRUE' || p.ativo === 'true'; })
    .map(function (p) { return { nome: p.nome, preco: Number(p.preco) }; });

  const condominios = lerAbaComoObjetos_(NOMES_ABAS.CONDOMINIOS)
    .filter(function (c) { return c.ativo === true || c.ativo === 'TRUE' || c.ativo === 'true'; });

  const pessoas = lerAbaComoObjetos_(NOMES_ABAS.PESSOAS);

  return { produtos: produtos, condominios: condominios, pessoas: pessoas };
}

function normalizarOcorrenciaObjeto_(o) {
  let itens = [];
  try { itens = JSON.parse(o.itens || '[]'); } catch (err) { itens = []; }
  return Object.assign({}, o, { itens: itens, valor_total: Number(o.valor_total) || 0 });
}

function obterCalendario_(condominio, ano, mes) {
  const ocorrencias = lerAbaComoObjetos_(NOMES_ABAS.OCORRENCIAS).map(normalizarOcorrenciaObjeto_).filter(function (o) {
    if (o.condominio !== condominio) return false;
    const data = String(o.data_ocorrencia);
    return data.indexOf(chavePeriodo_(ano, mes)) === 0 && o.status !== 'Cancelado';
  });

  const diasFechados = lerAbaComoObjetos_(NOMES_ABAS.DIAS_FECHADOS).filter(function (d) {
    if (d.condominio !== condominio) return false;
    return String(d.data).indexOf(chavePeriodo_(ano, mes)) === 0;
  });

  return { ocorrencias: ocorrencias, diasFechados: diasFechados };
}

function chavePeriodo_(ano, mes) {
  return ano + '-' + String(mes).padStart(2, '0');
}

function obterOcorrencias_() {
  return lerAbaComoObjetos_(NOMES_ABAS.OCORRENCIAS).map(normalizarOcorrenciaObjeto_);
}

// Furos de estoque identificados na reposição física (junto com o sistema da Pináculo).
// Uma linha por item — pessoas diferentes podem ter levado itens diferentes do mesmo
// furo. condominio/data/produto/quantidade/preco_unit/valor_total são preenchidos na
// Reposição; pessoa/contato_whatsapp/data_infracao/hora_infracao são preenchidos na
// Conferência, ao identificar o infrator (ver identificarFuroReposicao_).
function normalizarReposicaoObjeto_(r) {
  return Object.assign({}, r, {
    quantidade: Number(r.quantidade) || 0,
    preco_unit: Number(r.preco_unit) || 0,
    valor_total: Number(r.valor_total) || 0
  });
}

function obterReposicoes_() {
  return lerAbaComoObjetos_(NOMES_ABAS.REPOSICOES).map(normalizarReposicaoObjeto_);
}

// ===================== ESCRITA =====================

function comTravamento_(funcao) {
  const trava = LockService.getScriptLock();
  trava.waitLock(10000);
  try {
    return funcao();
  } finally {
    trava.releaseLock();
  }
}

function agora_() {
  return Utilities.formatDate(new Date(), FUSO_HORARIO, "yyyy-MM-dd'T'HH:mm:ss");
}

// aba.appendRow() nem sempre respeita o formato de texto já definido na coluna
// (o Sheets ainda converte "2026-07-20" ou "10:59" em Data ao anexar linha).
// Por isso, sempre travamos a(s) célula(s) como texto ('@') na MESMA linha,
// imediatamente antes de escrever o valor — isso sim impede a conversão.
function escreverLinhaComoTexto_(aba, linha, valores, colunasTexto) {
  colunasTexto.forEach(function (col) { aba.getRange(linha, col).setNumberFormat('@'); });
  aba.getRange(linha, 1, 1, valores.length).setValues([valores]);
}

function fecharDia_(params) {
  return comTravamento_(function () {
    const aba = obterAba_(NOMES_ABAS.DIAS_FECHADOS);
    const valores = aba.getDataRange().getValues();
    for (let i = 1; i < valores.length; i++) {
      if (valores[i][0] === params.condominio && String(valores[i][1]) === params.data) {
        aba.getRange(i + 1, 4).setNumberFormat('@');
        aba.getRange(i + 1, 3, 1, 2).setValues([[params.status_dia, agora_()]]);
        return { atualizado: true };
      }
    }
    const proximaLinha = aba.getLastRow() + 1;
    escreverLinhaComoTexto_(aba, proximaLinha, [params.condominio, params.data, params.status_dia, agora_()], [2, 4]);
    return { criado: true };
  });
}

// Desfaz uma marcação de "Fechar dia (OK)" / "Marcar sem operação" feita por engano,
// apagando a linha de DiasFechados daquele condomínio+data. Se não existir nenhuma
// marcação para limpar, não é erro — o dia já está "Não conferido" mesmo.
function limparDia_(params) {
  return comTravamento_(function () {
    const aba = obterAba_(NOMES_ABAS.DIAS_FECHADOS);
    const valores = aba.getDataRange().getValues();
    for (let i = 1; i < valores.length; i++) {
      if (valores[i][0] === params.condominio && String(valores[i][1]) === params.data) {
        aba.deleteRow(i + 1);
        return { limpo: true };
      }
    }
    return { limpo: false };
  });
}

// Sem trava própria — quem chama (criarOcorrencia_, ou identificarFuroReposicao_
// promovendo um furo) já está dentro do próprio comTravamento_. Duas travas do
// mesmo LockService aninhadas na mesma execução não são garantidas seguras.
// A aba Ocorrencias ganhou a coluna data_prejuizo depois que a planilha já estava
// em uso. Em vez de exigir que alguém rode configurarPlanilha() de novo (e correr
// o risco de gravar numa coluna sem cabeçalho enquanto isso não acontece), toda
// escrita passa por aqui antes: se faltar alguma coluna do cabeçalho oficial, ela
// é criada na hora, no fim da faixa que já existe. Devolve o cabeçalho atualizado.
function garantirColunasOcorrencias_(aba, cabecalho) {
  CABECALHOS.Ocorrencias.forEach(function (nome) {
    if (cabecalho.indexOf(nome) === -1) {
      cabecalho.push(nome);
      aba.getRange(1, cabecalho.length).setValue(nome);
    }
  });
  return cabecalho;
}

function criarOcorrenciaLinha_(params) {
  const aba = obterAba_(NOMES_ABAS.OCORRENCIAS);
  garantirColunasOcorrencias_(aba, aba.getRange(1, 1, 1, Math.max(aba.getLastColumn(), 1)).getValues()[0]);
  const id = 'OC' + Utilities.formatDate(new Date(), FUSO_HORARIO, 'yyyyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  const linha = [
    id,
    params.condominio,
    params.data_ocorrencia,
    params.hora || '',
    params.pessoa || '',
    params.descricao_pessoa || '',
    JSON.stringify(params.itens || []),
    Number(params.valor_total) || 0,
    params.observacao || '',
    params.pessoa ? 'Identificado' : 'Pendente',
    params.contato_whatsapp || '',
    agora_(),
    '',
    '',
    '',
    params.grupo_cobranca_id || ''
  ];
  const proximaLinha = aba.getLastRow() + 1;
  escreverLinhaComoTexto_(aba, proximaLinha, linha, [3, 4, 12, 13, 14, 15, 16]);
  return { id: id };
}

function criarOcorrencia_(params) {
  return comTravamento_(function () { return criarOcorrenciaLinha_(params); });
}

const COLUNAS_TEXTO_OCORRENCIAS_ = { data_ocorrencia: true, hora: true, data_cobranca: true, data_pagamento: true, data_prejuizo: true, grupo_cobranca_id: true };

// Sem trava própria, mesmo motivo de criarOcorrenciaLinha_ acima.
function atualizarOcorrenciaCampos_(id, params) {
  const aba = obterAba_(NOMES_ABAS.OCORRENCIAS);
  const valores = aba.getDataRange().getValues();
  const cabecalho = garantirColunasOcorrencias_(aba, valores[0]);
  const colId = cabecalho.indexOf('id');
  const colStatus = cabecalho.indexOf('status');

  for (let i = 1; i < valores.length; i++) {
    if (valores[i][colId] === id) {
      const linhaPlanilha = i + 1;
      const camposPermitidos = ['pessoa', 'descricao_pessoa', 'itens', 'valor_total', 'observacao', 'status', 'contato_whatsapp', 'data_cobranca', 'data_pagamento', 'data_prejuizo', 'data_ocorrencia', 'hora', 'grupo_cobranca_id'];
      camposPermitidos.forEach(function (campo) {
        if (Object.prototype.hasOwnProperty.call(params, campo)) {
          const col = cabecalho.indexOf(campo);
          let valor = params[campo];
          if (campo === 'itens') valor = JSON.stringify(valor || []);
          if (COLUNAS_TEXTO_OCORRENCIAS_[campo]) aba.getRange(linhaPlanilha, col + 1).setNumberFormat('@');
          aba.getRange(linhaPlanilha, col + 1).setValue(valor);
        }
      });

      // Se a pessoa foi alterada e ninguém pediu uma troca explícita de status,
      // recalcula Pendente/Identificado automaticamente (só quando o status ainda
      // não avançou para Cobrado/Pago/Prejuizo/Cancelado, para não desfazer histórico).
      if (Object.prototype.hasOwnProperty.call(params, 'pessoa') && !Object.prototype.hasOwnProperty.call(params, 'status')) {
        const statusAtual = valores[i][colStatus];
        if (statusAtual === 'Pendente' || statusAtual === 'Identificado') {
          aba.getRange(linhaPlanilha, colStatus + 1).setValue(params.pessoa ? 'Identificado' : 'Pendente');
        }
      }

      return { atualizado: true };
    }
  }
  throw new Error('Ocorrência não encontrada: ' + id);
}

function atualizarOcorrencia_(params) {
  return comTravamento_(function () { return atualizarOcorrenciaCampos_(params.id, params); });
}

function excluirOcorrencia_(params) {
  return comTravamento_(function () {
    const aba = obterAba_(NOMES_ABAS.OCORRENCIAS);
    const valores = aba.getDataRange().getValues();
    const colId = valores[0].indexOf('id');

    for (let i = 1; i < valores.length; i++) {
      if (valores[i][colId] === params.id) {
        aba.deleteRow(i + 1);
        return { excluido: true };
      }
    }
    throw new Error('Ocorrência não encontrada: ' + params.id);
  });
}

function criarPessoa_(params) {
  return comTravamento_(function () {
    const aba = obterAba_(NOMES_ABAS.PESSOAS);
    aba.appendRow([params.nome, params.condominio || '', params.contato_whatsapp || '', params.observacao || '']);
    return { criado: true };
  });
}

// Um furo de reposição pode ter vários itens (produtos diferentes); cada item vira
// sua própria linha, porque pessoas diferentes podem ter levado itens diferentes do
// mesmo furo — a identificação (feita depois, na Conferência) é por item, não por lote.
function criarReposicao_(params) {
  return comTravamento_(function () {
    const aba = obterAba_(NOMES_ABAS.REPOSICOES);
    const itens = params.itens || [];
    const agora = agora_();
    const ids = [];

    itens.forEach(function (item, indice) {
      const id = 'RP' + Utilities.formatDate(new Date(), FUSO_HORARIO, 'yyyyMMddHHmmss') + '-' + indice + Math.floor(Math.random() * 90 + 10);
      ids.push(id);
      const linha = [
        id,
        params.condominio,
        params.data,
        item.produto,
        Number(item.qtd) || 0,
        Number(item.preco_unit) || 0,
        (Number(item.qtd) || 0) * (Number(item.preco_unit) || 0),
        'Pendente',
        '',
        '',
        '',
        '',
        agora,
        ''
      ];
      const proximaLinha = aba.getLastRow() + 1;
      escreverLinhaComoTexto_(aba, proximaLinha, linha, [3, 13]);
    });

    return { ids: ids };
  });
}

// Só os campos que a Reposição é dona: produto/quantidade/valor/condomínio/data do furo.
// Os campos da identificação (pessoa, whatsapp, dia/hora da infração) são exclusivos
// de identificarFuroReposicao_, chamada a partir da Conferência.
function atualizarReposicao_(params) {
  return comTravamento_(function () {
    const aba = obterAba_(NOMES_ABAS.REPOSICOES);
    const valores = aba.getDataRange().getValues();
    const cabecalho = valores[0];
    const colId = cabecalho.indexOf('id');

    for (let i = 1; i < valores.length; i++) {
      if (valores[i][colId] === params.id) {
        const linhaPlanilha = i + 1;
        const camposPermitidos = ['condominio', 'data', 'produto', 'quantidade', 'preco_unit', 'valor_total'];
        camposPermitidos.forEach(function (campo) {
          if (Object.prototype.hasOwnProperty.call(params, campo)) {
            const col = cabecalho.indexOf(campo);
            if (campo === 'data') aba.getRange(linhaPlanilha, col + 1).setNumberFormat('@');
            aba.getRange(linhaPlanilha, col + 1).setValue(params[campo]);
          }
        });
        return { atualizado: true };
      }
    }
    throw new Error('Reposição não encontrada: ' + params.id);
  });
}

// Chamada a partir da Conferência: Barby identifica quem pegou o produto do furo.
// Só mexe nos campos dela — nunca em produto/quantidade/valor/condomínio/data do furo.
// Além de gravar a identificação em si, promove o furo pra uma Ocorrência de
// verdade (mesma aba/fluxo que a Gestão já sabe cobrar) — na primeira vez que o
// furo é identificado, cria a Ocorrência e guarda o vínculo em ocorrencia_id; se
// a Barby usar "Editar identificação" depois pra corrigir algo, atualiza a
// Ocorrência já criada em vez de duplicar.
function identificarFuroReposicao_(params) {
  return comTravamento_(function () {
    const aba = obterAba_(NOMES_ABAS.REPOSICOES);
    const valores = aba.getDataRange().getValues();
    const cabecalho = valores[0];
    const colId = cabecalho.indexOf('id');
    const colStatus = cabecalho.indexOf('status');
    const colOcorrenciaId = cabecalho.indexOf('ocorrencia_id');

    for (let i = 1; i < valores.length; i++) {
      if (valores[i][colId] === params.id) {
        const linhaPlanilha = i + 1;
        const linhaAtual = valores[i];
        const camposPermitidos = ['pessoa', 'contato_whatsapp', 'data_infracao', 'hora_infracao'];
        camposPermitidos.forEach(function (campo) {
          if (Object.prototype.hasOwnProperty.call(params, campo)) {
            const col = cabecalho.indexOf(campo);
            if (campo === 'data_infracao' || campo === 'hora_infracao') aba.getRange(linhaPlanilha, col + 1).setNumberFormat('@');
            aba.getRange(linhaPlanilha, col + 1).setValue(params[campo]);
          }
        });
        aba.getRange(linhaPlanilha, colStatus + 1).setValue('Identificado');

        const ocorrenciaIdExistente = linhaAtual[colOcorrenciaId];
        const camposOcorrencia = {
          pessoa: params.pessoa,
          contato_whatsapp: params.contato_whatsapp || '',
          data_ocorrencia: params.data_infracao || linhaAtual[cabecalho.indexOf('data')],
          hora: params.hora_infracao || ''
        };

        if (ocorrenciaIdExistente) {
          atualizarOcorrenciaCampos_(ocorrenciaIdExistente, camposOcorrencia);
        } else {
          const quantidade = Number(linhaAtual[cabecalho.indexOf('quantidade')]) || 0;
          const precoUnit = Number(linhaAtual[cabecalho.indexOf('preco_unit')]) || 0;
          const resultado = criarOcorrenciaLinha_(Object.assign({
            condominio: linhaAtual[cabecalho.indexOf('condominio')],
            itens: [{ produto: linhaAtual[cabecalho.indexOf('produto')], qtd: quantidade, preco_unit: precoUnit }],
            valor_total: Number(linhaAtual[cabecalho.indexOf('valor_total')]) || 0,
            observacao: 'Furo de reposição identificado durante reabastecimento.'
          }, camposOcorrencia));
          aba.getRange(linhaPlanilha, colOcorrenciaId + 1).setValue(resultado.id);
        }

        return { identificado: true };
      }
    }
    throw new Error('Reposição não encontrada: ' + params.id);
  });
}

// ===================== AQUISIÇÃO: CUSTO, MARGEM E PREÇO =====================

function normalizarTexto_(valor) {
  return String(valor || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Um código de barras de verdade (GTIN-8/12/13/14) vale em qualquer mercado do
// mundo. O código impresso no cupom quase nunca é isso: é o código interno da
// loja. Nos cupons reais que serviram de base, o Assaí chama o Detergente Limpol
// de "675" e a Coca lata de "1053361" — números curtos, sequenciais, que outro
// mercado usa pra outra coisa qualquer. Confundir os dois faz o sistema vincular
// produto errado sozinho e sem avisar, que é o pior tipo de erro que existe aqui.
// O dígito verificador é o que separa um caso do outro com segurança.
function ehGtinValido_(codigo) {
  const digitos = String(codigo || '').trim();
  if (!/^\d+$/.test(digitos)) return false;
  if ([8, 12, 13, 14].indexOf(digitos.length) === -1) return false;

  let soma = 0;
  // Da direita pra esquerda, fora o dígito verificador, os pesos alternam 3 e 1.
  for (let i = digitos.length - 2; i >= 0; i--) {
    const peso = (digitos.length - i) % 2 === 0 ? 3 : 1;
    soma += Number(digitos.charAt(i)) * peso;
  }
  const verificador = (10 - (soma % 10)) % 10;
  return verificador === Number(digitos.charAt(digitos.length - 1));
}

// Escopo de loja pra chave do de-para. Diferente de normalizarTexto_, aqui a
// pontuação é removida em vez de virar espaço: um CNPJ colapsa nos dígitos
// ("06.057.223/0403-94" -> "06057223040394") e o nome digitado colapsa numa
// palavra só, então "Atacadão", "atacadao " e "ATACADÃO" caem no mesmo escopo.
function normalizarEscopo_(valor) {
  return normalizarTexto_(valor).replace(/ /g, '');
}

// Chave de reconhecimento de um item de cupom, em três níveis:
//  - código de barras válido -> chave global; aprendida num mercado, vale em todos
//  - qualquer outro código   -> chave presa ao mercado (é código interno dele)
//  - sem código              -> descrição normalizada, também presa ao mercado,
//    porque a abreviação impressa é escolha da loja ("CHOC GAROTO 80G CAJU")
// `loja` aceita CNPJ ou nome do mercado — os dois passam pelo mesmo normalizador.
function chaveDePara_(codigo, descricao, loja) {
  const cod = String(codigo || '').trim();
  if (cod && ehGtinValido_(cod)) return 'ean:' + cod;
  const escopo = normalizarEscopo_(loja) || 'SEMLOJA';
  if (cod) return 'cod:' + escopo + ':' + normalizarTexto_(cod);
  return 'desc:' + escopo + ':' + normalizarTexto_(descricao);
}

function arredondarPrecoComercial_(valor) {
  if (!(valor > 0)) return 0;
  const inteiro = Math.floor(valor);
  const centavos = valor - inteiro;
  for (let i = 0; i < TERMINACOES_PRECO_.length; i++) {
    // 1e-9 absorve o erro de ponto flutuante (7.49 vindo de conta às vezes é 7.4899...).
    if (centavos <= TERMINACOES_PRECO_[i] + 1e-9) return inteiro + TERMINACOES_PRECO_[i];
  }
  return inteiro + 1 + TERMINACOES_PRECO_[0];
}

function arredondar2_(valor) {
  return Math.round(Number(valor) * 100) / 100;
}

// Margem que vale pro produto, na ordem: margem própria do item > margem da
// faixa dele. A margem própria existe pra exceção (item negociado, item que só
// faz sentido a um preço específico) sem precisar criar uma faixa só pra ele.
//
// Produto sem faixa e sem margem própria devolve origem 'indefinida' — e isso
// NÃO vira uma margem padrão silenciosa. Já foi assim e o efeito era ruim: num
// catálogo recém-migrado, todo produto caía no padrão e o sistema sugeria mudar
// o preço de tudo com base numa faixa que ninguém escolheu (chocolate, item de
// impulso, chegava a ser sugerido 21% mais barato). Sem faixa escolhida não
// existe decisão de margem — e sem decisão o sistema não opina.
function margemDoProduto_(produto, mapaRegras) {
  const propria = produto.margem_pct;
  if (propria !== '' && propria !== null && propria !== undefined && !isNaN(Number(propria))) {
    return { pct: Number(propria), origem: 'item' };
  }
  const categoria = String(produto.categoria || '');
  const regra = categoria ? mapaRegras[categoria] : null;
  if (regra) return { pct: Number(regra.margem_pct), origem: 'categoria' };
  return { pct: null, origem: 'indefinida' };
}

// Coração da automação — e o único lugar onde o preço sugerido é calculado, de
// propósito: a tela só exibe o que vem daqui, então não existe risco de a conta
// da tela e a conta do servidor divergirem.
function calcularPrecificacaoProduto_(produto, mapaRegras) {
  const custo = Number(produto.custo_atual) || 0;
  const precoAtual = Number(produto.preco) || 0;
  const margem = margemDoProduto_(produto, mapaRegras);
  const travado = produto.preco_travado === true || produto.preco_travado === 'TRUE' || produto.preco_travado === 'true';

  const base = {
    nome: produto.nome,
    preco: precoAtual,
    ativo: produto.ativo === true || produto.ativo === 'TRUE' || produto.ativo === 'true',
    categoria: String(produto.categoria || ''),
    margem_pct: produto.margem_pct === '' || produto.margem_pct === null || produto.margem_pct === undefined ? '' : Number(produto.margem_pct),
    custo_atual: custo,
    data_custo: String(produto.data_custo || ''),
    preco_travado: travado,
    margem_alvo_pct: margem.pct,
    margem_alvo_origem: margem.origem
  };

  // Margem que o preço de hoje realmente entrega. É o número que ninguém tinha
  // antes de existir custo no sistema — vale por si só, mesmo sem aplicar nada.
  base.margem_atual_pct = custo > 0 ? arredondar2_(((precoAtual - custo) / custo) * 100) : null;
  base.lucro_atual = custo > 0 ? arredondar2_(precoAtual - custo) : null;

  // Três motivos pra não sugerir nada: sem custo lançado (não há de onde partir),
  // preço travado (decisão humana explícita) e sem faixa definida (a decisão de
  // margem ainda não foi tomada). Nos três o produto continua aparecendo na tela
  // — com o motivo escrito — só fica fora da fila de ajuste.
  if (custo <= 0 || travado || margem.pct === null) {
    base.preco_sugerido = null;
    base.variacao_pct = null;
    base.precisa_ajuste = false;
    base.alerta = false;
    base.motivo_sem_sugestao = custo <= 0 ? 'sem_custo' : (travado ? 'travado' : 'sem_faixa');
    return base;
  }

  const sugerido = arredondarPrecoComercial_(custo * (1 + margem.pct / 100));
  base.preco_sugerido = sugerido;
  base.margem_sugerida_pct = arredondar2_(((sugerido - custo) / custo) * 100);
  base.variacao_pct = precoAtual > 0 ? arredondar2_(((sugerido - precoAtual) / precoAtual) * 100) : null;
  // Diferença menor que um centavo é ruído de arredondamento, não ajuste.
  base.precisa_ajuste = Math.abs(sugerido - precoAtual) >= 0.01;
  base.alerta = base.variacao_pct !== null && Math.abs(base.variacao_pct) >= LIMIAR_ALERTA_VARIACAO_PCT;
  return base;
}

function mapearRegras_(regras) {
  const mapa = {};
  regras.forEach(function (r) { mapa[String(r.categoria)] = r; });
  return mapa;
}

function lerRegrasMargem_() {
  const regras = lerAbaComoObjetosOpcional_(NOMES_ABAS.REGRAS_MARGEM);
  if (!regras || regras.length === 0) {
    return REGRAS_MARGEM_SEED.map(function (r) {
      return { categoria: r[0], rotulo: r[1], margem_pct: r[2], descricao: r[3], ordem: r[4] };
    });
  }
  return regras.map(function (r) {
    return {
      categoria: String(r.categoria),
      rotulo: String(r.rotulo || r.categoria),
      margem_pct: Number(r.margem_pct) || 0,
      descricao: String(r.descricao || ''),
      ordem: Number(r.ordem) || 0
    };
  }).sort(function (a, b) { return a.ordem - b.ordem; });
}

function obterAquisicao_() {
  const regras = lerRegrasMargem_();
  const mapaRegras = mapearRegras_(regras);

  const produtos = lerAbaComoObjetos_(NOMES_ABAS.PRODUTOS).map(function (p) {
    return calcularPrecificacaoProduto_(p, mapaRegras);
  });

  const compras = lerAbaComoObjetosOpcional_(NOMES_ABAS.COMPRAS) || [];
  const itens = lerAbaComoObjetosOpcional_(NOMES_ABAS.COMPRAS_ITENS) || [];

  const itensPorCompra = {};
  itens.forEach(function (i) {
    const chave = String(i.compra_id);
    if (!itensPorCompra[chave]) itensPorCompra[chave] = [];
    itensPorCompra[chave].push({
      id: i.id,
      compra_id: i.compra_id,
      descricao_cupom: String(i.descricao_cupom || ''),
      codigo: String(i.codigo || ''),
      produto: String(i.produto || ''),
      quantidade: Number(i.quantidade) || 0,
      custo_unit: Number(i.custo_unit) || 0,
      custo_total: Number(i.custo_total) || 0,
      desconto: Number(i.desconto) || 0
    });
  });

  const precoPorProduto = {};
  produtos.forEach(function (p) { precoPorProduto[p.nome] = p.preco; });

  const comprasComItens = compras.map(function (c) {
    const itensDaCompra = itensPorCompra[String(c.id)] || [];
    return {
      id: c.id,
      data: String(c.data || ''),
      mercado: String(c.mercado || ''),
      documento: String(c.documento || ''),
      valor_total: Number(c.valor_total) || 0,
      observacao: String(c.observacao || ''),
      origem: String(c.origem || 'manual'),
      itens: itensDaCompra,
      lucro: calcularLucroCompra_(itensDaCompra, precoPorProduto)
    };
  }).sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });

  // Itens que entraram no sistema mas ainda não sabemos a que produto do catálogo
  // correspondem. Hoje só acontece se a pessoa salvar sem vincular; é o mesmo
  // balde onde vão cair os itens não reconhecidos de uma importação futura.
  const pendentes = [];
  comprasComItens.forEach(function (c) {
    c.itens.forEach(function (i) {
      if (!i.produto) pendentes.push(Object.assign({ mercado: c.mercado, data: c.data }, i));
    });
  });

  // Sinaliza pra tela que a planilha ainda é da estrutura antiga (sem as abas da
  // Aquisição). Sem isso, a tela ficaria vazia sem explicar o porquê.
  const estruturaPendente = !SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMES_ABAS.COMPRAS);

  return {
    produtos: produtos,
    regras: regras,
    compras: comprasComItens,
    pendentes: pendentes,
    lucroPorMes: agruparLucroPorMes_(comprasComItens),
    painel: montarPainelGestao_(comprasComItens, produtos, regras),
    estruturaPendente: estruturaPendente,
    limiteAlertaPct: LIMIAR_ALERTA_VARIACAO_PCT
  };
}

// Lucro PREVISTO de uma compra: o que ela rende se todo o estoque for vendido ao
// preço de hoje. Não é lucro realizado, e a diferença é grande — este sistema não
// registra venda nenhuma. Ele conhece o que entrou (cupom), o que sumiu da
// prateleira sem pagar (furo) e o que foi cobrado disso; a venda paga acontece no
// sistema da Pináculo. Chamar isso de "lucro do mês" sem o "previsto" seria
// convidar a decidir em cima de um número que não existe ainda.
//
// Só entram itens vinculados a produto do catálogo e com preço de venda definido —
// sem preço não há o que projetar. Os de fora são contados e mostrados, pra
// diferença entre o total do cupom e a base do cálculo nunca ficar sem explicação.
function calcularLucroCompra_(itens, precoPorProduto) {
  let custo = 0, venda = 0, itensFora = 0, custoFora = 0;

  itens.forEach(function (i) {
    const preco = i.produto ? Number(precoPorProduto[i.produto]) || 0 : 0;
    if (!preco) {
      itensFora++;
      custoFora += Number(i.custo_total) || 0;
      return;
    }
    custo += Number(i.custo_total) || 0;
    venda += (Number(i.quantidade) || 0) * preco;
  });

  const lucro = venda - custo;
  return {
    custo: arredondar2_(custo),
    venda_prevista: arredondar2_(venda),
    lucro_previsto: arredondar2_(lucro),
    margem_pct: custo > 0 ? arredondar2_((lucro / custo) * 100) : null,
    itens_fora: itensFora,
    custo_fora: arredondar2_(custoFora)
  };
}

// ===================== PAINEL DE GESTÃO =====================
// Tudo aqui é derivado do que já existe (compras, itens, catálogo) — nenhum número
// novo é inventado, e nenhum vira "realizado". Continua valendo o mesmo alerta do
// lucro previsto: o sistema conhece a compra e o preço de prateleira, não a venda.
//
// A conta mora no servidor junto com o resto pra tela e planilha nunca divergirem.
function montarPainelGestao_(compras, produtos, regras) {
  const precoPorProduto = {};
  const produtoPorNome = {};
  produtos.forEach(function (p) { precoPorProduto[p.nome] = p.preco; produtoPorNome[p.nome] = p; });

  // Quantidade e custo comprados por produto — a base pra medir oportunidade e
  // ranquear produto por lucro. Sem volume de venda, o volume de COMPRA é o
  // proxy honesto: é o que de fato passou pela prateleira.
  const compradoPorProduto = {};
  compras.forEach(function (c) {
    c.itens.forEach(function (i) {
      if (!i.produto) return;
      if (!compradoPorProduto[i.produto]) compradoPorProduto[i.produto] = { qtd: 0, custo: 0 };
      compradoPorProduto[i.produto].qtd += Number(i.quantidade) || 0;
      compradoPorProduto[i.produto].custo += Number(i.custo_total) || 0;
    });
  });

  return {
    meses: resumirPeriodos_(compras, 7),
    anos: resumirPeriodos_(compras, 4),
    mercados: resumirMercados_(compras),
    faixas: resumirFaixas_(produtos, regras),
    oportunidade: medirOportunidade_(produtos, compradoPorProduto),
    cobertura: medirCobertura_(produtos),
    topProdutos: ranquearProdutos_(compradoPorProduto, produtoPorNome)
  };
}

// tamanhoChave 7 = 'yyyy-MM' (mês); 4 = 'yyyy' (ano). Mesma conta, recorte diferente.
function resumirPeriodos_(compras, tamanhoChave) {
  const mapa = {};
  compras.forEach(function (c) {
    const chave = String(c.data || '').slice(0, tamanhoChave);
    if (chave.length !== tamanhoChave) return;
    if (!mapa[chave]) {
      mapa[chave] = { periodo: chave, compras: 0, custo: 0, venda_prevista: 0, lucro_previsto: 0,
                      desconto: 0, itens: 0, itens_fora: 0, custo_fora: 0 };
    }
    const m = mapa[chave];
    m.compras++;
    m.custo += c.lucro.custo;
    m.venda_prevista += c.lucro.venda_prevista;
    m.lucro_previsto += c.lucro.lucro_previsto;
    m.itens_fora += c.lucro.itens_fora;
    m.custo_fora += c.lucro.custo_fora;
    c.itens.forEach(function (i) {
      m.itens++;
      m.desconto += Number(i.desconto) || 0;
    });
  });

  return Object.keys(mapa).sort().reverse().map(function (chave) {
    const m = mapa[chave];
    const bruto = m.custo + m.custo_fora + m.desconto;
    return Object.assign(m, {
      custo: arredondar2_(m.custo),
      venda_prevista: arredondar2_(m.venda_prevista),
      lucro_previsto: arredondar2_(m.lucro_previsto),
      desconto: arredondar2_(m.desconto),
      custo_fora: arredondar2_(m.custo_fora),
      margem_pct: m.custo > 0 ? arredondar2_((m.lucro_previsto / m.custo) * 100) : null,
      // Quanto o desconto obtido representa do que o cupom pedia. É o termômetro
      // de barganha da operação, e some se ninguém preencher a coluna de desconto.
      desconto_pct: bruto > 0 ? arredondar2_((m.desconto / bruto) * 100) : null
    });
  });
}

// Onde vale mais a pena comprar. Duas lojas com o mesmo gasto podem render margens
// bem diferentes — sem esse recorte, isso fica invisível.
function resumirMercados_(compras) {
  const mapa = {};
  compras.forEach(function (c) {
    const nome = String(c.mercado || 'Sem mercado').trim() || 'Sem mercado';
    if (!mapa[nome]) mapa[nome] = { mercado: nome, compras: 0, custo: 0, venda_prevista: 0, lucro_previsto: 0, desconto: 0 };
    const m = mapa[nome];
    m.compras++;
    m.custo += c.lucro.custo;
    m.venda_prevista += c.lucro.venda_prevista;
    m.lucro_previsto += c.lucro.lucro_previsto;
    c.itens.forEach(function (i) { m.desconto += Number(i.desconto) || 0; });
  });

  return Object.keys(mapa).map(function (nome) {
    const m = mapa[nome];
    return Object.assign(m, {
      custo: arredondar2_(m.custo),
      venda_prevista: arredondar2_(m.venda_prevista),
      lucro_previsto: arredondar2_(m.lucro_previsto),
      desconto: arredondar2_(m.desconto),
      margem_pct: m.custo > 0 ? arredondar2_((m.lucro_previsto / m.custo) * 100) : null
    });
  }).sort(function (a, b) { return b.custo - a.custo; });
}

// Faixa por faixa: quanto do catálogo está nela, quantos já têm custo, e —
// o que interessa — a distância entre a margem que ela pratica e a que ela mira.
function resumirFaixas_(produtos, regras) {
  const linhas = regras.map(function (r) {
    const daFaixa = produtos.filter(function (p) { return p.categoria === r.categoria; });
    const comCusto = daFaixa.filter(function (p) { return p.custo_atual > 0 && p.margem_atual_pct !== null; });
    const media = comCusto.length
      ? comCusto.reduce(function (s, p) { return s + p.margem_atual_pct; }, 0) / comCusto.length
      : null;
    return {
      categoria: r.categoria,
      rotulo: r.rotulo,
      margem_alvo_pct: r.margem_pct,
      produtos: daFaixa.length,
      com_custo: comCusto.length,
      margem_media_pct: media === null ? null : arredondar2_(media),
      fora_do_alvo: daFaixa.filter(function (p) { return p.precisa_ajuste; }).length
    };
  });

  const semFaixa = produtos.filter(function (p) { return !p.categoria; });
  if (semFaixa.length) {
    linhas.push({
      categoria: '', rotulo: 'Sem faixa', margem_alvo_pct: null,
      produtos: semFaixa.length,
      com_custo: semFaixa.filter(function (p) { return p.custo_atual > 0; }).length,
      margem_media_pct: null, fora_do_alvo: 0
    });
  }
  return linhas;
}

// O número mais acionável do painel: quanto lucro está parado na fila de ajuste.
// Mede em cima do volume já comprado de cada produto — "se o que você comprou
// tivesse sido vendido ao preço sugerido em vez do atual, o lucro seria X a mais".
// Duas histórias diferentes moram na mesma fila de ajuste, e não podem virar um
// só número: item que precisa SUBIR é dinheiro que ainda não foi capturado —
// sempre uma boa notícia. Item que precisa CAIR está hoje ACIMA do alvo da
// própria faixa, e corrigir reduz a receita prevista — não é prejuízo, é a
// margem voltando pro que a faixa define, mas é uma notícia diferente da
// primeira. Somar as duas e chamar de "oportunidade" escondia o sinal: com
// itens de queda pesando mais que os de alta, o total líquido saía negativo
// contradizendo a própria promessa de "renderia a mais".
function medirOportunidade_(produtos, compradoPorProduto) {
  const detalhe = [];
  let total = 0, totalSobe = 0, totalDesce = 0, produtosSobe = 0, produtosDesce = 0;

  produtos.forEach(function (p) {
    if (!p.precisa_ajuste || !p.preco_sugerido) return;
    const comprado = compradoPorProduto[p.nome];
    if (!comprado || !(comprado.qtd > 0)) return;
    const ganho = comprado.qtd * (p.preco_sugerido - p.preco);
    total += ganho;
    if (ganho >= 0) { totalSobe += ganho; produtosSobe++; } else { totalDesce += ganho; produtosDesce++; }
    detalhe.push({
      nome: p.nome,
      categoria: p.categoria,
      qtd_comprada: comprado.qtd,
      preco: p.preco,
      preco_sugerido: p.preco_sugerido,
      variacao_pct: p.variacao_pct,
      ganho: arredondar2_(ganho)
    });
  });

  detalhe.sort(function (a, b) { return Math.abs(b.ganho) - Math.abs(a.ganho); });
  return {
    produtos: detalhe.length,
    produtos_sobe: produtosSobe,
    produtos_desce: produtosDesce,
    ganho_total: arredondar2_(total),
    ganho_positivo: arredondar2_(totalSobe),
    ganho_negativo: arredondar2_(totalDesce),
    detalhe: detalhe.slice(0, 12)
  };
}

function medirCobertura_(produtos) {
  const ativos = produtos.filter(function (p) { return p.ativo; });
  return {
    total: produtos.length,
    ativos: ativos.length,
    com_custo: produtos.filter(function (p) { return p.custo_atual > 0; }).length,
    sem_faixa: produtos.filter(function (p) { return !p.categoria; }).length,
    travados: produtos.filter(function (p) { return p.preco_travado; }).length,
    na_fila: produtos.filter(function (p) { return p.precisa_ajuste; }).length
  };
}

// Onde o dinheiro está concentrado. Ordenado por lucro previsto em reais, não por
// margem percentual: 200% de margem num item que você compra 2 unidades importa
// menos que 40% num que você compra 150.
function ranquearProdutos_(compradoPorProduto, produtoPorNome) {
  const linhas = [];
  Object.keys(compradoPorProduto).forEach(function (nome) {
    const p = produtoPorNome[nome];
    if (!p || !(p.preco > 0)) return;
    const comprado = compradoPorProduto[nome];
    const custoUnit = comprado.qtd > 0 ? comprado.custo / comprado.qtd : 0;
    if (!(custoUnit > 0)) return;
    linhas.push({
      nome: nome,
      categoria: p.categoria,
      qtd: comprado.qtd,
      custo: arredondar2_(comprado.custo),
      venda_prevista: arredondar2_(comprado.qtd * p.preco),
      lucro_previsto: arredondar2_(comprado.qtd * p.preco - comprado.custo),
      margem_pct: arredondar2_(((p.preco - custoUnit) / custoUnit) * 100)
    });
  });
  return linhas.sort(function (a, b) { return b.lucro_previsto - a.lucro_previsto; }).slice(0, 12);
}

function agruparLucroPorMes_(compras) {
  const mapa = {};
  compras.forEach(function (c) {
    const mes = String(c.data || '').slice(0, 7); // yyyy-MM
    if (mes.length !== 7) return;
    if (!mapa[mes]) mapa[mes] = { mes: mes, compras: 0, custo: 0, venda_prevista: 0, lucro_previsto: 0, itens_fora: 0, custo_fora: 0 };
    const m = mapa[mes];
    m.compras++;
    m.custo += c.lucro.custo;
    m.venda_prevista += c.lucro.venda_prevista;
    m.lucro_previsto += c.lucro.lucro_previsto;
    m.itens_fora += c.lucro.itens_fora;
    m.custo_fora += c.lucro.custo_fora;
  });

  return Object.keys(mapa).sort().reverse().map(function (mes) {
    const m = mapa[mes];
    return Object.assign(m, {
      custo: arredondar2_(m.custo),
      venda_prevista: arredondar2_(m.venda_prevista),
      lucro_previsto: arredondar2_(m.lucro_previsto),
      custo_fora: arredondar2_(m.custo_fora),
      margem_pct: m.custo > 0 ? arredondar2_((m.lucro_previsto / m.custo) * 100) : null
    });
  });
}

// Grava o cupom e os itens, e — item por item vinculado a um produto do catálogo —
// atualiza o custo daquele produto e ensina o de-para a reconhecer aquela descrição
// da próxima vez. O preço NÃO é mexido aqui: custo entrando é fato, preço mudando
// é decisão, e a decisão fica na tela de revisão (aplicarPrecos_).
function criarCompra_(params) {
  return comTravamento_(function () {
    const abaCompras = obterAba_(NOMES_ABAS.COMPRAS);
    const itens = params.itens || [];
    if (itens.length === 0) throw new Error('Informe ao menos um item do cupom.');

    const carimbo = Utilities.formatDate(new Date(), FUSO_HORARIO, 'yyyyMMddHHmmss');
    const idCompra = 'CP' + carimbo + Math.floor(Math.random() * 90 + 10);

    escreverLinhaComoTexto_(abaCompras, abaCompras.getLastRow() + 1, montarLinhaCompra_(idCompra, params, itens), [2, 8]);
    const resultado = gravarItensCompra_(idCompra, itens, params);
    return { id: idCompra, valor_total: resultado.valor_total, produtos_com_custo: resultado.produtos_com_custo };
  });
}

function somaItens_(itens) {
  return itens.reduce(function (soma, item) {
    return soma + (Number(item.qtd) || 0) * (Number(item.custo_unit) || 0);
  }, 0);
}

function montarLinhaCompra_(idCompra, params, itens) {
  return [
    idCompra,
    params.data,
    params.mercado || '',
    params.documento || '',
    arredondar2_(somaItens_(itens)),
    params.observacao || '',
    params.origem || 'manual',
    agora_()
  ];
}

// Sem trava própria — sempre chamada de dentro de um comTravamento_.
// Escreve as linhas de item, ensina o de-para e grava o custo dos produtos.
// Compartilhada por criarCompra_ e atualizarCompra_ de propósito: são o mesmo
// trabalho, e duplicar isso era o caminho garantido pra editar um cupom passar a
// calcular o custo diferente de lançar um.
function gravarItensCompra_(idCompra, itens, params) {
  const abaItens = obterAba_(NOMES_ABAS.COMPRAS_ITENS);
  const carimbo = Utilities.formatDate(new Date(), FUSO_HORARIO, 'yyyyMMddHHmmss');

  // Um cupom traz o mesmo produto do catálogo em várias linhas — no cupom real,
  // Bala Fini veio em 4 códigos (um por sabor) e Coca lata em 4 linhas. Gravar
  // o custo linha por linha faria a última sobrescrever as outras, e o custo do
  // produto passaria a ser o do último sabor em vez do da compra. Por isso as
  // linhas vão inteiras pro histórico, mas o custo é consolidado por produto
  // (média ponderada pela quantidade) e gravado uma vez só, no fim.
  const consolidado = {};
  const ordemProdutos = [];

  itens.forEach(function (item, indice) {
    const idItem = 'CI' + carimbo + '-' + indice + Math.floor(Math.random() * 90 + 10);
    const qtd = Number(item.qtd) || 0;
    const custoUnit = Number(item.custo_unit) || 0;
    // custo_unit e custo_total são sempre líquidos (já com o desconto da linha
    // abatido) — é o custo líquido que precifica. A coluna desconto fica ao lado
    // só pra o histórico contar a verdade inteira: quanto o cupom pedia e quanto
    // foi abatido naquela linha.
    const linha = [
      idItem,
      idCompra,
      item.descricao_cupom || item.produto || '',
      item.codigo || '',
      item.produto || '',
      qtd,
      custoUnit,
      arredondar2_(qtd * custoUnit),
      arredondar2_(Number(item.desconto) || 0)
    ];
    abaItens.getRange(abaItens.getLastRow() + 1, 1, 1, linha.length).setValues([linha]);

    if (item.produto) {
      const nome = String(item.produto);
      if (!consolidado[nome]) { consolidado[nome] = { qtd: 0, valor: 0 }; ordemProdutos.push(nome); }
      consolidado[nome].qtd += qtd;
      consolidado[nome].valor += qtd * custoUnit;

      // params.loja existe pra importação passar o CNPJ do emitente, que é um
      // escopo bem mais confiável que o nome digitado à mão.
      aprenderDePara_(item.codigo, item.descricao_cupom || item.produto, item.produto, params.origem || 'manual', params.loja || params.mercado);
    }
  });

  ordemProdutos.forEach(function (nome) {
    const a = consolidado[nome];
    if (a.qtd > 0) registrarCustoProduto_(nome, a.valor / a.qtd, params.data);
  });

  return { valor_total: arredondar2_(somaItens_(itens)), produtos_com_custo: ordemProdutos.length };
}

// Reescreve um cupom já lançado: cabeçalho, itens e o custo que eles produzem.
// Os itens antigos são apagados e regravados em vez de casados um a um — o que a
// pessoa mandou é a verdade do cupom agora, e tentar adivinhar quais linhas
// "são as mesmas" só criaria caso estranho quando ela apaga e adiciona junto.
//
// Custo de produto que saiu do cupom na edição fica como estava: o sistema não
// tem como saber qual era o custo anterior àquele lançamento. Mesmo critério do
// excluirCompra_ — pra corrigir um custo, o caminho é lançar o custo certo.
function atualizarCompra_(params) {
  return comTravamento_(function () {
    const itens = params.itens || [];
    if (itens.length === 0) throw new Error('O cupom precisa ter ao menos um item.');

    const abaCompras = obterAba_(NOMES_ABAS.COMPRAS);
    const valores = abaCompras.getDataRange().getValues();
    const colId = valores[0].indexOf('id');

    let linhaCompra = 0;
    for (let i = 1; i < valores.length; i++) {
      if (String(valores[i][colId]) === String(params.id)) { linhaCompra = i + 1; break; }
    }
    if (!linhaCompra) throw new Error('Compra não encontrada: ' + params.id);

    // Preserva a origem registrada no lançamento (manual/nfce): editar um cupom
    // importado não o transforma num cupom digitado à mão.
    const colOrigem = valores[0].indexOf('origem');
    const origemGravada = String(valores[linhaCompra - 1][colOrigem] || 'manual');
    const comOrigem = Object.assign({}, params, { origem: params.origem || origemGravada });

    const abaItens = obterAba_(NOMES_ABAS.COMPRAS_ITENS);
    const valoresItens = abaItens.getDataRange().getValues();
    const colCompraId = valoresItens[0].indexOf('compra_id');
    for (let i = valoresItens.length - 1; i >= 1; i--) {
      if (String(valoresItens[i][colCompraId]) === String(params.id)) abaItens.deleteRow(i + 1);
    }

    escreverLinhaComoTexto_(abaCompras, linhaCompra, montarLinhaCompra_(params.id, comOrigem, itens), [2, 8]);
    const resultado = gravarItensCompra_(params.id, itens, comOrigem);
    return { id: params.id, valor_total: resultado.valor_total, produtos_com_custo: resultado.produtos_com_custo };
  });
}

// Sem trava própria — sempre chamada de dentro de um comTravamento_.
// Guarda o último custo conhecido. É "último custo", não média: se o mercado
// mudou de preço, é o preço novo que interessa pra decidir o seu. O histórico
// continua inteiro em ComprasItens pra conferir se aquele custo foi promoção.
function registrarCustoProduto_(nomeProduto, custoUnit, dataCompra) {
  const aba = obterAba_(NOMES_ABAS.PRODUTOS);
  const valores = aba.getDataRange().getValues();
  const cabecalho = valores[0];
  const colNome = cabecalho.indexOf('nome');
  const colCusto = cabecalho.indexOf('custo_atual');
  const colDataCusto = cabecalho.indexOf('data_custo');
  if (colCusto === -1 || colDataCusto === -1) return { atualizado: false };

  for (let i = 1; i < valores.length; i++) {
    if (String(valores[i][colNome]) === String(nomeProduto)) {
      const linha = i + 1;
      aba.getRange(linha, colCusto + 1).setValue(arredondar2_(custoUnit));
      aba.getRange(linha, colDataCusto + 1).setNumberFormat('@');
      aba.getRange(linha, colDataCusto + 1).setValue(dataCompra || '');
      return { atualizado: true };
    }
  }
  return { atualizado: false };
}

// Sem trava própria — sempre chamada de dentro de um comTravamento_.
// A memória que faz a digitação diminuir a cada cupom: uma vez que a pessoa
// disse que "CHOC LACTA 80G" é o "Chocolate Lacta 80g - Sabores" do catálogo,
// o sistema não pergunta de novo.
// `loja` é o escopo da chave (ver chaveDePara_): hoje o nome do mercado digitado,
// e o CNPJ quando a importação de NFC-e passar a preencher.
function aprenderDePara_(codigo, descricao, produto, origem, loja) {
  const aba = obterAba_(NOMES_ABAS.DE_PARA);
  const chave = chaveDePara_(codigo, descricao, loja);
  const valores = aba.getDataRange().getValues();
  const cabecalho = valores[0];
  const colChave = cabecalho.indexOf('chave');

  for (let i = 1; i < valores.length; i++) {
    if (String(valores[i][colChave]) === chave) {
      const linha = i + 1;
      aba.getRange(linha, 5).setNumberFormat('@');
      aba.getRange(linha, 2, 1, 4).setValues([[descricao || '', produto, origem || 'manual', agora_()]]);
      return { atualizado: true };
    }
  }
  escreverLinhaComoTexto_(aba, aba.getLastRow() + 1, [chave, descricao || '', produto, origem || 'manual', agora_()], [5]);
  return { criado: true };
}

// Mercado que originou uma compra — o escopo da chave do de-para. Devolve string
// vazia se a compra não for achada; aí a chave cai no escopo 'SEM LOJA', que é
// impreciso mas nunca vincula errado o item de outro mercado.
function lojaDaCompra_(compraId) {
  const aba = obterAba_(NOMES_ABAS.COMPRAS);
  const valores = aba.getDataRange().getValues();
  const cabecalho = valores[0];
  const colId = cabecalho.indexOf('id');
  const colMercado = cabecalho.indexOf('mercado');
  for (let i = 1; i < valores.length; i++) {
    if (String(valores[i][colId]) === String(compraId)) return String(valores[i][colMercado] || '');
  }
  return '';
}

// Liga um item de cupom que ficou sem produto a um produto do catálogo (ou troca
// o vínculo errado). Além de corrigir o item, propaga o custo e ensina o de-para.
function vincularItemCompra_(params) {
  return comTravamento_(function () {
    const aba = obterAba_(NOMES_ABAS.COMPRAS_ITENS);
    const valores = aba.getDataRange().getValues();
    const cabecalho = valores[0];
    const colId = cabecalho.indexOf('id');
    const colProduto = cabecalho.indexOf('produto');

    for (let i = 1; i < valores.length; i++) {
      if (String(valores[i][colId]) === String(params.id)) {
        aba.getRange(i + 1, colProduto + 1).setValue(params.produto);
        const custoUnit = Number(valores[i][cabecalho.indexOf('custo_unit')]) || 0;
        const codigo = valores[i][cabecalho.indexOf('codigo')];
        const descricao = valores[i][cabecalho.indexOf('descricao_cupom')];
        registrarCustoProduto_(params.produto, custoUnit, params.data || '');
        // A chave do de-para é presa ao mercado, então o vínculo tem que ser
        // aprendido no escopo da compra que originou o item — não solto.
        aprenderDePara_(codigo, descricao, params.produto, 'manual', lojaDaCompra_(valores[i][cabecalho.indexOf('compra_id')]));
        return { vinculado: true };
      }
    }
    throw new Error('Item de compra não encontrado: ' + params.id);
  });
}

// Apaga o cupom e seus itens. Não desfaz o custo já registrado no produto de
// propósito: o custo é o último que você de fato pagou, e "apagar o cupom
// digitado errado" não devolve mágicamente qual era o custo anterior. Pra
// corrigir o custo, lance o cupom certo ou edite o produto.
function excluirCompra_(params) {
  return comTravamento_(function () {
    const abaItens = obterAba_(NOMES_ABAS.COMPRAS_ITENS);
    const valoresItens = abaItens.getDataRange().getValues();
    const colCompraId = valoresItens[0].indexOf('compra_id');
    for (let i = valoresItens.length - 1; i >= 1; i--) {
      if (String(valoresItens[i][colCompraId]) === String(params.id)) abaItens.deleteRow(i + 1);
    }

    const abaCompras = obterAba_(NOMES_ABAS.COMPRAS);
    const valores = abaCompras.getDataRange().getValues();
    const colId = valores[0].indexOf('id');
    for (let i = 1; i < valores.length; i++) {
      if (String(valores[i][colId]) === String(params.id)) {
        abaCompras.deleteRow(i + 1);
        return { excluido: true };
      }
    }
    throw new Error('Compra não encontrada: ' + params.id);
  });
}

function salvarRegrasMargem_(params) {
  return comTravamento_(function () {
    const aba = obterAba_(NOMES_ABAS.REGRAS_MARGEM);
    const regras = params.regras || [];
    if (regras.length === 0) throw new Error('Informe ao menos uma faixa de margem.');

    const ultimaLinha = aba.getLastRow();
    if (ultimaLinha > 1) aba.getRange(2, 1, ultimaLinha - 1, 5).clearContent();

    const linhas = regras.map(function (r, indice) {
      return [String(r.categoria), String(r.rotulo || r.categoria), Number(r.margem_pct) || 0, String(r.descricao || ''), indice + 1];
    });
    aba.getRange(2, 1, linhas.length, 5).setValues(linhas);
    return { salvo: true, total: linhas.length };
  });
}

function atualizarProduto_(params) {
  return comTravamento_(function () {
    const aba = obterAba_(NOMES_ABAS.PRODUTOS);
    const valores = aba.getDataRange().getValues();
    const cabecalho = valores[0];
    const colNome = cabecalho.indexOf('nome');

    for (let i = 1; i < valores.length; i++) {
      if (String(valores[i][colNome]) === String(params.nome)) {
        const linha = i + 1;
        const camposPermitidos = ['preco', 'ativo', 'categoria', 'margem_pct', 'custo_atual', 'data_custo', 'preco_travado'];
        camposPermitidos.forEach(function (campo) {
          if (!Object.prototype.hasOwnProperty.call(params, campo)) return;
          const col = cabecalho.indexOf(campo);
          if (col === -1) return;
          if (campo === 'data_custo') aba.getRange(linha, col + 1).setNumberFormat('@');
          aba.getRange(linha, col + 1).setValue(params[campo]);
        });
        return { atualizado: true };
      }
    }
    throw new Error('Produto não encontrado: ' + params.nome);
  });
}

// Aplica em lote os preços que a pessoa aprovou na tela de revisão. Recebe os
// preços já decididos — o servidor não recalcula nada aqui, senão o valor
// aprovado na tela e o gravado poderiam ser diferentes (ex: se um cupom novo
// entrasse entre a revisão e o clique em aplicar).
function aplicarPrecos_(params) {
  return comTravamento_(function () {
    const aba = obterAba_(NOMES_ABAS.PRODUTOS);
    const precos = params.precos || [];
    if (precos.length === 0) throw new Error('Nenhum preço selecionado.');

    const valores = aba.getDataRange().getValues();
    const cabecalho = valores[0];
    const colNome = cabecalho.indexOf('nome');
    const colPreco = cabecalho.indexOf('preco');

    const linhaPorNome = {};
    for (let i = 1; i < valores.length; i++) linhaPorNome[String(valores[i][colNome])] = i + 1;

    let aplicados = 0;
    const ignorados = [];
    precos.forEach(function (p) {
      const linha = linhaPorNome[String(p.nome)];
      const novoPreco = Number(p.preco);
      if (!linha || !(novoPreco > 0)) { ignorados.push(p.nome); return; }
      aba.getRange(linha, colPreco + 1).setValue(arredondar2_(novoPreco));
      aplicados++;
    });

    return { aplicados: aplicados, ignorados: ignorados };
  });
}

// ===================== IMPORTAÇÃO DE NFC-e =====================
// Todo cupom fiscal traz um QR code que abre uma página pública da SEFAZ com o
// cupom inteiro em HTML — descrição, código, quantidade e valor unitário de cada
// item. Ler dali é o que tira a digitação do caminho, e não depende de acesso a
// sistema de terceiro nenhum.
//
// A página é da SEFAZ do Paraná (fazenda.pr.gov.br). Outros estados publicam o
// mesmo dado em layout diferente — se um dia precisar, é aqui que se adapta.
//
// Esta função só LÊ e devolve para revisão na tela. Nada é gravado: quem grava é
// criarCompra_, depois da pessoa conferir. Mesmo princípio do resto da Aquisição.

function lerNfce_(params) {
  const conteudo = obterHtmlNfce_(params);
  const cupom = extrairNfce_(conteudo);
  if (cupom.itens.length === 0) {
    throw new Error('Não encontrei itens nessa página. Confira se o link é o do QR code do cupom (ou cole o conteúdo da página).');
  }

  const produtos = lerAbaComoObjetos_(NOMES_ABAS.PRODUTOS);
  const dePara = lerAbaComoObjetosOpcional_(NOMES_ABAS.DE_PARA) || [];
  const mapaDePara = {};
  dePara.forEach(function (d) { mapaDePara[String(d.chave)] = String(d.produto || ''); });

  const nomesCatalogo = produtos.map(function (p) { return String(p.nome); });
  const precoPorNome = {};
  produtos.forEach(function (p) { precoPorNome[String(p.nome)] = Number(p.preco) || 0; });

  const escopo = cupom.cnpj || cupom.emitente;
  const itens = agruparItensIdenticos_(cupom.itens).map(function (item) {
    // Vínculo já aprendido vence qualquer palpite por nome: a pessoa confirmou
    // aquele de-para uma vez, e o código da loja é chave exata.
    const chave = chaveDePara_(item.codigo, item.descricao, escopo);
    const aprendido = mapaDePara[chave] || '';

    let sugerido = aprendido;
    let origemVinculo = aprendido ? 'aprendido' : '';
    if (!sugerido) {
      const palpite = casarProdutoPorNome_(item.descricao, nomesCatalogo);
      if (palpite) { sugerido = palpite; origemVinculo = 'palpite'; }
    }

    const precoVenda = precoPorNome[sugerido] || 0;
    // Dois sinais de que a linha não é uma unidade de venda: a descrição diz que
    // é fardo/pack, ou o custo unitário encostou no preço de venda. O segundo
    // pega o caso real "PACK GUARANA ANT UN — 1 un × R$ 52,99", que entraria como
    // se uma latinha custasse 52,99 e faria o sistema sugerir preço absurdo.
    const pareceFardo = /\b(PACK|FARDO|ENGRAD|ENGRADADO)\b/.test(normalizarTexto_(item.descricao));
    const custoAcimaDoPreco = precoVenda > 0 && item.custo_unit >= precoVenda;

    return {
      numeros: item.numeros || [],
      descricao_cupom: item.descricao,
      codigo: item.codigo,
      unidade: item.unidade,
      qtd: item.qtd,
      custo_unit: item.custo_unit,
      custo_total: arredondar2_(item.qtd * item.custo_unit),
      // O DANFE não diz em qual item foi o abatimento, então cada linha nasce sem
      // desconto: quem distribui é a pessoa, que tem o cupom na mão.
      desconto: 0,
      produto: sugerido,
      origem_vinculo: origemVinculo,
      preco_venda_atual: precoVenda,
      alerta_fardo: pareceFardo,
      alerta_custo_acima: custoAcimaDoPreco
    };
  });

  return {
    emitente: cupom.emitente,
    cnpj: cupom.cnpj,
    chave: cupom.chave,
    data: cupom.data,
    itens: itens,
    total_itens: arredondar2_(itens.reduce(function (s, i) { return s + i.custo_total; }, 0)),
    linhas_originais: cupom.itens.length,
    // Bloco de totais do cupom. O desconto importa muito e não aparece em lugar
    // nenhum nas linhas de item: um cupom de R$ 929,37 em itens pode ter sido pago
    // por R$ 904,47. Sem trazer isso, o custo de tudo entra inflado e toda sugestão
    // de preço sai alta. O DANFE não detalha o desconto por item, só o total —
    // então quem decide como distribuir é a pessoa, na tela.
    valor_bruto: cupom.valor_bruto,
    desconto: cupom.desconto,
    valor_pago: cupom.valor_pago
  };
}

// Aceita o link do QR code (busca a página) ou o conteúdo já colado. O link é o
// caminho normal; colar existe porque a busca pode falhar (SEFAZ fora do ar,
// página exigindo captcha) e nesse caso a pessoa abre no navegador e copia.
function obterHtmlNfce_(params) {
  const colado = String(params.conteudo || '').trim();
  if (colado) return colado;

  const url = String(params.url || '').trim();
  if (!url) throw new Error('Informe o link do QR code do cupom ou cole o conteúdo da página.');
  if (url.indexOf('http') !== 0) throw new Error('O link precisa começar com http.');

  let resposta;
  try {
    // O "p=" da URL da SEFAZ tem barras verticais, que precisam ir codificadas.
    resposta = UrlFetchApp.fetch(url.replace(/\|/g, '%7C'), { muteHttpExceptions: true, followRedirects: true });
  } catch (err) {
    throw new Error('Não consegui acessar a página do cupom. Abra o link no navegador, copie a página e cole aqui.');
  }
  if (resposta.getResponseCode() !== 200) {
    throw new Error('A página do cupom respondeu ' + resposta.getResponseCode() + '. Abra o link no navegador, copie a página e cole aqui.');
  }
  return resposta.getContentText();
}

function textoDeHtml_(trecho) {
  return String(trecho || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// "1.234,56" -> 1234.56
function numeroBr_(texto) {
  const limpo = String(texto || '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return isNaN(n) ? 0 : n;
}

function extrairNfce_(conteudo) {
  const emitente = textoDeHtml_((conteudo.match(/class="txtTopo"[^>]*>([\s\S]*?)<\/div>/) || [])[1])
    || primeiraLinhaComNome_(conteudo);
  const cnpj = (conteudo.match(/CNPJ:\s*([\d.\/-]{14,})/) || [])[1] || '';
  const chave = (conteudo.replace(/\s/g, '').match(/(\d{44})/) || [])[1] || '';
  // O DANFE mostra dd/mm/aaaa hh:mm:ss; guardamos só a data, em ISO.
  const dataBr = (conteudo.match(/(\d{2}\/\d{2}\/\d{4})/) || [])[1] || '';
  const partes = dataBr.split('/');
  const data = partes.length === 3 ? partes[2] + '-' + partes[1] + '-' + partes[0] : '';

  // Duas formas de chegar aqui: o HTML da página (link buscado pelo servidor, ou
  // arquivo salvo) e o texto puro que o navegador entrega num Ctrl+A/Ctrl+C — que
  // não tem tag nenhuma. Os dois precisam funcionar, senão a alternativa de colar
  // não serve pra nada justamente na hora em que o link falhou.
  const itens = extrairItensHtml_(conteudo);

  // Os rótulos do bloco de totais são os mesmos no HTML e no texto puro, então um
  // regex tolerante a tags no meio serve pros dois caminhos.
  const acharValor = function (rotulo) {
    const m = conteudo.match(new RegExp(rotulo + '[\\s\\S]{0,120}?([\\d.]+,\\d{2})'));
    return m ? numeroBr_(m[1]) : 0;
  };

  return {
    emitente: emitente,
    cnpj: cnpj,
    chave: chave,
    data: data,
    valor_bruto: acharValor('Valor\\s*total\\s*R\\$'),
    desconto: acharValor('Descontos?\\s*R\\$'),
    valor_pago: acharValor('Valor\\s*a\\s*pagar\\s*R\\$'),
    itens: itens.length ? itens : extrairItensTexto_(conteudo)
  };
}

// No texto puro não existe a div txtTopo pra dizer quem é o emitente. Mas o DANFE
// sempre imprime o nome logo acima do CNPJ, então é a última linha com letras
// antes da linha do CNPJ — bem mais firme que "primeira linha que parece nome",
// que pegava cabeçalho de arquivo salvo em vez do mercado.
function primeiraLinhaComNome_(conteudo) {
  const linhas = String(conteudo).split(/[\r\n]+/).map(function (l) { return l.trim(); });
  const indiceCnpj = linhas.findIndex(function (l) { return l.indexOf('CNPJ') !== -1; });
  if (indiceCnpj > 0) {
    for (let i = indiceCnpj - 1; i >= 0; i--) {
      if (/[A-Za-zÀ-ÿ]{4}/.test(linhas[i])) return linhas[i];
    }
  }
  return '';
}

function extrairItensHtml_(html) {
  const itens = [];
  const blocos = html.match(/<tr[^>]*id="Item[^"]*"[^>]*>[\s\S]*?<\/tr>/g) || [];
  blocos.forEach(function (bloco, indice) {
    const descricao = textoDeHtml_((bloco.match(/class="txtTit2?"[^>]*>([\s\S]*?)<\/span>/) || [])[1]);
    if (!descricao) return;
    // O DANFE numera os itens no id da linha ("Item + 7"). É esse número que a
    // pessoa vê no cupom impresso, então é ele que a tela mostra — assim dá pra
    // conferir linha a linha contra o papel sem contar com o dedo.
    const numero = Number((bloco.match(/id="Item\s*\+?\s*(\d+)"/) || [])[1]) || (indice + 1);
    itens.push({
      numero: numero,
      descricao: descricao,
      codigo: ((bloco.match(/C[óo]digo:\s*([^)<]+)/) || [])[1] || '').trim(),
      qtd: numeroBr_((bloco.match(/Qtde\.?:\s*<\/strong>\s*([\d.,]+)/) || [])[1]),
      unidade: ((bloco.match(/UN:\s*<\/strong>\s*([^<]+)/) || [])[1] || '').trim(),
      custo_unit: numeroBr_((bloco.match(/Vl\.?\s*Unit\.?:\s*<\/strong>\s*(?:&nbsp;|\s)*([\d.,]+)/) || [])[1])
    });
  });
  return itens;
}

// No texto puro cada item vira algo como:
//   JUNG END 500ML LIMAO (Código: 1216767)
//   Qtde.:1  UN: Un  Vl. Unit.: 3,99   Vl. Total 3,99
// O "(Código:" é a única âncora confiável: a descrição é o que vem antes dele, e
// quantidade/unidade/valor são o que vem depois, até o próximo item.
function extrairItensTexto_(texto) {
  const pedacos = String(texto).split(/\(C[óo]digo:\s*/);
  if (pedacos.length < 2) return [];

  const itens = [];
  for (let i = 1; i < pedacos.length; i++) {
    const anterior = pedacos[i - 1];
    const atual = pedacos[i];

    const codigo = (atual.match(/^([^)]*)\)/) || [])[1];
    if (codigo === undefined) continue;

    // Descrição = último trecho de texto do pedaço anterior. Nas linhas seguintes
    // à primeira, o pedaço anterior termina com "Vl. Total <valor>" e aí vem a
    // descrição do item atual — pegar da última quebra de linha resolve os dois.
    const linhas = anterior.split(/[\r\n]+/).map(function (l) { return l.trim(); }).filter(function (l) { return l; });
    let descricao = linhas.length ? linhas[linhas.length - 1] : '';
    // Se a descrição vier grudada num valor ("3,99 COOK PIRAQ 80G CHOC"), corta o número da frente.
    descricao = descricao.replace(/^[\d.,]+\s+/, '').replace(/^Vl\.?\s*Total\s*/i, '').trim();
    if (!descricao) continue;

    itens.push({
      // Texto puro não traz o id da linha; a ordem de leitura é a mesma do cupom.
      numero: itens.length + 1,
      descricao: descricao,
      codigo: codigo.trim(),
      qtd: numeroBr_((atual.match(/Qtde\.?:\s*([\d.,]+)/) || [])[1]),
      unidade: ((atual.match(/UN:\s*([A-Za-z]+)/) || [])[1] || '').trim(),
      custo_unit: numeroBr_((atual.match(/Vl\.?\s*Unit\.?:\s*([\d.,]+)/) || [])[1])
    });
  }
  return itens;
}

// Um cupom repete a mesma linha várias vezes (no cupom real, "COOK PIRAQ 80G
// BAUN" apareceu 3 vezes: 1, 1 e 18 unidades). Junta o que é literalmente o
// mesmo item — mesmo código e mesma descrição — somando quantidade e tirando o
// custo médio ponderado. Só isso: agrupar por produto do catálogo aqui seria
// errado, porque o vínculo ainda vai passar pela revisão da pessoa.
function agruparItensIdenticos_(itens) {
  const mapa = {};
  const ordem = [];
  itens.forEach(function (i) {
    const chave = normalizarTexto_(i.codigo) + '|' + normalizarTexto_(i.descricao);
    if (!mapa[chave]) {
      mapa[chave] = { descricao: i.descricao, codigo: i.codigo, unidade: i.unidade, qtd: 0, valor: 0, numeros: [] };
      ordem.push(chave);
    }
    mapa[chave].qtd += i.qtd;
    mapa[chave].valor += i.qtd * i.custo_unit;
    // Guarda todos os números que viraram esta linha: quando 3 linhas iguais são
    // somadas, a tela mostra os 3 números do cupom, e a conferência continua
    // fechando com o papel.
    if (i.numero) mapa[chave].numeros.push(i.numero);
  });
  return ordem.map(function (chave) {
    const a = mapa[chave];
    return {
      numeros: a.numeros.sort(function (x, y) { return x - y; }),
      descricao: a.descricao,
      codigo: a.codigo,
      unidade: a.unidade,
      qtd: a.qtd,
      custo_unit: a.qtd > 0 ? arredondar2_(a.valor / a.qtd) : 0
    };
  });
}

// ===================== CASAMENTO DE NOME =====================
// A descrição do cupom é abreviada e cada mercado abrevia do seu jeito:
// "CHOC GAROTO 80G CAJU" precisa virar "Chocolate Garoto 80g - Sabores".
//
// Não uso dicionário de abreviação (frágil, interminável): comparo palavra por
// palavra aceitando prefixo, que é justamente como a abreviação funciona —
// CHOC casa com CHOCOLATE, PIRAQ com PIRAQUÊ, JUNG com JUNGLE.
//
// Medido nos 53 itens de dois cupons reais: 33 de 44 descrições distintas saem
// pré-vinculadas certas, e o que sobra é ambiguidade de verdade (tamanho que
// mudou de embalagem, variante de sabor, produto que não está no catálogo).
// Nada disso é gravado sem a pessoa confirmar na tela — o palpite só poupa
// clique, nunca decide sozinho.

const RUIDO_NOME_ = {
  DE: 1, DA: 1, DO: 1, COM: 1, EM: 1, PARA: 1,
  SABORES: 1, VARIADOS: 1, VARIADO: 1, DIVERSOS: 1,
  UN: 1, PC: 1, LA: 1, CX: 1, TBL: 1, FAT: 1, TRAD: 1,
  UNIDADES: 1, PACOTE: 1, CAIXA: 1, GARRAFA: 1
};
const PADRAO_TAMANHO_ = /^\d+(G|KG|ML|L|M|UN)$/;

function tokensNome_(texto) {
  return normalizarTexto_(texto).split(' ').filter(function (t) {
    return t.length >= 2 && !RUIDO_NOME_[t];
  });
}

// Uma letra de diferença em palavra longa — resolve CRISTAL x CRYSTAL, que é
// grafia de marca que muda de um cupom pro outro.
function diferencaDeUmaLetra_(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let diferentes = 0;
    for (let i = 0; i < a.length; i++) if (a.charAt(i) !== b.charAt(i)) diferentes++;
    return diferentes === 1;
  }
  const curto = a.length < b.length ? a : b;
  const longo = a.length < b.length ? b : a;
  for (let i = 0; i < longo.length; i++) {
    if (longo.slice(0, i) + longo.slice(i + 1) === curto) return true;
  }
  return false;
}

function tokensCasam_(a, b) {
  if (a === b) return true;
  if (a.length >= 3 && b.indexOf(a) === 0) return true;
  if (b.length >= 3 && a.indexOf(b) === 0) return true;
  if (a.length >= 5 && b.length >= 5 && diferencaDeUmaLetra_(a, b)) return true;
  return false;
}

function pontuarCasamento_(descricao, nomeCatalogo) {
  const tc = tokensNome_(descricao);
  const tn = tokensNome_(nomeCatalogo);
  if (tc.length === 0 || tn.length === 0) return -1;

  // Se os dois declaram tamanho e os tamanhos não batem, não é o mesmo produto.
  // É o que impede Oreo 270g de virar Oreo 90g, e Elma Chips 35g virar a de 40g.
  const tamC = tc.filter(function (t) { return PADRAO_TAMANHO_.test(t); });
  const tamN = tn.filter(function (t) { return PADRAO_TAMANHO_.test(t); });
  if (tamC.length && tamN.length) {
    const bate = tamC.some(function (a) { return tamN.some(function (b) { return tokensCasam_(a, b); }); });
    if (!bate) return -1;
  }

  const casados = tc.filter(function (t) {
    return tn.some(function (n) { return tokensCasam_(t, n); });
  });
  const palavras = casados.filter(function (t) { return !PADRAO_TAMANHO_.test(t); });
  // Exige pelo menos uma palavra (não só o tamanho) e dois sinais no total —
  // senão "80G" sozinho casaria com meio catálogo.
  if (palavras.length < 1 || casados.length < 2) return -1;

  // Palavra pesa mais que número; nome de catálogo mais enxuto desempata.
  return palavras.length * 10 + casados.length - tn.length * 0.01;
}

function casarProdutoPorNome_(descricao, nomesCatalogo) {
  let melhorNota = -1;
  nomesCatalogo.forEach(function (nome) {
    const nota = pontuarCasamento_(descricao, nome);
    if (nota > melhorNota) melhorNota = nota;
  });
  if (melhorNota < 0) return '';

  // Empate técnico no topo = ambiguidade real (ex: "COOK PIRAQ 80G CHOC" serve
  // pro Cookie Piraquê e pro Biscoito Piraquê com cobertura de chocolate).
  // Nesse caso não palpita: deixa a pessoa escolher, que é quem sabe.
  const empatados = nomesCatalogo.filter(function (nome) {
    return Math.abs(pontuarCasamento_(descricao, nome) - melhorNota) < 0.5;
  });
  return empatados.length === 1 ? empatados[0] : '';
}

function excluirReposicao_(params) {
  return comTravamento_(function () {
    const aba = obterAba_(NOMES_ABAS.REPOSICOES);
    const valores = aba.getDataRange().getValues();
    const colId = valores[0].indexOf('id');

    for (let i = 1; i < valores.length; i++) {
      if (valores[i][colId] === params.id) {
        aba.deleteRow(i + 1);
        return { excluido: true };
      }
    }
    throw new Error('Reposição não encontrada: ' + params.id);
  });
}
