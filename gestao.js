/* ============================================================
   ALL IN HALL — gestao.js
   Lógica da tela de Gestão (totais, mini-calendário, filtros,
   lista de ocorrências, identificar, editar, cobrança e
   cobrança consolidada) — extraído de gestao.html
   ============================================================ */


// ===================== ESTADO EM MEMÓRIA (sem localStorage/sessionStorage) =====================
let todasOcorrencias = [];
let idOcorrenciaGestao = null;
let itensEdicao = []; // [{ produto, qtd, preco_unit }] da ocorrência em edição
const TITULO_PADRAO_ = document.title; // restaurado ao fechar a notificação (que troca o título pro nome do PDF)
let gruposConsolidadosAtuais = {}; // grupoId -> { condominio, pessoa, contato_whatsapp, ocorrencias: [...] }
let ocorrenciasCobrancaConsolidadaAtual = []; // ocorrências marcadas no momento em que "Cobrar selecionadas" foi clicado
let grupoCobrancaConsolidadaAtual = null; // { condominio, pessoa, contato_whatsapp } do grupo aberto no modal

// Status "cobrei e não recebi". Guardado sem acento porque o mesmo texto vira
// classe de CSS (badge/coluna) e vai pra planilha — o acento só aparece na tela,
// via rotuloStatus_.
const STATUS_PREJUIZO_ = 'Prejuizo';
function rotuloStatus_(status) { return status === STATUS_PREJUIZO_ ? 'Prejuízo' : status; }

// ===================== INICIALIZAÇÃO =====================
function inicializarGestao() {
  const selectCondominio = document.getElementById('filtroCondominio');
  selectCondominio.innerHTML = '<option value="">Todos</option>' +
    bootstrap.condominios.map(function (c) { return '<option value="' + c.nome_curto + '">' + c.nome_curto + '</option>'; }).join('');

  const datalistProdutos = document.getElementById('listaProdutosDatalistGestao');
  datalistProdutos.innerHTML = bootstrap.produtos.map(function (p) { return '<option value="' + p.nome + '">'; }).join('');

  const anoAtualFiltro = new Date().getFullYear();
  const selectAno = document.getElementById('filtroAno');
  const opcoesAno = [];
  for (let ano = anoAtualFiltro + 1; ano >= anoAtualFiltro - 2; ano--) {
    opcoesAno.push('<option value="' + ano + '">' + ano + '</option>');
  }
  selectAno.innerHTML = '<option value="">Todos</option>' + opcoesAno.join('');

  carregarMiniCalendario();

  carregarOcorrencias();
}

// ===================== MINI CALENDÁRIO DE PROGRESSO =====================
let miniCalMes = new Date().getMonth() + 1;
let miniCalAno = new Date().getFullYear();
let cacheCalendarioGestao = {}; // chave 'condominio|ano|mes' -> dados já buscados (evita repetir fetch ao trocar de filtro sem mudar de mês)
const NOMES_MESES_MINI_ = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function mudarMesMiniCal(delta) {
  miniCalMes += delta;
  if (miniCalMes > 12) { miniCalMes = 1; miniCalAno++; }
  if (miniCalMes < 1) { miniCalMes = 12; miniCalAno--; }
  carregarMiniCalendario();
}

async function carregarMiniCalendario() {
  const condominio = document.getElementById('filtroCondominio').value;
  const conteudo = document.getElementById('miniCalConteudo');
  const vazio = document.getElementById('miniCalVazio');
  const rotulo = document.getElementById('miniCalCondominioLabel');

  if (!condominio) {
    rotulo.textContent = 'Todos';
    conteudo.classList.add('oculto');
    vazio.classList.remove('oculto');
    return;
  }
  rotulo.textContent = condominio;
  conteudo.classList.remove('oculto');
  vazio.classList.add('oculto');

  const tituloMes = NOMES_MESES_MINI_[miniCalMes - 1] + ' de ' + miniCalAno;
  document.getElementById('miniCalTitulo').textContent = tituloMes;

  const chaveCache = condominio + '|' + miniCalAno + '|' + miniCalMes;
  if (cacheCalendarioGestao[chaveCache]) {
    renderizarMiniCalendario(cacheCalendarioGestao[chaveCache]);
    return;
  }

  document.getElementById('miniCalTitulo').textContent = 'Carregando...';
  try {
    const resposta = await chamarApi({ action: 'calendario', condominio: condominio, ano: miniCalAno, mes: miniCalMes });
    if (!resposta.ok) throw new Error(resposta.erro);
    cacheCalendarioGestao[chaveCache] = resposta.dados;
    document.getElementById('miniCalTitulo').textContent = tituloMes;
    renderizarMiniCalendario(resposta.dados);
  } catch (err) {
    document.getElementById('miniCalTitulo').textContent = tituloMes;
    document.getElementById('miniCalGrade').innerHTML = '';
  }
}

