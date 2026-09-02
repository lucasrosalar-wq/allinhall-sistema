/* ============================================================
   ALL IN HALL — conferencia.js
   Lógica da tela de Conferência (calendário, ações do dia,
   registro de ocorrências) — extraído de conferencia.html
   ============================================================ */


// ===================== ESTADO EM MEMÓRIA (sem localStorage/sessionStorage) =====================
let mesAtual = new Date().getMonth() + 1;
let anoAtual = new Date().getFullYear();
let condominioAtual = '';
let dadosCalendario = { ocorrencias: [], diasFechados: [] };
let cacheCalendarioConferencia = {}; // chave 'condominio|ano|mes' -> dados já buscados (evita repetir fetch ao navegar entre meses já vistos)
let diaSelecionado = null; // 'yyyy-mm-dd'
let itensAdicionados = []; // [{ produto, qtd, preco_unit }] da ocorrência em edição
let ultimoPayloadFalhou = null; // guarda a última tentativa de salvar ocorrência para permitir reenvio
let ocorrenciaEmEdicaoId = null; // id da ocorrência sendo corrigida, ou null quando é um registro novo
let saldosFuroCondominio = []; // [{ produto, saldo, valor, dataMaisAntiga }] do condomínio selecionado, ainda em aberto
let produtoFuroEmIdentificacao = null; // { produto, saldo, valor, dataMaisAntiga } do saldo aberto no modal de identificar

// ===================== INICIALIZAÇÃO =====================
function inicializarConferencia() {
  const select = document.getElementById('selectCondominio');
  select.innerHTML = '<option value="">Selecione um condomínio</option>' +
    bootstrap.condominios.map(function (c) {
      return '<option value="' + c.nome_curto + '">' + c.nome_curto + '</option>';
    }).join('');
  condominioAtual = '';

  const datalistProdutos = document.getElementById('listaProdutosDatalist');
  datalistProdutos.innerHTML = bootstrap.produtos.map(function (p) { return '<option value="' + p.nome + '">'; }).join('');

  carregarCalendario();
}

function mudarCondominio() {
  condominioAtual = document.getElementById('selectCondominio').value;

  // Ao trocar de condomínio, o dia que estava selecionado (se algum) pertencia ao
  // condomínio anterior — esconde o painel de ações e a relação em vez de deixá-los
  // mostrando informação desatualizada, até a pessoa tocar num dia de novo.
  diaSelecionado = null;
  document.querySelectorAll('.dia.selecionado').forEach(function (el) { el.classList.remove('selecionado'); });
  document.getElementById('painelAcoesDia').classList.add('oculto');
  document.getElementById('relacaoDia').classList.add('oculto');

  carregarCalendario();
  carregarFurosReposicao();
}

function mudarMes(delta) {
  mesAtual += delta;
  if (mesAtual > 12) { mesAtual = 1; anoAtual++; }
  if (mesAtual < 1) { mesAtual = 12; anoAtual--; }
  carregarCalendario();
}

// ===================== CALENDÁRIO =====================
const NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

async function carregarCalendario() {
  const conteudo = document.getElementById('calendarioConteudo');
  const vazio = document.getElementById('calendarioVazio');

  if (!condominioAtual) {
    conteudo.classList.add('oculto');
    vazio.classList.remove('oculto');
    return;
  }
  conteudo.classList.remove('oculto');
  vazio.classList.add('oculto');

  document.getElementById('tituloMes').textContent = NOMES_MESES[mesAtual - 1] + ' de ' + anoAtual;
  const banner = document.getElementById('bannerCarregamento');
  banner.className = 'banner';
  banner.textContent = '';

  const chaveCache = condominioAtual + '|' + anoAtual + '|' + mesAtual;
  if (cacheCalendarioConferencia[chaveCache]) {
    dadosCalendario = cacheCalendarioConferencia[chaveCache];
    renderizarCalendario();
    return;
  }

  banner.className = 'banner carregando';
  banner.textContent = 'Carregando calendário...';
  try {
    const resposta = await chamarApi({ action: 'calendario', condominio: condominioAtual, ano: anoAtual, mes: mesAtual });
    if (!resposta.ok) throw new Error(resposta.erro);
    dadosCalendario = resposta.dados;
    cacheCalendarioConferencia[chaveCache] = resposta.dados;
    banner.className = 'banner';
    banner.textContent = '';
    renderizarCalendario();
  } catch (err) {
    banner.className = 'banner erro';
    banner.textContent = 'Não foi possível carregar o calendário. Verifique a conexão e tente novamente.';
  }
}

