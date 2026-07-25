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

// ===================== SELECT CUSTOMIZADO (visual por cima do <select> nativo) =====================
// O <select> de cada tela continua fazendo todo o trabalho de sempre — onchange,
// .value, innerHTML populado em conferencia.js/gestao.js/reposicao.js — só que
// escondido. Isso aqui desenha um dropdown com a cara do resto do app em cima dele
// (mesmo estilo do popup de produtos) e mantém os dois sincronizados sozinho, sem
// precisar mexer no código de nenhuma tela.
const IDS_SELECT_CUSTOM_ = [
  'selectCondominio', 'filtroCondominio', 'filtroMes', 'filtroAno',
  'condominioReposicao', 'filtroCondominioReposicao'
];

function inicializarSelectsCustom_() {
  IDS_SELECT_CUSTOM_.forEach(function (id) {
    const select = document.getElementById(id);
    if (!select || select.dataset.customizado) return;
    select.dataset.customizado = '1';

    const wrapper = document.createElement('div');
    wrapper.className = 'select-custom';
    wrapper.dataset.select = id;
    wrapper.innerHTML =
      '<button type="button" class="select-custom-trigger" onclick="toggleSelectCustom(\'' + id + '\')">' +
        '<span class="rotulo"></span><i data-lucide="chevron-down"></i>' +
      '</button>' +
      '<div class="select-custom-painel"></div>';

    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    select.classList.add('oculto');

    select.addEventListener('change', function () { sincronizarRotuloSelectCustom_(id); });

    // .value assumido em qualquer lugar do código (ex: editarReposicao) precisa
    // continuar funcionando igual — só passamos a espiar a atribuição pra atualizar
    // o rótulo visível junto, sem mudar o comportamento de quem chama.
    const descritorValor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(select, 'value', {
      get: function () { return descritorValor.get.call(select); },
      set: function (v) { descritorValor.set.call(select, v); sincronizarRotuloSelectCustom_(id); },
      configurable: true
    });

    // Cada tela repopula as opções via innerHTML (bootstrap.condominios etc.) — o
    // observer pega isso sozinho e mantém o rótulo certo, não importa quando rodar.
    new MutationObserver(function () { sincronizarRotuloSelectCustom_(id); }).observe(select, { childList: true });

    sincronizarRotuloSelectCustom_(id);
  });
}

function sincronizarRotuloSelectCustom_(id) {
  const select = document.getElementById(id);
  const wrapper = document.querySelector('.select-custom[data-select="' + id + '"]');
  if (!select || !wrapper) return;
  const opcao = select.options[select.selectedIndex];
  wrapper.querySelector('.rotulo').textContent = opcao ? opcao.textContent : '';
}

function toggleSelectCustom(id) {
  const wrapper = document.querySelector('.select-custom[data-select="' + id + '"]');
  if (!wrapper) return;
  const jaAberto = wrapper.classList.contains('aberto');
  fecharSelectsCustom_();
  if (jaAberto) return;

  const select = document.getElementById(id);
  const painel = wrapper.querySelector('.select-custom-painel');
  painel.innerHTML = Array.from(select.options).map(function (opt, indice) {
    return '<div class="select-custom-opcao' + (indice === select.selectedIndex ? ' selecionada' : '') + '" data-indice="' + indice + '">' +
      '<span>' + opt.textContent + '</span><i data-lucide="check"></i></div>';
  }).join('');
  painel.querySelectorAll('.select-custom-opcao').forEach(function (el) {
    el.onclick = function () {
      select.selectedIndex = Number(el.dataset.indice);
      select.dispatchEvent(new Event('change'));
      sincronizarRotuloSelectCustom_(id);
      fecharSelectsCustom_();
    };
  });
  if (window.lucide) lucide.createIcons();

  wrapper.classList.add('aberto');
}

function fecharSelectsCustom_() {
  document.querySelectorAll('.select-custom.aberto').forEach(function (w) { w.classList.remove('aberto'); });
}

document.addEventListener('click', function (ev) {
  if (!ev.target.closest('.select-custom')) fecharSelectsCustom_();
});
document.addEventListener('keydown', function (ev) {
  if (ev.key === 'Escape') fecharSelectsCustom_();
});

inicializarSelectsCustom_();
