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
  const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0');
  const selectMes = document.getElementById('filtroMes');
  if (selectMes) selectMes.value = mesAtual;
  if (selectAno) selectAno.value = String(anoAtualFiltro);

  const btnAtual = document.getElementById('btnPeriodoMesAtual');
  if (btnAtual) btnAtual.classList.add('ativo');

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

// Contagem de ocorrências por status sincronizada com o filtro ativo.
function renderizarContagemStatus(listaFiltrada) {
  const lista = listaFiltrada || todasOcorrencias;
  let pendente = 0, cobrado = 0, pago = 0, prejuizo = 0;
  lista.forEach(function (o) {
    if (o.status === 'Cancelado') return;
    if (o.status === 'Pendente' || o.status === 'Identificado') pendente++;
    else if (o.status === 'Cobrado') cobrado++;
    else if (o.status === 'Pago') pago++;
    else if (o.status === STATUS_PREJUIZO_) prejuizo++;
  });
  const el = document.getElementById('contagemStatus');
  if (el) {
    el.innerHTML =
      '<div class="contagem-item pendente"><span class="contagem-numero">' + pendente + '</span><span class="contagem-rotulo">Pendente</span></div>' +
      '<div class="contagem-item cobrado"><span class="contagem-numero">' + cobrado + '</span><span class="contagem-rotulo">Cobrado</span></div>' +
      '<div class="contagem-item pago"><span class="contagem-numero">' + pago + '</span><span class="contagem-rotulo">Pago</span></div>' +
      '<div class="contagem-item prejuizo"><span class="contagem-numero">' + prejuizo + '</span><span class="contagem-rotulo">Prejuízo</span></div>';
  }
}

