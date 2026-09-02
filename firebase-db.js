/* ============================================================
   ALL IN HALL — firebase-db.js
   Backend Firestore de Alta Velocidade (< 50ms)
   Substitui o Google Apps Script mantendo 100% de compatibilidade
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyAyx7A1kid2JrTpWl0A157SAvR1TbMkn-8",
  authDomain: "allinhall-sistema.firebaseapp.com",
  projectId: "allinhall-sistema",
  storageBucket: "allinhall-sistema.firebasestorage.app",
  messagingSenderId: "759249719110",
  appId: "1:759249719110:web:69d4b98459c282e5df5f47"
};

// Inicializa o Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = (typeof firebase !== 'undefined' && firebase.apps.length) ? firebase.firestore() : null;

function formatarDataBRLocal_(iso) {
  if (!iso) return '';
  const p = String(iso).split('T')[0].split('-');
  if (p.length !== 3) return iso;
  return p[2] + '/' + p[1] + '/' + p[0];
}

// ===================== FUNÇÕES DE ACESSO AO BANCO FIRESTORE =====================

const FirebaseDB = {
  async verificarPin(pinDigitado) {
    if (!pinDigitado) throw new Error('Informe o PIN de acesso.');
    try {
      const doc = await db.collection('configuracoes').doc('geral').get();
      if (doc.exists) {
        const dados = doc.data();
        const pinCorreto = dados.pin_acesso || '888777';
        if (String(pinDigitado).trim() !== String(pinCorreto).trim()) {
          throw new Error('PIN inválido.');
        }
        return true;
      }
    } catch(e) {
      if (e.message === 'PIN inválido.') throw e;
    }
    if (String(pinDigitado).trim() !== '888777') {
      throw new Error('PIN inválido.');
    }
    return true;
  },

  async obterBootstrap() {
    const [snapConds, snapProds, snapPessoas] = await Promise.all([
      db.collection('condominios').get(),
      db.collection('produtos').get(),
      db.collection('pessoas').get()
    ]);

    const condominios = [];
    snapConds.forEach(doc => {
      const d = doc.data();
      if (d.ativo !== false) {
        const nome = d.nome_curto || d.nome_oficial || d.nome || doc.id;
        condominios.push({
          nome_curto: nome,
          nome_oficial: d.nome_oficial || nome,
          cidade: d.cidade || 'Curitiba',
          ativo: true
        });
      }
    });
    condominios.sort((a, b) => a.nome_curto.localeCompare(b.nome_curto));

    const produtos = [];
    snapProds.forEach(doc => {
      const d = doc.data();
      produtos.push({
        nome: d.nome || doc.id,
        preco: Number(d.preco) || 0,
        categoria: d.categoria || ''
      });
    });
    produtos.sort((a, b) => a.nome.localeCompare(b.nome));

    const pessoas = [];
    snapPessoas.forEach(doc => {
      const d = doc.data();
      pessoas.push({
        nome: d.nome || '',
        contato_whatsapp: d.contato_whatsapp || ''
      });
    });
    pessoas.sort((a, b) => a.nome.localeCompare(b.nome));

    return { condominios, produtos, pessoas };
  },

  async obterCalendario(condominio, ano, mes) {
    const chaveMes = String(ano) + '-' + String(mes).padStart(2, '0');

    // Consulta por condomínio simples (sem exigência de índices compostos)
    const [snapOc, snapDias] = await Promise.all([
      db.collection('ocorrencias')
        .where('condominio', '==', condominio)
        .get(),
      db.collection('dias_fechados')
        .where('condominio', '==', condominio)
        .get()
    ]);

    const ocorrencias = [];
    snapOc.forEach(doc => {
      const d = doc.data();
      if (d.status !== 'Cancelado' && String(d.data_ocorrencia || '').startsWith(chaveMes)) {
        ocorrencias.push(Object.assign({ id: doc.id }, d));
      }
    });

    const diasFechados = [];
    snapDias.forEach(doc => {
      const d = doc.data();
      if (String(d.data || '').startsWith(chaveMes)) {
        diasFechados.push(Object.assign({ id: doc.id }, d));
      }
    });

    return { ocorrencias, diasFechados };
  },

  async obterOcorrencias() {
    const snap = await db.collection('ocorrencias').get();
    const lista = [];
    snap.forEach(doc => {
      lista.push(Object.assign({ id: doc.id }, doc.data()));
    });
    lista.sort((a, b) => String(b.data_ocorrencia || '').localeCompare(String(a.data_ocorrencia || '')));
    return lista;
  },

  async criarOcorrencia(params) {
    const agora = new Date();
    const id = 'OC' + agora.getFullYear() +
      String(agora.getMonth() + 1).padStart(2, '0') +
      String(agora.getDate()).padStart(2, '0') +
      String(agora.getHours()).padStart(2, '0') +
      String(agora.getMinutes()).padStart(2, '0') +
      String(agora.getSeconds()).padStart(2, '0') +
      Math.floor(Math.random() * 90 + 10);

    const docData = {
      id: id,
      condominio: params.condominio || '',
      data_ocorrencia: params.data_ocorrencia || '',
      hora: params.hora || '',
      pessoa: params.pessoa || '',
      descricao_pessoa: params.descricao_pessoa || '',
      contato_whatsapp: params.contato_whatsapp || '',
      itens: params.itens || [],
      valor_total: Number(params.valor_total) || 0,
      observacao: params.observacao || '',
      status: params.pessoa ? 'Identificado' : 'Pendente',
      data_criacao: agora.toISOString(),
      data_cobranca: '',
      data_pagamento: '',
      data_prejuizo: '',
      grupo_cobranca_id: params.grupo_cobranca_id || '',
      furo_reposicao_id: params.furo_reposicao_id || ''
    };

    if (!docData.furo_reposicao_id && params.itens && params.itens.length > 0) {
      const comFuro = params.itens.find(i => i && i.furo_reposicao_id);
      if (comFuro) docData.furo_reposicao_id = comFuro.furo_reposicao_id;
    }

    await db.collection('ocorrencias').doc(id).set(docData);
    return { id: id };
  },

  async atualizarOcorrencia(params) {
    const id = params.id;
    if (!id) throw new Error('ID da ocorrência não informado.');
    const campos = Object.assign({}, params);
    delete campos.id;
    delete campos.action;
    delete campos.pin;
    await db.collection('ocorrencias').doc(id).update(campos);
    return { id: id, atualizado: true };
  },

  async excluirOcorrencia(params) {
    const id = params.id;
    if (!id) throw new Error('ID da ocorrência não informado.');
    await db.collection('ocorrencias').doc(id).delete();
    return { id: id, excluido: true };
  },

  async fecharDia(params) {
    const chave = (params.condominio + '_' + params.data).replace(/[^a-zA-Z0-9_-]/g, '_');
    const docData = {
      condominio: params.condominio,
      data: params.data,
      status_dia: params.status_dia || 'OK',
      data_fechamento: new Date().toISOString()
    };
    await db.collection('dias_fechados').doc(chave).set(docData);
    return { ok: true };
  },

  async limparDia(params) {
    const chave = (params.condominio + '_' + params.data).replace(/[^a-zA-Z0-9_-]/g, '_');
    await db.collection('dias_fechados').doc(chave).delete();
    return { ok: true };
  },

  async obterReposicoes() {
    const snap = await db.collection('reposicoes').get();
    const lista = [];
    snap.forEach(doc => {
      lista.push(Object.assign({ id: doc.id }, doc.data()));
    });
    lista.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
    return lista;
  },

  async criarReposicao(params) {
    const agora = new Date();

    if (params.sem_furos || (!params.itens && !params.produto)) {
      const id = 'REP' + agora.getFullYear() +
        String(agora.getMonth() + 1).padStart(2, '0') +
        String(agora.getDate()).padStart(2, '0') +
        String(agora.getHours()).padStart(2, '0') +
        String(agora.getMinutes()).padStart(2, '0') +
        String(agora.getSeconds()).padStart(2, '0') +
        Math.floor(Math.random() * 90 + 10);

      const docData = {
        id: id,
        condominio: params.condominio || '',
        data: params.data || '',
        produto: 'Reposição realizada (Sem furos)',
        quantidade: 0,
        preco_unit: 0,
        valor_total: 0,
        status: 'OK',
        pessoa: '',
        contato_whatsapp: '',
        data_infracao: '',
        hora_infracao: '',
        data_criacao: agora.toISOString()
      };
      await db.collection('reposicoes').doc(id).set(docData);
      return { id: id, ok: true };
    }

    if (params.itens && params.itens.length > 0) {
      const ids = [];
      for (let i = 0; i < params.itens.length; i++) {
        const item = params.itens[i];
        const id = 'REP' + agora.getFullYear() +
          String(agora.getMonth() + 1).padStart(2, '0') +
          String(agora.getDate()).padStart(2, '0') +
          String(agora.getHours()).padStart(2, '0') +
          String(agora.getMinutes()).padStart(2, '0') +
          String(agora.getSeconds()).padStart(2, '0') +
          '-' + i + Math.floor(Math.random() * 90 + 10);

        const docData = {
          id: id,
          condominio: params.condominio || '',
          data: params.data || '',
          produto: item.produto || '',
          quantidade: Number(item.qtd) || 0,
          preco_unit: Number(item.preco_unit) || 0,
          valor_total: (Number(item.qtd) || 0) * (Number(item.preco_unit) || 0),
          status: 'Pendente',
          pessoa: '',
          contato_whatsapp: '',
          data_infracao: '',
          hora_infracao: '',
          data_criacao: agora.toISOString()
        };
        await db.collection('reposicoes').doc(id).set(docData);
        ids.push(id);
      }
      return { ids: ids, ok: true };
    }

    // Item individual único
    const id = 'REP' + agora.getFullYear() +
      String(agora.getMonth() + 1).padStart(2, '0') +
      String(agora.getDate()).padStart(2, '0') +
      String(agora.getHours()).padStart(2, '0') +
      String(agora.getMinutes()).padStart(2, '0') +
      String(agora.getSeconds()).padStart(2, '0') +
      Math.floor(Math.random() * 90 + 10);

    const docData = {
      id: id,
      condominio: params.condominio || '',
      data: params.data || '',
      produto: params.produto || '',
      quantidade: Number(params.quantidade) || 0,
      preco_unit: Number(params.preco_unit) || 0,
      valor_total: (Number(params.quantidade) || 0) * (Number(params.preco_unit) || 0),
      status: params.status || 'Pendente',
      pessoa: params.pessoa || '',
      contato_whatsapp: params.contato_whatsapp || '',
      data_infracao: params.data_infracao || '',
      hora_infracao: params.hora_infracao || '',
      data_criacao: agora.toISOString()
    };
    await db.collection('reposicoes').doc(id).set(docData);
    return { id: id, ok: true };
  },

  async atualizarReposicao(params) {
    const id = params.id;
    if (!id) throw new Error('ID da reposição não informado.');
    const campos = Object.assign({}, params);
    delete campos.id;
    delete campos.action;
    delete campos.pin;
    await db.collection('reposicoes').doc(id).update(campos);
    return { id: id, atualizado: true };
  },

  async excluirReposicao(params) {
    const id = params.id;
    if (!id) throw new Error('ID da reposição não informado.');
    await db.collection('reposicoes').doc(id).delete();
    return { id: id, excluido: true };
  },

  async identificarFuroReposicao(params) {
    const quantidadeAlvo = Math.floor(Number(params.quantidade) || 0);
    if (quantidadeAlvo <= 0) throw new Error('Quantidade inválida.');

    const snapRep = await db.collection('reposicoes')
      .where('condominio', '==', params.condominio)
      .get();

    const candidatas = [];
    snapRep.forEach(doc => {
      const d = doc.data();
      if (d.status !== 'Identificado' && d.produto === params.produto) {
        candidatas.push(Object.assign({ id: doc.id }, d));
      }
    });
    candidatas.sort((a, b) => String(a.data).localeCompare(String(b.data)));

    if (candidatas.length === 0) {
      throw new Error('Nenhum furo em aberto encontrado para esse produto.');
    }

    let restanteParaAbater = quantidadeAlvo;
    const criadas = [];

    for (const cand of candidatas) {
      if (restanteParaAbater <= 0) break;
      const qtdDeste = Math.min(cand.quantidade, restanteParaAbater);
      restanteParaAbater -= qtdDeste;

      const resOc = await this.criarOcorrencia({
        condominio: params.condominio,
        data_ocorrencia: params.data_infracao || cand.data,
        hora: params.hora_infracao || '00:00',
        pessoa: params.pessoa || '',
        descricao_pessoa: params.descricao_pessoa || '',
        contato_whatsapp: params.contato_whatsapp || '',
        itens: [{
          produto: params.produto,
          qtd: qtdDeste,
          preco_unit: cand.preco_unit
        }],
        valor_total: qtdDeste * cand.preco_unit,
        furo_reposicao_id: cand.id,
        observacao: 'Furo de reposição de ' + formatarDataBRLocal_(cand.data) + (params.observacao ? ' — ' + params.observacao : '')
      });
      criadas.push(resOc.id);

      if (qtdDeste >= cand.quantidade) {
        await db.collection('reposicoes').doc(cand.id).update({
          status: params.pessoa ? 'Identificado' : 'Pendente',
          pessoa: params.pessoa || '',
          contato_whatsapp: params.contato_whatsapp || '',
          data_infracao: params.data_infracao || '',
          hora_infracao: params.hora_infracao || ''
        });
      }
    }

    return { ok: true, ocorrencias_ids: criadas };
  },

  async criarPessoa(params) {
    const nome = (params.nome || '').trim();
    if (!nome) throw new Error('Nome da pessoa não informado.');
    const docId = 'PESSOA_' + nome.replace(/[^a-zA-Z0-9]/g, '_');
    await db.collection('pessoas').doc(docId).set({
      nome: nome,
      contato_whatsapp: params.contato_whatsapp || ''
    });
    return { ok: true };
  },

  async obterAquisicao() {
    const doc = await db.collection('configuracoes').doc('geral').get();
    if (doc.exists) {
      return (doc.data().aquisicao) || {};
    }
    return {};
  }
};
