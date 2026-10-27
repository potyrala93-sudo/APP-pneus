/* =========================================================
   Estoque de Pneus — Entrada, Estoque e Retirada
   Organização: Veículo (Caminhão / Trator) > Tipo de pneu (Dianteiro / Traseiro) > Medida.
   Banco: o mesmo Supabase do App de Compras. Sem login: abre direto.
   ========================================================= */
(function () {
  'use strict';

  // ---------- Configuração ----------
  const LOCAL = window.PNEU_CONFIG || {};
  const COMPRAS = window.APP_CONFIG || {};
  const URL_SB = (LOCAL.SUPABASE_URL || COMPRAS.SUPABASE_URL || '').trim();
  const KEY_SB = (LOCAL.SUPABASE_ANON_KEY || COMPRAS.SUPABASE_ANON_KEY || '').trim();
  const configurado = /^https:\/\//.test(URL_SB) && KEY_SB.length > 20 && !/SEU-PROJETO|COLE_AQUI/.test(URL_SB + KEY_SB);

  const VEICULOS = ['Caminhão', 'Trator'];
  const POSICOES = [{ v: 'Dianteiro', t: 'Dianteiro' }, { v: 'Traseiro', t: 'Traseiro (tração)' }];
  const nomePosicao = (p) => (POSICOES.find((x) => x.v === p) || { t: p }).t;

  // ---------- Utilidades ----------
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const h = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoje = () => new Date().toLocaleDateString('sv-SE');
  const dataBR = (d) => { if (!d) return '—'; const [a, m, dd] = String(d).slice(0, 10).split('-'); return `${dd}/${m}/${a}`; };
  const num = (n) => Number(n || 0).toLocaleString('pt-BR');
  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const P = {
    in: 'M12 19V5M5 12l7-7 7 7', out: 'M12 5v14M5 12l7 7 7-7',
    box: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 3v5M12 16v5M3 12h5M16 12h5',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4', x: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14', chev: 'M9 6l6 6-6 6',
    caminhao: 'M2 6h11v10H2zM13 9h4.5l3.5 4v3h-8M6 19.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM17 19.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z',
    trator: 'M7 20a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM18.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM4 12V6h6l2 5h6l2 4.5M7 6V3.5h3',
    dianteiro: 'M7 3h10v18H7zM7 7h10M7 11h10M7 15h10M7 19h10M3 9l3-3M3 9l3 3M3 9h3',
    traseiro: 'M7 3h10v18H7zM9 3v18M12 3v18M15 3v18M21 15l-3 3M21 15l-3-3M21 15h-3',
    menu: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
  };
  const ic = (n, s) => `<svg width="${s || 22}" height="${s || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n]}"/></svg>`;

  function toast(msg, tipo, tempo) {
    let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast ' + (tipo || ''); t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), tempo || 4500);
  }
  function dialogo(html) {
    const d = document.createElement('dialog'); d.innerHTML = html; document.body.appendChild(d);
    d.addEventListener('close', () => setTimeout(() => d.remove(), 50));
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.showModal(); return d;
  }
  function msgErro(e) {
    const m = (e && (e.message || e.error_description)) || String(e);
    if (!navigator.onLine || /failed to fetch|network|load failed/i.test(m)) return 'Sem conexão com a internet. Tente de novo quando tiver sinal.';
    if (/does not exist|could not find the function|schema cache/i.test(m)) return 'O banco ainda não tem as tabelas dos pneus. Rode o arquivo pneus.sql no SQL Editor do Supabase.';
    return m;
  }

  // ---------- Estado ----------
  const S = { sb: null, medidas: [], destinos: [], pessoas: [], movs: {}, busca: '', zerados: false, canal: null, pronto: false };
  try { S.zerados = localStorage.getItem('pneus.zerados') === '1'; } catch (_) {}
  const form = { entrada: {}, retirada: {} };   // escolhas do formulário (veículo, tipo, medida) que sobrevivem a recarregar a lista
  const app = () => $('#app');

  function cliente() {
    if (S.sb) return S.sb;
    if (!configurado || !window.supabase?.createClient) return null;
    S.sb = window.supabase.createClient(URL_SB, KEY_SB, { auth: { persistSession: false, autoRefreshToken: false } });
    return S.sb;
  }
  async function rpc(fn, args) { const { data, error } = await S.sb.rpc(fn, args || {}); if (error) throw error; return data; }
  const medidaDe = (id) => S.medidas.find((m) => m.id === id);
  const ordemMedida = (a, b) => a.medida.localeCompare(b.medida, 'pt-BR', { numeric: true });
  const medidasDe = (veiculo, posicao) => S.medidas.filter((m) => m.veiculo === veiculo && m.posicao === posicao).sort(ordemMedida);
  const descricao = (m) => `${m.veiculo} · ${nomePosicao(m.posicao)} · ${m.medida}`;

  // ---------- Dados ----------
  async function carregar() {
    const [md, mv] = await Promise.all([
      S.sb.from('vw_pneu_estoque').select('*').eq('ativo', true),
      S.sb.from('pneu_movimentos').select('destino,retirado_por').order('criado_em', { ascending: false }).limit(500),
    ]);
    if (md.error) throw md.error;
    S.medidas = md.data.map((m) => ({ ...m, saldo: Number(m.saldo) }));
    if (!mv.error) {
      const unicos = (k) => [...new Set(mv.data.map((x) => (x[k] || '').trim()).filter(Boolean))].slice(0, 60);
      S.destinos = unicos('destino'); S.pessoas = unicos('retirado_por');
    }
    S.movs = {};
    try { localStorage.setItem('pneus.cache', JSON.stringify({ medidas: S.medidas, destinos: S.destinos, pessoas: S.pessoas })); } catch (_) {}
  }
  function doCache() {
    try { const c = JSON.parse(localStorage.getItem('pneus.cache') || 'null'); if (c) { S.medidas = c.medidas; S.destinos = c.destinos || []; S.pessoas = c.pessoas || []; return true; } } catch (_) {}
    return false;
  }
  let timer = null;
  function recarregarLogo() { clearTimeout(timer); timer = setTimeout(async () => { try { await carregar(); render(); } catch (_) {} }, 600); }
  function tempoReal() {
    if (S.canal || !S.sb) return;
    S.canal = S.sb.channel('pneus')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pneu_movimentos' }, recarregarLogo)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pneu_medidas' }, recarregarLogo)
      .subscribe();
  }
  async function historico(id) {
    if (S.movs[id]) return S.movs[id];
    const { data, error } = await S.sb.from('pneu_movimentos').select('*').eq('medida_id', id).order('data', { ascending: false }).order('criado_em', { ascending: false }).limit(60);
    if (error) throw error;
    return (S.movs[id] = data);
  }

  // =========================================================
  //   Estrutura
  // =========================================================
  const ABAS = [{ id: 'entrada', nome: 'Entrada', icone: 'in' }, { id: 'estoque', nome: 'Estoque', icone: 'box' }, { id: 'retirada', nome: 'Retirada', icone: 'out' }];
  function shell() {
    app().innerHTML = `
      <header class="topbar"><a class="menu-btn" href="../APP-menu/" aria-label="Voltar ao menu dos apps" title="Menu dos apps">${ic('menu', 18)}<span>Menu</span></a>
        <div class="brand"><span class="tag">Pneus</span><span class="muted small">Estoque</span></div>
        <div class="spacer"></div><span class="net" id="net" hidden>Sem internet</span></header>
      <nav class="tabs" aria-label="Seções">${ABAS.map((a) => `<button data-tab="${a.id}">${ic(a.icone)}<span>${a.nome}</span></button>`).join('')}</nav>
      <main class="view" id="view" tabindex="-1"></main>`;
    $$('[data-tab]').forEach((b) => (b.onclick = () => { location.hash = '/' + b.dataset.tab; }));
    rede();
  }
  function rede() { const n = $('#net'); if (n) n.hidden = navigator.onLine; }
  window.addEventListener('online', () => { rede(); if (S.pronto) recarregarLogo(); });
  window.addEventListener('offline', rede);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.pronto && navigator.onLine) recarregarLogo(); });
  function abaAtual() { const t = location.hash.replace(/^#\/?/, ''); return ABAS.some((a) => a.id === t) ? t : 'estoque'; }
  window.addEventListener('hashchange', () => render(true));

  function render(trocou) {
    if (!S.pronto || !$('#view')) return;
    const tab = abaAtual(); const view = $('#view');
    if (!trocou && view.dataset.tab === tab && tab !== 'estoque') { atualizarMedidas(tab); return; }   // não apaga o que está sendo digitado
    if (!trocou && tab === 'estoque' && view.dataset.tab === tab) { listar(); return; }
    const mudou = view.dataset.tab !== tab; view.dataset.tab = tab;
    $$('[data-tab]').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
    if (tab === 'estoque') vEstoque(view); else vFormulario(view, tab);
    if (mudou) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
  }

  // =========================================================
  //   Estoque
  // =========================================================
  function vEstoque(view) {
    view.innerHTML = `
      <div class="page-head"><div><h1>Estoque de pneus</h1><p>Quantidade de cada medida agora. Toque na medida para ver a movimentação.</p></div></div>
      <div class="tools"><div class="search">${ic('search', 20)}<input type="search" class="input" id="busca" placeholder="Buscar medida (ex.: 275, 18.4)" value="${h(S.busca)}" aria-label="Buscar medida"></div>
        <label class="switch"><input type="checkbox" id="zerados" ${S.zerados ? 'checked' : ''}> Mostrar zerados</label></div>
      <div id="resumo" class="resumo"></div>
      <div id="lista"></div>`;
    $('#busca').oninput = (e) => { S.busca = e.target.value; listar(); };
    $('#zerados').onchange = (e) => { S.zerados = e.target.checked; try { localStorage.setItem('pneus.zerados', S.zerados ? '1' : '0'); } catch (_) {} listar(); };
    listar();
  }
  function listar() {
    const q = semAcento(S.busca).replace(/\s+/g, '');
    const vis = S.medidas.filter((m) => (S.zerados || m.saldo > 0) && (!q || semAcento(m.medida).replace(/\s+/g, '').includes(q) || semAcento(m.veiculo + nomePosicao(m.posicao)).includes(q)));
    const tot = (v) => S.medidas.filter((m) => m.veiculo === v).reduce((s, m) => s + Math.max(0, m.saldo), 0);
    $('#resumo').innerHTML = VEICULOS.map((v) => `<span class="res-v">${ic(v === 'Caminhão' ? 'caminhao' : 'trator', 18)} ${h(v)}: <b>${num(tot(v))}</b> pneus</span>`).join('');
    $('#lista').innerHTML = vis.length ? VEICULOS.map((v) => {
      const doV = vis.filter((m) => m.veiculo === v); if (!doV.length) return '';
      return `<section class="veic"><h2 class="veic-tit">${ic(v === 'Caminhão' ? 'caminhao' : 'trator', 24)} ${h(v)}</h2>
        ${POSICOES.map((p) => {
          const l = doV.filter((m) => m.posicao === p.v).sort(ordemMedida); if (!l.length) return '';
          return `<div class="pos"><h3 class="pos-tit">${h(p.t)}</h3><div class="linhas">${l.map((m) => `
            <button class="linha" data-id="${m.id}"><span class="med">${h(m.medida)}</span>
              <span class="qtd ${m.saldo <= 0 ? 'zero' : ''}">${m.saldo <= 0 ? 'Zerado' : num(m.saldo)}</span>${ic('chev', 18)}
              <span class="quando">${m.ultima_movimentacao ? 'Última: ' + dataBR(m.ultima_movimentacao) : 'Sem movimentação'}</span></button>`).join('')}</div></div>`;
        }).join('')}</section>`;
    }).join('') : `<div class="empty"><strong>${q ? 'Nenhuma medida encontrada' : 'Nenhum pneu em estoque'}</strong>${q ? 'Confira como foi escrito ou marque "Mostrar zerados".' : 'Registre uma entrada para começar.'}</div>`;
    $$('#lista .linha').forEach((b) => (b.onclick = () => abrirMedida(+b.dataset.id)));
  }
  async function abrirMedida(id) {
    const m = medidaDe(id); if (!m) return;
    const d = dialogo(`<div class="dlg">
      <div class="dlg-head"><div><p class="muted small">${h(m.veiculo)} · ${h(nomePosicao(m.posicao))}</p><h2>${h(m.medida)}</h2></div><button class="icon-btn" data-x aria-label="Fechar">${ic('x')}</button></div>
      <div><p class="muted small">Em estoque</p><p class="qtd-big ${m.saldo <= 0 ? 'zero' : ''}">${num(m.saldo)}</p></div>
      <div class="row"><button class="btn btn-sm" data-ir="entrada">${ic('in', 18)} Dar entrada</button>${m.saldo > 0 ? `<button class="btn btn-out btn-sm" data-ir="retirada">${ic('out', 18)} Retirar</button>` : ''}</div>
      <h3>Movimentações</h3><ul class="mov" id="p-mov"><li class="muted">Carregando…</li></ul></div>`);
    $('[data-x]', d).onclick = () => d.close();
    $$('[data-ir]', d).forEach((b) => (b.onclick = () => { d.close(); form[b.dataset.ir] = { veiculo: m.veiculo, posicao: m.posicao, medida: m.id }; location.hash = '/' + b.dataset.ir; render(true); }));
    try {
      const movs = await historico(id);
      $('#p-mov', d).innerHTML = movs.length ? movs.map((x) => {
        const ret = x.tipo === 'retirada';
        const extra = [x.destino ? 'Destinado a: ' + x.destino : '', ret && x.retirado_por ? 'Pegou: ' + x.retirado_por : ''].filter(Boolean).join(' · ');
        return `<li><span>${dataBR(x.data)} · ${ret ? 'Retirada' : 'Entrada'}</span><span class="q ${ret ? 'out' : 'in'}">${ret ? '−' : '+'}${num(x.quantidade)}</span>${extra ? `<small>${h(extra)}</small>` : ''}</li>`;
      }).join('') : '<li class="muted">Nenhuma movimentação ainda.</li>';
    } catch (ex) { const el = $('#p-mov', d); if (el) el.innerHTML = `<li class="muted">${h(msgErro(ex))}</li>`; }
  }

  // =========================================================
  //   Entrada e Retirada (mesmas perguntas; a retirada pergunta também quem pegou)
  // =========================================================
  function vFormulario(view, modo) {
    const ret = modo === 'retirada';
    const f = form[modo];
    view.innerHTML = `
      <div class="page-head"><div><h1>${ret ? 'Retirada' : 'Entrada'}</h1><p>${ret ? 'Registre os pneus que saíram. A quantidade desconta do estoque.' : 'Registre os pneus que chegaram. A quantidade soma no estoque.'}</p></div></div>
      <form class="panel ${ret ? 'out' : 'in'}" id="f-${modo}" novalidate>
        <div class="field" style="max-width:260px"><label for="${modo}-data">Data</label><input id="${modo}-data" type="date" class="input" value="${hoje()}" max="${hoje()}"></div>
        <div class="field"><span class="label" id="${modo}-v-lbl">Tipo de veículo</span>
          <div class="opcoes" role="radiogroup" aria-labelledby="${modo}-v-lbl">${VEICULOS.map((v) => `<button type="button" class="opcao" role="radio" data-veiculo="${h(v)}" aria-checked="${f.veiculo === v}">${ic(v === 'Caminhão' ? 'caminhao' : 'trator', 30)}<span>${h(v)}</span></button>`).join('')}</div></div>
        <div class="field"><span class="label" id="${modo}-p-lbl">Tipo de pneu</span>
          <div class="opcoes" role="radiogroup" aria-labelledby="${modo}-p-lbl">${POSICOES.map((p) => `<button type="button" class="opcao" role="radio" data-posicao="${p.v}" aria-checked="${f.posicao === p.v}">${ic(p.v === 'Dianteiro' ? 'dianteiro' : 'traseiro', 30)}<span>${h(p.t)}</span></button>`).join('')}</div></div>
        <div class="field"><label for="${modo}-medida">Medida</label>
          <select id="${modo}-medida" class="input"></select>
          <span class="hint" id="${modo}-medida-hint"></span></div>
        <p class="disp" id="${modo}-disp" hidden></p>
        <div class="field" style="max-width:260px"><label for="${modo}-qtd">Quantidade</label><input id="${modo}-qtd" class="input qtd" type="number" min="1" step="1" inputmode="numeric" placeholder="0"></div>
        <div class="field"><label for="${modo}-destino">Pneu destinado a quem?</label>
          <input id="${modo}-destino" class="input" list="${modo}-destinos" placeholder="Ex.: Frota CM-102, equipe BU, oficina" autocomplete="off">
          <datalist id="${modo}-destinos">${S.destinos.map((x) => `<option value="${h(x)}"></option>`).join('')}</datalist></div>
        ${ret ? `<div class="field"><label for="retirada-quem">Quem pegou o pneu?</label>
          <input id="retirada-quem" class="input" list="retirada-pessoas" placeholder="Nome de quem retirou" autocomplete="off">
          <datalist id="retirada-pessoas">${S.pessoas.map((x) => `<option value="${h(x)}"></option>`).join('')}</datalist></div>` : ''}
        <p class="form-error" id="${modo}-err" role="alert"></p>
        <div class="row end"><button class="btn ${ret ? 'btn-out' : ''}" id="${modo}-btn">${ic(ret ? 'out' : 'in', 18)} Registrar ${ret ? 'retirada' : 'entrada'}</button></div>
      </form>`;
    const fm = $('#f-' + modo);
    const escolher = (attr, chave) => $$(`[data-${attr}]`, fm).forEach((b) => (b.onclick = () => {
      f[chave] = b.dataset[attr]; f.medida = null;
      $$(`[data-${attr}]`, fm).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      atualizarMedidas(modo); $('#' + modo + '-err').textContent = '';
    }));
    escolher('veiculo', 'veiculo'); escolher('posicao', 'posicao');
    $('#' + modo + '-medida').onchange = async (e) => {
      if (e.target.value === 'nova') { e.target.value = f.medida || ''; return novaMedida(modo); }
      f.medida = e.target.value ? +e.target.value : null; atualizarDisponivel(modo);
    };
    $('#' + modo + '-qtd').oninput = () => atualizarDisponivel(modo);
    fm.oninput = () => { $('#' + modo + '-err').textContent = ''; };
    fm.onsubmit = (e) => { e.preventDefault(); registrar(modo); };
    atualizarMedidas(modo);
  }
  // lista de medidas conforme o veículo e o tipo de pneu escolhidos
  function atualizarMedidas(modo) {
    const sel = $('#' + modo + '-medida'); if (!sel) return;
    const f = form[modo]; const ret = modo === 'retirada';
    const hint = $('#' + modo + '-medida-hint');
    if (!f.veiculo || !f.posicao) {
      sel.innerHTML = '<option value="">Escolha o veículo e o tipo de pneu</option>'; sel.disabled = true; hint.textContent = '';
      atualizarDisponivel(modo); return;
    }
    const lista = medidasDe(f.veiculo, f.posicao);
    if (f.medida && !lista.some((m) => m.id === f.medida)) f.medida = null;
    sel.disabled = false;
    sel.innerHTML = `<option value="">Selecione a medida</option>`
      + lista.map((m) => `<option value="${m.id}" ${m.id === f.medida ? 'selected' : ''} ${ret && m.saldo <= 0 ? 'disabled' : ''}>${h(m.medida)} — ${m.saldo > 0 ? num(m.saldo) + ' em estoque' : 'sem estoque'}</option>`).join('')
      + (ret ? '' : '<option value="nova">+ Cadastrar medida nova…</option>');
    hint.textContent = ret ? (lista.some((m) => m.saldo > 0) ? '' : `Não há pneu ${f.veiculo === 'Caminhão' ? 'de caminhão' : 'de trator'} ${nomePosicao(f.posicao).toLowerCase()} em estoque.`)
      : (lista.length ? 'Não achou a medida? Escolha "+ Cadastrar medida nova" no fim da lista.' : 'Nenhuma medida cadastrada ainda: escolha "+ Cadastrar medida nova".');
    atualizarDisponivel(modo);
  }
  function atualizarDisponivel(modo) {
    const el = $('#' + modo + '-disp'); if (!el) return;
    const m = medidaDe(form[modo].medida);
    if (!m) { el.hidden = true; return; }
    const q = parseInt($('#' + modo + '-qtd').value, 10) || 0;
    el.hidden = false;
    if (modo === 'retirada') {
      const resta = m.saldo - q; el.classList.toggle('zero', resta < 0);
      el.textContent = resta < 0 ? `Só há ${num(m.saldo)} em estoque.` : q > 0 ? `Disponível: ${num(m.saldo)} · depois da retirada: ${num(resta)}` : `Disponível: ${num(m.saldo)}`;
    } else {
      el.classList.remove('zero');
      el.textContent = q > 0 ? `Em estoque: ${num(m.saldo)} · depois da entrada: ${num(m.saldo + q)}` : `Em estoque: ${num(m.saldo)}`;
    }
  }
  function novaMedida(modo) {
    const f = form[modo];
    const d = dialogo(`<form class="dlg" id="f-nova" novalidate>
      <div class="dlg-head"><h2>Medida nova</h2><button type="button" class="icon-btn" data-x aria-label="Fechar">${ic('x')}</button></div>
      <p class="muted">${h(f.veiculo)} · ${h(nomePosicao(f.posicao))}</p>
      <div class="field"><label for="n-medida">Medida do pneu</label><input id="n-medida" class="input" placeholder="Ex.: 275/80R22.5 ou 18.4-34" autocomplete="off" autocapitalize="characters"></div>
      <p class="form-error" id="n-err" role="alert"></p>
      <div class="dlg-foot"><button type="button" class="btn btn-ghost" data-x>Cancelar</button><button class="btn" id="n-btn">Cadastrar</button></div></form>`);
    $$('[data-x]', d).forEach((b) => (b.onclick = () => d.close()));
    $('#n-medida', d).focus();
    $('#f-nova', d).onsubmit = async (e) => {
      e.preventDefault();
      const med = $('#n-medida', d).value.trim(); const err = $('#n-err', d);
      if (med.length < 2) return (err.textContent = 'Escreva a medida.');
      const bt = $('#n-btn', d); bt.disabled = true;
      try {
        const r = await rpc('pneu_cadastrar_medida', { p_veiculo: f.veiculo, p_posicao: f.posicao, p_medida: med });
        await carregar(); f.medida = r.id; d.close();
        atualizarMedidas(modo); toast(`Medida ${r.medida} pronta para usar.`);
      } catch (ex) { err.textContent = msgErro(ex); bt.disabled = false; }
    };
  }
  async function registrar(modo) {
    const ret = modo === 'retirada'; const f = form[modo];
    const err = $('#' + modo + '-err'); err.textContent = '';
    const data = $('#' + modo + '-data').value;
    const qtdTxt = $('#' + modo + '-qtd').value.trim(); const qtd = Number(qtdTxt);
    const m = medidaDe(f.medida);
    if (!data) return (err.textContent = 'Informe a data.');
    if (data > hoje()) return (err.textContent = 'A data não pode ser no futuro.');
    if (!f.veiculo) return (err.textContent = 'Escolha o tipo de veículo.');
    if (!f.posicao) return (err.textContent = 'Escolha o tipo de pneu.');
    if (!m) { $('#' + modo + '-medida').focus(); return (err.textContent = 'Escolha a medida.'); }
    if (!Number.isInteger(qtd) || qtd <= 0) { $('#' + modo + '-qtd').focus(); return (err.textContent = 'Informe a quantidade de pneus (número inteiro maior que zero).'); }
    if (ret && qtd > m.saldo) { $('#' + modo + '-qtd').focus(); return (err.textContent = `Só há ${num(m.saldo)} pneu(s) dessa medida em estoque.`); }
    const destino = $('#' + modo + '-destino').value.trim() || null;
    const bt = $('#' + modo + '-btn'); bt.disabled = true;
    try {
      const args = { p_id: uuid(), p_data: data, p_medida: m.id, p_quantidade: qtd, p_destino: destino };
      if (ret) args.p_retirado_por = $('#retirada-quem').value.trim() || null;
      const saldo = await rpc(ret ? 'pneu_registrar_retirada' : 'pneu_registrar_entrada', args);
      m.saldo = Number(saldo); m.ultima_movimentacao = data; delete S.movs[m.id];
      if (destino && !S.destinos.includes(destino)) S.destinos.unshift(destino);
      if (ret && args.p_retirado_por && !S.pessoas.includes(args.p_retirado_por)) S.pessoas.unshift(args.p_retirado_por);
      toast(ret ? `Retirada registrada: −${num(qtd)} pneu(s) ${m.medida}. Restam ${num(saldo)}.` : `Entrada registrada: +${num(qtd)} pneu(s) ${m.medida}. Agora há ${num(saldo)}.`, ret ? 'out' : 'in', 6000);
      form[modo] = {}; render(true);
    } catch (ex) { err.textContent = msgErro(ex); bt.disabled = false; recarregarLogo(); }
  }

  // =========================================================
  //   Início
  // =========================================================
  async function iniciar() {
    S.pronto = true; shell();
    try { await carregar(); }
    catch (ex) { toast(doCache() ? 'Sem conexão. Mostrando o último estoque salvo neste aparelho.' : msgErro(ex), 'erro', 8000); }
    render(true); tempoReal();
  }
  function boot() {
    if (!cliente()) {
      if (doCache()) { S.pronto = true; shell(); render(true); toast('Sem conexão. Mostrando o último estoque salvo neste aparelho.', 'erro', 8000); return; }
      app().innerHTML = `<div class="auth"><div class="auth-box"><span class="tag big">Pneus</span><div class="auth-card"><h2>Sem conexão com o banco</h2>
        <p>${navigator.onLine ? 'Não encontrei o endereço do banco. Confira o config.js do App de Compras ou preencha o config.js deste app.' : 'Conecte-se à internet e tente de novo.'}</p>
        <button class="btn" onclick="location.reload()">Tentar de novo</button></div></div></div>`;
      return;
    }
    iniciar();
  }
  boot();
})();