function renderizarMiniCalendario(dados) {
  const grade = document.getElementById('miniCalGrade');
  // Monta tudo num DocumentFragment e só encosta na grade de verdade uma vez
  // no final — evita reflow a cada célula do loop.
  const fragmento = document.createDocumentFragment();

  const primeiroDiaSemana = new Date(miniCalAno, miniCalMes - 1, 1).getDay();
  const diasNoMes = new Date(miniCalAno, miniCalMes, 0).getDate();

  const mapaOcorrencias = {};
  dados.ocorrencias.forEach(function (o) {
    if (o.status === 'Cancelado') return;
    if (!mapaOcorrencias[o.data_ocorrencia]) mapaOcorrencias[o.data_ocorrencia] = [];
    mapaOcorrencias[o.data_ocorrencia].push(o);
  });
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

    const ocsDoDia = mapaOcorrencias[dataISO] || [];
    if (ocsDoDia.length > 0) {
      const temAberta = ocsDoDia.some(function (o) { return o.status !== 'Pago'; });
      if (temAberta) celula.classList.add('ocorrencia');
      else celula.classList.add('ok');
    } else if (mapaFechados[dataISO] === 'Sem operacao') {
      celula.classList.add('semoperacao');
    } else if (mapaFechados[dataISO] === 'OK') {
      celula.classList.add('ok');
    }
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
function renderizarTotais(listaFiltrada) {
  const lista = listaFiltrada || todasOcorrencias;

  let totalPendente = 0, totalCobrado = 0, totalRecebido = 0, totalPrejuizo = 0;
  let qtdPendente = 0, qtdCobrado = 0, qtdRecebido = 0, qtdPrejuizo = 0;

  lista.forEach(function (o) {
    if (o.status === 'Cancelado') return;
    const v = Number(o.valor_total) || 0;
    if (o.status === 'Pendente' || o.status === 'Identificado') {
      totalPendente += v;
      qtdPendente++;
    } else if (o.status === 'Cobrado') {
      totalCobrado += v;
      qtdCobrado++;
    } else if (o.status === 'Pago') {
      totalRecebido += v;
      qtdRecebido++;
    } else if (o.status === STATUS_PREJUIZO_) {
      totalPrejuizo += v;
      qtdPrejuizo++;
    }
  });

  const elPendente = document.getElementById('kanbanSubtituloPendente');
  if (elPendente) {
    elPendente.textContent = formatarMoeda(totalPendente) + ' · ' + qtdPendente + (qtdPendente === 1 ? ' ocorrência' : ' ocorrências');
  }
  const elCobrado = document.getElementById('kanbanSubtituloCobrado');
  if (elCobrado) {
    elCobrado.textContent = formatarMoeda(totalCobrado) + ' · ' + qtdCobrado + (qtdCobrado === 1 ? ' ocorrência' : ' ocorrências');
  }
  const elRecebido = document.getElementById('kanbanSubtituloRecebido');
  if (elRecebido) {
    elRecebido.textContent = formatarMoeda(totalRecebido) + ' · ' + qtdRecebido + (qtdRecebido === 1 ? ' pagamento' : ' pagamentos');
  }
  const elPrejuizo = document.getElementById('kanbanSubtituloPrejuizo');
  if (elPrejuizo) {
    elPrejuizo.textContent = formatarMoeda(totalPrejuizo) + ' · ' + qtdPrejuizo + (qtdPrejuizo === 1 ? ' ocorrência' : ' ocorrências');
  }
}

// ===================== QUADRO KANBAN (Pendente / Cobrado / Recebido / Prejuízo) =====================
// Ocorrências Canceladas não entram em nenhuma coluna — mesmo critério que já valia
// para os totais acima, agora estendido pra lista inteira.

// ===================== BUSCA RÁPIDA E ATALHOS DE PERÍODO =====================
let buscaTextoGestao = '';

function filtrarPorBuscaGestao() {
  const input = document.getElementById('inputBuscaGestao');
  buscaTextoGestao = (input ? input.value : '').trim().toLowerCase();
  const btnLimpar = document.getElementById('btnLimparBuscaGestao');
  if (btnLimpar) btnLimpar.classList.toggle('oculto', !buscaTextoGestao);
  renderizarLista();
}

function limparBuscaGestao() {
  const input = document.getElementById('inputBuscaGestao');
  if (input) input.value = '';
  buscaTextoGestao = '';
  const btnLimpar = document.getElementById('btnLimparBuscaGestao');
  if (btnLimpar) btnLimpar.classList.add('oculto');
  renderizarLista();
}

function aplicarPeriodoGestao(tipo) {
  const h = new Date();
  const mesAtual = String(h.getMonth() + 1).padStart(2, '0');
  const anoAtual = String(h.getFullYear());

  let mesPassadoNum = h.getMonth(); // 0-based for previous month
  let anoMesPassado = h.getFullYear();
  if (mesPassadoNum === 0) {
    mesPassadoNum = 12;
    anoMesPassado--;
  }
  const mesPassado = String(mesPassadoNum).padStart(2, '0');

  const selectMes = document.getElementById('filtroMes');
  const selectAno = document.getElementById('filtroAno');
  const inputInicio = document.getElementById('filtroDataInicio');
  const inputFim = document.getElementById('filtroDataFim');

  if (inputInicio) inputInicio.value = '';
  if (inputFim) inputFim.value = '';

  ['btnPeriodoMesAtual', 'btnPeriodoMesPassado', 'btnPeriodoAnoAtual', 'btnPeriodoTodos'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('ativo');
  });

  if (tipo === 'mes-atual') {
    if (selectMes) selectMes.value = mesAtual;
    if (selectAno) selectAno.value = anoAtual;
    const btn = document.getElementById('btnPeriodoMesAtual');
    if (btn) btn.classList.add('ativo');
  } else if (tipo === 'mes-passado') {
    if (selectMes) selectMes.value = mesPassado;
    if (selectAno) selectAno.value = String(anoMesPassado);
    const btn = document.getElementById('btnPeriodoMesPassado');
    if (btn) btn.classList.add('ativo');
  } else if (tipo === 'ano-atual') {
    if (selectMes) selectMes.value = '';
    if (selectAno) selectAno.value = anoAtual;
    const btn = document.getElementById('btnPeriodoAnoAtual');
    if (btn) btn.classList.add('ativo');
  } else if (tipo === 'todos') {
    if (selectMes) selectMes.value = '';
    if (selectAno) selectAno.value = '';
    const btn = document.getElementById('btnPeriodoTodos');
    if (btn) btn.classList.add('ativo');
  }

  renderizarLista();
}

