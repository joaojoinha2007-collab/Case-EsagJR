/*
 * landing.js — Landing page do estudo de mercado WEEK Haircare.
 * Todo número exibido vem do motor testado (WeekData, WeekCalc, WeekFormat).
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
  var SEG_ICON = { academia: 'dumbbell', trabalho: 'briefcase', viagem: 'plane', academias: 'dumbbell', hoteis: 'bed' };
  var LEVEL_COLOR = { tam: 'var(--l-tam)', sam: 'var(--l-sam)', som: 'var(--l-som)' };
  var SIM_KEYS = {
    b2c: ['preco', 'pctBanhoAcademia', 'pctBanhoTrabalho', 'banhosAno', 'pesoSP'],
    b2b: ['preco', 'pctBanhoAcademia', 'ocupacao', 'kitsPorQuarto', 'pctPremium']
  };

  var state = {
    model: 'b2c', sel: 'som', view: 'funnel', ms: 'share', cagrLayer: null, conf: null,
    pick: { b2c: null, b2b: null },
    inputs: { b2c: C.baseInputs('b2c'), b2b: C.baseInputs('b2b') }, last: { b2c: null, b2b: null }
  };
  var BASE = { b2c: C.compute('b2c'), b2b: C.compute('b2b') };
  var cache = { b2c: null, b2b: null };
  function res(m) {
    if (cache[m] && cache[m].i === state.inputs[m]) return cache[m].r;
    var r = C.compute(m, state.inputs[m]); if (!r.valid) r = BASE[m];
    cache[m] = { i: state.inputs[m], r: r }; return r;
  }
  function M() { return D.MODELS[state.model]; }
  function $(id) { return document.getElementById(id); }

  /* ---------- formatação ---------- */
  var nfc = {};
  function nf(max, min) { var k = (min || 0) + ':' + max; return nfc[k] || (nfc[k] = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min || 0, maximumFractionDigits: max })); }
  /* Valores a partir de R$ 1 bilhão sempre em bilhões (R$ 1,85 bi); abaixo disso, em milhões */
  function mi(v) {
    if (Math.abs(v) >= 1e9) return 'R$ ' + nf(2, 2).format(v / 1e9) + ' bi';
    var a = Math.abs(v) / 1e6, d = a >= 10 ? 1 : 2; return 'R$ ' + nf(d, d).format(a) + ' mi';
  }
  function qty(v) { var a = Math.abs(v); if (a >= 1e6) return nf(a >= 1e8 ? 1 : 2).format(v / 1e6) + ' mi'; if (a >= 1e4) return nf(a >= 1e5 ? 1 : 2).format(v / 1e3) + ' mil'; if (a >= 100) return nf(0).format(v); return nf(2).format(v); }
  function pct(v) { return nf(2).format(v * 100) + '%'; }
  function share(v) { return v >= 0.1 ? nf(1).format(v * 100) + '%' : nf(2).format(v * 100) + '%'; }
  function signed(v) { return F.signedPct(v); }
  function fmtIn(m, k, v) { var s = C.getSpec(m, k); if (k === 'preco') return F.brl(v); if ((s && s.type === 'pct') || /^(pct|peso|fator|ocupacao)/.test(k)) return pct(v); return nf(2).format(v) + (s && s.unit ? ' ' + s.unit : ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function deltaCls(d) { return Math.abs(d) < 1e-6 ? 'flat' : d > 0 ? 'up' : 'down'; }
  function unit(m) { return m === 'b2c' ? 'lavagens' : 'kits'; }
  function icon(id, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
  function confOf(id) { return D.CONFIDENCE.filter(function (x) { return x.id === id; })[0]; }
  function conf(id, crit) {
    var c = confOf(id); if (!c) return '';
    var cells = ''; for (var i = 1; i <= 5; i++) cells += '<i class="' + (i <= c.score ? 'on' : '') + '"></i>';
    return '<span class="conf' + (c.score <= 2 ? ' low' : '') + '"' + (crit ? ' title="' + esc(crit) + '"' : '') + '><span class="meter" aria-hidden="true">' + cells + '</span>Confiança ' + c.label.toLowerCase() + '</span>';
  }
  function srcList(keys) { return keys.map(function (k) { var x = D.SOURCES[k]; return x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + esc(x.label) + ' ↗</a>' : esc(x.label); }).join(' · '); }

  /* ================================================================ */
  /* Hero e resumo                                                     */
  /* ================================================================ */
  function renderHero() {
    var m = state.model, r = res(m), tam = r.levels.tam.total.valor;
    $('hero-title').innerHTML = m === 'b2c'
      ? 'Um mercado potencial de <em>' + mi(tam) + '</em> por ano em banhos fora de casa.'
      : 'Um mercado potencial de <em>' + mi(tam) + '</em> por ano em kits para academias e hotéis.';
    $('hero-lead').textContent = m === 'b2c'
      ? 'Banhos na academia, no trabalho e em viagens, a ' + F.brl(r.inputs.preco) + ' por lavagem. O estudo chega ao público que o site da WEEK pode atender, começando pelo estado de São Paulo.'
      : 'Kits que academias e hotéis do Sudeste usariam em um ano, a ' + F.brl(r.inputs.preco) + ' por kit. O estudo chega às academias premium e hotéis de São Paulo, começando por Campinas.';
  }

  function renderBento() {
    var m = state.model, mm = M(), r = res(m), tam = r.levels.tam.total.valor;
    $('resumo-title').textContent = 'O mercado ' + mm.name + ' da WEEK em três números';
    var html = LEVELS.map(function (l) {
      var t = r.levels[l].total, sh = t.valor / tam;
      return '<button type="button" class="kpi" data-go-level="' + l + '" aria-label="' + NAME[l] + ' ' + esc(mm.levels[l].geo) + ': ' + mi(t.valor) + ' por ano. Ver no funil.">' +
        '<span class="kpi-top"><span class="lvl lvl-' + l + '">' + NAME[l] + '</span><span class="kpi-geo">' + esc(mm.levels[l].geo) + '</span><span class="kpi-name">' + PLAIN[l] + '</span></span>' +
        '<span class="kpi-val">' + mi(t.valor) + '<small>/ano</small></span>' +
        '<span class="kpi-meter" aria-hidden="true"><i style="width:' + Math.max(1.2, sh * 100).toFixed(2) + '%;background:' + LEVEL_COLOR[l] + '"></i></span>' +
        '<span class="kpi-foot"><span>' + (l === 'tam' ? 'Universo total' : '<b>' + share(sh) + '</b> do TAM') + '</span><span><b>' + qty(t.volume) + '</b> ' + unit(m) + '/ano</span></span></button>';
    }).join('');
    var ms = C.marketShare(res('b2c').levels.tam.total.valor);
    var nVal = D.ASSUMPTIONS.filter(function (a) { return a.model === m && a.status === 'validar'; }).length;
    html += '<a class="ctx" href="#mercado" style="--c:var(--week);--c-soft:var(--week-soft)"><span class="ctx-ic">' + icon('pie') + '</span><span><b>' + nf(1, 1).format(ms.nicheShare * 100) + '%</b><span>do mercado de cabelos do Brasil é banho fora de casa (TAM B2C)</span></span>' + icon('arrow') + '</a>' +
      '<a class="ctx" href="#crescimento" style="--c:var(--teal-ink);--c-soft:var(--teal-soft)"><span class="ctx-ic">' + icon('trend') + '</span><span><b>4% a 9% a.a.</b><span>crescimento do setor; academias crescem 9,1% a.a.</span></span>' + icon('arrow') + '</a>' +
      '<a class="ctx" href="#validar" style="--c:var(--amber-ink);--c-soft:var(--amber-soft)"><span class="ctx-ic">' + icon('alert') + '</span><span><b>' + nVal + ' premissas</b><span>do ' + mm.name + ' ainda serão validadas na pesquisa</span></span>' + icon('arrow') + '</a>';
    $('bento').innerHTML = html;
  }

  /* ================================================================ */
  /* Como funciona (fluxograma)                                        */
  /* ================================================================ */
  function renderFlow() {
    var m = state.model, mm = M(), r = res(m), i = r.inputs, L = r.levels;
    var nodes;
    if (m === 'b2c') {
      $('como-sub').textContent = 'Contamos quem toma banho fora de casa, multiplicamos pelos banhos por ano e pelo preço do kit, e depois aplicamos os filtros de região, renda e canal.';
      nodes = [
        { ic: 'users', label: 'Quem toma banho fora de casa', val: qty(L.tam.total.pessoas), cap: 'pessoas e viagens: academia, trabalho e viagens com pernoite', go: 'segmentos', op: '×' },
        { ic: 'drop', label: 'Banhos por ano', val: qty(L.tam.total.volume) + ' lavagens', cap: '96 por ano na academia e no trabalho; 3 por viagem', go: 'segmentos', op: '×' },
        { ic: 'tag', label: 'Mercado total · TAM', val: mi(L.tam.total.valor), cap: '× ' + F.brl(i.preco) + ' por kit · Brasil', level: 'tam', op: '▸' },
        { ic: 'filter', label: 'Mercado atendível · SAM', val: mi(L.sam.total.valor), cap: 'Sudeste × classes A e B × compra online = ' + pct(r.factorSummary.sam), level: 'sam', op: '▸' },
        { ic: 'pin', label: 'Mercado de entrada · SOM', val: mi(L.som.total.valor), cap: 'estado de SP = ' + pct(i.pesoSP) + ' do SAM', level: 'som' }
      ];
    } else {
      $('como-sub').textContent = 'Contamos academias e quartos de hotel, estimamos quantos kits usam por ano e multiplicamos pelo preço de atacado; depois filtramos por estado, perfil e cidade.';
      nodes = [
        { ic: 'building', label: 'Estabelecimentos no Sudeste', val: nf(0).format(L.tam.total.estabelecimentos), cap: nf(0).format(i.academiasSudeste) + ' academias + ' + nf(0).format(i.meiosHospedagemSudeste) + ' meios de hospedagem', go: 'segmentos', op: '×' },
        { ic: 'box', label: 'Kits por ano', val: qty(L.tam.total.volume) + ' kits', cap: 'banhos dos alunos + 1 kit por quarto ocupado por noite', go: 'segmentos', op: '×' },
        { ic: 'tag', label: 'Mercado total · TAM', val: mi(L.tam.total.valor), cap: '× ' + F.brl(i.preco) + ' por kit · Sudeste', level: 'tam', op: '▸' },
        { ic: 'filter', label: 'Mercado atendível · SAM', val: mi(L.sam.total.valor), cap: 'SP × academias premium (' + pct(r.factors.sam.academias) + ') e hotéis (' + pct(r.factors.sam.hoteis) + ')', level: 'sam', op: '▸' },
        { ic: 'pin', label: 'Mercado de entrada · SOM', val: mi(L.som.total.valor), cap: 'Campinas = ' + pct(i.fatorCampinasAcademias) + ' do SAM', level: 'som' }
      ];
    }
    $('flow').innerHTML = nodes.map(function (n) {
      var attr = n.level ? 'data-go-level="' + n.level + '"' : 'data-go="' + n.go + '"';
      return '<li><button type="button" class="flow-node' + (n.level ? ' result l-' + n.level : '') + '" ' + attr + '>' +
        '<span class="flow-step"><span class="flow-label">' + esc(n.label) + '</span><span class="flow-ic">' + icon(n.ic) + '</span></span>' +
        '<span class="flow-val">' + n.val + '</span><span class="flow-cap">' + esc(n.cap) + '</span></button>' +
        (n.op ? '<span class="flow-op" aria-hidden="true">' + n.op + '</span>' : '') + '</li>';
    }).join('');
  }

  /* ================================================================ */
  /* Segmentos                                                         */
  /* ================================================================ */
  function eqFor(m, id, r) {
    var i = r.inputs, s = r.levels.tam.segments[id];
    function t(v, l, k) { return { v: v, l: l, k: k || 'mid' }; }
    if (m === 'b2c') {
      if (id === 'academia') return [t(qty(i.alunosAcademia), 'alunos', 'in'), '×', t(pct(i.pctBanhoAcademia), 'tomam banho lá', 'in'), '×', t(nf(0).format(i.banhosAno), 'banhos/ano', 'in'), '×', t(F.brl(i.preco), 'por kit', 'in'), '=', t(mi(s.valor), 'por ano', 'out')];
      if (id === 'trabalho') return [t(qty(i.trabalhadoresCLT), 'trabalhadores CLT', 'in'), '×', t(pct(i.pctBanhoTrabalho), 'tomam banho', 'in'), '×', t(nf(0).format(i.banhosAno), 'banhos/ano', 'in'), '×', t(F.brl(i.preco), 'por kit', 'in'), '=', t(mi(s.valor), 'por ano', 'out')];
      return [t(qty(i.viagens), 'viagens com pernoite', 'in'), '×', t(nf(1).format(i.banhosPorViagem), 'banhos/viagem', 'in'), '×', t(F.brl(i.preco), 'por kit', 'in'), '=', t(mi(s.valor), 'por ano', 'out')];
    }
    if (id === 'academias') return [t(nf(0).format(i.academiasSudeste), 'academias', 'in'), '×', t(nf(0).format(i.alunosPorAcademia), 'alunos cada', 'in'), '×', t(pct(i.pctBanhoAcademia), 'tomam banho', 'in'), '×', t(nf(0).format(i.banhosAno), 'banhos/ano', 'in'), '×', t(F.brl(i.preco), 'por kit', 'in'), '=', t(mi(s.valor), 'por ano', 'out')];
    return [t(nf(0).format(i.quartosSudeste), 'quartos', 'in'), '×', t(pct(i.ocupacao), 'ocupação', 'in'), '×', t('365', 'dias', 'in'), '×', t(nf(1).format(i.kitsPorQuarto), 'kit/quarto', 'in'), '×', t(F.brl(i.preco), 'por kit', 'in'), '=', t(mi(s.valor), 'por ano', 'out')];
  }
  var SEG_WHY = {
    academia: 'Estudos com praticantes indicam 2 a 4 treinos por semana; nem todo treino termina com banho, então o estudo usa 2 banhos por semana em 48 semanas (96 por ano). Os 20% que tomam banho na academia ainda não têm dado brasileiro e serão validados na pesquisa quantitativa.',
    trabalho: 'A NR-24 exige chuveiro em atividades com sujeira ou material tóxico. Somando construção, parte da indústria e do agro, cerca de 10% a 15% dos CLT têm chuveiro; supondo que metade usa, ≈ 5%.',
    viagem: 'Em 2024 os brasileiros fizeram 20,6 mi viagens, mas 4,7 mi foram bate-volta, sem banho fora de casa; ficam as 15,8 mi com pernoite. A mediana fica em 2 a 3 noites; 1 banho por noite dá cerca de 3 banhos por viagem. Usamos 1 viajante por viagem para ser conservador.',
    academias: 'As academias do Sudeste são 45% das 55.068 do Brasil (Panorama Setorial 2026). Alunos por academia = 13 mi ÷ 55.068. O comprador é a academia; quem usa o kit é o aluno.',
    hoteis: 'Quartos do Cadastur (2º tri 2026) e ocupação média de 2025 do FOHB. A premissa de 1 kit por quarto ocupado por noite é estimativa própria e será validada com os hotéis.'
  };
  function arcPath(a0, a1, r0, r1) {
    function p(r, a) { return (r * Math.cos(a)).toFixed(2) + ' ' + (r * Math.sin(a)).toFixed(2); }
    var large = a1 - a0 > Math.PI ? 1 : 0;
    return 'M' + p(r1, a0) + ' A' + r1 + ' ' + r1 + ' 0 ' + large + ' 1 ' + p(r1, a1) + ' L' + p(r0, a1) + ' A' + r0 + ' ' + r0 + ' 0 ' + large + ' 0 ' + p(r0, a0) + 'Z';
  }
  var segOn = null;
  function renderSegs() {
    var m = state.model, mm = M(), r = res(m), tot = r.levels.tam.total.valor;
    $('seg-title').textContent = m === 'b2c' ? 'Onde as pessoas tomam banho fora de casa' : 'Quem compraria os kits';
    $('seg-sub').textContent = m === 'b2c'
      ? 'O TAM soma três situações em que alguém toma banho longe de casa. Toque em uma fatia para ver a conta.'
      : 'No B2B quem compra é o estabelecimento. O TAM soma academias e hotéis do Sudeste, ao preço de atacado.';
    var a = -Math.PI / 2, gap = 0.025, arcs = '';
    mm.segments.forEach(function (s) {
      var v = r.levels.tam.segments[s.id].valor, span = v / tot * Math.PI * 2;
      arcs += '<path class="arc' + (segOn === s.id ? ' on' : '') + '" data-seg="' + s.id + '" tabindex="0" role="button" aria-label="' + esc(s.name + ': ' + mi(v) + ', ' + share(v / tot) + ' do TAM') + '" d="' + arcPath(a + gap / 2, a + span - gap / 2, 62, 100) + '" style="fill:' + SEG_COLOR[s.id] + '"/>';
      a += span;
    });
    $('donut').className = 'donut' + (segOn ? ' has-on' : '');
    $('donut').innerHTML = '<svg viewBox="-110 -110 220 220" role="group" aria-label="Composição do TAM por segmento">' + arcs +
      '<text class="c-big" y="4">' + mi(tot) + '</text><text class="c-small" y="24">TAM ' + esc(mm.levels.tam.geo) + '</text></svg>';
    $('donut-legend').innerHTML = mm.segments.map(function (s) {
      var v = r.levels.tam.segments[s.id].valor;
      return '<li><button type="button" data-seg="' + s.id + '" aria-pressed="' + (segOn === s.id) + '"><i style="background:' + SEG_COLOR[s.id] + '"></i><span>' + esc(s.name) + '</span><b>' + share(v / tot) + '</b></button></li>';
    }).join('');
    $('segs').innerHTML = mm.segments.map(function (s) {
      var v = r.levels.tam.segments[s.id].valor;
      var eq = eqFor(m, s.id, r).map(function (t) { return typeof t === 'string' ? '<span class="eq-o" aria-hidden="true">' + t + '</span>' : '<span class="eq-t ' + t.k + '"><b>' + esc(t.v) + '</b><small>' + esc(t.l) + '</small></span>'; }).join('');
      return '<article class="seg" id="seg-' + s.id + '" style="--c:' + SEG_COLOR[s.id] + '"><div class="seg-head"><span class="seg-ic">' + icon(SEG_ICON[s.id]) + '</span><div><h3>' + esc(s.name) + '</h3><p>' + esc(s.who) + '</p></div>' +
        '<div class="seg-val"><b>' + mi(v) + '</b><span>' + share(v / tot) + ' do TAM</span></div></div>' +
        '<div class="eq" aria-label="Conta do segmento">' + eq + '</div>' +
        (s.id === 'hoteis' ? '<p class="warn-inline">1 kit por quarto ocupado por noite é uma estimativa a validar, não uma prática comprovada de todos os hotéis.</p>' : '') +
        '<details><summary>Por que esses números? ' + icon('down', 'chev') + '</summary><p>' + esc(SEG_WHY[s.id]) + '</p></details></article>';
    }).join('');
  }
  function focusSeg(id) {
    segOn = segOn === id ? null : id;
    renderSegs();
    if (segOn) {
      var card = $('seg-' + id);
      if (card) { card.classList.add('flash'); setTimeout(function () { card.classList.remove('flash'); }, 1400); if (window.innerWidth <= 960) goTo('seg-' + id); }
    }
  }

  /* ================================================================ */
  /* Funil, detalhe e círculos                                         */
  /* ================================================================ */
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
      add({ level: 'sam', label: 'No estado de SP', sub: 'peso geográfico', value: t.academias.valor * i.pesoSPAcademias + t.hoteis.valor * i.pesoSPQuartos, filter: '× ' + pct(i.pesoSPAcademias) + ' academias · × ' + pct(i.pesoSPQuartos) + ' quartos' });
      add({ level: 'sam', major: true, label: mm.levels.sam.geo, sub: 'academias premium + hotéis', value: L.sam.total.valor, filter: '× ' + pct(i.pctPremium) + ' premium · × ' + pct(i.pctHoteis) + ' hotéis' });
      add({ level: 'som', major: true, label: mm.levels.som.geo, sub: 'recorte de entrada', value: L.som.total.valor, filter: '× ' + pct(i.fatorCampinasAcademias) + ' · × ' + pct(i.fatorCampinasHoteis) + ' em Campinas' });
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
        html += '<div class="f-flow" aria-hidden="true"><span class="f-filter">' + icon('filter') + esc(s.filter) + '</span><span class="f-track"><span class="f-trap" style="clip-path:' + poly + ';-webkit-clip-path:' + poly + '"></span></span><span class="f-delta">−' + mi(-d) + '</span></div>';
      }
      var on = s.major && s.level === sel, dim = sel && s.level !== sel;
      html += '<button type="button" class="f-stage ' + (s.major ? 'major l-' + s.level : 'minor') + (on ? ' on' : '') + (dim ? ' dim' : '') + '" data-level="' + s.level + '" aria-pressed="' + on + '" aria-label="' + esc((s.major ? NAME[s.level] + ' ' : '') + s.label + ': ' + mi(s.value) + ', ' + share(s.share) + ' do TAM') + '">' +
        '<span class="f-name">' + (s.major ? '<span class="lvl lvl-' + s.level + '">' + NAME[s.level] + '</span>' : '') + '<b>' + esc(s.label) + '</b><small>' + esc(s.sub) + '</small></span>' +
        '<span class="f-track"><span class="f-bar" style="width:' + w[k].toFixed(2) + '%"></span></span>' +
        '<span class="f-val"><b>' + mi(s.value) + '</b><small>' + share(s.share) + ' do TAM</small></span></button>';
    });
    $('funnel').innerHTML = html;
  }
  function renderDetail() {
    var m = state.model, mm = M(), r = res(m), l = state.sel, i = r.inputs, idx = LEVELS.indexOf(l);
    var v = r.levels[l].total.valor, tam = r.levels.tam.total.valor, prev = LEVELS[idx - 1], next = LEVELS[idx + 1];
    var week = {
      b2c: { tam: 'Todos os banhos fora de casa no Brasil, na academia, no trabalho e em viagens, a ' + F.brl(i.preco) + ' por lavagem.', sam: 'Só quem mora no Sudeste, é das classes A e B e compra pela internet: o público que o site da WEEK alcança agora.', som: 'O SAM dentro do estado de São Paulo, onde a WEEK começa. Falta aplicar a taxa de captura.' },
      b2b: { tam: 'Todos os kits que academias e quartos de hotel do Sudeste usariam em um ano, a ' + F.brl(i.preco) + ' por kit.', sam: 'Só academias premium e hotéis (com flats e resorts) do estado de São Paulo.', som: 'Os estabelecimentos do SAM em Campinas, ponto de partida do B2B. Falta aplicar a taxa de captura.' }
    }[m][l];
    var calc;
    if (l === 'tam') calc = mm.segments.map(function (s) { return esc(s.name) + ' <b>' + mi(r.levels.tam.segments[s.id].valor) + '</b>'; }).join(' + ') + ' = <b>' + mi(v) + '</b>';
    else if (m === 'b2c') calc = l === 'sam' ? 'TAM <b>' + mi(tam) + '</b> × ' + pct(r.factorSummary.sam) + ' = <b>' + mi(v) + '</b>' : 'SAM <b>' + mi(r.levels.sam.total.valor) + '</b> × ' + pct(i.pesoSP) + ' = <b>' + mi(v) + '</b>';
    else calc = l === 'sam' ? 'Academias <b>' + mi(r.levels.tam.segments.academias.valor) + '</b> × ' + pct(r.factors.sam.academias) + ' + hotéis <b>' + mi(r.levels.tam.segments.hoteis.valor) + '</b> × ' + pct(r.factors.sam.hoteis) + ' = <b>' + mi(v) + '</b>' : 'Academias <b>' + mi(r.levels.sam.segments.academias.valor) + '</b> × ' + pct(i.fatorCampinasAcademias) + ' + hotéis <b>' + mi(r.levels.sam.segments.hoteis.valor) + '</b> × ' + pct(i.fatorCampinasHoteis) + ' = <b>' + mi(v) + '</b>';
    var stats = '<div><dt>% do TAM</dt><dd>' + (idx ? share(v / tam) : '100%') + '</dd></div>';
    if (prev) { var pv = r.levels[prev].total.valor; stats += '<div><dt>Saiu do ' + NAME[prev] + '</dt><dd>' + signed((v - pv) / pv) + '</dd></div>'; }
    else stats += '<div><dt>Recorte</dt><dd>' + esc(mm.levels.tam.geo) + '</dd></div>';
    stats += '<div><dt>' + (m === 'b2c' ? 'Lavagens' : 'Kits') + '/ano</dt><dd>' + qty(r.levels[l].total.volume) + '</dd></div>';
    stats += r.levels[l].total.estabelecimentos !== undefined ? '<div><dt>Estabelecimentos</dt><dd>' + nf(0).format(Math.round(r.levels[l].total.estabelecimentos)) + '</dd></div>' : '<div><dt>Pessoas/viagens</dt><dd>' + qty(r.levels[l].total.pessoas) + '</dd></div>';
    $('detail').innerHTML = '<p class="d-kicker"><span class="lvl lvl-' + l + '">' + NAME[l] + '</span>' + PLAIN[l] + ' · ' + esc(mm.levels[l].geo) + '</p>' +
      '<p class="d-val">' + mi(v) + '<small> por ano</small></p><p class="d-text">' + DEF[l] + '</p><p class="d-week"><b>Na WEEK:</b> ' + esc(week) + '</p>' +
      '<dl class="d-stats">' + stats + '</dl><p class="d-calc">' + calc + '</p>' +
      '<div class="d-nav">' + LEVELS.map(function (x) { return '<button type="button" class="chip-btn' + (x === l ? ' primary' : '') + '" data-level="' + x + '" aria-pressed="' + (x === l) + '">' + NAME[x] + '</button>'; }).join('') +
      (next ? '<button type="button" class="chip-btn" data-level="' + next + '">Próximo ' + icon('arrow') + '</button>' : '<a class="chip-btn" href="#simule">Simular ' + icon('arrow') + '</a>') + '</div>';
  }
  function renderCircles() {
    var m = state.model, mm = M(), r = res(m), tam = r.levels.tam.total.valor;
    var narrow = ($('circles').clientWidth || 600) < 460;
    var W = narrow ? 400 : 560, H = 340, bottom = 326, R = narrow ? 128 : 160, cx = narrow ? 134 : 180, lx = narrow ? 282 : 390;
    var it = LEVELS.map(function (l) { var v = r.levels[l].total.valor, rad = Math.max(4, R * Math.sqrt(v / tam)); return { l: l, v: v, r: rad, cy: bottom - rad }; });
    var ly = [it[0].cy - it[0].r + 36, it[1].cy, it[2].cy];
    for (var k = 1; k < 3; k++) if (ly[k] - ly[k - 1] < 80) ly[k] = ly[k - 1] + 80;
    var over = ly[2] + 30 - H; if (over > 0) ly = ly.map(function (y) { return y - over; });
    var svg = it.map(function (o, k) {
      var ex = cx + o.r * 0.92, ey = k === 0 ? o.cy - o.r * 0.39 : o.cy;
      return '<g class="c-item c-' + o.l + (state.sel === o.l ? ' on' : '') + '" data-level="' + o.l + '" tabindex="0" role="button" aria-label="' + NAME[o.l] + ' ' + esc(mm.levels[o.l].geo) + ': ' + mi(o.v) + '">' +
        '<circle class="c" cx="' + cx + '" cy="' + o.cy.toFixed(1) + '" r="' + o.r.toFixed(1) + '"/><polyline class="c-lead" points="' + ex.toFixed(1) + ',' + ey.toFixed(1) + ' ' + (lx - 10) + ',' + ly[k].toFixed(1) + '"/>' +
        '<text class="c-t1" x="' + lx + '" y="' + (ly[k] - 14).toFixed(1) + '">' + NAME[o.l] + ' · ' + esc(mm.levels[o.l].geo) + '</text><text class="c-t2" x="' + lx + '" y="' + (ly[k] + 9).toFixed(1) + '">' + mi(o.v) + '</text>' +
        '<text class="c-t3" x="' + lx + '" y="' + (ly[k] + 28).toFixed(1) + '">' + (k ? share(o.v / tam) + ' do TAM' : 'universo total') + '</text></g>';
    }).join('');
    $('circles').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Círculos proporcionais de TAM, SAM e SOM">' + svg + '</svg>';
    $('circles-note').textContent = 'A área de cada círculo é proporcional ao valor: o SOM ocupa ' + share(it[2].v / tam) + ' da área do TAM.';
  }
  function setView(v) {
    state.view = v;
    [['funnel', 'tab-funnel', 'pane-funnel'], ['circles', 'tab-circles', 'pane-circles']].forEach(function (t) {
      var on = t[0] === v; $(t[1]).setAttribute('aria-selected', on); $(t[1]).tabIndex = on ? 0 : -1; $(t[2]).hidden = !on;
    });
    if (v === 'circles') renderCircles();
  }

  /* ================================================================ */
  /* Simulador                                                         */
  /* ================================================================ */
  var simModel = null;
  function buildSim() {
    var m = state.model; simModel = m;
    $('sim-controls').innerHTML = SIM_KEYS[m].map(function (k) {
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
      var wv = Math.sqrt(v / max) * 100, wb = Math.sqrt(bv / max) * 100;   // escala raiz: o SOM continua visível ao lado do TAM
      return '<div class="sim-row"><span class="lvl lvl-' + l + '">' + NAME[l] + '</span><span class="sim-bar"><i class="base" style="width:' + wb.toFixed(1) + '%"></i><i style="width:' + wv.toFixed(1) + '%;background:' + LEVEL_COLOR[l] + ';opacity:.9"></i></span><span class="v">' + mi(v) + '<small class="delta ' + deltaCls(d) + '">' + signed(d) + '</small></span></div>';
    }).join('');
    var last = state.last[m], txt = '';
    if (mod && last && ch.indexOf(last.key) >= 0) {
      var s = C.getSpec(m, last.key), a = D.ASSUMPTIONS.filter(function (x) { return x.model === m && x.key === last.key; })[0];
      var lvl = a ? a.level : 'TAM', aff = lvl === 'TAM' ? 'o TAM, o SAM e o SOM' : lvl === 'SAM' ? 'o SAM e o SOM' : 'só o SOM';
      txt = '<p class="changed-txt"><b>O que mudou:</b> ' + esc(s.label.toLowerCase()) + ' foi de ' + fmtIn(m, last.key, D.BASE_INPUTS[m][last.key]) + ' para ' + fmtIn(m, last.key, state.inputs[m][last.key]) + '. Essa premissa entra no ' + lvl + ', então muda ' + aff + '.</p>';
    }
    $('sim-out').innerHTML = '<span class="badge' + (mod ? ' sim' : '') + '">' + (mod ? 'Cenário simulado · ' + ch.length + (ch.length > 1 ? ' premissas alteradas' : ' premissa alterada') : 'Valores do estudo') + '</span>' +
      '<div class="big-som"><span>SOM · ' + esc(mm.levels.som.geo) + '</span><b>' + mi(som) + '</b><span class="delta ' + deltaCls(som - bs) + '">' + (mod ? signed((som - bs) / bs) + ' vs. estudo (' + mi(bs) + ')' : 'mercado de entrada por ano') + '</span></div>' +
      '<div class="sim-rows">' + rows + '</div>' + txt +
      '<p class="fine">Barra cinza: valor do estudo. Barra colorida: cenário atual. O SOM continua sem taxa de captura.</p>' +
      '<button type="button" class="chip-btn" data-reset' + (mod ? '' : ' disabled') + '>' + icon('reset') + 'Voltar aos valores do estudo</button>';
  }

  /* ================================================================ */
  /* Comparação                                                        */
  /* ================================================================ */
  function renderCompare() {
    var rc = res('b2c'), rb = res('b2b'), max = Math.max(rc.levels.tam.total.valor, rb.levels.tam.total.valor);
    function col(m, r) {
      var mm = D.MODELS[m];
      return '<div class="cmp-col"><h3><span class="pill ' + m + '">' + mm.name + '</span>' + esc(mm.title) + '</h3>' + LEVELS.map(function (l) {
        var v = r.levels[l].total.valor;
        return '<div class="cmp-row"><span class="lbl"><span class="lvl lvl-' + l + '">' + NAME[l] + '</span>' + esc(mm.levels[l].geo) + '</span><span class="cmp-track"><i style="width:' + Math.max(0.6, v / max * 100).toFixed(2) + '%;background:' + (m === 'b2c' ? 'var(--l-tam)' : 'var(--teal)') + '"></i></span><b>' + mi(v) + '</b></div>';
      }).join('') + '<p class="fine">SOM = ' + share(r.levels.som.total.valor / r.levels.tam.total.valor) + ' do TAM.</p></div>';
    }
    $('compare').innerHTML = '<div class="cmp">' + col('b2c', rc) + col('b2b', rb) + '</div>' +
      '<p class="cmp-warn">' + icon('alert') + '<span><b>Um TAM maior não torna um modelo melhor.</b> O B2C parte do Brasil inteiro e o B2B só do Sudeste; preços e compradores são outros, e parte do público aparece nos dois. Compare também o SAM, o SOM e o custo de atender cada canal.</span></p>';
    var diffs = [
      ['Onde está o TAM', 'Brasil', 'Sudeste'],
      ['Quem compra', 'Consumidor final, pelo site', 'Academia ou hotel'],
      ['Preço por kit', F.brl(rc.inputs.preco), F.brl(rb.inputs.preco)],
      ['O que filtra o SAM', 'Sudeste × A e B × online (' + pct(rc.factorSummary.sam) + ')', 'SP × premium (' + pct(rb.factors.sam.academias) + ') e hotéis (' + pct(rb.factors.sam.hoteis) + ')'],
      ['Mercado de entrada', 'Estado de SP · ' + mi(rc.levels.som.total.valor), 'Campinas · ' + mi(rb.levels.som.total.valor)]
    ];
    $('diffs').innerHTML = diffs.map(function (d) {
      return '<article class="diff"><h4>' + esc(d[0]) + '</h4><p><span class="pill b2c">B2C</span><span>' + esc(d[1]) + '</span></p><p><span class="pill b2b">B2B</span><span>' + esc(d[2]) + '</span></p></article>';
    }).join('');
  }

  /* ================================================================ */
  /* Market share                                                      */
  /* ================================================================ */
  var MS_COLOR = { unilever: 'var(--l-tam)', loreal: 'var(--teal)', pg: 'var(--amber)', demais: 'var(--neutral)' };
  var marketStatic = false;
  function renderMarket() {
    var ms = D.MARKET_SHARE, base = C.marketShare(), calc = C.marketShare(res('b2c').levels.tam.total.valor);
    if (!marketStatic) {
      marketStatic = true;
      $('ms-share').innerHTML = '<div class="ms-layout"><div><div class="ms-bar" role="img" aria-label="' + esc(ms.companies.map(function (c) { return c.name + ' ' + pct(c.share); }).join(', ')) + '">' +
        ms.companies.map(function (c) { return '<i style="flex-basis:' + (c.share * 100) + '%;background:' + MS_COLOR[c.id] + '">' + (c.share > 0.08 ? pct(c.share) : '') + '</i>'; }).join('') + '</div>' +
        '<ul class="ms-list">' + ms.companies.map(function (c) { return '<li><span class="sw" style="background:' + MS_COLOR[c.id] + '"></span><span><b>' + esc(c.name) + '</b><small>' + esc(c.brands) + '</small></span><span class="ms-pct">' + pct(c.share) + '</span></li>'; }).join('') + '</ul></div>' +
        '<div class="ms-big"><b>' + pct(base.top3) + '</b><span>do shampoo nas mãos das 3 maiores empresas · concentração do setor <strong>' + esc(ms.reference.concentration.toLowerCase()) + '</strong> (Mordor, 2026)</span>' +
        '<p class="warn-inline">Participação por empresa publicada pela Euromonitor em 2014, o dado público mais recente. Desde então o Elseve passou a 1ª marca de cabelos do Brasil (2025).</p></div></div>';
      var trend = function (t, v, vol, src) {
        var mx = 7;
        return '<article class="trend"><h4>' + t + '</h4>' +
          '<div class="dv"><span>Valor</span><span class="neg"></span><span class="pos"><i style="width:' + (v / mx * 100) + '%"></i></span><b class="delta up">+' + nf(1, 1).format(v) + '%</b></div>' +
          '<div class="dv"><span>Volume</span><span class="neg"><i style="width:' + (Math.abs(vol) / mx * 100) + '%"></i></span><span class="pos"></span><b class="delta down">−' + nf(1, 1).format(Math.abs(vol)) + '%</b></div>' +
          '<p class="fine">' + src + '</p></article>';
      };
      $('ms-trend').innerHTML = '<div class="trend-grid">' + trend('Shampoo em 2025', 3.6, -2.3, 'NielsenIQ via ABAD. O consumidor compra menos unidades, mas paga mais por produto.') +
        trend('Condicionador em 2025', 6, -1, 'NielsenIQ via ABAD. Mesma tendência: troca de volume por valor, o que favorece uma proposta premium.') + '</div>' +
        '<div class="fact-row"><article class="fact"><span>Marca líder em cabelos (2025)</span><b>Elseve (L’Oréal)</b><p>Passou de 3ª para 1ª marca e dobrou a participação em cinco anos, segundo a própria L’Oréal.</p></article>' +
        '<article class="fact"><span>Concorrentes diretos</span><b>Sem dado público</b><p>We Green e Naturys Eco vendem sachês para hotéis e não divulgam faturamento.</p></article></div>';
      $('ms-reading').innerHTML = '<b>Leitura para a WEEK:</b> o mercado de cabelos é grande e dominado por três empresas de massa, que vendem para o banho em casa. O banho fora de casa equivale a cerca de 1/15 do setor e hoje é atendido por produtos comuns, amenities de hotel e sachês genéricos. A WEEK não disputa preço nem distribuição com as líderes: ela entra num nicho que nenhuma delas atende com produto premium.';
      var lastG = '';
      $('ms-assump').innerHTML = ms.assumptions.map(function (a) {
        var head = a.group !== lastG ? '<p class="a-group">' + esc(a.group) + '</p>' : ''; lastG = a.group;
        return head + '<div class="a-row"><h4>' + esc(a.name) + '</h4><span class="a-val">' + esc(a.value) + '</span><p>' + esc(a.logic) + '</p><div class="a-meta">' + conf(a.confidence, D.CONFIDENCE_MARKET[a.confidence]) + '<span>Fonte: ' + srcList(a.sources) + '</span><span>' + esc(a.validation) + '</span></div></div>';
      }).join('');
    }
    var sim = Math.abs(calc.tamB2C - base.tamB2C) > 1, p = calc.nicheShare * 100, cells = '';
    for (var k = 0; k < 100; k++) cells += k < Math.floor(p) ? '<i class="on"></i>' : k < Math.ceil(p) ? '<i class="part" style="--p:' + ((p % 1) * 100).toFixed(0) + '%"></i>' : '<i></i>';
    $('ms-niche').innerHTML = '<div class="ms-layout"><div class="niche"><div class="niche-row"><span>Mercado de cabelos · Brasil, 2023</span><b>R$ ' + nf(1, 1).format(D.MARKET_SHARE.hairMarket.value / 1e9) + ' bi</b></div><div class="niche-track"><i style="width:100%"></i></div>' +
      '<div class="niche-row"><span>TAM B2C da WEEK · banho fora de casa' + (sim ? ' (simulado)' : '') + '</span><b>' + mi(calc.tamB2C) + '</b></div><div class="niche-track"><i class="tam" style="width:' + Math.max(0.8, Math.min(100, p)).toFixed(2) + '%"></i></div>' +
      '<p class="fine">Ordem de grandeza: o TAM é um potencial teórico a R$ 3,50 por lavagem (só shampoo e condicionador); o mercado de cabelos são vendas efetivas e inclui tintura, tratamento e finalizadores. O PDF arredonda para 6,6% (1,85 ÷ 28,2).</p></div>' +
      '<div class="ms-big" style="background:var(--week-soft)"><b style="color:var(--week)">' + nf(1, 1).format(p) + '%</b><span>do mercado de cabelos, cerca de 1 em cada ' + nf(0).format(Math.round(calc.oneIn)) + ' reais do setor</span><div class="waffle" role="img" aria-label="' + nf(1, 1).format(p) + ' de cada 100 quadrados">' + cells + '</div></div></div>';
  }
  function setMs(v) {
    state.ms = v;
    ['share', 'niche', 'trend'].forEach(function (k) { var on = k === v, t = $('tab-ms-' + k); t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; $('ms-pane-' + k).hidden = !on; });
  }

  /* ================================================================ */
  /* CAGR                                                              */
  /* ================================================================ */
  var LAYERS = [
    { id: 'Setor', label: 'Setor (cabelos)', color: 'var(--neutral)' },
    { id: 'Público', label: 'Público (academias)', color: 'var(--l-tam)' },
    { id: 'Canal', label: 'Canal (e-commerce)', color: 'var(--teal)' },
    { id: 'B2B', label: 'B2B (amenities)', color: 'var(--amber)' }
  ];
  function layerColor(id) { return LAYERS.filter(function (x) { return x.id === id; })[0].color; }
  function fmtV(row, v) {
    if (row.unit === '%') return nf(1, 1).format(v * 100) + '%';
    if (row.unit === 'R$' && v < 1e4) return F.brl(v);
    if (row.unit === 'R$' || row.unit === 'US$') return row.unit + ' ' + nf(2).format(v / 1e9) + ' bi';
    return v >= 1e6 ? nf(2).format(v / 1e6) + ' mi' : nf(0).format(v);
  }
  var cagrRows = null;
  function renderCagr() {
    cagrRows = cagrRows || C.cagrRows();
    var f = state.cagrLayer;
    $('cagr-tiles').className = 'cagr-tiles' + (f ? ' filtered' : '');
    $('cagr-tiles').innerHTML = D.CAGR.summary.map(function (t, k) {
      var L = LAYERS[k];
      return '<button type="button" class="cagr-tile" data-layer="' + L.id + '" aria-pressed="' + (f === L.id) + '" style="--c:' + L.color + '"><span>' + esc(t.label) + '</span><b>' + esc(t.value) + '</b></button>';
    }).join('');
    var rows = cagrRows.filter(function (x) { return !f || (x.row.layer || 'Setor') === f; });
    var max = Math.max.apply(null, cagrRows.map(function (x) { return x.rate; }));
    rows.sort(function (a, b) { return b.rate - a.rate; });
    $('cagr-title').textContent = 'Crescimento médio por ano, ' + (f ? 'camada ' + LAYERS.filter(function (x) { return x.id === f; })[0].label.toLowerCase() : 'todas as séries');
    $('cagr-all').hidden = !f;
    $('cagr-bars').innerHTML = rows.map(function (x) {
      var row = x.row, layer = row.layer || 'Setor', one = x.years === 1;
      return '<li><span class="cb-name"><b>' + esc(row.name) + '</b><small>' + row.yi + '–' + row.yf + ' · ' + esc(layer) + (row.unit === 'US$' ? ' · em dólar' : row.unit === 'R$' && row.vi > 1e4 ? ' · em reais' : '') + '</small></span>' +
        '<span class="cb-track"><i style="width:' + (x.rate / max * 100).toFixed(1) + '%;background:' + layerColor(layer) + '"></i></span>' +
        '<span class="cb-val"><b>' + nf(1, 1).format(x.rate * 100) + '%</b><small>' + (one ? 'em 1 ano' : 'ao ano') + '</small></span></li>';
    }).join('');
  }
  function renderCagrStatic() {
    cagrRows = cagrRows || C.cagrRows();
    $('cagr-reading').innerHTML = '<b>Leitura para a WEEK:</b> ' + esc(D.CAGR.reading);
    $('cagr-assump').innerHTML = cagrRows.map(function (x) {
      var row = x.row;
      return '<div class="a-row"><h4>' + esc(row.name) + '</h4><span class="a-val">' + fmtV(row, row.vi) + ' → ' + fmtV(row, row.vf) + '</span><p>' + esc(row.note) + ' CAGR = (' + fmtV(row, row.vf) + ' ÷ ' + fmtV(row, row.vi) + ')<sup>1/' + x.years + '</sup> − 1 = <b>' + nf(1, 1).format(x.rate * 100) + '%</b>.</p>' +
        '<div class="a-meta">' + conf(row.confidence, D.CONFIDENCE_MARKET[row.confidence]) + '<span>Fonte: ' + srcList(row.sources) + '</span><span>' + esc(row.validation) + '</span></div></div>';
    }).join('');
  }
  function parseBR(s) {
    var t = String(s || '').trim().replace(/\s|R\$/g, ''); if (!t) return NaN;
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.'); else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    return /^-?\d*\.?\d+$/.test(t) ? parseFloat(t) : NaN;
  }
  function renderCagrCalc() {
    var f = $('cagr-form'), out = $('cagr-out');
    var vi = parseBR(f.vi.value), vf = parseBR(f.vf.value), n = parseBR(f.n.value);
    if ([vi, vf, n].some(isNaN)) { out.textContent = 'Preencha os três campos com números (ex.: 150.000).'; return; }
    var r = C.cagr(vi, vf, n);
    if (!r.ok) { out.textContent = r.error; return; }
    out.innerHTML = 'Crescimento médio de <b>' + (r.rate < 0 ? '−' : '') + nf(2, 2).format(Math.abs(r.rate) * 100) + '% ao ano</b>. Os valores iniciais são os do mercado de cabelos (Euromonitor, R$ bi de 2023 a 2028); troque pelos que quiser testar.';
  }

  /* ================================================================ */
  /* Premissas: matriz confiança × impacto                             */
  /* ================================================================ */
  var sens = {};
  function impactOf(a) { if (!a.key) return null; var k = a.model + a.key; if (!(k in sens)) sens[k] = C.sensitivity(a.model, a.key, 0.1); return sens[k] ? Math.abs(sens[k].som) : null; }
  var SHORT = {
    'b2c-alunos': 'Alunos de academia', 'b2c-banho-acad': '% banho na academia', 'b2c-freq': 'Banhos por ano', 'b2c-clt': 'Trabalhadores CLT', 'b2c-banho-trab': '% banho no trabalho',
    'b2c-viagens': 'Viagens com pernoite', 'b2c-banho-viagem': 'Banhos por viagem', 'b2c-preco': 'Preço do kit', 'b2c-sudeste': 'Peso do Sudeste', 'b2c-ab': 'Classes A e B', 'b2c-online': 'Compra online', 'b2c-sp': 'Peso de SP',
    'b2b-academias': 'Academias no Sudeste', 'b2b-alunos': 'Alunos por academia', 'b2b-banho': '% banho na academia', 'b2b-freq': 'Banhos por ano', 'b2b-quartos': 'Quartos no Sudeste', 'b2b-ocupacao': 'Ocupação',
    'b2b-kits': 'Kits por quarto', 'b2b-preco': 'Preço B2B', 'b2b-sp-acad': 'SP nas academias', 'b2b-premium': 'Academias premium', 'b2b-sp-quartos': 'SP nos quartos', 'b2b-hoteis': 'Quartos de hotéis',
    'b2b-camp-acad': 'Campinas (academias)', 'b2b-camp-hot': 'Campinas (hotéis)'
  };
  function isPrio(a, imp) { return confOf(a.confidence).score <= 2 && imp >= 0.03; }
  function renderMatrix() {
    var m = state.model;
    var list = D.ASSUMPTIONS.filter(function (a) { return a.model === m; }).map(function (a) { return { a: a, imp: impactOf(a) || 0, sc: confOf(a.confidence).score }; });
    if (!state.pick[m]) {
      var pr = list.filter(function (x) { return isPrio(x.a, x.imp); }).sort(function (x, y) { return y.imp - x.imp || x.sc - y.sc; })[0];
      state.pick[m] = (pr || list[0]).a.id;
    }
    var narrow = ($('matrix').clientWidth || 640) < 520;
    var W = narrow ? 380 : 640, H = narrow ? 440 : 380, pl = narrow ? 64 : 64, pr2 = narrow ? 10 : 20, pt = 20, pb = 58, iw = W - pl - pr2, ih = H - pt - pb, ymax = 0.12;
    function X(sc) { return pl + (sc - 0.5) / 5 * iw; }
    function Y(v) { return pt + ih - Math.min(v, ymax) / ymax * ih; }
    var g = '<rect class="mx-zone" x="' + pl + '" y="' + pt + '" width="' + (X(2.5) - pl) + '" height="' + (Y(0.03) - pt) + '" rx="8"/>' +
      '<text class="mx-zone-t" x="' + (pl + 10) + '" y="' + (pt + 20) + '">VALIDAR PRIMEIRO</text>';
    [0, 0.025, 0.05, 0.075, 0.1].forEach(function (v) { g += '<line class="mx-grid" x1="' + pl + '" x2="' + (W - pr2) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="mx-ax" x="' + (pl - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + nf(1).format(v * 100) + '%</text>'; });
    var SHORTC = { 'Baixa': 'Baixa', 'Baixa-média': 'B-méd.', 'Média': 'Média', 'Média-alta': 'M-alta', 'Alta': 'Alta' };
    D.CONFIDENCE.slice().reverse().forEach(function (c) { g += '<text class="mx-ax" x="' + X(c.score) + '" y="' + (H - pb + 20) + '" text-anchor="middle">' + (narrow ? SHORTC[c.label] : c.label) + '</text>'; });
    g += '<text class="mx-axt" x="' + (pl + iw / 2) + '" y="' + (H - 10) + '" text-anchor="middle">Confiança no dado →</text>' +
      '<text class="mx-axt" transform="translate(14 ' + (pt + ih / 2) + ') rotate(-90)" text-anchor="middle">Impacto no SOM se variar 10%</text>';
    var groups = {};
    list.forEach(function (x) { var k = x.sc + ':' + Math.round(x.imp * 200); (groups[k] = groups[k] || []).push(x); });
    var nLbl = 0;
    Object.keys(groups).forEach(function (k) {
      var arr = groups[k];
      arr.forEach(function (x, j) {
        var dx = (j - (arr.length - 1) / 2) * (narrow ? 15 : 22), cx = X(x.sc) + dx, cy = Y(x.imp), prio = isPrio(x.a, x.imp), on = state.pick[m] === x.a.id;
        var lbl = narrow ? on : (prio || on);
        g += '<g class="mx-pt ' + (prio ? 'prio' : 'ok') + (on ? ' on' : '') + '" data-pick="' + x.a.id + '" tabindex="0" role="button" aria-pressed="' + on + '" aria-label="' + esc(x.a.name + ': confiança ' + confOf(x.a.confidence).label.toLowerCase() + ', SOM muda ' + nf(1, 1).format(x.imp * 100) + '% se variar 10%') + '">' +
          '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (on ? 11 : narrow ? 7 : 8) + '"/>' +
          (lbl ? (on ? '<text x="' + (cx + 13).toFixed(1) + '" y="' + (cy + 4).toFixed(1) + '"' + (cx > W - 150 ? ' text-anchor="end" dx="-26"' : '') + '>'
            : '<text x="' + cx.toFixed(1) + '" y="' + (cy + (nLbl++ % 2 ? 26 : -14)).toFixed(1) + '" text-anchor="middle">') + esc(SHORT[x.a.id] || x.a.name) + '</text>' : '') + '</g>';
      });
    });
    $('matrix').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '"' + (narrow ? ' class="compact"' : '') + ' role="group" aria-label="Premissas por confiança e impacto no SOM">' + g + '</svg>';
    renderAssumpDetail();
  }
  function renderAssumpDetail() {
    var m = state.model, a = D.ASSUMPTIONS.filter(function (x) { return x.id === state.pick[m]; })[0];
    if (!a) return;
    var imp = impactOf(a) || 0, prio = isPrio(a, imp), canSim = SIM_KEYS[m].indexOf(a.key) >= 0;
    $('assump-detail').innerHTML = '<p class="d-kicker">' + (prio ? '<span class="badge sim">Validar primeiro</span>' : '<span class="badge">' + esc(D.STATUS[a.status].label) + '</span>') + esc(a.level) + ' · ' + esc(a.segment) + '</p>' +
      '<h3>' + esc(a.name) + '</h3><p class="a-detail-val">' + esc(a.value) + '</p>' + conf(a.confidence) +
      '<p class="impact-big"><b>' + nf(1, 1).format(imp * 100) + '%</b> de mudança no SOM se essa premissa variar 10%</p>' +
      '<p class="d-text">' + esc(a.logic) + '</p>' +
      '<div class="a-detail-meta"><p><b>Como validar:</b> ' + esc(a.validation) + '</p><p><b>Fonte:</b> ' + (a.sourceNote ? esc(a.sourceNote) + ' · ' : '') + srcList(a.sources) + '</p></div>' +
      (canSim ? '<button type="button" class="chip-btn primary" data-sim="' + a.key + '">' + icon('sliders') + 'Simular esta premissa</button>' : '');
  }
  function renderAssumpList() {
    var m = state.model, f = state.conf;
    $('conf-filter').innerHTML = '<button type="button" class="chip-btn" data-conf="" aria-pressed="' + !f + '">Todas</button>' + D.CONFIDENCE.map(function (c) { return '<button type="button" class="chip-btn" data-conf="' + c.id + '" aria-pressed="' + (f === c.id) + '">' + c.label + '</button>'; }).join('');
    var last = '';
    var rows = D.ASSUMPTIONS.filter(function (a) { return a.model === m && (!f || a.confidence === f); });
    $('assump-list').innerHTML = rows.length ? rows.map(function (a) {
      var g = a.level + ' · ' + a.segment, head = g !== last ? '<p class="a-group">' + esc(g) + '</p>' : ''; last = g;
      return head + '<div class="a-row"><h4>' + esc(a.name) + '</h4><span class="a-val">' + esc(a.value) + '</span><p>' + esc(a.logic) + '</p><div class="a-meta">' + conf(a.confidence) + '<span>Fonte: ' + (a.sourceNote ? esc(a.sourceNote) + ' · ' : '') + srcList(a.sources) + '</span><span>' + esc(a.validation) + '</span></div></div>';
    }).join('') : '<p class="fine">Nenhuma premissa com esse nível de confiança no ' + D.MODELS[m].name + '.</p>';
  }

  /* ================================================================ */
  /* Notas                                                             */
  /* ================================================================ */
  function renderNotes() {
    var ids = [['captura', 'pin'], ['sobreposicao', 'users'], ['comprador', 'building'], ['escopos', 'scale'], ['cagr', 'trend'], ['nicho', 'pie'], ['share-antigo', 'info'], ['arredondamento', 'check'], ['proxies', 'filter']];
    $('notes').innerHTML = ids.map(function (p) {
      var n = D.NOTES.filter(function (x) { return x.id === p[0]; })[0];
      return '<article class="note"><span class="n-ic">' + icon(p[1]) + '</span><h3>' + esc(n.title) + '</h3><p>' + esc(n.text) + '</p></article>';
    }).join('');
  }

  /* ================================================================ */
  /* Logo WEEK em 3D (mesma técnica da Matriz CSD)                     */
  /* O vetor oficial é empilhado em camadas finas ao longo do eixo Z:  */
  /* a da frente na cor da marca, as de trás escurecendo até formar a  */
  /* espessura, e um brilho suave por cima. Vetor = nítido em qualquer */
  /* tamanho de tela.                                                  */
  /* ================================================================ */
  var LOGO_LAYERS = 14, LOGO_DEPTH = 0.75;
  function buildLogoLayers(logo) {
    var NS = 'http://www.w3.org/2000/svg', mark = $('week-mark'), vb = mark ? mark.getAttribute('data-viewbox') : '18 10 548 221';
    function layer(cls, z) {
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', vb); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); svg.setAttribute('class', cls);
      var use = document.createElementNS(NS, 'use'); use.setAttribute('href', '#week-mark'); svg.appendChild(use);
      svg.style.transform = 'translateZ(' + z + 'px)';
      return svg;
    }
    logo.textContent = '';
    for (var i = LOGO_LAYERS - 1; i >= 0; i--) logo.appendChild(layer('ly' + i, -i * LOGO_DEPTH));
    logo.appendChild(layer('sheen', 0.4));
  }
  function initLogo3D() {
    var stage = $('stage'), logo = $('logo3d');
    if (!stage || !logo) return;
    buildLogoLayers(logo);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !window.requestAnimationFrame) return;
    var BASE3 = { rx: 6, ry: -16 }, LIMIT_Y = 58, LIMIT_X = 22;
    var rx = BASE3.rx, ry = BASE3.ry, vx = 0, vy = 0, dragging = false, last = null, raf = 0, spin = null, pid = null, ptype = 'mouse';
    function clampSoft(v, base, lim) { var d = v - base; if (Math.abs(d) <= lim) return v; return base + (d < 0 ? -1 : 1) * (lim + (Math.abs(d) - lim) * 0.25); }
    function apply() { logo.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)'; }
    function loop() {
      raf = 0;
      if (dragging) return;
      if (spin) {
        var p = Math.min(1, (Date.now() - spin.t0) / 1200), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        ry = spin.from + 360 * e; rx = spin.rx + (BASE3.rx - spin.rx) * e;
        if (p >= 1) { spin = null; ry = BASE3.ry + (((ry - BASE3.ry) % 360) + 540) % 360 - 180; }
      } else if (Math.abs(vy) > 0.04 || Math.abs(vx) > 0.04) {
        ry = clampSoft(ry + vy, BASE3.ry, LIMIT_Y); rx = clampSoft(rx + vx, BASE3.rx, LIMIT_X); vy *= 0.92; vx *= 0.88;
        if (Math.abs(ry - BASE3.ry) > LIMIT_Y) vy *= 0.6;
      } else {
        ry += (BASE3.ry - ry) * 0.07; rx += (BASE3.rx - rx) * 0.07;
        if (Math.abs(BASE3.ry - ry) < 0.03 && Math.abs(BASE3.rx - rx) < 0.03) { ry = BASE3.ry; rx = BASE3.rx; apply(); return; }
      }
      apply(); raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }
    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button > 0) return;
      dragging = true; spin = null; pid = e.pointerId; ptype = e.pointerType || 'mouse'; last = { x: e.clientX, y: e.clientY }; vx = vy = 0;
      if (ptype === 'mouse') { try { stage.setPointerCapture(e.pointerId); } catch (err) { /* sem suporte */ } }
      stage.classList.add('grabbing');
    });
    stage.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== pid) return;
      var dx = e.clientX - last.x, dy = e.clientY - last.y; last = { x: e.clientX, y: e.clientY };
      vy = dx * 0.45; vx = ptype === 'mouse' ? -dy * 0.25 : 0;   // no toque, o gesto vertical rola a página
      ry = clampSoft(ry + vy, BASE3.ry, LIMIT_Y); rx = clampSoft(rx + vx, BASE3.rx, LIMIT_X); apply();
    });
    function release() { if (!dragging) return; dragging = false; pid = null; stage.classList.remove('grabbing'); kick(); }
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('lostpointercapture', release);
    stage.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') release(); });
    stage.addEventListener('dblclick', function () { spin = { t0: Date.now(), from: ry, rx: rx }; vx = vy = 0; kick(); });
    apply();
  }

  /* ================================================================ */
  /* Orquestração                                                      */
  /* ================================================================ */
  var raf = 0, parts = {};
  var ALL = ['hero', 'bento', 'flow', 'segs', 'funnel', 'sim', 'compare', 'market', 'matrix', 'list'];
  function render(list) {
    (list || ALL).forEach(function (p) { parts[p] = true; });
    if (!raf) raf = requestAnimationFrame(flush);
  }
  function flush() {
    raf = 0; var p = parts; parts = {};
    try {
      if (p.hero) renderHero();
      if (p.bento) renderBento();
      if (p.flow) renderFlow();
      if (p.segs) renderSegs();
      if (p.funnel) { renderFunnel(); renderDetail(); if (state.view === 'circles') renderCircles(); }
      if (p.sim) { if (simModel !== state.model) buildSim(); else syncSim(); renderSimOut(); }
      if (p.compare) renderCompare();
      if (p.market) renderMarket();
      if (p.matrix) renderMatrix();
      if (p.list) renderAssumpList();
    } catch (e) { if (window.console) console.error(e); }
  }
  function setModel(m) {
    if (m === state.model) return;
    state.model = m; segOn = null;
    document.querySelectorAll('[data-model]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-model') === m ? 'true' : 'false'); });
    document.querySelectorAll('[data-model-name]').forEach(function (s) { s.textContent = D.MODELS[m].name; });
    render();
  }
  function goTo(id) {
    var el = $(id); if (!el) return;
    if (raf) { cancelAnimationFrame(raf); flush(); }
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var top = el.getBoundingClientRect().top + window.pageYOffset - $('top').offsetHeight - 10;
    try { window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, top); }
  }
  function toggleMenu(force) {
    var nav = $('top-nav'), btn = $('menu-btn'), open = force === undefined ? !nav.classList.contains('open') : force;
    nav.classList.toggle('open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Fechar menu de seções' : 'Abrir menu de seções');
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : (e.target && e.target.parentNode); if (!t || !t.closest) return;
    var el;
    if ((el = t.closest('#menu-btn'))) { toggleMenu(); return; }
    if ((el = t.closest('a[href^="#"]'))) { var id = el.getAttribute('href').slice(1); if ($(id)) { e.preventDefault(); toggleMenu(false); goTo(id); } return; }
    if (!t.closest('#top-nav')) toggleMenu(false);
    if ((el = t.closest('[data-model]'))) { setModel(el.getAttribute('data-model')); return; }
    if ((el = t.closest('[data-go-level]'))) { state.sel = el.getAttribute('data-go-level'); render(['funnel']); goTo('funil'); return; }
    if ((el = t.closest('[data-go]'))) { goTo(el.getAttribute('data-go')); return; }
    if ((el = t.closest('[data-level]'))) { state.sel = el.getAttribute('data-level'); render(['funnel']); return; }
    if ((el = t.closest('[data-view]'))) { setView(el.getAttribute('data-view')); return; }
    if ((el = t.closest('[data-seg]'))) { focusSeg(el.getAttribute('data-seg')); return; }
    if ((el = t.closest('[data-ms]'))) { setMs(el.getAttribute('data-ms')); return; }
    if ((el = t.closest('[data-layer]'))) { var L = el.getAttribute('data-layer'); state.cagrLayer = state.cagrLayer === L ? null : L; renderCagr(); return; }
    if ((el = t.closest('#cagr-all'))) { state.cagrLayer = null; renderCagr(); return; }
    if ((el = t.closest('[data-pick]'))) { state.pick[state.model] = el.getAttribute('data-pick'); renderMatrix(); return; }
    if ((el = t.closest('[data-conf]'))) { state.conf = el.getAttribute('data-conf') || null; renderAssumpList(); return; }
    if ((el = t.closest('[data-sim]'))) {
      var key = el.getAttribute('data-sim'); goTo('simule');
      setTimeout(function () { var inp = document.querySelector('#sim-controls [data-key="' + key + '"]'); if (inp) { try { inp.focus({ preventScroll: true }); } catch (err) { inp.focus(); } } }, 500);
      return;
    }
    if ((el = t.closest('[data-reset]'))) { var m = state.model; state.inputs[m] = C.baseInputs(m); state.last[m] = null; render(); return; }
  });
  document.addEventListener('keydown', function (e) {
    var g = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && g && g.getAttribute && g.getAttribute('role') === 'button' && /^(g|path)$/i.test(g.tagName)) { e.preventDefault(); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    if (e.key === 'Escape') toggleMenu(false);
    if (g && g.getAttribute && g.getAttribute('role') === 'tab' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      var tabs = Array.prototype.slice.call(g.parentNode.querySelectorAll('[role="tab"]')), k = tabs.indexOf(g);
      var nx = tabs[(k + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; nx.click(); nx.focus(); e.preventDefault();
    }
  });
  var simForm = $('sim-controls');
  simForm.addEventListener('submit', function (e) { e.preventDefault(); });
  simForm.addEventListener('input', function (e) {
    var k = e.target.getAttribute('data-key'); if (!k) return;
    var m = state.model, p = C.parseUserValue(m, k, e.target.value); if (!p.ok) return;
    var next = {}; Object.keys(state.inputs[m]).forEach(function (x) { next[x] = state.inputs[m][x]; }); next[k] = p.value;
    if (C.validateInputs(m, next).length) return;
    state.inputs[m] = next; state.last[m] = { key: k };
    render(['sim']);
    clearTimeout(simForm._t); simForm._t = setTimeout(function () { render(['hero', 'bento', 'flow', 'segs', 'funnel', 'compare', 'market']); }, 180);
  });
  var cf = $('cagr-form');
  cf.addEventListener('input', renderCagrCalc); cf.addEventListener('submit', function (e) { e.preventDefault(); });

  // Dica ao passar o mouse sobre elementos gráficos (o toque abre o detalhe)
  var tip = $('tip');
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest('.f-stage, .c-item, .mx-pt, .arc');
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.getAttribute('aria-label'); tip.hidden = false;
    var r = el.getBoundingClientRect(); tip.style.left = Math.max(8, Math.min(r.left + r.width / 2 - 130, window.innerWidth - 270)) + 'px'; tip.style.top = Math.max(8, r.top - 48) + 'px';
  });

  // Navegação: seção ativa e barra de progresso
  var navLinks = {};
  document.querySelectorAll('#top-nav a').forEach(function (a) { navLinks[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting || !navLinks[en.target.id]) return;
        Object.keys(navLinks).forEach(function (k) { navLinks[k].removeAttribute('aria-current'); });
        navLinks[en.target.id].setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(navLinks).forEach(function (id) { if ($(id)) io.observe($(id)); });
  }
  var progT = 0;
  function progress() { progT = 0; var h = document.documentElement.scrollHeight - window.innerHeight; $('progress').style.width = (h > 0 ? Math.min(100, window.pageYOffset / h * 100) : 0).toFixed(1) + '%'; }
  window.addEventListener('scroll', function () { tip.hidden = true; if (!progT) progT = requestAnimationFrame(progress); }, { passive: true });
  var rz = 0;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (window.innerWidth > 1100) toggleMenu(false); if (state.view === 'circles') renderCircles(); renderMatrix(); }, 150); });

  initLogo3D();
  renderNotes(); renderCagr(); renderCagrStatic(); renderCagrCalc();
  ALL.forEach(function (k) { parts[k] = true; }); flush();
})();
