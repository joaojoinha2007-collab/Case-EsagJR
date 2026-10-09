/*
 * app.js — Camada de interface. Lê dados (WeekData), calcula (WeekCalc),
 * formata (WeekFormat) e desenha (WeekCharts). Nenhuma fórmula de mercado
 * vive aqui: todo número exibido vem de WeekCalc.compute(), filtrado pelos
 * segmentos ativos em view().
 *
 * Arquitetura:
 *   state      → fonte única de verdade (modelo, premissas, filtros, seleção)
 *   view(m)    → resultado do cenário atual restrito aos segmentos ativos
 *   invalidate → agenda a renderização de partes da página em requestAnimationFrame;
 *                partes fora da tela ficam "sujas" e só são desenhadas ao se aproximar
 *   eventos    → um único conjunto de listeners delegados, registrados uma vez
 */
(function () {
  'use strict';

  var D = window.WeekData, C = window.WeekCalc, F = window.WeekFormat, G = window.WeekCharts;
  if (!D || !C || !F || !G) {
    document.body.insertAdjacentHTML('afterbegin', '<div class="noscript">Erro ao carregar os módulos da plataforma.</div>');
    return;
  }
  var esc = G.esc;

  /* ================================================================ */
  /* Constantes                                                        */
  /* ================================================================ */
  var LEVELS = C.LEVELS;
  var LEVEL_NAMES = { tam: 'TAM', sam: 'SAM', som: 'SOM' };
  var LEVEL_LONG = { tam: 'Total Addressable Market', sam: 'Serviceable Available Market', som: 'Serviceable Obtainable Market' };
  var LEVEL_PLAIN = { tam: 'Mercado total', sam: 'Mercado atendível', som: 'Mercado de entrada' };
  var LEVEL_COLOR = { tam: 'var(--l1)', sam: 'var(--l2)', som: 'var(--l3)' };
  var SEG_COLOR = { academia: 'var(--s1)', trabalho: 'var(--s2)', viagem: 'var(--s3)', academias: 'var(--s1)', hoteis: 'var(--s2)' };
  var MODEL_COLOR = { b2c: 'var(--l1)', b2b: 'var(--s2)' };
  var METRICS = {
    valor: { label: 'R$/ano' },
    volume: { label: 'Volume/ano' },
    pessoas: { label: 'Público' },
    estabelecimentos: { label: 'Estabelecimentos', b2bOnly: true }
  };

  /* ================================================================ */
  /* Estado (fonte única)                                              */
  /* ================================================================ */
  function allSegs(m) { return D.MODELS[m].segments.map(function (s) { return s.id; }); }
  var state = {
    model: 'b2c',
    inputs: { b2c: C.baseInputs('b2c'), b2b: C.baseInputs('b2b') },
    segs: { b2c: allSegs('b2c'), b2b: allSegs('b2b') },   // segmentos ativos por modelo
    metric: 'valor',                                       // medida do explorador
    sel: null,                                             // {kind:'level'|'segment', id}
    circMode: 'levels',
    circLevel: 'tam',
    compare: false,
    segLevel: 'tam',
    segMetric: 'valor',
    filterStep: { b2c: 0, b2b: 0 },
    lastChange: null
  };
  var BASE = { b2c: C.compute('b2c'), b2b: C.compute('b2b') };

  /* Cache do cálculo do cenário atual (recalcula só quando as premissas mudam) */
  var calcCache = { b2c: null, b2b: null };
  function full(m) {
    var c = calcCache[m];
    if (c && c.inputs === state.inputs[m]) return c.result;
    var r = C.compute(m, state.inputs[m]);
    if (!r.valid) r = BASE[m];
    calcCache[m] = { inputs: state.inputs[m], result: r };
    return r;
  }

  /* Restringe um resultado aos segmentos ativos: os totais passam a ser a soma dos segmentos escolhidos */
  function restrict(r, m) {
    var act = state.segs[m];
    if (act.length === D.MODELS[m].segments.length) return r;
    var levels = {};
    LEVELS.forEach(function (l) {
      var segs = {}, tot = { pessoas: 0, volume: 0, valor: 0 }, hasE = false;
      act.forEach(function (id) {
        var s = r.levels[l].segments[id];
        segs[id] = s;
        tot.pessoas += s.pessoas; tot.volume += s.volume; tot.valor += s.valor;
        if (s.estabelecimentos !== undefined) { hasE = true; tot.estabelecimentos = (tot.estabelecimentos || 0) + s.estabelecimentos; }
      });
      if (!hasE) delete tot.estabelecimentos;
      levels[l] = { segments: segs, total: tot };
    });
    var fs = r.factorSummary;
    if (m === 'b2b') fs = { sam: levels.tam.total.valor ? levels.sam.total.valor / levels.tam.total.valor : 0, som: levels.sam.total.valor ? levels.som.total.valor / levels.sam.total.valor : 0 };
    return { model: r.model, valid: r.valid, inputs: r.inputs, factors: r.factors, factorSummary: fs, levels: levels, filtered: true };
  }
  function view(m) { return restrict(full(m), m); }
  function baseView(m) { return restrict(BASE[m], m); }
  function isModified(m) { return C.changedInputs(m, state.inputs[m]).length > 0; }
  function isFiltered(m) { return state.segs[m].length !== D.MODELS[m].segments.length; }
  function model() { return D.MODELS[state.model]; }
  function activeSegments(m) { var a = state.segs[m]; return D.MODELS[m].segments.filter(function (s) { return a.indexOf(s.id) >= 0; }); }
  function segVal(lvl, id, metric) { var s = lvl.segments[id]; return s ? (s[metric] || 0) : 0; }

  /* ================================================================ */
  /* Formatação (apenas apresentação)                                  */
  /* ================================================================ */
  var nfCache = {};
  function nf(maxD, minD) {
    var k = (minD || 0) + ':' + maxD;
    if (!nfCache[k]) nfCache[k] = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: minD || 0, maximumFractionDigits: maxD });
    return nfCache[k];
  }
  function safe(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
  function qty(v) {
    v = safe(v);
    var a = Math.abs(v);
    if (a >= 1e9) return nf(2).format(v / 1e9) + ' bi';
    if (a >= 1e6) return nf(a >= 1e8 ? 1 : 2).format(v / 1e6) + ' mi';
    if (a >= 1e4) return nf(a >= 1e5 ? 1 : 2).format(v / 1e3) + ' mil';
    if (a >= 100) return nf(0).format(v);
    return nf(2).format(v);
  }
  function brlMi(v) {
    v = safe(v);
    var a = Math.abs(v) / 1e6;
    var d = a >= 10 ? 1 : 2;
    return (v < 0 ? '−' : '') + 'R$ ' + nf(d, d).format(a) + ' mi';
  }
  function pctS(v) { return nf(2).format(safe(v) * 100) + '%'; }
  function pct1(v) { return nf(1, 1).format(safe(v) * 100) + '%'; }
  function shareText(v) { v = safe(v); return v >= 0.1 ? nf(1).format(v * 100) + '%' : v >= 0.001 ? nf(2).format(v * 100) + '%' : v > 0 ? '< 0,1%' : '0%'; }
  function ratio(a, b) { return b ? a / b : 0; }
  function unitOf(m) { return m === 'b2c' ? 'lavagens' : 'kits'; }
  function peopleUnit(m) { return m === 'b2c' ? 'pessoas/viagens' : 'pessoas atingidas'; }
  function fmtInput(m, key, v) {
    var spec = C.getSpec(m, key);
    if (key === 'preco') return F.brl(v);
    if ((spec && spec.type === 'pct') || /^(pct|peso|fator|ocupacao)/.test(key)) return pctS(v);
    return qty(v);
  }
  function fmtMetric(m, metric, v, segId) {
    if (metric === 'valor') return brlMi(v);
    if (metric === 'volume') return qty(v) + ' ' + unitOf(m);
    if (metric === 'estabelecimentos') return nf(0).format(Math.round(safe(v))) + ' estab.';
    var unit = m === 'b2c' ? (segId === 'viagem' ? 'viagens' : segId ? 'pessoas' : 'pessoas/viagens') : (segId === 'hoteis' ? 'quartos ocupados/noite' : segId ? 'usuários' : 'pessoas');
    return qty(v) + ' ' + unit;
  }
  function deltaText(a, b, metric, m) {
    var d = a - b;
    var abs = metric === 'valor' ? brlMi(Math.abs(d)) : metric === 'estabelecimentos' ? nf(0).format(Math.round(Math.abs(d))) : qty(Math.abs(d));
    return (d < 0 ? '−' : '+') + abs + ' (' + F.signedPct(ratio(d, b)) + ')';
  }
  function icon(id, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }

  function confOf(id) { for (var i = 0; i < D.CONFIDENCE.length; i++) if (D.CONFIDENCE[i].id === id) return D.CONFIDENCE[i]; return null; }
  function confMeter(id) {
    var c = confOf(id); if (!c) return '';
    var cells = '';
    for (var i = 1; i <= 5; i++) cells += '<i class="' + (i <= c.score ? 'on' : '') + '"></i>';
    return '<span class="conf conf-' + c.id + '" title="Confiança: ' + c.label + '"><span class="meter" aria-hidden="true">' + cells + '</span><span class="conf-label">' + c.label + '</span></span>';
  }
  function statusBadge(id) {
    var s = D.STATUS[id];
    var ic = id === 'oficial' ? 'check' : id === 'conferir' ? 'search' : 'alert';
    return '<span class="status status-' + id + '" title="' + esc(s.hint) + '">' + icon(ic, 'ic-sm') + s.label + '</span>';
  }
  function sourceLinks(a) {
    var links = a.sources.map(function (k) {
      var s = D.SOURCES[k];
      if (!s.url) return '<span>' + esc(s.label) + '</span>';
      return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + icon('ext', 'ic-xs') + '<span class="sr-only"> (abre em nova aba)</span></a>';
    }).join('');
    return (a.sourceNote ? '<span class="src-note">' + esc(a.sourceNote) + '</span>' : '') + '<span class="src-links">' + links + '</span>';
  }
  function assumptionsFor(m, opts) {
    opts = opts || {};
    return D.ASSUMPTIONS.filter(function (a) {
      if (a.model !== m) return false;
      if (opts.levels && opts.levels.indexOf(a.level) < 0) return false;
      if (opts.segment && !(a.segment === 'Todos' || a.segment === opts.segment)) return false;
      if (opts.segments && !(a.segment === 'Todos' || opts.segments.indexOf(a.segment) >= 0)) return false;
      return true;
    });
  }
  function segName(m, id) { var s = D.MODELS[m].segments.filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }
  function activeSegNames(m) { return activeSegments(m).map(function (s) { return s.name; }); }

  /* ================================================================ */
  /* Agendamento de renderização                                       */
  /* ================================================================ */
  var PARTS = {
    explorer: { el: 'conceitos', fn: function () { renderExplorer(); } },
    painel: { el: 'painel', fn: function () { renderPainel(); } },
    calc: { el: 'calculo', fn: function () { renderCalc(); } },
    filters: { el: 'filtros', fn: function () { renderFilters(); } },
    sim: { el: 'simulador', fn: function () { renderSimResults(); } }
  };
  var dirty = {}, pending = {}, rafId = 0, nearView = {};
  function invalidate(parts) {
    (parts || Object.keys(PARTS)).forEach(function (p) { pending[p] = true; });
    if (!rafId) rafId = requestAnimationFrame(flush);
  }
  function flush() {
    rafId = 0;
    Object.keys(pending).forEach(function (p) {
      delete pending[p];
      if (nearView[PARTS[p].el] === false) { dirty[p] = true; return; }   // fora da tela: adia
      delete dirty[p];
      try { PARTS[p].fn(); } catch (err) { reportError(err); }
    });
    renderBanner();
  }
  function renderNow(p) { delete dirty[p]; delete pending[p]; try { PARTS[p].fn(); } catch (err) { reportError(err); } }
  function reportError(err) { if (window.console) console.error(err); }

  var fullTimer = 0;
  function invalidateSoon(immediate) {
    invalidate(immediate);
    clearTimeout(fullTimer);
    fullTimer = setTimeout(function () { invalidate(); }, 220);
  }

  /* ================================================================ */
  /* 1. Visão executiva (valores publicados no PDF — fixos)            */
  /* ================================================================ */
  function refText(v) {
    if (v >= 1e9) return '≈ R$ ' + nf(1, 1).format(v / 1e9) + ' bilhão';
    return '≈ ' + brlMi(v);
  }
  function renderExec() {
    var html = '';
    ['b2c', 'b2b'].forEach(function (m) {
      var M = D.MODELS[m], R = D.REFERENCE[m], B = BASE[m];
      html += '<article class="exec-card card exec-' + m + '">' +
        '<header><span class="model-pill model-pill-' + m + '">' + M.name + '</span><h3>' + esc(M.title) + '</h3></header>' +
        '<dl class="exec-meta"><div><dt>Preço de referência</dt><dd>' + esc(M.priceLabel) + '</dd></div>' +
        '<div><dt>Segmentos</dt><dd>' + M.segments.map(function (s) { return esc(s.name); }).join(' · ') + '</dd></div></dl><ul class="exec-levels">';
      LEVELS.forEach(function (l) {
        html += '<li><button type="button" class="exec-level" data-drill="' + m + ':' + l + ':base">' +
          '<span class="lvl lvl-' + l + '">' + LEVEL_NAMES[l] + '</span>' +
          '<span class="exec-geo">' + esc(M.levels[l].geo) + '</span>' +
          '<span class="exec-val">' + refText(R[l].total.valor) + '<small>/ano</small></span>' +
          '<span class="exec-check" title="Recalculado pela plataforma com precisão total">' + icon('check', 'ic-xs') + 'recálculo: ' + brlMi(B.levels[l].total.valor) + '</span></button></li>';
      });
      html += '</ul><button type="button" class="btn btn-sm btn-ghost" data-goto-model="' + m + '" data-goto="conceitos">Explorar o ' + M.name + ' ' + icon('arrow') + '</button></article>';
    });
    document.getElementById('exec-grid').innerHTML = html;
  }

  /* ================================================================ */
  /* 2. Explorador: filtros, funil, círculos, detalhes, comparação     */
  /* ================================================================ */
  var CONCEPT_EXAMPLE = {
    b2c: {
      tam: function (i) { return 'Todas as ocasiões de banho fora de casa no Brasil — na academia, no trabalho e em viagens com pernoite — multiplicadas pelo preço de ' + F.brl(i.preco) + ' por lavagem.'; },
      sam: function () { return 'Desse total, entram só os moradores do Sudeste, das classes A e B (quem paga por um kit premium) e que compram pela internet — o público que o e-commerce da WEEK consegue atender agora.'; },
      som: function () { return 'O recorte do SAM no estado de São Paulo, onde a WEEK começa. A taxa de captura (quanto desse público a WEEK de fato conquista) ainda será aplicada.'; }
    },
    b2b: {
      tam: function (i) { return 'Todos os kits que as academias e os quartos de hospedagem do Sudeste usariam em um ano, ao preço B2B de ' + F.brl(i.preco) + ' por kit.'; },
      sam: function () { return 'Somente academias com perfil premium e hotéis (incluindo flats, hotéis-fazenda e resorts) do estado de São Paulo.'; },
      som: function () { return 'Os estabelecimentos do SAM localizados em Campinas — o ponto de partida comercial do B2B. A taxa de captura ainda será aplicada.'; }
    }
  };
  var LEVEL_DEF = {
    tam: 'Todo o mercado potencial do produto, sem filtros de público ou canal.',
    sam: 'A parte do TAM que a WEEK consegue atender com o seu canal, público e região.',
    som: 'O recorte onde a WEEK começa a vender. Ainda não inclui a fatia que ela vai conquistar (taxa de captura).'
  };

  function metricOk(m, metric) { return !(METRICS[metric].b2bOnly && m !== 'b2b'); }
  function currentMetric() { return metricOk(state.model, state.metric) ? state.metric : 'valor'; }

  /* Etapas do funil (inclui os filtros intermediários do SAM) para a medida escolhida */
  function funnelSteps(m, metric, r) {
    r = r || view(m);
    metric = metric || 'valor';
    var i = r.inputs, L = r.levels;
    var g = function (l) { return safe(L[l].total[metric]); };
    var tam = g('tam'), steps = [];
    function add(o) {
      o.value = safe(o.value);
      o.share = tam ? o.value / tam : 0;
      o.valueText = fmtMetric(m, metric, o.value);
      o.shareText = shareText(o.share) + ' do TAM';
      steps.push(o);
    }
    var M = D.MODELS[m];
    add({ id: 'tam', level: 'tam', major: true, label: 'TAM · ' + M.levels.tam.geo, sub: activeSegNames(m).join(' + '), value: tam });
    if (m === 'b2c') {
      add({ id: 'sudeste', level: 'sam', label: 'Moradores do Sudeste', sub: 'peso populacional', value: tam * i.pesoSudeste, connector: '× ' + pctS(i.pesoSudeste) + ' peso do Sudeste', keys: ['pesoSudeste'] });
      add({ id: 'ab', level: 'sam', label: 'Classes A e B', sub: 'quem paga por premium', value: tam * i.pesoSudeste * i.pctClassesAB, connector: '× ' + pctS(i.pctClassesAB) + ' classes A e B', keys: ['pctClassesAB'] });
      add({ id: 'sam', level: 'sam', major: true, label: 'SAM · ' + M.levels.sam.geo, sub: 'A/B que compram online', value: g('sam'), connector: '× ' + pctS(i.pctOnline) + ' compram online', keys: ['pctOnline'] });
      add({ id: 'som', level: 'som', major: true, label: 'SOM · ' + M.levels.som.geo, sub: 'recorte de entrada', value: g('som'), connector: '× ' + pctS(i.pesoSP) + ' peso de SP no Sudeste', keys: ['pesoSP'] });
    } else {
      var act = state.segs[m];
      var hasA = act.indexOf('academias') >= 0, hasH = act.indexOf('hoteis') >= 0;
      var parts = function (a, h) { return [hasA ? a + ' (academias)' : '', hasH ? h + ' (quartos)' : ''].filter(Boolean).join(' · '); };
      if (metric !== 'estabelecimentos') {
        var sp = segVal(L.tam, 'academias', metric) * i.pesoSPAcademias + segVal(L.tam, 'hoteis', metric) * i.pesoSPQuartos;
        add({ id: 'sp', level: 'sam', label: 'No estado de SP', sub: 'peso geográfico', value: sp, connector: parts('× ' + pctS(i.pesoSPAcademias), '× ' + pctS(i.pesoSPQuartos)), keys: ['pesoSPAcademias', 'pesoSPQuartos'] });
      }
      add({ id: 'sam', level: 'sam', major: true, label: 'SAM · ' + M.levels.sam.geo, sub: 'academias premium + hotéis', value: g('sam'),
        connector: metric === 'estabelecimentos' ? 'SP × perfil (premium / hotéis do Cadastur)' : [hasA ? '× ' + pctS(i.pctPremium) + ' premium' : '', hasH ? '× ' + pctS(i.pctHoteis) + ' quartos de hotéis' : ''].filter(Boolean).join(' · '),
        keys: ['pctPremium', 'pctHoteis'] });
      add({ id: 'som', level: 'som', major: true, label: 'SOM · ' + M.levels.som.geo, sub: 'recorte de entrada', value: g('som'), connector: parts('× ' + pctS(i.fatorCampinasAcademias), '× ' + pctS(i.fatorCampinasHoteis)), keys: ['fatorCampinasAcademias', 'fatorCampinasHoteis'] });
    }
    return steps;
  }

  function renderChips() {
    var m = state.model;
    document.getElementById('seg-chips').innerHTML = D.MODELS[m].segments.map(function (s) {
      var on = state.segs[m].indexOf(s.id) >= 0;
      return '<button type="button" class="chip" data-seg-chip="' + s.id + '" aria-pressed="' + on + '"><i class="dot" style="background:' + SEG_COLOR[s.id] + '"></i>' + esc(s.name) + (on ? icon('check', 'ic-xs') : '') + '</button>';
    }).join('');
    var metric = currentMetric();
    document.getElementById('x-metric').innerHTML = Object.keys(METRICS).filter(function (k) { return metricOk(m, k); }).map(function (k) {
      var label = k === 'volume' ? (m === 'b2c' ? 'Lavagens' : 'Kits') + '/ano' : METRICS[k].label;
      return '<button type="button" data-x-metric="' + k + '" aria-pressed="' + (k === metric) + '">' + label + '</button>';
    }).join('');
    var parts = [];
    if (isFiltered(m)) parts.push('Segmentos: ' + activeSegNames(m).join(', '));
    if (metric !== 'valor') parts.push('Medida: ' + document.querySelector('[data-x-metric="' + metric + '"]').textContent);
    if (state.sel) parts.push('Seleção: ' + (state.sel.kind === 'level' ? LEVEL_NAMES[state.sel.id] : segName(m, state.sel.id)));
    var any = parts.length > 0;
    document.getElementById('x-active').innerHTML = any ? icon('filter', 'ic-sm') + ' <b>Filtros ativos</b> — ' + esc(parts.join(' · ')) : '<span class="muted">Visão completa do ' + model().name + ': todos os segmentos, em R$/ano.</span>';
    document.getElementById('x-clear').hidden = !any;
  }

  function renderFunnelX() {
    var m = state.model, metric = currentMetric();
    var steps = funnelSteps(m, metric);
    var selLevel = state.sel && state.sel.kind === 'level' ? state.sel.id : null;
    var MIN = 2.5;
    var w = steps.map(function (s) { return Math.max(s.value > 0 ? MIN : 0.6, Math.min(100, s.share * 100)); });
    var html = '';
    steps.forEach(function (s, k) {
      if (k > 0) {
        var a = w[k - 1], b = w[k];
        var poly = 'polygon(' + (50 - a / 2) + '% 0,' + (50 + a / 2) + '% 0,' + (50 + b / 2) + '% 100%,' + (50 - b / 2) + '% 100%)';
        var prev = steps[k - 1];
        html += '<div class="xf-flow' + (selLevel && s.level === selLevel ? ' on' : '') + '" aria-hidden="true">' +
          '<span class="xf-filter">' + icon('filter', 'ic-xs') + esc(s.connector || '') + '</span>' +
          '<span class="xf-track"><span class="xf-trap" style="clip-path:' + poly + ';-webkit-clip-path:' + poly + '"></span></span>' +
          '<span class="xf-delta">' + deltaText(s.value, prev.value, metric, m) + '</span></div>';
      }
      var on = selLevel === s.level && (s.major || false);
      var dim = selLevel && s.level !== selLevel;
      html += '<button type="button" class="xf-stage' + (s.major ? ' major lvl-bg-' + s.level : ' minor') + (on ? ' on' : '') + (dim ? ' dim' : '') + '" data-select-level="' + s.level + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc(s.label + ': ' + s.valueText + ', ' + s.shareText + '. Ver detalhes.') + '"' +
        ' data-tip="' + esc(s.label + '\n' + s.valueText + '\n' + s.shareText + (s.connector ? '\nFiltro: ' + s.connector : '')) + '">' +
        '<span class="xf-name">' + (s.major ? '<span class="lvl lvl-' + s.level + '">' + LEVEL_NAMES[s.level] + '</span>' : '') + '<span><b>' + esc(s.major ? s.label.split(' · ')[1] : s.label) + '</b><small>' + esc(s.sub) + '</small></span></span>' +
        '<span class="xf-track"><span class="xf-bar" style="width:' + w[k].toFixed(2) + '%"></span></span>' +
        '<span class="xf-val"><b>' + esc(s.valueText) + '</b><small>' + esc(s.shareText) + '</small></span></button>';
    });
    var tiny = steps.some(function (s) { return s.value > 0 && s.share * 100 < MIN; });
    html += '<p class="fine xf-note">' + icon('info', 'ic-sm') + ' Largura proporcional ao valor' + (tiny ? '; faixas abaixo de ' + nf(1).format(MIN) + '% do TAM ganham largura mínima para continuarem visíveis' : '') + '. Clique em uma faixa para ver os detalhes.</p>';
    document.getElementById('x-funnel').innerHTML = html;
  }

  /* Círculos proporcionais (área ∝ valor) em SVG */
  function svgEl(inner, w, h, label, compact) { return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="group" aria-label="' + esc(label) + '" class="xc-svg' + (compact ? ' compact' : '') + '">' + inner + '</svg>'; }
  function renderCirclesX() {
    var m = state.model, M = model(), metric = currentMetric(), r = view(m);
    document.querySelectorAll('[data-circ-mode]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-circ-mode') === state.circMode ? 'true' : 'false'); });
    var lvlBar = document.getElementById('x-circ-level');
    lvlBar.hidden = state.circMode !== 'segments';
    lvlBar.querySelectorAll('[data-circ-level]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-circ-level') === state.circLevel ? 'true' : 'false'); });
    var el = document.getElementById('x-circles'), note = document.getElementById('x-circles-note');
    var sel = state.sel;

    if (state.circMode === 'levels') {
      var compact = el.clientWidth > 0 && el.clientWidth < 520;
      var W = compact ? 400 : 560, H = 360, bottom = 344, R = compact ? 122 : 166, cx = compact ? 128 : 182, lx = compact ? 262 : 386, gapL = compact ? 82 : 74;
      var tam = safe(r.levels.tam.total[metric]);
      var items = LEVELS.map(function (l) {
        var v = safe(r.levels[l].total[metric]);
        var rad = tam > 0 ? Math.max(v > 0 ? 3 : 0, R * Math.sqrt(v / tam)) : 0;
        return { l: l, v: v, r: rad, cy: bottom - rad };
      });
      // rótulos à direita, sem sobreposição
      var ly = [items[0].cy - items[0].r + 40, items[1].cy, items[2].cy];
      for (var k = 1; k < 3; k++) if (ly[k] - ly[k - 1] < gapL) ly[k] = ly[k - 1] + gapL;
      var overflow = ly[2] + 34 - H; if (overflow > 0) ly = ly.map(function (y) { return y - overflow; });
      var inner = '';
      items.forEach(function (it, k) {
        var on = sel && sel.kind === 'level' && sel.id === it.l;
        var dim = sel && sel.kind === 'level' && sel.id !== it.l;
        var edgeX = cx + it.r * 0.92, edgeY = k === 0 ? it.cy - it.r * 0.39 : it.cy;
        var tipTxt = LEVEL_NAMES[it.l] + ' · ' + M.levels[it.l].geo + '\n' + fmtMetric(m, metric, it.v) + '\n' + shareText(ratio(it.v, tam)) + ' do TAM';
        inner += '<g class="xc-item xc-' + it.l + (on ? ' on' : '') + (dim ? ' dim' : '') + '" data-select-level="' + it.l + '" tabindex="0" role="button" aria-pressed="' + (on ? 'true' : 'false') + '"' +
          ' aria-label="' + esc(LEVEL_NAMES[it.l] + ' ' + M.levels[it.l].geo + ': ' + fmtMetric(m, metric, it.v) + ', ' + shareText(ratio(it.v, tam)) + ' do TAM') + '" data-tip="' + esc(tipTxt) + '">' +
          '<circle cx="' + cx + '" cy="' + it.cy.toFixed(1) + '" r="' + it.r.toFixed(1) + '" class="xc-circle"/>' +
          '<polyline points="' + edgeX.toFixed(1) + ',' + edgeY.toFixed(1) + ' ' + (lx - 12) + ',' + ly[k].toFixed(1) + '" class="xc-leader"/>' +
          '<circle cx="' + edgeX.toFixed(1) + '" cy="' + edgeY.toFixed(1) + '" r="3" class="xc-dot"/>' +
          '<text x="' + lx + '" y="' + (ly[k] - 14).toFixed(1) + '" class="xc-l1">' + LEVEL_NAMES[it.l] + (compact ? '' : ' · ' + esc(M.levels[it.l].geo)) + '</text>' +
          '<text x="' + lx + '" y="' + (ly[k] + 8).toFixed(1) + '" class="xc-l2">' + esc(fmtMetric(m, metric, it.v)) + '</text>' +
          '<text x="' + lx + '" y="' + (ly[k] + 27).toFixed(1) + '" class="xc-l3">' + shareText(ratio(it.v, tam)) + ' do TAM</text></g>';
      });
      el.innerHTML = svgEl(inner, W, H, 'Círculos proporcionais de TAM, SAM e SOM', compact);
      note.innerHTML = 'A <b>área</b> de cada círculo é proporcional ao valor. O SOM equivale a ' + shareText(ratio(items[2].v, tam)) + ' do TAM. Clique em um círculo ou rótulo para ver os detalhes.';
    } else {
      var l = state.circLevel, lvl = r.levels[l], segs = activeSegments(m);
      var vals = segs.map(function (s) { return safe(segVal(lvl, s.id, metric)); });
      var tot = vals.reduce(function (a, b) { return a + b; }, 0);
      var compact2 = el.clientWidth > 0 && el.clientWidth < 520;
      var W2 = compact2 ? 400 : 560, H2 = 330, gap = compact2 ? 18 : 26, maxR = compact2 ? 100 : 118;
      var sq = vals.map(Math.sqrt), vmax = Math.max.apply(null, sq.concat([0]));
      var kk = vmax > 0 ? Math.min(maxR / vmax, (W2 - 40 - gap * (segs.length - 1)) / (2 * sq.reduce(function (a, b) { return a + b; }, 0))) : 0;
      var radii = sq.map(function (x) { return x * kk; });
      var used = radii.reduce(function (a, b) { return a + 2 * b; }, 0) + gap * (segs.length - 1);
      var x = (W2 - used) / 2, base = 236, inner2 = '';
      segs.forEach(function (s, k) {
        var rr = radii[k], cx2 = x + rr;
        x += 2 * rr + gap;
        var on = sel && sel.kind === 'segment' && sel.id === s.id;
        var dim = sel && sel.kind === 'segment' && sel.id !== s.id;
        var tipTxt = s.name + ' · ' + LEVEL_NAMES[l] + '\n' + fmtMetric(m, metric, vals[k], s.id) + '\n' + shareText(ratio(vals[k], tot)) + ' do ' + LEVEL_NAMES[l];
        inner2 += '<g class="xc-item xc-seg' + (on ? ' on' : '') + (dim ? ' dim' : '') + '" data-select-seg="' + s.id + '" tabindex="0" role="button" aria-pressed="' + (on ? 'true' : 'false') + '"' +
          ' aria-label="' + esc(s.name + ' no ' + LEVEL_NAMES[l] + ': ' + fmtMetric(m, metric, vals[k], s.id) + ', ' + shareText(ratio(vals[k], tot))) + '" data-tip="' + esc(tipTxt) + '">' +
          '<circle cx="' + cx2.toFixed(1) + '" cy="' + (base - rr).toFixed(1) + '" r="' + Math.max(rr, 2).toFixed(1) + '" style="fill:' + SEG_COLOR[s.id] + '" class="xc-circle"/>' +
          (rr > 34 ? '<text x="' + cx2.toFixed(1) + '" y="' + (base - rr + 6).toFixed(1) + '" class="xc-in">' + shareText(ratio(vals[k], tot)) + '</text>' : '') +
          '<text x="' + cx2.toFixed(1) + '" y="' + (base + 28) + '" class="xc-l1 mid">' + esc(s.name) + '</text>' +
          '<text x="' + cx2.toFixed(1) + '" y="' + (base + 50) + '" class="xc-l2 mid">' + esc(fmtMetric(m, metric, vals[k], s.id).replace(/ (pessoas|usuários|viagens|quartos ocupados\/noite|lavagens|kits|estab\.)$/, '')) + '</text>' +
          '<text x="' + cx2.toFixed(1) + '" y="' + (base + 70) + '" class="xc-l3 mid">' + shareText(ratio(vals[k], tot)) + ' do ' + LEVEL_NAMES[l] + '</text></g>';
      });
      el.innerHTML = svgEl(inner2, W2, H2, 'Círculos proporcionais por segmento no ' + LEVEL_NAMES[l], compact2);
      note.innerHTML = 'Segmentos do <b>' + LEVEL_NAMES[l] + ' · ' + esc(M.levels[l].geo) + '</b>, com área proporcional ao valor. ' + (segs.length > 1 ? 'Onde está concentrado o potencial: <b>' + esc(segs[vals.indexOf(Math.max.apply(null, vals))].name) + '</b>.' : '') + ' Clique em um segmento para ver o detalhe.' + (metric === 'pessoas' ? ' Atenção: as unidades de público diferem entre segmentos.' : '');
    }
  }

  function formulaHTML(m, l, r) {
    var i = r.inputs, M = D.MODELS[m];
    if (l === 'tam') return '<p>Para cada segmento: ' + esc(M.formula) + '. Os segmentos são somados.</p>';
    var act = state.segs[m];
    if (m === 'b2c') return l === 'sam'
      ? '<p>SAM = TAM × fator do SAM (' + pctS(i.pesoSudeste) + ' × ' + pctS(i.pctClassesAB) + ' × ' + pctS(i.pctOnline) + ' = ' + pctS(r.factorSummary.sam) + ')</p><p class="fine">' + brlMi(r.levels.tam.total.valor) + ' × ' + pctS(r.factorSummary.sam) + ' = ' + brlMi(r.levels.sam.total.valor) + '</p>'
      : '<p>SOM = SAM × fator do SOM (peso de SP no Sudeste = ' + pctS(i.pesoSP) + ')</p><p class="fine">' + brlMi(r.levels.sam.total.valor) + ' × ' + pctS(i.pesoSP) + ' = ' + brlMi(r.levels.som.total.valor) + ' · taxa de captura ainda não aplicada</p>';
    var terms = [];
    if (l === 'sam') {
      if (act.indexOf('academias') >= 0) terms.push(['TAM academias × (' + pctS(i.pesoSPAcademias) + ' × ' + pctS(i.pctPremium) + ')', brlMi(segVal(r.levels.tam, 'academias', 'valor')) + ' × ' + pctS(r.factors.sam.academias)]);
      if (act.indexOf('hoteis') >= 0) terms.push(['TAM hotéis × (' + pctS(i.pesoSPQuartos) + ' × ' + pctS(i.pctHoteis) + ')', brlMi(segVal(r.levels.tam, 'hoteis', 'valor')) + ' × ' + pctS(r.factors.sam.hoteis)]);
    } else {
      if (act.indexOf('academias') >= 0) terms.push(['SAM academias × ' + pctS(i.fatorCampinasAcademias), brlMi(segVal(r.levels.sam, 'academias', 'valor')) + ' × ' + pctS(i.fatorCampinasAcademias)]);
      if (act.indexOf('hoteis') >= 0) terms.push(['SAM hotéis × ' + pctS(i.fatorCampinasHoteis), brlMi(segVal(r.levels.sam, 'hoteis', 'valor')) + ' × ' + pctS(i.fatorCampinasHoteis)]);
    }
    return '<p>' + LEVEL_NAMES[l] + ' = ' + terms.map(function (t) { return t[0]; }).join(' + ') + '</p><p class="fine">' + terms.map(function (t) { return t[1]; }).join(' + ') + ' = ' + brlMi(r.levels[l].total.valor) + (l === 'som' ? ' · taxa de captura ainda não aplicada' : '') + '</p>';
  }

  function lastChangeHTML(m) {
    var lc = state.lastChange;
    if (!lc || lc.m !== m || !isModified(m)) return '';
    var now = view(m), spec = C.getSpec(m, lc.key);
    var a = D.ASSUMPTIONS.filter(function (x) { return x.model === m && x.key === lc.key; })[0];
    var lvl = a ? a.level : 'TAM';
    var affects = lvl === 'TAM' ? 'TAM, SAM e SOM' : lvl === 'SAM' ? 'SAM e SOM (o TAM não muda)' : 'apenas o SOM';
    var segTxt = !spec || spec.segment === 'todos' ? 'todos os segmentos' : spec.segment.split(',').map(function (s) { return segName(m, s); }).join(' e ');
    var b = lc.before.som, n = now.levels.som.total.valor;
    return '<div class="change-box">' + icon('sliders', 'ic-sm') + '<div><b>O que mudou:</b> ' + esc(spec ? spec.label : lc.key) + ' passou de ' + fmtInput(m, lc.key, lc.from) + ' para ' + fmtInput(m, lc.key, state.inputs[m][lc.key]) + '. ' +
      'Essa premissa entra no cálculo de ' + esc(segTxt) + ' a partir do ' + lvl + ', então afeta ' + affects + '. ' +
      'SOM: ' + brlMi(b) + ' → <b>' + brlMi(n) + '</b> (' + deltaText(n, b, 'valor', m) + ').</div></div>';
  }

  function renderDetail() {
    var m = state.model, M = model(), r = view(m), metric = currentMetric(), sel = state.sel, i = r.inputs;
    var el = document.getElementById('x-detail');
    var html = lastChangeHTML(m);
    var tam = safe(r.levels.tam.total[metric]);

    if (!sel) {
      html += '<p class="xd-kicker">Visão geral · ' + M.name + '</p><h3 class="xd-title">Como o mercado se afunila</h3>' +
        '<p class="xd-text">Clique em uma etapa do funil ou em um círculo. Aqui aparecem o significado do número, a conta e as premissas.</p><ul class="xd-overview">' +
        LEVELS.map(function (l, k) {
          var v = safe(r.levels[l].total[metric]);
          return '<li><button type="button" data-select-level="' + l + '"><span class="lvl lvl-' + l + '">' + LEVEL_NAMES[l] + '</span><span><b>' + LEVEL_PLAIN[l] + '</b><small>' + esc(M.levels[l].geo) + '</small></span><span class="xd-ov-val">' + esc(fmtMetric(m, metric, v)) + '<small>' + (k ? shareText(ratio(v, tam)) + ' do TAM' : 'universo total') + '</small></span>' + icon('arrow', 'ic-sm') + '</button></li>';
        }).join('') + '</ul><p class="fine">' + icon('alert', 'ic-sm') + ' Valores teóricos de mercado: não são previsão de vendas da WEEK.</p>';
      el.innerHTML = html;
      return;
    }

    if (sel.kind === 'level') {
      var l = sel.id, v = safe(r.levels[l].total[metric]);
      var idx = LEVELS.indexOf(l), prevL = LEVELS[idx - 1], nextL = LEVELS[idx + 1];
      var as = assumptionsFor(m, { levels: [l.toUpperCase()], segments: activeSegNames(m) });
      var toVal = assumptionsFor(m, { levels: LEVELS.slice(0, idx + 1).map(function (x) { return x.toUpperCase(); }), segments: activeSegNames(m) }).filter(function (a) { return a.status === 'validar'; });
      var steps = funnelSteps(m, metric, r).filter(function (s) { return s.level === l && s.connector; });
      html += '<p class="xd-kicker"><span class="lvl lvl-' + l + '">' + LEVEL_NAMES[l] + '</span> ' + LEVEL_LONG[l] + '</p>' +
        '<h3 class="xd-title">' + LEVEL_PLAIN[l] + ' · ' + esc(M.levels[l].geo) + '</h3>' +
        '<p class="xd-value">' + esc(fmtMetric(m, metric, v)) + (metric === 'valor' ? '<small>/ano</small>' : '') + '</p>' +
        '<p class="xd-text">' + esc(LEVEL_DEF[l]) + '</p>' +
        '<p class="xd-week"><b>Na WEEK:</b> ' + esc(CONCEPT_EXAMPLE[m][l](i)) + '</p>' +
        '<dl class="xd-stats"><div><dt>% do TAM</dt><dd>' + (idx ? shareText(ratio(v, tam)) : '100%') + '</dd></div>' +
        (prevL ? '<div><dt>vs. ' + LEVEL_NAMES[prevL] + '</dt><dd>' + deltaText(v, safe(r.levels[prevL].total[metric]), metric, m) + '</dd></div>' : '') +
        (nextL ? '<div><dt>Até o ' + LEVEL_NAMES[nextL] + '</dt><dd>' + deltaText(safe(r.levels[nextL].total[metric]), v, metric, m) + '</dd></div>' : '') + '</dl>';
      if (steps.length) html += '<h4 class="xd-h">Filtros aplicados nesta etapa</h4><ul class="xd-filters">' + steps.map(function (s) { return '<li>' + icon('filter', 'ic-xs') + '<span>' + esc(s.connector) + '</span><b>' + esc(s.valueText) + '</b></li>'; }).join('') + '</ul>';
      html += '<h4 class="xd-h">De onde vem o valor</h4><ul class="xd-segs">' + activeSegments(m).map(function (s) {
        var sv = segVal(r.levels[l], s.id, metric), sh = ratio(sv, v);
        return '<li><button type="button" data-select-seg="' + s.id + '"><span class="xd-seg-name"><i class="dot" style="background:' + SEG_COLOR[s.id] + '"></i>' + esc(s.name) + '</span><span class="xd-seg-bar"><i style="width:' + (sh * 100).toFixed(1) + '%;background:' + SEG_COLOR[s.id] + '"></i></span><span class="xd-seg-val">' + esc(fmtMetric(m, metric, sv, s.id)) + '<small>' + pct1(sh) + '</small></span></button></li>';
      }).join('') + '</ul>';
      html += '<h4 class="xd-h">Como foi calculado</h4><div class="xd-formula">' + formulaHTML(m, l, r) + '</div>';
      if (as.length) html += '<h4 class="xd-h">Premissas desta etapa</h4><ul class="xd-assump">' + as.map(function (a) { return '<li><span>' + esc(a.name) + ' <b>' + esc(a.value) + '</b></span>' + confMeter(a.confidence) + '</li>'; }).join('') + '</ul>';
      if (toVal.length) html += '<p class="xd-validate">' + icon('alert', 'ic-sm') + ' <span><b>' + toVal.length + ' premissa' + (toVal.length > 1 ? 's' : '') + ' ainda a validar</b> até esta etapa: ' + esc(toVal.map(function (a) { return a.name; }).join('; ')) + '.</span></p>';
      html += '<div class="xd-actions"><button type="button" class="btn btn-sm btn-ghost" data-x-back>' + icon('layers', 'ic-sm') + ' Visão geral</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-drill="' + m + ':' + l + '">Passo a passo completo</button>' +
        (nextL ? '<button type="button" class="btn btn-sm btn-primary" data-select-level="' + nextL + '">Próxima etapa: ' + LEVEL_NAMES[nextL] + ' ' + icon('arrow', 'ic-sm') + '</button>' : '<button type="button" class="btn btn-sm btn-primary" data-goto="simulador">Alterar premissas ' + icon('arrow', 'ic-sm') + '</button>') + '</div>';
      el.innerHTML = html;
      return;
    }

    // Segmento selecionado
    var sid = sel.id, seg = D.MODELS[m].segments.filter(function (s) { return s.id === sid; })[0];
    var fr = full(m);
    html += '<p class="xd-kicker"><i class="dot" style="background:' + SEG_COLOR[sid] + '"></i> Segmento · ' + M.name + '</p>' +
      '<h3 class="xd-title">' + esc(seg.name) + '</h3><p class="xd-text">' + esc(seg.who) + '. Base de volume: ' + esc(seg.base) + '.</p>' +
      '<ul class="xd-overview">' + LEVELS.map(function (l) {
        var sv = segVal(fr.levels[l], sid, metric), lt = safe(r.levels[l].total[metric]);
        return '<li><button type="button" data-select-level="' + l + '"><span class="lvl lvl-' + l + '">' + LEVEL_NAMES[l] + '</span><span><b>' + esc(M.levels[l].geo) + '</b><small>' + pct1(ratio(sv, lt)) + ' do ' + LEVEL_NAMES[l] + '</small></span><span class="xd-ov-val">' + esc(fmtMetric(m, metric, sv, sid)) + '</span>' + icon('arrow', 'ic-sm') + '</button></li>';
      }).join('') + '</ul>' +
      '<h4 class="xd-h">Conta do TAM do segmento</h4>' + renderChain(m, chainFor(m, sid, fr)) +
      '<h4 class="xd-h">Premissas do segmento</h4><ul class="xd-assump">' + assumptionsFor(m, { segment: seg.name, levels: ['TAM'] }).map(function (a) { return '<li><span>' + esc(a.name) + ' <b>' + esc(a.value) + '</b></span>' + confMeter(a.confidence) + '</li>'; }).join('') + '</ul>' +
      '<div class="xd-actions"><button type="button" class="btn btn-sm btn-ghost" data-x-back>' + icon('layers', 'ic-sm') + ' Visão geral</button>' +
      '<button type="button" class="btn btn-sm btn-primary" data-open-how="' + m + '-' + sid + '">Ver metodologia do segmento ' + icon('arrow', 'ic-sm') + '</button></div>';
    el.innerHTML = html;
  }

  function renderCompareX() {
    var box = document.getElementById('x-compare');
    document.querySelectorAll('[data-compare-toggle]').forEach(function (b) { b.setAttribute('aria-pressed', state.compare ? 'true' : 'false'); b.textContent = state.compare ? 'Fechar comparação' : 'Comparar B2C × B2B'; });
    box.hidden = !state.compare;
    if (!state.compare) return;
    var rc = view('b2c'), rb = view('b2b');
    var max = Math.max(rc.levels.tam.total.valor, rb.levels.tam.total.valor) || 1;
    function col(m, r) {
      var M = D.MODELS[m];
      return '<div class="cmp-col"><h4><span class="model-pill model-pill-' + m + '">' + M.name + '</span> ' + esc(M.title) + (isFiltered(m) ? ' <span class="tag">' + esc(activeSegNames(m).join(' + ')) + '</span>' : '') + (isModified(m) ? ' <span class="tag tag-warn">simulado</span>' : '') + '</h4>' +
        LEVELS.map(function (l) {
          var v = r.levels[l].total.valor;
          return '<div class="cmp-row"><span class="cmp-l"><span class="lvl lvl-' + l + '">' + LEVEL_NAMES[l] + '</span>' + esc(M.levels[l].geo) + '</span><span class="cmp-track"><i style="width:' + Math.max(v > 0 ? 0.6 : 0, v / max * 100).toFixed(2) + '%;background:' + MODEL_COLOR[m] + '"></i></span><b>' + brlMi(v) + '</b></div>';
        }).join('') + '<p class="fine">SOM = ' + shareText(ratio(r.levels.som.total.valor, r.levels.tam.total.valor)) + ' do TAM · ' + qty(r.levels.som.total.volume) + ' ' + unitOf(m) + '/ano no SOM</p></div>';
    }
    var ic = rc.inputs, ib = rb.inputs;
    var rows = [
      ['Pergunta', 'B2C', 'B2B'],
      ['Maior mercado potencial (TAM)?', brlMi(rc.levels.tam.total.valor) + ' · Brasil', brlMi(rb.levels.tam.total.valor) + ' · Sudeste'],
      ['Mercado atendível (SAM)', brlMi(rc.levels.sam.total.valor) + ' · Sudeste A/B online', brlMi(rb.levels.sam.total.valor) + ' · SP premium + hotéis'],
      ['Mercado de entrada (SOM)', brlMi(rc.levels.som.total.valor) + ' · estado de SP', brlMi(rb.levels.som.total.valor) + ' · Campinas'],
      ['Quem compra', 'Consumidor final', 'Academia ou hotel'],
      ['Preço por kit', F.brl(ic.preco), F.brl(ib.preco)],
      ['Filtro do SAM', pctS(rc.factorSummary.sam) + ' (região × renda × online)', 'academias ' + pctS(rb.factors.sam.academias) + ' · hotéis ' + pctS(rb.factors.sam.hoteis)],
      ['Filtro do SOM', pctS(ic.pesoSP) + ' (SP no Sudeste)', pctS(ib.fatorCampinasAcademias) + ' / ' + pctS(ib.fatorCampinasHoteis) + ' (Campinas)']
    ];
    box.innerHTML = '<header class="chart-head"><h3>B2C × B2B lado a lado <span class="unit">R$/ano · mesma escala</span></h3><button type="button" class="icon-btn" data-compare-toggle aria-label="Fechar comparação">' + icon('x') + '</button></header>' +
      '<div class="cmp-grid">' + col('b2c', rc) + col('b2b', rb) + '</div>' +
      '<div class="table-scroll"><table class="cmp-table"><caption class="sr-only">Diferenças entre os modelos</caption><thead><tr>' + rows[0].map(function (h) { return '<th scope="col">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.slice(1).map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="callout callout-warn cmp-warn">' + icon('alert') + '<span><b>Não é uma corrida de TAM.</b> Os modelos usam recortes geográficos, preços e compradores diferentes, e parte do público se sobrepõe (o aluno da academia premium aparece nos dois). Um TAM maior não torna um modelo melhor: compare também o SAM, o SOM, o custo de atender cada canal e as premissas ainda a validar. Os valores não devem ser somados.</span></p>';
  }

  function renderGuide() {
    var cur = state.sel && state.sel.kind === 'level' ? state.sel.id : (state.compare ? 'cmp' : null);
    document.querySelectorAll('[data-guide]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-guide') === cur); });
  }

  function renderExplorer() {
    renderChips(); renderFunnelX(); renderCirclesX(); renderDetail(); renderCompareX(); renderGuide();
    document.querySelectorAll('.def-card').forEach(function (b) {
      var on = state.sel && state.sel.kind === 'level' && state.sel.id === b.getAttribute('data-level');
      b.classList.toggle('active', !!on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* ================================================================ */
  /* 3/4. Painel                                                       */
  /* ================================================================ */
  function renderModelStrip() {
    var m = state.model, M = model();
    document.getElementById('model-strip').innerHTML =
      '<div><span>Quem compra</span><strong>' + esc(M.buyer) + '</strong></div>' +
      '<div><span>Canal</span><strong>' + esc(M.channel) + '</strong></div>' +
      '<div><span>Preço de referência</span><strong>' + esc(M.priceLabel) + '</strong></div>' +
      '<div><span>Segmentos' + (isFiltered(m) ? ' (filtro ativo)' : '') + '</span><strong>' + activeSegments(m).map(function (s) { return '<i class="dot" style="background:' + SEG_COLOR[s.id] + '"></i>' + esc(s.name); }).join(' ') + '</strong></div>' +
      '<div><span>Recortes</span><strong>' + LEVELS.map(function (l) { return LEVEL_NAMES[l] + ' ' + esc(M.levels[l].geo); }).join(' → ') + '</strong></div>' +
      (isFiltered(m) ? '<div class="strip-filter">' + icon('filter', 'ic-sm') + ' Mostrando apenas ' + esc(activeSegNames(m).join(' + ')) + '. <button type="button" class="link-btn" data-clear-segs>Mostrar todos</button></div>' : '');
  }

  function renderKpis() {
    var m = state.model, M = model(), r = view(m), b = baseView(m), mod = isModified(m);
    var html = '';
    LEVELS.forEach(function (l) {
      var t = r.levels[l].total, tb = b.levels[l].total;
      var tipText = LEVEL_NAMES[l] + ' — ' + LEVEL_PLAIN[l].toLowerCase() + '\n' + M.levels[l].filter + '.';
      html += '<button type="button" class="kpi card" data-drill="' + m + ':' + l + '" aria-label="' + LEVEL_NAMES[l] + ' ' + esc(M.levels[l].geo) + ': ' + brlMi(t.valor) + ' por ano. Ver detalhes do cálculo.">' +
        '<span class="kpi-top"><span class="lvl lvl-' + l + '">' + LEVEL_NAMES[l] + '</span><span class="kpi-geo">' + esc(M.levels[l].geo) + '</span>' +
        '<span class="info-btn info-inline" data-tip="' + esc(tipText) + '">' + icon('info') + '</span></span>' +
        '<span class="kpi-val">' + brlMi(t.valor) + '<small>/ano</small></span>' +
        (mod ? '<span class="kpi-base">Base do estudo: ' + brlMi(tb.valor) + ' · <b class="' + (t.valor >= tb.valor ? 'up' : 'down') + '">' + F.signedPct(ratio(t.valor - tb.valor, tb.valor)) + '</b></span>' : '<span class="kpi-base">' + (l === 'tam' ? 'Universo total do modelo' : shareText(ratio(t.valor, r.levels.tam.total.valor)) + ' do TAM') + '</span>') +
        '<span class="kpi-metrics">' +
        '<span>' + icon('box', 'ic-sm') + qty(t.volume) + ' ' + unitOf(m) + '/ano</span>' +
        '<span>' + icon('users', 'ic-sm') + qty(t.pessoas) + ' ' + peopleUnit(m) + (m === 'b2c' ? '*' : '') + '</span>' +
        (t.estabelecimentos !== undefined ? '<span>' + icon('building', 'ic-sm') + nf(0).format(Math.round(t.estabelecimentos)) + ' estabelecimentos</span>' : '') +
        '</span><span class="kpi-cta">Como chegamos a esse número? ' + icon('arrow', 'ic-sm') + '</span></button>';
    });
    document.getElementById('kpi-grid').innerHTML = html;
    var notes = [];
    if (m === 'b2c') notes.push('<strong>* Público com sobreposição:</strong> a mesma pessoa pode treinar, tomar banho no trabalho e viajar; o total de pessoas é um máximo, não o número de consumidores únicos. Em Viagem, a unidade é a viagem.');
    else notes.push('<strong>Quem compra ≠ quem usa:</strong> os clientes são os estabelecimentos (academias e hotéis); as pessoas atingidas são alunos e hóspedes (1 por quarto ocupado em uma noite média).');
    notes.push('<strong>SOM sem taxa de captura:</strong> o SOM é o recorte “' + esc(M.levels.som.geo) + '” antes de aplicar a fatia de mercado que a WEEK conseguirá conquistar — não é previsão de vendas.');
    document.getElementById('kpi-notes').innerHTML = notes.map(function (n) { return '<p>' + icon('info', 'ic-sm') + '<span>' + n + '</span></p>'; }).join('');
  }

  function renderLevelChart() {
    var m = state.model, M = model(), r = view(m), tam = r.levels.tam.total.valor;
    G.bars(document.getElementById('chart-levels'), {
      ariaLabel: 'TAM, SAM e SOM em reais por ano',
      rows: LEVELS.map(function (l) {
        var t = r.levels[l].total;
        return { label: LEVEL_NAMES[l], sub: M.levels[l].geo, value: t.valor, color: LEVEL_COLOR[l], valueText: brlMi(t.valor),
          tip: LEVEL_NAMES[l] + ' · ' + M.levels[l].geo + '\n' + brlMi(t.valor) + ' por ano\n' + qty(t.volume) + ' ' + unitOf(m) + '/ano\n' + shareText(ratio(t.valor, tam)) + ' do TAM' };
      }),
      table: { caption: 'TAM, SAM e SOM', head: ['Nível', 'Recorte', 'R$/ano', unitOf(m) + '/ano', '% do TAM'],
        rows: LEVELS.map(function (l) { var t = r.levels[l].total; return [LEVEL_NAMES[l], M.levels[l].geo, brlMi(t.valor), qty(t.volume), shareText(ratio(t.valor, tam))]; }) }
    });
  }

  function funnelChartSteps(m) {
    return funnelSteps(m, 'valor').map(function (s) {
      var color = s.major ? LEVEL_COLOR[s.level] : 'var(--l1b)';
      return { label: s.label, sub: s.sub, value: s.value, share: s.share, color: color, connector: s.connector, valueText: s.valueText, shareText: s.shareText,
        tip: s.label + '\n' + s.valueText + ' por ano\n' + s.shareText };
    });
  }
  function funnelTable(steps) {
    return { caption: 'Funil de refinamento', head: ['Etapa', 'Filtro aplicado', 'R$/ano', '% do TAM'],
      rows: steps.map(function (s) { return [s.label, s.connector || '—', s.valueText, shareText(s.share)]; }) };
  }
  function renderFunnelChart() {
    var steps = funnelChartSteps(state.model);
    G.funnel(document.getElementById('chart-funnel'), { steps: steps, minWidth: 6, note: 'Barras muito estreitas são exibidas com largura mínima para continuarem visíveis; o percentual indica a proporção real.', table: funnelTable(steps) });
  }

  function renderSegmentChart() {
    var m = state.model, M = model(), r = view(m), l = state.segLevel, metric = state.segMetric;
    if (!metricOk(m, metric)) metric = state.segMetric = 'valor';
    var lvl = r.levels[l];
    document.querySelectorAll('[data-seg-level]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-seg-level') === l ? 'true' : 'false'); });
    document.querySelectorAll('[data-seg-metric]').forEach(function (b) {
      var k = b.getAttribute('data-seg-metric');
      b.setAttribute('aria-pressed', k === metric ? 'true' : 'false');
      if (k === 'estabelecimentos') b.hidden = m !== 'b2b';
      if (k === 'volume') b.textContent = (m === 'b2c' ? 'Lavagens' : 'Kits') + '/ano';
    });
    var segs = activeSegments(m);
    var rows = segs.map(function (s) {
      var seg = lvl.segments[s.id], v = seg[metric];
      return { label: s.name, sub: shareText(ratio(v, lvl.total[metric])) + ' do ' + LEVEL_NAMES[l], value: v, color: SEG_COLOR[s.id], valueText: fmtMetric(m, metric, v, s.id),
        tip: s.name + ' · ' + LEVEL_NAMES[l] + ' ' + M.levels[l].geo + '\n' + brlMi(seg.valor) + ' por ano\n' + qty(seg.volume) + ' ' + unitOf(m) + '/ano\n' + fmtMetric(m, 'pessoas', seg.pessoas, s.id) };
    });
    var note = metric === 'pessoas' ? (m === 'b2c' ? 'Unidades diferentes: Viagem conta viagens; academia e trabalho contam pessoas (com possível sobreposição).' : 'Unidades diferentes: academias contam usuários; hotéis contam quartos ocupados por noite (1 hóspede por quarto).') :
      metric === 'estabelecimentos' ? 'Hotéis do SAM e do SOM são contagens do Cadastur; academias são estimadas pelos fatores de SP, premium e Campinas.' : '';
    var el = document.getElementById('chart-segments');
    G.bars(el, {
      ariaLabel: 'Mercado por segmento — ' + LEVEL_NAMES[l], rows: rows,
      table: { caption: 'Mercado por segmento', head: ['Segmento', 'R$/ano', unitOf(m) + '/ano', 'Público'].concat(m === 'b2b' ? ['Estabelecimentos'] : []),
        rows: segs.map(function (s) { var x = lvl.segments[s.id]; return [s.name, brlMi(x.valor), qty(x.volume), fmtMetric(m, 'pessoas', x.pessoas, s.id)].concat(m === 'b2b' ? [nf(0).format(Math.round(x.estabelecimentos))] : []); }) }
    });
    if (note) el.insertAdjacentHTML('beforeend', '<p class="fine">' + icon('info', 'ic-sm') + ' ' + esc(note) + '</p>');
  }

  function renderComposition() {
    var m = state.model, M = model(), r = view(m), segs = activeSegments(m);
    G.stacked(document.getElementById('chart-composition'), {
      legend: segs.map(function (s) { return { name: s.name, color: SEG_COLOR[s.id] }; }),
      fmtShare: function (s) { return nf(0).format(s * 100) + '%'; },
      rows: LEVELS.map(function (l) {
        var lvl = r.levels[l];
        return { label: LEVEL_NAMES[l], sub: M.levels[l].geo, parts: segs.map(function (s) {
          var seg = lvl.segments[s.id];
          return { name: s.name, value: seg.valor, color: SEG_COLOR[s.id], tip: s.name + ' · ' + LEVEL_NAMES[l] + '\n' + pct1(ratio(seg.valor, lvl.total.valor)) + ' do valor\n' + brlMi(seg.valor) + ' por ano' };
        }) };
      }),
      table: { caption: 'Composição por segmento', head: ['Nível'].concat(segs.map(function (s) { return s.name; })),
        rows: LEVELS.map(function (l) { var lvl = r.levels[l]; return [LEVEL_NAMES[l]].concat(segs.map(function (s) { return pct1(ratio(lvl.segments[s.id].valor, lvl.total.valor)); })); }) }
    });
  }

  function renderVolumeGrid() {
    var m = state.model, M = model(), r = view(m);
    function row(l, v) { return '<li><span class="lvl lvl-' + l + '">' + LEVEL_NAMES[l] + '</span><span>' + esc(M.levels[l].geo) + '</span><strong>' + v + '</strong></li>'; }
    var cards = [];
    cards.push('<article class="card vol-card"><h3 class="h5">' + icon('box') + ' Volume anual de ' + unitOf(m) + '</h3><ul>' + LEVELS.map(function (l) { return row(l, qty(r.levels[l].total.volume)); }).join('') + '</ul></article>');
    cards.push('<article class="card vol-card"><h3 class="h5">' + icon('users') + (m === 'b2c' ? ' Pessoas e viagens atingidas (máximo)' : ' Pessoas atingidas (noite média)') + '</h3><ul>' +
      LEVELS.map(function (l) { return row(l, qty(r.levels[l].total.pessoas)); }).join('') + '</ul>' +
      '<p class="fine">' + (m === 'b2c' ? 'Soma pessoas e viagens; pode haver sobreposição entre segmentos.' : 'Usuários de academia + hóspedes por noite (1 por quarto ocupado). Ao longo do ano, o número de hóspedes diferentes é maior.') + '</p></article>');
    if (m === 'b2b') {
      cards.push('<article class="card vol-card"><h3 class="h5">' + icon('building') + ' Estabelecimentos (clientes B2B)</h3><ul>' +
        LEVELS.map(function (l) {
          var s = r.levels[l].segments;
          var parts = [s.academias ? nf(0).format(Math.round(s.academias.estabelecimentos)) + ' academias' : '', s.hoteis ? nf(0).format(s.hoteis.estabelecimentos) + ' hotéis' : ''].filter(Boolean).join(' · ');
          return row(l, nf(0).format(Math.round(r.levels[l].total.estabelecimentos)) + '<small>' + parts + '</small>');
        }).join('') + '</ul></article>');
    } else {
      var i = r.inputs;
      cards.push('<article class="card vol-card"><h3 class="h5">' + icon('filter') + ' Fatores de filtro aplicados</h3><ul>' +
        '<li><span class="lvl lvl-sam">SAM</span><span>' + pctS(i.pesoSudeste) + ' × ' + pctS(i.pctClassesAB) + ' × ' + pctS(i.pctOnline) + '</span><strong>' + pctS(r.factorSummary.sam) + '</strong></li>' +
        '<li><span class="lvl lvl-som">SOM</span><span>Peso de SP no Sudeste</span><strong>' + pctS(r.factorSummary.som) + '</strong></li>' +
        '<li><span class="lvl lvl-som">SOM</span><span>Parcela do TAM</span><strong>' + shareText(ratio(r.levels.som.total.valor, r.levels.tam.total.valor)) + '</strong></li></ul></article>');
    }
    document.getElementById('volume-grid').innerHTML = cards.join('');
  }

  function renderCompare() {
    var rows = [];
    LEVELS.forEach(function (l) {
      ['b2c', 'b2b'].forEach(function (m) {
        var r = view(m), M = D.MODELS[m], v = r.levels[l].total.valor;
        rows.push({ group: LEVEL_NAMES[l], label: M.name, sub: M.levels[l].geo, value: v, color: MODEL_COLOR[m], valueText: brlMi(v),
          tip: M.name + ' · ' + LEVEL_NAMES[l] + ' ' + M.levels[l].geo + '\n' + brlMi(v) + ' por ano\n' + qty(r.levels[l].total.volume) + ' ' + unitOf(m) + '/ano' + (isModified(m) ? '\n(cenário simulado)' : '') + (isFiltered(m) ? '\n(filtro de segmentos ativo)' : '') });
      });
    });
    G.bars(document.getElementById('chart-compare'), {
      ariaLabel: 'Comparação entre B2C e B2B', rows: rows,
      table: { caption: 'Comparação B2C × B2B', head: ['Nível', 'B2C', 'Recorte B2C', 'B2B', 'Recorte B2B'],
        rows: LEVELS.map(function (l) { return [LEVEL_NAMES[l], brlMi(view('b2c').levels[l].total.valor), D.MODELS.b2c.levels[l].geo, brlMi(view('b2b').levels[l].total.valor), D.MODELS.b2b.levels[l].geo]; }) }
    });
  }

  var METRIC_NAMES = { pessoas: 'Público', volume: 'Volume', valor: 'R$/ano', estabelecimentos: 'Estabelecimentos' };
  var STATUS_TEXT = { confere: 'Confere', arredondamento: 'Arredondamento', divergencia: 'Divergência' };
  function refMetricText(metric, v) {
    if (metric === 'valor') return 'R$ ' + nf(2).format(v / 1e6) + ' mi';
    if (metric === 'estabelecimentos') return nf(1).format(v);
    return qty(v);
  }
  var auditCache = {};
  function renderAudit() {
    var m = state.model, cur = full(m);
    var chk = C.checks(cur);
    var rec = auditCache[m] || (auditCache[m] = C.reconcile(BASE[m]));
    var nOk = chk.filter(function (c) { return c.pass; }).length;
    var nRound = rec.filter(function (x) { return x.status === 'arredondamento'; }).length;
    var nDiv = rec.filter(function (x) { return x.status === 'divergencia'; }).length;
    document.getElementById('audit-summary').innerHTML = '<span class="pill ' + (nOk === chk.length ? 'pill-ok' : 'pill-bad') + '">' + nOk + '/' + chk.length + ' verificações</span>' +
      '<span class="pill">' + rec.length + ' valores conferidos com o PDF</span>' + (nRound ? '<span class="pill pill-warn">' + nRound + ' arredondamentos</span>' : '') + (nDiv ? '<span class="pill pill-bad">' + nDiv + ' divergências</span>' : '');
    var body = document.getElementById('audit-body');
    if (!document.getElementById('audit').open) { body.dataset.stale = '1'; return; }   // conteúdo pesado só quando aberto
    body.dataset.stale = '';
    body.innerHTML = '<div class="audit-cols"><div><h4 class="h5">Verificações automáticas ' + (isModified(m) ? '(cenário simulado)' : '(cenário-base)') + '</h4><ul class="check-list">' +
      chk.map(function (c) { return '<li class="' + (c.pass ? 'pass' : 'fail') + '">' + icon(c.pass ? 'check' : 'alert', 'ic-sm') + '<span>' + esc(c.label) + (c.detail ? ' — ' + esc(c.detail) : '') + '</span></li>'; }).join('') +
      '</ul></div><div><h4 class="h5">Como ler a conferência</h4><p class="fine">O motor recalcula cada valor com precisão total a partir das premissas e compara com o número publicado no PDF (cenário-base, todos os segmentos). <b>Confere</b>: diferença ≤ 0,25%. <b>Arredondamento</b>: até 1,5%, causada por valores intermediários arredondados no documento. <b>Divergência</b>: acima disso — seria sinalizada para revisão. Nenhum valor foi forçado para coincidir com o PDF.</p></div></div>' +
      '<div class="table-scroll"><table class="rec-table"><caption class="sr-only">Conferência com o PDF</caption><thead><tr><th scope="col">Nível</th><th scope="col">Segmento</th><th scope="col">Medida</th><th scope="col">PDF</th><th scope="col">Recalculado</th><th scope="col">Diferença</th><th scope="col">Status</th></tr></thead><tbody>' +
      rec.map(function (x) {
        return '<tr class="st-' + x.status + '"><td>' + LEVEL_NAMES[x.level] + '</td><td>' + (x.segment === 'total' ? '<b>Total</b>' : esc(segName(m, x.segment))) + '</td><td>' + METRIC_NAMES[x.metric] + '</td>' +
          '<td>' + refMetricText(x.metric, x.ref) + '</td><td>' + refMetricText(x.metric, x.calc) + '</td><td>' + F.signedPct(x.diffRel, 2) + '</td><td><span class="rec-status">' + STATUS_TEXT[x.status] + '</span></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderPainel() {
    renderModelStrip(); renderKpis(); renderLevelChart(); renderFunnelChart(); renderSegmentChart(); renderComposition(); renderVolumeGrid(); renderCompare(); renderAudit();
  }

  /* ================================================================ */
  /* 5/7. Como foi calculado                                           */
  /* ================================================================ */
  function tok(text, label, kind, key) { return { t: 'v', text: text, label: label, kind: kind || 'mid', key: key }; }
  function op(s) { return { t: 'op', text: s }; }
  function chainFor(m, segId, r) {
    var i = r.inputs, s = r.levels.tam.segments[segId];
    var fi = function (k) { return fmtInput(m, k, i[k]); };
    if (m === 'b2c') {
      if (segId === 'academia') return [tok(qty(i.alunosAcademia), 'alunos de academia', 'input', 'alunosAcademia'), op('×'), tok(fi('pctBanhoAcademia'), 'tomam banho lá', 'input', 'pctBanhoAcademia'), op('='), tok(qty(s.pessoas), 'pessoas'), op('×'), tok(fi('banhosAno'), 'banhos/ano', 'input', 'banhosAno'), op('='), tok(qty(s.volume), 'lavagens/ano'), op('×'), tok(fi('preco'), 'por kit', 'input', 'preco'), op('='), tok(brlMi(s.valor), 'TAM anual', 'result')];
      if (segId === 'trabalho') return [tok(qty(i.trabalhadoresCLT), 'trabalhadores CLT', 'input', 'trabalhadoresCLT'), op('×'), tok(fi('pctBanhoTrabalho'), 'tomam banho no trabalho', 'input', 'pctBanhoTrabalho'), op('='), tok(qty(s.pessoas), 'pessoas'), op('×'), tok(fi('banhosAno'), 'banhos/ano', 'input', 'banhosAno'), op('='), tok(qty(s.volume), 'lavagens/ano'), op('×'), tok(fi('preco'), 'por kit', 'input', 'preco'), op('='), tok(brlMi(s.valor), 'TAM anual', 'result')];
      return [tok(qty(i.viagens), 'viagens com pernoite', 'input', 'viagens'), op('×'), tok(qty(i.viajantesPorViagem), 'viajante por viagem', 'input', 'viajantesPorViagem'), op('='), tok(qty(s.pessoas), 'viagens consideradas'), op('×'), tok(fi('banhosPorViagem'), 'banhos por viagem', 'input', 'banhosPorViagem'), op('='), tok(qty(s.volume), 'lavagens/ano'), op('×'), tok(fi('preco'), 'por kit', 'input', 'preco'), op('='), tok(brlMi(s.valor), 'TAM anual', 'result')];
    }
    if (segId === 'academias') return [tok(nf(0).format(i.academiasSudeste), 'academias no Sudeste', 'input', 'academiasSudeste'), op('×'), tok(qty(i.alunosPorAcademia), 'alunos por academia', 'input', 'alunosPorAcademia'), op('×'), tok(fi('pctBanhoAcademia'), 'tomam banho lá', 'input', 'pctBanhoAcademia'), op('='), tok(qty(s.pessoas), 'usuários'), op('×'), tok(fi('banhosAno'), 'banhos/ano', 'input', 'banhosAno'), op('='), tok(qty(s.volume), 'kits/ano'), op('×'), tok(fi('preco'), 'por kit', 'input', 'preco'), op('='), tok(brlMi(s.valor), 'TAM anual', 'result')];
    return [tok(nf(0).format(i.quartosSudeste), 'quartos no Sudeste', 'input', 'quartosSudeste'), op('×'), tok(fi('ocupacao'), 'ocupação média', 'input', 'ocupacao'), op('='), tok(qty(s.pessoas), 'quartos ocupados/noite'), op('×'), tok(nf(0).format(i.diasAno), 'dias', 'input', 'diasAno'), op('×'), tok(qty(i.kitsPorQuarto), 'kit por quarto ocupado', 'input', 'kitsPorQuarto'), op('='), tok(qty(s.volume), 'kits/ano'), op('×'), tok(fi('preco'), 'por kit', 'input', 'preco'), op('='), tok(brlMi(s.valor), 'TAM anual', 'result')];
  }
  function renderChain(m, chain) {
    var changed = C.changedInputs(m, state.inputs[m]);
    return '<div class="chain">' + chain.map(function (t) {
      if (t.t === 'op') return '<span class="chain-op" aria-hidden="true">' + t.text + '</span>';
      var ch = t.key && changed.indexOf(t.key) >= 0;
      return '<span class="chain-tok chain-' + t.kind + (ch ? ' changed' : '') + '"><strong>' + esc(t.text) + '</strong><small>' + esc(t.label) + (ch ? ' · simulado' : '') + '</small></span>';
    }).join('') + '</div>';
  }
  function assumptionDetail(a) {
    return '<li class="adetail"><div class="adetail-head"><strong>' + esc(a.name) + '</strong><span class="adetail-val">' + esc(a.value) + '</span>' + confMeter(a.confidence) + '</div>' +
      '<p>' + esc(a.logic) + '</p><p class="adetail-meta"><span><b>Fonte:</b> ' + sourceLinks(a) + '</span><span><b>Validação:</b> ' + statusBadge(a.status) + ' ' + esc(a.validation) + '</span></p></li>';
  }
  var STEP_TEXT = {
    b2c: {
      academia: ['Alunos de academia (13 mi) × % que toma banho na academia = pessoas que tomam banho na academia.', 'Pessoas × banhos por ano (2 por semana × 48 semanas = 96) = lavagens por ano.', 'Lavagens por ano × preço do kit de uma lavagem = TAM do segmento.'],
      trabalho: ['Trabalhadores CLT × % que toma banho no trabalho = pessoas que tomam banho no trabalho.', 'Pessoas × banhos por ano (mesma frequência da academia, a validar na pesquisa quanti) = lavagens por ano.', 'Lavagens por ano × preço do kit = TAM do segmento.'],
      viagem: ['Viagens com pernoite × 1 viajante por viagem = viagens consideradas (conservador: o IBGE conta viagens, não pessoas).', 'Viagens × banhos por viagem (mediana de 2 a 3 noites, 1 banho por noite ≈ 3) = lavagens por ano.', 'Lavagens por ano × preço do kit = TAM do segmento.']
    },
    b2b: {
      academias: ['Academias no Sudeste × alunos por academia = alunos das academias do Sudeste (≈ 5,85 mi no cenário-base).', 'Alunos × % que toma banho na academia = usuários; × banhos por ano = kits que as academias usariam.', 'Kits por ano × preço B2B por kit = TAM do segmento.'],
      hoteis: ['Quartos de hospedagem no Sudeste × taxa de ocupação média de 2025 = quartos ocupados por noite.', 'Quartos ocupados × 365 dias × kits por quarto ocupado (premissa: 1 por noite, a validar) = kits por ano.', 'Kits por ano × preço B2B por kit = TAM do segmento.']
    }
  };
  var openHow = {};   // painéis "Como chegamos" abertos sobrevivem às re-renderizações
  function renderCalc() {
    var m = state.model, M = model(), r = full(m), mod = isModified(m);
    var html = '<div class="formula-banner card"><span class="fb-label">Fórmula-base, por segmento (R$/ano)</span><p>Mercado do segmento = ' + esc(M.formula) + '</p>' +
      (m === 'b2c' ? '<p class="fine">1 kit = shampoo + condicionador para uma lavagem. O cálculo é feito por segmento e somado no final.</p>' : '<p class="fine">Quem compra é o estabelecimento (academia ou hotel); quem usa o kit é o aluno ou o hóspede. Só academias e hotéis entram porque têm contagem oficial ou setorial por estado; coworkings, clubes e empresas com vestiário podem entrar depois.</p>') +
      (mod ? '<p class="sim-flag">' + icon('sliders', 'ic-sm') + ' Exibindo o <b>cenário simulado</b>: premissas alteradas aparecem destacadas.</p>' : '') +
      (isFiltered(m) ? '<p class="sim-flag">' + icon('filter', 'ic-sm') + ' A metodologia mostra todos os segmentos; os segmentos fora do filtro do explorador estão marcados.</p>' : '') + '</div><div class="seg-cards">';
    M.segments.forEach(function (s) {
      var seg = r.levels.tam.segments[s.id];
      var as = assumptionsFor(m, { levels: ['TAM'], segment: s.name });
      var pid = 'how-' + m + '-' + s.id, open = !!openHow[pid];
      var off = state.segs[m].indexOf(s.id) < 0;
      html += '<article class="card seg-card' + (off ? ' off' : '') + '" id="seg-' + m + '-' + s.id + '" style="--seg:' + SEG_COLOR[s.id] + '">' +
        '<header><h3 class="h4"><i class="dot" style="background:' + SEG_COLOR[s.id] + '"></i>' + esc(s.name) + (off ? ' <span class="tag">fora do filtro</span>' : '') + '</h3><p>' + esc(s.who) + ' · <span class="muted">Base de volume: ' + esc(s.base) + '</span></p>' +
        '<span class="seg-total">' + brlMi(seg.valor) + '<small>TAM/ano · ' + shareText(ratio(seg.valor, r.levels.tam.total.valor)) + ' do total</small></span></header>' +
        renderChain(m, chainFor(m, s.id, r)) +
        (m === 'b2b' && s.id === 'hoteis' ? '<p class="inline-warn">' + icon('alert', 'ic-sm') + ' O volume hoteleiro usa a premissa de <b>1 kit por quarto ocupado por noite</b> — estimativa própria a validar na pesquisa quali, não prática comprovada de todos os hotéis.</p>' : '') +
        '<button type="button" class="btn btn-sm btn-ghost how-btn" aria-expanded="' + open + '" aria-controls="' + pid + '">Como chegamos a esse número? ' + icon('down', 'chev') + '</button>' +
        '<div class="how" id="' + pid + '"' + (open ? '' : ' hidden') + '><h4 class="h5">Etapas da fórmula</h4><ol class="how-steps">' + STEP_TEXT[m][s.id].map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' +
        '<h4 class="h5">Premissas, justificativa e confiança</h4><ul class="adetails">' + as.map(assumptionDetail).join('') + '</ul></div></article>';
    });
    html += '</div>';
    var t = r.levels.tam.total, segs = M.segments.map(function (s) { return r.levels.tam.segments[s.id]; });
    html += '<div class="card consolidated"><h3 class="h4">Consolidado do TAM · ' + esc(M.levels.tam.geo) + ' (todos os segmentos)</h3><div class="cons-grid">' +
      '<div><span>' + (m === 'b2c' ? 'Lavagens fora de casa por ano' : 'Kits por ano') + '</span><strong>' + qty(t.volume) + '</strong><small>' + segs.map(function (x) { return qty(x.volume); }).join(' + ') + '</small></div>' +
      '<div><span>Faturamento anual potencial</span><strong>' + brlMi(t.valor) + '</strong><small>' + segs.map(function (x) { return brlMi(x.valor); }).join(' + ') + '</small></div>' +
      '<div><span>' + (m === 'b2c' ? 'Pessoas atingidas (máximo)' : 'Pessoas atingidas (noite média)') + '</span><strong>≈ ' + qty(t.pessoas) + '</strong><small>' + (m === 'b2c' ? 'Pode haver sobreposição entre segmentos' : 'Usuários + hóspedes por noite') + '</small></div>' +
      (m === 'b2b' ? '<div><span>Estabelecimentos atingidos</span><strong>' + nf(0).format(t.estabelecimentos) + '</strong><small>' + nf(0).format(r.inputs.academiasSudeste) + ' academias + ' + nf(0).format(r.inputs.meiosHospedagemSudeste) + ' meios de hospedagem</small></div>' : '') +
      '</div><p class="fine">Valores do PDF (cenário-base): ' + (m === 'b2c' ? '527,4 mi lavagens · R$ 1,85 bi · ≈ 20,8 mi pessoas.' : '183,8 mi kits · ≈ R$ 551,5 mi · 32.341 estabelecimentos · ≈ 1,37 mi pessoas.') + ' Somamos ' + unitOf(m) + ', e não pessoas, porque a mesma pessoa pode aparecer em mais de um segmento.</p></div>';
    document.getElementById('calc-body').innerHTML = html;
  }

  /* ================================================================ */
  /* 6/8. Como é filtrado                                              */
  /* ================================================================ */
  function factorChips(parts, resultText, resultLabel) {
    return '<div class="factor-eq">' + parts.map(function (p, idx) {
      return (idx ? '<span class="chain-op">×</span>' : '') + '<span class="chain-tok chain-input' + (p.changed ? ' changed' : '') + '"><strong>' + esc(p.v) + '</strong><small>' + esc(p.l) + '</small></span>';
    }).join('') + '<span class="chain-op">=</span><span class="chain-tok chain-result"><strong>' + esc(resultText) + '</strong><small>' + esc(resultLabel) + '</small></span></div>';
  }
  function renderFilters() {
    var m = state.model, M = model(), r = view(m), fr = full(m), i = r.inputs;
    var changed = C.changedInputs(m, i);
    function p(k, l) { return { v: fmtInput(m, k, i[k]), l: l, changed: changed.indexOf(k) >= 0 }; }
    var html = '';
    if (m === 'b2c') {
      html += '<p class="sec-lead">Os filtros definem o público e o canal que a WEEK consegue atender no início: quem mora no Sudeste, tem renda para um produto premium e compra pela internet (SAM); depois, o recorte do estado de SP (SOM).</p>' +
        '<div class="filter-cards"><article class="card"><h3 class="h4"><span class="lvl lvl-sam">SAM</span> Sudeste — fator ' + pctS(fr.factorSummary.sam) + '</h3>' +
        factorChips([p('pesoSudeste', 'peso do Sudeste'), p('pctClassesAB', 'classes A e B'), p('pctOnline', 'compram online')], pctS(fr.factorSummary.sam), 'fator do SAM') +
        '<ul class="why"><li><b>Premium (classes A e B):</b> um kit premium não é para todo mundo que toma banho fora; é para quem tem renda para pagar mais por qualidade.</li><li><b>E-commerce:</b> no começo a WEEK pretende vender pelo site; quem não compra pela internet não é atendível agora, então sai do SAM.</li></ul></article>' +
        '<article class="card"><h3 class="h4"><span class="lvl lvl-som">SOM</span> Estado de SP — fator ' + pctS(i.pesoSP) + '</h3>' +
        factorChips([p('pesoSP', 'peso de SP no Sudeste')], pctS(i.pesoSP), 'fator do SOM') +
        '<p>O SOM considera todo o público do SAM que está no estado de SP. Quando houver a taxa de captura, basta multiplicar: <b>fator do SOM = ' + pctS(i.pesoSP) + ' × taxa de captura</b>.</p></article></div>';
    } else {
      html += '<p class="sec-lead">No B2B, cada segmento tem filtros próprios: o peso de SP e o perfil do estabelecimento (academias premium; quartos de hotéis, flats e resorts) formam o SAM; a participação de Campinas forma o SOM. Escolher só academias premium reduz bastante o mercado de academias, enquanto quase todos os quartos de SP já são de hotéis.</p><div class="filter-cards">' +
        '<article class="card"><h3 class="h4"><span class="lvl lvl-sam">SAM</span> Academias — fator ' + pctS(fr.factors.sam.academias) + '</h3>' + factorChips([p('pesoSPAcademias', 'SP nas academias do Sudeste'), p('pctPremium', 'perfil premium')], pctS(fr.factors.sam.academias), 'fator do SAM') + '</article>' +
        '<article class="card"><h3 class="h4"><span class="lvl lvl-sam">SAM</span> Hotéis — fator ' + pctS(fr.factors.sam.hoteis) + '</h3>' + factorChips([p('pesoSPQuartos', 'SP nos quartos do Sudeste'), p('pctHoteis', 'quartos de hotéis')], pctS(fr.factors.sam.hoteis), 'fator do SAM') + '</article>' +
        '<article class="card"><h3 class="h4"><span class="lvl lvl-som">SOM</span> Campinas</h3>' + factorChips([p('fatorCampinasAcademias', 'academias de SP em Campinas')], pctS(i.fatorCampinasAcademias), 'academias') + factorChips([p('fatorCampinasHoteis', 'quartos de hotel de SP em Campinas')], pctS(i.fatorCampinasHoteis), 'hotéis') +
        '<p class="fine">Academias: 0,9% ÷ 25% (Panorama Setorial). Hotéis: 5.274 ÷ 146.653 quartos (Cadastur). Usam contagens reais em vez do peso da população.</p></article></div>';
    }
    var steps = funnelChartSteps(m);
    var cur = Math.min(state.filterStep[m], steps.length - 1);
    html += '<div class="card progressive"><div class="prog-head"><h3 class="h4">Aplicando os filtros, passo a passo' + (isFiltered(m) ? ' <span class="tag">' + esc(activeSegNames(m).join(' + ')) + '</span>' : '') + '</h3>' +
      '<div class="prog-ctrl"><button type="button" class="btn btn-sm btn-ghost" data-fstep="prev"' + (cur <= 0 ? ' disabled' : '') + '>Anterior</button>' +
      '<span class="prog-count" aria-live="polite">Etapa ' + (cur + 1) + ' de ' + steps.length + '</span>' +
      '<button type="button" class="btn btn-sm btn-primary" data-fstep="next"' + (cur >= steps.length - 1 ? ' disabled' : '') + '>Aplicar próximo filtro</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-fstep="all">' + (cur >= steps.length - 1 ? 'Recomeçar' : 'Mostrar tudo') + '</button></div></div>' +
      '<div id="filter-funnel" class="chart"></div></div>';
    var segs = activeSegments(m);
    var head = '<tr><th scope="col">Segmento</th>' + LEVELS.map(function (l) { return '<th scope="col">' + LEVEL_NAMES[l] + ' · ' + esc(M.levels[l].geo) + '</th>'; }).join('') + '</tr>';
    var body = segs.concat([{ id: 'total', name: 'Total' + (isFiltered(m) ? ' (filtro)' : '') }]).map(function (s) {
      return '<tr' + (s.id === 'total' ? ' class="total"' : '') + '><th scope="row">' + (s.id !== 'total' ? '<i class="dot" style="background:' + SEG_COLOR[s.id] + '"></i>' : '') + esc(s.name) + '</th>' + LEVELS.map(function (l) {
        var x = s.id === 'total' ? r.levels[l].total : r.levels[l].segments[s.id];
        return '<td><strong>' + brlMi(x.valor) + '</strong><small>' + qty(x.volume) + ' ' + unitOf(m) + ' · ' + (s.id === 'total' ? qty(x.pessoas) + ' ' + peopleUnit(m) : fmtMetric(m, 'pessoas', x.pessoas, s.id)) + (x.estabelecimentos !== undefined ? ' · ' + nf(0).format(Math.round(x.estabelecimentos)) + ' estab.' : '') + '</small></td>';
      }).join('') + '</tr>';
    }).join('');
    html += '<div class="card"><h3 class="h4">Resultado por segmento</h3><div class="table-scroll"><table class="seg-table"><caption class="sr-only">TAM, SAM e SOM por segmento</caption><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
    if (m === 'b2c') html += '<p class="fine">Conferência do PDF: TAM total × fator do SAM = ' + brlMi(r.levels.tam.total.valor) + ' × ' + pctS(fr.factorSummary.sam) + ' = ' + brlMi(r.levels.sam.total.valor) + '; SAM × ' + pctS(i.pesoSP) + ' = ' + brlMi(r.levels.som.total.valor) + '. Resultados de referência do PDF (todos os segmentos): SAM ≈ R$ 180,7 mi e SOM ≈ R$ 94,6 mi.</p>';
    else html += '<p class="fine">Academias do SAM: academias de SP (13.767) × 31% premium ≈ 4.268; do SOM: × 3,6% ≈ 154. Hotéis do SAM (1.893) e de Campinas (41) são contagens do Cadastur e não variam no simulador. Resultados de referência do PDF (todos os segmentos): SAM ≈ R$ 155,8 mi (6.161 estabelecimentos) e SOM ≈ R$ 5,61 mi (195 estabelecimentos).</p>';
    html += '</div><div class="callout callout-warn" role="note">' + icon('alert') + '<div><strong>O SOM é um recorte, não uma previsão de vendas.</strong> Ele representa todo o mercado do SAM no recorte “' + esc(M.levels.som.geo) + '” antes da aplicação da taxa de captura comercial da WEEK.</div></div>';
    document.getElementById('filter-body').innerHTML = html;
    var visible = steps.map(function (s, k) { return k <= cur ? s : { label: s.label, sub: s.sub, share: s.share, connector: s.connector, color: 'var(--line)', valueText: '—', shareText: 'filtro ainda não aplicado', tip: s.label + '\nClique em “Aplicar próximo filtro”' }; });
    G.funnel(document.getElementById('filter-funnel'), { steps: visible, minWidth: 6, table: funnelTable(steps) });
  }

  /* ================================================================ */
  /* Premissas (tabela estática: renderizada uma vez + filtros)        */
  /* ================================================================ */
  var PRIORITY = ['b2c-banho-acad', 'b2c-banho-trab', 'b2c-freq', 'b2c-preco', 'b2b-preco', 'b2b-premium', 'b2b-kits'];
  var sensCache = {};
  function sensOf(a) {
    if (!a.key) return null;
    var k = a.model + ':' + a.key;
    if (!(k in sensCache)) sensCache[k] = C.sensitivity(a.model, a.key, 0.10);
    return sensCache[k];
  }
  function impactCell(a) {
    var s = sensOf(a);
    if (!s) return '—';
    var v = s.som, w = Math.min(100, Math.abs(v) / 0.10 * 100);
    var lv = Math.abs(s.tam) > 1e-9 ? 'TAM, SAM e SOM' : Math.abs(s.sam) > 1e-9 ? 'SAM e SOM' : 'somente SOM';
    return '<span class="impact" data-tip="' + esc('Se “' + a.name + '” subir 10%\nSOM ' + a.model.toUpperCase() + ': ' + F.signedPct(v) + '\nAfeta: ' + lv) + '" tabindex="0"><span class="impact-bar"><i style="width:' + w.toFixed(0) + '%"></i></span>' + F.signedPct(v) + '</span>';
  }
  function hasSpec(a) { return a.key && C.getSpec(a.model, a.key); }
  function renderPriority() {
    var items = PRIORITY.map(function (id) { return D.ASSUMPTIONS.filter(function (a) { return a.id === id; })[0]; }).filter(Boolean);
    document.getElementById('priority').innerHTML = '<h3 class="h4">' + icon('alert') + ' Premissas prioritárias para validação</h3>' +
      '<p class="fine">Estimativas com confiança baixa ou média que mexem diretamente no tamanho do mercado. Validá-las na pesquisa quanti/quali é o próximo passo para transformar o dimensionamento em decisão. Clique para ver a premissa na tabela.</p><ul class="prio-list">' +
      items.map(function (a) {
        return '<li><button type="button" class="prio-item" data-focus-assump="' + a.id + '"><span class="model-pill model-pill-' + a.model + '">' + a.model.toUpperCase() + '</span><span class="prio-name">' + esc(a.name) + ' <b>' + esc(a.value) + '</b></span>' + confMeter(a.confidence) + '</button></li>';
      }).join('') + '<li><button type="button" class="prio-item" data-focus-assump="b2b-kits"><span class="model-pill model-pill-b2b">B2B</span><span class="prio-name">Frequência de reposição de kits nos hotéis</span><span class="fine">ver “Kits por quarto ocupado”</span></button></li></ul>';
  }
  function fillFilterOptions() {
    var f = document.getElementById('assump-filters');
    var segs = [];
    D.ASSUMPTIONS.forEach(function (a) { if (segs.indexOf(a.segment) < 0) segs.push(a.segment); });
    f.segment.insertAdjacentHTML('beforeend', segs.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join(''));
    f.confidence.insertAdjacentHTML('beforeend', D.CONFIDENCE.map(function (c) { return '<option value="' + c.id + '">' + c.label + '</option>'; }).join(''));
    f.status.insertAdjacentHTML('beforeend', Object.keys(D.STATUS).map(function (k) { return '<option value="' + k + '">' + D.STATUS[k].label + '</option>'; }).join(''));
    document.getElementById('legend-conf').innerHTML = '<span class="fine">Confiança:</span>' + D.CONFIDENCE.map(function (c) { return confMeter(c.id); }).join('') +
      '<span class="fine legend-st">Status:</span>' + Object.keys(D.STATUS).map(statusBadge).join('');
  }
  function buildAssumptionRows() {
    var lastGroup = '';
    document.querySelector('#assump-table tbody').innerHTML = D.ASSUMPTIONS.map(function (a) {
      var g = a.model.toUpperCase() + ' · ' + a.level + ' · ' + a.segment;
      var groupRow = g !== lastGroup ? '<tr class="group-row" data-group="' + esc(g) + '"><th colspan="7" scope="colgroup">' + esc(g) + '</th></tr>' : '';
      lastGroup = g;
      var hay = [a.name, a.value, a.logic, a.validation, a.sourceNote || ''].concat(a.sources.map(function (s) { return D.SOURCES[s].label; })).join(' ').toLowerCase();
      return groupRow + '<tr id="as-' + a.id + '" class="arow" data-group="' + esc(g) + '" data-model="' + a.model + '" data-segment="' + esc(a.segment) + '" data-confidence="' + a.confidence + '" data-status="' + a.status + '" data-hay="' + esc(hay) + '">' +
        '<th scope="row" data-label="Premissa"><span class="aname">' + esc(a.name) + '</span><span class="abadges"><span class="model-pill model-pill-' + a.model + '">' + a.model.toUpperCase() + '</span><span class="lvl lvl-' + a.level.toLowerCase() + '">' + a.level + '</span></span>' +
        (hasSpec(a) ? '<button type="button" class="link-btn" data-sim-key="' + a.model + ':' + a.key + '">' + icon('sliders', 'ic-sm') + 'Simular</button>' : '') + '</th>' +
        '<td data-label="Valor" class="aval">' + esc(a.value) + '</td><td data-label="Lógica do cálculo">' + esc(a.logic) + '</td>' +
        '<td data-label="Fonte">' + sourceLinks(a) + '</td><td data-label="Confiança">' + confMeter(a.confidence) + '</td>' +
        '<td data-label="Como validar">' + statusBadge(a.status) + '<span class="aval-text">' + esc(a.validation) + '</span></td>' +
        '<td data-label="Impacto (SOM, +10%)">' + impactCell(a) + '</td></tr>';
    }).join('') + '<tr class="empty-row" hidden><td colspan="7" class="empty">Nenhuma premissa corresponde aos filtros. <button type="button" class="link-btn" data-clear-filters>Limpar filtros</button></td></tr>';
  }
  /* Filtrar só alterna visibilidade das linhas (sem recriar o DOM) */
  function applyAssumptionFilters() {
    var f = document.getElementById('assump-filters');
    var q = (f.q.value || '').trim().toLowerCase();
    var shown = 0, nVal = 0, groups = {};
    document.querySelectorAll('#assump-table tr.arow').forEach(function (tr) {
      var ok = (!f.model.value || tr.dataset.model === f.model.value) && (!f.segment.value || tr.dataset.segment === f.segment.value) &&
        (!f.confidence.value || tr.dataset.confidence === f.confidence.value) && (!f.status.value || tr.dataset.status === f.status.value) &&
        (!q || tr.dataset.hay.indexOf(q) >= 0);
      tr.hidden = !ok;
      if (ok) { shown++; groups[tr.dataset.group] = true; if (tr.dataset.status === 'validar') nVal++; }
    });
    document.querySelectorAll('#assump-table tr.group-row').forEach(function (tr) { tr.hidden = !groups[tr.dataset.group]; });
    document.querySelector('#assump-table tr.empty-row').hidden = shown > 0;
    var filtersOn = f.model.value || f.segment.value || f.confidence.value || f.status.value || q;
    document.getElementById('assump-count').textContent = shown + ' de ' + D.ASSUMPTIONS.length + ' premissas exibidas · ' + nVal + ' a validar em pesquisa' + (filtersOn ? ' · filtros ativos' : '');
    document.getElementById('assump-clear').hidden = !filtersOn;
  }

  /* ================================================================ */
  /* Simulador                                                         */
  /* ================================================================ */
  function stepDecimals(step) { var s = String(step); return s.indexOf('.') >= 0 ? s.split('.')[1].length : 0; }
  function displayValue(m, key) {
    var spec = C.getSpec(m, key), v = C.toDisplay(m, key, state.inputs[m][key]);
    return spec.type === 'brl' ? nf(2, 2).format(v) : nf(Math.max(2, stepDecimals(spec.step))).format(v);
  }
  function baseDisplay(m, key) {
    var spec = C.getSpec(m, key), v = C.toDisplay(m, key, D.BASE_INPUTS[m][key]);
    var t = nf(Math.max(2, stepDecimals(spec.step))).format(v);
    return spec.type === 'pct' ? t + '%' : spec.type === 'brl' ? 'R$ ' + nf(2, 2).format(v) : t + (spec.unit ? ' ' + spec.unit : '');
  }
  function assumptionByKey(m, key) { return D.ASSUMPTIONS.filter(function (a) { return a.model === m && a.key === key; })[0]; }
  var controlsModel = null;
  function buildControls() {
    var m = state.model;
    controlsModel = m;
    var groups = {}, order = [];
    C.INPUT_SPECS[m].forEach(function (s) { if (!groups[s.group]) { groups[s.group] = []; order.push(s.group); } groups[s.group].push(s); });
    document.getElementById('sim-controls').innerHTML = order.map(function (g) {
      return '<fieldset><legend>' + esc(g) + '</legend>' + groups[g].map(function (s) {
        var id = 'sim-' + m + '-' + s.key, a = assumptionByKey(m, s.key);
        var tip = a ? a.name + '\n' + a.logic.slice(0, 220) + (a.logic.length > 220 ? '…' : '') + '\nConfiança: ' + confOf(a.confidence).label : s.label;
        var unit = s.type === 'pct' ? '%' : s.type === 'brl' ? 'R$' : (s.unit || '');
        return '<div class="ctrl" data-key="' + s.key + '">' +
          '<div class="ctrl-top"><label for="' + id + '-num">' + esc(s.label) + '</label><button type="button" class="info-btn" data-tip="' + esc(tip) + '">' + icon('info') + '<span class="sr-only">Sobre esta premissa</span></button></div>' +
          '<div class="ctrl-inputs"><input type="range" id="' + id + '" min="' + s.min + '" max="' + s.max + '" step="' + s.step + '" value="' + C.toDisplay(m, s.key, state.inputs[m][s.key]) + '" aria-label="' + esc(s.label) + '" data-range="' + s.key + '">' +
          '<span class="num-wrap' + (s.type === 'brl' ? ' pre' : '') + '">' + (s.type === 'brl' ? '<span class="unit">R$</span>' : '') +
          '<input type="text" inputmode="decimal" autocomplete="off" id="' + id + '-num" value="' + displayValue(m, s.key) + '" data-num="' + s.key + '" aria-describedby="' + id + '-help">' +
          (s.type !== 'brl' ? '<span class="unit">' + esc(unit) + '</span>' : '') + '</span></div>' +
          '<div class="ctrl-foot" id="' + id + '-help"><span>Base do estudo: ' + baseDisplay(m, s.key) + '</span><span class="ctrl-msg" role="status"></span>' +
          '<button type="button" class="link-btn ctrl-reset" data-reset-key="' + s.key + '" hidden>' + icon('reset', 'ic-sm') + 'Restaurar</button></div></div>';
      }).join('') + '</fieldset>';
    }).join('');
    syncControls();
  }
  function syncControls(skipKey) {
    var m = state.model, base = D.BASE_INPUTS[m];
    if (controlsModel !== m) return;
    document.querySelectorAll('#sim-controls .ctrl').forEach(function (c) {
      var k = c.getAttribute('data-key');
      var changed = Math.abs(state.inputs[m][k] - base[k]) > 1e-12;
      c.classList.toggle('changed', changed);
      c.querySelector('[data-reset-key]').hidden = !changed;
      if (k === skipKey) return;
      c.querySelector('[data-range]').value = C.toDisplay(m, k, state.inputs[m][k]);
      c.querySelector('[data-num]').value = displayValue(m, k);
    });
  }
  function setInput(m, key, value) {
    var prev = state.inputs[m][key];
    if (Math.abs(prev - value) < 1e-12) return true;
    var trial = {};
    Object.keys(state.inputs[m]).forEach(function (k) { trial[k] = state.inputs[m][k]; });
    trial[key] = value;
    if (C.validateInputs(m, trial).length) return false;      // nunca aceita um cenário inválido
    var lc = state.lastChange;
    if (!lc || lc.m !== m || lc.key !== key) state.lastChange = { m: m, key: key, from: prev, before: { som: view(m).levels.som.total.valor } };
    state.inputs[m] = trial;                                  // novo objeto → invalida o cache de cálculo
    return true;
  }
  var simSig = '';
  function renderSimResults() {
    var m = state.model, M = model(), r = view(m), b = baseView(m), d = C.diff(r, b);
    var changed = C.changedInputs(m, state.inputs[m]), mod = changed.length > 0;
    var root = document.getElementById('sim-results');
    // Estrutura só é recriada quando muda o modelo, o conjunto de premissas alteradas ou o filtro;
    // durante o arraste apenas os números são atualizados (menos layout e pintura por quadro).
    var sig = [m, changed.join(','), state.segs[m].join(','), state.lastChange ? state.lastChange.key : ''].join('|');
    if (sig !== simSig || !root.querySelector('.sim-card')) {
      simSig = sig;
      root.innerHTML = '<div class="card sim-card"><div class="sim-status ' + (mod ? 'is-sim' : 'is-base') + '">' + icon(mod ? 'sliders' : 'check', 'ic-sm') +
        (mod ? 'Cenário simulado · ' + changed.length + (changed.length > 1 ? ' premissas alteradas' : ' premissa alterada') : 'Cenário-base (valores do estudo)') + '</div>' +
        (isFiltered(m) ? '<p class="fine">' + icon('filter', 'ic-sm') + ' Somente ' + esc(activeSegNames(m).join(' + ')) + ' (filtro do explorador).</p>' : '') +
        '<div data-sim="change"></div><p class="sr-only" aria-live="polite" data-sim="live"></p><ul class="sim-levels">' +
        LEVELS.map(function (l) {
          return '<li><div class="sl-head"><span class="lvl lvl-' + l + '">' + LEVEL_NAMES[l] + '</span><span>' + esc(M.levels[l].geo) + '</span></div>' +
            '<div class="sl-val"><span data-sim="val-' + l + '"></span><small>/ano</small></div>' +
            '<div class="sl-delta" data-sim="delta-' + l + '"><b></b><span></span></div>' +
            '<div class="sl-vol">' + icon('box', 'ic-sm') + '<span data-sim="vol-' + l + '"></span></div></li>';
        }).join('') + '</ul><div id="sim-chart" class="chart"></div>' +
        '<div class="sim-applied"><h3 class="h5">Premissas aplicadas</h3>' + (mod ? '<ul>' + changed.map(function (k) {
          var spec = C.getSpec(m, k);
          return '<li><span>' + esc(spec ? spec.label : k) + '</span><span><s>' + fmtInput(m, k, D.BASE_INPUTS[m][k]) + '</s> → <b data-sim-key-val="' + k + '"></b></span></li>';
        }).join('') + '</ul>' : '<p class="fine">Todas as premissas estão com os valores do documento.</p>') + '</div>' +
        '<button type="button" class="btn btn-primary btn-block" data-reset-model="' + m + '"' + (mod ? '' : ' disabled') + '>' + icon('reset') + ' Restaurar valores originais</button>' +
        '<p class="fine">O SOM continua sem taxa de captura. Cenários simulados são exploratórios e não substituem a validação das premissas.</p></div>';
    }
    var q = function (k) { return root.querySelector('[data-sim="' + k + '"]'); };
    q('change').innerHTML = lastChangeHTML(m);
    q('live').textContent = LEVELS.map(function (l) { return LEVEL_NAMES[l] + ' ' + brlMi(r.levels[l].total.valor); }).join(', ');
    LEVELS.forEach(function (l) {
      var t = r.levels[l].total, tb = b.levels[l].total, dd = d[l];
      q('val-' + l).textContent = brlMi(t.valor);
      var del = q('delta-' + l);
      del.className = 'sl-delta ' + (Math.abs(dd.valorAbs) < 0.5 ? 'flat' : dd.valorAbs > 0 ? 'up' : 'down');
      del.firstChild.textContent = F.signedPct(dd.valorRel);
      del.lastChild.textContent = F.signedMoney(dd.valorAbs) + ' vs. base (' + brlMi(tb.valor) + ')';
      q('vol-' + l).textContent = qty(t.volume) + ' ' + unitOf(m) + '/ano (' + F.signedPct(dd.volumeRel) + ')';
    });
    root.querySelectorAll('[data-sim-key-val]').forEach(function (e) { var k = e.getAttribute('data-sim-key-val'); e.textContent = fmtInput(m, k, state.inputs[m][k]); });
    var rows = [];
    LEVELS.forEach(function (l) {
      rows.push({ group: LEVEL_NAMES[l], label: 'Base', value: b.levels[l].total.valor, color: 'var(--base-bar)', valueText: brlMi(b.levels[l].total.valor), tip: LEVEL_NAMES[l] + ' · cenário-base\n' + brlMi(b.levels[l].total.valor) });
      rows.push({ group: LEVEL_NAMES[l], label: mod ? 'Simulado' : 'Atual', value: r.levels[l].total.valor, color: LEVEL_COLOR[l], valueText: brlMi(r.levels[l].total.valor), tip: LEVEL_NAMES[l] + ' · ' + (mod ? 'cenário simulado' : 'cenário atual') + '\n' + brlMi(r.levels[l].total.valor) });
    });
    updateBars(document.getElementById('sim-chart'), rows);
    var mini = document.getElementById('sim-mini');
    if (!mini.firstChild) mini.innerHTML = LEVELS.map(function (l) { return '<span><span class="lvl lvl-' + l + '">' + LEVEL_NAMES[l] + '</span><b></b><small></small></span>'; }).join('');
    LEVELS.forEach(function (l, k) {
      var cell = mini.children[k];
      cell.children[1].textContent = brlMi(r.levels[l].total.valor);
      cell.children[2].textContent = F.signedPct(d[l].valorRel);
      cell.children[2].className = d[l].valorAbs > 0.5 ? 'up' : d[l].valorAbs < -0.5 ? 'down' : '';
    });
  }
  /* Atualiza um gráfico de barras existente sem recriá-lo (mesma quantidade de barras) */
  function updateBars(el, rows) {
    var fills = el.querySelectorAll('.bar-fill');
    if (fills.length !== rows.length) { G.bars(el, { ariaLabel: 'Cenário-base versus simulado', rows: rows }); return; }
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([0]));
    var vals = el.querySelectorAll('.bar-value'), labels = el.querySelectorAll('.bar-label');
    rows.forEach(function (r, k) {
      var w = max > 0 ? r.value / max * 100 : 0;
      fills[k].style.width = (w > 0 && w < 0.6 ? 0.6 : w).toFixed(2) + '%';
      fills[k].style.background = r.color;
      fills[k].setAttribute('data-tip', r.tip);
      fills[k].setAttribute('aria-label', r.label + ': ' + r.valueText);
      vals[k].textContent = r.valueText;
      if (labels[k].firstChild) labels[k].firstChild.textContent = r.label;
    });
  }
  var bannerSig = '';
  function renderBanner() {
    var parts = ['b2c', 'b2b'].filter(isModified).map(function (m) { var n = C.changedInputs(m, state.inputs[m]).length; return D.MODELS[m].name + ': ' + n + (n > 1 ? ' premissas alteradas' : ' premissa alterada'); });
    var sig = parts.join('|');
    if (sig === bannerSig) return;                 // evita reflow quando nada mudou
    bannerSig = sig;
    var b = document.getElementById('sim-banner');
    b.hidden = !parts.length;
    document.getElementById('sim-banner-text').textContent = parts.length ? '— ' + parts.join(' · ') + '. Painel, gráficos e metodologia refletem o cenário simulado.' : '';
    document.documentElement.style.setProperty('--banner-h', parts.length ? b.offsetHeight + 'px' : '0px');
  }

  /* ================================================================ */
  /* Detalhamento (modal com fallback para navegadores sem <dialog>)   */
  /* ================================================================ */
  var lastFocus = null;
  function openDrill(m, l, useBase) {
    var M = D.MODELS[m], r = useBase ? BASE[m] : view(m), lvl = r.levels[l];
    var idx = LEVELS.indexOf(l);
    var levels = LEVELS.slice(0, idx + 1).map(function (x) { return x.toUpperCase(); });
    var segsN = useBase ? M.segments.map(function (s) { return s.name; }) : activeSegNames(m);
    var as = assumptionsFor(m, { levels: levels, segments: segsN });
    var toValidate = as.filter(function (a) { return a.status === 'validar'; });
    var ref = D.REFERENCE[m][l].total.valor;
    var segList = useBase ? M.segments : activeSegments(m);
    document.getElementById('drill-title').textContent = LEVEL_NAMES[l] + ' ' + M.name + ' · ' + M.levels[l].geo + ': ' + brlMi(lvl.total.valor) + '/ano';
    var savedSegs = state.segs[m];
    if (useBase) state.segs[m] = allSegs(m);
    var formula = formulaHTML(m, l, r);
    var filters = l === 'tam' ? '<p>Nenhum filtro: é o universo total do modelo (' + esc(M.levels.tam.geo) + ').</p>' :
      '<ol>' + funnelSteps(m, 'valor', r).filter(function (s) { return s.connector && LEVELS.indexOf(s.level) <= idx; }).map(function (s) { return '<li><b>' + esc(s.connector) + '</b> → ' + esc(s.label) + ': ' + s.valueText + ' (' + s.shareText + ')</li>'; }).join('') + '</ol>';
    state.segs[m] = savedSegs;
    var html = (useBase ? '<p class="drill-note">' + icon('info', 'ic-sm') + ' Valores do cenário-base (premissas do documento, todos os segmentos).</p>' :
      (isModified(m) ? '<p class="drill-note sim">' + icon('sliders', 'ic-sm') + ' Cenário simulado — valores diferentes do estudo original.</p>' : '') +
      (isFiltered(m) ? '<p class="drill-note sim">' + icon('filter', 'ic-sm') + ' Filtro ativo: somente ' + esc(activeSegNames(m).join(' + ')) + '.</p>' : '')) +
      '<section><h3>1. De onde vem o valor</h3><div class="table-scroll"><table class="drill-table"><thead><tr><th scope="col">Segmento</th><th scope="col">R$/ano</th><th scope="col">' + (m === 'b2c' ? 'Lavagens' : 'Kits') + '/ano</th><th scope="col">Participação</th></tr></thead><tbody>' +
      segList.map(function (s) { var x = lvl.segments[s.id]; return '<tr><th scope="row"><i class="dot" style="background:' + SEG_COLOR[s.id] + '"></i>' + esc(s.name) + '</th><td>' + brlMi(x.valor) + '</td><td>' + qty(x.volume) + '</td><td>' + pct1(ratio(x.valor, lvl.total.valor)) + '</td></tr>'; }).join('') +
      '<tr class="total"><th scope="row">Total</th><td>' + brlMi(lvl.total.valor) + '</td><td>' + qty(lvl.total.volume) + '</td><td>100%</td></tr></tbody></table></div>' +
      '<p class="fine">Valor publicado no PDF (todos os segmentos): ' + refText(ref) + '. Diferença do recálculo no cenário-base: ' + F.signedPct((BASE[m].levels[l].total.valor - ref) / ref, 2) + ' (arredondamento).</p></section>' +
      '<section><h3>2. Fórmula aplicada</h3>' + formula + '</section>' +
      '<section><h3>3. Premissas utilizadas</h3><ul class="drill-assump">' + as.map(function (a) { return '<li><span>' + esc(a.name) + ' <b>' + esc(a.value) + '</b></span>' + confMeter(a.confidence) + '</li>'; }).join('') + '</ul></section>' +
      '<section><h3>4. Filtros que reduziram o mercado</h3>' + filters + '</section>' +
      '<section><h3>5. Variáveis que ainda precisam ser validadas</h3>' + (toValidate.length ? '<ul class="drill-validate">' + toValidate.map(function (a) { return '<li>' + icon('alert', 'ic-sm') + '<span><b>' + esc(a.name) + '</b> — ' + esc(a.validation) + '</span></li>'; }).join('') + '</ul>' : '<p>Nenhuma.</p>') + '</section>' +
      '<div class="drill-actions"><button type="button" class="btn btn-sm btn-ghost" data-close-drill data-goto="premissas">Ver todas as premissas</button><button type="button" class="btn btn-sm btn-primary" data-close-drill data-goto-model="' + m + '" data-goto="simulador">Simular outras premissas</button></div>';
    document.getElementById('drill-body').innerHTML = html;
    var dlg = document.getElementById('drill');
    lastFocus = document.activeElement;
    var native = typeof dlg.showModal === 'function';
    try { if (native) { if (!dlg.open) dlg.showModal(); } else throw 0; }
    catch (e) { native = false; dlg.setAttribute('open', ''); dlg.classList.add('fallback'); document.getElementById('drill-backdrop').hidden = false; }
    document.documentElement.classList.add('modal-open');
    document.getElementById('drill-body').scrollTop = 0;
    document.getElementById('drill-close').focus();
  }
  function drillIsOpen() { return document.getElementById('drill').hasAttribute('open'); }
  function closeDrill(keepFocus) {
    var dlg = document.getElementById('drill');
    if (!drillIsOpen()) return;
    if (typeof dlg.close === 'function' && !dlg.classList.contains('fallback')) { try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); } }
    else dlg.removeAttribute('open');
    dlg.classList.remove('fallback');
    document.getElementById('drill-backdrop').hidden = true;
    document.documentElement.classList.remove('modal-open');
    if (!keepFocus && lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { lastFocus.focus(); } }
  }

  /* ================================================================ */
  /* CAGR                                                              */
  /* ================================================================ */
  function parseBR(s) {
    var t = String(s || '').trim().replace(/\s|R\$/g, '');
    if (!t) return NaN;
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    return /^-?\d*\.?\d+$/.test(t) ? parseFloat(t) : NaN;
  }
  function renderCagr() {
    var f = document.getElementById('cagr-form'), out = document.getElementById('cagr-out');
    var raw = [f.vi.value, f.vf.value, f.n.value];
    if (raw.every(function (x) { return !x.trim(); })) { out.innerHTML = '<p class="fine">Informe o valor inicial, o valor final e o número de anos para calcular a taxa.</p>'; return; }
    if (raw.some(function (x) { return !x.trim(); })) { out.innerHTML = '<p class="fine">Preencha os três campos.</p>'; return; }
    var vi = parseBR(raw[0]), vf = parseBR(raw[1]), n = parseBR(raw[2]);
    if ([vi, vf, n].some(isNaN)) { out.innerHTML = '<p class="err">' + icon('alert', 'ic-sm') + 'Use apenas números (ex.: 150.000 ou 150000,50).</p>'; return; }
    var r = C.cagr(vi, vf, n);
    if (!r.ok) { out.innerHTML = '<p class="err">' + icon('alert', 'ic-sm') + esc(r.error) + '</p>'; return; }
    var money = function (v) { return 'R$ ' + nf(2).format(v); };
    var nTxt = nf(2).format(n);
    var interp = r.rate >= 0
      ? 'Um valor que passa de ' + money(vi) + ' para ' + money(vf) + ' em ' + nTxt + ' ano(s) cresce, em média, <b>' + nf(2, 2).format(r.rate * 100) + '% ao ano</b> de forma composta (multiplicação total de ' + nf(2).format(r.multiple) + '×).'
      : 'Um valor que passa de ' + money(vi) + ' para ' + money(vf) + ' em ' + nTxt + ' ano(s) encolhe, em média, <b>' + nf(2, 2).format(Math.abs(r.rate) * 100) + '% ao ano</b> (retração composta).';
    out.innerHTML = '<div class="cagr-rate"><span>CAGR</span><strong>' + (r.rate >= 0 ? '' : '−') + nf(2, 2).format(Math.abs(r.rate) * 100) + '%</strong><small>ao ano · hipotético</small></div>' +
      '<p class="cagr-formula">(' + money(vf) + ' ÷ ' + money(vi) + ')<sup>1/' + nTxt + '</sup> − 1 = ' + nf(4).format(r.multiple) + '<sup>' + nf(4).format(1 / n) + '</sup> − 1 = ' + nf(2, 2).format(r.rate * 100) + '%</p>' +
      '<p>' + interp + '</p><div id="cagr-chart" class="chart"></div>' +
      '<p class="fine">' + icon('alert', 'ic-sm') + ' Entradas informadas pelo usuário — não são dados históricos nem projeções oficiais da WEEK.</p>';
    if (Math.abs(n - Math.round(n)) < 1e-9 && n >= 1 && n <= 50) {
      G.line(document.getElementById('cagr-chart'), {
        ariaLabel: 'Trajetória hipotética com CAGR constante',
        points: C.projectSeries(vi, r.rate, n).map(function (y, k) { return { x: k, y: y }; }),
        fmtX: function (x) { return 'Ano ' + x; },
        fmtY: function (y) { return y >= 1e6 ? 'R$ ' + nf(1).format(y / 1e6) + ' mi' : y >= 1e3 ? 'R$ ' + nf(1).format(y / 1e3) + ' mil' : 'R$ ' + nf(0).format(y); }
      });
    }
  }

  /* ================================================================ */
  /* Notas                                                             */
  /* ================================================================ */
  function renderNotes() {
    var html = D.NOTES.map(function (n) {
      var badge = n.model === 'ambos' ? '<span class="model-pill">B2C e B2B</span>' : '<span class="model-pill model-pill-' + n.model + '">' + n.model.toUpperCase() + '</span>';
      return '<article class="card note" id="nota-' + n.id + '">' + badge + '<h3 class="h5">' + esc(n.title) + '</h3><p>' + esc(n.text) + '</p></article>';
    }).join('');
    var diffs = [];
    ['b2c', 'b2b'].forEach(function (m) { C.reconcile(BASE[m]).filter(function (x) { return x.status !== 'confere'; }).forEach(function (x) { diffs.push({ m: m, x: x }); }); });
    html += '<article class="card note note-wide" id="nota-auditoria"><span class="model-pill">Auditoria</span><h3 class="h5">Diferenças encontradas ao recalcular o PDF</h3>' +
      '<p>O recálculo independente reproduziu todos os totais do documento. As diferenças abaixo vêm do arredondamento de valores intermediários no PDF (por exemplo, 254 mil pessoas e 1,55 mi viagens no SAM) e não alteram as conclusões. Os valores originais do PDF foram mantidos como referência.</p>' +
      (diffs.length ? '<ul class="diff-list">' + diffs.map(function (d) {
        return '<li><span class="model-pill model-pill-' + d.m + '">' + d.m.toUpperCase() + '</span> ' + LEVEL_NAMES[d.x.level] + ' · ' + esc(d.x.segment === 'total' ? 'Total' : segName(d.m, d.x.segment)) + ' · ' + METRIC_NAMES[d.x.metric] +
          ': PDF ' + refMetricText(d.x.metric, d.x.ref) + ' · recálculo ' + refMetricText(d.x.metric, d.x.calc) + ' (' + F.signedPct(d.x.diffRel, 2) + ')</li>';
      }).join('') + '</ul>' : '<p>Nenhuma diferença acima de 0,25%.</p>') + '</article>';
    document.getElementById('notes-grid').innerHTML = html;
    document.getElementById('conf-criteria').innerHTML = '<h3 class="h4">Critério de confiança (como definido no documento)</h3><div class="table-scroll"><table class="crit-table"><thead><tr><th scope="col">Nível</th><th scope="col">B2C</th><th scope="col">B2B</th></tr></thead><tbody>' +
      D.CONFIDENCE.map(function (c) { return '<tr><th scope="row">' + confMeter(c.id) + '</th><td>' + esc(c.b2c) + '</td><td>' + esc(c.b2b) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ================================================================ */
  /* Ações de estado                                                   */
  /* ================================================================ */
  function setModel(m) {
    if (!D.MODELS[m]) return;
    var changed = state.model !== m;
    state.model = m;
    document.querySelectorAll('[data-model-btn]').forEach(function (b) {
      var on = b.getAttribute('data-model-btn') === m;
      if (b.getAttribute('role') === 'tab') { b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; }
      else b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('[data-model-name]').forEach(function (s) { s.textContent = D.MODELS[m].name; });
    document.getElementById('painel-body').setAttribute('aria-labelledby', 'tab-' + m);
    document.body.setAttribute('data-model', m);
    if (changed) {
      if (state.sel && state.sel.kind === 'segment') state.sel = null;   // segmentos não existem no outro modelo
      if (!metricOk(m, state.metric)) state.metric = 'valor';
      buildControls();
    }
    invalidate();
  }
  function select(sel) {
    state.sel = sel;
    if (sel && sel.kind === 'level') state.circLevel = sel.id;
    renderNow('explorer');
  }
  function resetModel(m) {
    (m ? [m] : ['b2c', 'b2b']).forEach(function (x) { state.inputs[x] = C.baseInputs(x); });
    state.lastChange = null;
    syncControls();
    document.querySelectorAll('#sim-controls .ctrl-msg').forEach(function (e) { e.textContent = ''; });
    invalidate();
  }
  function toggleSeg(id) {
    var m = state.model, a = state.segs[m].slice(), k = a.indexOf(id);
    if (k >= 0) {
      if (a.length === 1) { flashMsg('Mantenha ao menos um segmento ativo.'); return; }
      a.splice(k, 1);
    } else {
      a.push(id);
      a = allSegs(m).filter(function (x) { return a.indexOf(x) >= 0; });   // ordem original
    }
    state.segs[m] = a;
    if (state.sel && state.sel.kind === 'segment' && a.indexOf(state.sel.id) < 0) state.sel = null;
    invalidate();
  }
  function clearExplorer() {
    state.segs[state.model] = allSegs(state.model);
    state.metric = 'valor'; state.sel = null; state.circMode = 'levels'; state.circLevel = 'tam';
    invalidate();
  }
  var msgTimer = 0;
  function flashMsg(t) {
    var el = document.getElementById('x-active');
    el.innerHTML = icon('alert', 'ic-sm') + ' <b>' + esc(t) + '</b>';
    clearTimeout(msgTimer); msgTimer = setTimeout(renderChips, 2200);
  }

  /* Rolagem interna segura (funciona também dentro de iframes/pré-visualizações) */
  function prefersReduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function flushAll() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    Object.keys(pending).forEach(function (p) { dirty[p] = true; delete pending[p]; });
    Object.keys(dirty).forEach(function (p) { renderNow(p); });
    renderBanner();
  }
  function scrollToId(id, focus) {
    var el = document.getElementById(id);
    if (!el) return;
    flushAll();   // conteúdo adiado é desenhado antes de medir, para não deslocar o destino durante a rolagem
    var offset = document.querySelector('.nav').offsetHeight + 10;
    var top = el.getBoundingClientRect().top + window.pageYOffset - offset;
    try { window.scrollTo({ top: Math.max(0, top), behavior: prefersReduced() ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, Math.max(0, top)); }
    if (focus !== false && el.hasAttribute('tabindex')) { try { el.focus({ preventScroll: true }); } catch (e) { /* navegadores antigos */ } }
    try { if (history.replaceState) history.replaceState(null, '', '#' + id); } catch (e) { /* sandbox: ignora */ }
    setActiveNav(id);
  }

  /* ================================================================ */
  /* Eventos (delegados, registrados uma única vez)                    */
  /* ================================================================ */
  function bindEvents() {
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target : (e.target && e.target.parentNode);
      if (!t || !t.closest) return;
      var el;

      // Links internos: interceptados para não navegar o documento (iframes/sandbox)
      if ((el = t.closest('a[href^="#"]'))) {
        var id = el.getAttribute('href').slice(1);
        if (id && document.getElementById(id)) {
          e.preventDefault();
          toggleMenu(false);
          if (el.hasAttribute('data-goto-model')) setModel(el.getAttribute('data-goto-model'));
          scrollToId(id);
        }
        return;
      }
      if ((el = t.closest('[data-drill]'))) {
        if (t.closest('.info-btn')) return;           // o ícone de informação dentro do card só mostra a dica
        var p = el.getAttribute('data-drill').split(':');
        openDrill(p[0], p[1], p[2] === 'base');
        return;
      }
      if ((el = t.closest('[data-close-drill]'))) {
        closeDrill(true);
        if (el.hasAttribute('data-goto-model')) setModel(el.getAttribute('data-goto-model'));
        if (el.hasAttribute('data-goto')) scrollToId(el.getAttribute('data-goto'));
        return;
      }
      if ((el = t.closest('[data-goto-model]'))) { setModel(el.getAttribute('data-goto-model')); if (el.hasAttribute('data-goto')) scrollToId(el.getAttribute('data-goto')); return; }
      if ((el = t.closest('[data-goto]'))) { scrollToId(el.getAttribute('data-goto')); return; }
      if ((el = t.closest('[data-model-btn]'))) { setModel(el.getAttribute('data-model-btn')); return; }

      // Explorador
      if ((el = t.closest('[data-select-level]'))) { select({ kind: 'level', id: el.getAttribute('data-select-level') }); return; }
      if ((el = t.closest('[data-select-seg]'))) { select({ kind: 'segment', id: el.getAttribute('data-select-seg') }); return; }
      if ((el = t.closest('.def-card'))) { select({ kind: 'level', id: el.getAttribute('data-level') }); scrollToId('x-funnel-title', false); return; }
      if ((el = t.closest('[data-x-back]'))) { select(null); return; }
      if ((el = t.closest('[data-seg-chip]'))) { toggleSeg(el.getAttribute('data-seg-chip')); return; }
      if ((el = t.closest('[data-clear-segs]'))) { state.segs[state.model] = allSegs(state.model); invalidate(); return; }
      if ((el = t.closest('[data-x-metric]'))) { state.metric = el.getAttribute('data-x-metric'); renderNow('explorer'); return; }
      if ((el = t.closest('[data-circ-mode]'))) { state.circMode = el.getAttribute('data-circ-mode'); renderNow('explorer'); return; }
      if ((el = t.closest('[data-circ-level]'))) { state.circLevel = el.getAttribute('data-circ-level'); if (state.sel && state.sel.kind === 'level') state.sel = { kind: 'level', id: state.circLevel }; renderNow('explorer'); return; }
      if ((el = t.closest('[data-compare-toggle]'))) { state.compare = !state.compare; renderNow('explorer'); if (state.compare) scrollToId('x-compare', false); return; }
      if ((el = t.closest('#x-clear'))) { clearExplorer(); return; }
      if ((el = t.closest('[data-guide]'))) {
        var g = el.getAttribute('data-guide');
        if (g === 'sim') { scrollToId('simulador'); return; }
        if (g === 'cmp') { state.compare = true; renderNow('explorer'); scrollToId('x-compare', false); return; }
        select({ kind: 'level', id: g });
        return;
      }
      if ((el = t.closest('[data-open-how]'))) {
        var pid = 'how-' + el.getAttribute('data-open-how');
        openHow[pid] = true;
        renderNow('calc');
        scrollToId('seg-' + el.getAttribute('data-open-how'), false);
        return;
      }

      // Painel
      if ((el = t.closest('[data-seg-level]'))) { state.segLevel = el.getAttribute('data-seg-level'); renderSegmentChart(); return; }
      if ((el = t.closest('[data-seg-metric]'))) { state.segMetric = el.getAttribute('data-seg-metric'); renderSegmentChart(); return; }
      if ((el = t.closest('#audit summary'))) { setTimeout(function () { if (document.getElementById('audit-body').dataset.stale) renderAudit(); }, 0); return; }

      // Metodologia
      if ((el = t.closest('.how-btn'))) {
        var panel = document.getElementById(el.getAttribute('aria-controls'));
        var open = el.getAttribute('aria-expanded') !== 'true';
        el.setAttribute('aria-expanded', open ? 'true' : 'false');
        panel.hidden = !open;
        openHow[panel.id] = open;
        return;
      }
      // Filtros passo a passo
      if ((el = t.closest('[data-fstep]'))) {
        var m = state.model, steps = funnelChartSteps(m).length, cur = Math.min(state.filterStep[m], steps - 1), a = el.getAttribute('data-fstep');
        state.filterStep[m] = a === 'prev' ? Math.max(0, cur - 1) : a === 'next' ? Math.min(steps - 1, cur + 1) : (cur >= steps - 1 ? 0 : steps - 1);
        renderNow('filters');
        var again = document.querySelector('[data-fstep="' + a + '"]');
        if (again && !again.disabled) again.focus(); else { var nx = document.querySelector('[data-fstep="next"]'); (nx && !nx.disabled ? nx : document.querySelector('[data-fstep="all"]')).focus(); }
        return;
      }
      // Simulador
      if ((el = t.closest('[data-reset-model]'))) { resetModel(el.getAttribute('data-reset-model') || null); return; }
      if ((el = t.closest('[data-reset-key]'))) {
        var k = el.getAttribute('data-reset-key');
        setInput(state.model, k, D.BASE_INPUTS[state.model][k]);
        var msg = el.parentNode.querySelector('.ctrl-msg'); if (msg) msg.textContent = '';
        syncControls(); invalidate();
        var inp = document.querySelector('[data-num="' + k + '"]'); if (inp) inp.focus();
        return;
      }
      if ((el = t.closest('[data-sim-key]'))) {
        var pk = el.getAttribute('data-sim-key').split(':');
        setModel(pk[0]);
        scrollToId('simulador', false);
        setTimeout(function () {
          var target = document.querySelector('[data-num="' + pk[1] + '"]');
          if (!target) return;
          try { target.focus({ preventScroll: true }); } catch (err) { target.focus(); }
          var ctrl = target.closest('.ctrl'); ctrl.classList.add('flash'); setTimeout(function () { ctrl.classList.remove('flash'); }, 1600);
        }, prefersReduced() ? 0 : 450);
        return;
      }
      // Premissas
      if ((el = t.closest('[data-focus-assump]'))) {
        document.getElementById('assump-filters').reset(); applyAssumptionFilters();
        var row = document.getElementById('as-' + el.getAttribute('data-focus-assump'));
        if (row) { scrollToId(row.id, false); row.classList.add('flash'); setTimeout(function () { row.classList.remove('flash'); }, 1800); }
        return;
      }
      if ((el = t.closest('[data-clear-filters], #assump-clear'))) { document.getElementById('assump-filters').reset(); applyAssumptionFilters(); return; }
      // Diálogo e menu
      if ((el = t.closest('#drill-close'))) { closeDrill(); return; }
      if (t === document.getElementById('drill') || t === document.getElementById('drill-backdrop')) { closeDrill(); return; }
      if ((el = t.closest('#menu-btn'))) { toggleMenu(); return; }
      // CAGR
      if ((el = t.closest('#cagr-example'))) { var cf = document.getElementById('cagr-form'); cf.vi.value = '100.000'; cf.vf.value = '150.000'; cf.n.value = '5'; renderCagr(); return; }
      if ((el = t.closest('#cagr-clear'))) { document.getElementById('cagr-form').reset(); renderCagr(); return; }
      // Fecha o menu móvel ao tocar fora dele
      if (!t.closest('#nav-links')) toggleMenu(false);
    });

    // Teclado: SVG com role=button e abas
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.getAttribute('role') === 'button' && e.target.tagName.toLowerCase() === 'g') {
        e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
      if (e.key === 'Escape') { if (drillIsOpen()) closeDrill(); toggleMenu(false); }
    });
    document.querySelector('.model-tabs[role="tablist"]').addEventListener('keydown', function (e) {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
      e.preventDefault();
      var next = state.model === 'b2c' ? 'b2b' : 'b2c';
      if (e.key === 'Home') next = 'b2c'; if (e.key === 'End') next = 'b2b';
      setModel(next);
      document.getElementById('tab-' + next).focus();
    });

    // Simulador: arrastar atualiza o resultado do simulador a cada quadro; o resto da página, ao soltar
    var sc = document.getElementById('sim-controls');
    sc.addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-range');
      if (!k) return;
      var m = state.model, p = C.parseUserValue(m, k, e.target.value);
      if (p.ok && setInput(m, k, p.value)) {
        var ctrl = e.target.closest('.ctrl');
        ctrl.querySelector('[data-num]').value = displayValue(m, k);
        ctrl.querySelector('.ctrl-msg').textContent = '';
        syncControls(k);
        invalidateSoon(['sim']);
      }
    });
    sc.addEventListener('change', function (e) {
      if (e.target.hasAttribute('data-range')) { clearTimeout(fullTimer); invalidate(); }
      if (e.target.hasAttribute('data-num')) commitNum(e.target);
    });
    sc.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.hasAttribute('data-num')) { e.preventDefault(); commitNum(e.target); } });
    function commitNum(input) {
      var k = input.getAttribute('data-num'); if (!k) return;
      var m = state.model, ctrl = input.closest('.ctrl'), msg = ctrl.querySelector('.ctrl-msg');
      var p = C.parseUserValue(m, k, input.value);
      if (!p.ok) { msg.textContent = p.error + ' Valor mantido.'; ctrl.classList.add('invalid'); input.value = displayValue(m, k); return; }
      ctrl.classList.remove('invalid');
      if (!setInput(m, k, p.value)) { msg.textContent = 'Valor inválido. Valor mantido.'; input.value = displayValue(m, k); return; }
      msg.textContent = p.note || '';
      syncControls(); invalidate();
    }

    var af = document.getElementById('assump-filters');
    af.addEventListener('input', applyAssumptionFilters);
    af.addEventListener('change', applyAssumptionFilters);
    af.addEventListener('submit', function (e) { e.preventDefault(); });
    document.getElementById('sim-controls').addEventListener('submit', function (e) { e.preventDefault(); });
    var cfm = document.getElementById('cagr-form');
    cfm.addEventListener('input', renderCagr);
    cfm.addEventListener('submit', function (e) { e.preventDefault(); });

    var dlg = document.getElementById('drill');
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); closeDrill(); });

    var rt = 0;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { bannerSig = '~'; renderBanner(); invalidate(['explorer']); if (window.innerWidth > 1060) toggleMenu(false); }, 150); });
  }

  function toggleMenu(force) {
    var nav = document.getElementById('nav-links'), btn = document.getElementById('menu-btn');
    var open = force === undefined ? !nav.classList.contains('open') : force;
    if (open === nav.classList.contains('open')) return;
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Fechar menu de seções' : 'Abrir menu de seções');
  }

  var navLinks = {};
  function setActiveNav(id) {
    if (!navLinks[id]) return;
    Object.keys(navLinks).forEach(function (k) { navLinks[k].removeAttribute('aria-current'); });
    navLinks[id].setAttribute('aria-current', 'true');
  }
  function observeSections() {
    document.querySelectorAll('#nav-links a').forEach(function (a) { navLinks[a.getAttribute('href').slice(1)] = a; });
    if (!('IntersectionObserver' in window)) { Object.keys(PARTS).forEach(function (p) { nearView[PARTS[p].el] = true; }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) setActiveNav(en.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(navLinks).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
    // Renderização preguiçosa: partes fora da tela só são desenhadas quando se aproximam
    var lazy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        nearView[en.target.id] = en.isIntersecting;
        if (en.isIntersecting) Object.keys(PARTS).forEach(function (p) { if (PARTS[p].el === en.target.id && dirty[p]) renderNow(p); });
      });
    }, { rootMargin: '900px 0px 900px 0px' });
    Object.keys(PARTS).forEach(function (p) { var s = document.getElementById(PARTS[p].el); if (s) lazy.observe(s); });
  }

  function init() {
    renderExec();
    fillFilterOptions();
    renderPriority();
    buildAssumptionRows();
    applyAssumptionFilters();
    renderNotes();
    renderCagr();
    bindEvents();
    G.initTooltips();
    buildControls();
    setModel('b2c');
    Object.keys(PARTS).forEach(function (p) { renderNow(p); });   // primeira pintura completa
    renderBanner();
    observeSections();
    if (location.hash && location.hash.length > 1 && document.getElementById(location.hash.slice(1))) setTimeout(function () { scrollToId(location.hash.slice(1), false); }, 60);
  }

  try { init(); }
  catch (err) {
    reportError(err);
    document.body.insertAdjacentHTML('afterbegin', '<div class="noscript">Ocorreu um erro ao montar a plataforma: ' + esc(err.message) + '</div>');
  }
})();
