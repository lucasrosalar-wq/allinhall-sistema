/* ============================================================
   ALL IN HALL — aquisicao.js
   Lógica da tela de Aquisição: o custo entra por cupom de
   compra, cada produto ganha uma faixa de margem conforme o
   comportamento de compra, e o sistema calcula o preço de
   venda sugerido.

   Regra da casa: o sistema SUGERE, a pessoa APLICA. Um cupom
   com promoção pontual não pode virar mudança de preço sozinho
   — por isso o ajuste passa sempre pela fila de revisão.

   Todo o cálculo de preço mora no servidor (Code.gs,
   calcularPrecificacaoProduto_). Esta tela só exibe e aplica o
   que veio de lá, pra conta da tela nunca divergir da conta que
   é gravada na planilha.
   ============================================================ */

// ===================== ESTADO EM MEMÓRIA =====================
let dadosAquisicao = { produtos: [], regras: [], compras: [], pendentes: [], estruturaPendente: false, limiteAlertaPct: 20 };
let itensCupom = [];            // [{ produto, descricao_cupom, codigo, qtd, custo_unit }] do cupom em digitação
let linhasPreco = [];           // espelho do que está renderizado na fila de ajuste, na ordem exibida
let selecionadosPreco = {};     // { nome do produto: true } — sobrevive à re-renderização da lista
let abaAquisicaoAtiva = 'cupons';

// ===================== INICIALIZAÇÃO =====================
function inicializarAquisicao() {
  document.getElementById('dataCupom').value = hojeISOAquisicao_();
  mudarAbaAquisicao(abaAquisicaoAtiva);
  carregarAquisicao();
}

function hojeISOAquisicao_() {
  const h = new Date();
  return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0');
}