function atualizarTaxaRecuperacaoGestao(lista) {
  const barraWrap = document.getElementById('barraRecuperacaoGestao');
  const elPct = document.getElementById('taxaRecuperacaoPct');
  const elDetalhe = document.getElementById('taxaRecuperacaoDetalhe');
  const elBarra = document.getElementById('taxaRecuperacaoBarra');
  if (!barraWrap || !elPct || !elDetalhe || !elBarra) return;

  const totalPago = lista.filter(function (o) { return o.status === 'Pago'; })
    .reduce(function (soma, o) { return soma + (Number(o.valor_total) || 0); }, 0);

  const totalCobrado = lista.filter(function (o) { return o.status === 'Cobrado'; })
    .reduce(function (soma, o) { return soma + (Number(o.valor_total) || 0); }, 0);

  const totalPrejuizo = lista.filter(function (o) { return o.status === STATUS_PREJUIZO_; })
    .reduce(function (soma, o) { return soma + (Number(o.valor_total) || 0); }, 0);

  const totalBase = totalPago + totalCobrado + totalPrejuizo;

  if (totalBase === 0) {
    barraWrap.classList.add('oculto');
    return;
  }

  barraWrap.classList.remove('oculto');
  const pct = Math.round((totalPago / totalBase) * 100);
  elPct.textContent = pct + '%';
  elDetalhe.textContent = formatarMoeda(totalPago) + ' recebidos de ' + formatarMoeda(totalBase) + ' movimentados';
  elBarra.style.width = Math.min(100, Math.max(0, pct)) + '%';
}

function renderizarLista() {
  carregarMiniCalendario();

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

    if (buscaTextoGestao) {
      const textoCompleto = [
        o.pessoa || '',
        o.descricao_pessoa || '',
        o.contato_whatsapp || '',
        o.condominio || '',
        o.data_ocorrencia || '',
        o.hora || '',
        o.observacao || '',
        (o.itens || []).map(function (i) { return i.produto; }).join(' ')
      ].join(' ').toLowerCase();

      if (textoCompleto.indexOf(buscaTextoGestao) === -1) return false;
    }

    return true;
  });

  // Atualizar totalizadores do cabeçalho de cada coluna e contagem de status com a lista filtrada
  renderizarTotais(lista);
  renderizarContagemStatus(lista);

  // Atualizar Indicador Executivo de Taxa de Recuperação
  atualizarTaxaRecuperacaoGestao(lista);

  lista.sort(function (a, b) {
    return (b.data_ocorrencia + b.hora).localeCompare(a.data_ocorrencia + a.hora);
  });

  renderizarColunaKanban('kanbanColunaPendente', lista.filter(function (o) { return o.status === 'Pendente' || o.status === 'Identificado'; }));
  renderizarColunaKanban('kanbanColunaCobrado', lista.filter(function (o) { return o.status === 'Cobrado'; }));
  renderizarColunaKanban('kanbanColunaRecebido', lista.filter(function (o) { return o.status === 'Pago'; }));
  renderizarColunaKanban('kanbanColunaPrejuizo', lista.filter(function (o) { return o.status === STATUS_PREJUIZO_; }));

  if (window.lucide) lucide.createIcons();
}

function renderizarColunaKanban(idContainer, itens) {
  const container = document.getElementById(idContainer);
  if (itens.length === 0) {
    container.innerHTML = '<div class="vazio-relacao">Nada por aqui.</div>';
    return;
  }
  container.innerHTML = agruparPorLote_(itens).map(function (grupo) {
    return grupo.length === 1 ? renderizarCard(grupo[0]) : renderizarCardLote(grupo);
  }).join('');
}