// Contagem de ocorrências por status, filtrada só pelo condomínio (independente
// dos filtros de status/data usados na lista de baixo).
function renderizarContagemStatus() {
  const condominio = document.getElementById('filtroCondominio').value;
  let pendente = 0, cobrado = 0, pago = 0, prejuizo = 0;
  todasOcorrencias.forEach(function (o) {
    if (condominio && o.condominio !== condominio) return;
    if (o.status === 'Pendente' || o.status === 'Identificado') pendente++;
    else if (o.status === 'Cobrado') cobrado++;
    else if (o.status === 'Pago') pago++;
    else if (o.status === STATUS_PREJUIZO_) prejuizo++;
  });
  document.getElementById('contagemStatus').innerHTML =
    '<div class="contagem-item pendente"><span class="contagem-numero">' + pendente + '</span><span class="contagem-rotulo">Pendente</span></div>' +
    '<div class="contagem-item cobrado"><span class="contagem-numero">' + cobrado + '</span><span class="contagem-rotulo">Cobrado</span></div>' +
    '<div class="contagem-item pago"><span class="contagem-numero">' + pago + '</span><span class="contagem-rotulo">Pago</span></div>' +
    '<div class="contagem-item prejuizo"><span class="contagem-numero">' + prejuizo + '</span><span class="contagem-rotulo">Prejuízo</span></div>';
}

function renderizarMiniCalendario(dados) {
  const grade = document.getElementById('miniCalGrade');
  // Monta tudo num DocumentFragment e só encosta na grade de verdade uma vez
  // no final — evita reflow a cada célula do loop.
  const fragmento = document.createDocumentFragment();

  const primeiroDiaSemana = new Date(miniCalAno, miniCalMes - 1, 1).getDay();
  const diasNoMes = new Date(miniCalAno, miniCalMes, 0).getDate();

  const mapaOcorrencias = {};
  dados.ocorrencias.forEach(function (o) { mapaOcorrencias[o.data_ocorrencia] = true; });
  const mapaFechados = {};
  dados.diasFechados.forEach(function (d) { mapaFechados[d.data] = d.status_dia; });

  // Em vez de células vazias de preenchimento (que causavam um bug visual de
  // altura em alguns navegadores), o primeiro dia real é deslocado direto para
  // a coluna certa da semana usando grid-column-start.
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataISO = miniCalAno + '-' + String(miniCalMes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
    const celula = document.createElement('div');
    celula.className = 'mini-dia';
    celula.textContent = dia;
    if (dia === 1) celula.style.gridColumnStart = String(primeiroDiaSemana + 1);
    if (mapaOcorrencias[dataISO]) celula.classList.add('ocorrencia');
    else if (mapaFechados[dataISO] === 'Sem operacao') celula.classList.add('semoperacao');
    else if (mapaFechados[dataISO] === 'OK') celula.classList.add('ok');
    fragmento.appendChild(celula);
  }

  grade.innerHTML = '';
  grade.appendChild(fragmento);
}

async function carregarOcorrencias() {
  const banner = document.getElementById('bannerLista');
  banner.className = 'banner'; banner.textContent = '';
  try {
    const resposta = await chamarApi({ action: 'ocorrencias' });
    if (!resposta.ok) throw new Error(resposta.erro);
    todasOcorrencias = resposta.dados;
    renderizarTotais();
    renderizarLista();
  } catch (err) {
    banner.className = 'banner erro';
    banner.textContent = 'Não foi possível carregar as ocorrências. Verifique a conexão e tente novamente.';
  }
}

// ===================== TOTALIZADORES =====================
function renderizarTotais() {
  const hoje = new Date();
  const chaveMesAtual = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');

  let totalPendente = 0, totalCobrado = 0, totalRecebido = 0, totalPrejuizo = 0;
  let qtdPendente = 0, qtdCobrado = 0, qtdRecebido = 0, qtdPrejuizo = 0;
  todasOcorrencias.forEach(function (o) {
    if (o.status === 'Pendente' || o.status === 'Identificado') { totalPendente += o.valor_total; qtdPendente++; }
    else if (o.status === 'Cobrado') { totalCobrado += o.valor_total; qtdCobrado++; }
    else if (o.status === 'Pago' && String(o.data_pagamento).indexOf(chaveMesAtual) === 0) { totalRecebido += o.valor_total; qtdRecebido++; }
    // Prejuízo é acumulado (não só do mês): é o total que a operação já deu por perdido.
    else if (o.status === STATUS_PREJUIZO_) { totalPrejuizo += o.valor_total; qtdPrejuizo++; }
  });

  document.getElementById('kanbanSubtituloPendente').textContent =
    formatarMoeda(totalPendente) + ' · ' + qtdPendente + (qtdPendente === 1 ? ' ocorrência' : ' ocorrências');
  document.getElementById('kanbanSubtituloCobrado').textContent =
    formatarMoeda(totalCobrado) + ' · ' + qtdCobrado + (qtdCobrado === 1 ? ' ocorrência' : ' ocorrências');
  document.getElementById('kanbanSubtituloRecebido').textContent =
    formatarMoeda(totalRecebido) + ' · ' + qtdRecebido + (qtdRecebido === 1 ? ' pagamento' : ' pagamentos');
  document.getElementById('kanbanSubtituloPrejuizo').textContent =
    formatarMoeda(totalPrejuizo) + ' · ' + qtdPrejuizo + (qtdPrejuizo === 1 ? ' ocorrência' : ' ocorrências');
}