function escaparHtml_(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatarPct_(valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  const sinal = valor > 0 ? '+' : '';
  return sinal + Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

// ===================== ABAS INTERNAS =====================
const ABAS_AQUISICAO_ = ['cupons', 'precos', 'margens'];

function mudarAbaAquisicao(nome) {
  if (ABAS_AQUISICAO_.indexOf(nome) === -1) nome = 'cupons';
  abaAquisicaoAtiva = nome;
  ABAS_AQUISICAO_.forEach(function (aba) {
    const botao = document.getElementById('abaAquisicao-' + aba);
    const painel = document.getElementById('painelAquisicao-' + aba);
    if (botao) botao.classList.toggle('ativa', aba === nome);
    if (painel) painel.classList.toggle('oculto', aba !== nome);
  });
}

// ===================== CARGA =====================
async function carregarAquisicao() {
  const banner = document.getElementById('bannerAquisicao');
  banner.className = 'banner';
  banner.textContent = '';
  try {
    const resposta = await chamarApi({ action: 'aquisicao' });
    if (!resposta.ok) throw new Error(resposta.erro);
    dadosAquisicao = resposta.dados;

    document.getElementById('avisoEstruturaAquisicao').classList.toggle('oculto', !dadosAquisicao.estruturaPendente);

    const datalist = document.getElementById('listaProdutosDatalistCupom');
    datalist.innerHTML = dadosAquisicao.produtos.map(function (p) {
      return '<option value="' + escaparHtml_(p.nome) + '">';
    }).join('');

    renderizarResumoAquisicao();
    renderizarFiltroCategoriaPreco();
    renderizarFilaPrecos();
    renderizarRegrasMargem();
    renderizarCupons();
    renderizarPendentes();
  } catch (err) {
    banner.className = 'banner erro';
    banner.textContent = 'Não foi possível carregar a Aquisição. Verifique a conexão e tente novamente.';
  }
}

// Depois de mexer em preço, o catálogo em memória (usado por Gestão e Reposição
// pra preencher o preço de novos itens) fica velho — recarrega pra uma ocorrência
// registrada logo em seguida já sair com o preço novo.
async function recarregarBootstrap_() {
  try {
    const resposta = await chamarApi({ action: 'bootstrap' });
    if (resposta.ok) bootstrap = resposta.dados;
  } catch (err) {
    /* catálogo velho em memória não impede nada agora — a próxima carga corrige. */
  }
}

// ===================== RESUMO =====================
function renderizarResumoAquisicao() {
  const produtos = dadosAquisicao.produtos;
  const comCusto = produtos.filter(function (p) { return p.custo_atual > 0; });
  const naFila = produtos.filter(function (p) { return p.precisa_ajuste; });

  // Margem média ponderada não faz sentido sem volume de venda; a média simples
  // aqui serve só de termômetro de "como está o catálogo hoje".
  const margens = comCusto.filter(function (p) { return p.margem_atual_pct !== null; }).map(function (p) { return p.margem_atual_pct; });
  const media = margens.length ? margens.reduce(function (a, b) { return a + b; }, 0) / margens.length : null;

  document.getElementById('resumoComCusto').textContent = comCusto.length + ' de ' + produtos.length;
  document.getElementById('resumoMargemMedia').textContent = media === null ? '—' : formatarPct_(Math.round(media * 10) / 10).replace('+', '');
  document.getElementById('resumoNaFila').textContent = String(naFila.length);

  const selo = document.getElementById('seloFilaPrecos');
  selo.textContent = String(naFila.length);
  selo.classList.toggle('oculto', naFila.length === 0);
}

// ===================== CUPOM: ITENS =====================
function adicionarItemCupom() {
  const inputNome = document.getElementById('inputProdutoCupom');
  const inputQtd = document.getElementById('inputQtdCupom');
  const inputCusto = document.getElementById('inputCustoCupom');
  const nomeDigitado = inputNome.value.trim();

  if (!nomeDigitado) {
    mostrarBannerCupom_('erro', 'Digite o produto do cupom.');
    return;
  }
  const custoUnit = Number(String(inputCusto.value).replace(',', '.'));
  if (!(custoUnit > 0)) {
    mostrarBannerCupom_('erro', 'Informe o custo unitário que você pagou nesse item.');
    return;
  }
  const qtd = Math.max(1, parseInt(inputQtd.value, 10) || 1);

  // Casa com o catálogo pelo nome (exato ou parte). Não achou não é erro: o item
  // entra sem vínculo e vai pra fila "aguardando vínculo" — melhor guardar o que
  // foi pago do que perder o lançamento porque o nome não bateu.
  const produtoCatalogo = dadosAquisicao.produtos.find(function (p) { return p.nome.toLowerCase() === nomeDigitado.toLowerCase(); })
    || dadosAquisicao.produtos.find(function (p) { return p.nome.toLowerCase().indexOf(nomeDigitado.toLowerCase()) !== -1; });

  itensCupom.push({
    produto: produtoCatalogo ? produtoCatalogo.nome : '',
    descricao_cupom: nomeDigitado,
    codigo: String(document.getElementById('inputCodigoCupom').value || '').trim(),
    qtd: qtd,
    custo_unit: custoUnit
  });

  inputNome.value = '';
  inputQtd.value = '1';
  inputCusto.value = '';
  document.getElementById('inputCodigoCupom').value = '';
  inputNome.focus();
  mostrarBannerCupom_('', '');
  renderizarItensCupom();
}

function removerItemCupom(indice) {
  itensCupom.splice(indice, 1);
  renderizarItensCupom();
}

function renderizarItensCupom() {
  const lista = document.getElementById('listaItensCupom');
  lista.innerHTML = itensCupom.map(function (item, indice) {
    const subtotal = item.qtd * item.custo_unit;
    const vinculo = item.produto
      ? '<span class="vinculo-ok">' + escaparHtml_(item.produto) + '</span>'
      : '<span class="vinculo-pendente">sem vínculo no catálogo</span>';
    return '<div class="item-adicionado">' +
      '<div class="info">' + escaparHtml_(item.descricao_cupom) +
        '<div class="qtd-preco">' + item.qtd + ' x ' + formatarMoeda(item.custo_unit) + ' · ' + vinculo + '</div>' +
      '</div>' +
      '<div class="direita">' +
        '<span class="subtotal">' + formatarMoeda(subtotal) + '</span>' +
        '<button type="button" class="btn-remover" onclick="removerItemCupom(' + indice + ')">×</button>' +
      '</div>' +
    '</div>';
  }).join('') || '<div class="lista-vazia-itens">Nenhum item lançado ainda.</div>';

  const total = itensCupom.reduce(function (soma, item) { return soma + item.qtd * item.custo_unit; }, 0);
  document.getElementById('totalCupom').textContent = formatarMoeda(total);
}

function mostrarBannerCupom_(tipo, mensagem) {
  const banner = document.getElementById('bannerCupom');
  banner.className = 'banner ' + tipo;
  banner.textContent = mensagem;
}

// ===================== CUPOM: SALVAR =====================
async function salvarCupom() {
  const mercado = document.getElementById('mercadoCupom').value.trim();
  const data = document.getElementById('dataCupom').value;

  if (!mercado) { mostrarBannerCupom_('erro', 'Informe onde a compra foi feita.'); return; }
  if (!data) { mostrarBannerCupom_('erro', 'Informe a data da compra.'); return; }
  if (itensCupom.length === 0) { mostrarBannerCupom_('erro', 'Adicione ao menos um item do cupom.'); return; }

  const botao = document.getElementById('botaoSalvarCupom');
  botao.disabled = true;
  botao.classList.add('carregando');
  botao.textContent = 'Salvando...';
  try {
    const resposta = await chamarApi({
      action: 'criarCompra',
      data: data,
      mercado: mercado,
      documento: document.getElementById('documentoCupom').value.trim(),
      observacao: document.getElementById('observacaoCupom').value.trim(),
      origem: 'manual',
      itens: itensCupom
    }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro || 'Erro ao salvar.');

    const totalVinculados = itensCupom.filter(function (i) { return i.produto; }).length;
    mostrarBannerCupom_('sucesso', 'Cupom salvo. ' + totalVinculados + ' produto(s) com custo atualizado — confira a aba Ajuste de preço.');
    itensCupom = [];
    document.getElementById('documentoCupom').value = '';
    document.getElementById('observacaoCupom').value = '';
    renderizarItensCupom();
    await carregarAquisicao();
  } catch (err) {
    mostrarBannerCupom_('erro', 'Falha ao salvar o cupom. Verifique a conexão e tente novamente.');
  } finally {
    botao.disabled = false;
    botao.classList.remove('carregando');
    botao.textContent = 'Salvar cupom';
  }
}

async function excluirCupom(id) {
  if (!confirm('Excluir este cupom? Os custos já registrados nos produtos permanecem — pra corrigir um custo, lance o cupom certo.')) return;
  try {
    const resposta = await chamarApi({ action: 'excluirCompra', id: id }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    await carregarAquisicao();
  } catch (err) {
    alert('Não foi possível excluir. Verifique a conexão e tente novamente.');
  }
}

// ===================== IMPORTAÇÃO DE NFC-e =====================
// O cupom lido fica aqui até a pessoa confirmar. Nada é gravado antes disso:
// a leitura é boa, mas quem decide o vínculo de cada item é ela.
let cupomLido = null;

function alternarColarNfce() {
  document.getElementById('blocoColarNfce').classList.toggle('oculto');
}

async function lerNfce() {
  const url = document.getElementById('urlNfce').value.trim();
  const conteudo = document.getElementById('conteudoNfce').value.trim();
  if (!url && !conteudo) {
    mostrarBannerNfce_('erro', 'Cole o link do QR code do cupom (ou o conteúdo da página).');
    return;
  }

  const botao = document.getElementById('botaoLerNfce');
  botao.disabled = true;
  botao.classList.add('carregando');
  mostrarBannerNfce_('', '');
  try {
    // POST porque o conteúdo colado da página é grande demais pra querystring.
    const resposta = await chamarApi({ action: 'lerNfce', url: url, conteudo: conteudo }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro || 'Não foi possível ler o cupom.');
    cupomLido = resposta.dados;
    renderizarRevisaoNfce();
    document.getElementById('blocoRevisaoNfce').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    mostrarBannerNfce_('erro', String(err.message || err));
  } finally {
    botao.disabled = false;
    botao.classList.remove('carregando');
  }
}

function mostrarBannerNfce_(tipo, mensagem) {
  const banner = document.getElementById('bannerNfce');
  banner.className = 'banner ' + tipo;
  banner.textContent = mensagem;
}

function renderizarRevisaoNfce() {
  const bloco = document.getElementById('blocoRevisaoNfce');
  if (!cupomLido) { bloco.classList.add('oculto'); return; }
  bloco.classList.remove('oculto');

  const juntadas = cupomLido.linhas_originais - cupomLido.itens.length;
  document.getElementById('subtituloRevisaoNfce').textContent =
    cupomLido.emitente + ' · ' + (cupomLido.data ? formatarDataBR(cupomLido.data) : 'sem data') +
    ' · ' + cupomLido.itens.length + ' itens' +
    (juntadas > 0 ? ' (' + juntadas + ' linha(s) repetida(s) já somada(s))' : '');

  const semVinculo = cupomLido.itens.filter(function (i) { return !i.produto; }).length;
  const palpites = cupomLido.itens.filter(function (i) { return i.origem_vinculo === 'palpite'; }).length;
  const fardos = cupomLido.itens.filter(function (i) { return i.alerta_fardo || i.alerta_custo_acima; }).length;

  const avisos = [];
  if (fardos) avisos.push('<div class="aviso-revisao grave"><strong>' + fardos + ' item(ns) parecem fardo/pack.</strong> ' +
    'O custo aí é do fardo inteiro, não da unidade. Corrija a quantidade e o custo unitário, ou deixe sem vínculo.</div>');
  if (palpites) avisos.push('<div class="aviso-revisao"><strong>' + palpites + ' vínculo(s) são palpite do sistema</strong> (marcados em azul). ' +
    'Confira — na próxima vez que esse item aparecer, ele vem já aprendido.</div>');
  if (semVinculo) avisos.push('<div class="aviso-revisao"><strong>' + semVinculo + ' item(ns) sem vínculo.</strong> ' +
    'Escolha o produto do catálogo, ou deixe em branco: eles são lançados no histórico e ficam esperando em "Aguardando vínculo".</div>');
  document.getElementById('avisosRevisaoNfce').innerHTML = avisos.join('');

  const opcoes = '<option value="">Sem vínculo</option>' +
    dadosAquisicao.produtos.map(function (p) {
      return '<option value="' + escaparHtml_(p.nome) + '">' + escaparHtml_(p.nome) + '</option>';
    }).join('');

  const lista = document.getElementById('listaRevisaoNfce');
  lista.innerHTML = cupomLido.itens.map(function (i, indice) {
    const suspeito = i.alerta_fardo || i.alerta_custo_acima;
    const selo = i.origem_vinculo === 'palpite'
      ? '<span class="selo-vinculo palpite">palpite</span>'
      : (i.origem_vinculo === 'aprendido' ? '<span class="selo-vinculo aprendido">aprendido</span>' : '');
    const motivoSuspeita = i.alerta_fardo
      ? 'a descrição indica fardo/pack'
      : 'o custo unitário está acima do preço de venda (' + formatarMoeda(i.preco_venda_atual) + ')';

    return '<div class="linha-revisao' + (suspeito ? ' suspeita' : '') + '">' +
      '<div class="cabecalho-revisao">' +
        '<div class="desc">' + escaparHtml_(i.descricao_cupom) + selo +
          '<span class="meta">' + (i.codigo ? 'cód ' + escaparHtml_(i.codigo) + ' · ' : '') + i.unidade + '</span>' +
        '</div>' +
        '<div class="valor">' + formatarMoeda(i.custo_total) + '</div>' +
      '</div>' +
      (suspeito ? '<div class="alerta-linha">Confira: ' + motivoSuspeita + '.</div>' : '') +
      '<div class="controles-revisao">' +
        '<select onchange="mudarVinculoNfce(' + indice + ', this.value)">' + opcoes + '</select>' +
        '<label class="campo-inline">Qtd<input type="number" min="0" step="1" value="' + i.qtd +
          '" onchange="mudarQtdNfce(' + indice + ', this.value)"></label>' +
        '<label class="campo-inline">Custo un.<input type="number" min="0" step="0.01" value="' + i.custo_unit +
          '" onchange="mudarCustoNfce(' + indice + ', this.value)"></label>' +
        '<button type="button" class="btn-remover-revisao" onclick="removerItemNfce(' + indice + ')" title="Tirar do lançamento">×</button>' +
      '</div>' +
    '</div>';
  }).join('');

  lista.querySelectorAll('.linha-revisao').forEach(function (el, indice) {
    el.querySelector('select').value = cupomLido.itens[indice].produto || '';
  });

  document.getElementById('totalRevisaoNfce').textContent = formatarMoeda(
    cupomLido.itens.reduce(function (s, i) { return s + i.custo_total; }, 0));
}

function mudarVinculoNfce(indice, produto) {
  cupomLido.itens[indice].produto = produto;
  // Escolha da pessoa deixa de ser palpite — e some o selo azul.
  cupomLido.itens[indice].origem_vinculo = produto ? 'confirmado' : '';
  renderizarRevisaoNfce();
}

function mudarQtdNfce(indice, valor) {
  const item = cupomLido.itens[indice];
  item.qtd = Math.max(0, Number(valor) || 0);
  item.custo_total = Math.round(item.qtd * item.custo_unit * 100) / 100;
  renderizarRevisaoNfce();
}

function mudarCustoNfce(indice, valor) {
  const item = cupomLido.itens[indice];
  item.custo_unit = Math.max(0, Number(String(valor).replace(',', '.')) || 0);
  item.custo_total = Math.round(item.qtd * item.custo_unit * 100) / 100;
  renderizarRevisaoNfce();
}

function removerItemNfce(indice) {
  cupomLido.itens.splice(indice, 1);
  if (cupomLido.itens.length === 0) { cancelarRevisaoNfce(); return; }
  renderizarRevisaoNfce();
}

function cancelarRevisaoNfce() {
  cupomLido = null;
  document.getElementById('blocoRevisaoNfce').classList.add('oculto');
  document.getElementById('urlNfce').value = '';
  document.getElementById('conteudoNfce').value = '';
}

async function lancarNfce() {
  if (!cupomLido || cupomLido.itens.length === 0) return;

  const validos = cupomLido.itens.filter(function (i) { return i.qtd > 0 && i.custo_unit > 0; });
  if (validos.length === 0) {
    mostrarBannerRevisaoNfce_('erro', 'Nenhum item com quantidade e custo válidos.');
    return;
  }

  const botao = document.getElementById('botaoLancarNfce');
  botao.disabled = true;
  botao.classList.add('carregando');
  try {
    const resposta = await chamarApi({
      action: 'criarCompra',
      data: cupomLido.data,
      mercado: cupomLido.emitente,
      // O CNPJ é o escopo do de-para: bem mais confiável que o nome do mercado,
      // que muda de grafia a cada digitação.
      loja: cupomLido.cnpj,
      documento: cupomLido.chave,
      origem: 'nfce',
      itens: validos.map(function (i) {
        return { produto: i.produto, descricao_cupom: i.descricao_cupom, codigo: i.codigo, qtd: i.qtd, custo_unit: i.custo_unit };
      })
    }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro || 'Erro ao lançar.');

    const comCusto = resposta.dados.produtos_com_custo || 0;
    cancelarRevisaoNfce();
    mostrarBannerNfce_('sucesso', 'Cupom lançado. ' + comCusto + ' produto(s) com custo atualizado — confira a aba Ajuste de preço.');
    await carregarAquisicao();
  } catch (err) {
    mostrarBannerRevisaoNfce_('erro', 'Falha ao lançar. Verifique a conexão e tente novamente.');
  } finally {
    botao.disabled = false;
    botao.classList.remove('carregando');
  }
}

function mostrarBannerRevisaoNfce_(tipo, mensagem) {
  const banner = document.getElementById('bannerRevisaoNfce');
  banner.className = 'banner ' + tipo;
  banner.textContent = mensagem;
}

// ===================== CUPONS LANÇADOS =====================
function renderizarCupons() {
  const lista = document.getElementById('listaCupons');
  const compras = dadosAquisicao.compras;

  if (compras.length === 0) {
    lista.innerHTML = '<div class="vazio-relacao">Nenhum cupom lançado ainda.</div>';
    return;
  }

  lista.innerHTML = compras.map(function (c) {
    const resumo = c.itens.map(function (i) { return i.quantidade + 'x ' + (i.produto || i.descricao_cupom); }).join(', ');
    const semVinculo = c.itens.filter(function (i) { return !i.produto; }).length;
    const aviso = semVinculo ? '<span class="badge-status pendente">' + semVinculo + ' sem vínculo</span>' : '';
    return '<div class="card-relacao">' +
      '<div class="topo">' +
        '<div><div class="pessoa">' + escaparHtml_(c.mercado) + '</div>' +
        '<div class="hora">' + formatarDataBR(c.data) + (c.documento ? ' · ' + escaparHtml_(c.documento) : '') + '</div></div>' +
        '<div class="valor">' + formatarMoeda(c.valor_total) + '</div>' +
      '</div>' +
      '<div class="itens">' + escaparHtml_(resumo) + '</div>' +
      aviso +
      '<div class="acoes-relacao">' +
        '<button type="button" class="btn-excluir-relacao" onclick="excluirCupom(\'' + c.id + '\')">Excluir</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ===================== ITENS SEM VÍNCULO =====================
// O balde onde caem itens que o sistema não soube ligar a um produto do catálogo.
// Hoje só enche por digitação livre; é o mesmo lugar onde vão parar os itens não
// reconhecidos quando a importação automática entrar.
function renderizarPendentes() {
  const bloco = document.getElementById('blocoPendentesVinculo');
  const lista = document.getElementById('listaPendentesVinculo');
  const pendentes = dadosAquisicao.pendentes;

  bloco.classList.toggle('oculto', pendentes.length === 0);
  if (pendentes.length === 0) return;

  const opcoes = '<option value="">Escolha o produto do catálogo...</option>' +
    dadosAquisicao.produtos.map(function (p) {
      return '<option value="' + escaparHtml_(p.nome) + '">' + escaparHtml_(p.nome) + '</option>';
    }).join('');

  lista.innerHTML = pendentes.map(function (i) {
    return '<div class="linha-vinculo">' +
      '<div class="descricao-cupom">' + escaparHtml_(i.descricao_cupom) +
        '<span class="meta">' + escaparHtml_(i.mercado) + ' · ' + formatarDataBR(i.data) + ' · ' + i.quantidade + 'x ' + formatarMoeda(i.custo_unit) + '</span>' +
      '</div>' +
      '<select onchange="vincularItem(\'' + i.id + '\', this.value, \'' + i.data + '\')">' + opcoes + '</select>' +
    '</div>';
  }).join('');
}

async function vincularItem(id, produto, data) {
  if (!produto) return;
  try {
    const resposta = await chamarApi({ action: 'vincularItemCompra', id: id, produto: produto, data: data }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    await carregarAquisicao();
  } catch (err) {
    alert('Não foi possível vincular. Verifique a conexão e tente novamente.');
  }
}

// ===================== FILA DE AJUSTE DE PREÇO =====================
function renderizarFiltroCategoriaPreco() {
  const select = document.getElementById('filtroCategoriaPreco');
  const atual = select.value;
  select.innerHTML = '<option value="">Todas as faixas</option>' +
    dadosAquisicao.regras.map(function (r) {
      return '<option value="' + escaparHtml_(r.categoria) + '">' + escaparHtml_(r.rotulo) + '</option>';
    }).join('') +
    '<option value="__sem__">Sem faixa definida</option>';
  select.value = atual;
}

function renderizarFilaPrecos() {
  const filtroCategoria = document.getElementById('filtroCategoriaPreco').value;
  const modo = document.getElementById('filtroModoPreco').value;
  const busca = document.getElementById('buscaProdutoPreco').value.trim().toLowerCase();
  const lista = document.getElementById('listaFilaPrecos');

  let candidatos = dadosAquisicao.produtos;
  if (filtroCategoria === '__sem__') candidatos = candidatos.filter(function (p) { return !p.categoria; });
  else if (filtroCategoria) candidatos = candidatos.filter(function (p) { return p.categoria === filtroCategoria; });
  if (busca) candidatos = candidatos.filter(function (p) { return p.nome.toLowerCase().indexOf(busca) !== -1; });

  if (modo === 'ajuste') candidatos = candidatos.filter(function (p) { return p.precisa_ajuste; });
  else if (modo === 'sem_custo') candidatos = candidatos.filter(function (p) { return !(p.custo_atual > 0); });

  // Maior variação primeiro: é onde está o dinheiro e onde mora o erro de digitação.
  linhasPreco = candidatos.slice().sort(function (a, b) {
    const va = a.variacao_pct === null || a.variacao_pct === undefined ? -Infinity : Math.abs(a.variacao_pct);
    const vb = b.variacao_pct === null || b.variacao_pct === undefined ? -Infinity : Math.abs(b.variacao_pct);
    if (vb !== va) return vb - va;
    return a.nome.localeCompare(b.nome);
  });

  if (linhasPreco.length === 0) {
    lista.innerHTML = '<div class="vazio-relacao">' +
      (modo === 'ajuste' ? 'Nenhum preço fora do alvo. Catálogo em dia.' : 'Nenhum produto nesse filtro.') +
      '</div>';
    atualizarBarraAplicar();
    return;
  }

  const opcoesCategoria = dadosAquisicao.regras.map(function (r) {
    return '<option value="' + escaparHtml_(r.categoria) + '">' + escaparHtml_(r.rotulo) + ' (' + r.margem_pct + '%)</option>';
  }).join('');

  lista.innerHTML = linhasPreco.map(function (p, indice) {
    const temCusto = p.custo_atual > 0;
    const marcado = selecionadosPreco[p.nome] ? ' checked' : '';
    const caixa = p.precisa_ajuste
      ? '<input type="checkbox" class="check-preco"' + marcado + ' onchange="alternarSelecaoPreco(' + indice + ', this.checked)">'
      : '<span class="check-vazio"></span>';

    const origemMargem = p.margem_alvo_origem === 'item' ? ' <span class="tag-margem-propria">margem própria</span>' : '';

    const MOTIVOS_SEM_SUGESTAO_ = {
      sem_custo: 'sem custo lançado',
      travado: 'preço travado',
      sem_faixa: 'escolha uma faixa'
    };
    // A direção do ajuste vai na cor da variação, não na do preço: subir e descer
    // o preço são decisões bem diferentes, e na fila elas precisam se distinguir
    // num olhar só — verde sobe, laranja desce.
    const direcao = p.variacao_pct === null ? '' : (p.variacao_pct >= 0 ? ' sobe' : ' desce');
    const blocoSugestao = p.preco_sugerido === null
      ? '<div class="preco-sugerido sem-dado">' + (MOTIVOS_SEM_SUGESTAO_[p.motivo_sem_sugestao] || '—') + '</div>'
      : '<div class="preco-sugerido' + (p.alerta ? ' alerta' : '') + '">' +
          formatarMoeda(p.preco_sugerido) +
          '<span class="variacao' + direcao + '">' + formatarPct_(p.variacao_pct) + '</span>' +
        '</div>';

    return '<div class="linha-preco' + (p.alerta ? ' com-alerta' : '') + '">' +
      '<div class="celula-check">' + caixa + '</div>' +
      '<div class="celula-produto">' +
        '<div class="nome-produto">' + escaparHtml_(p.nome) + '</div>' +
        '<div class="linha-controles">' +
          '<select class="select-categoria" onchange="mudarCategoriaProduto(' + indice + ', this.value)">' +
            '<option value="">Sem faixa</option>' + opcoesCategoria +
          '</select>' +
          '<button type="button" class="btn-travar' + (p.preco_travado ? ' ativo' : '') + '" ' +
            'title="Travar impede o sistema de sugerir preço pra este item" ' +
            'onclick="alternarTravaPreco(' + indice + ')">' +
            (p.preco_travado ? 'Travado' : 'Travar') +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="celula-numeros">' +
        '<div class="par"><span>Custo</span><strong>' + (temCusto ? formatarMoeda(p.custo_atual) : '—') + '</strong></div>' +
        '<div class="par"><span>Preço hoje</span><strong>' + formatarMoeda(p.preco) + '</strong></div>' +
        '<div class="par"><span>Margem hoje</span><strong>' + formatarPct_(p.margem_atual_pct).replace('+', '') + '</strong></div>' +
        '<div class="par"><span>Alvo</span><strong>' + (p.margem_alvo_pct === null ? '—' : p.margem_alvo_pct + '%') + origemMargem + '</strong></div>' +
      '</div>' +
      '<div class="celula-sugestao">' + blocoSugestao + '</div>' +
    '</div>';
  }).join('');

  // O valor do <select> de categoria só existe depois do innerHTML — setar aqui
  // evita ter que marcar "selected" na string e escapar aspas de novo.
  lista.querySelectorAll('.linha-preco').forEach(function (el, indice) {
    const select = el.querySelector('.select-categoria');
    if (select) select.value = linhasPreco[indice].categoria || '';
  });

  atualizarBarraAplicar();
}

function alternarSelecaoPreco(indice, marcado) {
  const produto = linhasPreco[indice];
  if (!produto) return;
  if (marcado) selecionadosPreco[produto.nome] = true;
  else delete selecionadosPreco[produto.nome];
  atualizarBarraAplicar();
}

function selecionarTodosPrecos() {
  const algumDesmarcado = linhasPreco.some(function (p) { return p.precisa_ajuste && !selecionadosPreco[p.nome]; });
  linhasPreco.forEach(function (p) {
    if (!p.precisa_ajuste) return;
    if (algumDesmarcado) selecionadosPreco[p.nome] = true;
    else delete selecionadosPreco[p.nome];
  });
  renderizarFilaPrecos();
}

function atualizarBarraAplicar() {
  const nomes = Object.keys(selecionadosPreco);
  const botao = document.getElementById('botaoAplicarPrecos');
  const rotulo = document.getElementById('rotuloSelecaoPrecos');

  botao.disabled = nomes.length === 0;
  rotulo.textContent = nomes.length === 0
    ? 'Nenhum preço selecionado'
    : nomes.length + ' preço(s) selecionado(s)';
  botao.textContent = nomes.length === 0 ? 'Aplicar preços' : 'Aplicar ' + nomes.length + ' preço(s)';
}

async function aplicarPrecosSelecionados() {
  const nomes = Object.keys(selecionadosPreco);
  if (nomes.length === 0) return;

  // Sempre a partir de dadosAquisicao (a verdade do servidor), nunca de linhasPreco,
  // que é só a fatia filtrada na tela — assim uma seleção feita antes de trocar o
  // filtro continua valendo e aplicando o preço certo.
  const precos = [];
  nomes.forEach(function (nome) {
    const produto = dadosAquisicao.produtos.find(function (p) { return p.nome === nome; });
    if (produto && produto.preco_sugerido) precos.push({ nome: nome, preco: produto.preco_sugerido });
  });
  if (precos.length === 0) return;

  if (!confirm('Aplicar ' + precos.length + ' novo(s) preço(s) no catálogo?\n\nCobranças já registradas não mudam — elas guardam o preço do dia em que foram feitas.')) return;

  const botao = document.getElementById('botaoAplicarPrecos');
  botao.disabled = true;
  botao.classList.add('carregando');
  botao.textContent = 'Aplicando...';
  try {
    const resposta = await chamarApi({ action: 'aplicarPrecos', precos: precos }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro || 'Erro ao aplicar.');
    selecionadosPreco = {};
    mostrarBannerPrecos_('sucesso', resposta.dados.aplicados + ' preço(s) atualizado(s) no catálogo.');
    await carregarAquisicao();
    await recarregarBootstrap_();
  } catch (err) {
    mostrarBannerPrecos_('erro', 'Falha ao aplicar os preços. Verifique a conexão e tente novamente.');
  } finally {
    botao.classList.remove('carregando');
    atualizarBarraAplicar();
  }
}

function mostrarBannerPrecos_(tipo, mensagem) {
  const banner = document.getElementById('bannerPrecos');
  banner.className = 'banner ' + tipo;
  banner.textContent = mensagem;
}

// ===================== CLASSIFICAÇÃO DO PRODUTO =====================
async function mudarCategoriaProduto(indice, categoria) {
  const produto = linhasPreco[indice];
  if (!produto) return;
  try {
    const resposta = await chamarApi({ action: 'atualizarProduto', nome: produto.nome, categoria: categoria }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    await carregarAquisicao();
  } catch (err) {
    mostrarBannerPrecos_('erro', 'Não foi possível salvar a faixa desse produto.');
  }
}

async function alternarTravaPreco(indice) {
  const produto = linhasPreco[indice];
  if (!produto) return;
  try {
    const resposta = await chamarApi({ action: 'atualizarProduto', nome: produto.nome, preco_travado: !produto.preco_travado }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro);
    // Produto travado sai da fila — tirar da seleção evita aplicar sem querer.
    delete selecionadosPreco[produto.nome];
    await carregarAquisicao();
  } catch (err) {
    mostrarBannerPrecos_('erro', 'Não foi possível travar/destravar esse preço.');
  }
}

// ===================== FAIXAS DE MARGEM =====================
function renderizarRegrasMargem() {
  const lista = document.getElementById('listaRegrasMargem');
  const contagem = {};
  dadosAquisicao.produtos.forEach(function (p) {
    const chave = p.categoria || '__sem__';
    contagem[chave] = (contagem[chave] || 0) + 1;
  });

  lista.innerHTML = dadosAquisicao.regras.map(function (r, indice) {
    return '<div class="card-regra">' +
      '<div class="topo-regra">' +
        '<input type="text" class="rotulo-regra" value="' + escaparHtml_(r.rotulo) + '" data-campo="rotulo" data-indice="' + indice + '">' +
        '<div class="campo-margem">' +
          '<input type="number" min="0" max="500" step="1" value="' + r.margem_pct + '" data-campo="margem_pct" data-indice="' + indice + '">' +
          '<span>%</span>' +
        '</div>' +
      '</div>' +
      '<textarea rows="2" class="descricao-regra" data-campo="descricao" data-indice="' + indice + '" ' +
        'placeholder="Que tipo de item entra nessa faixa">' + escaparHtml_(r.descricao) + '</textarea>' +
      '<div class="rodape-regra">' + (contagem[r.categoria] || 0) + ' produto(s) nesta faixa</div>' +
    '</div>';
  }).join('');

  const semFaixa = contagem['__sem__'] || 0;
  document.getElementById('avisoSemFaixa').textContent = semFaixa === 0
    ? 'Todos os produtos estão classificados.'
    : semFaixa + ' produto(s) ainda sem faixa — o sistema não sugere preço pra eles até você escolher uma. Classifique na aba Ajuste de preço.';
}

async function salvarRegrasMargem() {
  const regras = dadosAquisicao.regras.map(function (r) { return Object.assign({}, r); });
  document.querySelectorAll('#listaRegrasMargem [data-campo]').forEach(function (campo) {
    const indice = Number(campo.dataset.indice);
    if (!regras[indice]) return;
    regras[indice][campo.dataset.campo] = campo.dataset.campo === 'margem_pct' ? Number(campo.value) || 0 : campo.value;
  });

  const invalida = regras.find(function (r) { return !(r.margem_pct >= 0); });
  if (invalida) { mostrarBannerMargens_('erro', 'A margem não pode ser negativa.'); return; }

  const botao = document.getElementById('botaoSalvarRegras');
  botao.disabled = true;
  botao.textContent = 'Salvando...';
  try {
    const resposta = await chamarApi({ action: 'salvarRegrasMargem', regras: regras }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro || 'Erro ao salvar.');
    mostrarBannerMargens_('sucesso', 'Faixas salvas. Os preços sugeridos já foram recalculados.');
    await carregarAquisicao();
  } catch (err) {
    mostrarBannerMargens_('erro', 'Falha ao salvar as faixas. Verifique a conexão e tente novamente.');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Salvar faixas';
  }
}

function mostrarBannerMargens_(tipo, mensagem) {
  const banner = document.getElementById('bannerMargens');
  banner.className = 'banner ' + tipo;
  banner.textContent = mensagem;
}