// Ocorrências cobradas juntas numa cobrança consolidada (mesmo grupo_cobranca_id)
// continuam num card só depois de mudar de coluna — sem isso, uma cobrança de 3
// consumos vira 3 cards soltos assim que passa a "Cobrado", dificultando saber
// que aquilo era uma cobrança única. Só agrupa dentro da MESMA coluna: se parte
// do lote já foi paga e o resto ainda está aguardando, cada parte aparece
// corretamente na sua própria coluna (a paga sozinha, o resto ainda junto).
function agruparPorLote_(itens) {
  const posicaoDoLote = {};
  const grupos = [];
  itens.forEach(function (o) {
    if (!o.grupo_cobranca_id) { grupos.push([o]); return; }
    if (posicaoDoLote[o.grupo_cobranca_id] !== undefined) {
      grupos[posicaoDoLote[o.grupo_cobranca_id]].push(o);
      return;
    }
    posicaoDoLote[o.grupo_cobranca_id] = grupos.length;
    grupos.push([o]);
  });
  return grupos;
}

// Card de um lote de cobrança consolidada: mesma pessoa, mesmo status, N ocorrências
// somadas num total só. As ações agem sobre o lote inteiro de uma vez — é exatamente
// o que se perdia quando cada ocorrência passava a se mover sozinha pelo kanban.
// Edição/cancelamento individual de um item específico do lote continua disponível
// pela ocorrência avulsa (ela já passou pela revisão da cobrança consolidada antes
// de chegar aqui); o card de lote é só para as ações de cobrança em si.
function renderizarCardLote(itens) {
  const primeiro = itens[0];
  const nomePessoa = primeiro.pessoa || primeiro.descricao_pessoa || 'Desconhecido(a)';
  const statusClasse = primeiro.status.toLowerCase();
  const totalLote = itens.reduce(function (soma, o) { return soma + o.valor_total; }, 0);
  const ids = itens.map(function (o) { return o.id; });
  const idsJs = "['" + ids.join("','") + "']";

  const linhas = itens.slice()
    .sort(function (a, b) { return (a.data_ocorrencia + a.hora).localeCompare(b.data_ocorrencia + b.hora); })
    .map(function (o) {
      const resumoItens = o.itens.map(function (i) { return i.qtd + 'x ' + i.produto; }).join(', ');
      return '<div class="linha-lote">' +
        '<div class="info-lote">' +
          '<div class="data-lote">' + formatarDataBR(o.data_ocorrencia) + (o.hora ? ' às ' + o.hora : '') + '</div>' +
          '<div class="itens-lote-resumo">' + resumoItens + '</div>' +
        '</div>' +
        '<div class="valor-lote">' + formatarMoeda(o.valor_total) + '</div>' +
      '</div>';
    }).join('');

  let acoesHtml = '';
  if (primeiro.status === 'Cobrado') {
    acoesHtml = '<div class="acoes-card-grid">' +
      '<button class="btn-card-primario sucesso" onclick="marcarLoteComoPago(' + idsJs + ')">' +
        '<i data-lucide="check-circle-2"></i> Confirmar Tudo como Pago' +
      '</button>' +
      '<div class="acoes-card-secundarias">' +
        '<button class="btn-card-sm whatsapp" onclick="recobrarLoteWhatsapp(' + idsJs + ')" title="Recobrar no WhatsApp">' +
          '<i data-lucide="message-circle"></i> Recobrar' +
        '</button>' +
        '<button class="btn-card-sm" onclick="reabrirNotificacaoLote(' + idsJs + ')" title="Ver Notificação PDF">' +
          '<i data-lucide="file-text"></i> Notificação' +
        '</button>' +
        '<button class="btn-card-sm perigo" onclick="marcarLoteComoPrejuizo(' + idsJs + ')" title="Marcar como não pagaram">' +
          '<i data-lucide="x-circle"></i> Não pagaram' +
        '</button>' +
      '</div>' +
    '</div>';
  } else if (primeiro.status === STATUS_PREJUIZO_) {
    acoesHtml = '<div class="acoes-card-grid">' +
      '<button class="btn-card-primario sucesso" onclick="marcarLoteComoPago(' + idsJs + ')">' +
        '<i data-lucide="check-circle-2"></i> Recebi o Pagamento' +
      '</button>' +
      '<div class="acoes-card-secundarias">' +
        '<button class="btn-card-sm whatsapp" onclick="recobrarLoteWhatsapp(' + idsJs + ')">' +
          '<i data-lucide="message-circle"></i> Recobrar' +
        '</button>' +
        '<button class="btn-card-sm" onclick="reabrirLote(' + idsJs + ')">' +
          '<i data-lucide="undo-2"></i> Voltar p/ Cobrado' +
        '</button>' +
      '</div>' +
    '</div>';
  } else if (primeiro.status === 'Pago') {
    acoesHtml = '<div class="pagamento-confirmado-card">' +
      '<i data-lucide="check-check"></i> <span>Lote recebido via Pix (' + itens.length + ' consumos)</span>' +
    '</div>';
  }

  return '<div class="card card-lote card-gestao-moderno">' +
    '<div class="card-topo">' +
      '<div class="info"><strong>' + primeiro.condominio + '</strong> · Lote consolidado</div>' +
      '<div class="pessoa">' + nomePessoa + '</div>' +
      '<div class="whatsapp-card">' + (primeiro.contato_whatsapp ? '<i data-lucide="phone" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:3px"></i>' + primeiro.contato_whatsapp : 'Sem WhatsApp cadastrado') + '</div>' +
      '<div class="valor-linha">' +
        '<span class="valor">' + formatarMoeda(totalLote) + '</span>' +
        '<span class="badge ' + statusClasse + '">' + itens.length + ' cobranças · ' + rotuloStatus_(primeiro.status) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="lista-lote">' + linhas + '</div>' +
    (acoesHtml ? '<div class="acoes-modernas">' + acoesHtml + '</div>' : '') +
  '</div>';
}

