/* ============================================================
   ALL IN HALL — reposicao.js
   Lógica da tela de Reposição: registro de furos de estoque
   encontrados na reposição física (junto com o sistema da
   Pináculo). Cada item é uma linha própria em Reposicoes — só
   condominio/data/produto/quantidade/preco_unit/valor_total.
   A identificação do infrator (pessoa/whatsapp/dia/hora) é
   feita na Conferência, ver conferencia.js.
   ============================================================ */

// ===================== ESTADO EM MEMÓRIA =====================
let itensReposicao = [];
let todasReposicoes = [];
let reposicaoEmEdicaoId = null;

// ===================== INICIALIZAÇÃO =====================
function inicializarReposicao() {
  const opcoesCondominios = bootstrap.condominios.map(function (c) {
    return '<option value="' + c.nome_curto + '">' + c.nome_curto + '</option>';
  }).join('');

  const selectCondominio = document.getElementById('condominioReposicao');
  selectCondominio.innerHTML = '<option value="">Selecione um condomínio</option>' + opcoesCondominios;

  const selectFiltro = document.getElementById('filtroCondominioReposicao');
  selectFiltro.innerHTML = '<option value="">Todos</option>' + opcoesCondominios;

  const datalistProdutos = document.getElementById('listaProdutosDatalistReposicao');
  datalistProdutos.innerHTML = bootstrap.produtos.map(function (p) { return '<option value="' + p.nome + '">'; }).join('');

  document.getElementById('dataReposicao').value = hojeISOReposicao_();

  mudarCondominioReposicao();
  carregarReposicoes();
}

// Mostra o formulário de itens (e o mini-calendário) só depois que um
// condomínio é escolhido — igual ao calendário da Conferência, que também
// fica em branco até selecionar onde a reposição vai ser feita.
function mudarCondominioReposicao() {
  const condominio = document.getElementById('condominioReposicao').value;
  document.getElementById('conteudoFormularioReposicao').classList.toggle('oculto', !condominio);
  document.getElementById('formularioReposicaoVazio').classList.toggle('oculto', !!condominio);
  renderizarMiniCalReposicao();
}

function hojeISOReposicao_() {
  const h = new Date();
  return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0');
}

// ===================== LISTA DE REPOSIÇÕES =====================
async function carregarReposicoes() {
  const banner = document.getElementById('bannerListaReposicoes');
  banner.className = 'banner';
  banner.textContent = '';
  try {
    const resposta = await chamarApi({ action: 'reposicoes' });
    if (!resposta.ok) throw new Error(resposta.erro);
    todasReposicoes = resposta.dados;
    renderizarListaReposicoes();
    renderizarMiniCalReposicao();
  } catch (err) {
    banner.className = 'banner erro';
    banner.textContent = 'Não foi possível carregar as reposições. Verifique a conexão e tente novamente.';
  }
}

// ===================== MEMÓRIA: DIAS COM REPOSIÇÃO =====================
// Calendário do condomínio selecionado em "Novo lançamento" — marca os dias
// que já tiveram reposição lançada, pra lembrar quando foi a última visita.
// Não faz chamada própria à API — só reaproveita o que já veio em todasReposicoes.
let miniCalReposicaoMes = new Date().getMonth() + 1;
let miniCalReposicaoAno = new Date().getFullYear();
const NOMES_MESES_REPOSICAO_ = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function mudarMesReposicao(delta) {
  miniCalReposicaoMes += delta;
  if (miniCalReposicaoMes > 12) { miniCalReposicaoMes = 1; miniCalReposicaoAno++; }
  if (miniCalReposicaoMes < 1) { miniCalReposicaoMes = 12; miniCalReposicaoAno--; }
  renderizarMiniCalReposicao();
}

function mudarDataReposicaoManual() {
  const data = document.getElementById('dataReposicao').value;
  if (data) {
    const partes = data.split('-');
    if (partes.length === 3) {
      miniCalReposicaoAno = parseInt(partes[0], 10);
      miniCalReposicaoMes = parseInt(partes[1], 10);
    }
  }
  renderizarMiniCalReposicao();
}