function renderizarCalendario() {
  const grade = document.getElementById('gradeDias');
  // Monta tudo num DocumentFragment (fora da árvore visível) e só encosta na
  // grade de verdade uma vez no final — evita reflow a cada dia do loop.
  const fragmento = document.createDocumentFragment();

  const primeiroDiaSemana = new Date(anoAtual, mesAtual - 1, 1).getDay();
  const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
  const hojeISO = formatarISO(new Date());

  const mapaOcorrencias = {};
  dadosCalendario.ocorrencias.forEach(function (o) {
    if (o.status === 'Cancelado') return;
    if (!mapaOcorrencias[o.data_ocorrencia]) mapaOcorrencias[o.data_ocorrencia] = [];
    mapaOcorrencias[o.data_ocorrencia].push(o);
  });
  const mapaFechados = {};
  dadosCalendario.diasFechados.forEach(function (d) {
    mapaFechados[d.data] = d.status_dia;
  });

  for (let i = 0; i < primeiroDiaSemana; i++) {
    const vazio = document.createElement('div');
    vazio.className = 'dia dia-vazio';
    fragmento.appendChild(vazio);
  }

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataISO = anoAtual + '-' + String(mesAtual).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
    const botao = document.createElement('button');
    botao.className = 'dia';
    botao.textContent = dia;
    botao.dataset.iso = dataISO;

    const ocsDoDia = mapaOcorrencias[dataISO] || [];
    if (ocsDoDia.length > 0) {
      const temAberta = ocsDoDia.some(function (o) { return o.status !== 'Pago'; });
      if (temAberta) {
        botao.classList.add('ocorrencia');
      } else {
        botao.classList.add('ok');
      }
    } else if (mapaFechados[dataISO] === 'Sem operacao') {
      botao.classList.add('semoperacao');
    } else if (mapaFechados[dataISO] === 'OK') {
      botao.classList.add('ok');
    }
    if (dataISO === hojeISO) botao.classList.add('hoje');
    if (dataISO === diaSelecionado) botao.classList.add('selecionado');

    botao.onclick = function () { abrirAcoesDia(dataISO, dia); };
    fragmento.appendChild(botao);
  }

  // Atualiza barra de progresso do mês
  let conferidosCount = 0;
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataISO = anoAtual + '-' + String(mesAtual).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
    const ocsDoDia = mapaOcorrencias[dataISO] || [];
    if (ocsDoDia.length > 0 || mapaFechados[dataISO] === 'OK' || mapaFechados[dataISO] === 'Sem operacao') {
      conferidosCount++;
    }
  }

  const wrapProg = document.getElementById('progressoConferenciaMes');
  if (wrapProg) {
    if (condominioAtual) {
      wrapProg.classList.remove('oculto');
      const pct = Math.round((conferidosCount / diasNoMes) * 100);
      const restantes = diasNoMes - conferidosCount;
      document.getElementById('progressoConferenciaTexto').textContent = conferidosCount + ' de ' + diasNoMes + ' dias conferidos (' + pct + '%)';
      document.getElementById('progressoConferenciaRestante').textContent = restantes === 0 ? 'Mês 100% conferido! 🎉' : restantes + (restantes === 1 ? ' dia restante' : ' dias restantes');
      document.getElementById('progressoConferenciaBarra').style.width = pct + '%';
    } else {
      wrapProg.classList.add('oculto');
    }
  }

  grade.innerHTML = '';
  grade.appendChild(fragmento);
}

function formatarISO(data) {
  return data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0') + '-' + String(data.getDate()).padStart(2, '0');
}

// Navegação rápida pelo teclado (setas ← e →)
document.addEventListener('keydown', function (e) {
  const viewConf = document.getElementById('viewConferencia');
  if (!viewConf || viewConf.classList.contains('oculto')) return;

  const modalAberto = document.querySelector('.modal-overlay:not(.oculto)');
  if (modalAberto) {
    if (e.key === 'Escape') {
      fecharModal(modalAberto.id);
    }
    return;
  }

  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  if (!condominioAtual) return;

  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    navegarDiaTeclado_(e.key === 'ArrowRight' ? 1 : -1);
  }
});

function navegarDiaTeclado_(delta) {
  const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
  let diaAlvo = 1;
  if (diaSelecionado) {
    const partes = diaSelecionado.split('-');
    if (partes.length === 3 && parseInt(partes[0], 10) === anoAtual && parseInt(partes[1], 10) === mesAtual) {
      diaAlvo = parseInt(partes[2], 10) + delta;
    }
  }

  if (diaAlvo < 1) diaAlvo = 1;
  if (diaAlvo > diasNoMes) diaAlvo = diasNoMes;

  const dataISO = anoAtual + '-' + String(mesAtual).padStart(2, '0') + '-' + String(diaAlvo).padStart(2, '0');
  abrirAcoesDia(dataISO, diaAlvo);
}

// ===================== PAINEL: AÇÕES DO DIA =====================
function abrirAcoesDia(dataISO, dia) {
  diaSelecionado = dataISO;

  document.querySelectorAll('.dia.selecionado').forEach(function (el) { el.classList.remove('selecionado'); });
  const botaoAtual = document.querySelector('.dia[data-iso="' + dataISO + '"]');
  if (botaoAtual) botaoAtual.classList.add('selecionado');

  document.getElementById('tituloDiaSelecionado').textContent = 'Dia ' + formatarDataBR(dataISO);
  document.getElementById('condominioDiaSelecionado').textContent = condominioAtual;
  document.getElementById('painelAcoesDia').classList.remove('oculto');
  renderizarRelacaoDia(dataISO);
}

function ocorrenciaAtiva_(o) { return o.status === 'Pendente' || o.status === 'Identificado'; }

