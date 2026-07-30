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
const ABAS_AQUISICAO_ = ['cupons', 'precos', 'margens', 'gestao'];

function mudarAbaAquisicao(nome) {
  if (ABAS_AQUISICAO_.indexOf(nome) === -1) nome = 'cupons';
  abaAquisicaoAtiva = nome;

  // Os três cartões gerais do topo saem no painel de Gestão: ele traz os mesmos
  // números com mais contexto logo abaixo, e repetir na mesma tela só divide a
  // atenção.
  const resumo = document.querySelector('.view-aquisicao .cartoes-resumo');
  if (resumo) resumo.classList.toggle('oculto', nome === 'gestao');
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
    renderizarLucroMes();
    renderizarPendentes();
    renderizarPainel();
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
      '<span class="numero-item">' + (indice + 1) + '</span>' +
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

// ===================== IMPORTAÇÃO E EDIÇÃO DE CUPOM =====================
// O mesmo bloco de revisão serve pros dois casos, de propósito: conferir um cupom
// que acabou de ser importado e editar um cupom já lançado são o mesmo trabalho —
// olhar linha por linha, arrumar vínculo, quantidade e custo. Duas telas
// separadas pra isso viravam duas telas pra manter em sincronia.
let cupomEmRevisao = null;      // { id?, mercado, cnpj, data, documento, observacao, itens[] }
let modoRevisao = 'importar';   // 'importar' | 'editar'

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
  mostrarBannerNfce_('carregando', 'Lendo o cupom... isso pode levar alguns segundos.');
  try {
    // POST porque o conteúdo colado da página é grande demais pra querystring.
    const resposta = await chamarApi({ action: 'lerNfce', url: url, conteudo: conteudo }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro || 'Não foi possível ler o cupom.');

    const lido = resposta.dados;
    modoRevisao = 'importar';
    cupomEmRevisao = {
      mercado: lido.emitente,
      cnpj: lido.cnpj,
      data: lido.data,
      documento: lido.chave,
      observacao: '',
      linhas_originais: lido.linhas_originais,
      valor_bruto: lido.valor_bruto,
      desconto: lido.desconto,
      valor_pago: lido.valor_pago,
      itens: lido.itens.map(function (i) {
        return Object.assign({}, i, { custo_unit_bruto: i.custo_unit, desconto: 0, numeros: i.numeros || [] });
      })
    };
    recalcularCustosRevisao_();
    mostrarBannerNfce_('', '');
    renderizarRevisaoNfce();
    document.getElementById('blocoRevisaoNfce').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    mostrarBannerNfce_('erro', String(err.message || err));
  } finally {
    botao.disabled = false;
    botao.classList.remove('carregando');
  }
}