function renderizarCard(o) {
  const nomePessoa = o.pessoa || o.descricao_pessoa || 'Desconhecido(a)';
  const resumoItens = o.itens.map(function (i) { return i.qtd + 'x ' + i.produto; }).join(', ');
  const statusClasse = o.status.toLowerCase();
  const rotuloIdentificar = o.pessoa ? 'Editar pessoa' : 'Identificar';

  let acoesHtml = '';

  if (o.status === 'Pendente' || o.status === 'Identificado') {
    acoesHtml = '<div class="acoes-card-grid">' +
      '<button class="btn-card-primario alerta" onclick="abrirCobranca(\'' + o.id + '\')">' +
        '<i data-lucide="zap"></i> Cobrar' +
      '</button>' +
      '<div class="acoes-card-secundarias">' +
        '<button class="btn-card-sm" onclick="abrirIdentificar(\'' + o.id + '\')" title="' + rotuloIdentificar + '">' +
          '<i data-lucide="user"></i> ' + (o.pessoa ? 'Pessoa' : 'Identificar') +
        '</button>' +
        '<button class="btn-card-sm" onclick="abrirEditar(\'' + o.id + '\')" title="Editar itens">' +
          '<i data-lucide="edit-3"></i> Itens' +
        '</button>' +
        '<button class="btn-card-sm perigo" onclick="marcarComoPrejuizo(\'' + o.id + '\')" title="Dar baixa como prejuízo">' +
          '<i data-lucide="trash-2"></i> Baixa' +
        '</button>' +
      '</div>' +
    '</div>';
  } else if (o.status === 'Cobrado') {
    acoesHtml = '<div class="acoes-card-grid">' +
      '<button class="btn-card-primario sucesso" onclick="marcarComoPago(\'' + o.id + '\')">' +
        '<i data-lucide="check-circle-2"></i> Confirmar Pix (Pago)' +
      '</button>' +
      '<div class="acoes-card-secundarias">' +
        '<button class="btn-card-sm whatsapp" onclick="recobrarWhatsapp(\'' + o.id + '\')" title="Enviar mensagem de cobrança">' +
          '<i data-lucide="message-circle"></i> Recobrar' +
        '</button>' +
        '<button class="btn-card-sm" onclick="abrirCobranca(\'' + o.id + '\')" title="Ver PDF / Notificação">' +
          '<i data-lucide="file-text"></i> Notificação' +
        '</button>' +
        '<button class="btn-card-sm" onclick="voltarParaPendente(\'' + o.id + '\')" title="Voltar para pendente">' +
          '<i data-lucide="undo-2"></i> Voltar' +
        '</button>' +
        '<button class="btn-card-sm perigo" onclick="marcarComoPrejuizo(\'' + o.id + '\')" title="Marcar como não pagou">' +
          '<i data-lucide="x-circle"></i> Não pagou' +
        '</button>' +
      '</div>' +
    '</div>';
  } else if (o.status === 'Pago') {
    acoesHtml = '<div class="pagamento-confirmado-card">' +
      '<i data-lucide="check-check"></i> <span>Recebido via Pix ' + (o.data_pagamento ? 'em ' + formatarDataBR(o.data_pagamento) : '') + '</span>' +
    '</div>';
  } else if (o.status === STATUS_PREJUIZO_) {
    acoesHtml = '<div class="acoes-card-grid">' +
      '<button class="btn-card-primario sucesso" onclick="marcarComoPago(\'' + o.id + '\')">' +
        '<i data-lucide="check-circle-2"></i> Recebi o Pagamento' +
      '</button>' +
      '<div class="acoes-card-secundarias">' +
        '<button class="btn-card-sm whatsapp" onclick="recobrarWhatsapp(\'' + o.id + '\')" title="Recobrar no WhatsApp">' +
          '<i data-lucide="message-circle"></i> Recobrar' +
        '</button>' +
        '<button class="btn-card-sm" onclick="reabrirOcorrencia(\'' + o.id + '\')" title="Devolver para Cobrado">' +
          '<i data-lucide="undo-2"></i> ' + (o.data_cobranca ? 'Voltar p/ Cobrado' : 'Voltar p/ Pendente') +
        '</button>' +
      '</div>' +
    '</div>';
  }

  return '<div class="card card-gestao-moderno">' +
    '<div class="card-topo">' +
      '<div class="info"><i data-lucide="clock" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px"></i>' + formatarDataBR(o.data_ocorrencia) + (o.hora ? ' às ' + o.hora : '') + ' · <strong>' + o.condominio + '</strong></div>' +
      '<div class="pessoa">' + nomePessoa + '</div>' +
      '<div class="whatsapp-card">' + (o.contato_whatsapp ? '<i data-lucide="phone" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:3px"></i>' + o.contato_whatsapp : 'Sem WhatsApp cadastrado') + '</div>' +
      '<div class="valor-linha">' +
        '<span class="valor">' + formatarMoeda(o.valor_total) + '</span>' +
        '<span class="badge ' + statusClasse + '">' + rotuloStatus_(o.status) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="itens-resumo"><i data-lucide="shopping-bag" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;color:#64748b"></i>' + resumoItens + '</div>' +
    (o.status === STATUS_PREJUIZO_ && o.data_prejuizo ? '<div class="observacao">Baixado como prejuízo em ' + formatarDataBR(o.data_prejuizo) + '</div>' : '') +
    (o.observacao ? '<div class="observacao">' + o.observacao + '</div>' : '') +
    (acoesHtml ? '<div class="acoes-modernas">' + acoesHtml + '</div>' : '') +
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
  abrirModalCobrancaConsolidada_({ condominio: grupo.condominio, pessoa: grupo.pessoa, contato_whatsapp: grupo.contato_whatsapp }, selecionadas);
}