function selecionarDataReposicao_(dataISO) {
  document.getElementById('dataReposicao').value = dataISO;
  renderizarMiniCalReposicao();
}

function renderizarMiniCalReposicao() {
  const condominio = document.getElementById('condominioReposicao').value;
  const conteudo = document.getElementById('miniCalReposicaoConteudo');
  const vazio = document.getElementById('miniCalReposicaoVazio');
  const rotulo = document.getElementById('miniCalReposicaoCondominioLabel');
  const dataSelecionada = document.getElementById('dataReposicao').value;

  if (!condominio) {
    rotulo.textContent = '—';
    conteudo.classList.add('oculto');
    vazio.classList.remove('oculto');
    return;
  }
  rotulo.textContent = condominio;
  conteudo.classList.remove('oculto');
  vazio.classList.add('oculto');
  document.getElementById('miniCalReposicaoTitulo').textContent = NOMES_MESES_REPOSICAO_[miniCalReposicaoMes - 1] + ' de ' + miniCalReposicaoAno;

  const chavePeriodo = miniCalReposicaoAno + '-' + String(miniCalReposicaoMes).padStart(2, '0');
  const mapaDias = {}; // 'yyyy-mm-dd' -> 'pendente' | 'identificado' | 'ok'
  todasReposicoes.forEach(function (r) {
    if (r.condominio !== condominio) return;
    if (String(r.data).indexOf(chavePeriodo) !== 0) return;
    if (mapaDias[r.data] !== 'pendente') {
      if (r.status === 'Pendente') mapaDias[r.data] = 'pendente';
      else if (r.status === 'OK') mapaDias[r.data] = 'ok';
      else mapaDias[r.data] = 'identificado';
    }
  });

  const grade = document.getElementById('miniCalReposicaoGrade');
  const fragmento = document.createDocumentFragment();
  const primeiroDiaSemana = new Date(miniCalReposicaoAno, miniCalReposicaoMes - 1, 1).getDay();
  const diasNoMes = new Date(miniCalReposicaoAno, miniCalReposicaoMes, 0).getDate();

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataISO = miniCalReposicaoAno + '-' + String(miniCalReposicaoMes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
    const celula = document.createElement('div');
    celula.className = 'mini-dia';
    celula.textContent = dia;
    celula.title = 'Clique para selecionar o dia ' + formatarDataBR(dataISO);
    if (dia === 1) celula.style.gridColumnStart = String(primeiroDiaSemana + 1);
    if (dataISO === dataSelecionada) celula.classList.add('selecionado');
    if (mapaDias[dataISO] === 'pendente') celula.classList.add('ocorrencia');
    else if (mapaDias[dataISO] === 'identificado' || mapaDias[dataISO] === 'ok') celula.classList.add('ok');

    celula.onclick = function () { selecionarDataReposicao_(dataISO); };
    fragmento.appendChild(celula);
  }
  grade.innerHTML = '';
  grade.appendChild(fragmento);
}

async function marcarVisitaReposicao() {
  const condominio = document.getElementById('condominioReposicao').value;
  const data = document.getElementById('dataReposicao').value;

  if (!condominio) { mostrarBannerReposicao_('erro', 'Selecione o condomínio primeiro.'); return; }
  if (!data) { mostrarBannerReposicao_('erro', 'Selecione a data da reposição.'); return; }

  const botao = document.getElementById('btnMarcarVisitaReposicao');
  const textoOriginal = botao.innerHTML;
  botao.disabled = true;
  botao.innerHTML = 'Salvando visita...';

  try {
    const resposta = await chamarApi({
      action: 'criarReposicao',
      condominio: condominio,
      data: data,
      sem_furos: true
    }, 'POST');

    if (!resposta.ok) throw new Error(resposta.erro || 'Erro ao registrar visita.');
    mostrarBannerReposicao_('sucesso', 'Visita de reposição em ' + formatarDataBR(data) + ' registrada com sucesso (Sem furos)!');
    await carregarReposicoes();
  } catch (err) {
    mostrarBannerReposicao_('erro', err.message || 'Falha ao registrar visita.');
  } finally {
    botao.disabled = false;
    botao.innerHTML = textoOriginal;
    if (window.lucide) lucide.createIcons();
  }
}

