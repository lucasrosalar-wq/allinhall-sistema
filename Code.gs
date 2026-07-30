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
  Ocorrencias: ['id', 'condominio', 'data_ocorrencia', 'hora', 'pessoa', 'descricao_pessoa', 'itens', 'valor_total', 'observacao', 'status', 'contato_whatsapp', 'data_registro', 'data_cobranca', 'data_pagamento'],
  DiasFechados: ['condominio', 'data', 'status_dia', 'registrado_em'],
  Produtos: ['nome', 'preco', 'ativo', 'categoria', 'margem_pct', 'custo_atual', 'data_custo', 'preco_travado'],
  Pessoas: ['nome', 'condominio', 'contato_whatsapp', 'observacao'],
  Condominios: ['nome_oficial', 'nome_curto', 'endereco', 'bairro', 'cidade', 'sindico_ou_contato', 'telefone_contato', 'ativo'],
  Reposicoes: ['id', 'condominio', 'data', 'produto', 'quantidade', 'preco_unit', 'valor_total', 'status', 'pessoa', 'contato_whatsapp', 'data_infracao', 'hora_infracao', 'registrado_em', 'ocorrencia_id'],
  Compras: ['id', 'data', 'mercado', 'documento', 'valor_total', 'observacao', 'origem', 'registrado_em'],
  ComprasItens: ['id', 'compra_id', 'descricao_cupom', 'codigo', 'produto', 'quantidade', 'custo_unit', 'custo_total'],
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
function criarOcorrenciaLinha_(params) {
  const aba = obterAba_(NOMES_ABAS.OCORRENCIAS);
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
    ''
  ];
  const proximaLinha = aba.getLastRow() + 1;
  escreverLinhaComoTexto_(aba, proximaLinha, linha, [3, 4, 12, 13, 14]);
  return { id: id };
}

function criarOcorrencia_(params) {
  return comTravamento_(function () { return criarOcorrenciaLinha_(params); });
}

const COLUNAS_TEXTO_OCORRENCIAS_ = { data_ocorrencia: true, hora: true, data_cobranca: true, data_pagamento: true };

// Sem trava própria, mesmo motivo de criarOcorrenciaLinha_ acima.
function atualizarOcorrenciaCampos_(id, params) {
  const aba = obterAba_(NOMES_ABAS.OCORRENCIAS);
  const valores = aba.getDataRange().getValues();
  const cabecalho = valores[0];
  const colId = cabecalho.indexOf('id');
  const colStatus = cabecalho.indexOf('status');

  for (let i = 1; i < valores.length; i++) {
    if (valores[i][colId] === id) {
      const linhaPlanilha = i + 1;
      const camposPermitidos = ['pessoa', 'descricao_pessoa', 'itens', 'valor_total', 'observacao', 'status', 'contato_whatsapp', 'data_cobranca', 'data_pagamento', 'data_ocorrencia', 'hora'];
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
      // não avançou para Cobrado/Pago/Cancelado, para não desfazer histórico).
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
      custo_total: Number(i.custo_total) || 0
    });
  });

  const comprasComItens = compras.map(function (c) {
    return {
      id: c.id,
      data: String(c.data || ''),
      mercado: String(c.mercado || ''),
      documento: String(c.documento || ''),
      valor_total: Number(c.valor_total) || 0,
      observacao: String(c.observacao || ''),
      origem: String(c.origem || 'manual'),
      itens: itensPorCompra[String(c.id)] || []
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
    estruturaPendente: estruturaPendente,
    limiteAlertaPct: LIMIAR_ALERTA_VARIACAO_PCT
  };
}

// Grava o cupom e os itens, e — item por item vinculado a um produto do catálogo —
// atualiza o custo daquele produto e ensina o de-para a reconhecer aquela descrição
// da próxima vez. O preço NÃO é mexido aqui: custo entrando é fato, preço mudando
// é decisão, e a decisão fica na tela de revisão (aplicarPrecos_).
function criarCompra_(params) {
  return comTravamento_(function () {
    const abaCompras = obterAba_(NOMES_ABAS.COMPRAS);
    const abaItens = obterAba_(NOMES_ABAS.COMPRAS_ITENS);
    const itens = params.itens || [];
    if (itens.length === 0) throw new Error('Informe ao menos um item do cupom.');

    const agora = agora_();
    const carimbo = Utilities.formatDate(new Date(), FUSO_HORARIO, 'yyyyMMddHHmmss');
    const idCompra = 'CP' + carimbo + Math.floor(Math.random() * 90 + 10);

    const valorTotal = itens.reduce(function (soma, item) {
      return soma + (Number(item.qtd) || 0) * (Number(item.custo_unit) || 0);
    }, 0);

    const linhaCompra = [
      idCompra,
      params.data,
      params.mercado || '',
      params.documento || '',
      arredondar2_(valorTotal),
      params.observacao || '',
      params.origem || 'manual',
      agora
    ];
    escreverLinhaComoTexto_(abaCompras, abaCompras.getLastRow() + 1, linhaCompra, [2, 8]);

    itens.forEach(function (item, indice) {
      const idItem = 'CI' + carimbo + '-' + indice + Math.floor(Math.random() * 90 + 10);
      const qtd = Number(item.qtd) || 0;
      const custoUnit = Number(item.custo_unit) || 0;
      const linha = [
        idItem,
        idCompra,
        item.descricao_cupom || item.produto || '',
        item.codigo || '',
        item.produto || '',
        qtd,
        custoUnit,
        arredondar2_(qtd * custoUnit)
      ];
      abaItens.getRange(abaItens.getLastRow() + 1, 1, 1, linha.length).setValues([linha]);

      if (item.produto) {
        registrarCustoProduto_(item.produto, custoUnit, params.data);
        // params.loja existe pra importação passar o CNPJ do emitente, que é um
        // escopo bem mais confiável que o nome digitado à mão.
        aprenderDePara_(item.codigo, item.descricao_cupom || item.produto, item.produto, params.origem || 'manual', params.loja || params.mercado);
      }
    });

    return { id: idCompra, valor_total: arredondar2_(valorTotal) };
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