// Mostra, abaixo do calendário, a relação de ocorrências já registradas no dia tocado.
// Mostra o dia inteiro, ativas e já resolvidas — antes, uma ocorrência cobrada
// (ou paga/prejuízo) sumia daqui na hora e só dava pra acompanhar pela Gestão;
// quem usa o dia a dia acabava anotando à parte pra não perder o histórico. As
// ativas vêm primeiro (é o que ainda precisa de ação), o resto é referência.
function renderizarRelacaoDia(dataISO) {
  const container = document.getElementById('relacaoDia');
  const titulo = document.getElementById('tituloRelacaoDia');
  const lista = document.getElementById('listaRelacaoDia');

  titulo.textContent = 'Ocorrências em ' + formatarDataBR(dataISO);

  const ocorrenciasDoDia = dadosCalendario.ocorrencias.filter(function (o) { return o.data_ocorrencia === dataISO; });

  if (ocorrenciasDoDia.length === 0) {
    lista.innerHTML = '<div class="vazio-relacao">Nenhuma ocorrência registrada neste dia.</div>';
    container.classList.remove('oculto');
    return;
  }

  const ocorrenciasOrdenadas = ocorrenciasDoDia.slice().sort(function (a, b) {
    const ativaA = ocorrenciaAtiva_(a) ? 0 : 1;
    const ativaB = ocorrenciaAtiva_(b) ? 0 : 1;
    if (ativaA !== ativaB) return ativaA - ativaB;
    return (a.hora || '').localeCompare(b.hora || '');
  });

  lista.innerHTML = ocorrenciasOrdenadas.map(function (o) {
    const nomePessoa = o.pessoa || o.descricao_pessoa || 'Desconhecido(a)';
    const resumoItens = o.itens.map(function (item) { return item.qtd + 'x ' + item.produto; }).join(', ');
    const resolvida = !ocorrenciaAtiva_(o);

    // Mesma regra da Gestão: itens dão pra corrigir enquanto não pagou (evita
    // editar algo que já foi cobrado/pago com outro valor); excluir de vez só
    // antes de qualquer cobrança — depois disso, "Cancelar" é o caminho, e isso
    // já é feito pela Gestão, não por aqui.
    let acoes = '';
    if (o.status !== 'Cancelado' && o.status !== 'Pago') {
      acoes += '<button type="button" onclick="editarOcorrenciaDoDia(\'' + o.id + '\')">Editar</button>';
    }
    if (ocorrenciaAtiva_(o)) {
      acoes += '<button type="button" class="btn-excluir-relacao" onclick="excluirOcorrenciaDoDia(\'' + o.id + '\')">Excluir</button>';
    }

    return '<div class="card-relacao' + (resolvida ? ' resolvida' : '') + '">' +
      '<div class="topo">' +
        '<div><div class="pessoa">' + nomePessoa + '</div><div class="hora">' + (o.hora || '—') + '</div></div>' +
        '<div class="valor">' + formatarMoeda(o.valor_total) + '</div>' +
      '</div>' +
      '<div class="itens">' + resumoItens + '</div>' +
      '<span class="badge-status ' + o.status.toLowerCase() + '">' + rotuloStatus_(o.status) + '</span>' +
      (acoes ? '<div class="acoes-relacao">' + acoes + '</div>' : '') +
    '</div>';
  }).join('');

  container.classList.remove('oculto');
}

// ===================== SALDO DE FUROS DE REPOSIÇÃO =====================
// Cada furo lançado na Reposição (ex: "3 Cocas") entra aqui como saldo em
// aberto daquele produto, no condomínio — somando com outros lançamentos do
// mesmo produto que ainda não tenham sido totalmente identificados. A Bárbara
// vai abatendo esse saldo aos poucos, conforme reconhece gente na câmera
// (1 unidade hoje, mais 2 amanhã, por exemplo), até zerar — não precisa
// resolver o furo inteiro de uma vez. Cada abatimento vira uma Ocorrência de
// verdade (mesmo fluxo que a Gestão já sabe cobrar); se um lançamento antigo
// não for suficiente pra cobrir a quantidade pedida, o backend consome também
// novo (FIFO) — por isso o saldo mostrado aqui pode somar mais de um
// lançamento sem a Bárbara precisar saber qual é qual.
function calcularSaldosFuro_(reposicoes, ocorrencias, condominio) {
  const jaIdentificado = {};
  ocorrencias.forEach(function (o) {
    if (!o.furo_reposicao_id || o.status === 'Cancelado') return;
    if (!jaIdentificado[o.furo_reposicao_id]) jaIdentificado[o.furo_reposicao_id] = {};
    (o.itens || []).forEach(function (item) {
      const qtd = Number(item.qtd) || 0;
      jaIdentificado[o.furo_reposicao_id][item.produto] = (jaIdentificado[o.furo_reposicao_id][item.produto] || 0) + qtd;
    });
  });

  const porProduto = {};
  reposicoes
    .filter(function (r) { return r.condominio === condominio && r.status !== 'Identificado'; })
    .forEach(function (r) {
      const consumido = (jaIdentificado[r.id] && jaIdentificado[r.id][r.produto]) || 0;
      const restante = (Number(r.quantidade) || 0) - consumido;
      if (restante <= 0) return;
      if (!porProduto[r.produto]) porProduto[r.produto] = { produto: r.produto, saldo: 0, valor: 0, dataMaisAntiga: r.data, furoId: r.id };
      const entrada = porProduto[r.produto];
      entrada.saldo += restante;
      entrada.valor += restante * (Number(r.preco_unit) || 0);
      if (String(r.data) < String(entrada.dataMaisAntiga)) {
        entrada.dataMaisAntiga = r.data;
        entrada.furoId = r.id;
      }
    });

  return Object.keys(porProduto).map(function (produto) { return porProduto[produto]; })
    .sort(function (a, b) { return String(a.dataMaisAntiga).localeCompare(String(a.dataMaisAntiga)); });
}