function renderizarListaReposicoes() {
  const filtro = document.getElementById('filtroCondominioReposicao').value;
  const lista = document.getElementById('listaReposicoes');

  let candidatas = todasReposicoes;
  if (filtro) candidatas = candidatas.filter(function (r) { return r.condominio === filtro; });

  // Furo já identificado sai da lista — ele já virou Ocorrência e passa a ser
  // acompanhado por lá, não faz sentido continuar aparecendo aqui também.
  const filtradas = candidatas.filter(function (r) { return r.status !== 'Identificado'; });

  if (filtradas.length === 0) {
    const mensagem = candidatas.length === 0
      ? 'Nenhuma reposição lançada ainda.'
      : 'Nenhum furo pendente — os já identificados viram Ocorrência em Gestão.';
    lista.innerHTML = '<div class="vazio-relacao">' + mensagem + '</div>';
    return;
  }

  // Agrupa os itens por Condomínio + Data
  const mapaGrupos = {};
  filtradas.forEach(function (r) {
    const chave = r.condominio + '___' + r.data;
    if (!mapaGrupos[chave]) {
      mapaGrupos[chave] = {
        condominio: r.condominio,
        data: r.data,
        itens: [],
        totalValor: 0,
        totalQtd: 0,
        ids: []
      };
    }
    mapaGrupos[chave].itens.push(r);
    mapaGrupos[chave].ids.push(r.id);
    mapaGrupos[chave].totalValor += Number(r.valor_total) || 0;
    mapaGrupos[chave].totalQtd += Number(r.quantidade) || 0;
  });

  const grupos = Object.values(mapaGrupos)
    .sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });

  lista.innerHTML = grupos.map(function (g) {
    const semFuros = g.itens.every(function (i) {
      return i.status === 'OK' || i.produto === 'Reposição realizada (Sem furos)' || Number(i.valor_total) === 0;
    });
    const temPendente = g.itens.some(function (i) { return i.status === 'Pendente'; });
    const badgeClasse = semFuros ? 'pago' : (temPendente ? 'pendente' : 'pago');
    const badgeTexto = semFuros ? 'Sem furos (OK)' : (temPendente ? 'Pendente' : 'Identificado');

    let corpoHtml = '';
    if (semFuros) {
      corpoHtml = '<div class="visita-sem-furos-aviso">' +
        '<i data-lucide="check-circle-2"></i> Visita de reposição física realizada sem divergência de estoque' +
      '</div>';
    } else {
      corpoHtml = '<div class="tabela-reposicao-wrap">' +
        '<table class="tabela-reposicao-itens">' +
          '<thead>' +
            '<tr>' +
              '<th>Produto</th>' +
              '<th class="centro">Qtd</th>' +
              '<th class="direita">Unitário</th>' +
              '<th class="direita">Subtotal</th>' +
              '<th class="centro">Ação</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            g.itens.map(function (item) {
              return '<tr>' +
                '<td class="col-prod"><strong>' + item.produto + '</strong></td>' +
                '<td class="centro col-qtd">' + item.quantidade + ' un.</td>' +
                '<td class="direita col-unit">' + formatarMoeda(item.preco_unit) + '</td>' +
                '<td class="direita col-subtotal"><strong>' + formatarMoeda(item.valor_total) + '</strong></td>' +
                '<td class="centro col-acoes">' +
                  '<button type="button" class="btn-excluir-item-tabela" title="Excluir este item" onclick="excluirReposicao(\'' + item.id + '\')">' +
                    '<i data-lucide="trash-2"></i>' +
                  '</button>' +
                '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>';
    }

    return '<div class="card-reposicao-agrupado">' +
      '<div class="card-reposicao-cabecalho">' +
        '<div class="card-reposicao-titulo">' +
          '<h4>' + g.condominio + '</h4>' +
          '<span class="card-reposicao-data">' + formatarDataBR(g.data) + '</span>' +
        '</div>' +
        '<div class="card-reposicao-direita">' +
          '<span class="badge-status ' + badgeClasse + '">' + badgeTexto + '</span>' +
          '<div class="card-reposicao-total">' + (semFuros ? '—' : formatarMoeda(g.totalValor)) + '</div>' +
        '</div>' +
      '</div>' +
      corpoHtml +
      '<div class="card-reposicao-rodape">' +
        '<span class="card-reposicao-qtd">' +
          (semFuros ? 'Visita realizada' : (g.itens.length + ' produto(s) com furo · ' + g.totalQtd + ' unidades no total')) +
        '</span>' +
        '<button type="button" class="btn-excluir-lote" onclick="excluirLoteReposicao([\'' + g.ids.join("','") + '\'])">' +
          '<i data-lucide="trash"></i> Excluir lançamento' +
        '</button>' +
      '</div>' +
    '</div>';
  }).join('');

  if (window.lucide) lucide.createIcons();
}