// Abre um cupom já lançado no mesmo bloco de revisão.
function editarCupom(id) {
  const compra = dadosAquisicao.compras.find(function (c) { return c.id === id; });
  if (!compra) return;

  modoRevisao = 'editar';
  cupomEmRevisao = {
    id: compra.id,
    mercado: compra.mercado,
    cnpj: '',
    data: compra.data,
    documento: compra.documento,
    observacao: compra.observacao,
    itens: compra.itens.map(function (i) {
      const produto = dadosAquisicao.produtos.find(function (p) { return p.nome === i.produto; });
      return {
        descricao_cupom: i.descricao_cupom,
        codigo: i.codigo,
        unidade: '',
        qtd: i.quantidade,
        custo_unit: i.custo_unit,
        // O cupom gravado guarda custo líquido e desconto separados, então a edição
        // reconstrói o bruto da linha e volta a mostrar as duas colunas.
        custo_unit_bruto: i.quantidade > 0 ? (i.custo_total + (i.desconto || 0)) / i.quantidade : i.custo_unit,
        desconto: i.desconto || 0,
        custo_total: i.custo_total,
        produto: i.produto,
        origem_vinculo: i.produto ? 'confirmado' : '',
        preco_venda_atual: produto ? produto.preco : 0,
        alerta_fardo: false,
        alerta_custo_acima: !!(produto && produto.preco > 0 && i.custo_unit >= produto.preco)
      };
    }),
    valor_bruto: 0,
    desconto: 0,
    valor_pago: 0
  };
  renderizarRevisaoNfce();
  document.getElementById('blocoRevisaoNfce').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function mostrarBannerNfce_(tipo, mensagem) {
  const banner = document.getElementById('bannerNfce');
  banner.className = 'banner ' + tipo;
  banner.textContent = mensagem;
}

function mudarCabecalhoRevisao() {
  if (!cupomEmRevisao) return;
  cupomEmRevisao.mercado = document.getElementById('mercadoRevisao').value;
  cupomEmRevisao.data = document.getElementById('dataRevisao').value;
  cupomEmRevisao.documento = document.getElementById('documentoRevisao').value;
  cupomEmRevisao.observacao = document.getElementById('observacaoRevisao').value;
}

// O DANFE traz o desconto só no total, nunca por item — não tem como saber em qual
// produto o mercado deu o abatimento. Quem sabe é a pessoa, que está com o cupom
// na mão: por isso cada linha tem uma coluna de desconto que ela preenche.
//
// custo_unit_bruto é o que o cupom pede na linha; custo_unit é o que sobra depois
// do desconto dela, e é esse que vira custo do produto e precifica.
function recalcularCustosRevisao_() {
  if (!cupomEmRevisao) return;
  cupomEmRevisao.itens.forEach(function (i) {
    const bruto = i.qtd * i.custo_unit_bruto;
    const desconto = Math.min(Math.max(0, Number(i.desconto) || 0), bruto);
    i.desconto = desconto;
    i.custo_unit = i.qtd > 0 ? (bruto - desconto) / i.qtd : 0;
    i.custo_total = Math.round((bruto - desconto) * 100) / 100;
    i.alerta_custo_acima = !!(i.preco_venda_atual > 0 && i.custo_unit >= i.preco_venda_atual);
  });
}

function mudarDescontoItem(indice, valor) {
  cupomEmRevisao.itens[indice].desconto = Math.max(0, Number(String(valor).replace(',', '.')) || 0);
  recalcularCustosRevisao_();
  renderizarRevisaoNfce();
}

// Atalho pra quem não quer distribuir na mão: espalha o desconto do cupom
// proporcionalmente ao valor de cada linha e preenche a coluna. A pessoa ajusta
// depois o que estiver errado — sair de um rateio e corrigir 2 linhas costuma ser
// menos trabalho que preencher 33 do zero.
function ratearDescontoNasLinhas() {
  const total = Number(cupomEmRevisao.desconto) || 0;
  const bruto = cupomEmRevisao.itens.reduce(function (soma, i) { return soma + i.qtd * i.custo_unit_bruto; }, 0);
  if (!(total > 0) || !(bruto > 0)) return;

  let distribuido = 0;
  cupomEmRevisao.itens.forEach(function (i, indice) {
    if (indice === cupomEmRevisao.itens.length - 1) {
      // A última linha leva a sobra de centavos, pra soma fechar exatamente com o
      // desconto do cupom em vez de errar por arredondamento.
      i.desconto = Math.round((total - distribuido) * 100) / 100;
      return;
    }
    const parte = Math.round((total * (i.qtd * i.custo_unit_bruto) / bruto) * 100) / 100;
    i.desconto = parte;
    distribuido += parte;
  });
  recalcularCustosRevisao_();
  renderizarRevisaoNfce();
}

function limparDescontosItens() {
  cupomEmRevisao.itens.forEach(function (i) { i.desconto = 0; });
  recalcularCustosRevisao_();
  renderizarRevisaoNfce();
}

// Conciliação: o que está sendo lançado tem que fechar com o que o cupom diz que
// foi pago. É a conferência que a pessoa faria de olho no papel, feita pelo
// sistema — e serve de placar enquanto ela distribui o desconto pelas linhas.
function blocoConciliacao_() {
  const c = cupomEmRevisao;
  const lancado = c.itens.reduce(function (s, i) { return s + i.custo_total; }, 0);
  const descontoLancado = c.itens.reduce(function (s, i) { return s + (Number(i.desconto) || 0); }, 0);

  // Cupom editado não traz os totais do papel — aí não há o que conciliar, só o
  // que está sendo gravado.
  if (!(c.valor_bruto > 0)) {
    return descontoLancado > 0
      ? '<div class="conciliacao"><div class="linha-conciliacao destaque"><span>Descontos nas linhas</span><strong>− ' +
        formatarMoeda(descontoLancado) + '</strong></div></div>'
      : '';
  }

  const falta = Math.round((c.desconto - descontoLancado) * 100) / 100;
  const diferenca = Math.round((lancado - (c.valor_pago || c.valor_bruto)) * 100) / 100;
  const fecha = Math.abs(diferenca) < 0.05;

  const placar = c.desconto > 0
    ? '<div class="linha-conciliacao' + (Math.abs(falta) < 0.005 ? ' ok' : ' nao-fecha') + '">' +
        '<span>Distribuído nas linhas</span><strong>' + formatarMoeda(descontoLancado) +
        (Math.abs(falta) < 0.005 ? '' : ' · faltam ' + formatarMoeda(falta)) +
      '</strong></div>'
    : '';

  const acoes = c.desconto > 0
    ? '<div class="acoes-desconto">' +
        '<button type="button" onclick="ratearDescontoNasLinhas()">Ratear proporcionalmente</button>' +
        '<button type="button" class="secundario" onclick="limparDescontosItens()">Limpar</button>' +
        '<span>Ou preencha a coluna <strong>Desc. da linha</strong> item por item, se você sabe onde foi o abatimento. ' +
          'O valor é o do cupom — sobre o total da linha, não por unidade.</span>' +
      '</div>'
    : '';

  return '<div class="conciliacao">' +
    '<div class="linha-conciliacao"><span>Soma dos itens no cupom</span><strong>' + formatarMoeda(c.valor_bruto) + '</strong></div>' +
    (c.desconto > 0
      ? '<div class="linha-conciliacao desconto"><span>Descontos do cupom</span><strong>− ' + formatarMoeda(c.desconto) + '</strong></div>'
      : '') +
    placar +
    '<div class="linha-conciliacao destaque"><span>Você pagou</span><strong>' + formatarMoeda(c.valor_pago || c.valor_bruto) + '</strong></div>' +
    '<div class="linha-conciliacao' + (fecha ? ' ok' : ' nao-fecha') + '"><span>Sendo lançado agora</span><strong>' +
      formatarMoeda(lancado) + (fecha ? '' : ' (' + (diferenca > 0 ? '+' : '') + formatarMoeda(diferenca) + ')') +
    '</strong></div>' +
    acoes +
  '</div>';
}

// Número da linha na tela. Vindo de importação, é o número que o próprio cupom
// deu ao item — é ele que permite conferir contra o papel. Em cupom digitado à
// mão ou reaberto pra edição não existe esse número, e aí vale a posição na lista.
// Quando linhas iguais foram somadas, mostra todos os números que viraram uma só.
function numeroDaLinha_(item, indice) {
  const numeros = item.numeros || [];
  if (numeros.length === 0) return String(indice + 1);
  if (numeros.length === 1) return String(numeros[0]);
  if (numeros.length === 2) return numeros[0] + '+' + numeros[1];
  return numeros[0] + '…' + numeros[numeros.length - 1];
}

function renderizarRevisaoNfce() {
  const bloco = document.getElementById('blocoRevisaoNfce');
  if (!cupomEmRevisao) { bloco.classList.add('oculto'); return; }
  bloco.classList.remove('oculto');

  const editando = modoRevisao === 'editar';
  document.getElementById('tituloRevisaoNfce').textContent = editando ? 'Editar cupom' : 'Confira antes de lançar';
  document.getElementById('rotuloTotalRevisao').textContent = editando ? 'Total do cupom' : 'Total a lançar';
  document.getElementById('botaoLancarNfce').textContent = editando ? 'Salvar alterações' : 'Lançar cupom';

  const juntadas = (cupomEmRevisao.linhas_originais || 0) - cupomEmRevisao.itens.length;
  document.getElementById('subtituloRevisaoNfce').textContent = editando
    ? 'Alterar quantidade, custo ou vínculo recalcula o custo dos produtos deste cupom.'
    : cupomEmRevisao.itens.length + ' itens lidos' +
      (juntadas > 0 ? ' · ' + juntadas + ' linha(s) repetida(s) já somada(s)' : '');

  document.getElementById('mercadoRevisao').value = cupomEmRevisao.mercado || '';
  document.getElementById('dataRevisao').value = cupomEmRevisao.data || '';
  document.getElementById('documentoRevisao').value = cupomEmRevisao.documento || '';
  document.getElementById('observacaoRevisao').value = cupomEmRevisao.observacao || '';

  const suspeitos = cupomEmRevisao.itens.filter(function (i) { return itemSuspeito_(i); }).length;
  const palpites = cupomEmRevisao.itens.filter(function (i) { return i.origem_vinculo === 'palpite'; }).length;
  const semVinculo = cupomEmRevisao.itens.filter(function (i) { return !i.produto; }).length;

  const avisos = [];
  if (suspeitos) avisos.push('<div class="aviso-revisao grave"><strong>' + suspeitos + ' item(ns) parecem ser fardo, não unidade.</strong> ' +
    'Informe quantas unidades vêm no fardo no campo da própria linha — o sistema divide o custo pra você.</div>');
  if (palpites) avisos.push('<div class="aviso-revisao"><strong>' + palpites + ' vínculo(s) são palpite do sistema</strong> (em azul). ' +
    'Confira — ao confirmar, ele aprende e na próxima vez esse item vem verde.</div>');
  if (semVinculo) avisos.push('<div class="aviso-revisao"><strong>' + semVinculo + ' item(ns) sem vínculo.</strong> ' +
    'Escolha o produto, ou deixe em branco: o item entra no histórico e fica em "Aguardando vínculo".</div>');
  document.getElementById('avisosRevisaoNfce').innerHTML = blocoConciliacao_() + avisos.join('');

  const opcoes = '<option value="">Sem vínculo</option>' +
    dadosAquisicao.produtos.map(function (p) {
      return '<option value="' + escaparHtml_(p.nome) + '">' + escaparHtml_(p.nome) + '</option>';
    }).join('');

  const lista = document.getElementById('listaRevisaoNfce');
  lista.innerHTML = cupomEmRevisao.itens.map(function (i, indice) {
    const suspeito = itemSuspeito_(i);
    const selo = i.origem_vinculo === 'palpite'
      ? '<span class="selo-vinculo palpite">palpite</span>'
      : (i.origem_vinculo === 'aprendido' ? '<span class="selo-vinculo aprendido">aprendido</span>' : '');

    // O bloco do fardo pede o único número que só a pessoa sabe — quantas unidades
    // vêm no fardo. O resto (quantidade final e custo por unidade) é conta, e conta
    // é trabalho do sistema. A versão anterior pedia os dois números já calculados,
    // e era isso que confundia na hora de lançar.
    const blocoFardo = suspeito
      ? '<div class="bloco-fardo">' +
          '<div class="motivo-fardo">' +
            (i.alerta_fardo
              ? 'A descrição indica fardo/pack.'
              : 'O custo unitário (' + formatarMoeda(i.custo_unit) + ') está acima do seu preço de venda (' + formatarMoeda(i.preco_venda_atual) + ').') +
          '</div>' +
          '<div class="acao-fardo">' +
            '<label>Unidades por fardo' +
              '<input type="number" min="2" step="1" id="unidadesFardo-' + indice + '" placeholder="ex: 12">' +
            '</label>' +
            '<button type="button" onclick="desmembrarFardo(' + indice + ')">Desmembrar</button>' +
            '<button type="button" class="btn-fardo-ignorar" onclick="ignorarAlertaFardo(' + indice + ')">É unidade mesmo</button>' +
          '</div>' +
        '</div>'
      : '';

    const notaDesmembrado = i.desmembrado
      ? '<div class="nota-desmembrado">Fardo de ' + i.desmembrado + ' un desmembrado: ' +
          // Sempre o valor do cupom, nunca o já descontado — é esse número que a
          // pessoa confere contra o papel na mão.
          formatarMoeda(i.qtd * i.custo_unit_bruto) + ' ÷ ' + i.qtd + ' = ' + formatarMoeda(i.custo_unit_bruto) + '/un</div>'
      : '';

    return '<div class="linha-revisao' + (suspeito ? ' suspeita' : '') + '">' +
      '<div class="cabecalho-revisao">' +
        '<span class="numero-item"' + ((i.numeros || []).length > 1
          ? ' title="Linhas ' + i.numeros.join(', ') + ' do cupom, somadas por serem o mesmo item"'
          : '') + '>' + numeroDaLinha_(i, indice) + '</span>' +
        '<div class="desc">' + escaparHtml_(i.descricao_cupom) + selo +
          '<span class="meta">' + (i.codigo ? 'cód ' + escaparHtml_(i.codigo) + ' · ' : '') + escaparHtml_(i.unidade || '') + '</span>' +
        '</div>' +
        '<div class="valor">' +
          (i.desconto > 0 ? '<span class="valor-bruto">' + formatarMoeda(i.qtd * i.custo_unit_bruto) + '</span>' : '') +
          formatarMoeda(i.custo_total) +
          (i.desconto > 0 ? '<span class="unit-liquido">' + formatarMoeda(i.custo_unit) + '/un</span>' : '') +
        '</div>' +
      '</div>' +
      blocoFardo +
      notaDesmembrado +
      '<div class="controles-revisao">' +
        '<select onchange="mudarVinculoNfce(' + indice + ', this.value)">' + opcoes + '</select>' +
        '<label class="campo-inline">Qtd<input type="number" min="0" step="1" value="' + i.qtd +
          '" onchange="mudarQtdNfce(' + indice + ', this.value)"></label>' +
        '<label class="campo-inline">Custo un.<input type="number" min="0" step="0.01" value="' + i.custo_unit_bruto.toFixed(2) +
          '" onchange="mudarCustoNfce(' + indice + ', this.value)"></label>' +
        // "da linha" no rótulo porque é a dúvida natural: o desconto vai sobre o
        // total do item, como vem no cupom — não sobre a unidade. Quem divide
        // pela quantidade é o sistema.
        '<label class="campo-inline' + (i.desconto > 0 ? ' com-desconto' : '') + '">Desc. da linha' +
          '<input type="number" min="0" step="0.01" value="' + (Number(i.desconto) || 0).toFixed(2) +
          '" title="Desconto em reais sobre o total desta linha (' + formatarMoeda(i.qtd * i.custo_unit_bruto) +
          '), do jeito que aparece no cupom. O sistema divide pela quantidade." ' +
          'onchange="mudarDescontoItem(' + indice + ', this.value)"></label>' +
        '<button type="button" class="btn-remover-revisao" onclick="removerItemNfce(' + indice + ')" title="Tirar do cupom">×</button>' +
      '</div>' +
    '</div>';
  }).join('');

  lista.querySelectorAll('.linha-revisao').forEach(function (el, indice) {
    el.querySelector('select').value = cupomEmRevisao.itens[indice].produto || '';
  });

  document.getElementById('totalRevisaoNfce').textContent = formatarMoeda(
    cupomEmRevisao.itens.reduce(function (s, i) { return s + i.custo_total; }, 0));
}

// Linha que provavelmente não é uma unidade de venda. Deixa de ser suspeita depois
// de desmembrada ou quando a pessoa diz que é unidade mesmo.
function itemSuspeito_(item) {
  if (item.desmembrado || item.fardo_ignorado) return false;
  return !!(item.alerta_fardo || item.alerta_custo_acima);
}

function desmembrarFardo(indice) {
  const item = cupomEmRevisao.itens[indice];
  const campo = document.getElementById('unidadesFardo-' + indice);
  const unidades = Math.floor(Number(campo.value) || 0);
  if (unidades < 2) {
    mostrarBannerRevisaoNfce_('erro', 'Informe quantas unidades vêm no fardo (2 ou mais).');
    campo.focus();
    return;
  }

  // O valor pago na linha é o que o cupom diz e não muda — o que muda é em quantas
  // unidades ele se divide. Guardo o custo unitário com precisão cheia pra soma do
  // cupom continuar batendo com o papel; a tela mostra 2 casas.
  const valorDaLinha = item.qtd * item.custo_unit_bruto;
  item.qtd = item.qtd * unidades;
  item.custo_unit_bruto = valorDaLinha / item.qtd;
  item.desmembrado = unidades;
  recalcularCustosRevisao_();

  // Com o custo por unidade correto, o alerta de "custo acima do preço" precisa ser
  // reavaliado: se ainda estiver acima, continua valendo o aviso.
  item.alerta_fardo = false;
  if (item.alerta_custo_acima) item.desmembrado = 0;

  mostrarBannerRevisaoNfce_('', '');
  renderizarRevisaoNfce();
}

function ignorarAlertaFardo(indice) {
  cupomEmRevisao.itens[indice].fardo_ignorado = true;
  renderizarRevisaoNfce();
}

function mudarVinculoNfce(indice, produto) {
  const item = cupomEmRevisao.itens[indice];
  item.produto = produto;
  // Escolha da pessoa deixa de ser palpite — e some o selo azul.
  item.origem_vinculo = produto ? 'confirmado' : '';
  // Vinculado a outro produto, o preço de venda de referência muda, e com ele o
  // alerta de custo acima do preço.
  const doCatalogo = dadosAquisicao.produtos.find(function (p) { return p.nome === produto; });
  item.preco_venda_atual = doCatalogo ? doCatalogo.preco : 0;
  item.alerta_custo_acima = !!(item.preco_venda_atual > 0 && item.custo_unit >= item.preco_venda_atual);
  renderizarRevisaoNfce();
}

function mudarQtdNfce(indice, valor) {
  const item = cupomEmRevisao.itens[indice];
  item.qtd = Math.max(0, Math.floor(Number(valor) || 0));
  recalcularCustosRevisao_();
  renderizarRevisaoNfce();
}

function mudarCustoNfce(indice, valor) {
  const item = cupomEmRevisao.itens[indice];
  // O campo edita o custo de tabela da linha; o desconto dela continua do lado.
  item.custo_unit_bruto = Math.max(0, Number(String(valor).replace(',', '.')) || 0);
  recalcularCustosRevisao_();
  renderizarRevisaoNfce();
}

function removerItemNfce(indice) {
  cupomEmRevisao.itens.splice(indice, 1);
  if (cupomEmRevisao.itens.length === 0) { cancelarRevisaoNfce(); return; }
  recalcularCustosRevisao_();
  renderizarRevisaoNfce();
}

function cancelarRevisaoNfce() {
  cupomEmRevisao = null;
  modoRevisao = 'importar';
  document.getElementById('blocoRevisaoNfce').classList.add('oculto');
  document.getElementById('urlNfce').value = '';
  document.getElementById('conteudoNfce').value = '';
  mostrarBannerRevisaoNfce_('', '');
}

async function lancarNfce() {
  if (!cupomEmRevisao || cupomEmRevisao.itens.length === 0) return;
  mudarCabecalhoRevisao();

  if (!cupomEmRevisao.mercado) { mostrarBannerRevisaoNfce_('erro', 'Informe onde a compra foi feita.'); return; }
  if (!cupomEmRevisao.data) { mostrarBannerRevisaoNfce_('erro', 'Informe a data da compra.'); return; }

  const validos = cupomEmRevisao.itens.filter(function (i) { return i.qtd > 0 && i.custo_unit > 0; });
  if (validos.length === 0) {
    mostrarBannerRevisaoNfce_('erro', 'Nenhum item com quantidade e custo válidos.');
    return;
  }

  const editando = modoRevisao === 'editar';
  const botao = document.getElementById('botaoLancarNfce');
  botao.disabled = true;
  botao.classList.add('carregando');
  try {
    const resposta = await chamarApi({
      action: editando ? 'atualizarCompra' : 'criarCompra',
      id: cupomEmRevisao.id,
      data: cupomEmRevisao.data,
      mercado: cupomEmRevisao.mercado,
      // O CNPJ é o escopo do de-para: bem mais confiável que o nome do mercado,
      // que muda de grafia a cada digitação. Na edição de um cupom antigo não
      // temos o CNPJ, e aí o nome do mercado serve de escopo.
      loja: cupomEmRevisao.cnpj || cupomEmRevisao.mercado,
      documento: cupomEmRevisao.documento,
      observacao: cupomEmRevisao.observacao,
      origem: editando ? undefined : 'nfce',
      itens: validos.map(function (i) {
        // custo_unit já é líquido; desconto vai junto pra planilha guardar o que
        // foi abatido em cada linha, e a edição conseguir reconstruir o bruto.
        return {
          produto: i.produto, descricao_cupom: i.descricao_cupom, codigo: i.codigo,
          qtd: i.qtd, custo_unit: i.custo_unit, desconto: i.desconto || 0
        };
      })
    }, 'POST');
    if (!resposta.ok) throw new Error(resposta.erro || 'Erro ao salvar.');

    const comCusto = resposta.dados.produtos_com_custo || 0;
    cancelarRevisaoNfce();
    mostrarBannerNfce_('sucesso', (editando ? 'Cupom atualizado. ' : 'Cupom lançado. ') +
      comCusto + ' produto(s) com custo atualizado — confira a aba Ajuste de preço.');
    await carregarAquisicao();
    await recarregarBootstrap_();
  } catch (err) {
    mostrarBannerRevisaoNfce_('erro', 'Falha ao salvar. Verifique a conexão e tente novamente.');
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

// ===================== LUCRO PREVISTO =====================
// "Previsto" no nome em todo lugar, de propósito. O sistema conhece o que entrou
// (cupom) e a que preço está na prateleira, então sabe quanto AQUELE estoque
// renderia se vendido hoje. Venda mesmo ele não vê — acontece na Pináculo. Chamar
// isso de lucro do mês seria convidar a decidir em cima de dinheiro que ainda não
// existe.
const NOMES_MESES_AQUISICAO_ = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function rotuloMes_(mes) {
  const partes = String(mes).split('-');
  if (partes.length !== 2) return mes;
  // Só a primeira letra em maiúscula: "Julho de 2026", não "Julho De 2026" —
  // que é o que o text-transform: capitalize do CSS fazia.
  const nome = NOMES_MESES_AQUISICAO_[Number(partes[1]) - 1] || '';
  return nome.charAt(0).toUpperCase() + nome.slice(1) + ' de ' + partes[0];
}

function renderizarLucroMes() {
  const lista = document.getElementById('listaLucroMes');
  const meses = dadosAquisicao.lucroPorMes || [];

  if (meses.length === 0) {
    lista.innerHTML = '<div class="vazio-relacao">Nenhum cupom lançado ainda — o lucro previsto aparece aqui depois do primeiro.</div>';
    return;
  }

  lista.innerHTML = meses.map(function (m, indice) {
    const fora = m.itens_fora > 0
      ? '<div class="nota-fora">' + m.itens_fora + ' item(ns) fora da conta (' + formatarMoeda(m.custo_fora) +
        ' em compras sem produto vinculado ou sem preço de venda).</div>'
      : '';
    return '<div class="card-mes' + (indice === 0 ? ' atual' : '') + '">' +
      '<div class="topo-mes">' +
        '<div class="nome-mes">' + rotuloMes_(m.mes) + '<span>' + m.compras + ' cupom(ns)</span></div>' +
        '<div class="lucro-mes">' + formatarMoeda(m.lucro_previsto) +
          '<span>' + (m.margem_pct === null ? '—' : formatarPct_(m.margem_pct).replace('+', '') + ' sobre o custo') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="numeros-mes">' +
        '<div><span>Custo das compras</span><strong>' + formatarMoeda(m.custo) + '</strong></div>' +
        '<div><span>Venda prevista</span><strong>' + formatarMoeda(m.venda_prevista) + '</strong></div>' +
      '</div>' +
      fora +
    '</div>';
  }).join('');
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
      (c.lucro && c.lucro.custo > 0
        ? '<div class="lucro-cupom">' +
            '<span>Custo <strong>' + formatarMoeda(c.lucro.custo) + '</strong></span>' +
            '<span>Venda prevista <strong>' + formatarMoeda(c.lucro.venda_prevista) + '</strong></span>' +
            '<span class="destaque">Lucro previsto <strong>' + formatarMoeda(c.lucro.lucro_previsto) + '</strong>' +
              (c.lucro.margem_pct === null ? '' : ' <em>' + formatarPct_(c.lucro.margem_pct).replace('+', '') + '</em>') +
            '</span>' +
            (c.lucro.itens_fora > 0
              ? '<span class="fora">' + c.lucro.itens_fora + ' item(ns) fora da conta</span>'
              : '') +
          '</div>'
        : '') +
      aviso +
      '<div class="acoes-relacao">' +
        '<button type="button" onclick="editarCupom(\'' + c.id + '\')">Editar</button>' +
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

// ===================== PAINEL DE GESTÃO =====================
// Gráficos em SVG feito à mão, sem biblioteca: o app inteiro é assim, e uma
// dependência a mais só pra desenhar barra não se paga.
//
// Cores das séries validadas contra daltonismo e contraste (ΔE 24,7 protanopia,
// ambas acima de 3:1 no fundo claro). O laranja da marca (#F97316) reprova
// contraste como preenchimento grande, então ele fica no chrome — botão, aba
// ativa — e as séries usam o passo mais escuro.

const MESES_CURTOS_ = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function moedaCurta_(valor) {
  const n = Number(valor) || 0;
  if (Math.abs(n) >= 1000) return 'R$ ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k';
  return formatarMoeda(n);
}

function svg_(conteudo, largura, altura) {
  return '<svg viewBox="0 0 ' + largura + ' ' + altura + '" preserveAspectRatio="none" role="img">' + conteudo + '</svg>';
}

// Tooltip único, reaproveitado por todos os gráficos.
function dicaGrafico_(mostrar, ev, html) {
  let dica = document.getElementById('dicaGrafico');
  if (!dica) {
    dica = document.createElement('div');
    dica.id = 'dicaGrafico';
    dica.className = 'dica-grafico';
    document.body.appendChild(dica);
  }
  if (!mostrar) { dica.classList.remove('visivel'); return; }
  dica.innerHTML = html;
  dica.classList.add('visivel');
  const margem = 14;
  const largura = dica.offsetWidth;
  let x = ev.clientX + margem;
  if (x + largura > window.innerWidth - 8) x = ev.clientX - largura - margem;
  dica.style.left = x + 'px';
  dica.style.top = Math.max(8, ev.clientY - dica.offsetHeight - margem) + 'px';
}

function anosDisponiveis_() {
  const painel = dadosAquisicao.painel;
  if (!painel) return [];
  return painel.anos.map(function (a) { return a.periodo; });
}

function renderizarPainel() {
  const painel = dadosAquisicao.painel;
  const vazio = document.getElementById('painelVazio');
  const conteudo = document.getElementById('painelConteudo');
  if (!painel || painel.anos.length === 0) {
    vazio.classList.remove('oculto');
    conteudo.classList.add('oculto');
    return;
  }
  vazio.classList.add('oculto');
  conteudo.classList.remove('oculto');

  const select = document.getElementById('filtroAnoPainel');
  const anos = anosDisponiveis_();
  if (select.options.length !== anos.length) {
    select.innerHTML = anos.map(function (a) { return '<option value="' + a + '">' + a + '</option>'; }).join('');
  }
  const ano = select.value && anos.indexOf(select.value) !== -1 ? select.value : anos[0];
  select.value = ano;

  const doAno = painel.anos.find(function (a) { return a.periodo === ano; }) || painel.anos[0];
  const mesesDoAno = painel.meses.filter(function (m) { return m.periodo.slice(0, 4) === ano; });

  renderizarTilesPainel_(doAno, painel);
  renderizarOportunidade_(painel.oportunidade);
  renderizarGraficoMeses_(mesesDoAno, ano);
  renderizarGraficoMargem_(mesesDoAno, ano);
  renderizarMercados_(painel.mercados);
  renderizarGraficoFaixas_(painel.faixas);
  renderizarTabelaProdutos_(painel.topProdutos);
  renderizarCobertura_(painel.cobertura);
}

function renderizarTilesPainel_(ano, painel) {
  const tiles = [
    { rotulo: 'Investido em compras', valor: formatarMoeda(ano.custo),
      nota: ano.compras + ' cupom(ns) no ano' },
    { rotulo: 'Faturamento previsto', valor: formatarMoeda(ano.venda_prevista),
      nota: 'se vender tudo ao preço de hoje' },
    { rotulo: 'Lucro previsto', valor: formatarMoeda(ano.lucro_previsto), destaque: true,
      nota: ano.margem_pct === null ? '—' : formatarPct_(ano.margem_pct).replace('+', '') + ' sobre o custo' },
    { rotulo: 'Desconto obtido', valor: formatarMoeda(ano.desconto),
      nota: ano.desconto_pct ? formatarPct_(ano.desconto_pct).replace('+', '') + ' do que o cupom pedia' : 'nenhum lançado' }
  ];
  document.getElementById('tilesPainel').innerHTML = tiles.map(function (t) {
    return '<div class="tile-painel' + (t.destaque ? ' destaque' : '') + '">' +
      '<span class="rotulo">' + t.rotulo + '</span>' +
      '<strong>' + t.valor + '</strong>' +
      '<span class="nota">' + t.nota + '</span>' +
    '</div>';
  }).join('');
}

function renderizarOportunidade_(op) {
  const bloco = document.getElementById('blocoOportunidade');
  if (!op || op.produtos === 0) {
    bloco.innerHTML = '<div class="op-vazia"><strong>Nenhum preço pendente.</strong> ' +
      'Todo produto com custo lançado já está no alvo da própria faixa.</div>';
    return;
  }
  const linhas = op.detalhe.map(function (d) {
    const sobe = d.ganho >= 0;
    return '<tr>' +
      '<td>' + escaparHtml_(d.nome) + '</td>' +
      '<td class="num">' + d.qtd_comprada + '</td>' +
      '<td class="num">' + formatarMoeda(d.preco) + '</td>' +
      '<td class="num">' + formatarMoeda(d.preco_sugerido) + '</td>' +
      '<td class="num ' + (sobe ? 'ganho' : 'perda') + '">' + (sobe ? '+' : '') + formatarMoeda(d.ganho) + '</td>' +
    '</tr>';
  }).join('');

  bloco.innerHTML =
    '<div class="op-topo">' +
      '<div>' +
        '<span class="rotulo">Parado na fila de ajuste</span>' +
        '<strong>' + formatarMoeda(op.ganho_total) + '</strong>' +
        '<span class="nota">em ' + op.produtos + ' produto(s) — é o quanto o volume que você já comprou renderia a mais ' +
          'se estivesse no preço sugerido. Aplique na aba Ajuste de preço.</span>' +
      '</div>' +
    '</div>' +
    '<div class="tabela-rolagem"><table class="tabela-painel">' +
      '<thead><tr><th>Produto</th><th class="num">Comprado</th><th class="num">Preço hoje</th>' +
      '<th class="num">Sugerido</th><th class="num">Diferença</th></tr></thead>' +
      '<tbody>' + linhas + '</tbody>' +
    '</table></div>';
}

// Barras empilhadas: custo embaixo, lucro em cima. A altura total é o faturamento
// previsto — encoda a relação real (custo + lucro = faturamento) em vez de tratar
// as três como séries independentes.
function renderizarGraficoMeses_(meses, ano) {
  const alvo = document.getElementById('graficoMeses');
  const porMes = {};
  meses.forEach(function (m) { porMes[Number(m.periodo.slice(5, 7))] = m; });

  const topo = Math.max.apply(null, meses.map(function (m) { return m.venda_prevista; }).concat([1]));
  const A = 190, LARGURA_BARRA = 34, ESPACO = 12;
  const L = 12 * (LARGURA_BARRA + ESPACO);
  const escala = function (v) { return (v / topo) * (A - 26); };

  let corpo = '';
  // Grade recessiva: 4 linhas horizontais, sem eixo desenhado.
  for (let i = 1; i <= 4; i++) {
    const y = A - 26 - ((A - 26) / 4) * i + 26;
    corpo += '<line x1="0" y1="' + y + '" x2="' + L + '" y2="' + y + '" class="grade"/>';
  }

  for (let mes = 1; mes <= 12; mes++) {
    const x = (mes - 1) * (LARGURA_BARRA + ESPACO) + ESPACO / 2;
    const m = porMes[mes];
    if (!m) continue;
    const hCusto = escala(m.custo);
    const hLucro = escala(m.lucro_previsto);
    // 2px de respiro entre os dois segmentos, como manda a anatomia de empilhado.
    const yCusto = A - hCusto;
    const yLucro = yCusto - hLucro - 2;
    corpo += '<rect x="' + x + '" y="' + yCusto + '" width="' + LARGURA_BARRA + '" height="' + Math.max(hCusto, 1) + '" rx="3" class="barra-custo"/>';
    if (hLucro > 0) {
      corpo += '<rect x="' + x + '" y="' + yLucro + '" width="' + LARGURA_BARRA + '" height="' + Math.max(hLucro, 1) + '" rx="3" class="barra-lucro"/>';
    }
  }

  const rotulos = [];
  for (let mes = 1; mes <= 12; mes++) {
    const m = porMes[mes];
    rotulos.push('<div class="rotulo-mes' + (m ? ' tem-dado' : '') + '"' +
      (m ? ' data-mes="' + mes + '"' : '') + '>' + MESES_CURTOS_[mes - 1] + '</div>');
  }

  alvo.innerHTML = '<div class="grafico-barras">' + svg_(corpo, L, A) +
    '<div class="eixo-meses">' + rotulos.join('') + '</div></div>';

  // Hover na coluna inteira (alvo maior que a barra), como manda a interação.
  alvo.querySelectorAll('.rotulo-mes.tem-dado').forEach(function (el) {
    const m = porMes[Number(el.dataset.mes)];
    el.onmousemove = function (ev) {
      dicaGrafico_(true, ev,
        '<strong>' + MESES_CURTOS_[Number(el.dataset.mes) - 1] + '/' + ano + '</strong>' +
        '<span><i class="marca" style="background:var(--serie-custo)"></i>Custo <b>' + formatarMoeda(m.custo) + '</b></span>' +
        '<span><i class="marca" style="background:var(--serie-lucro)"></i>Lucro previsto <b>' + formatarMoeda(m.lucro_previsto) + '</b></span>' +
        '<span class="total">Faturamento previsto <b>' + formatarMoeda(m.venda_prevista) + '</b></span>' +
        '<span class="total">Margem <b>' + (m.margem_pct === null ? '—' : formatarPct_(m.margem_pct).replace('+', '')) + '</b></span>');
    };
    el.onmouseleave = function () { dicaGrafico_(false); };
  });
}

// Série única: sem legenda, o título já nomeia. Linha de 2px, ponto de 8px só nos
// meses com dado.
function renderizarGraficoMargem_(meses, ano) {
  const alvo = document.getElementById('graficoMargem');
  const comDado = meses.filter(function (m) { return m.margem_pct !== null; })
    .slice().sort(function (a, b) { return a.periodo.localeCompare(b.periodo); });

  if (comDado.length === 0) {
    alvo.innerHTML = '<div class="grafico-vazio">Sem margem calculada neste ano.</div>';
    return;
  }

  const A = 190, L = 12 * 46;
  const topo = Math.max.apply(null, comDado.map(function (m) { return m.margem_pct; }).concat([10])) * 1.15;
  const x = function (mes) { return (mes - 0.5) * 46; };
  const y = function (v) { return A - 22 - (v / topo) * (A - 44); };

  let corpo = '';
  for (let i = 1; i <= 4; i++) {
    const yy = 22 + ((A - 44) / 4) * (4 - i);
    corpo += '<line x1="0" y1="' + yy + '" x2="' + L + '" y2="' + yy + '" class="grade"/>';
  }
  // Sem referência de escala a grade vira enfeite. Um rótulo no topo basta —
  // os valores de cada mês já vão diretos embaixo das bolinhas.
  corpo += '<text x="0" y="14" class="rotulo-escala">' + Math.round(topo) + '%</text>';

  const pontos = comDado.map(function (m) { return [x(Number(m.periodo.slice(5, 7))), y(m.margem_pct)]; });
  if (pontos.length > 1) {
    corpo += '<polyline points="' + pontos.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '" class="linha-margem"/>';
  }
  pontos.forEach(function (p) { corpo += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4.5" class="ponto-margem"/>'; });

  const rotulos = [];
  for (let mes = 1; mes <= 12; mes++) {
    const m = comDado.find(function (x2) { return Number(x2.periodo.slice(5, 7)) === mes; });
    rotulos.push('<div class="rotulo-mes' + (m ? ' tem-dado' : '') + '"' + (m ? ' data-mes="' + mes + '"' : '') + '>' +
      MESES_CURTOS_[mes - 1] + (m ? '<b>' + Math.round(m.margem_pct) + '%</b>' : '') + '</div>');
  }

  alvo.innerHTML = '<div class="grafico-barras">' + svg_(corpo, L, A) +
    '<div class="eixo-meses">' + rotulos.join('') + '</div></div>';

  alvo.querySelectorAll('.rotulo-mes.tem-dado').forEach(function (el) {
    const m = comDado.find(function (x2) { return Number(x2.periodo.slice(5, 7)) === Number(el.dataset.mes); });
    el.onmousemove = function (ev) {
      dicaGrafico_(true, ev, '<strong>' + MESES_CURTOS_[Number(el.dataset.mes) - 1] + '/' + ano + '</strong>' +
        '<span class="total">Margem prevista <b>' + formatarPct_(m.margem_pct).replace('+', '') + '</b></span>' +
        '<span class="total">Sobre custo de <b>' + formatarMoeda(m.custo) + '</b></span>');
    };
    el.onmouseleave = function () { dicaGrafico_(false); };
  });
}

// Magnitude de uma medida por categoria = uma cor só, intensidade pelo tamanho da
// barra. Categórico aqui seria colorir por colorir.
function renderizarMercados_(mercados) {
  const alvo = document.getElementById('graficoMercados');
  if (!mercados.length) { alvo.innerHTML = '<div class="grafico-vazio">Nenhuma compra lançada.</div>'; return; }

  const topo = Math.max.apply(null, mercados.map(function (m) { return m.custo; }).concat([1]));
  alvo.innerHTML = '<div class="barras-h">' + mercados.map(function (m) {
    return '<div class="barra-h" data-mercado="' + escaparHtml_(m.mercado) + '">' +
      '<div class="rotulo-h">' + escaparHtml_(m.mercado) + '</div>' +
      '<div class="trilho"><div class="preenchimento" style="width:' + Math.max((m.custo / topo) * 100, 2) + '%"></div></div>' +
      '<div class="valor-h">' + moedaCurta_(m.custo) + '</div>' +
    '</div>';
  }).join('') + '</div>';

  alvo.querySelectorAll('.barra-h').forEach(function (el) {
    const m = mercados.find(function (x) { return x.mercado === el.dataset.mercado; });
    el.onmousemove = function (ev) {
      dicaGrafico_(true, ev, '<strong>' + escaparHtml_(m.mercado) + '</strong>' +
        '<span class="total">Investido <b>' + formatarMoeda(m.custo) + '</b></span>' +
        '<span class="total">Lucro previsto <b>' + formatarMoeda(m.lucro_previsto) + '</b></span>' +
        '<span class="total">Margem <b>' + (m.margem_pct === null ? '—' : formatarPct_(m.margem_pct).replace('+', '')) + '</b></span>' +
        '<span class="total">' + m.compras + ' cupom(ns)</span>');
    };
    el.onmouseleave = function () { dicaGrafico_(false); };
  });

  document.getElementById('tabelaMercados').innerHTML =
    '<thead><tr><th>Mercado</th><th class="num">Cupons</th><th class="num">Investido</th>' +
    '<th class="num">Lucro previsto</th><th class="num">Margem</th></tr></thead><tbody>' +
    mercados.map(function (m) {
      return '<tr><td>' + escaparHtml_(m.mercado) + '</td>' +
        '<td class="num">' + m.compras + '</td>' +
        '<td class="num">' + formatarMoeda(m.custo) + '</td>' +
        '<td class="num">' + formatarMoeda(m.lucro_previsto) + '</td>' +
        '<td class="num forte">' + (m.margem_pct === null ? '—' : formatarPct_(m.margem_pct).replace('+', '')) + '</td></tr>';
    }).join('') + '</tbody>';
}

// Praticado × alvo lado a lado. O alvo vira um traço vertical sobre a barra do
// praticado: dá pra ler a distância sem comparar duas barras separadas.
function renderizarGraficoFaixas_(faixas) {
  const alvo = document.getElementById('graficoFaixas');
  const comDado = faixas.filter(function (f) { return f.com_custo > 0 || f.margem_alvo_pct !== null; });
  if (!comDado.length) { alvo.innerHTML = '<div class="grafico-vazio">Sem faixa configurada.</div>'; return; }

  const topo = Math.max.apply(null, comDado.map(function (f) {
    return Math.max(f.margem_media_pct || 0, f.margem_alvo_pct || 0);
  }).concat([10])) * 1.12;

  alvo.innerHTML = '<div class="barras-h faixas">' + comDado.map(function (f) {
    const praticado = f.margem_media_pct;
    const larguraPraticado = praticado === null ? 0 : (praticado / topo) * 100;
    const posAlvo = f.margem_alvo_pct === null ? null : (f.margem_alvo_pct / topo) * 100;
    // Uma cor só pra "margem praticada". Pintar de outra cor quem passou do alvo
    // faria a cor significar o rank em vez da série — e a legenda passaria a
    // mentir. A distância pro alvo já se lê na posição do traço.
    return '<div class="barra-h" data-faixa="' + escaparHtml_(f.rotulo) + '">' +
      '<div class="rotulo-h">' + escaparHtml_(f.rotulo) + '<span>' + f.com_custo + '/' + f.produtos + ' com custo</span></div>' +
      '<div class="trilho">' +
        '<div class="preenchimento" style="width:' + Math.max(larguraPraticado, 0) + '%"></div>' +
        (posAlvo === null ? '' : '<div class="marca-alvo" style="left:' + posAlvo + '%" title="Alvo da faixa"></div>') +
      '</div>' +
      '<div class="valor-h">' + (praticado === null ? '—' : Math.round(praticado) + '%') + '</div>' +
    '</div>';
  }).join('') + '</div>' +
  '<div class="legenda-grafico"><span><i class="marca" style="background:var(--serie-lucro)"></i> Margem praticada</span>' +
  '<span><i class="marca traco"></i> Alvo da faixa</span></div>';

  alvo.querySelectorAll('.barra-h').forEach(function (el) {
    const f = comDado.find(function (x) { return x.rotulo === el.dataset.faixa; });
    el.onmousemove = function (ev) {
      dicaGrafico_(true, ev, '<strong>' + escaparHtml_(f.rotulo) + '</strong>' +
        '<span class="total">Praticada <b>' + (f.margem_media_pct === null ? '—' : Math.round(f.margem_media_pct) + '%') + '</b></span>' +
        '<span class="total">Alvo <b>' + (f.margem_alvo_pct === null ? '—' : f.margem_alvo_pct + '%') + '</b></span>' +
        '<span class="total">' + f.produtos + ' produto(s), ' + f.com_custo + ' com custo</span>' +
        '<span class="total">' + f.fora_do_alvo + ' fora do alvo</span>');
    };
    el.onmouseleave = function () { dicaGrafico_(false); };
  });
}

function renderizarTabelaProdutos_(produtos) {
  const tabela = document.getElementById('tabelaProdutos');
  if (!produtos.length) {
    tabela.innerHTML = '<tbody><tr><td class="vazio-celula">Nenhum produto com custo e preço ainda.</td></tr></tbody>';
    return;
  }
  tabela.innerHTML =
    '<thead><tr><th>Produto</th><th class="num">Comprado</th><th class="num">Custo</th>' +
    '<th class="num">Faturamento previsto</th><th class="num">Lucro previsto</th><th class="num">Margem</th></tr></thead><tbody>' +
    produtos.map(function (p) {
      return '<tr><td>' + escaparHtml_(p.nome) + '</td>' +
        '<td class="num">' + p.qtd + '</td>' +
        '<td class="num">' + formatarMoeda(p.custo) + '</td>' +
        '<td class="num">' + formatarMoeda(p.venda_prevista) + '</td>' +
        '<td class="num forte">' + formatarMoeda(p.lucro_previsto) + '</td>' +
        '<td class="num">' + Math.round(p.margem_pct) + '%</td></tr>';
    }).join('') + '</tbody>';
}

function renderizarCobertura_(c) {
  const itens = [
    { rotulo: 'Produtos no catálogo', valor: c.total },
    { rotulo: 'Já com custo', valor: c.com_custo, atencao: c.com_custo < c.total },
    { rotulo: 'Sem faixa de margem', valor: c.sem_faixa, atencao: c.sem_faixa > 0 },
    { rotulo: 'Preço travado', valor: c.travados },
    { rotulo: 'Na fila de ajuste', valor: c.na_fila, atencao: c.na_fila > 0 }
  ];
  document.getElementById('tilesCobertura').innerHTML = itens.map(function (i) {
    // 'atencao' e não 'aviso': já existe um .aviso no app (o box do template de
    // cobrança) que traz ícone via ::before e mexe no display do strong — reusar o
    // nome fazia esse estilo vazar pra cá.
    return '<div class="tile-cobertura' + (i.atencao ? ' atencao' : '') + '">' +
      '<strong>' + i.valor + '</strong><span>' + i.rotulo + '</span></div>';
  }).join('');
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
