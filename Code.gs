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
  REPOSICOES: 'Reposicoes'
};

const CABECALHOS = {
  Ocorrencias: ['id', 'condominio', 'data_ocorrencia', 'hora', 'pessoa', 'descricao_pessoa', 'itens', 'valor_total', 'observacao', 'status', 'contato_whatsapp', 'data_registro', 'data_cobranca', 'data_pagamento'],
  DiasFechados: ['condominio', 'data', 'status_dia', 'registrado_em'],
  Produtos: ['nome', 'preco', 'ativo'],
  Pessoas: ['nome', 'condominio', 'contato_whatsapp', 'observacao'],
  Condominios: ['nome_oficial', 'nome_curto', 'endereco', 'bairro', 'cidade', 'sindico_ou_contato', 'telefone_contato', 'ativo'],
  Reposicoes: ['id', 'condominio', 'data', 'produto', 'quantidade', 'preco_unit', 'valor_total', 'status', 'pessoa', 'contato_whatsapp', 'data_infracao', 'hora_infracao', 'registrado_em', 'ocorrencia_id']
};

const FUSO_HORARIO = 'America/Sao_Paulo';

// PIN padrão usado caso não exista a propriedade PIN nas Propriedades do Script.
// Recomendado trocar em Project Settings > Script Properties > adicionar "PIN".
const PIN_PADRAO = '2026';

