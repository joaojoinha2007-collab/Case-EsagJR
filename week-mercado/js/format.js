/*
 * format.js — Formatação brasileira de números, moeda e percentuais (Intl.NumberFormat).
 * Arredondamento acontece somente aqui, na camada de apresentação.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WeekFormat = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var cache = {};
  function nf(min, max) {
    var k = min + ':' + max;
    if (!cache[k]) cache[k] = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
    return cache[k];
  }

  /* Número com casas decimais fixas: num(1234.5, 1) → "1.234,5" */
  function num(v, d) { d = d == null ? 0 : d; return nf(d, d).format(v); }

  /* Número compacto em mi / bi / mil: compact(2.6e6) → "2,6 mi" */
  function compact(v, d) {
    var a = Math.abs(v);
    if (a >= 1e9) return num(v / 1e9, d == null ? 2 : d) + ' bi';
    if (a >= 1e6) return num(v / 1e6, d == null ? 1 : d) + ' mi';
    if (a >= 1e4) return num(v / 1e3, d == null ? 1 : d) + ' mil';
    return num(v, 0);
  }

  /* Moeda compacta: money(1896.3e6) → "R$ 1,90 bi"; money(97.2e6) → "R$ 97,2 mi" */
  function money(v, d) {
    var a = Math.abs(v), sign = v < 0 ? '−' : '';
    if (a >= 1e9) return sign + 'R$ ' + num(a / 1e9, d == null ? 2 : d) + ' bi';
    if (a >= 1e6) return sign + 'R$ ' + num(a / 1e6, d == null ? (a >= 1e7 ? 1 : 2) : d) + ' mi';
    if (a >= 1e3) return sign + 'R$ ' + num(a / 1e3, d == null ? 1 : d) + ' mil';
    return sign + 'R$ ' + num(a, 2);
  }

  /* Moeda em milhões sempre (útil para comparar com o PDF): moneyMi(1896.3e6) → "R$ 1.896,3 mi" */
  function moneyMi(v, d) { return 'R$ ' + num(v / 1e6, d == null ? 1 : d) + ' mi'; }

  /* Moeda completa: brl(3.5) → "R$ 3,50" */
  var brlF = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function brl(v) { return brlF.format(v); }

  /* Percentual a partir de fração: pct(0.0978, 2) → "9,78%" */
  function pct(v, d) { return num(v * 100, d == null ? 1 : d) + '%'; }

  /* Variação com sinal: signedPct(0.1) → "+10,0%" */
  function signedPct(v, d) {
    if (v == null || !isFinite(v)) return '—';
    var s = v > 0.00005 ? '+' : (v < -0.00005 ? '−' : '±');
    return s + num(Math.abs(v) * 100, d == null ? 1 : d) + '%';
  }
  function signedMoney(v) {
    if (Math.abs(v) < 0.5) return '± R$ 0';
    return (v > 0 ? '+' : '−') + money(Math.abs(v)).replace('−', '');
  }

  return { num: num, compact: compact, money: money, moneyMi: moneyMi, brl: brl, pct: pct, signedPct: signedPct, signedMoney: signedMoney };
});