// Compartilhado entre a cobrança consolidada "de primeira viagem" (a partir dos
// checkboxes na seção Pendente) e o "Reabrir notificação" de um lote que já foi
// cobrado (a partir do card agrupado no kanban) — as duas só diferem em como
// chegam na lista de ocorrências selecionadas.
function abrirModalCobrancaConsolidada_(grupo, selecionadas) {
  ocorrenciasCobrancaConsolidadaAtual = selecionadas;
  grupoCobrancaConsolidadaAtual = grupo;

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
  // Todo mundo que sai daqui junto carrega a mesma etiqueta de lote — é isso que
  // depois faz o kanban devolver o grupo inteiro como um card só, em vez de N
  // ocorrências soltas. Se já é um lote existente sendo reaberto (reabrirNotificacaoLote),
  // reaproveita o mesmo id em vez de fragmentar o grupo em dois.
  const idLote = ocorrenciasCobrancaConsolidadaAtual[0].grupo_cobranca_id || gerarIdLote_();
  try {
    for (const o of ocorrenciasCobrancaConsolidadaAtual) {
      const resposta = await chamarApi({ action: 'atualizarOcorrencia', id: o.id, status: 'Cobrado', data_cobranca: hojeISO(), grupo_cobranca_id: idLote }, 'POST');
      if (!resposta.ok) throw new Error(resposta.erro);
      o.status = 'Cobrado';
      o.data_cobranca = hojeISO();
      o.grupo_cobranca_id = idLote;
    }
    fecharCobrancaConsolidada();
    renderizarTotais();
    renderizarLista();
  } catch (err) {
    banner.className = 'banner erro';
    banner.textContent = 'Falha ao atualizar uma das ocorrências. As já processadas foram salvas — confira a lista e tente novamente para as restantes.';
  }
}