let sugestoesConciliacao = [];

function detectarConciliacoesPossiveis(reposicoes, ocorrencias, condominio) {
  if (!condominio) return [];

  const reposPendentes = reposicoes.filter(function (r) {
    return r.condominio === condominio && r.status !== 'Identificado' && Number(r.quantidade) > 0 && r.produto !== 'Reposição realizada (Sem furos)';
  });

  if (reposPendentes.length === 0) return [];

  const ocorrenciasValidas = ocorrencias.filter(function (o) {
    return o.condominio === condominio && o.status !== 'Cancelado';
  });

  const ocorrenciasUsadas = new Set();
  ocorrenciasValidas.forEach(function (o) {
    if (o.furo_reposicao_id) ocorrenciasUsadas.add(o.id);
  });

  const sugestoes = [];

  reposPendentes.forEach(function (r) {
    const qtdFuro = Number(r.quantidade) || 0;
    const prodNome = (r.produto || '').trim().toLowerCase();
    const compativeis = [];
    let qtdAcumulada = 0;

    for (let i = 0; i < ocorrenciasValidas.length; i++) {
      const oc = ocorrenciasValidas[i];
      if (ocorrenciasUsadas.has(oc.id)) continue;

      (oc.itens || []).forEach(function (item) {
        if (!item) return;
        const itemNome = (item.produto || '').trim().toLowerCase();
        if (itemNome === prodNome || itemNome.includes(prodNome) || prodNome.includes(itemNome)) {
          compativeis.push({
            ocorrenciaId: oc.id,
            data: oc.data_ocorrencia,
            hora: oc.hora,
            pessoa: oc.pessoa || oc.descricao_pessoa || 'Identificado',
            contato_whatsapp: oc.contato_whatsapp || '',
            status: oc.status || 'Pendente',
            qtd: Number(item.qtd) || 1,
            preco_unit: Number(item.preco_unit) || Number(r.preco_unit) || 0
          });
          qtdAcumulada += Number(item.qtd) || 1;
        }
      });

      if (qtdAcumulada >= qtdFuro) break;
    }

    if (compativeis.length > 0) {
      sugestoes.push({
        furoId: r.id,
        furoData: r.data,
        produto: r.produto,
        qtdFuro: qtdFuro,
        precoUnit: Number(r.preco_unit) || 0,
        ocorrenciasCompativeis: compativeis
      });
      compativeis.forEach(function (c) { ocorrenciasUsadas.add(c.ocorrenciaId); });
    }
  });

  return sugestoes;
}

async function carregarFurosReposicao() {
  const container = document.getElementById('furosPendentes');
  if (!condominioAtual) {
    container.classList.add('oculto');
    return;
  }
  try {
    const [respostaReposicoes, respostaOcorrencias] = await Promise.all([
      chamarApi({ action: 'reposicoes' }),
      chamarApi({ action: 'ocorrencias' })
    ]);
    if (!respostaReposicoes.ok) throw new Error(respostaReposicoes.erro);
    if (!respostaOcorrencias.ok) throw new Error(respostaOcorrencias.erro);

    saldosFuroCondominio = calcularSaldosFuro_(respostaReposicoes.dados, respostaOcorrencias.dados, condominioAtual);
    sugestoesConciliacao = detectarConciliacoesPossiveis(respostaReposicoes.dados, respostaOcorrencias.dados, condominioAtual);
    
    renderizarBannerConciliacao_();
    renderizarFurosReposicao();
  } catch (err) {
    container.classList.remove('oculto');
    document.getElementById('listaFurosPendentes').innerHTML = '<div class="vazio-relacao">Não foi possível carregar os furos de reposição.</div>';
  }
}

