/* ============================================================
   ALL IN HALL — shared.js
   Estado e funções compartilhadas entre Conferência e Gestão
   (extraído de conferencia.html / gestao.html — mesma API e
   mesmo comportamento que já funcionava nas duas páginas)
   ============================================================ */

const URL_WEBAPP = 'https://script.google.com/macros/s/AKfycbz0RF9foxslKzWANlDHV5pbDv8lgxmgPxPzlEXBbPmFUZeTYDeH8WlX1RcpFQLiFK0m/exec';

// ===================== ESTADO EM MEMÓRIA (sem localStorage/sessionStorage) =====================
let pin = '';
let bootstrap = { produtos: [], condominios: [], pessoas: [] };

// ===================== CHAMADAS À API =====================
async function chamarApi(params, metodo) {
  metodo = metodo || 'GET';
  const comPin = Object.assign({ pin: pin }, params);

  if (metodo === 'GET') {
    const query = new URLSearchParams(comPin).toString();
    const resp = await fetch(URL_WEBAPP + '?' + query, { method: 'GET', redirect: 'follow' });
    return resp.json();
  }

  // POST: usa text/plain para evitar preflight CORS (Apps Script não trata OPTIONS).
  const resp = await fetch(URL_WEBAPP, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(comPin)
  });
  const resultado = await resp.json();
  // Qualquer escrita (criar/editar/excluir ocorrência, fechar/limpar dia, identificar,
  // cobrar, pagar, cancelar etc.) pode mudar o que os calendários das duas telas
  // mostram — invalida os dois caches pra não exibir dado velho em nenhuma delas.
  if (resultado.ok) {
    cacheCalendarioConferencia = {};
    cacheCalendarioGestao = {};
  }
  return resultado;
}

// ===================== PIN =====================
async function validarPin() {
  const valor = document.getElementById('inputPin').value.trim();
  if (!valor) return;
  document.getElementById('erroPin').textContent = '';
  pin = valor;
  try {
    const resposta = await chamarApi({ action: 'bootstrap' });
    if (!resposta.ok) {
      document.getElementById('erroPin').textContent = resposta.erro || 'PIN inválido.';
      pin = '';
      return;
    }
    bootstrap = resposta.dados;
    document.getElementById('telaPin').classList.add('oculto');
    document.getElementById('app').classList.remove('oculto');
    irParaView(location.hash.slice(1) || 'conferencia');
  } catch (err) {
    document.getElementById('erroPin').textContent = 'Falha de conexão. Verifique a internet e tente novamente.';
  }
}

// ===================== NAVEGAÇÃO ENTRE VIEWS (sidebar, sem reload) =====================
const VIEWS_VALIDAS = ['conferencia', 'gestao', 'reposicao'];
let viewsIniciadas = {};
const TITULOS_VIEW_ = {
  conferencia: 'Conferência — All in Hall',
  gestao: 'Gestão de Ocorrências — All in Hall',
  reposicao: 'Reposição — All in Hall'
};
const INICIALIZADORES_VIEW_ = {
  conferencia: function () { inicializarConferencia(); },
  gestao: function () { inicializarGestao(); },
  reposicao: function () { inicializarReposicao(); }
};
// Rodada a cada revisita (não só na primeira vez) — recarrega só os dados,
// sem mexer em seleção de condomínio/filtros já escolhidos pela pessoa. Existe
// porque uma ação numa view pode criar dado visível em outra (ex: identificar
// um furo de reposição na Conferência cria uma Ocorrência que só aparece na
// Gestão depois de recarregada).
const ATUALIZADORES_VIEW_ = {
  conferencia: function () { carregarCalendario(); carregarFurosReposicao(); },
  gestao: function () { carregarOcorrencias(); carregarMiniCalendario(); },
  reposicao: function () { carregarReposicoes(); }
};

function irParaView(nome) {
  if (VIEWS_VALIDAS.indexOf(nome) === -1) nome = 'conferencia';

  document.querySelectorAll('.nav-item[data-view]').forEach(function (a) {
    a.classList.toggle('ativo', a.dataset.view === nome);
  });
  document.getElementById('viewConferencia').classList.toggle('oculto', nome !== 'conferencia');
  document.getElementById('viewGestao').classList.toggle('oculto', nome !== 'gestao');
  document.getElementById('viewReposicao').classList.toggle('oculto', nome !== 'reposicao');
  const infoConferencia = document.getElementById('sidebarInfoConferencia');
  if (infoConferencia) infoConferencia.classList.toggle('oculto', nome !== 'conferencia');

  document.title = TITULOS_VIEW_[nome];

  if (!viewsIniciadas[nome]) {
    viewsIniciadas[nome] = true;
    INICIALIZADORES_VIEW_[nome]();
  } else {
    ATUALIZADORES_VIEW_[nome]();
  }

  // Só fecha a gaveta no mobile — no desktop a sidebar é persistente (recolher ali é
  // uma escolha manual da pessoa, não algo pra acontecer sozinho a cada navegação).
  if (!window.matchMedia('(min-width: 1024px)').matches) toggleSidebar(false);
  if (location.hash.slice(1) !== nome) location.hash = nome;
}

// ===================== MODAIS =====================
function abrirModal(id) { document.getElementById(id).classList.add('aberto'); }
function fecharModal(id) { document.getElementById(id).classList.remove('aberto'); }

// ===================== FORMATAÇÃO =====================
function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarDataBR(iso) {
  const [ano, mes, dia] = iso.split('-');
  return dia + '/' + mes + '/' + ano;
}

// Aceita nome exato (selecionado da lista) ou parte do nome digitada livremente.
function encontrarProduto_(nomeDigitado) {
  const alvo = nomeDigitado.toLowerCase();
  const exato = bootstrap.produtos.find(function (p) { return p.nome.toLowerCase() === alvo; });
  if (exato) return exato;
  return bootstrap.produtos.find(function (p) { return p.nome.toLowerCase().indexOf(alvo) !== -1; });
}

// ===================== SIDEBAR (gaveta off-canvas no mobile, recolher no desktop) e SAIR =====================
// forcar: true = deixar aberta/expandida, false = fechar/recolher, omitido = alternar.
function toggleSidebar(forcar) {
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('scrimSidebar');
  if (!sidebar || !scrim) return;

  if (window.matchMedia('(min-width: 1024px)').matches) {
    // No desktop a sidebar já fica visível por padrão (sem gaveta nem scrim) — o
    // hambúrguer aqui só alterna entre visível e recolhida, pra ganhar espaço de tela.
    const aberta = typeof forcar === 'boolean' ? forcar : sidebar.classList.contains('recolhida');
    sidebar.classList.toggle('recolhida', !aberta);
    return;
  }

  const aberta = typeof forcar === 'boolean' ? forcar : !sidebar.classList.contains('aberta');
  sidebar.classList.toggle('aberta', aberta);
  scrim.classList.toggle('ativo', aberta);
}
function sair() {
  location.reload();
}
function toggleGrupoMonitoramento() {
  document.getElementById('grupoMonitoramento').classList.toggle('aberto');
}

// ===================== SOMBRA DINÂMICA DO CABEÇALHO AO ROLAR =====================
(function () {
  const cabecalho = document.querySelector('header');
  if (!cabecalho) return;
  const atualizar = () => cabecalho.classList.toggle('tem-sombra', window.scrollY > 4);
  window.addEventListener('scroll', atualizar, { passive: true });
  atualizar();
})();
