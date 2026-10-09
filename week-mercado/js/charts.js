/*
 * charts.js — Gráficos leves em HTML/SVG, sem dependências externas
 * (funcionam offline e se adaptam à largura do contêiner).
 *
 *   WeekCharts.bars(el, opts)     barras horizontais (com grupos opcionais)
 *   WeekCharts.stacked(el, opts)  barras 100% empilhadas (composição)
 *   WeekCharts.funnel(el, opts)   funil de refinamento
 *   WeekCharts.line(el, opts)     linha simples em SVG (projeção do CAGR)
 *   WeekCharts.initTooltips()     tooltip único para [data-tip] (mouse, foco e toque)
 *
 * Toda marca interativa é focável (tabindex=0) e tem aria-label; cada gráfico
 * oferece a visão em tabela ("Ver dados em tabela").
 */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function intro(el) {
    var first = !el.dataset.rendered;
    el.dataset.rendered = '1';
    return first ? ' intro' : '';
  }

  function table(caption, head, rows) {
    return '<details class="data-table"><summary>Ver dados em tabela</summary><div class="table-scroll"><table><caption class="sr-only">' + esc(caption) + '</caption><thead><tr>' +
      head.map(function (h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return i === 0 ? '<th scope="row">' + esc(c) + '</th>' : '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div></details>';
  }

  /* ---------------------------------------------------------------- */
  /* Barras horizontais                                                */
  /* opts.rows: [{label, sub, value, color, valueText, tip, group}]    */
  /* ---------------------------------------------------------------- */
  function bars(el, opts) {
    var rows = opts.rows || [];
    var max = opts.max || Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([0]));
    var html = '<div class="bars' + intro(el) + '" role="list" aria-label="' + esc(opts.ariaLabel || '') + '">';
    var lastGroup = null;
    rows.forEach(function (r) {
      if (r.group && r.group !== lastGroup) { html += '<div class="bar-group" role="presentation">' + esc(r.group) + '</div>'; lastGroup = r.group; }
      var w = max > 0 ? Math.max(0, r.value / max * 100) : 0;
      var shown = w > 0 && w < 0.6 ? 0.6 : w; // marca mínima visível para valores > 0
      html += '<div class="bar-row" role="listitem">' +
        '<div class="bar-label">' + esc(r.label) + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + '</div>' +
        '<div class="bar-track"><div class="bar-fill" tabindex="0" style="width:' + shown.toFixed(2) + '%;background:' + r.color + '"' +
        ' data-tip="' + esc(r.tip || (r.label + '\n' + r.valueText)) + '" aria-label="' + esc(r.label + ': ' + r.valueText) + '"></div></div>' +
        '<div class="bar-value">' + esc(r.valueText) + '</div></div>';
    });
    html += '</div>';
    if (opts.table) html += table(opts.table.caption, opts.table.head, opts.table.rows);
    el.innerHTML = html;
  }

  /* ---------------------------------------------------------------- */
  /* 100% empilhado                                                    */
  /* opts.rows: [{label, parts:[{name, value, color, tip}]}]           */
  /* opts.legend: [{name, color}]                                      */
  /* ---------------------------------------------------------------- */
  function stacked(el, opts) {
    var html = '<ul class="legend" aria-label="Legenda">' + (opts.legend || []).map(function (l) {
      return '<li><span class="sw" style="background:' + l.color + '"></span>' + esc(l.name) + '</li>';
    }).join('') + '</ul>';
    html += '<div class="stack-rows' + intro(el) + '" role="list">';
    (opts.rows || []).forEach(function (r) {
      var total = r.parts.reduce(function (s, p) { return s + p.value; }, 0);
      html += '<div class="stack-row" role="listitem"><div class="bar-label">' + esc(r.label) + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + '</div><div class="stack">';
      r.parts.forEach(function (p) {
        var share = total > 0 ? p.value / total : 0;
        if (share <= 0) return;
        var pct = (share * 100);
        var txt = (opts.fmtShare ? opts.fmtShare(share) : pct.toFixed(0) + '%');
        html += '<div class="stack-part" tabindex="0" style="flex-basis:' + pct.toFixed(3) + '%;background:' + p.color + '"' +
          ' data-tip="' + esc(p.tip || (p.name + '\n' + txt)) + '" aria-label="' + esc(r.label + ', ' + p.name + ': ' + txt) + '">' +
          (pct >= 14 ? '<span>' + esc(txt) + '</span>' : '') + '</div>';
      });
      html += '</div></div>';
    });
    html += '</div>';
    if (opts.table) html += table(opts.table.caption, opts.table.head, opts.table.rows);
    el.innerHTML = html;
  }

  /* ---------------------------------------------------------------- */
  /* Funil                                                             */
  /* opts.steps: [{label, sub, value, share, valueText, shareText,     */
  /*               color, tip, connector}]                             */
  /* ---------------------------------------------------------------- */
  function funnel(el, opts) {
    var steps = opts.steps || [];
    var minW = opts.minWidth == null ? 8 : opts.minWidth;
    var html = '<ol class="funnel' + intro(el) + '">';
    steps.forEach(function (s, idx) {
      if (idx > 0 && s.connector) html += '<li class="funnel-conn" aria-hidden="true"><svg class="ic ic-sm"><use href="#i-filter"/></svg>' + esc(s.connector) + '</li>';
      var w = Math.max(minW, Math.min(100, s.share * 100));
      html += '<li class="funnel-step">' +
        '<div class="funnel-meta"><strong>' + esc(s.label) + '</strong>' + (s.sub ? '<small>' + esc(s.sub) + '</small>' : '') + '</div>' +
        '<div class="funnel-track"><div class="funnel-bar" tabindex="0" style="width:' + w.toFixed(2) + '%;background:' + s.color + '" data-tip="' + esc(s.tip || '') + '" aria-label="' + esc(s.label + ': ' + s.valueText + ', ' + s.shareText) + '"></div></div>' +
        '<div class="funnel-val"><strong>' + esc(s.valueText) + '</strong><small>' + esc(s.shareText) + '</small></div>' +
        '</li>';
    });
    html += '</ol>';
    if (opts.note) html += '<p class="fine">' + esc(opts.note) + '</p>';
    if (opts.table) html += table(opts.table.caption, opts.table.head, opts.table.rows);
    el.innerHTML = html;
  }

  /* ---------------------------------------------------------------- */
  /* Linha (SVG)                                                       */
  /* opts.points: [{x, y}] ; opts.fmtY ; opts.fmtX                     */
  /* ---------------------------------------------------------------- */
  function line(el, opts) {
    var pts = opts.points || [];
    if (pts.length < 2) { el.innerHTML = ''; return; }
    var W = 560, H = 220, m = { l: 64, r: 16, t: 14, b: 30 };
    var ys = pts.map(function (p) { return p.y; });
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (y0 === y1) { y0 = y0 * 0.9; y1 = y1 * 1.1 || 1; }
    var pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad;
    var x0 = pts[0].x, x1 = pts[pts.length - 1].x;
    function sx(x) { return m.l + (x - x0) / (x1 - x0) * (W - m.l - m.r); }
    function sy(y) { return H - m.b - (y - y0) / (y1 - y0) * (H - m.t - m.b); }
    var grid = '';
    for (var g = 0; g <= 3; g++) {
      var gy = y0 + (y1 - y0) * g / 3;
      grid += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + sy(gy).toFixed(1) + '" y2="' + sy(gy).toFixed(1) + '" class="grid"/>' +
        '<text x="' + (m.l - 8) + '" y="' + (sy(gy) + 4).toFixed(1) + '" text-anchor="end" class="axis">' + esc(opts.fmtY(gy)) + '</text>';
    }
    var step = Math.max(1, Math.ceil(pts.length / 8));
    var xl = pts.map(function (p, i) {
      return (i % step === 0 || i === pts.length - 1) ? '<text x="' + sx(p.x).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" class="axis">' + esc(opts.fmtX(p.x)) + '</text>' : '';
    }).join('');
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1); }).join(' ');
    var dots = pts.map(function (p) {
      return '<circle cx="' + sx(p.x).toFixed(1) + '" cy="' + sy(p.y).toFixed(1) + '" r="5" class="dot" tabindex="0" data-tip="' + esc(opts.fmtX(p.x) + '\n' + opts.fmtY(p.y)) + '" aria-label="' + esc(opts.fmtX(p.x) + ': ' + opts.fmtY(p.y)) + '"/>';
    }).join('');
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="line-chart" role="img" aria-label="' + esc(opts.ariaLabel || '') + '">' + grid + xl +
      '<path d="' + d + '" class="line"/>' + dots + '</svg>';
  }

  /* ---------------------------------------------------------------- */
  /* Tooltip único                                                     */
  /* ---------------------------------------------------------------- */
  function initTooltips() {
    var tip = document.getElementById('tooltip');
    if (!tip) return;
    var current = null;

    function show(target) {
      var text = target.getAttribute('data-tip');
      if (!text) return;
      current = target;
      var lines = text.split('\n');
      tip.innerHTML = '<strong>' + esc(lines[0]) + '</strong>' + lines.slice(1).map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('');
      tip.hidden = false;
      var r = target.getBoundingClientRect();
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var x = r.left + r.width / 2 - tw / 2;
      x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
      var y = r.top - th - 10;
      if (y < 8) y = r.bottom + 10;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
      if (target.classList.contains('info-btn')) target.setAttribute('aria-expanded', 'true');
    }
    function hide() {
      if (current && current.classList.contains('info-btn')) current.setAttribute('aria-expanded', 'false');
      current = null; tip.hidden = true;
    }
    function find(e) { return e.target && e.target.closest ? e.target.closest('[data-tip]') : null; }

    document.addEventListener('mouseover', function (e) { var t = find(e); if (t) show(t); });
    document.addEventListener('mouseout', function (e) { var t = find(e); if (t && t === current && !t.contains(e.relatedTarget)) hide(); });
    document.addEventListener('focusin', function (e) { var t = find(e); if (t) show(t); else hide(); });
    document.addEventListener('focusout', function (e) { if (find(e) === current) hide(); });
    document.addEventListener('click', function (e) {
      var t = find(e);
      if (t && t.classList.contains('info-btn')) { e.preventDefault(); if (current === t && !tip.hidden) hide(); else show(t); }
      else if (!t) hide();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
    window.addEventListener('scroll', function () {
      if (!current) return;
      var r = current.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) hide(); else show(current);
    }, { passive: true });
  }

  root.WeekCharts = { bars: bars, stacked: stacked, funnel: funnel, line: line, initTooltips: initTooltips, esc: esc };
})(typeof self !== 'undefined' ? self : this);