function renderizarBannerConciliacao_() {
  const banner = document.getElementById('bannerConciliacaoInteligente');
  if (!banner) return;

  if (sugestoesConciliacao.length === 0) {
    banner.classList.add('oculto');
    banner.innerHTML = '';
    return;
  }

  banner.innerHTML = '<div class="banner-conciliacao-inteligente">' +
    '<div class="banner-conciliacao-topo">' +
      '<div class="banner-conciliacao-titulo">' +
        '<i data-lucide="zap"></i>' +
        '<strong>Conciliação Inteligente</strong>' +
      '</div>' +
      '<span class="badge-conciliacao-contador">' + sugestoesConciliacao.length + ' furo(s) com correspondência</span>' +
    '</div>' +
    '<p class="banner-conciliacao-desc">' +
      'Detectamos que os seguintes produtos já foram identificados nas câmeras ou pagos por moradores:' +
    '</p>' +
    '<div class="lista-sugestoes-conciliacao">' +
      sugestoesConciliacao.map(function (s) {
        return '<div class="item-sugestao-conciliacao-card">' +
          '<div class="sugestao-card-cabecalho">' +
            '<div class="sugestao-card-prod">' +
              '<span class="sugestao-card-icone">📦</span>' +
              '<strong>' + s.qtdFuro + 'x ' + s.produto + '</strong>' +
            '</div>' +
            '<span class="sugestao-card-data">Furo de ' + formatarDataBR(s.furoData) + '</span>' +
          '</div>' +
          '<div class="sugestao-card-matches">' +
            s.ocorrenciasCompativeis.map(function (o) {
              const badgeClass = o.status === 'Pago' ? 'pago' : (o.status === 'Cobrado' ? 'cobrado' : 'pendente');
              return '<div class="sugestao-match-linha">' +
                '<span class="sugestao-match-seta">➔</span>' +
                '<span class="badge-status ' + badgeClass + '">' + o.status + '</span>' +
                '<span class="sugestao-match-qtd">' + o.qtd + ' un.</span>' +
                '<span class="sugestao-match-pessoa">' + o.pessoa + ' <span class="sugestao-match-data">(' + formatarDataBR(o.data) + ')</span></span>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>' +
    '<div class="banner-conciliacao-acoes">' +
      '<button type="button" class="btn-conciliar-auto" id="btnConciliarAuto" onclick="aplicarConciliacaoAutomatica()">' +
        '<i data-lucide="check-check"></i> Conciliar e Baixar Automaticamente (' + sugestoesConciliacao.length + ' furos)' +
      '</button>' +
    '</div>' +
  '</div>';

  banner.classList.remove('oculto');
  if (window.lucide) lucide.createIcons();
}

async function aplicarConciliacaoAutomatica() {
  if (sugestoesConciliacao.length === 0) return;
  const botao = document.getElementById('btnConciliarAuto');
  if (botao) {
    botao.disabled = true;
    botao.innerHTML = 'Conciliando...';
  }

  try {
    const pares = [];
    sugestoesConciliacao.forEach(function (s) {
      const pessoaNome = s.ocorrenciasCompativeis.map(function (o) { return o.pessoa; }).filter(Boolean).join(', ') || 'Identificado em Ocorrência';
      const whatsapp = s.ocorrenciasCompativeis.map(function (o) { return o.contato_whatsapp; }).filter(Boolean)[0] || '';
      const primeiraOc = s.ocorrenciasCompativeis[0] || {};

      s.ocorrenciasCompativeis.forEach(function (oc) {
        pares.push({
          furo_id: s.furoId,
          ocorrencia_id: oc.ocorrenciaId,
          pessoa: pessoaNome,
          contato_whatsapp: whatsapp,
          data: primeiraOc.data || '',
          hora: primeiraOc.hora || ''
        });
      });
    });

    const resposta = await chamarApi({
      action: 'vincularConciliacaoAutomatica',
      pares: pares
    }, 'POST');

    if (!resposta.ok) throw new Error(resposta.erro || 'Falha ao conciliar.');

    alert('Conciliação realizada com sucesso! ' + sugestoesConciliacao.length + ' furos foram conciliados e baixados.');
    sugestoesConciliacao = [];
    await carregarFurosReposicao();
    await carregarCalendario();
    if (diaSelecionado) renderizarRelacaoDia(diaSelecionado);
  } catch (err) {
    alert('Erro ao conciliar: ' + (err.message || err));
  } finally {
    if (botao) botao.disabled = false;
  }
}

function renderizarFurosReposicao() {
  const container = document.getElementById('furosPendentes');
  const lista = document.getElementById('listaFurosPendentes');

  if (saldosFuroCondominio.length === 0 && sugestoesConciliacao.length === 0) {
    container.classList.add('oculto');
    return;
  }

  const linhas = saldosFuroCondominio.map(function (s, indice) {
    const rotuloSaldo = s.saldo + (s.saldo === 1 ? ' un.' : ' un.');
    return '<tr>' +
      '<td>' +
        '<div class="produto-furo">' + s.produto + '</div>' +
        '<div class="desde-furo">desde ' + formatarDataBR(s.dataMaisAntiga) + '</div>' +
        '<div class="resumo-furo-compacto">' + rotuloSaldo + ' · ' + formatarMoeda(s.valor) + '</div>' +
      '</td>' +
      '<td class="col-numerica col-larga">' + rotuloSaldo + '</td>' +
      '<td class="col-numerica col-larga">' + formatarMoeda(s.valor) + '</td>' +
      '<td><button type="button" onclick="abrirIdentificarFuro(' + indice + ')">Identificar</button></td>' +
    '</tr>';
  }).join('');

  lista.innerHTML = '<div class="tabela-scroll"><table class="tabela-furos">' +
    '<thead><tr><th>Produto</th><th class="col-numerica col-larga">Em aberto</th><th class="col-numerica col-larga">Valor</th><th></th></tr></thead>' +
    '<tbody>' + (linhas || '<tr><td colspan="4" class="centro" style="padding:16px;color:var(--texto-2)">Nenhum furo restante.</td></tr>') + '</tbody>' +
  '</table></div>';

  container.classList.remove('oculto');
}

function abrirIdentificarFuro(indice) {
  const s = saldosFuroCondominio[indice];
  if (!s) return;

  produtoFuroEmIdentificacao = s;
  document.getElementById('infoFuroReposicao').textContent =
    condominioAtual + ' — ' + s.produto + ' — ' + s.saldo + (s.saldo === 1 ? ' unidade' : ' unidades') + ' em aberto (' + formatarMoeda(s.valor) + ')';
  document.getElementById('inputQtdFuro').value = 1;
  document.getElementById('inputQtdFuro').max = s.saldo;
  document.getElementById('inputPessoaFuro').value = '';
  document.getElementById('inputWhatsappFuro').value = '';
  if (document.getElementById('inputDescricaoPessoaFuro')) {
    document.getElementById('inputDescricaoPessoaFuro').value = '';
  }
  document.getElementById('inputDataInfracaoFuro').value = formatarISO(new Date());
  document.getElementById('inputHoraInfracaoFuro').value = '';
  document.getElementById('bannerIdentificarFuro').className = 'banner';
  document.getElementById('bannerIdentificarFuro').textContent = '';
  abrirModal('overlayIdentificarFuro');
}

async function salvarIdentificacaoFuro() {
  const banner = document.getElementById('bannerIdentificarFuro');
  const pessoa = document.getElementById('inputPessoaFuro').value.trim();
  const quantidade = Math.max(1, parseInt(document.getElementById('inputQtdFuro').value, 10) || 0);
  const inputDesc = document.getElementById('inputDescricaoPessoaFuro');
  const descricaoPessoa = inputDesc ? inputDesc.value.trim() : '';

  if (!produtoFuroEmIdentificacao || quantidade > produtoFuroEmIdentificacao.saldo) {
    banner.className = 'banner erro';
    banner.textContent = 'Quantidade maior que o saldo em aberto.';
    return;
  }

  try {
    const resposta = await chamarApi({
      action: 'identificarFuroReposicao',
      condominio: condominioAtual,
      produto: produtoFuroEmIdentificacao.produto,
      quantidade: quantidade,
      pessoa: pessoa,
      descricao_pessoa: descricaoPessoa,
      contato_whatsapp: document.getElementById('inputWhatsappFuro').value.trim(),
      data_infracao: document.getElementById('inputDataInfracaoFuro').value,
      hora_infracao: document.getElementById('inputHoraInfracaoFuro').value
    }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    fecharModal('overlayIdentificarFuro');
    await carregarFurosReposicao();
    await carregarCalendario();
    if (diaSelecionado) renderizarRelacaoDia(diaSelecionado);
  } catch (err) {
    banner.className = 'banner erro';
    banner.textContent = 'Falha ao salvar. Verifique a conexão e tente novamente.';
  }
}

async function fecharDiaComoOk() {
  await enviarFechamentoDia('OK');
}

async function marcarSemOperacao() {
  await enviarFechamentoDia('Sem operacao');
}

async function enviarFechamentoDia(status) {
  try {
    const resposta = await chamarApi({ action: 'fecharDia', condominio: condominioAtual, data: diaSelecionado, status_dia: status }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    await carregarCalendario();
    renderizarRelacaoDia(diaSelecionado);
  } catch (err) {
    alert('Não foi possível salvar. Verifique a conexão e tente novamente.');
  }
}

// Desfaz uma marcação errada de "Fechar dia (OK)" / "Marcar sem operação" — o dia
// volta a ficar "Não conferido". Não mexe em ocorrências já registradas nesse dia.
async function limparDiaSelecionado() {
  if (!confirm('Limpar a marcação deste dia? Ele volta a aparecer como "Não conferido".')) return;
  try {
    const resposta = await chamarApi({ action: 'limparDia', condominio: condominioAtual, data: diaSelecionado }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    await carregarCalendario();
    renderizarRelacaoDia(diaSelecionado);
  } catch (err) {
    alert('Não foi possível limpar a marcação. Verifique a conexão e tente novamente.');
  }
}

// ===================== MODAL: FORMULÁRIO DE OCORRÊNCIA =====================
// Sem argumento: registra uma ocorrência nova. Com "ocorrencia": reabre para corrigir uma já salva.
function abrirFormularioOcorrencia(ocorrencia) {
  ocorrenciaEmEdicaoId = ocorrencia ? ocorrencia.id : null;
  document.getElementById('tituloFormularioOcorrencia').textContent = ocorrencia ? 'Editar ocorrência' : 'Registrar ocorrência';
  document.getElementById('subtituloOcorrencia').textContent = condominioAtual + ' — ' + formatarDataBR(diaSelecionado);

  if (ocorrencia) {
    document.getElementById('inputDataOcorrencia').value = ocorrencia.data_ocorrencia || diaSelecionado;
    document.getElementById('inputHora').value = ocorrencia.hora || '';
    document.getElementById('inputPessoaNome').value = ocorrencia.pessoa || '';
    document.getElementById('inputPessoaWhatsapp').value = ocorrencia.contato_whatsapp || '';
    document.getElementById('inputDescricaoPessoa').value = ocorrencia.descricao_pessoa || '';
    document.getElementById('inputObservacao').value = ocorrencia.observacao || '';
    itensAdicionados = ocorrencia.itens.map(function (item) { return Object.assign({}, item); });
  } else {
    const agora = new Date();
    document.getElementById('inputDataOcorrencia').value = diaSelecionado;
    document.getElementById('inputHora').value = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
    document.getElementById('inputPessoaNome').value = '';
    document.getElementById('inputPessoaWhatsapp').value = '';
    document.getElementById('inputDescricaoPessoa').value = '';
    document.getElementById('inputObservacao').value = '';
    itensAdicionados = [];
  }

  document.getElementById('inputProdutoNovo').value = '';
  document.getElementById('inputQtdNovo').value = '1';
  document.getElementById('bannerOcorrencia').className = 'banner';
  document.getElementById('bannerOcorrencia').textContent = '';
  renderizarItensAdicionados();
  // Sugestão só faz sentido pra ocorrência nova — quem está editando uma já
  // registrada não está "reconhecendo alguém na câmera agora".
  renderizarSugestoesFuro_(!ocorrencia);
  abrirModal('overlayOcorrencia');
}

// Lembra, na hora de registrar, que já existe furo de reposição em aberto
// pra esse condomínio — ela reconheceu alguém na câmera, mas em vez de digitar
// o produto do zero, um clique já leva direto pro fluxo que sabe abater do
// saldo (com FIFO entre lançamentos e tudo mais), em vez de criar uma
// ocorrência solta que não bate com o furo lançado na Reposição.
function renderizarSugestoesFuro_(mostrar) {
  const container = document.getElementById('sugestoesFuroOcorrencia');
  if (!container) return;
  if (!mostrar || saldosFuroCondominio.length === 0) {
    container.classList.add('oculto');
    container.innerHTML = '';
    return;
  }

  const chipsHtml = saldosFuroCondominio.map(function (s, indice) {
    const jaAdicionado = itensAdicionados
      .filter(function (i) { return i.produto === s.produto; })
      .reduce(function (soma, i) { return soma + (Number(i.qtd) || 0); }, 0);
    const saldoRestante = Math.max(0, s.saldo - jaAdicionado);

    if (saldoRestante === 0) {
      return '<button type="button" class="chip-sugestao-furo chip-adicionado" disabled title="Item já adicionado aos itens retirados">' +
        s.produto + ' <span class="badge-adicionado">✓ adicionado</span>' +
      '</button>';
    }

    return '<button type="button" class="chip-sugestao-furo" onclick="usarFuroNaOcorrencia_(' + indice + ')" title="Clique para adicionar à ocorrência">' +
      s.produto + ' <span>' + saldoRestante + (saldoRestante === 1 ? ' un.' : ' un.') + '</span>' +
    '</button>';
  }).join('');

  container.innerHTML = '<div class="sugestoes-furo-titulo">Tem furo de reposição em aberto — é um desses?</div>' +
    '<div class="sugestoes-furo-lista">' + chipsHtml + '</div>';
  container.classList.remove('oculto');
}

function usarFuroNaOcorrencia_(indice) {
  const s = saldosFuroCondominio[indice];
  if (!s) return;

  const jaAdicionado = itensAdicionados
    .filter(function (i) { return i.produto === s.produto; })
    .reduce(function (soma, i) { return soma + (Number(i.qtd) || 0); }, 0);

  const saldoDisponivel = s.saldo - jaAdicionado;
  if (saldoDisponivel <= 0) return;

  const produtoSeed = encontrarProduto_(s.produto);
  const precoUnit = (s.saldo > 0 && s.valor > 0) ? (s.valor / s.saldo) : (produtoSeed ? produtoSeed.preco : 0);
  const qtdParaAdicionar = 1;

  const existente = itensAdicionados.find(function (i) { return i.produto === s.produto; });
  if (existente) {
    existente.qtd += qtdParaAdicionar;
  } else {
    itensAdicionados.push({
      produto: s.produto,
      qtd: qtdParaAdicionar,
      preco_unit: precoUnit,
      furo_reposicao_id: s.furoId || null
    });
  }

  renderizarItensAdicionados();
}

function editarOcorrenciaDoDia(id) {
  const ocorrencia = dadosCalendario.ocorrencias.find(function (o) { return o.id === id; });
  if (ocorrencia) abrirFormularioOcorrencia(ocorrencia);
}

async function excluirOcorrenciaDoDia(id) {
  if (!confirm('Excluir esta ocorrência? Essa ação não pode ser desfeita.')) return;
  try {
    const resposta = await chamarApi({ action: 'excluirOcorrencia', id: id }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    await carregarCalendario();
    renderizarRelacaoDia(diaSelecionado);
  } catch (err) {
    alert('Não foi possível excluir. Verifique a conexão e tente novamente.');
  }
}

function adicionarItemNaLista() {
  const inputNome = document.getElementById('inputProdutoNovo');
  const inputQtd = document.getElementById('inputQtdNovo');
  const nomeDigitado = inputNome.value.trim();

  const produto = encontrarProduto_(nomeDigitado);
  if (!produto) {
    alert('Produto não encontrado. Digite parte do nome e escolha uma das opções sugeridas.');
    return;
  }
  const qtd = Math.max(1, parseInt(inputQtd.value, 10) || 1);

  const existente = itensAdicionados.find(function (i) { return i.produto === produto.nome; });
  if (existente) existente.qtd += qtd;
  else itensAdicionados.push({ produto: produto.nome, qtd: qtd, preco_unit: produto.preco });

  inputNome.value = '';
  inputQtd.value = '1';
  inputNome.focus();
  renderizarItensAdicionados();
}

function removerItemDaLista(indice) {
  itensAdicionados.splice(indice, 1);
  renderizarItensAdicionados();
}

function renderizarItensAdicionados() {
  const lista = document.getElementById('listaItensAdicionados');
  lista.innerHTML = itensAdicionados.map(function (item, indice) {
    const subtotal = item.qtd * item.preco_unit;
    return '<div class="item-adicionado">' +
      '<div class="info">' + item.produto + '<div class="qtd-preco">' + item.qtd + ' x ' + formatarMoeda(item.preco_unit) + '</div></div>' +
      '<div class="direita">' +
        '<span class="subtotal">' + formatarMoeda(subtotal) + '</span>' +
        '<button type="button" class="btn-remover" onclick="removerItemDaLista(' + indice + ')">×</button>' +
      '</div>' +
    '</div>';
  }).join('') || '<div class="lista-vazia-itens">Nenhum item adicionado ainda.</div>';

  atualizarTotalOcorrencia();
  renderizarSugestoesFuro_(!ocorrenciaEmEdicaoId);
}

function atualizarTotalOcorrencia() {
  const total = itensAdicionados.reduce(function (soma, item) { return soma + item.qtd * item.preco_unit; }, 0);
  document.getElementById('totalOcorrencia').textContent = formatarMoeda(total);
  return total;
}

async function salvarOcorrencia() {
  const itens = itensAdicionados;
  if (itens.length === 0) {
    mostrarBannerOcorrencia('erro', 'Adicione ao menos um item retirado.');
    return;
  }

  const camposComuns = {
    data_ocorrencia: document.getElementById('inputDataOcorrencia').value || diaSelecionado,
    hora: document.getElementById('inputHora').value,
    pessoa: document.getElementById('inputPessoaNome').value.trim(),
    contato_whatsapp: document.getElementById('inputPessoaWhatsapp').value.trim(),
    descricao_pessoa: document.getElementById('inputDescricaoPessoa').value,
    itens: itens,
    valor_total: atualizarTotalOcorrencia(),
    observacao: document.getElementById('inputObservacao').value
  };

  const payload = ocorrenciaEmEdicaoId
    ? Object.assign({ action: 'atualizarOcorrencia', id: ocorrenciaEmEdicaoId }, camposComuns)
    : Object.assign({ action: 'criarOcorrencia', condominio: condominioAtual }, camposComuns);

  await enviarOcorrencia(payload);
}

async function enviarOcorrencia(payload) {
  const botao = document.getElementById('botaoSalvarOcorrencia');
  botao.disabled = true;
  botao.classList.add('carregando');
  botao.textContent = 'Salvando...';
  try {
    const resposta = await chamarApi(payload, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro || 'Erro ao salvar.');
    ultimoPayloadFalhou = null;
    mostrarBannerOcorrencia('sucesso', 'Ocorrência salva com sucesso!');
    setTimeout(async function () {
      fecharModal('overlayOcorrencia');
      await carregarCalendario();
      await carregarFurosReposicao();
      renderizarRelacaoDia(diaSelecionado);
    }, 700);
  } catch (err) {
    ultimoPayloadFalhou = payload;
    mostrarBannerOcorrencia('erro', 'Falha ao salvar. Seus dados não foram perdidos — toque em "Salvar ocorrência" para tentar novamente.');
  } finally {
    botao.disabled = false;
    botao.classList.remove('carregando');
    botao.textContent = 'Salvar ocorrência';
  }
}

function mostrarBannerOcorrencia(tipo, mensagem) {
  const banner = document.getElementById('bannerOcorrencia');
  banner.className = 'banner ' + tipo;
  banner.textContent = mensagem;
}

// Se uma tentativa anterior falhou, reenviar o mesmo payload em vez de remontar o formulário.
async function salvarOcorrenciaOuReenviar() {
  if (ultimoPayloadFalhou) {
    await enviarOcorrencia(ultimoPayloadFalhou);
  } else {
    await salvarOcorrencia();
  }
}
document.getElementById('botaoSalvarOcorrencia').onclick = salvarOcorrenciaOuReenviar;
