/*
 * app.js — Camada de interface. Lê dados (WeekData), calcula (WeekCalc),
 * formata (WeekFormat) e desenha (WeekCharts). Nenhuma fórmula de mercado
 * vive aqui: todo número exibido vem de WeekCalc.compute().
 */
(function () {
  'use strict';

  var D = window.WeekData, C = window.WeekCalc, F = window.WeekFormat, G = window.WeekCharts;
  if (!D || !C || !F || !G) { document.body.insertAdjacentHTML('afterbegin', '<div class="noscript">Erro ao carregar os módulos da plataforma. Verifique se a pasta js/ está completa.</div>'); return; }
  var esc = G.esc;

  /* ================================================================ */
  /* Estado                                                            */
  /* ================================================================ */
  var state = {
    model: 'b2c',
    inputs: { b2c: C.baseInputs('b2c'), b2b: C.baseInputs('b2b') },
    conceptLevel: 'tam',
    segLevel: 'tam',
    segMetric: 'valor',
    filterStep: { b2c: 0, b2b: 0 }
  };
  var BASE = { b2c: C.compute('b2c'), b2b: C.compute('b2b') };
  var LEVEL_NAMES = { tam: 'TAM', sam: 'SAM', som: 'SOM' };
  var LEVEL_LONG = { tam: 'Total Addressable Market', sam: 'Serviceable Available Market', som: 'Serviceable Obtainable Market' };
  var LEVEL_COLOR = { tam: 'var(--l1)', sam: 'var(--l2)', som: 'var(--l3)' };
  var SEG_COLOR = { academia: 'var(--s1)', trabalho: 'var(--s2)', viagem: 'var(--s3)', academias: 'var(--s1)', hoteis: 'var(--s2)' };
  var MODEL_COLOR = { b2c: 'var(--l1)', b2b: 'var(--s2)' };

  function result(model) {
    var r = C.compute(model, state.inputs[model]);
    return r.valid ? r : BASE[model];
  }
  function isModified(model) { return C.changedInputs(model, state.inputs[model]).length > 0; }
  function model() { return D.MODELS[state.model]; }

  /* ================================================================ */
  /* Formatação (apenas apresentação)                                  */
  /* ================================================================ */
  var nfCache = {};
  function nf(maxD, minD) {
    var k = (minD || 0) + ':' + maxD;
    if (!nfCache[k]) nfCache[k] = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: minD || 0, maximumFractionDigits: maxD });
    return nfCache[k];
  }
  /* Quantidade: 13 mi · 2,6 mi · 201,4 mil · 3.217 */
  function qty(v) {
    var a = Math.abs(v);
    if (a >= 1e9) return nf(2).format(v / 1e9) + ' bi';
    if (a >= 1e6) return nf(a >= 1e8 ? 1 : 2).format(v / 1e6) + ' mi';
    if (a >= 1e4) return nf(a >= 1e5 ? 1 : 2).format(v / 1e3) + ' mil';
    if (a >= 100) return nf(0).format(v);
    return nf(2).format(v);
  }
  /* Dinheiro sempre em milhões, como no PDF: R$ 1.896,3 mi · R$ 5,61 mi */
  function brlMi(v) {
    var a = Math.abs(v) / 1e6;
    var d = a >= 10 ? 1 : 2;
    return (v < 0 ? '−' : '') + 'R$ ' + nf(d, d).format(a) + ' mi';
  }
  function pctS(v) { return nf(2).format(v * 100) + '%'; }
  function pct1(v) { return nf(1, 1).format(v * 100) + '%'; }
  function shareText(v) { return v >= 0.1 ? nf(1).format(v * 100) + '%' : v >= 0.001 ? nf(2).format(v * 100) + '%' : '< 0,1%'; }

  function fmtInput(modelId, key, v) {
    var spec = C.getSpec(modelId, key);
    if (key === 'preco') return F.brl(v);
    if (spec && spec.type === 'pct') return pctS(v);
    if (/^(pct|peso|fator|ocupacao)/.test(key)) return pctS(v);
    return qty(v);
  }

  function unitOf(m) { return m === 'b2c' ? 'lavagens' : 'kits'; }
  function peopleUnit(m) { return m === 'b2c' ? 'pessoas/viagens' : 'pessoas atingidas'; }

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
      return true;
    });
  }
  function segNameToDataName(m, segId) {
    var s = D.MODELS[m].segments.filter(function (x) { return x.id === segId; })[0];
    return s ? s.name : segId;
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
        '<div><dt>Segmentos</dt><dd>' + M.segments.map(function (s) { return esc(s.name); }).join(' · ') + '</dd></div></dl>' +
        '<ul class="exec-levels">';
      C.LEVELS.forEach(function (l) {
        var ref = R[l].total.valor, calc = B.levels[l].total.valor;
        html += '<li><button type="button" class="exec-level" data-drill="' + m + ':' + l + ':base">' +
          '<span class="lvl lvl-' + l + '">' + LEVEL_NAMES[l] + '</span>' +
          '<span class="exec-geo">' + esc(M.levels[l].geo) + '</span>' +
          '<span class="exec-val">' + refText(ref) + '<small>/ano</small></span>' +
          '<span class="exec-check" title="Recalculado pela plataforma com precisão total">' + icon('check', 'ic-xs') + 'recálculo: ' + brlMi(calc) + '</span>' +
          '</button></li>';
      });
      html += '</ul><button type="button" class="btn btn-sm btn-ghost" data-goto-model="' + m + '">Ver ' + M.name + ' no painel ' + icon('arrow') + '</button></article>';
    });
    document.getElementById('exec-grid').innerHTML = html;
  }

  /* ================================================================ */
  /* 2. Conceitos                                                      */
  /* ================================================================ */
  var CONCEPT_EXAMPLE = {
    b2c: {
      tam: function (i) { return 'Todas as ocasiões de banho fora de casa no Brasil — na academia, no trabalho e em viagens com pernoite — multiplicadas pelo preço de ' + F.brl(i.preco) + ' por lavagem.'; },
      sam: function () { return 'Desse total, entram só os moradores do Sudeste, das classes A e B (público que paga por um kit premium) e que compram pela internet — o público que o e-commerce da WEEK consegue atender agora.'; },
      som: function () { return 'O recorte do SAM no estado de São Paulo, onde a WEEK começa. A taxa de captura (quanto desse público a WEEK de fato conquista) ainda será aplicada.'; }
    },
    b2b: {
      tam: function (i) { return 'Todos os kits que as academias e os quartos de hospedagem do Sudeste usariam em um ano, ao preço B2B de ' + F.brl(i.preco) + ' por kit.'; },
      sam: function () { return 'Somente academias com perfil premium e hotéis (incluindo flats, hotéis-fazenda e resorts) do estado de São Paulo.'; },
      som: function () { return 'Os estabelecimentos do SAM localizados em Campinas — o ponto de partida comercial do B2B. A taxa de captura ainda será aplicada.'; }
    }
  };
  function renderConcept() {
    var m = state.model, M = model(), r = result(m), l = state.conceptLevel;
    C.LEVELS.forEach(function (x) { document.getElementById('ring-geo-' + x).textContent = M.levels[x].geo; });
    document.querySelectorAll('#rings .ring, .def-card').forEach(function (b) {
      var on = b.getAttribute('data-level') === l;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('active', on);
    });
    var v = r.levels[l].total.valor, tam = r.levels.tam.total.valor;
    var prev = l === 'tam' ? null : r.levels[l === 'sam' ? 'tam' : 'sam'].total.valor;
    var def = {
      tam: 'Mercado total potencial: todo o universo definido para o produto, sem filtros de público ou canal.',
      sam: 'Parte do TAM que a empresa consegue atender, dados o recorte geográfico, o perfil do público e o canal de venda.',
      som: 'Recorte geográfico e operacional usado para estimar o mercado acessível no início. Neste estudo, ainda sem taxa efetiva de captura comercial.'
    }[l];
    document.getElementById('concept-detail').innerHTML =
      '<p class="concept-kicker"><span class="lvl lvl-' + l + '">' + LEVEL_NAMES[l] + '</span> ' + LEVEL_LONG[l] + '</p>' +
      '<p class="concept-def">' + def + '</p>' +
      '<div class="concept-week"><h3 class="h5">Na WEEK · ' + M.name + ' (' + esc(M.title.toLowerCase()) + ')</h3>' +
      '<p>' + esc(CONCEPT_EXAMPLE[m][l](state.inputs[m])) + '</p>' +
      '<dl class="concept-stats">' +
      '<div><dt>Recorte</dt><dd>' + esc(M.levels[l].geo) + '</dd></div>' +
      '<div><dt>Valor anual</dt><dd>' + brlMi(v) + '</dd></div>' +
      '<div><dt>% do TAM</dt><dd>' + shareText(v / tam) + '</dd></div>' +
      (prev ? '<div><dt>% do nível anterior</dt><dd>' + shareText(v / prev) + '</dd></div>' : '') +
      '</dl><p class="fine">' + icon('filter', 'ic-sm') + ' ' + esc(M.levels[l].filter) + '</p></div>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-drill="' + m + ':' + l + '">Como chegamos a esse número? ' + icon('arrow') + '</button>';
  }

  /* ================================================================ */
  /* 3/4. Painel                                                       */
  /* ================================================================ */
  function renderModelStrip() {
    var M = model();
    document.getElementById('model-strip').innerHTML =
      '<div><span>Quem compra</span><strong>' + esc(M.buyer) + '</strong></div>' +
      '<div><span>Canal</span><strong>' + esc(M.channel) + '</strong></div>' +
      '<div><span>Preço de referência</span><strong>' + esc(M.priceLabel) + '</strong></div>' +
      '<div><span>Segmentos</span><strong>' + M.segments.map(function (s) { return '<i class="dot" style="background:' + SEG_COLOR[s.id] + '"></i>' + esc(s.name); }).join(' ') + '</strong></div>' +
      '<div><span>Recortes</span><strong>' + C.LEVELS.map(function (l) { return LEVEL_NAMES[l] + ' ' + esc(M.levels[l].geo); }).join(' → ') + '</strong></div>';
  }

  function renderKpis() {
    var m = state.model, M = model(), r = result(m), b = BASE[m], mod = isModified(m);
    var html = '';
    C.LEVELS.forEach(function (l) {
      var t = r.levels[l].total, tb = b.levels[l].total;
      var tipText = {
        tam: 'TAM — mercado total\nUniverso: ' + M.levels.tam.geo + '. ' + M.levels.tam.filter + '.',
        sam: 'SAM — mercado atendível\n' + M.levels.sam.filter + '.',
        som: 'SOM — mercado de entrada\n' + M.levels.som.filter + '.'
      }[l];
      html += '<button type="button" class="kpi card" data-drill="' + m + ':' + l + '" aria-label="' + LEVEL_NAMES[l] + ' ' + esc(M.levels[l].geo) + ': ' + brlMi(t.valor) + ' por ano. Ver detalhes do cálculo.">' +
        '<span class="kpi-top"><span class="lvl lvl-' + l + '">' + LEVEL_NAMES[l] + '</span><span class="kpi-geo">' + esc(M.levels[l].geo) + '</span>' +
        '<span class="info-btn info-inline" data-tip="' + esc(tipText) + '">' + icon('info') + '</span></span>' +
        '<span class="kpi-val">' + brlMi(t.valor) + '<small>/ano</small></span>' +
        (mod ? '<span class="kpi-base">Base do estudo: ' + brlMi(tb.valor) + ' · <b class="' + (t.valor >= tb.valor ? 'up' : 'down') + '">' + F.signedPct(tb.valor ? (t.valor - tb.valor) / tb.valor : 0) + '</b></span>' : '<span class="kpi-base">' + (l === 'tam' ? 'Universo total do modelo' : shareText(t.valor / r.levels.tam.total.valor) + ' do TAM') + '</span>') +
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
    notes.push('<strong>SOM sem taxa de captura:</strong> o SOM é o recorte “' + esc(model().levels.som.geo) + '” antes de aplicar a fatia de mercado que a WEEK conseguirá conquistar — não é previsão de vendas.');
    document.getElementById('kpi-notes').innerHTML = notes.map(function (n) { return '<p>' + icon('info', 'ic-sm') + '<span>' + n + '</span></p>'; }).join('');
  }

  function renderLevelChart() {
    var m = state.model, M = model(), r = result(m);
    var tam = r.levels.tam.total.valor;
    G.bars(document.getElementById('chart-levels'), {
      ariaLabel: 'TAM, SAM e SOM em reais por ano',
      rows: C.LEVELS.map(function (l) {
        var t = r.levels[l].total;
        return { label: LEVEL_NAMES[l], sub: M.levels[l].geo, value: t.valor, color: LEVEL_COLOR[l], valueText: brlMi(t.valor),
          tip: LEVEL_NAMES[l] + ' · ' + M.levels[l].geo + '\n' + brlMi(t.valor) + ' por ano\n' + qty(t.volume) + ' ' + unitOf(m) + '/ano\n' + shareText(t.valor / tam) + ' do TAM' };
      }),
      table: { caption: 'TAM, SAM e SOM', head: ['Nível', 'Recorte', 'R$/ano', unitOf(m) + '/ano', '% do TAM'],
        rows: C.LEVELS.map(function (l) { var t = r.levels[l].total; return [LEVEL_NAMES[l], M.levels[l].geo, brlMi(t.valor), qty(t.volume), shareText(t.valor / tam)]; }) }
    });
  }

  /* Etapas do funil (progressivo) por modelo — usadas no painel e na seção de filtros */
  function funnelSteps(m) {
    var r = result(m), i = r.inputs, M = D.MODELS[m];
    var tam = r.levels.tam.total.valor;
    var steps = [];
    function step(label, sub, value, color, connector, extra) {
      steps.push({ label: label, sub: sub, value: value, share: tam ? value / tam : 0, color: color, connector: connector,
        valueText: brlMi(value), shareText: shareText(tam ? value / tam : 0) + ' do TAM',
        tip: label + '\n' + brlMi(value) + ' por ano\n' + shareText(tam ? value / tam : 0) + ' do TAM' + (extra ? '\n' + extra : '') });
    }
    if (m === 'b2c') {
      step('TAM · Brasil', 'Academia + trabalho + viagem', tam, LEVEL_COLOR.tam);
      step('Moradores do Sudeste', 'Peso populacional', tam * i.pesoSudeste, 'var(--l1b)', '× ' + pctS(i.pesoSudeste) + ' peso do Sudeste');
      step('Classes A e B do Sudeste', 'Público que paga por premium', tam * i.pesoSudeste * i.pctClassesAB, 'var(--l2b)', '× ' + pctS(i.pctClassesAB) + ' classes A e B');
      step('SAM · Sudeste', 'A/B que compram online', r.levels.sam.total.valor, LEVEL_COLOR.sam, '× ' + pctS(i.pctOnline) + ' compram online', 'Fator do SAM: ' + pctS(r.factorSummary.sam));
      step('SOM · Estado de SP', 'Recorte geográfico de entrada', r.levels.som.total.valor, LEVEL_COLOR.som, '× ' + pctS(i.pesoSP) + ' peso de SP no Sudeste', 'Ainda sem taxa de captura');
    } else {
      var t = r.levels.tam.segments;
      var sp = t.academias.valor * i.pesoSPAcademias + t.hoteis.valor * i.pesoSPQuartos;
      step('TAM · Sudeste', 'Academias + hotéis', tam, LEVEL_COLOR.tam);
      step('Estabelecimentos no estado de SP', 'Peso geográfico por segmento', sp, 'var(--l1b)', '× ' + pctS(i.pesoSPAcademias) + ' (academias) · × ' + pctS(i.pesoSPQuartos) + ' (quartos)');
      step('SAM · Estado de SP', 'Academias premium + hotéis', r.levels.sam.total.valor, LEVEL_COLOR.sam, '× ' + pctS(i.pctPremium) + ' premium · × ' + pctS(i.pctHoteis) + ' quartos de hotéis');
      step('SOM · Campinas', 'Recorte geográfico de entrada', r.levels.som.total.valor, LEVEL_COLOR.som, '× ' + pctS(i.fatorCampinasAcademias) + ' (academias) · × ' + pctS(i.fatorCampinasHoteis) + ' (hotéis)', 'Ainda sem taxa de captura');
    }
    return steps;
  }
  function funnelTable(steps) {
    return { caption: 'Funil de refinamento', head: ['Etapa', 'Filtro aplicado', 'R$/ano', '% do TAM'],
      rows: steps.map(function (s) { return [s.label, s.connector || '—', s.valueText, shareText(s.share)]; }) };
  }
  function renderFunnelChart() {
    var steps = funnelSteps(state.model);
    G.funnel(document.getElementById('chart-funnel'), { steps: steps, minWidth: 6, note: 'Barras muito estreitas são exibidas com largura mínima para continuarem visíveis; o percentual indica a proporção real.', table: funnelTable(steps) });
  }

  var METRIC_LABEL = { valor: 'R$/ano', volume: 'volume/ano', pessoas: 'público', estabelecimentos: 'estabelecimentos' };
  function metricText(m, metric, v, segId) {
    if (metric === 'valor') return brlMi(v);
    if (metric === 'volume') return qty(v) + ' ' + unitOf(m);
    if (metric === 'estabelecimentos') return nf(0).format(Math.round(v));
    var unit = m === 'b2c' ? (segId === 'viagem' ? 'viagens' : 'pessoas') : (segId === 'hoteis' ? 'quartos ocupados/noite' : 'usuários');
    return qty(v) + ' ' + unit;
  }
  function renderSegmentChart() {
    var m = state.model, M = model(), r = result(m), l = state.segLevel, metric = state.segMetric;
    if (m === 'b2c' && metric === 'estabelecimentos') metric = state.segMetric = 'valor';
    var lvl = r.levels[l];
    document.querySelectorAll('[data-seg-level]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-seg-level') === l ? 'true' : 'false'); });
    document.querySelectorAll('[data-seg-metric]').forEach(function (b) {
      var k = b.getAttribute('data-seg-metric');
      b.setAttribute('aria-pressed', k === metric ? 'true' : 'false');
      if (k === 'estabelecimentos') b.hidden = m !== 'b2b';
      if (k === 'volume') b.textContent = (m === 'b2c' ? 'Lavagens' : 'Kits') + '/ano';
    });
    var rows = M.segments.map(function (s) {
      var seg = lvl.segments[s.id], v = seg[metric];
      var share = lvl.total[metric] ? v / lvl.total[metric] : 0;
      return { label: s.name, sub: shareText(share) + ' do ' + LEVEL_NAMES[l], value: v, color: SEG_COLOR[s.id], valueText: metricText(m, metric, v, s.id),
        tip: s.name + ' · ' + LEVEL_NAMES[l] + ' ' + M.levels[l].geo + '\n' + brlMi(seg.valor) + ' por ano\n' + qty(seg.volume) + ' ' + unitOf(m) + '/ano\n' + metricText(m, 'pessoas', seg.pessoas, s.id) };
    });
    var note = metric === 'pessoas' ? (m === 'b2c' ? 'Unidades diferentes: Viagem conta viagens; academia e trabalho contam pessoas (com possível sobreposição).' : 'Unidades diferentes: academias contam usuários; hotéis contam quartos ocupados por noite (1 hóspede por quarto).') :
      metric === 'estabelecimentos' ? 'Hotéis do SAM e do SOM são contagens do Cadastur; academias são estimadas pelos fatores de SP, premium e Campinas.' : '';
    G.bars(document.getElementById('chart-segments'), {
      ariaLabel: 'Mercado por segmento — ' + LEVEL_NAMES[l] + ', ' + METRIC_LABEL[metric], rows: rows,
      table: { caption: 'Mercado por segmento', head: ['Segmento', 'R$/ano', unitOf(m) + '/ano', 'Público'].concat(m === 'b2b' ? ['Estabelecimentos'] : []),
        rows: M.segments.map(function (s) { var x = lvl.segments[s.id]; return [s.name, brlMi(x.valor), qty(x.volume), metricText(m, 'pessoas', x.pessoas, s.id)].concat(m === 'b2b' ? [nf(0).format(Math.round(x.estabelecimentos))] : []); }) }
    });
    if (note) document.getElementById('chart-segments').insertAdjacentHTML('beforeend', '<p class="fine">' + icon('info', 'ic-sm') + ' ' + esc(note) + '</p>');
  }

  function renderComposition() {
    var m = state.model, M = model(), r = result(m);
    G.stacked(document.getElementById('chart-composition'), {
      legend: M.segments.map(function (s) { return { name: s.name, color: SEG_COLOR[s.id] }; }),
      fmtShare: function (s) { return nf(0).format(s * 100) + '%'; },
      rows: C.LEVELS.map(function (l) {
        var lvl = r.levels[l];
        return { label: LEVEL_NAMES[l], sub: M.levels[l].geo, parts: M.segments.map(function (s) {
          var seg = lvl.segments[s.id];
          return { name: s.name, value: seg.valor, color: SEG_COLOR[s.id], tip: s.name + ' · ' + LEVEL_NAMES[l] + '\n' + pct1(seg.valor / lvl.total.valor) + ' do valor\n' + brlMi(seg.valor) + ' por ano' };
        }) };
      }),
      table: { caption: 'Composição por segmento', head: ['Nível'].concat(M.segments.map(function (s) { return s.name; })),
        rows: C.LEVELS.map(function (l) { var lvl = r.levels[l]; return [LEVEL_NAMES[l]].concat(M.segments.map(function (s) { return pct1(lvl.segments[s.id].valor / lvl.total.valor); })); }) }
    });
  }

  function renderVolumeGrid() {
    var m = state.model, M = model(), r = result(m);
    function row(l, v) { return '<li><span class="lvl lvl-' + l + '">' + LEVEL_NAMES[l] + '</span><span>' + esc(M.levels[l].geo) + '</span><strong>' + v + '</strong></li>'; }
    var cards = [];
    cards.push('<article class="card vol-card"><h3 class="h5">' + icon('box') + ' Volume anual de ' + unitOf(m) + '</h3><ul>' +
      C.LEVELS.map(function (l) { return row(l, qty(r.levels[l].total.volume)); }).join('') + '</ul></article>');
    cards.push('<article class="card vol-card"><h3 class="h5">' + icon('users') + (m === 'b2c' ? ' Pessoas e viagens atingidas (máximo)' : ' Pessoas atingidas (noite média)') + '</h3><ul>' +
      C.LEVELS.map(function (l) { return row(l, qty(r.levels[l].total.pessoas)); }).join('') + '</ul>' +
      '<p class="fine">' + (m === 'b2c' ? 'Soma pessoas e viagens; pode haver sobreposição entre segmentos.' : 'Usuários de academia + hóspedes por noite (1 por quarto ocupado). Ao longo do ano, o número de hóspedes diferentes é maior.') + '</p></article>');
    if (m === 'b2b') {
      cards.push('<article class="card vol-card"><h3 class="h5">' + icon('building') + ' Estabelecimentos (clientes B2B)</h3><ul>' +
        C.LEVELS.map(function (l) { var s = r.levels[l].segments; return row(l, nf(0).format(Math.round(r.levels[l].total.estabelecimentos)) + '<small>' + nf(0).format(Math.round(s.academias.estabelecimentos)) + ' academias · ' + nf(0).format(s.hoteis.estabelecimentos) + ' hotéis</small>'); }).join('') + '</ul></article>');
    } else {
      cards.push('<article class="card vol-card"><h3 class="h5">' + icon('filter') + ' Fatores de filtro aplicados</h3><ul>' +
        '<li><span class="lvl lvl-sam">SAM</span><span>' + pctS(r.inputs.pesoSudeste) + ' × ' + pctS(r.inputs.pctClassesAB) + ' × ' + pctS(r.inputs.pctOnline) + '</span><strong>' + pctS(r.factorSummary.sam) + '</strong></li>' +
        '<li><span class="lvl lvl-som">SOM</span><span>Peso de SP no Sudeste</span><strong>' + pctS(r.factorSummary.som) + '</strong></li>' +
        '<li><span class="lvl lvl-som">SOM</span><span>Parcela do TAM</span><strong>' + shareText(r.levels.som.total.valor / r.levels.tam.total.valor) + '</strong></li></ul></article>');
    }
    document.getElementById('volume-grid').innerHTML = cards.join('');
  }

  function renderCompare() {
    var rows = [];
    C.LEVELS.forEach(function (l) {
      ['b2c', 'b2b'].forEach(function (m) {
        var r = result(m), M = D.MODELS[m], v = r.levels[l].total.valor;
        rows.push({ group: LEVEL_NAMES[l], label: M.name, sub: M.levels[l].geo, value: v, color: MODEL_COLOR[m], valueText: brlMi(v),
          tip: M.name + ' · ' + LEVEL_NAMES[l] + ' ' + M.levels[l].geo + '\n' + brlMi(v) + ' por ano\n' + qty(r.levels[l].total.volume) + ' ' + unitOf(m) + '/ano' + (isModified(m) ? '\n(cenário simulado)' : '') });
      });
    });
    G.bars(document.getElementById('chart-compare'), {
      ariaLabel: 'Comparação entre B2C e B2B', rows: rows,
      table: { caption: 'Comparação B2C × B2B', head: ['Nível', 'B2C', 'Recorte B2C', 'B2B', 'Recorte B2B'],
        rows: C.LEVELS.map(function (l) { return [LEVEL_NAMES[l], brlMi(result('b2c').levels[l].total.valor), D.MODELS.b2c.levels[l].geo, brlMi(result('b2b').levels[l].total.valor), D.MODELS.b2b.levels[l].geo]; }) }
    });
  }

  var METRIC_NAMES = { pessoas: 'Público', volume: 'Volume', valor: 'R$/ano', estabelecimentos: 'Estabelecimentos' };
  var STATUS_TEXT = { confere: 'Confere', arredondamento: 'Arredondamento', divergencia: 'Divergência' };
  function refMetricText(m, metric, v) {
    if (metric === 'valor') return 'R$ ' + nf(2).format(v / 1e6) + ' mi';
    if (metric === 'estabelecimentos') return nf(1).format(v);
    return qty(v);
  }
  function renderAudit() {
    var m = state.model, cur = result(m);
    var chk = C.checks(cur);
    var rec = C.reconcile(BASE[m]);
    var nOk = chk.filter(function (c) { return c.pass; }).length;
    var nRound = rec.filter(function (x) { return x.status === 'arredondamento'; }).length;
    var nDiv = rec.filter(function (x) { return x.status === 'divergencia'; }).length;
    document.getElementById('audit-summary').innerHTML = '<span class="pill ' + (nOk === chk.length ? 'pill-ok' : 'pill-bad') + '">' + nOk + '/' + chk.length + ' verificações</span>' +
      '<span class="pill">' + rec.length + ' valores conferidos com o PDF</span>' + (nRound ? '<span class="pill pill-warn">' + nRound + ' arredondamentos</span>' : '') + (nDiv ? '<span class="pill pill-bad">' + nDiv + ' divergências</span>' : '');
    var html = '<div class="audit-cols"><div><h4 class="h5">Verificações automáticas ' + (isModified(m) ? '(cenário simulado)' : '(cenário-base)') + '</h4><ul class="check-list">' +
      chk.map(function (c) { return '<li class="' + (c.pass ? 'pass' : 'fail') + '">' + icon(c.pass ? 'check' : 'alert', 'ic-sm') + '<span>' + esc(c.label) + (c.detail ? ' — ' + esc(c.detail) : '') + '</span></li>'; }).join('') +
      '</ul></div><div><h4 class="h5">Como ler a conferência</h4><p class="fine">O motor recalcula cada valor com precisão total a partir das premissas e compara com o número publicado no PDF (cenário-base). <b>Confere</b>: diferença ≤ 0,25%. <b>Arredondamento</b>: até 1,5%, causada por valores intermediários arredondados no documento. <b>Divergência</b>: acima disso — seria sinalizada para revisão. Nenhum valor foi forçado para coincidir com o PDF.</p></div></div>' +
      '<div class="table-scroll"><table class="rec-table"><caption class="sr-only">Conferência com o PDF</caption><thead><tr><th scope="col">Nível</th><th scope="col">Segmento</th><th scope="col">Medida</th><th scope="col">PDF</th><th scope="col">Recalculado</th><th scope="col">Diferença</th><th scope="col">Status</th></tr></thead><tbody>' +
      rec.map(function (x) {
        return '<tr class="st-' + x.status + '"><td>' + LEVEL_NAMES[x.level] + '</td><td>' + (x.segment === 'total' ? '<b>Total</b>' : esc(segNameToDataName(m, x.segment))) + '</td><td>' + METRIC_NAMES[x.metric] + '</td>' +
          '<td>' + refMetricText(m, x.metric, x.ref) + '</td><td>' + refMetricText(m, x.metric, x.calc) + '</td><td>' + F.signedPct(x.diffRel, 2) + '</td><td><span class="rec-status">' + STATUS_TEXT[x.status] + '</span></td></tr>';
      }).join('') + '</tbody></table></div>';
    document.getElementById('audit-body').innerHTML = html;
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
      '<p>' + esc(a.logic) + '</p>' +
      '<p class="adetail-meta"><span><b>Fonte:</b> ' + sourceLinks(a) + '</span><span><b>Validação:</b> ' + statusBadge(a.status) + ' ' + esc(a.validation) + '</span></p></li>';
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

  function renderCalc() {
    var m = state.model, M = model(), r = result(m), mod = isModified(m);
    var html = '<div class="formula-banner card"><span class="fb-label">Fórmula-base, por segmento (R$/ano)</span><p>Mercado do segmento = ' + esc(M.formula) + '</p>' +
      (m === 'b2c' ? '<p class="fine">1 kit = shampoo + condicionador para uma lavagem. O cálculo é feito por segmento e somado no final.</p>' : '<p class="fine">Quem compra é o estabelecimento (academia ou hotel); quem usa o kit é o aluno ou o hóspede. Só academias e hotéis entram porque têm contagem oficial ou setorial por estado; coworkings, clubes e empresas com vestiário podem entrar depois.</p>') +
      (mod ? '<p class="sim-flag">' + icon('sliders', 'ic-sm') + ' Exibindo o <b>cenário simulado</b>: premissas alteradas aparecem destacadas.</p>' : '') + '</div>';
    html += '<div class="seg-cards">';
    M.segments.forEach(function (s) {
      var seg = r.levels.tam.segments[s.id];
      var as = assumptionsFor(m, { levels: ['TAM'], segment: s.name });
      var pid = 'how-' + m + '-' + s.id;
      html += '<article class="card seg-card" style="--seg:' + SEG_COLOR[s.id] + '">' +
        '<header><h3 class="h4"><i class="dot" style="background:' + SEG_COLOR[s.id] + '"></i>' + esc(s.name) + '</h3><p>' + esc(s.who) + ' · <span class="muted">Base de volume: ' + esc(s.base) + '</span></p>' +
        '<span class="seg-total">' + brlMi(seg.valor) + '<small>TAM/ano · ' + shareText(seg.valor / r.levels.tam.total.valor) + ' do total</small></span></header>' +
        renderChain(m, chainFor(m, s.id, r)) +
        (m === 'b2b' && s.id === 'hoteis' ? '<p class="inline-warn">' + icon('alert', 'ic-sm') + ' O volume hoteleiro usa a premissa de <b>1 kit por quarto ocupado por noite</b> — estimativa própria a validar na pesquisa quali, não prática comprovada de todos os hotéis.</p>' : '') +
        '<button type="button" class="btn btn-sm btn-ghost how-btn" aria-expanded="false" aria-controls="' + pid + '">Como chegamos a esse número? ' + icon('down', 'chev') + '</button>' +
        '<div class="how" id="' + pid + '" hidden><h4 class="h5">Etapas da fórmula</h4><ol class="how-steps">' + STEP_TEXT[m][s.id].map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' +
        '<h4 class="h5">Premissas, justificativa e confiança</h4><ul class="adetails">' + as.map(assumptionDetail).join('') + '</ul></div>' +
        '</article>';
    });
    html += '</div>';

    var t = r.levels.tam.total, segs = M.segments.map(function (s) { return r.levels.tam.segments[s.id]; });
    html += '<div class="card consolidated"><h3 class="h4">Consolidado do TAM · ' + esc(M.levels.tam.geo) + '</h3><div class="cons-grid">' +
      '<div><span>' + (m === 'b2c' ? 'Lavagens fora de casa por ano' : 'Kits por ano') + '</span><strong>' + qty(t.volume) + '</strong><small>' + segs.map(function (x) { return qty(x.volume); }).join(' + ') + '</small></div>' +
      '<div><span>Faturamento anual potencial</span><strong>' + brlMi(t.valor) + '</strong><small>' + segs.map(function (x) { return brlMi(x.valor); }).join(' + ') + '</small></div>' +
      '<div><span>' + (m === 'b2c' ? 'Pessoas atingidas (máximo)' : 'Pessoas atingidas (noite média)') + '</span><strong>≈ ' + qty(t.pessoas) + '</strong><small>' + (m === 'b2c' ? 'Pode haver sobreposição entre segmentos' : 'Usuários + hóspedes por noite') + '</small></div>' +
      (m === 'b2b' ? '<div><span>Estabelecimentos atingidos</span><strong>' + nf(0).format(t.estabelecimentos) + '</strong><small>' + nf(0).format(r.inputs.academiasSudeste) + ' academias + ' + nf(0).format(r.inputs.meiosHospedagemSudeste) + ' meios de hospedagem</small></div>' : '') +
      '</div><p class="fine">Valores do PDF (cenário-base): ' + (m === 'b2c' ? '541,8 mi lavagens · R$ 1.896,3 mi · ≈ 25,6 mi pessoas.' : '183,8 mi kits · ≈ R$ 551,5 mi · 32.341 estabelecimentos · ≈ 1,37 mi pessoas.') + ' Somamos ' + unitOf(m) + ', e não pessoas, porque a mesma pessoa pode aparecer em mais de um segmento.</p></div>';
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
    var m = state.model, M = model(), r = result(m), i = r.inputs;
    var changed = C.changedInputs(m, i);
    function p(k, l) { return { v: fmtInput(m, k, i[k]), l: l, changed: changed.indexOf(k) >= 0 }; }
    var html = '';
    if (m === 'b2c') {
      html += '<p class="sec-lead">Os filtros definem o público e o canal que a WEEK consegue atender no início: quem mora no Sudeste, tem renda para um produto premium e compra pela internet (SAM); depois, o recorte do estado de SP (SOM).</p>' +
        '<div class="filter-cards"><article class="card"><h3 class="h4"><span class="lvl lvl-sam">SAM</span> Sudeste — fator ' + pctS(r.factorSummary.sam) + '</h3>' +
        factorChips([p('pesoSudeste', 'peso do Sudeste'), p('pctClassesAB', 'classes A e B'), p('pctOnline', 'compram online')], pctS(r.factorSummary.sam), 'fator do SAM') +
        '<ul class="why"><li><b>Premium (classes A e B):</b> um kit premium não é para todo mundo que toma banho fora; é para quem tem renda para pagar mais por qualidade.</li><li><b>E-commerce:</b> no começo a WEEK pretende vender pelo site; quem não compra pela internet não é atendível agora, então sai do SAM.</li></ul></article>' +
        '<article class="card"><h3 class="h4"><span class="lvl lvl-som">SOM</span> Estado de SP — fator ' + pctS(i.pesoSP) + '</h3>' +
        factorChips([p('pesoSP', 'peso de SP no Sudeste')], pctS(i.pesoSP), 'fator do SOM') +
        '<p>O SOM considera todo o público do SAM que está no estado de SP. Quando houver a taxa de captura, basta multiplicar: <b>fator do SOM = ' + pctS(i.pesoSP) + ' × taxa de captura</b>.</p></article></div>';
    } else {
      html += '<p class="sec-lead">No B2B, cada segmento tem filtros próprios: o peso de SP e o perfil do estabelecimento (academias premium; quartos de hotéis, flats e resorts) formam o SAM; a participação de Campinas forma o SOM. Escolher só academias premium reduz bastante o mercado de academias, enquanto quase todos os quartos de SP já são de hotéis.</p>' +
        '<div class="filter-cards">' +
        '<article class="card"><h3 class="h4"><span class="lvl lvl-sam">SAM</span> Academias — fator ' + pctS(r.factors.sam.academias) + '</h3>' + factorChips([p('pesoSPAcademias', 'SP nas academias do Sudeste'), p('pctPremium', 'perfil premium')], pctS(r.factors.sam.academias), 'fator do SAM') + '</article>' +
        '<article class="card"><h3 class="h4"><span class="lvl lvl-sam">SAM</span> Hotéis — fator ' + pctS(r.factors.sam.hoteis) + '</h3>' + factorChips([p('pesoSPQuartos', 'SP nos quartos do Sudeste'), p('pctHoteis', 'quartos de hotéis')], pctS(r.factors.sam.hoteis), 'fator do SAM') + '</article>' +
        '<article class="card"><h3 class="h4"><span class="lvl lvl-som">SOM</span> Campinas</h3>' + factorChips([p('fatorCampinasAcademias', 'academias de SP em Campinas')], pctS(i.fatorCampinasAcademias), 'academias') + factorChips([p('fatorCampinasHoteis', 'quartos de hotel de SP em Campinas')], pctS(i.fatorCampinasHoteis), 'hotéis') +
        '<p class="fine">Academias: 0,9% ÷ 25% (Panorama Setorial). Hotéis: 5.274 ÷ 146.653 quartos (Cadastur). Usam contagens reais em vez do peso da população.</p></article></div>';
    }

    // Visualização progressiva
    var steps = funnelSteps(m);
    var cur = Math.min(state.filterStep[m], steps.length - 1);
    html += '<div class="card progressive"><div class="prog-head"><h3 class="h4">Aplicando os filtros, passo a passo</h3>' +
      '<div class="prog-ctrl"><button type="button" class="btn btn-sm btn-ghost" data-fstep="prev"' + (cur <= 0 ? ' disabled' : '') + '>Anterior</button>' +
      '<span class="prog-count" aria-live="polite">Etapa ' + (cur + 1) + ' de ' + steps.length + '</span>' +
      '<button type="button" class="btn btn-sm btn-primary" data-fstep="next"' + (cur >= steps.length - 1 ? ' disabled' : '') + '>Aplicar próximo filtro</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-fstep="all">' + (cur >= steps.length - 1 ? 'Recomeçar' : 'Mostrar tudo') + '</button></div></div>' +
      '<div id="filter-funnel" class="chart"></div></div>';

    // Tabela por segmento
    var head = '<tr><th scope="col">Segmento</th>' + C.LEVELS.map(function (l) { return '<th scope="col">' + LEVEL_NAMES[l] + ' · ' + esc(M.levels[l].geo) + '</th>'; }).join('') + '</tr>';
    var body = M.segments.concat([{ id: 'total', name: 'Total' }]).map(function (s) {
      return '<tr' + (s.id === 'total' ? ' class="total"' : '') + '><th scope="row">' + (s.id !== 'total' ? '<i class="dot" style="background:' + SEG_COLOR[s.id] + '"></i>' : '') + esc(s.name) + '</th>' + C.LEVELS.map(function (l) {
        var x = s.id === 'total' ? r.levels[l].total : r.levels[l].segments[s.id];
        return '<td><strong>' + brlMi(x.valor) + '</strong><small>' + qty(x.volume) + ' ' + unitOf(m) + ' · ' + (s.id === 'total' ? qty(x.pessoas) + ' ' + peopleUnit(m) : metricText(m, 'pessoas', x.pessoas, s.id)) + (x.estabelecimentos !== undefined ? ' · ' + nf(0).format(Math.round(x.estabelecimentos)) + ' estab.' : '') + '</small></td>';
      }).join('') + '</tr>';
    }).join('');
    html += '<div class="card"><h3 class="h4">Resultado por segmento</h3><div class="table-scroll"><table class="seg-table"><caption class="sr-only">TAM, SAM e SOM por segmento</caption><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
    if (m === 'b2c') {
      html += '<p class="fine">Conferência do PDF: TAM total × fator do SAM = ' + brlMi(r.levels.tam.total.valor) + ' × ' + pctS(r.factorSummary.sam) + ' = ' + brlMi(r.levels.sam.total.valor) + '; SAM × ' + pctS(i.pesoSP) + ' = ' + brlMi(r.levels.som.total.valor) + '. Resultados de referência do PDF: SAM ≈ R$ 185,5 mi e SOM ≈ R$ 97,2 mi.</p>';
    } else {
      html += '<p class="fine">Academias do SAM: academias de SP (13.767) × 31% premium ≈ 4.268; do SOM: × 3,6% ≈ 154. Hotéis do SAM (1.893) e de Campinas (41) são contagens do Cadastur e não variam no simulador. Resultados de referência do PDF: SAM ≈ R$ 155,8 mi (6.161 estabelecimentos) e SOM ≈ R$ 5,61 mi (195 estabelecimentos).</p>';
    }
    html += '</div><div class="callout callout-warn" role="note">' + icon('alert') + '<div><strong>O SOM é um recorte, não uma previsão de vendas.</strong> Ele representa todo o mercado do SAM no recorte “' + esc(M.levels.som.geo) + '” antes da aplicação da taxa de captura comercial da WEEK.</div></div>';
    document.getElementById('filter-body').innerHTML = html;

    var visible = steps.map(function (s, k) { return k <= cur ? s : Object.assign({}, s, { color: 'var(--line)', valueText: '—', shareText: 'filtro ainda não aplicado', tip: s.label + '\nClique em “Aplicar próximo filtro”' }); });
    G.funnel(document.getElementById('filter-funnel'), { steps: visible, minWidth: 6, table: funnelTable(steps) });
  }

  /* ================================================================ */
  /* Premissas                                                         */
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
    var v = s.som;
    var w = Math.min(100, Math.abs(v) / 0.10 * 100);
    var lv = Math.abs(s.tam) > 1e-9 ? 'TAM, SAM e SOM' : Math.abs(s.sam) > 1e-9 ? 'SAM e SOM' : 'somente SOM';
    return '<span class="impact" data-tip="' + esc('Se “' + a.name + '” subir 10%\nSOM ' + a.model.toUpperCase() + ': ' + F.signedPct(v) + '\nAfeta: ' + lv) + '" tabindex="0"><span class="impact-bar"><i style="width:' + w.toFixed(0) + '%"></i></span>' + F.signedPct(v) + '</span>';
  }
  function hasSpec(a) { return a.key && C.getSpec(a.model, a.key); }

  function renderPriority() {
    var items = PRIORITY.map(function (id) { return D.ASSUMPTIONS.filter(function (a) { return a.id === id; })[0]; }).filter(Boolean);
    document.getElementById('priority').innerHTML = '<h3 class="h4">' + icon('alert') + ' Premissas prioritárias para validação</h3>' +
      '<p class="fine">Estimativas com confiança baixa ou média que mexem diretamente no tamanho do mercado. Validá-las na pesquisa quanti/quali é o próximo passo para transformar o dimensionamento em decisão.</p><ul class="prio-list">' +
      items.map(function (a) {
        return '<li><button type="button" class="prio-item" data-focus-assump="' + a.id + '"><span class="model-pill model-pill-' + a.model + '">' + a.model.toUpperCase() + '</span><span class="prio-name">' + esc(a.name) + ' <b>' + esc(a.value) + '</b></span>' + confMeter(a.confidence) + '</button></li>';
      }).join('') + '<li><span class="prio-item static"><span class="model-pill model-pill-b2b">B2B</span><span class="prio-name">Frequência de reposição de kits nos hotéis</span><span class="fine">ver “Kits por quarto ocupado”</span></span></li></ul>';
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

  function renderAssumptions() {
    var f = document.getElementById('assump-filters');
    var q = (f.q.value || '').trim().toLowerCase();
    var rows = D.ASSUMPTIONS.filter(function (a) {
      if (f.model.value && a.model !== f.model.value) return false;
      if (f.segment.value && a.segment !== f.segment.value) return false;
      if (f.confidence.value && a.confidence !== f.confidence.value) return false;
      if (f.status.value && a.status !== f.status.value) return false;
      if (q) {
        var hay = [a.name, a.value, a.logic, a.validation, a.sourceNote || ''].concat(a.sources.map(function (s) { return D.SOURCES[s].label; })).join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var nVal = rows.filter(function (a) { return a.status === 'validar'; }).length;
    document.getElementById('assump-count').textContent = rows.length + ' de ' + D.ASSUMPTIONS.length + ' premissas exibidas · ' + nVal + ' a validar em pesquisa';
    var tb = document.querySelector('#assump-table tbody');
    if (!rows.length) { tb.innerHTML = '<tr><td colspan="7" class="empty">Nenhuma premissa corresponde aos filtros. <button type="button" class="link-btn" data-clear-filters>Limpar filtros</button></td></tr>'; return; }
    var lastGroup = '';
    tb.innerHTML = rows.map(function (a) {
      var g = a.model.toUpperCase() + ' · ' + a.level + ' · ' + a.segment;
      var groupRow = g !== lastGroup ? '<tr class="group-row"><th colspan="7" scope="colgroup">' + esc(g) + '</th></tr>' : '';
      lastGroup = g;
      return groupRow + '<tr id="as-' + a.id + '" class="arow">' +
        '<th scope="row" data-label="Premissa"><span class="aname">' + esc(a.name) + '</span><span class="abadges"><span class="model-pill model-pill-' + a.model + '">' + a.model.toUpperCase() + '</span><span class="lvl lvl-' + a.level.toLowerCase() + '">' + a.level + '</span></span>' +
        (hasSpec(a) ? '<button type="button" class="link-btn" data-sim-key="' + a.model + ':' + a.key + '">' + icon('sliders', 'ic-sm') + 'Simular</button>' : '') + '</th>' +
        '<td data-label="Valor" class="aval">' + esc(a.value) + '</td>' +
        '<td data-label="Lógica do cálculo">' + esc(a.logic) + '</td>' +
        '<td data-label="Fonte">' + sourceLinks(a) + '</td>' +
        '<td data-label="Confiança">' + confMeter(a.confidence) + '</td>' +
        '<td data-label="Como validar">' + statusBadge(a.status) + '<span class="aval-text">' + esc(a.validation) + '</span></td>' +
        '<td data-label="Impacto (SOM, +10%)">' + impactCell(a) + '</td></tr>';
    }).join('');
  }

  /* ================================================================ */
  /* Simulador                                                         */
  /* ================================================================ */
  function stepDecimals(step) { var s = String(step); return s.indexOf('.') >= 0 ? s.split('.')[1].length : 0; }
  function displayValue(m, key) {
    var spec = C.getSpec(m, key);
    var v = C.toDisplay(m, key, state.inputs[m][key]);
    return spec.type === 'brl' ? nf(2, 2).format(v) : nf(Math.max(2, stepDecimals(spec.step))).format(v);
  }
  function baseDisplay(m, key) {
    var spec = C.getSpec(m, key);
    var v = C.toDisplay(m, key, D.BASE_INPUTS[m][key]);
    var t = nf(Math.max(2, stepDecimals(spec.step))).format(v);
    return spec.type === 'pct' ? t + '%' : spec.type === 'brl' ? 'R$ ' + nf(2, 2).format(v) : t + (spec.unit ? ' ' + spec.unit : '');
  }
  function assumptionByKey(m, key) { return D.ASSUMPTIONS.filter(function (a) { return a.model === m && a.key === key; })[0]; }

  function buildControls() {
    var m = state.model;
    var groups = {};
    var order = [];
    C.INPUT_SPECS[m].forEach(function (s) { if (!groups[s.group]) { groups[s.group] = []; order.push(s.group); } groups[s.group].push(s); });
    var html = order.map(function (g) {
      return '<fieldset><legend>' + esc(g) + '</legend>' + groups[g].map(function (s) {
        var id = 'sim-' + m + '-' + s.key;
        var a = assumptionByKey(m, s.key);
        var tip = a ? a.name + '\n' + a.logic.slice(0, 220) + (a.logic.length > 220 ? '…' : '') + '\nConfiança: ' + confOf(a.confidence).label : s.label;
        var unit = s.type === 'pct' ? '%' : s.type === 'brl' ? 'R$' : (s.unit || '');
        var v = C.toDisplay(m, s.key, state.inputs[m][s.key]);
        return '<div class="ctrl" data-key="' + s.key + '">' +
          '<div class="ctrl-top"><label for="' + id + '-num">' + esc(s.label) + '</label><button type="button" class="info-btn" data-tip="' + esc(tip) + '">' + icon('info') + '<span class="sr-only">Sobre esta premissa</span></button></div>' +
          '<div class="ctrl-inputs"><input type="range" id="' + id + '" min="' + s.min + '" max="' + s.max + '" step="' + s.step + '" value="' + v + '" aria-label="' + esc(s.label) + '" data-range="' + s.key + '">' +
          '<span class="num-wrap' + (s.type === 'brl' ? ' pre' : '') + '">' + (s.type === 'brl' ? '<span class="unit">R$</span>' : '') +
          '<input type="text" inputmode="decimal" id="' + id + '-num" value="' + displayValue(m, s.key) + '" data-num="' + s.key + '" aria-describedby="' + id + '-help">' +
          (s.type !== 'brl' ? '<span class="unit">' + esc(unit) + '</span>' : '') + '</span></div>' +
          '<div class="ctrl-foot" id="' + id + '-help"><span>Base do estudo: ' + baseDisplay(m, s.key) + '</span><span class="ctrl-msg" role="status"></span>' +
          '<button type="button" class="link-btn ctrl-reset" data-reset-key="' + s.key + '" hidden>' + icon('reset', 'ic-sm') + 'Restaurar</button></div></div>';
      }).join('') + '</fieldset>';
    }).join('');
    document.getElementById('sim-controls').innerHTML = html;
    syncControls();
  }

  function syncControls(skipKey) {
    var m = state.model;
    var base = D.BASE_INPUTS[m];
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
    var trial = Object.assign({}, state.inputs[m]);
    trial[key] = value;
    if (C.validateInputs(m, trial).length) return false;   // nunca aceita um cenário inválido
    state.inputs[m] = trial;
    return true;
  }

  function renderSimResults() {
    var m = state.model, M = model(), r = result(m), b = BASE[m], d = C.diff(r, b);
    var changed = C.changedInputs(m, state.inputs[m]);
    var mod = changed.length > 0;
    var html = '<div class="card sim-card"><div class="sim-status ' + (mod ? 'is-sim' : 'is-base') + '">' + icon(mod ? 'sliders' : 'check', 'ic-sm') +
      (mod ? 'Cenário simulado · ' + changed.length + (changed.length > 1 ? ' premissas alteradas' : ' premissa alterada') : 'Cenário-base (valores do estudo)') + '</div>' +
      '<p class="sr-only" aria-live="polite">' + C.LEVELS.map(function (l) { return LEVEL_NAMES[l] + ' ' + brlMi(r.levels[l].total.valor); }).join(', ') + '</p>' +
      '<ul class="sim-levels">';
    C.LEVELS.forEach(function (l) {
      var t = r.levels[l].total, tb = b.levels[l].total, dd = d[l];
      var cls = Math.abs(dd.valorAbs) < 0.5 ? 'flat' : dd.valorAbs > 0 ? 'up' : 'down';
      html += '<li><div class="sl-head"><span class="lvl lvl-' + l + '">' + LEVEL_NAMES[l] + '</span><span>' + esc(M.levels[l].geo) + '</span></div>' +
        '<div class="sl-val">' + brlMi(t.valor) + '<small>/ano</small></div>' +
        '<div class="sl-delta ' + cls + '"><b>' + F.signedPct(dd.valorRel) + '</b><span>' + F.signedMoney(dd.valorAbs) + ' vs. base (' + brlMi(tb.valor) + ')</span></div>' +
        '<div class="sl-vol">' + icon('box', 'ic-sm') + qty(t.volume) + ' ' + unitOf(m) + '/ano <span class="muted">(' + F.signedPct(dd.volumeRel) + ')</span></div></li>';
    });
    html += '</ul><div id="sim-chart" class="chart"></div>';
    html += '<div class="sim-applied"><h3 class="h5">Premissas aplicadas</h3>' + (mod ? '<ul>' + changed.map(function (k) {
      var spec = C.getSpec(m, k);
      return '<li><span>' + esc(spec ? spec.label : k) + '</span><span><s>' + fmtInput(m, k, D.BASE_INPUTS[m][k]) + '</s> → <b>' + fmtInput(m, k, state.inputs[m][k]) + '</b></span></li>';
    }).join('') + '</ul>' : '<p class="fine">Todas as premissas estão com os valores do documento.</p>') + '</div>' +
      '<button type="button" class="btn btn-primary btn-block" data-reset-model="' + m + '"' + (mod ? '' : ' disabled') + '>' + icon('reset') + ' Restaurar valores originais</button>' +
      '<p class="fine">O SOM continua sem taxa de captura. Cenários simulados são exploratórios e não substituem a validação das premissas.</p></div>';
    document.getElementById('sim-results').innerHTML = html;

    var rows = [];
    C.LEVELS.forEach(function (l) {
      rows.push({ group: LEVEL_NAMES[l], label: 'Base', value: b.levels[l].total.valor, color: 'var(--base-bar)', valueText: brlMi(b.levels[l].total.valor), tip: LEVEL_NAMES[l] + ' · cenário-base\n' + brlMi(b.levels[l].total.valor) });
      rows.push({ group: LEVEL_NAMES[l], label: mod ? 'Simulado' : 'Atual', value: r.levels[l].total.valor, color: LEVEL_COLOR[l], valueText: brlMi(r.levels[l].total.valor), tip: LEVEL_NAMES[l] + ' · ' + (mod ? 'cenário simulado' : 'cenário atual') + '\n' + brlMi(r.levels[l].total.valor) });
    });
    G.bars(document.getElementById('sim-chart'), { ariaLabel: 'Cenário-base versus simulado', rows: rows });
    document.getElementById('sim-mini').innerHTML = C.LEVELS.map(function (l) {
      return '<span><span class="lvl lvl-' + l + '">' + LEVEL_NAMES[l] + '</span><b>' + brlMi(r.levels[l].total.valor) + '</b><small class="' + (d[l].valorAbs > 0.5 ? 'up' : d[l].valorAbs < -0.5 ? 'down' : '') + '">' + F.signedPct(d[l].valorRel) + '</small></span>';
    }).join('');
  }

  function renderBanner() {
    var parts = ['b2c', 'b2b'].filter(isModified).map(function (m) { var n = C.changedInputs(m, state.inputs[m]).length; return D.MODELS[m].name + ': ' + n + (n > 1 ? ' premissas alteradas' : ' premissa alterada'); });
    var b = document.getElementById('sim-banner');
    b.hidden = !parts.length;
    document.getElementById('sim-banner-text').textContent = parts.length ? '— ' + parts.join(' · ') + '. Painel, gráficos e metodologia refletem o cenário simulado.' : '';
    document.documentElement.style.setProperty('--banner-h', parts.length ? b.offsetHeight + 'px' : '0px');
  }

  /* ================================================================ */
  /* Detalhamento de indicador (diálogo)                               */
  /* ================================================================ */
  function openDrill(m, l, useBase) {
    var M = D.MODELS[m], r = useBase ? BASE[m] : result(m), lvl = r.levels[l], i = r.inputs;
    var levels = l === 'tam' ? ['TAM'] : l === 'sam' ? ['TAM', 'SAM'] : ['TAM', 'SAM', 'SOM'];
    var as = assumptionsFor(m, { levels: levels });
    var toValidate = as.filter(function (a) { return a.status === 'validar'; });
    var ref = D.REFERENCE[m][l].total.valor;
    document.getElementById('drill-title').textContent = LEVEL_NAMES[l] + ' ' + M.name + ' · ' + M.levels[l].geo + ': ' + brlMi(lvl.total.valor) + '/ano';

    var formula;
    if (l === 'tam') formula = '<p>Para cada segmento: ' + esc(M.formula) + '. Os segmentos são somados.</p>';
    else if (m === 'b2c') formula = l === 'sam'
      ? '<p>SAM = TAM × fator do SAM</p>' + factorChips([{ v: pctS(i.pesoSudeste), l: 'peso do Sudeste' }, { v: pctS(i.pctClassesAB), l: 'classes A e B' }, { v: pctS(i.pctOnline), l: 'compram online' }], pctS(r.factorSummary.sam), 'fator do SAM') + '<p class="fine">' + brlMi(r.levels.tam.total.valor) + ' × ' + pctS(r.factorSummary.sam) + ' = ' + brlMi(lvl.total.valor) + '</p>'
      : '<p>SOM = SAM × fator do SOM (peso de SP no Sudeste = ' + pctS(i.pesoSP) + ')</p><p class="fine">' + brlMi(r.levels.sam.total.valor) + ' × ' + pctS(i.pesoSP) + ' = ' + brlMi(lvl.total.valor) + ' · taxa de captura ainda não aplicada</p>';
    else formula = l === 'sam'
      ? '<p>SAM = TAM academias × (' + pctS(i.pesoSPAcademias) + ' × ' + pctS(i.pctPremium) + ') + TAM hotéis × (' + pctS(i.pesoSPQuartos) + ' × ' + pctS(i.pctHoteis) + ')</p><p class="fine">' + brlMi(r.levels.tam.segments.academias.valor) + ' × ' + pctS(r.factors.sam.academias) + ' + ' + brlMi(r.levels.tam.segments.hoteis.valor) + ' × ' + pctS(r.factors.sam.hoteis) + ' = ' + brlMi(lvl.total.valor) + '</p>'
      : '<p>SOM = SAM academias × ' + pctS(i.fatorCampinasAcademias) + ' + SAM hotéis × ' + pctS(i.fatorCampinasHoteis) + '</p><p class="fine">' + brlMi(r.levels.sam.segments.academias.valor) + ' × ' + pctS(i.fatorCampinasAcademias) + ' + ' + brlMi(r.levels.sam.segments.hoteis.valor) + ' × ' + pctS(i.fatorCampinasHoteis) + ' = ' + brlMi(lvl.total.valor) + ' · taxa de captura ainda não aplicada</p>';

    var filters = l === 'tam' ? '<p>Nenhum filtro: é o universo total do modelo (' + esc(M.levels.tam.geo) + ').</p>' :
      '<ol>' + funnelSteps(m).slice(1, l === 'sam' ? (m === 'b2c' ? 4 : 3) : 99).map(function (s) { return '<li><b>' + esc(s.connector) + '</b> → ' + esc(s.label) + ': ' + s.valueText + ' (' + s.shareText + ')</li>'; }).join('') + '</ol>';

    var html = (useBase ? '<p class="drill-note">' + icon('info', 'ic-sm') + ' Valores do cenário-base (premissas do documento).</p>' : (isModified(m) ? '<p class="drill-note sim">' + icon('sliders', 'ic-sm') + ' Cenário simulado — valores diferentes do estudo original.</p>' : '')) +
      '<section><h3>1. De onde vem o valor</h3><div class="table-scroll"><table class="drill-table"><thead><tr><th scope="col">Segmento</th><th scope="col">R$/ano</th><th scope="col">' + (m === 'b2c' ? 'Lavagens' : 'Kits') + '/ano</th><th scope="col">Participação</th></tr></thead><tbody>' +
      M.segments.map(function (s) { var x = lvl.segments[s.id]; return '<tr><th scope="row"><i class="dot" style="background:' + SEG_COLOR[s.id] + '"></i>' + esc(s.name) + '</th><td>' + brlMi(x.valor) + '</td><td>' + qty(x.volume) + '</td><td>' + pct1(x.valor / lvl.total.valor) + '</td></tr>'; }).join('') +
      '<tr class="total"><th scope="row">Total</th><td>' + brlMi(lvl.total.valor) + '</td><td>' + qty(lvl.total.volume) + '</td><td>100%</td></tr></tbody></table></div>' +
      '<p class="fine">Valor publicado no PDF: ' + refText(ref) + '. ' + (useBase || !isModified(m) ? 'Diferença do recálculo: ' + F.signedPct((BASE[m].levels[l].total.valor - ref) / ref, 2) + ' (arredondamento).' : '') + '</p></section>' +
      '<section><h3>2. Fórmula aplicada</h3>' + formula + '</section>' +
      '<section><h3>3. Premissas utilizadas</h3><ul class="drill-assump">' + as.map(function (a) { return '<li><span>' + esc(a.name) + ' <b>' + esc(a.value) + '</b></span>' + confMeter(a.confidence) + '</li>'; }).join('') + '</ul></section>' +
      '<section><h3>4. Filtros que reduziram o mercado</h3>' + filters + '</section>' +
      '<section><h3>5. Variáveis que ainda precisam ser validadas</h3>' + (toValidate.length ? '<ul class="drill-validate">' + toValidate.map(function (a) { return '<li>' + icon('alert', 'ic-sm') + '<span><b>' + esc(a.name) + '</b> — ' + esc(a.validation) + '</span></li>'; }).join('') + '</ul>' : '<p>Nenhuma.</p>') + '</section>' +
      '<div class="drill-actions"><a class="btn btn-sm btn-ghost" href="#premissas" data-close-drill>Ver todas as premissas</a><a class="btn btn-sm btn-primary" href="#simulador" data-close-drill data-goto-model="' + m + '">Simular outras premissas</a></div>';
    document.getElementById('drill-body').innerHTML = html;
    var dlg = document.getElementById('drill');
    lastFocus = document.activeElement;
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
    document.getElementById('drill-body').scrollTop = 0;
  }
  var lastFocus = null;
  function closeDrill(keepFocus) {
    var dlg = document.getElementById('drill');
    if (typeof dlg.close === 'function' && dlg.open) dlg.close(); else dlg.removeAttribute('open');
    if (!keepFocus && lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
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
    var f = document.getElementById('cagr-form');
    var out = document.getElementById('cagr-out');
    var raw = [f.vi.value, f.vf.value, f.n.value];
    if (raw.every(function (x) { return !x.trim(); })) { out.innerHTML = '<p class="fine">Informe o valor inicial, o valor final e o número de anos para calcular a taxa.</p>'; return; }
    if (raw.some(function (x) { return !x.trim(); })) { out.innerHTML = '<p class="fine">Preencha os três campos.</p>'; return; }
    var vi = parseBR(raw[0]), vf = parseBR(raw[1]), n = parseBR(raw[2]);
    var r = C.cagr(vi, vf, n);
    if (!r.ok) { out.innerHTML = '<p class="err">' + icon('alert', 'ic-sm') + esc(r.error) + '</p>'; return; }
    var money = function (v) { return 'R$ ' + nf(2).format(v); };
    var nTxt = nf(2).format(n);
    var interp = r.rate >= 0
      ? 'Um valor que passa de ' + money(vi) + ' para ' + money(vf) + ' em ' + nTxt + ' ano(s) cresce, em média, <b>' + nf(2, 2).format(r.rate * 100) + '% ao ano</b> de forma composta (multiplicação total de ' + nf(2).format(r.multiple) + '×).'
      : 'Um valor que passa de ' + money(vi) + ' para ' + money(vf) + ' em ' + nTxt + ' ano(s) encolhe, em média, <b>' + nf(2, 2).format(Math.abs(r.rate) * 100) + '% ao ano</b> (retração composta).';
    out.innerHTML = '<div class="cagr-rate"><span>CAGR</span><strong>' + (r.rate >= 0 ? '' : '−') + nf(2, 2).format(Math.abs(r.rate) * 100) + '%</strong><small>ao ano · hipotético</small></div>' +
      '<p class="cagr-formula">(' + money(vf) + ' ÷ ' + money(vi) + ')<sup>1/' + nTxt + '</sup> − 1 = ' + nf(4).format(r.multiple) + '<sup>' + nf(4).format(1 / n) + '</sup> − 1 = ' + nf(2, 2).format(r.rate * 100) + '%</p>' +
      '<p>' + interp + '</p>' +
      '<div id="cagr-chart" class="chart"></div>' +
      '<p class="fine">' + icon('alert', 'ic-sm') + ' Entradas informadas pelo usuário — não são dados históricos nem projeções oficiais da WEEK.</p>';
    if (Math.abs(n - Math.round(n)) < 1e-9 && n >= 1 && n <= 50) {
      var series = C.projectSeries(vi, r.rate, n);
      G.line(document.getElementById('cagr-chart'), {
        ariaLabel: 'Trajetória hipotética com CAGR constante',
        points: series.map(function (y, k) { return { x: k, y: y }; }),
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
    // Pontos de atenção encontrados na auditoria (diferenças de arredondamento)
    var diffs = [];
    ['b2c', 'b2b'].forEach(function (m) {
      C.reconcile(BASE[m]).filter(function (x) { return x.status !== 'confere'; }).forEach(function (x) { diffs.push({ m: m, x: x }); });
    });
    html += '<article class="card note note-wide" id="nota-auditoria"><span class="model-pill">Auditoria</span><h3 class="h5">Diferenças encontradas ao recalcular o PDF</h3>' +
      '<p>O recálculo independente reproduziu todos os totais do documento. As diferenças abaixo vêm do arredondamento de valores intermediários no PDF (por exemplo, 2,01 mi viagens e 6,0 mi lavagens no SAM de Viagem) e não alteram as conclusões. Os valores originais do PDF foram mantidos como referência.</p>' +
      (diffs.length ? '<ul class="diff-list">' + diffs.map(function (d) {
        return '<li><span class="model-pill model-pill-' + d.m + '">' + d.m.toUpperCase() + '</span> ' + LEVEL_NAMES[d.x.level] + ' · ' + esc(d.x.segment === 'total' ? 'Total' : segNameToDataName(d.m, d.x.segment)) + ' · ' + METRIC_NAMES[d.x.metric] +
          ': PDF ' + refMetricText(d.m, d.x.metric, d.x.ref) + ' · recálculo ' + refMetricText(d.m, d.x.metric, d.x.calc) + ' (' + F.signedPct(d.x.diffRel, 2) + ')</li>';
      }).join('') + '</ul>' : '<p>Nenhuma diferença acima de 0,25%.</p>') + '</article>';
    document.getElementById('notes-grid').innerHTML = html;

    document.getElementById('conf-criteria').innerHTML = '<h3 class="h4">Critério de confiança (como definido no documento)</h3><div class="table-scroll"><table class="crit-table"><thead><tr><th scope="col">Nível</th><th scope="col">B2C</th><th scope="col">B2B</th></tr></thead><tbody>' +
      D.CONFIDENCE.map(function (c) { return '<tr><th scope="row">' + confMeter(c.id) + '</th><td>' + esc(c.b2c) + '</td><td>' + esc(c.b2b) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ================================================================ */
  /* Orquestração                                                      */
  /* ================================================================ */
  function renderDynamic() {
    renderConcept(); renderPainel(); renderCalc(); renderFilters(); renderSimResults(); renderBanner();
  }

  function setModel(m, opts) {
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
    if (changed || (opts && opts.force)) { buildControls(); }
    renderDynamic();
  }

  function resetModel(m) {
    var models = m ? [m] : ['b2c', 'b2b'];
    models.forEach(function (x) { state.inputs[x] = C.baseInputs(x); });
    syncControls();
    renderDynamic();
  }

  function bindEvents() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target : e.target.parentNode;
      var el;
      if ((el = t.closest('[data-model-btn]'))) { setModel(el.getAttribute('data-model-btn')); return; }
      if ((el = t.closest('[data-goto-model]'))) {
        setModel(el.getAttribute('data-goto-model'));
        if (el.tagName === 'BUTTON') document.getElementById('painel').scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth' });
        if (el.hasAttribute('data-close-drill')) closeDrill(true);
        return;
      }
      if ((el = t.closest('[data-close-drill]'))) { closeDrill(true); return; }
      if ((el = t.closest('[data-drill]'))) {
        if (t.closest('.info-btn')) return;
        var p = el.getAttribute('data-drill').split(':');
        openDrill(p[0], p[1], p[2] === 'base');
        return;
      }
      if ((el = t.closest('#rings .ring, .def-card'))) { state.conceptLevel = el.getAttribute('data-level'); renderConcept(); return; }
      if ((el = t.closest('[data-seg-level]'))) { state.segLevel = el.getAttribute('data-seg-level'); renderSegmentChart(); return; }
      if ((el = t.closest('[data-seg-metric]'))) { state.segMetric = el.getAttribute('data-seg-metric'); renderSegmentChart(); return; }
      if ((el = t.closest('.how-btn'))) {
        var panel = document.getElementById(el.getAttribute('aria-controls'));
        var open = el.getAttribute('aria-expanded') !== 'true';
        el.setAttribute('aria-expanded', open ? 'true' : 'false');
        panel.hidden = !open;
        return;
      }
      if ((el = t.closest('[data-fstep]'))) {
        var steps = funnelSteps(state.model).length, m = state.model, cur = Math.min(state.filterStep[m], steps - 1), a = el.getAttribute('data-fstep');
        state.filterStep[m] = a === 'prev' ? Math.max(0, cur - 1) : a === 'next' ? Math.min(steps - 1, cur + 1) : (cur >= steps - 1 ? 0 : steps - 1);
        renderFilters();
        var again = document.querySelector('[data-fstep="' + a + '"]');
        if (again && !again.disabled) again.focus(); else { var nx = document.querySelector('[data-fstep="next"]'); if (nx && !nx.disabled) nx.focus(); else { var al = document.querySelector('[data-fstep="all"]'); if (al) al.focus(); } }
        return;
      }
      if ((el = t.closest('[data-reset-model]'))) { resetModel(el.getAttribute('data-reset-model') || null); return; }
      if ((el = t.closest('[data-reset-key]'))) {
        var k = el.getAttribute('data-reset-key');
        state.inputs[state.model][k] = D.BASE_INPUTS[state.model][k];
        var msg = el.parentNode.querySelector('.ctrl-msg'); if (msg) msg.textContent = '';
        syncControls(); renderDynamic();
        var inp = document.querySelector('[data-num="' + k + '"]'); if (inp) inp.focus();
        return;
      }
      if ((el = t.closest('[data-sim-key]'))) {
        var pk = el.getAttribute('data-sim-key').split(':');
        setModel(pk[0]);
        document.getElementById('simulador').scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth' });
        var target = document.querySelector('[data-num="' + pk[1] + '"]');
        if (target) setTimeout(function () { target.focus({ preventScroll: true }); target.closest('.ctrl').classList.add('flash'); setTimeout(function () { target.closest('.ctrl') && target.closest('.ctrl').classList.remove('flash'); }, 1600); }, prefersReduced() ? 0 : 450);
        return;
      }
      if ((el = t.closest('[data-focus-assump]'))) {
        var f = document.getElementById('assump-filters'); f.reset(); renderAssumptions();
        var row = document.getElementById('as-' + el.getAttribute('data-focus-assump'));
        if (row) { row.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'center' }); row.classList.add('flash'); setTimeout(function () { row.classList.remove('flash'); }, 1800); }
        return;
      }
      if ((el = t.closest('[data-clear-filters], #assump-clear'))) { document.getElementById('assump-filters').reset(); renderAssumptions(); return; }
      if ((el = t.closest('#drill-close'))) { closeDrill(); return; }
      if (t === document.getElementById('drill')) { closeDrill(); return; } // clique no fundo
      if ((el = t.closest('#menu-btn'))) { toggleMenu(); return; }
      if ((el = t.closest('#nav-links a'))) { toggleMenu(false); return; }
      if ((el = t.closest('#cagr-example'))) { var cf = document.getElementById('cagr-form'); cf.vi.value = '100.000'; cf.vf.value = '150.000'; cf.n.value = '5'; renderCagr(); return; }
      if ((el = t.closest('#cagr-clear'))) { document.getElementById('cagr-form').reset(); renderCagr(); return; }
    });

    // Teclado nas abas (setas)
    document.querySelector('.model-tabs[role="tablist"]').addEventListener('keydown', function (e) {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
      e.preventDefault();
      var next = state.model === 'b2c' ? 'b2b' : 'b2c';
      if (e.key === 'Home') next = 'b2c'; if (e.key === 'End') next = 'b2b';
      setModel(next);
      document.getElementById('tab-' + next).focus();
    });

    // Simulador: sliders (tempo real) e campos numéricos (validação)
    var sc = document.getElementById('sim-controls');
    sc.addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-range');
      if (!k) return;
      var m = state.model;
      var p = C.parseUserValue(m, k, e.target.value);
      if (p.ok && setInput(m, k, p.value)) {
        var ctrl = e.target.closest('.ctrl');
        ctrl.querySelector('[data-num]').value = displayValue(m, k);
        ctrl.querySelector('.ctrl-msg').textContent = '';
        syncControls(k);
        renderDynamic();
      }
    });
    function commitNum(input) {
      var k = input.getAttribute('data-num'); if (!k) return;
      var m = state.model, ctrl = input.closest('.ctrl'), msg = ctrl.querySelector('.ctrl-msg');
      var p = C.parseUserValue(m, k, input.value);
      if (!p.ok) { msg.textContent = p.error + ' Valor mantido.'; ctrl.classList.add('invalid'); input.value = displayValue(m, k); return; }
      ctrl.classList.remove('invalid');
      if (!setInput(m, k, p.value)) { msg.textContent = 'Valor inválido. Valor mantido.'; input.value = displayValue(m, k); return; }
      msg.textContent = p.note || '';
      syncControls(); renderDynamic();
    }
    sc.addEventListener('change', function (e) { if (e.target.hasAttribute('data-num')) commitNum(e.target); });
    sc.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.hasAttribute('data-num')) { e.preventDefault(); commitNum(e.target); } });

    // Premissas: filtros
    var af = document.getElementById('assump-filters');
    af.addEventListener('input', renderAssumptions);
    af.addEventListener('change', renderAssumptions);

    // CAGR
    var cf = document.getElementById('cagr-form');
    cf.addEventListener('input', renderCagr);

    // Diálogo
    var dlg = document.getElementById('drill');
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); closeDrill(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dlg.hasAttribute('open')) closeDrill(); if (e.key === 'Escape') toggleMenu(false); });

    window.addEventListener('resize', function () { renderBanner(); });
  }

  function toggleMenu(force) {
    var nav = document.getElementById('nav-links'), btn = document.getElementById('menu-btn');
    var open = force === undefined ? !nav.classList.contains('open') : force;
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Fechar menu de seções' : 'Abrir menu de seções');
  }

  function prefersReduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function observeSections() {
    if (!('IntersectionObserver' in window)) return;
    var links = {};
    document.querySelectorAll('#nav-links a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && links[en.target.id]) {
          Object.keys(links).forEach(function (k) { links[k].removeAttribute('aria-current'); });
          links[en.target.id].setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  function init() {
    renderExec();
    fillFilterOptions();
    renderPriority();
    renderAssumptions();
    renderNotes();
    renderCagr();
    bindEvents();
    G.initTooltips();
    setModel('b2c', { force: true });
    observeSections();
  }

  try { init(); }
  catch (err) {
    if (window.console) console.error(err);
    document.body.insertAdjacentHTML('afterbegin', '<div class="noscript">Ocorreu um erro ao montar a plataforma: ' + esc(err.message) + '</div>');
  }
})();