async function excluirLoteReposicao(ids) {
  if (!ids || ids.length === 0) return;
  if (!confirm('Deseja excluir este lançamento de reposição (' + ids.length + ' item/itens)?')) return;
  try {
    for (let i = 0; i < ids.length; i++) {
      await chamarApi({ action: 'excluirReposicao', id: ids[i] }, 'POST');
    }
    await carregarReposicoes();
  } catch (err) {
    alert('Erro ao excluir: ' + (err.message || err));
  }
}

// ===================== ITENS DO LANÇAMENTO =====================
function adicionarItemReposicao() {
  const inputNome = document.getElementById('inputProdutoReposicao');
  const inputQtd = document.getElementById('inputQtdReposicao');
  const nomeDigitado = inputNome.value.trim();

  const produto = encontrarProduto_(nomeDigitado);
  if (!produto) {
    alert('Produto não encontrado. Digite parte do nome e escolha uma das opções sugeridas.');
    return;
  }
  const qtd = Math.max(1, parseInt(inputQtd.value, 10) || 1);

  const existente = itensReposicao.find(function (i) { return i.produto === produto.nome; });
  if (existente) existente.qtd += qtd;
  else itensReposicao.push({ produto: produto.nome, qtd: qtd, preco_unit: produto.preco });

  inputNome.value = '';
  inputQtd.value = '1';
  inputNome.focus();
  renderizarItensReposicao();
}

function removerItemReposicao(indice) {
  itensReposicao.splice(indice, 1);
  renderizarItensReposicao();
}

function renderizarItensReposicao() {
  const lista = document.getElementById('listaItensReposicao');
  lista.innerHTML = itensReposicao.map(function (item, indice) {
    const subtotal = item.qtd * item.preco_unit;
    return '<div class="item-adicionado">' +
      '<div class="info">' + item.produto + '<div class="qtd-preco">' + item.qtd + ' x ' + formatarMoeda(item.preco_unit) + '</div></div>' +
      '<div class="direita">' +
        '<span class="subtotal">' + formatarMoeda(subtotal) + '</span>' +
        '<button type="button" class="btn-remover" onclick="removerItemReposicao(' + indice + ')">×</button>' +
      '</div>' +
    '</div>';
  }).join('') || '<div class="lista-vazia-itens">Nenhum item adicionado ainda.</div>';

  atualizarTotalReposicao();
}

function atualizarTotalReposicao() {
  const total = itensReposicao.reduce(function (soma, item) { return soma + item.qtd * item.preco_unit; }, 0);
  document.getElementById('totalReposicao').textContent = formatarMoeda(total);
  return total;
}