// ===================== QUADRO KANBAN (Pendente / Cobrado / Recebido / Prejuízo) =====================
// Ocorrências Canceladas não entram em nenhuma coluna — mesmo critério que já valia
// para os totais acima, agora estendido pra lista inteira.
function renderizarLista() {
  renderizarConsolidado();
  carregarMiniCalendario();
  renderizarContagemStatus();

  const condominio = document.getElementById('filtroCondominio').value;
  const mes = document.getElementById('filtroMes').value;
  const ano = document.getElementById('filtroAno').value;
  const dataInicio = document.getElementById('filtroDataInicio').value;
  const dataFim = document.getElementById('filtroDataFim').value;

  const lista = todasOcorrencias.filter(function (o) {
    if (o.status === 'Cancelado') return false;
    if (condominio && o.condominio !== condominio) return false;
    if (mes && String(o.data_ocorrencia).slice(5, 7) !== mes) return false;
    if (ano && String(o.data_ocorrencia).slice(0, 4) !== ano) return false;
    if (dataInicio && o.data_ocorrencia < dataInicio) return false;
    if (dataFim && o.data_ocorrencia > dataFim) return false;
    return true;
  });

  lista.sort(function (a, b) {
    return (b.data_ocorrencia + b.hora).localeCompare(a.data_ocorrencia + a.hora);
  });

  renderizarColunaKanban('kanbanColunaPendente', lista.filter(function (o) { return o.status === 'Pendente' || o.status === 'Identificado'; }));
  renderizarColunaKanban('kanbanColunaCobrado', lista.filter(function (o) { return o.status === 'Cobrado'; }));
  renderizarColunaKanban('kanbanColunaRecebido', lista.filter(function (o) { return o.status === 'Pago'; }));
  renderizarColunaKanban('kanbanColunaPrejuizo', lista.filter(function (o) { return o.status === STATUS_PREJUIZO_; }));
}

function renderizarColunaKanban(idContainer, itens) {
  const container = document.getElementById(idContainer);
  if (itens.length === 0) {
    container.innerHTML = '<div class="vazio-relacao">Nada por aqui.</div>';
    return;
  }
  container.innerHTML = itens.map(renderizarCard).join('');
}

function renderizarCard(o) {
  const nomePessoa = o.pessoa || o.descricao_pessoa || 'Desconhecido(a)';
  const resumoItens = o.itens.map(function (i) { return i.qtd + 'x ' + i.produto; }).join(', ');
  const statusClasse = o.status.toLowerCase();
  const rotuloIdentificar = o.pessoa ? 'Editar pessoa' : 'Identificar';

  let acoes = '';
  if (o.status !== 'Cancelado' && o.status !== 'Pago') {
    acoes += '<button onclick="abrirIdentificar(\'' + o.id + '\')">' + rotuloIdentificar + '</button>';
    acoes += '<button onclick="abrirEditar(\'' + o.id + '\')">Editar itens</button>';
  }
  if (o.status === 'Pendente' || o.status === 'Identificado') {
    acoes += '<button class="destaque" onclick="abrirCobranca(\'' + o.id + '\')">Cobrar</button>';
    // Ocorrência que nunca vai ser cobrada (ninguém identificado, por exemplo)
    // também é prejuízo — não precisa passar por "Cobrado" antes.
    acoes += '<button class="perigo" onclick="marcarComoPrejuizo(\'' + o.id + '\')">Dar baixa</button>';
  }
  if (o.status === 'Cobrado') {
    acoes += '<button class="destaque" onclick="abrirCobranca(\'' + o.id + '\')">Reabrir notificação</button>';
    acoes += '<button class="whatsapp" onclick="recobrarWhatsapp(\'' + o.id + '\')">Recobrar</button>';
    acoes += '<button onclick="marcarComoPago(\'' + o.id + '\')">Marcar como pago</button>';
    acoes += '<button class="perigo" onclick="marcarComoPrejuizo(\'' + o.id + '\')">Não pagou</button>';
  }
  // Prejuízo não é o fim da linha: se a pessoa reaparece, dá pra recobrar,
  // receber ou simplesmente devolver a ocorrência para a coluna de cobrança.
  if (o.status === STATUS_PREJUIZO_) {
    acoes += '<button class="whatsapp" onclick="recobrarWhatsapp(\'' + o.id + '\')">Recobrar</button>';
    acoes += '<button onclick="marcarComoPago(\'' + o.id + '\')">Recebi o pagamento</button>';
    acoes += '<button onclick="reabrirOcorrencia(\'' + o.id + '\')">' + (o.data_cobranca ? 'Voltar p/ cobrado' : 'Voltar p/ pendente') + '</button>';
  }
  if (o.status !== 'Cancelado' && o.status !== 'Pago') {
    acoes += '<button class="perigo" onclick="cancelarOcorrencia(\'' + o.id + '\')">Cancelar</button>';
  }

  return '<div class="card">' +
    '<div class="card-topo">' +
      '<div class="info">' + formatarDataBR(o.data_ocorrencia) + ' às ' + (o.hora || '—') + ' · ' + o.condominio + '</div>' +
      '<div class="pessoa">' + nomePessoa + '</div>' +
      '<div class="whatsapp-card">' + (o.contato_whatsapp ? 'WhatsApp: ' + o.contato_whatsapp : 'Sem WhatsApp cadastrado') + '</div>' +
      '<div class="valor-linha">' +
        '<span class="valor">' + formatarMoeda(o.valor_total) + '</span>' +
        '<span class="badge ' + statusClasse + '">' + rotuloStatus_(o.status) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="itens-resumo">' + resumoItens + '</div>' +
    (o.status === STATUS_PREJUIZO_ && o.data_prejuizo ? '<div class="observacao">Baixado como prejuízo em ' + formatarDataBR(o.data_prejuizo) + '</div>' : '') +
    (o.observacao ? '<div class="observacao">' + o.observacao + '</div>' : '') +
    '<div class="acoes">' + acoes + '</div>' +
  '</div>';
}