// Lista de produtos reaproveitada do gerador-cobranca.html (nome, preço).
// Usada apenas para popular a aba Produtos uma única vez, em configurarPlanilha().
const PRODUTOS_SEED = [["Detergente Líquido Cristal Limpol Squeeze 500ml", 3.89], ["Biscoito Cookie Piraquê 80g - Sabores", 5.89], ["Leite Condensado Frimesa 395g", 7.49], ["Atum Gomes da Costa Ralado 170g - Sabores", 10.99], ["Bolinho Dr. Oetker Bom pra Mim 50g - Sabores", 7.95], ["Granola Jasmine Integral 250g - Sabores", 13.9], ["Maionese Heinz Tradicional 215g", 14.99], ["Nescau Achocolatado em Pó 200g", 10.4], ["Massa Caseira Galla nº 1 - 400g", 8.69], ["Chocolate Garoto 80g - Sabores", 9.89], ["Biscoito Leite Maltado Cobertura Chocolate Piraquê 80g - Sabores", 5.89], ["Papel Higiênico Folha Tripla Branco 20M 4RL Duetto", 10.99], ["Água Mineral Crystal Pet 500ml - Sabores", 3.89], ["Filtro De Papel 103 Melitta", 4.99], ["Bolo de Caneca 67g - Sabores", 4.99], ["Bala Fini Gelatina 90g - Sabores", 8.29], ["Molho de Tomate Heinz 240g", 6.79], ["Açúcar Refinado Caravelas 1kg", 5.39], ["Torrone Montevergine 90g - Sabores", 5.99], ["Pipoca para Microondas Yoki 100g - Sabores", 7.75], ["Snack Crocantíssimo Original 40g - Sabores", 5.69], ["Arroz Branco Urbano 1kg", 7.39], ["Smirnoff Ice 275ml", 8.99], ["Refrigerante Guaraná Antarctica Lata 350ml", 5.79], ["Snack Pettiz Amendoim Crocante - Sabores", 7.69], ["Extrato de Tomate Elefante Tradicional 135g", 4.99], ["Refrigerante Guaraná Antarctica 2L", 13.79], ["Refrigerante Sprite Sabores 2L", 13.69], ["Refrigerante Laranja Fanta Garrafa 2L", 13.69], ["Cerveja Budweiser American Lager 350ml Lata", 6.75], ["Biscoito Recheado Oreo 90g", 5.7], ["Sabão em Pó OMO Lavagem Perfeita 400g", 11.99], ["Achocolatado Toddy 200g", 8.99], ["Amaciante Concentrado Comfort Frescor Intenso 500ml", 15.99], ["Vanish Tira Manchas em Barra White 75g Para Roupas", 10.29], ["Óleo de Soja Cocamar 900ml", 11.39], ["Salgadinho Time 50g - Sabores", 3.69], ["Creme de Leite Tirol 200g", 4.19], ["Cerveja Corona Lata 350ml", 7.89], ["Cereal Matinal Nestlé Sachê 120g - Sabores", 8.99], ["Refrigerante Coca-Cola 2L - Sabores", 14.99], ["Chocolate Lacta 80g - Sabores", 9.49], ["Barra de Cereal Nutry 20g - Sabores", 2.89], ["Absorvente Mili Proteção Total Suave Com Abas 8un", 7.99], ["Chocolate KitKat Nestlé 41,5g - Sabores", 6.99], ["Macarrão Espaguete Ovos Dona Benta 500g", 5.09], ["Batata Palha Kisabor 100g", 7.99], ["Chocolate Bis Lacta 100,8g - Variados", 7.99], ["Energético Monster 473ml Lata - Sabores", 11.99], ["Álcool Netz Etílico 46° INPM Neutro 500ml", 8.99], ["Limpador Multiuso Original Veja Gold 500ml", 7.49], ["Toalha Umedecida Levoe 48un", 6.89], ["Sachê Pedigree Cães Adultos Raças Pequenas - Sabores", 3.49], ["Sachê Whiskas para Gatos Adultos - Sabores", 3.99], ["Sabonete Francis Variados 90g", 4.39], ["Chocolate Suflair 80g - Variados", 10.49], ["Esponja Brilhus Multiuso Unitária", 2.7], ["Creme Dental Colgate Máxima Proteção Anticáries 50g", 5.99], ["Energético Red Bull Energy Drink 250ml", 11.99], ["Chá Matte Leão Original - Caixa com 25 Unidades", 7.39], ["Leite Tirol UHT Integral Zero Lactose 1 Litro", 6.79], ["Macarrão Instantâneo Nissin 85g - Variados", 3.99], ["Macarrão Nissin Cup Noodles 64g - Variados", 6.99], ["Café Melitta Vácuo 250g - Variados", 24.9], ["Refrigerante Coca-Cola Lata 310ml - Sabores", 4.99], ["Salgadinho Elma Chips 40g - Variados", 5.99], ["Cerveja Heineken Lata 350ml", 7.69], ["Leite Tirol UHT 1 Litro - Integral", 6.79], ["Salgadinho de Batata Pringles Tubo 104g - Diversos", 12.99], ["Apresuntado Seara Fatiado 180g", 12.49], ["Leite Moça Condensado Integral Nestlé - Caixinha 395g", 8.99], ["Álcool Coperalcool Bacfree 46°INPM Tradicional 500ml", 8.99], ["Presunto Levíssimo Fatiado Seara 180g", 11.99], ["Sabonete Nivea Com Hidratante Creme Care 90g", 6.99], ["Requeijão Catupiry 250g - Sabores", 9.99], ["Manteiga Frimesa 200g - Sabores", 14.99], ["Sopa 17g Vono - Sabores", 4.79], ["Pão de Forma Bauducco Pacote 390g - Sabores", 8.69], ["Queijo Mussarela Fatiado 150g", 10.99], ["Isotônico Powerade 500ml - Sabores", 7.99], ["Protein Parmalat Whey Fit Zero Lactose 250ml - Sabores", 9.9], ["Esponja Multiuso Assolan Pertuto", 3.19], ["Papel Higiênico Folha Tripla Mili Prime Comfort 4 Rolos 20m", 10.99], ["Macarrão Spaghetti 500g Floriani Grano Duro", 9.69], ["Toalhas Umedecidas Mili Prime 50 Unidades", 9.89], ["Chiclete Trident X 48,3g - Sabores", 16.79], ["Biscoito BelVita 75g - Sabores", 7.29], ["Chocolate Nestlé Galak 80g", 9.99], ["Água Tônica Antarctica Lata 350ml", 5.39], ["Escova de Dentes Oral-B", 7.89], ["Chiclete Trident Sem Açúcar 8g - Sabores", 3.59], ["Prestobarba Ultragrip Fixo Az C/2 Masc/Fem", 8.99], ["Suco Del Valle Kapo Sabores 200ml", 3.79], ["Café Melitta Regiões Brasileiras Vácuo 250g - Sabores", 29.9], ["Absorvente com Abas Suave Sempre Livre Adapt Pacote 8 Unidades", 7.89], ["Batata Palha Caldo Bom 100g - Sabores", 8.99], ["Bebida Jungle 500ml - Sabores", 8.99], ["Manteiga de Primeira Qualidade Com Sal 200g - Tirol", 14.99], ["Presunto Cozido Fatiado Sadia 200g", 10.99], ["Margarina Claybom 250g", 5.99], ["Sabonete Phebo Barra Limão Siciliano 100g", 6.49], ["Fermento em Pó Royal 100g", 7.49], ["Mistura para Bolo Dona Benta 450g - Sabores", 9.99], ["Batata Palha Tostally 100g", 7.99]];

// Pessoas conhecidas para pré-popular a aba Pessoas (condomínio fica em branco — complete na planilha).
const PESSOAS_SEED = ['Gisele', 'Rui', 'Victoria', 'Gibran', 'Juliana', 'Alice', 'Gabriel', 'Felipe', 'Vinícius', 'Daniela', 'Evaldo'];

// Condomínios para pré-popular a aba Condominios (endereço/contato ficam em branco — complete na planilha).
const CONDOMINIOS_SEED = ['Walk Soho', 'Walk Brigadeiro', 'Parque das Pedreiras', 'Ed Remy'];

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
    const linhas = PRODUTOS_SEED.map(function (p) { return [p[0], p[1], true]; });
    abaProdutos.getRange(2, 1, linhas.length, 3).setValues(linhas);
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

  travarColunasComoTexto_();

  SpreadsheetApp.getUi().alert('Planilha configurada com sucesso! Agora publique como Web App (Deploy > New deployment).');
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