// ===================== SALVAR / EDITAR / EXCLUIR =====================
async function salvarReposicao() {
  const condominio = document.getElementById('condominioReposicao').value;
  const data = document.getElementById('dataReposicao').value;

  if (!condominio) { mostrarBannerReposicao_('erro', 'Selecione o condomínio.'); return; }
  if (!data) { mostrarBannerReposicao_('erro', 'Selecione a data.'); return; }
  if (itensReposicao.length === 0) { mostrarBannerReposicao_('erro', 'Adicione ao menos um item.'); return; }

  let payload;
  if (reposicaoEmEdicaoId) {
    // Edição é sempre de um item só — cada linha em Reposicoes é um item individual.
    if (itensReposicao.length !== 1) {
      mostrarBannerReposicao_('erro', 'Ao editar, mantenha só um item na lista.');
      return;
    }
    const item = itensReposicao[0];
    payload = {
      action: 'atualizarReposicao',
      id: reposicaoEmEdicaoId,
      condominio: condominio,
      data: data,
      produto: item.produto,
      quantidade: item.qtd,
      preco_unit: item.preco_unit,
      valor_total: item.qtd * item.preco_unit
    };
  } else {
    payload = { action: 'criarReposicao', condominio: condominio, data: data, itens: itensReposicao };
  }

  const botao = document.getElementById('botaoSalvarReposicao');
  botao.disabled = true;
  botao.classList.add('carregando');
  botao.textContent = 'Salvando...';
  try {
    const resposta = await chamarApi(payload, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro || 'Erro ao salvar.');
    mostrarBannerReposicao_('sucesso', 'Reposição salva com sucesso!');
    setTimeout(async function () {
      limparFormularioReposicao_();
      await carregarReposicoes();
    }, 700);
  } catch (err) {
    mostrarBannerReposicao_('erro', 'Falha ao salvar. Verifique a conexão e tente novamente.');
  } finally {
    botao.disabled = false;
    botao.classList.remove('carregando');
    botao.textContent = 'Salvar reposição';
  }
}

function mostrarBannerReposicao_(tipo, mensagem) {
  const banner = document.getElementById('bannerReposicao');
  banner.className = 'banner ' + tipo;
  banner.textContent = mensagem;
}

function editarReposicao(id) {
  const r = todasReposicoes.find(function (x) { return x.id === id; });
  if (!r) return;

  reposicaoEmEdicaoId = id;
  document.getElementById('tituloFormularioReposicao').textContent = 'Editar item';
  document.getElementById('condominioReposicao').value = r.condominio;
  mudarCondominioReposicao();
  document.getElementById('dataReposicao').value = r.data;
  itensReposicao = [{ produto: r.produto, qtd: r.quantidade, preco_unit: r.preco_unit }];
  renderizarItensReposicao();
  document.getElementById('botaoCancelarEdicaoReposicao').classList.remove('oculto');
  mostrarBannerReposicao_('', '');
}

function cancelarEdicaoReposicao() {
  limparFormularioReposicao_();
}

function limparFormularioReposicao_() {
  reposicaoEmEdicaoId = null;
  document.getElementById('tituloFormularioReposicao').textContent = 'Novo lançamento';
  itensReposicao = [];
  renderizarItensReposicao();
  document.getElementById('botaoCancelarEdicaoReposicao').classList.add('oculto');
  mostrarBannerReposicao_('', '');
}

async function excluirReposicao(id) {
  if (!confirm('Excluir este lançamento de reposição? Essa ação não pode ser desfeita.')) return;
  try {
    const resposta = await chamarApi({ action: 'excluirReposicao', id: id }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    if (reposicaoEmEdicaoId === id) limparFormularioReposicao_();
    await carregarReposicoes();
  } catch (err) {
    alert('Não foi possível excluir. Verifique a conexão e tente novamente.');
  }
}