function hojeISO() { const h = new Date(); return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0'); }
function buscarOcorrencia(id) { return todasOcorrencias.find(function (o) { return o.id === id; }); }

// ===================== IDENTIFICAR / EDITAR PESSOA =====================
function abrirIdentificar(id) {
  idOcorrenciaGestao = id;
  const o = buscarOcorrencia(id);
  document.getElementById('tituloIdentificar').textContent = o.pessoa ? 'Editar pessoa' : 'Identificar pessoa';
  document.getElementById('subtituloIdentificar').textContent = o.condominio + ' — ' + formatarDataBR(o.data_ocorrencia);
  document.getElementById('inputNovoNome').value = o.pessoa || '';
  document.getElementById('inputNovoWhatsapp').value = o.contato_whatsapp || '';
  document.getElementById('bannerIdentificar').className = 'banner';
  abrirModal('overlayIdentificar');
}

async function salvarIdentificacao() {
  const banner = document.getElementById('bannerIdentificar');
  const nome = document.getElementById('inputNovoNome').value.trim();
  const whatsapp = document.getElementById('inputNovoWhatsapp').value.trim();

  try {
    // O servidor recalcula Pendente/Identificado sozinho com base no nome, sem
    // rebaixar ocorrências que já avançaram para Cobrado/Pago.
    const resposta = await chamarApi({ action: 'atualizarOcorrencia', id: idOcorrenciaGestao, pessoa: nome, contato_whatsapp: whatsapp }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);

    const o = buscarOcorrencia(idOcorrenciaGestao);
    o.pessoa = nome;
    o.contato_whatsapp = whatsapp;
    if (o.status === 'Pendente' || o.status === 'Identificado') o.status = nome ? 'Identificado' : 'Pendente';

    fecharModal('overlayIdentificar');
    renderizarTotais();
    renderizarLista();
  } catch (err) {
    banner.className = 'banner erro';
    banner.textContent = 'Falha ao salvar. Tente novamente.';
  }
}

// ===================== EDITAR ITENS =====================
function abrirEditar(id) {
  idOcorrenciaGestao = id;
  const o = buscarOcorrencia(id);
  document.getElementById('subtituloEditar').textContent = o.condominio + ' — ' + formatarDataBR(o.data_ocorrencia);
  itensEdicao = o.itens.map(function (item) { return Object.assign({}, item); });
  document.getElementById('inputProdutoNovoEditar').value = '';
  document.getElementById('inputQtdNovoEditar').value = '1';
  document.getElementById('bannerEditar').className = 'banner';
  renderizarItensEditar();
  abrirModal('overlayEditar');
}

function adicionarItemNaListaEditar() {
  const inputNome = document.getElementById('inputProdutoNovoEditar');
  const inputQtd = document.getElementById('inputQtdNovoEditar');
  const nomeDigitado = inputNome.value.trim();

  const produto = encontrarProduto_(nomeDigitado);
  if (!produto) {
    alert('Produto não encontrado. Digite parte do nome e escolha uma das opções sugeridas.');
    return;
  }
  const qtd = Math.max(1, parseInt(inputQtd.value, 10) || 1);

  const existente = itensEdicao.find(function (i) { return i.produto === produto.nome; });
  if (existente) existente.qtd += qtd;
  else itensEdicao.push({ produto: produto.nome, qtd: qtd, preco_unit: produto.preco });

  inputNome.value = '';
  inputQtd.value = '1';
  inputNome.focus();
  renderizarItensEditar();
}

function removerItemDaListaEditar(indice) {
  itensEdicao.splice(indice, 1);
  renderizarItensEditar();
}

function renderizarItensEditar() {
  const lista = document.getElementById('listaItensEditar');
  lista.innerHTML = itensEdicao.map(function (item, indice) {
    const subtotal = item.qtd * item.preco_unit;
    return '<div class="item-adicionado">' +
      '<div class="info">' + item.produto + '<div class="qtd-preco">' + item.qtd + ' x ' + formatarMoeda(item.preco_unit) + '</div></div>' +
      '<div class="direita">' +
        '<span class="subtotal">' + formatarMoeda(subtotal) + '</span>' +
        '<button type="button" class="btn-remover" onclick="removerItemDaListaEditar(' + indice + ')">×</button>' +
      '</div>' +
    '</div>';
  }).join('') || '<div class="lista-vazia-itens">Nenhum item adicionado ainda.</div>';

  atualizarTotalEdicao();
}

function atualizarTotalEdicao() {
  const total = itensEdicao.reduce(function (soma, i) { return soma + i.qtd * i.preco_unit; }, 0);
  document.getElementById('totalEditar').textContent = formatarMoeda(total);
  return total;
}

async function salvarEdicao() {
  const banner = document.getElementById('bannerEditar');
  const itens = itensEdicao;
  if (itens.length === 0) { banner.className = 'banner erro'; banner.textContent = 'Adicione ao menos um item.'; return; }

  const total = atualizarTotalEdicao();
  try {
    const resposta = await chamarApi({ action: 'atualizarOcorrencia', id: idOcorrenciaGestao, itens: itens, valor_total: total }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    const o = buscarOcorrencia(idOcorrenciaGestao);
    o.itens = itens; o.valor_total = total;
    fecharModal('overlayEditar');
    renderizarTotais();
    renderizarLista();
  } catch (err) {
    banner.className = 'banner erro';
    banner.textContent = 'Falha ao salvar. Tente novamente.';
  }
}

// ===================== COBRANÇA (PDF + WHATSAPP) =====================
function abrirCobranca(id) {
  idOcorrenciaGestao = id;
  const o = buscarOcorrencia(id);
  const condominioInfo = bootstrap.condominios.find(function (c) { return c.nome_curto === o.condominio; }) || {};
  const nomeCondominio = condominioInfo.nome_oficial || o.condominio;
  const nomePessoa = o.pessoa || o.descricao_pessoa || 'Cliente';

  document.getElementById('saudacaoCobranca').textContent = 'Prezado(a) ' + nomePessoa + ',';

  const [ano, mes, dia] = o.data_ocorrencia.split('-');
  const referencia = dia + mes + ano.slice(2);
  document.getElementById('refLinha').textContent = 'Condomínio: ' + nomeCondominio + ' · Nº: ' + referencia;

  // Mesmo padrão de nome de arquivo do gerador-cobranca.html: o título da aba
  // vira o nome sugerido ao salvar como PDF (Ctrl+P > Salvar como PDF).
  document.title = ('NOTIFICAÇÃO ' + referencia + ' ' + nomePessoa + ' - ' + o.condominio).toUpperCase();

  const corpoTabela = document.getElementById('itensCobranca');
  corpoTabela.innerHTML = o.itens.map(function (item) {
    return '<tr><td>' + item.produto + '</td><td>' + item.qtd + '</td><td>' + formatarDataBR(o.data_ocorrencia) + '</td><td>' + (o.hora || '—') + '</td><td>' + formatarMoeda(item.preco_unit) + '</td><td>' + formatarMoeda(item.qtd * item.preco_unit) + '</td></tr>';
  }).join('');
  document.getElementById('totalCobranca').textContent = formatarMoeda(o.valor_total);

  document.getElementById('bannerCobranca').className = 'banner';
  abrirModal('overlayCobranca');
}

function normalizarWhatsapp(numero) {
  let digitos = String(numero || '').replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) digitos = '55' + digitos;
  return digitos;
}

function abrirWhatsapp() {
  const o = buscarOcorrencia(idOcorrenciaGestao);
  const numero = normalizarWhatsapp(o.contato_whatsapp);
  if (!numero) {
    document.getElementById('bannerCobranca').className = 'banner erro';
    document.getElementById('bannerCobranca').textContent = 'Esta pessoa não tem WhatsApp cadastrado.';
    return;
  }
  const nomePessoa = o.pessoa || 'Cliente';
  const resumoItens = o.itens.map(function (i) { return i.qtd + 'x ' + i.produto; }).join(', ');
  const mensagem = 'Olá ' + nomePessoa + ', tudo bem? Aqui é da All in Hall. Na conferência do minimercado do ' +
    o.condominio + ' identificamos um consumo em ' + formatarDataBR(o.data_ocorrencia) + ' às ' + (o.hora || '—') +
    ' (' + resumoItens + ' — total ' + formatarMoeda(o.valor_total) + ') sem pagamento localizado. ' +
    'Pode verificar? Se já pagou, nos envie o comprovante. Qualquer dúvida estamos à disposição!';
  window.open('https://web.whatsapp.com/send?phone=' + numero + '&text=' + encodeURIComponent(mensagem), '_blank');
}

// Lembrete rápido direto pro WhatsApp, sem reabrir a notificação — para ocorrências já cobradas.
function recobrarWhatsapp(id) {
  const o = buscarOcorrencia(id);
  const numero = normalizarWhatsapp(o.contato_whatsapp);
  if (!numero) {
    alert('Esta pessoa não tem WhatsApp cadastrado. Edite a pessoa para adicionar o número.');
    return;
  }
  const nomePessoa = o.pessoa || 'Cliente';
  const mensagem = 'Olá ' + nomePessoa + ', tudo bem? Passando aqui da All in Hall só para lembrar sobre o valor de ' +
    formatarMoeda(o.valor_total) + ' referente à ocorrência de ' + formatarDataBR(o.data_ocorrencia) +
    ' no ' + o.condominio + ', que ainda consta em aberto. Pode verificar quando puder? Se já pagou, ' +
    'nos envie o comprovante que atualizamos por aqui. Qualquer dúvida estamos à disposição!';
  window.open('https://web.whatsapp.com/send?phone=' + numero + '&text=' + encodeURIComponent(mensagem), '_blank');
}

// Renderiza o extrato como imagem e copia pra área de transferência — permite colar
// (Ctrl+V) direto numa conversa do WhatsApp Web, sem passar pelo diálogo de impressão.
async function copiarCobrancaComoImagem(idInvoice, idBanner) {
  const banner = document.getElementById(idBanner);
  banner.className = 'banner sucesso';
  banner.textContent = 'Gerando imagem...';
  try {
    const elemento = document.getElementById(idInvoice);
    const canvas = await html2canvas(elemento, { backgroundColor: '#ffffff', scale: 1.5 });
    const blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    banner.className = 'banner sucesso';
    banner.textContent = 'Cobrança copiada! Cole (Ctrl+V) direto na conversa do WhatsApp.';
  } catch (err) {
    banner.className = 'banner erro';
    banner.textContent = 'Não foi possível copiar. Tente novamente ou use "Gerar PDF".';
  }
}

function fecharCobranca() {
  document.title = TITULO_PADRAO_;
  fecharModal('overlayCobranca');
}

async function confirmarCobranca() {
  const banner = document.getElementById('bannerCobranca');
  try {
    const resposta = await chamarApi({ action: 'atualizarOcorrencia', id: idOcorrenciaGestao, status: 'Cobrado', data_cobranca: hojeISO() }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    const o = buscarOcorrencia(idOcorrenciaGestao);
    o.status = 'Cobrado'; o.data_cobranca = hojeISO();
    fecharCobranca();
    renderizarTotais();
    renderizarLista();
  } catch (err) {
    banner.className = 'banner erro';
    banner.textContent = 'Falha ao atualizar status. Tente novamente.';
  }
}

// ===================== COBRANÇA CONSOLIDADA (por pessoa) =====================
// Agrupa ocorrências Pendente/Identificado de uma mesma pessoa (mesmo condomínio)
// para permitir cobrar várias de uma vez. Não muda a cobrança individual acima.

function montarGruposConsolidados() {
  const condominioFiltro = document.getElementById('filtroCondominio').value;
  const elegiveis = todasOcorrencias.filter(function (o) {
    if (condominioFiltro && o.condominio !== condominioFiltro) return false;
    if (o.status !== 'Pendente' && o.status !== 'Identificado') return false;
    return !!(o.pessoa && o.pessoa.trim());
  });

  const mapa = {};
  elegiveis.forEach(function (o) {
    const chaveIdentidade = normalizarWhatsapp(o.contato_whatsapp) || o.pessoa.trim().toLowerCase();
    const chave = o.condominio + '|' + chaveIdentidade;
    if (!mapa[chave]) {
      mapa[chave] = { condominio: o.condominio, pessoa: o.pessoa, contato_whatsapp: o.contato_whatsapp, ocorrencias: [] };
    }
    mapa[chave].ocorrencias.push(o);
  });

  return Object.keys(mapa).map(function (chave) { return mapa[chave]; })
    .filter(function (g) { return g.ocorrencias.length >= 2; })
    .map(function (g) {
      g.ocorrencias.sort(function (a, b) { return (a.data_ocorrencia + a.hora).localeCompare(b.data_ocorrencia + b.hora); });
      return g;
    });
}

function renderizarConsolidado() {
  const container = document.getElementById('secaoConsolidada');
  const grupos = montarGruposConsolidados();
  gruposConsolidadosAtuais = {};

  if (grupos.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '<div class="titulo-secao">Cobrança consolidada</div>' + grupos.map(function (g, idx) {
    gruposConsolidadosAtuais[idx] = g;
    const totalGrupo = g.ocorrencias.reduce(function (soma, o) { return soma + o.valor_total; }, 0);
    const linhas = g.ocorrencias.map(function (o) {
      const resumoItens = o.itens.map(function (i) { return i.qtd + 'x ' + i.produto; }).join(', ');
      return '<div class="item-consolidado-linha">' +
        '<input type="checkbox" class="chk-consolidado" data-grupo="' + idx + '" data-occid="' + o.id + '" data-valor="' + o.valor_total + '" checked onchange="atualizarTotalConsolidado(' + idx + ')">' +
        '<div class="info-consolidado">' +
          '<div class="data-consolidado">' + formatarDataBR(o.data_ocorrencia) + ' às ' + (o.hora || '—') + '</div>' +
          '<div class="itens-consolidado-resumo">' + resumoItens + '</div>' +
        '</div>' +
        '<div class="valor-consolidado">' + formatarMoeda(o.valor_total) + '</div>' +
      '</div>';
    }).join('');

    return '<div class="card-consolidado">' +
      '<div class="card-topo">' +
        '<div>' +
          '<div class="pessoa">' + g.pessoa + '</div>' +
          '<div class="whatsapp-card">' + g.condominio + (g.contato_whatsapp ? ' · WhatsApp: ' + g.contato_whatsapp : ' · Sem WhatsApp cadastrado') + '</div>' +
        '</div>' +
        '<span class="badge identificado">' + g.ocorrencias.length + ' ocorrências</span>' +
      '</div>' +
      '<div class="lista-consolidado">' + linhas + '</div>' +
      '<div class="rodape-consolidado">' +
        '<div class="total-selecionado">Selecionado: <strong id="totalGrupo-' + idx + '">' + formatarMoeda(totalGrupo) + '</strong></div>' +
        '<button type="button" class="btn-cobrar-grupo" id="btnCobrarGrupo-' + idx + '" onclick="abrirCobrancaConsolidada(' + idx + ')">Cobrar selecionadas</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function atualizarTotalConsolidado(grupoId) {
  const checkboxes = document.querySelectorAll('.chk-consolidado[data-grupo="' + grupoId + '"]');
  let total = 0, marcados = 0;
  checkboxes.forEach(function (chk) {
    if (chk.checked) { total += Number(chk.dataset.valor); marcados++; }
  });
  document.getElementById('totalGrupo-' + grupoId).textContent = formatarMoeda(total);
  document.getElementById('btnCobrarGrupo-' + grupoId).disabled = marcados === 0;
}

function abrirCobrancaConsolidada(grupoId) {
  const grupo = gruposConsolidadosAtuais[grupoId];
  const idsMarcados = Array.from(document.querySelectorAll('.chk-consolidado[data-grupo="' + grupoId + '"]:checked')).map(function (chk) { return chk.dataset.occid; });
  const selecionadas = grupo.ocorrencias.filter(function (o) { return idsMarcados.indexOf(o.id) !== -1; });
  if (selecionadas.length === 0) return;

  ocorrenciasCobrancaConsolidadaAtual = selecionadas;
  grupoCobrancaConsolidadaAtual = { condominio: grupo.condominio, pessoa: grupo.pessoa, contato_whatsapp: grupo.contato_whatsapp };

  const condominioInfo = bootstrap.condominios.find(function (c) { return c.nome_curto === grupo.condominio; }) || {};
  const nomeCondominio = condominioInfo.nome_oficial || grupo.condominio;
  const nomePessoa = grupo.pessoa || 'Cliente';

  const datas = selecionadas.map(function (o) { return o.data_ocorrencia; }).sort();
  const dataInicio = datas[0], dataFim = datas[datas.length - 1];
  const periodoTexto = dataInicio === dataFim ? formatarDataBR(dataInicio) : formatarDataBR(dataInicio) + ' a ' + formatarDataBR(dataFim);
  const totalGeral = selecionadas.reduce(function (soma, o) { return soma + o.valor_total; }, 0);

  document.getElementById('refLinhaConsolidada').textContent = 'Condomínio: ' + nomeCondominio + ' · Período: ' + periodoTexto + ' · ' + selecionadas.length + ' consumos';
  document.getElementById('saudacaoConsolidada').textContent = 'Prezado(a) ' + nomePessoa + ', identificamos ' + selecionadas.length + ' consumos em aberto entre ' + formatarDataBR(dataInicio) + ' e ' + formatarDataBR(dataFim) + ', no valor total de ' + formatarMoeda(totalGeral) + ', sem pagamento localizado.';

  document.title = ('EXTRATO ' + hojeISO().split('-').reverse().join('') + ' ' + nomePessoa + ' - ' + grupo.condominio).toUpperCase();

  const corpoTabela = document.getElementById('itensConsolidados');
  const linhas = [];
  selecionadas.forEach(function (o) {
    o.itens.forEach(function (item) {
      linhas.push('<tr><td>' + item.produto + '</td><td>' + item.qtd + '</td><td>' + formatarDataBR(o.data_ocorrencia) + '</td><td>' + (o.hora || '—') + '</td><td>' + formatarMoeda(item.preco_unit) + '</td><td>' + formatarMoeda(item.qtd * item.preco_unit) + '</td></tr>');
    });
  });
  corpoTabela.innerHTML = linhas.join('');
  document.getElementById('totalConsolidado').textContent = formatarMoeda(totalGeral);

  document.getElementById('bannerCobrancaConsolidada').className = 'banner';
  abrirModal('overlayCobrancaConsolidada');
}

function abrirWhatsappConsolidado() {
  const numero = normalizarWhatsapp(grupoCobrancaConsolidadaAtual.contato_whatsapp);
  const banner = document.getElementById('bannerCobrancaConsolidada');
  if (!numero) {
    banner.className = 'banner erro';
    banner.textContent = 'Esta pessoa não tem WhatsApp cadastrado.';
    return;
  }
  const nomePessoa = grupoCobrancaConsolidadaAtual.pessoa || 'Cliente';
  const datas = ocorrenciasCobrancaConsolidadaAtual.map(function (o) { return o.data_ocorrencia; }).sort();
  const totalGeral = ocorrenciasCobrancaConsolidadaAtual.reduce(function (soma, o) { return soma + o.valor_total; }, 0);
  const mensagem = 'Olá ' + nomePessoa + ', tudo bem? Aqui é da All in Hall. Na conferência do minimercado do ' +
    grupoCobrancaConsolidadaAtual.condominio + ' identificamos ' + ocorrenciasCobrancaConsolidadaAtual.length +
    ' consumos em aberto entre ' + formatarDataBR(datas[0]) + ' e ' + formatarDataBR(datas[datas.length - 1]) +
    ', no valor total de ' + formatarMoeda(totalGeral) + ', sem pagamento localizado. ' +
    'Pode verificar? Se já pagou algum deles, nos envie o comprovante. Qualquer dúvida estamos à disposição!';
  window.open('https://web.whatsapp.com/send?phone=' + numero + '&text=' + encodeURIComponent(mensagem), '_blank');
}

function fecharCobrancaConsolidada() {
  document.title = TITULO_PADRAO_;
  fecharModal('overlayCobrancaConsolidada');
}

async function confirmarCobrancaConsolidada() {
  const banner = document.getElementById('bannerCobrancaConsolidada');
  try {
    for (const o of ocorrenciasCobrancaConsolidadaAtual) {
      const resposta = await chamarApi({ action: 'atualizarOcorrencia', id: o.id, status: 'Cobrado', data_cobranca: hojeISO() }, 'POST');
      if (!resposta.ok) throw new Error(resposta.erro);
      o.status = 'Cobrado';
      o.data_cobranca = hojeISO();
    }
    fecharCobrancaConsolidada();
    renderizarTotais();
    renderizarLista();
  } catch (err) {
    banner.className = 'banner erro';
    banner.textContent = 'Falha ao atualizar uma das ocorrências. As já processadas foram salvas — confira a lista e tente novamente para as restantes.';
  }
}

// ===================== PAGO / PREJUÍZO / CANCELAR =====================
async function marcarComoPago(id) {
  if (!confirm('Confirmar recebimento do pagamento?')) return;
  try {
    // data_prejuizo sai junto: se a ocorrência estava dada como perdida e o
    // dinheiro entrou, ela deixa de ser prejuízo — e a data antiga só confundiria.
    const resposta = await chamarApi({ action: 'atualizarOcorrencia', id: id, status: 'Pago', data_pagamento: hojeISO(), data_prejuizo: '' }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    const o = buscarOcorrencia(id);
    o.status = 'Pago'; o.data_pagamento = hojeISO(); o.data_prejuizo = '';
    renderizarTotais();
    renderizarLista();
  } catch (err) {
    alert('Falha ao atualizar. Verifique a conexão e tente novamente.');
  }
}

// "Cobrei e não recebi": tira a ocorrência da fila de cobrança e joga no
// acumulado de prejuízo, sem apagar nada — o valor continua registrado.
async function marcarComoPrejuizo(id) {
  const o = buscarOcorrencia(id);
  const pergunta = o.status === 'Cobrado'
    ? 'Dar baixa como prejuízo? ' + formatarMoeda(o.valor_total) + ' passam a contar como valor cobrado e não recebido.'
    : 'Dar baixa como prejuízo sem cobrar? ' + formatarMoeda(o.valor_total) + ' passam a contar como perda.';
  if (!confirm(pergunta)) return;
  try {
    const resposta = await chamarApi({ action: 'atualizarOcorrencia', id: id, status: STATUS_PREJUIZO_, data_prejuizo: hojeISO() }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    o.status = STATUS_PREJUIZO_; o.data_prejuizo = hojeISO();
    renderizarTotais();
    renderizarLista();
  } catch (err) {
    alert('Falha ao atualizar. Verifique a conexão e tente novamente.');
  }
}

// Desfaz a baixa. Volta pra "Cobrado" só o que já tinha sido cobrado um dia — o
// que recebeu baixa direto de "Pendente" volta pra pendente mesmo, em vez de
// aparecer como cobrado numa data de cobrança que nunca existiu.
async function reabrirOcorrencia(id) {
  const o = buscarOcorrencia(id);
  const novoStatus = o.data_cobranca ? 'Cobrado' : (o.pessoa ? 'Identificado' : 'Pendente');
  const destino = novoStatus === 'Cobrado' ? '"Cobrado, aguardando"' : 'a fila de pendentes';
  if (!confirm('Desfazer a baixa e voltar esta ocorrência para ' + destino + '?')) return;
  try {
    const resposta = await chamarApi({ action: 'atualizarOcorrencia', id: id, status: novoStatus, data_prejuizo: '' }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    o.status = novoStatus; o.data_prejuizo = '';
    renderizarTotais();
    renderizarLista();
  } catch (err) {
    alert('Falha ao atualizar. Verifique a conexão e tente novamente.');
  }
}

async function cancelarOcorrencia(id) {
  if (!confirm('Cancelar esta ocorrência? Use para falsos positivos.')) return;
  try {
    const resposta = await chamarApi({ action: 'atualizarOcorrencia', id: id, status: 'Cancelado' }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    const o = buscarOcorrencia(id);
    o.status = 'Cancelado';
    renderizarTotais();
    renderizarLista();
  } catch (err) {
    alert('Falha ao atualizar. Verifique a conexão e tente novamente.');
  }
}