function gerarIdLote_() {
  return 'LT' + Date.now() + Math.floor(Math.random() * 90 + 10);
}

// ===================== AÇÕES EM LOTE (card agrupado do kanban) =====================
// Reabre o mesmo modal de cobrança consolidada, mas a partir de um lote que já
// tinha sido cobrado (em vez de partir dos checkboxes da seção Pendente).
function reabrirNotificacaoLote(ids) {
  const itens = ids.map(buscarOcorrencia);
  const primeiro = itens[0];
  abrirModalCobrancaConsolidada_({ condominio: primeiro.condominio, pessoa: primeiro.pessoa, contato_whatsapp: primeiro.contato_whatsapp }, itens);
}

function recobrarLoteWhatsapp(ids) {
  const itens = ids.map(buscarOcorrencia);
  const primeiro = itens[0];
  const numero = normalizarWhatsapp(primeiro.contato_whatsapp);
  if (!numero) {
    alert('Esta pessoa não tem WhatsApp cadastrado. Edite a pessoa para adicionar o número.');
    return;
  }
  const nomePessoa = primeiro.pessoa || 'Cliente';
  const total = itens.reduce(function (soma, o) { return soma + o.valor_total; }, 0);
  const datas = itens.map(function (o) { return o.data_ocorrencia; }).sort();
  const periodoTexto = datas[0] === datas[datas.length - 1] ? formatarDataBR(datas[0]) : formatarDataBR(datas[0]) + ' a ' + formatarDataBR(datas[datas.length - 1]);
  const mensagem = 'Olá ' + nomePessoa + ', tudo bem? Passando aqui da All in Hall só para lembrar sobre ' + itens.length +
    ' cobranças no valor total de ' + formatarMoeda(total) + ', referentes ao período de ' + periodoTexto +
    ' no ' + primeiro.condominio + ', que ainda constam em aberto. Pode verificar quando puder? Se já pagou, ' +
    'nos envie o comprovante que atualizamos por aqui. Qualquer dúvida estamos à disposição!';
  window.open('https://web.whatsapp.com/send?phone=' + numero + '&text=' + encodeURIComponent(mensagem), '_blank');
}

