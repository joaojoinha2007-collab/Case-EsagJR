/*
 * landing.js — Landing page do estudo de mercado WEEK Haircare.
 * Usa o mesmo motor de cálculo testado (WeekData, WeekCalc, WeekFormat):
 * todo número exibido vem de WeekCalc.compute().
 */
(function () {
  'use strict';
  var D = window.WeekData, C = window.WeekCalc, F = window.WeekFormat;
  var LEVELS = ['tam', 'sam', 'som'];
  var NAME = { tam: 'TAM', sam: 'SAM', som: 'SOM' };
  var PLAIN = { tam: 'Mercado total', sam: 'Mercado atendível', som: 'Mercado de entrada' };
  var DEF = {
    tam: 'Todo o mercado potencial do produto, sem filtro de público ou canal.',
    sam: 'A parte do TAM que a WEEK consegue atender com o seu canal, público e região.',
    som: 'O recorte onde a WEEK começa a vender. Ainda não inclui a fatia que ela vai conquistar (taxa de captura).'
  };
  var SEG_COLOR = { academia: 'var(--l-tam)', trabalho: 'var(--teal)', viagem: 'var(--amber)', academias: 'var(--l-tam)', hoteis: 'var(--teal)' };
  var SIM_KEYS = {
    b2c: ['preco', 'pctBanhoAcademia', 'pctBanhoTrabalho', 'banhosAno', 'pesoSP'],
    b2b: ['preco', 'pctBanhoAcademia', 'ocupacao', 'kitsPorQuarto', 'pctPremium']
  };
  var PRIORITY = {
    b2c: ['b2c-banho-acad', 'b2c-banho-trab', 'b2c-freq', 'b2c-preco', 'b2c-banho-viagem'],
    b2b: ['b2b-kits', 'b2b-premium', 'b2b-preco', 'b2b-banho', 'b2b-alunos']
  };

  var state = { model: 'b2c', sel: 'som', inputs: { b2c: C.baseInputs('b2c'), b2b: C.baseInputs('b2b') }, last: { b2c: null, b2b: null } };
  var BASE = { b2c: C.compute('b2c'), b2b: C.compute('b2b') };
  var cache = { b2c: null, b2b: null };
  function res(m) {
    if (cache[m] && cache[m].i === state.inputs[m]) return cache[m].r;
    var r = C.compute(m, state.inputs[m]); if (!r.valid) r = BASE[m];
    cache[m] = { i: state.inputs[m], r: r }; return r;
  }
  function M() { return D.MODELS[state.model]; }

  /* ---------- formatação ---------- */
  var nfc = {};
  function nf(max, min) { var k = (min || 0) + ':' + max; return nfc[k] || (nfc[k] = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min || 0, maximumFractionDigits: max })); }
  function mi(v) { var a = Math.abs(v) / 1e6, d = a >= 10 ? 1 : 2; return 'R$ ' + nf(d, d).format(a) + ' mi'; }
  function qty(v) { var a = Math.abs(v); if (a >= 1e6) return nf(a >= 1e8 ? 1 : 2).format(v / 1e6) + ' mi'; if (a >= 1e4) return nf(a >= 1e5 ? 1 : 2).format(v / 1e3) + ' mil'; if (a >= 100) return nf(0).format(v); return nf(2).format(v); }
  function pct(v) { return nf(2).format(v * 100) + '%'; }
  function share(v) { return v >= 0.1 ? nf(1).format(v * 100) + '%' : nf(2).format(v * 100) + '%'; }
  function signed(v) { return F.signedPct(v); }
  function fmtIn(m, k, v) { var s = C.getSpec(m, k); if (k === 'preco') return F.brl(v); if ((s && s.type === 'pct') || /^(pct|peso|fator|ocupacao)/.test(k)) return pct(v); return nf(2).format(v) + (s && s.unit ? ' ' + s.unit : ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function deltaCls(d) { return Math.abs(d) < 1e-6 ? 'flat' : d > 0 ? 'up' : 'down'; }
  function unit(m) { return m === 'b2c' ? 'lavagens' : 'kits'; }
  function conf(id) {
    var c = D.CONFIDENCE.filter(function (x) { return x.id === id; })[0]; if (!c) return '';
    var cells = ''; for (var i = 1; i <= 5; i++) cells += '<i class="' + (i <= c.score ? 'on' : '') + '"></i>';
    return '<span class="conf' + (c.score <= 2 ? ' low' : '') + '"><span class="meter" aria-hidden="true">' + cells + '</span>Confiança ' + c.label.toLowerCase() + '</span>';
  }

  /* ---------- hero e indicadores ---------- */
  function renderHero() {
    var m = state.model, r = res(m), mm = M();
    var tam = r.levels.tam.total.valor;
    var big = tam >= 1e9 ? 'R$ ' + nf(2, 2).format(tam / 1e9) + ' bilhão' : 'R$ ' + nf(0).format(tam / 1e6) + ' milhões';
    document.getElementById('hero-title').innerHTML = m === 'b2c'
      ? 'Um mercado potencial de <em>' + big + '</em> por ano em banhos fora de casa.'
      : 'Um mercado potencial de <em>' + big + '</em> por ano em kits para academias e hotéis.';
    document.getElementById('hero-lead').textContent = m === 'b2c'
      ? 'É o que somam, a ' + F.brl(r.inputs.preco) + ' por lavagem, os banhos que os brasileiros tomam na academia, no trabalho e em viagens. Desse total, o estudo chega ao mercado que a WEEK pode atender pelo site, começando pelo estado de São Paulo.'
      : 'É o que somam, a ' + F.brl(r.inputs.preco) + ' por kit, os banhos nas academias e os quartos de hotel ocupados no Sudeste. Desse total, o estudo chega às academias premium e hotéis de São Paulo, começando por Campinas.';
    document.getElementById('tiles').innerHTML = LEVELS.map(function (l) {
      var t = r.levels[l].total;
      var desc = l === 'tam' ? 'Universo total do modelo' : share(t.valor / tam) + ' do TAM';
      return '<li><button type="button" class="tile" data-go-level="' + l + '"><span class="tile-top"><span class="lvl lvl-' + l + '">' + NAME[l] + '</span><span class="tile-geo">' + esc(mm.levels[l].geo) + '</span></span>' +
        '<span class="tile-val">' + mi(t.valor) + '<small>/ano</small></span><span class="tile-desc">' + PLAIN[l] + ' · ' + desc + ' · ' + qty(t.volume) + ' ' + unit(m) + '/ano</span>' +
        '<span class="tile-more">Entender este número →</span></button></li>';
    }).join('');
    document.getElementById('tiles-note').textContent = 'São valores teóricos de mercado calculados a partir das premissas do estudo, não previsão de vendas. O SOM ainda não aplica a taxa de captura (a fatia que a WEEK vai conquistar).' +
      (C.changedInputs(m, state.inputs[m]).length ? ' Você está vendo um cenário simulado.' : '');
  }

  /* ---------- segmentos ---------- */
  function segSteps(m, id, r) {
    var i = r.inputs, s = r.levels.tam.segments[id];
    if (m === 'b2c') {
      if (id === 'academia') return ['<b>' + qty(i.alunosAcademia) + '</b> alunos de academia × <b>' + pct(i.pctBanhoAcademia) + '</b> tomam banho lá = <b>' + qty(s.pessoas) + '</b> pessoas', '× <b>' + nf(0).format(i.banhosAno) + '</b> banhos por ano = <b>' + qty(s.volume) + '</b> lavagens', '× <b>' + F.brl(i.preco) + '</b> por kit = <b>' + mi(s.valor) + '</b>'];
      if (id === 'trabalho') return ['<b>' + qty(i.trabalhadoresCLT) + '</b> trabalhadores CLT × <b>' + pct(i.pctBanhoTrabalho) + '</b> tomam banho no trabalho = <b>' + qty(s.pessoas) + '</b> pessoas', '× <b>' + nf(0).format(i.banhosAno) + '</b> banhos por ano = <b>' + qty(s.volume) + '</b> lavagens', '× <b>' + F.brl(i.preco) + '</b> por kit = <b>' + mi(s.valor) + '</b>'];
      return ['<b>' + qty(i.viagens) + '</b> viagens com pernoite × <b>1</b> viajante = <b>' + qty(s.pessoas) + '</b> viagens', '× <b>' + nf(1).format(i.banhosPorViagem) + '</b> banhos por viagem = <b>' + qty(s.volume) + '</b> lavagens', '× <b>' + F.brl(i.preco) + '</b> por kit = <b>' + mi(s.valor) + '</b>'];
    }
    if (id === 'academias') return ['<b>' + nf(0).format(i.academiasSudeste) + '</b> academias × <b>' + nf(0).format(i.alunosPorAcademia) + '</b> alunos × <b>' + pct(i.pctBanhoAcademia) + '</b> tomam banho = <b>' + qty(s.pessoas) + '</b> usuários', '× <b>' + nf(0).format(i.banhosAno) + '</b> banhos por ano = <b>' + qty(s.volume) + '</b> kits', '× <b>' + F.brl(i.preco) + '</b> por kit = <b>' + mi(s.valor) + '</b>'];
    return ['<b>' + nf(0).format(i.quartosSudeste) + '</b> quartos × <b>' + pct(i.ocupacao) + '</b> de ocupação = <b>' + qty(s.pessoas) + '</b> quartos ocupados por noite', '× 365 dias × <b>' + nf(1).format(i.kitsPorQuarto) + '</b> kit por quarto = <b>' + qty(s.volume) + '</b> kits', '× <b>' + F.brl(i.preco) + '</b> por kit = <b>' + mi(s.valor) + '</b>'];
  }
  var SEG_WHY = {
    academia: 'Estudos com praticantes indicam 2 a 4 treinos por semana; nem todo treino termina com banho, então o estudo usa 2 banhos por semana em 48 semanas. O percentual de 20% ainda não tem dado brasileiro e será validado na pesquisa quantitativa.',
    trabalho: 'A NR-24 exige chuveiro em atividades com sujeira ou material tóxico. Somando construção, parte da indústria e do agro, cerca de 10% a 15% dos CLT têm chuveiro; supondo que metade usa, ≈ 5%.',
    viagem: 'Em 2024 os brasileiros fizeram 20,6 mi viagens, mas 4,7 mi foram bate-volta, sem banho fora de casa; ficam as 15,8 mi com pernoite. 75,5% delas têm até 5 pernoites e a mediana fica em 2 a 3 noites; 1 banho por noite dá cerca de 3 banhos por viagem. Usamos 1 viajante por viagem para ser conservador, porque o IBGE conta viagens.',
    academias: 'As academias do Sudeste são 45% das 55.068 do Brasil (Panorama Setorial 2026). Alunos por academia = 13 mi ÷ 55.068. O comprador é a academia; quem usa o kit é o aluno.',
    hoteis: 'Quartos do Cadastur (2º tri 2026) e ocupação média de 2025 do FOHB. A premissa de 1 kit por quarto ocupado por noite é estimativa própria e será validada com os hotéis.'
  };
  function renderSegs() {
    var m = state.model, mm = M(), r = res(m), tot = r.levels.tam.total.valor;
    document.getElementById('seg-title').textContent = m === 'b2c' ? 'Onde as pessoas tomam banho fora de casa' : 'Quem compraria os kits';
    document.getElementById('seg-sub').textContent = m === 'b2c'
      ? 'O TAM soma três situações em que alguém toma banho longe de casa. Para cada uma: quantas pessoas, quantos banhos por ano e o preço do kit.'
      : 'No B2B quem compra é o estabelecimento. O TAM soma o que as academias e os hotéis do Sudeste usariam em um ano, ao preço de atacado.';
    document.getElementById('segs').innerHTML = mm.segments.map(function (s) {
      var v = r.levels.tam.segments[s.id].valor;
      return '<article class="seg" style="--c:' + SEG_COLOR[s.id] + '"><div class="seg-head"><h3>' + esc(s.name) + '</h3><span class="seg-val">' + mi(v) + '</span></div>' +
        '<p class="seg-who">' + esc(s.who) + '</p><div class="share" aria-hidden="true"><i style="width:' + (v / tot * 100).toFixed(1) + '%"></i></div><p class="share-txt">' + share(v / tot) + ' do TAM ' + esc(mm.levels.tam.geo) + '</p>' +
        '<ol class="steps">' + segSteps(m, s.id, r).map(function (t) { return '<li><span>' + t + '</span></li>'; }).join('') + '</ol>' +
        (s.id === 'hoteis' ? '<p class="warn-inline">1 kit por quarto ocupado por noite é uma estimativa a validar, não uma prática comprovada de todos os hotéis.</p>' : '') +
        '<details><summary>Por que esses números?</summary><p>' + esc(SEG_WHY[s.id]) + '</p></details></article>';
    }).join('');
  }

  /* ---------- funil, detalhe e círculos ---------- */
  function funnelSteps(m, r) {
    var i = r.inputs, L = r.levels, tam = L.tam.total.valor, mm = D.MODELS[m], out = [];
    function add(o) { o.share = tam ? o.value / tam : 0; out.push(o); }
    add({ level: 'tam', major: true, label: mm.levels.tam.geo, sub: m === 'b2c' ? 'academia + trabalho + viagem' : 'academias + hotéis', value: tam });
    if (m === 'b2c') {
      add({ level: 'sam', label: 'Moradores do Sudeste', sub: 'peso populacional', value: tam * i.pesoSudeste, filter: '× ' + pct(i.pesoSudeste) + ' moram no Sudeste' });
      add({ level: 'sam', label: 'Classes A e B', sub: 'quem paga por premium', value: tam * i.pesoSudeste * i.pctClassesAB, filter: '× ' + pct(i.pctClassesAB) + ' são classes A e B' });
      add({ level: 'sam', major: true, label: mm.levels.sam.geo, sub: 'A e B que compram online', value: L.sam.total.valor, filter: '× ' + pct(i.pctOnline) + ' compram online' });
      add({ level: 'som', major: true, label: mm.levels.som.geo, sub: 'recorte de entrada', value: L.som.total.valor, filter: '× ' + pct(i.pesoSP) + ' estão em SP' });
    } else {
      var t = L.tam.segments;
      add({ level: 'sam', label: 'No estado de SP', sub: 'peso geográfico', value: t.academias.valor * i.pesoSPAcademias + t.hoteis.valor * i.pesoSPQuartos, filter: '× ' + pct(i.pesoSPAcademias) + ' academias · × ' + pct(i.pesoSPQuartos) + ' quartos em SP' });
      add({ level: 'sam', major: true, label: mm.levels.sam.geo, sub: 'academias premium + hotéis', value: L.sam.total.valor, filter: '× ' + pct(i.pctPremium) + ' premium · × ' + pct(i.pctHoteis) + ' são hotéis' });
      add({ level: 'som', major: true, label: mm.levels.som.geo, sub: 'recorte de entrada', value: L.som.total.valor, filter: '× ' + pct(i.fatorCampinasAcademias) + ' · × ' + pct(i.fatorCampinasHoteis) + ' estão em Campinas' });
    }
    return out;
  }
  function renderFunnel() {
    var m = state.model, r = res(m), steps = funnelSteps(m, r), sel = state.sel;
    var w = steps.map(function (s) { return Math.max(2.5, Math.min(100, s.share * 100)); });
    var html = '';
    steps.forEach(function (s, k) {
      if (k) {
        var a = w[k - 1], b = w[k], poly = 'polygon(' + (50 - a / 2) + '% 0,' + (50 + a / 2) + '% 0,' + (50 + b / 2) + '% 100%,' + (50 - b / 2) + '% 100%)', d = s.value - steps[k - 1].value;
        html += '<div class="f-flow" aria-hidden="true"><span class="f-filter">' + esc(s.filter) + '</span><span class="f-track" style="height:100%"><span class="f-trap" style="clip-path:' + poly + ';-webkit-clip-path:' + poly + '"></span></span><span class="f-delta">−' + mi(-d) + '</span></div>';
      }
      var on = s.major && s.level === sel, dim = sel && s.level !== sel;
      html += '<button type="button" class="f-stage ' + (s.major ? 'major l-' + s.level : 'minor') + (on ? ' on' : '') + (dim ? ' dim' : '') + '" data-level="' + s.level + '" aria-pressed="' + on + '" aria-label="' + esc((s.major ? NAME[s.level] + ' ' : '') + s.label + ': ' + mi(s.value) + ', ' + share(s.share) + ' do TAM') + '">' +
        '<span class="f-name">' + (s.major ? '<span class="lvl lvl-' + s.level + '">' + NAME[s.level] + '</span>' : '') + '<b>' + esc(s.label) + '</b><small>' + esc(s.sub) + '</small></span>' +
        '<span class="f-track"><span class="f-bar" style="width:' + w[k].toFixed(2) + '%"></span></span>' +
        '<span class="f-val"><b>' + mi(s.value) + '</b><small>' + share(s.share) + ' do TAM</small></span></button>';
    });
    document.getElementById('funnel').innerHTML = html;
  }
  function renderDetail() {
    var m = state.model, mm = M(), r = res(m), l = state.sel, i = r.inputs, idx = LEVELS.indexOf(l);
    var v = r.levels[l].total.valor, tam = r.levels.tam.total.valor, prev = LEVELS[idx - 1], next = LEVELS[idx + 1];
    var week = {
      b2c: { tam: 'Todos os banhos fora de casa no Brasil, na academia, no trabalho e em viagens, a ' + F.brl(i.preco) + ' por lavagem.', sam: 'Só quem mora no Sudeste, é das classes A e B e compra pela internet: o público que o site da WEEK alcança agora.', som: 'O SAM dentro do estado de São Paulo, onde a WEEK começa. Falta aplicar a taxa de captura.' },
      b2b: { tam: 'Todos os kits que academias e quartos de hotel do Sudeste usariam em um ano, a ' + F.brl(i.preco) + ' por kit.', sam: 'Só academias premium e hotéis (com flats e resorts) do estado de São Paulo.', som: 'Os estabelecimentos do SAM em Campinas, ponto de partida do B2B. Falta aplicar a taxa de captura.' }
    }[m][l];
    var calc;
    if (l === 'tam') calc = 'Soma dos segmentos: ' + mm.segments.map(function (s) { return esc(s.name) + ' <b>' + mi(r.levels.tam.segments[s.id].valor) + '</b>'; }).join(' + ') + ' = <b>' + mi(v) + '</b>';
    else if (m === 'b2c') calc = l === 'sam' ? 'TAM <b>' + mi(tam) + '</b> × ' + pct(i.pesoSudeste) + ' × ' + pct(i.pctClassesAB) + ' × ' + pct(i.pctOnline) + ' (= ' + pct(r.factorSummary.sam) + ') = <b>' + mi(v) + '</b>' : 'SAM <b>' + mi(r.levels.sam.total.valor) + '</b> × ' + pct(i.pesoSP) + ' = <b>' + mi(v) + '</b>';
    else calc = l === 'sam' ? 'Academias <b>' + mi(r.levels.tam.segments.academias.valor) + '</b> × ' + pct(r.factors.sam.academias) + ' + hotéis <b>' + mi(r.levels.tam.segments.hoteis.valor) + '</b> × ' + pct(r.factors.sam.hoteis) + ' = <b>' + mi(v) + '</b>' : 'Academias <b>' + mi(r.levels.sam.segments.academias.valor) + '</b> × ' + pct(i.fatorCampinasAcademias) + ' + hotéis <b>' + mi(r.levels.sam.segments.hoteis.valor) + '</b> × ' + pct(i.fatorCampinasHoteis) + ' = <b>' + mi(v) + '</b>';
    var stats = '<div><dt>% do TAM</dt><dd>' + (idx ? share(v / tam) : '100%') + '</dd></div>';
    if (prev) { var pv = r.levels[prev].total.valor; stats += '<div><dt>Saiu do ' + NAME[prev] + '</dt><dd>−' + mi(pv - v) + ' (' + signed((v - pv) / pv) + ')</dd></div>'; }
    stats += '<div><dt>' + unit(m)[0].toUpperCase() + unit(m).slice(1) + '/ano</dt><dd>' + qty(r.levels[l].total.volume) + '</dd></div>';
    if (r.levels[l].total.estabelecimentos !== undefined) stats += '<div><dt>Estabelecimentos</dt><dd>' + nf(0).format(Math.round(r.levels[l].total.estabelecimentos)) + '</dd></div>';
    document.getElementById('detail').innerHTML = '<p class="d-kicker"><span class="lvl lvl-' + l + '">' + NAME[l] + '</span>' + PLAIN[l] + ' · ' + esc(mm.levels[l].geo) + '</p>' +
      '<p class="d-val">' + mi(v) + '<small> por ano</small></p><p class="d-text">' + DEF[l] + '</p><p class="d-week"><b>Na WEEK:</b> ' + esc(week) + '</p>' +
      '<dl class="d-stats">' + stats + '</dl><p class="d-calc">' + calc + '</p>' +
      '<div class="d-nav">' + LEVELS.map(function (x) { return '<button type="button" class="chip-btn' + (x === l ? ' primary' : '') + '" data-level="' + x + '" aria-pressed="' + (x === l) + '">' + NAME[x] + '</button>'; }).join('') +
      (next ? '<button type="button" class="chip-btn" data-level="' + next + '">Próximo: ' + NAME[next] + ' →</button>' : '<a class="chip-btn" href="#simule">Simular premissas →</a>') + '</div>';
  }
  function renderCircles() {
    var m = state.model, mm = M(), r = res(m), tam = r.levels.tam.total.valor;
    var W = 460, H = 330, bottom = 316, R = 150, cx = 158, lx = 336;
    var it = LEVELS.map(function (l) { var v = r.levels[l].total.valor, rad = Math.max(4, R * Math.sqrt(v / tam)); return { l: l, v: v, r: rad, cy: bottom - rad }; });
    var ly = [it[0].cy - it[0].r + 36, it[1].cy, it[2].cy];
    for (var k = 1; k < 3; k++) if (ly[k] - ly[k - 1] < 78) ly[k] = ly[k - 1] + 78;
    var over = ly[2] + 30 - H; if (over > 0) ly = ly.map(function (y) { return y - over; });
    var svg = it.map(function (o, k) {
      var ex = cx + o.r * 0.92, ey = k === 0 ? o.cy - o.r * 0.39 : o.cy;
      return '<g class="c-item c-' + o.l + (state.sel === o.l ? ' on' : '') + '" data-level="' + o.l + '" tabindex="0" role="button" aria-label="' + NAME[o.l] + ' ' + esc(mm.levels[o.l].geo) + ': ' + mi(o.v) + '">' +
        '<circle class="c" cx="' + cx + '" cy="' + o.cy.toFixed(1) + '" r="' + o.r.toFixed(1) + '"/><polyline class="c-lead" points="' + ex.toFixed(1) + ',' + ey.toFixed(1) + ' ' + (lx - 10) + ',' + ly[k].toFixed(1) + '"/>' +
        '<text class="c-t1" x="' + lx + '" y="' + (ly[k] - 14).toFixed(1) + '">' + NAME[o.l] + '</text><text class="c-t2" x="' + lx + '" y="' + (ly[k] + 8).toFixed(1) + '">' + mi(o.v) + '</text>' +
        '<text class="c-t3" x="' + lx + '" y="' + (ly[k] + 26).toFixed(1) + '">' + (k ? share(o.v / tam) + ' do TAM' : esc(mm.levels.tam.geo)) + '</text></g>';
    }).join('');
    document.getElementById('circles').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Círculos proporcionais de TAM, SAM e SOM">' + svg + '</svg>';
    document.getElementById('circles-note').innerHTML = '<b>Outra forma de ver o funil.</b> A área de cada círculo é proporcional ao valor: o SOM ocupa ' + share(it[2].v / tam) + ' da área do TAM. Toque em um círculo para ver o detalhe acima.';
  }

  /* ---------- simulador ---------- */
  var simModel = null;
  function buildSim() {
    var m = state.model; simModel = m;
    document.getElementById('sim-controls').innerHTML = SIM_KEYS[m].map(function (k) {
      var s = C.getSpec(m, k), id = 'sim-' + m + '-' + k;
      return '<div class="ctrl"><div class="ctrl-top"><label for="' + id + '">' + esc(s.label) + '</label><span class="ctrl-val" data-val="' + k + '"></span></div>' +
        '<input type="range" id="' + id + '" data-key="' + k + '" min="' + s.min + '" max="' + s.max + '" step="' + s.step + '" value="' + C.toDisplay(m, k, state.inputs[m][k]) + '">' +
        '<div class="ctrl-base"><span>Valor do estudo: ' + fmtIn(m, k, D.BASE_INPUTS[m][k]) + '</span><span>' + s.min + '–' + s.max + (s.type === 'pct' ? '%' : '') + '</span></div></div>';
    }).join('');
    syncSim();
  }
  function syncSim() {
    var m = state.model;
    document.querySelectorAll('#sim-controls [data-key]').forEach(function (inp) {
      var k = inp.getAttribute('data-key');
      if (document.activeElement !== inp) inp.value = C.toDisplay(m, k, state.inputs[m][k]);
      var vEl = document.querySelector('[data-val="' + k + '"]');
      vEl.textContent = fmtIn(m, k, state.inputs[m][k]);
      vEl.classList.toggle('changed', Math.abs(state.inputs[m][k] - D.BASE_INPUTS[m][k]) > 1e-12);
    });
  }
  function renderSimOut() {
    var m = state.model, mm = M(), r = res(m), b = BASE[m], ch = C.changedInputs(m, state.inputs[m]), mod = ch.length > 0;
    var som = r.levels.som.total.valor, bs = b.levels.som.total.valor, max = Math.max(r.levels.tam.total.valor, b.levels.tam.total.valor);
    var rows = LEVELS.map(function (l) {
      var v = r.levels[l].total.valor, bv = b.levels[l].total.valor, d = (v - bv) / bv;
      // escala raiz para que o SOM continue visível ao lado do TAM; os valores escritos são exatos
      var wv = Math.sqrt(v / max) * 100, wb = Math.sqrt(bv / max) * 100;
      return '<div class="sim-row"><span class="lvl lvl-' + l + '">' + NAME[l] + '</span><span class="sim-bar"><i class="base" style="width:' + wb.toFixed(1) + '%"></i><i style="width:' + wv.toFixed(1) + '%;background:var(--l-' + l + ');opacity:.9"></i></span><span class="v">' + mi(v) + '<small class="delta ' + deltaCls(d) + '">' + signed(d) + '</small></span></div>';
    }).join('');
    var last = state.last[m], txt = '';
    if (mod && last && ch.indexOf(last.key) >= 0) {
      var s = C.getSpec(m, last.key), a = D.ASSUMPTIONS.filter(function (x) { return x.model === m && x.key === last.key; })[0];
      var lvl = a ? a.level : 'TAM', aff = lvl === 'TAM' ? 'o TAM, o SAM e o SOM' : lvl === 'SAM' ? 'o SAM e o SOM' : 'só o SOM';
      txt = '<p class="changed-txt"><b>O que mudou:</b> ' + esc(s.label.toLowerCase()) + ' foi de ' + fmtIn(m, last.key, D.BASE_INPUTS[m][last.key]) + ' para ' + fmtIn(m, last.key, state.inputs[m][last.key]) + '. Essa premissa entra no ' + lvl + ', então muda ' + aff + '.</p>';
    }
    document.getElementById('sim-out').innerHTML = '<span class="badge' + (mod ? ' sim' : '') + '">' + (mod ? 'Cenário simulado · ' + ch.length + (ch.length > 1 ? ' premissas alteradas' : ' premissa alterada') : 'Valores do estudo') + '</span>' +
      '<div class="big-som"><span>SOM · ' + esc(mm.levels.som.geo) + '</span><b>' + mi(som) + '</b><span class="delta ' + deltaCls(som - bs) + '">' + (mod ? signed((som - bs) / bs) + ' vs. estudo (' + mi(bs) + ')' : 'mercado de entrada por ano') + '</span></div>' +
      '<div class="sim-rows">' + rows + '</div>' + txt +
      '<p class="fine">Barra cinza: valor do estudo. Barra colorida: cenário atual. O SOM continua sem taxa de captura.</p>' +
      '<button type="button" class="chip-btn reset" data-reset' + (mod ? '' : ' disabled') + '>Voltar aos valores do estudo</button>';
  }

  /* ---------- comparação ---------- */
  function renderCompare() {
    var rc = res('b2c'), rb = res('b2b'), max = Math.max(rc.levels.tam.total.valor, rb.levels.tam.total.valor);
    function col(m, r) {
      var mm = D.MODELS[m];
      return '<div class="cmp-col"><h3><span class="pill ' + m + '">' + mm.name + '</span>' + esc(mm.title) + '</h3>' + LEVELS.map(function (l) {
        var v = r.levels[l].total.valor;
        return '<div class="cmp-row"><span class="lbl"><span class="lvl lvl-' + l + '">' + NAME[l] + '</span></span><span class="cmp-track"><i style="width:' + Math.max(0.6, v / max * 100).toFixed(2) + '%;background:' + (m === 'b2c' ? 'var(--l-tam)' : 'var(--teal)') + '"></i></span><b>' + mi(v) + '</b></div>';
      }).join('') + '<p class="fine">' + mm.levels.tam.geo + ' → ' + mm.levels.sam.geo + ' → ' + mm.levels.som.geo + '. SOM = ' + share(r.levels.som.total.valor / r.levels.tam.total.valor) + ' do TAM.</p></div>';
    }
    var rows = [
      ['Onde está o TAM', 'Brasil', 'Sudeste'],
      ['Quem compra', 'Consumidor final, pelo site', 'Academia ou hotel'],
      ['Preço por kit', F.brl(rc.inputs.preco), F.brl(rb.inputs.preco)],
      ['O que filtra o SAM', 'Sudeste × classes A e B × compra online (' + pct(rc.factorSummary.sam) + ')', 'SP × academias premium (' + pct(rb.factors.sam.academias) + ') e hotéis (' + pct(rb.factors.sam.hoteis) + ')'],
      ['Mercado de entrada', 'Estado de SP · ' + mi(rc.levels.som.total.valor), 'Campinas · ' + mi(rb.levels.som.total.valor)]
    ];
    document.getElementById('compare').innerHTML = '<div class="cmp">' + col('b2c', rc) + col('b2b', rb) + '</div>' +
      '<div class="cmp-table-wrap"><table class="cmp-table"><thead><tr><th scope="col">O que muda</th><th scope="col">B2C</th><th scope="col">B2B</th></tr></thead><tbody>' +
      rows.map(function (x) { return '<tr><th scope="row">' + esc(x[0]) + '</th><td>' + esc(x[1]) + '</td><td>' + esc(x[2]) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="cmp-warn"><b>Um TAM maior não torna um modelo melhor.</b> O B2C parte do Brasil inteiro e o B2B só do Sudeste; os preços e os compradores são outros, e parte do público aparece nos dois (o aluno da academia premium). Compare também o SAM, o SOM e o custo de atender cada canal.</p>';
  }

  /* ---------- premissas ---------- */
  var sens = {};
  function impact(a) {
    if (!a.key) return '';
    var k = a.model + a.key; if (!(k in sens)) sens[k] = C.sensitivity(a.model, a.key, 0.1);
    return sens[k] ? '<span class="impact">Se subir 10%, o SOM muda ' + signed(sens[k].som) + '</span>' : '';
  }
  function src(a) {
    return a.sources.map(function (k) { var s = D.SOURCES[k]; return s.url ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + ' ↗</a>' : esc(s.label); }).join(' · ');
  }
  function renderAssump() {
    var m = state.model;
    document.getElementById('checks').innerHTML = PRIORITY[m].map(function (id) {
      var a = D.ASSUMPTIONS.filter(function (x) { return x.id === id; })[0];
      return '<article class="check"><div class="check-top"><h3>' + esc(a.name) + '</h3><span class="check-val">' + esc(a.value) + '</span></div>' + conf(a.confidence) +
        '<p>' + esc(a.logic) + '</p><p class="how"><b>Como validar:</b> ' + esc(a.validation) + '</p>' + impact(a) + '</article>';
    }).join('');
    var last = '';
    document.getElementById('assump-list').innerHTML = D.ASSUMPTIONS.filter(function (a) { return a.model === m; }).map(function (a) {
      var g = a.level + ' · ' + a.segment, head = g !== last ? '<p class="a-group">' + esc(g) + '</p>' : '';
      last = g;
      return head + '<div class="a-row"><h4>' + esc(a.name) + '</h4><span class="a-val">' + esc(a.value) + '</span><p>' + esc(a.logic) + '</p><div class="a-meta">' + conf(a.confidence) + '<span>Fonte: ' + (a.sourceNote ? esc(a.sourceNote) + ' · ' : '') + src(a) + '</span><span>' + esc(a.validation) + '</span></div></div>';
    }).join('');
  }

  /* ---------- notas e CAGR ---------- */
  function renderNotes() {
    var ids = ['captura', 'sobreposicao', 'comprador', 'escopos', 'cagr', 'nicho', 'share-antigo', 'arredondamento', 'proxies'];
    document.getElementById('notes').innerHTML = ids.map(function (id) {
      var n = D.NOTES.filter(function (x) { return x.id === id; })[0];
      return '<article><h3>' + esc(n.title) + '</h3><p>' + esc(n.text) + '</p></article>';
    }).join('');
  }
  function parseBR(s) {
    var t = String(s || '').trim().replace(/\s|R\$/g, ''); if (!t) return NaN;
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.'); else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    return /^-?\d*\.?\d+$/.test(t) ? parseFloat(t) : NaN;
  }
  function renderCagr() {
    var f = document.getElementById('cagr-form'), out = document.getElementById('cagr-out');
    var vi = parseBR(f.vi.value), vf = parseBR(f.vf.value), n = parseBR(f.n.value);
    if ([vi, vf, n].some(isNaN)) { out.textContent = 'Preencha os três campos com números (ex.: 150.000).'; return; }
    var r = C.cagr(vi, vf, n);
    if (!r.ok) { out.textContent = r.error; return; }
    out.innerHTML = 'Crescimento médio de <b>' + (r.rate < 0 ? '−' : '') + nf(2, 2).format(Math.abs(r.rate) * 100) + '% ao ano</b>. Os valores iniciais são os do mercado de cabelos (Euromonitor, R$ bi de 2023 a 2028); troque pelos que quiser testar.';
  }

  /* ---------- market share ---------- */
  var MS_COLOR = { unilever: 'var(--l-tam)', loreal: 'var(--teal)', pg: 'var(--amber)', demais: 'var(--neutral)' };
  function srcList(keys) { return keys.map(function (k) { var x = D.SOURCES[k]; return x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + esc(x.label) + ' ↗</a>' : esc(x.label); }).join(' · '); }
  function confM(id) {
    var c = D.CONFIDENCE.filter(function (x) { return x.id === id; })[0];
    return conf(id).replace('</span>Confiança', '</span><span title="' + esc(D.CONFIDENCE_MARKET[id]) + '">Confiança') + '</span>';
  }
  var marketStatic = false;
  function renderMarket() {
    var ms = D.MARKET_SHARE, calc = C.marketShare(res('b2c').levels.tam.total.valor), base = C.marketShare();
    if (!marketStatic) {
      marketStatic = true;
      document.getElementById('ms-share').innerHTML = '<div class="ms-bar" role="img" aria-label="' + esc(ms.companies.map(function (c) { return c.name + ' ' + pct(c.share); }).join(', ')) + '">' +
        ms.companies.map(function (c) { return '<i style="flex-basis:' + (c.share * 100) + '%;background:' + MS_COLOR[c.id] + '">' + (c.share > 0.08 ? pct(c.share) : '') + '</i>'; }).join('') + '</div>' +
        '<ul class="ms-list">' + ms.companies.map(function (c) {
          return '<li><span class="sw" style="background:' + MS_COLOR[c.id] + '"></span><span><b>' + esc(c.name) + '</b><small>' + esc(c.brands) + '</small></span><span class="ms-pct">' + pct(c.share) + '</span></li>';
        }).join('') + '</ul>' +
        '<p class="ms-sum"><b>' + pct(base.top3) + '</b> nas mãos das 3 maiores · concentração <b>' + esc(ms.reference.concentration.toLowerCase()) + '</b> (Mordor, 2026)</p>' +
        '<p class="warn-inline">Referência histórica: desde 2014 o Elseve, da L’Oréal, passou de 3ª para 1ª marca de cabelos do Brasil (2025). Os percentuais atuais por empresa são pagos (Euromonitor, NielsenIQ).</p>';
      var facts = [
        ['Marca líder em cabelos (2025)', 'Elseve (L’Oréal)', 'Passou de 3ª para 1ª marca e dobrou a participação em cinco anos, segundo a própria L’Oréal.'],
        ['Shampoo em 2025', '+3,6% em valor', '−2,3% em volume (NielsenIQ via ABAD): o consumidor paga mais por produto.'],
        ['Condicionador em 2025', '+6% em valor', '−1% em volume (NielsenIQ via ABAD): a mesma tendência de trocar volume por valor.'],
        ['Concorrentes diretos', 'Sem dado público', 'We Green e Naturys Eco vendem sachês para hotéis e não divulgam faturamento.']
      ];
      document.getElementById('ms-facts').innerHTML = facts.map(function (f) { return '<article class="fact"><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b><p>' + esc(f[2]) + '</p></article>'; }).join('');
      document.getElementById('ms-reading').innerHTML = '<b>Leitura para a WEEK:</b> o mercado de cabelos é grande e dominado por três empresas de massa, que vendem para o banho em casa. O banho fora de casa equivale a cerca de 1/15 do setor e hoje é atendido por produtos comuns, amenities de hotel e sachês genéricos. A WEEK não disputa preço nem distribuição com as líderes: ela entra num nicho que nenhuma delas atende com produto premium.';
      var lastG = '';
      document.getElementById('ms-assump').innerHTML = ms.assumptions.map(function (a) {
        var head = a.group !== lastG ? '<p class="a-group">' + esc(a.group) + '</p>' : ''; lastG = a.group;
        return head + '<div class="a-row"><h4>' + esc(a.name) + '</h4><span class="a-val">' + esc(a.value) + '</span><p>' + esc(a.logic) + '</p><div class="a-meta">' + confM(a.confidence) + '<span>Fonte: ' + srcList(a.sources) + '</span><span>' + esc(a.validation) + '</span></div></div>';
      }).join('');
    }
    var sim = Math.abs(calc.tamB2C - base.tamB2C) > 1;
    var w = Math.max(0.8, Math.min(100, calc.nicheShare * 100));
    document.getElementById('ms-niche').innerHTML =
      '<div class="niche"><div class="niche-row"><span>Mercado de cabelos · Brasil, 2023</span><b>R$ ' + nf(1, 1).format(ms.hairMarket.value / 1e9) + ' bi</b></div><div class="niche-track"><i style="width:100%"></i></div>' +
      '<div class="niche-row"><span>TAM B2C da WEEK · banho fora de casa' + (sim ? ' (cenário simulado)' : '') + '</span><b>R$ ' + nf(2, 2).format(calc.tamB2C / 1e9) + ' bi</b></div><div class="niche-track"><i class="tam" style="width:' + w.toFixed(2) + '%"></i></div></div>' +
      '<p class="niche-big"><b>' + nf(1, 1).format(calc.nicheShare * 100) + '%</b><span>do mercado de cabelos, cerca de 1/' + nf(0).format(Math.round(calc.oneIn)) + ' do setor' + (sim ? '' : ' (o PDF arredonda para 6,6%: 1,85 ÷ 28,2)') + '</span></p>' +
      '<p class="fine">Ordem de grandeza: o TAM é um potencial teórico a R$ 3,50 por lavagem e só inclui shampoo e condicionador; o mercado de cabelos são vendas efetivas e inclui tintura, tratamento e finalizadores.</p>';
  }

  /* ---------- CAGR ---------- */
  var LAYER_COLOR = { 'Setor': 'var(--neutral)', 'Público': 'var(--l-tam)', 'Canal': 'var(--teal)', 'B2B': 'var(--amber)' };
  function fmtV(row, v) {
    if (row.unit === '%') return nf(1, 1).format(v * 100) + '%';
    if (row.unit === 'R$' && v < 1e4) return F.brl(v);
    if (row.unit === 'R$' || row.unit === 'US$') return row.unit + ' ' + nf(2).format(v / 1e9) + ' bi';
    return v >= 1e6 ? nf(2).format(v / 1e6) + ' mi' : nf(0).format(v);
  }
  function renderCagrSection() {
    var rows = C.cagrRows();
    document.getElementById('cagr-tiles').innerHTML = D.CAGR.summary.map(function (t, k) {
      var layer = ['Setor', 'Público', 'Canal', 'B2B'][k];
      return '<li style="--c:' + LAYER_COLOR[layer] + '"><span>' + esc(t.label) + '</span><b>' + esc(t.value) + '</b></li>';
    }).join('');
    document.getElementById('cagr-legend').innerHTML = Object.keys(LAYER_COLOR).map(function (k) { return '<span><i style="background:' + LAYER_COLOR[k] + '"></i>' + k + '</span>'; }).join('');
    var max = Math.max.apply(null, rows.map(function (x) { return x.rate; }));
    var sorted = rows.slice().sort(function (a, b) { return b.rate - a.rate; });
    document.getElementById('cagr-bars').innerHTML = '<ul class="cbars">' + sorted.map(function (x) {
      var row = x.row, layer = row.layer || 'Setor', one = x.years === 1;
      return '<li><span class="cb-name"><b>' + esc(row.name) + '</b><small>' + row.yi + '–' + row.yf + ' · ' + esc(row.layer ? row.layer : 'Setor') + (row.unit === 'US$' ? ' · em dólar' : row.unit === 'R$' && row.vi > 1e4 ? ' · em reais' : '') + '</small></span>' +
        '<span class="cb-track"><i style="width:' + (x.rate / max * 100).toFixed(1) + '%;background:' + LAYER_COLOR[layer] + '"></i></span>' +
        '<span class="cb-val"><b>' + nf(1, 1).format(x.rate * 100) + '%</b><small>' + (one ? 'em 1 ano' : 'ao ano') + '</small></span></li>';
    }).join('') + '</ul>';
    document.getElementById('cagr-reading').innerHTML = '<b>Leitura para a WEEK:</b> ' + esc(D.CAGR.reading);
    document.getElementById('cagr-assump').innerHTML = rows.map(function (x) {
      var row = x.row;
      return '<div class="a-row"><h4>' + esc(row.name) + (row.layer ? '' : ' (setor)') + '</h4><span class="a-val">' + fmtV(row, row.vi) + ' → ' + fmtV(row, row.vf) + '</span><p>' + esc(row.note) + ' CAGR = (' + fmtV(row, row.vf) + ' ÷ ' + fmtV(row, row.vi) + ')<sup>1/' + x.years + '</sup> − 1 = <b>' + nf(1, 1).format(x.rate * 100) + '%</b>.</p>' +
        '<div class="a-meta">' + confM(row.confidence) + '<span>Fonte: ' + srcList(row.sources) + '</span><span>' + esc(row.validation) + '</span></div></div>';
    }).join('');
  }

  /* ---------- orquestração ---------- */
  var raf = 0, parts = {};
  function render(list) {
    (list || ['hero', 'segs', 'funnel', 'sim', 'compare', 'assump', 'market']).forEach(function (p) { parts[p] = true; });
    if (!raf) raf = requestAnimationFrame(function () {
      raf = 0; var p = parts; parts = {};
      try {
        if (p.hero) renderHero();
        if (p.segs) renderSegs();
        if (p.funnel) { renderFunnel(); renderDetail(); renderCircles(); }
        if (p.sim) { if (simModel !== state.model) buildSim(); else syncSim(); renderSimOut(); }
        if (p.compare) renderCompare();
        if (p.assump) renderAssump();
        if (p.market) renderMarket();
      } catch (e) { if (window.console) console.error(e); }
    });
  }
  function setModel(m) {
    if (m === state.model) return;
    state.model = m;
    document.querySelectorAll('[data-model]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-model') === m ? 'true' : 'false'); });
    document.querySelectorAll('[data-model-name]').forEach(function (s) { s.textContent = D.MODELS[m].name; });
    render();
  }
  function goTo(id) {
    var el = document.getElementById(id); if (!el) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var top = el.getBoundingClientRect().top + window.pageYOffset - document.getElementById('top').offsetHeight - 8;
    try { window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, top); }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : e.target.parentNode; if (!t || !t.closest) return;
    var el;
    if ((el = t.closest('a[href^="#"]'))) { var id = el.getAttribute('href').slice(1); if (document.getElementById(id)) { e.preventDefault(); goTo(id); } return; }
    if ((el = t.closest('[data-model]'))) { setModel(el.getAttribute('data-model')); return; }
    if ((el = t.closest('[data-go-level]'))) { state.sel = el.getAttribute('data-go-level'); render(['funnel']); goTo('funil'); return; }
    if ((el = t.closest('[data-level]'))) { state.sel = el.getAttribute('data-level'); render(['funnel']); return; }
    if ((el = t.closest('[data-reset]'))) { var m = state.model; state.inputs[m] = C.baseInputs(m); state.last[m] = null; render(); return; }
  });
  document.addEventListener('keydown', function (e) {
    var g = e.target; if ((e.key === 'Enter' || e.key === ' ') && g && g.getAttribute && g.getAttribute('role') === 'button' && g.tagName.toLowerCase() === 'g') { e.preventDefault(); state.sel = g.getAttribute('data-level'); render(['funnel']); }
  });
  var simForm = document.getElementById('sim-controls');
  simForm.addEventListener('submit', function (e) { e.preventDefault(); });
  simForm.addEventListener('input', function (e) {
    var k = e.target.getAttribute('data-key'); if (!k) return;
    var m = state.model, p = C.parseUserValue(m, k, e.target.value); if (!p.ok) return;
    var next = {}; Object.keys(state.inputs[m]).forEach(function (x) { next[x] = state.inputs[m][x]; }); next[k] = p.value;
    if (C.validateInputs(m, next).length) return;
    state.inputs[m] = next; state.last[m] = { key: k };
    render(['sim']);
    clearTimeout(simForm._t); simForm._t = setTimeout(function () { render(['hero', 'segs', 'funnel', 'compare', 'market']); }, 180);
  });
  var cf = document.getElementById('cagr-form');
  cf.addEventListener('input', renderCagr); cf.addEventListener('submit', function (e) { e.preventDefault(); });

  // Dica ao passar o mouse ou focar uma faixa do funil (o toque abre o detalhe)
  var tip = document.getElementById('tip');
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest('.f-stage, .c-item');
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.getAttribute('aria-label'); tip.hidden = false;
    var r = el.getBoundingClientRect(); tip.style.left = Math.max(8, Math.min(r.left + r.width / 2 - 130, window.innerWidth - 270)) + 'px'; tip.style.top = Math.max(8, r.top - 44) + 'px';
  });
  window.addEventListener('scroll', function () { tip.hidden = true; }, { passive: true });

  renderNotes(); renderCagr(); renderCagrSection();
  render();
})();