async function marcarLoteComoPago(ids) {
  if (!confirm('Confirmar recebimento do pagamento de ' + ids.length + ' cobranças deste lote?')) return;
  try {
    for (const id of ids) {
      const resposta = await chamarApi({ action: 'atualizarOcorrencia', id: id, status: 'Pago', data_pagamento: hojeISO(), data_prejuizo: '' }, 'POST');
      if (!resposta.ok) throw new Error(resposta.erro);
      const o = buscarOcorrencia(id);
      o.status = 'Pago'; o.data_pagamento = hojeISO(); o.data_prejuizo = '';
    }
    renderizarTotais();
    renderizarLista();
  } catch (err) {
    alert('Falha ao atualizar uma das cobranças do lote. As já processadas foram salvas — confira a lista e tente novamente para as restantes.');
  }
}

async function marcarLoteComoPrejuizo(ids) {
  const total = ids.map(buscarOcorrencia).reduce(function (soma, o) { return soma + o.valor_total; }, 0);
  if (!confirm('Dar baixa como prejuízo nas ' + ids.length + ' cobranças deste lote? ' + formatarMoeda(total) + ' passam a contar como valor cobrado e não recebido.')) return;
  try {
    for (const id of ids) {
      const resposta = await chamarApi({ action: 'atualizarOcorrencia', id: id, status: STATUS_PREJUIZO_, data_prejuizo: hojeISO() }, 'POST');
      if (!resposta.ok) throw new Error(resposta.erro);
      const o = buscarOcorrencia(id);
      o.status = STATUS_PREJUIZO_; o.data_prejuizo = hojeISO();
    }
    renderizarTotais();
    renderizarLista();
  } catch (err) {
    alert('Falha ao atualizar uma das cobranças do lote. As já processadas foram salvas — confira a lista e tente novamente para as restantes.');
  }
}

// Lote agrupado só existe depois de cobrado (grupo_cobranca_id nasce junto com
// data_cobranca em confirmarCobrancaConsolidada), então desfazer a baixa aqui
// sempre volta para "Cobrado" — nunca para pendente, diferente da versão avulsa.
async function reabrirLote(ids) {
  if (!confirm('Desfazer a baixa de ' + ids.length + ' cobranças e voltar para "Cobrado, aguardando"?')) return;
  try {
    for (const id of ids) {
      const resposta = await chamarApi({ action: 'atualizarOcorrencia', id: id, status: 'Cobrado', data_prejuizo: '' }, 'POST');
      if (!resposta.ok) throw new Error(resposta.erro);
      const o = buscarOcorrencia(id);
      o.status = 'Cobrado'; o.data_prejuizo = '';
    }
    renderizarTotais();
    renderizarLista();
  } catch (err) {
    alert('Falha ao atualizar uma das cobranças do lote. As já processadas foram salvas — confira a lista e tente novamente para as restantes.');
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

// Desfaz a cobrança e devolve a ocorrência pra fila de pendentes — para quando a
// pessoa foi cobrada e levou mais itens antes de pagar, e vale a pena juntar
// tudo numa notificação só em vez de cobrar duas vezes. A notificação/data de
// cobrança antiga deixa de valer; ao editar os itens e cobrar de novo, sai uma
// notificação nova com o total atualizado.
async function voltarParaPendente(id) {
  const o = buscarOcorrencia(id);
  if (!confirm('Voltar esta ocorrência para a fila de pendentes? A notificação já enviada deixa de valer — edite os itens se for o caso e cobre de novo.')) return;
  try {
    const novoStatus = o.pessoa ? 'Identificado' : 'Pendente';
    const resposta = await chamarApi({ action: 'atualizarOcorrencia', id: id, status: novoStatus, data_cobranca: '' }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    o.status = novoStatus; o.data_cobranca = '';
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
