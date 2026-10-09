/*
 * Testes das fórmulas centrais — executar com:  node --test week-mercado/tests
 * (Node 18+; sem dependências externas)
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calc.js');
const D = require('../js/data.js');
const F = require('../js/format.js');

const close = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const within = (a, b, tol) => assert.ok(Math.abs(a - b) / Math.abs(b) <= tol, `${a} vs ${b} (tol ${tol * 100}%)`);

/* ------------------------- B2C cenário-base ------------------------- */
test('B2C — TAM por segmento reproduz o PDF exatamente', () => {
  const r = C.computeB2C();
  const s = r.levels.tam.segments;
  close(s.academia.pessoas, 2.6e6); close(s.academia.volume, 249.6e6); close(s.academia.valor, 873.6e6);
  close(s.trabalho.pessoas, 2.4e6); close(s.trabalho.volume, 230.4e6); close(s.trabalho.valor, 806.4e6);
  close(s.viagem.pessoas, 20.6e6); close(s.viagem.volume, 61.8e6); close(s.viagem.valor, 216.3e6);
  close(r.levels.tam.total.volume, 541.8e6); close(r.levels.tam.total.valor, 1896.3e6); close(r.levels.tam.total.pessoas, 25.6e6);
});

test('B2C — fator do SAM = 41,8% × 31% × 75,5% ≈ 9,78%', () => {
  const r = C.computeB2C();
  close(r.factorSummary.sam, 0.418 * 0.31 * 0.755);
  assert.equal(Math.round(r.factorSummary.sam * 10000) / 100, 9.78);
});

test('B2C — SAM e SOM totais conferem com o PDF (≈ R$ 185,5 mi e ≈ R$ 97,2 mi)', () => {
  const r = C.computeB2C();
  within(r.levels.sam.total.valor, 185.5e6, 0.001);
  within(r.levels.som.total.valor, 97.2e6, 0.001);
  within(r.levels.sam.total.volume, 53.0e6, 0.005);
  within(r.levels.som.total.volume, 27.8e6, 0.005);
  close(r.levels.som.total.valor, r.levels.sam.total.valor * 0.524);
});

/* ------------------------- B2B cenário-base ------------------------- */
test('B2B — TAM Sudeste reproduz o PDF', () => {
  const r = C.computeB2B();
  const s = r.levels.tam.segments;
  within(s.academias.pessoas, 1.170e6, 0.001);
  within(s.academias.volume, 112.3e6, 0.001);
  within(s.academias.valor, 336.9e6, 0.001);
  within(s.hoteis.pessoas, 196.0e3, 0.001);
  within(s.hoteis.volume, 71.5e6, 0.001);
  within(s.hoteis.valor, 214.6e6, 0.001);
  within(r.levels.tam.total.valor, 551.5e6, 0.001);
  assert.equal(r.levels.tam.total.estabelecimentos, 32341);
});

test('B2B — fatores do SAM por segmento (17,22% e 45,60%)', () => {
  const r = C.computeB2B();
  assert.equal((r.factors.sam.academias * 100).toFixed(2), '17.22');
  assert.equal((r.factors.sam.hoteis * 100).toFixed(2), '45.60');
});

test('B2B — SAM SP e SOM Campinas conferem com o PDF', () => {
  const r = C.computeB2B();
  within(r.levels.sam.total.valor, 155.8e6, 0.001);
  within(r.levels.som.total.valor, 5.61e6, 0.002);
  assert.equal(Math.round(r.levels.sam.total.estabelecimentos), 6161);
  assert.equal(Math.round(r.levels.som.segments.academias.estabelecimentos) + r.levels.som.segments.hoteis.estabelecimentos, 195);
  assert.equal(Math.round(r.levels.som.segments.hoteis.pessoas), 3217);
});

/* ------------------------- Conferência e verificações ------------------------- */
test('Conferência: nenhuma divergência acima da tolerância de arredondamento', () => {
  ['b2c', 'b2b'].forEach((m) => {
    const rows = C.reconcile(C.compute(m));
    assert.ok(rows.length > 20);
    const bad = rows.filter((x) => x.status === 'divergencia');
    assert.deepEqual(bad, [], `${m}: ${JSON.stringify(bad)}`);
  });
});

test('Verificações automáticas passam no cenário-base', () => {
  ['b2c', 'b2b'].forEach((m) => {
    const failed = C.checks(C.compute(m)).filter((c) => !c.pass);
    assert.deepEqual(failed, []);
  });
});

/* ------------------------- Cenários simulados ------------------------- */
test('Simulação B2C — preço R$ 4,00 escala TAM, SAM e SOM proporcionalmente', () => {
  const base = C.computeB2C();
  const i = C.baseInputs('b2c'); i.preco = 4;
  const sim = C.computeB2C(i);
  C.LEVELS.forEach((l) => close(sim.levels[l].total.valor, base.levels[l].total.valor * 4 / 3.5));
  const d = C.diff(sim, base);
  close(d.tam.valorRel, 4 / 3.5 - 1);
  close(d.tam.volumeRel, 0);
});

test('Simulação B2C — alterar o fator do SOM não altera TAM nem SAM', () => {
  const base = C.computeB2C();
  const i = C.baseInputs('b2c'); i.pesoSP = 0.30;
  const sim = C.computeB2C(i);
  close(sim.levels.tam.total.valor, base.levels.tam.total.valor);
  close(sim.levels.sam.total.valor, base.levels.sam.total.valor);
  close(sim.levels.som.total.valor, base.levels.sam.total.valor * 0.30);
});

test('Simulação B2C — % de banho na academia só afeta o segmento academia', () => {
  const base = C.computeB2C();
  const i = C.baseInputs('b2c'); i.pctBanhoAcademia = 0.40;
  const sim = C.computeB2C(i);
  close(sim.levels.tam.segments.academia.valor, base.levels.tam.segments.academia.valor * 2);
  close(sim.levels.tam.segments.trabalho.valor, base.levels.tam.segments.trabalho.valor);
  close(sim.levels.tam.segments.viagem.valor, base.levels.tam.segments.viagem.valor);
});

test('Simulação B2B — filtro premium só afeta academias no SAM/SOM', () => {
  const base = C.computeB2B();
  const i = C.baseInputs('b2b'); i.pctPremium = 0.62;
  const sim = C.computeB2B(i);
  close(sim.levels.tam.total.valor, base.levels.tam.total.valor);
  close(sim.levels.sam.segments.academias.valor, base.levels.sam.segments.academias.valor * 2);
  close(sim.levels.sam.segments.hoteis.valor, base.levels.sam.segments.hoteis.valor);
  close(sim.levels.som.segments.hoteis.valor, base.levels.som.segments.hoteis.valor);
});

test('Simulação B2B — kits por quarto 0,5 reduz pela metade o volume hoteleiro em todos os níveis', () => {
  const base = C.computeB2B();
  const i = C.baseInputs('b2b'); i.kitsPorQuarto = 0.5;
  const sim = C.computeB2B(i);
  C.LEVELS.forEach((l) => {
    close(sim.levels[l].segments.hoteis.volume, base.levels[l].segments.hoteis.volume / 2);
    close(sim.levels[l].segments.academias.volume, base.levels[l].segments.academias.volume);
  });
});

test('Modelos são independentes — alterar B2B não altera B2C', () => {
  const b2cBefore = C.computeB2C().levels.som.total.valor;
  const i = C.baseInputs('b2b'); i.fatorCampinasAcademias = 0.2; i.preco = 10;
  C.computeB2B(i);
  close(C.computeB2C().levels.som.total.valor, b2cBefore);
  assert.notEqual(C.baseInputs('b2b').preco, 10, 'baseInputs devolve cópia — o cenário-base não pode ser alterado');
});

test('changedInputs identifica premissas alteradas', () => {
  const i = C.baseInputs('b2c'); i.preco = 5; i.pesoSP = 0.5;
  assert.deepEqual(C.changedInputs('b2c', i).sort(), ['pesoSP', 'preco']);
  assert.deepEqual(C.changedInputs('b2c', C.baseInputs('b2c')), []);
});

test('Sensibilidade: +10% em premissa multiplicativa → +10% no total afetado', () => {
  const s = C.sensitivity('b2c', 'preco', 0.1);
  close(s.tam, 0.1, 1e-9); close(s.som, 0.1, 1e-9);
  const sp = C.sensitivity('b2c', 'pesoSP', 0.1);
  close(sp.tam, 0); close(sp.sam, 0); close(sp.som, 0.1, 1e-9);
});

/* ------------------------- Entradas inválidas ------------------------- */
test('Entradas inválidas não contaminam os cálculos', () => {
  const i = C.baseInputs('b2c'); i.preco = -1;
  const r = C.computeB2C(i);
  assert.equal(r.valid, false);
  assert.ok(r.errors.length >= 1);
  const j = C.baseInputs('b2b'); j.ocupacao = NaN;
  assert.equal(C.computeB2B(j).valid, false);
  const k = C.baseInputs('b2b'); k.pctPremium = 1.5;
  assert.equal(C.computeB2B(k).valid, false);
});

test('parseUserValue: vírgula decimal, %, limites e texto inválido', () => {
  let p = C.parseUserValue('b2c', 'preco', '4,25');
  assert.equal(p.ok, true); close(p.value, 4.25);
  p = C.parseUserValue('b2c', 'pctBanhoAcademia', '35%');
  assert.equal(p.ok, true); close(p.value, 0.35);
  p = C.parseUserValue('b2c', 'pctBanhoAcademia', '-10');
  assert.equal(p.ok, true); close(p.value, 0); assert.ok(p.note);
  p = C.parseUserValue('b2c', 'pctBanhoAcademia', '250');
  close(p.value, 1);
  assert.equal(C.parseUserValue('b2c', 'preco', 'abc').ok, false);
  assert.equal(C.parseUserValue('b2c', 'preco', '').ok, false);
  assert.equal(C.parseUserValue('b2c', 'inexistente', '1').ok, false);
});

/* ------------------------- CAGR ------------------------- */
test('CAGR — fórmula (VF/VI)^(1/n) − 1', () => {
  const r = C.cagr(100, 200, 5);
  assert.equal(r.ok, true);
  close(r.rate, Math.pow(2, 1 / 5) - 1);
  close(C.cagr(100, 100, 3).rate, 0);
  assert.ok(C.cagr(200, 100, 2).rate < 0);
  const series = C.projectSeries(100, r.rate, 5);
  assert.equal(series.length, 6);
  close(series[5], 200, 1e-9);
});

test('CAGR — rejeita entradas inválidas', () => {
  assert.equal(C.cagr(0, 100, 5).ok, false);
  assert.equal(C.cagr(100, -1, 5).ok, false);
  assert.equal(C.cagr(100, 200, 0).ok, false);
  assert.equal(C.cagr('x', 200, 3).ok, false);
});

/* ------------------------- Dados e formatação ------------------------- */
test('Tabela de premissas: toda premissa tem fonte, confiança e status válidos', () => {
  const conf = D.CONFIDENCE.map((c) => c.id);
  D.ASSUMPTIONS.forEach((a) => {
    assert.ok(conf.includes(a.confidence), a.id);
    assert.ok(D.STATUS[a.status], a.id);
    a.sources.forEach((s) => assert.ok(D.SOURCES[s], `${a.id}: fonte ${s}`));
    if (a.key) assert.equal(typeof D.BASE_INPUTS[a.model][a.key], 'number', `${a.id}: chave ${a.key}`);
  });
  Object.values(D.SOURCES).forEach((s) => { if (s.url) assert.match(s.url, /^https:\/\//); });
});

test('Specs do simulador apontam para premissas existentes', () => {
  ['b2c', 'b2b'].forEach((m) => C.INPUT_SPECS[m].forEach((s) => {
    assert.equal(typeof D.BASE_INPUTS[m][s.key], 'number', `${m}.${s.key}`);
    const v = C.toDisplay(m, s.key, D.BASE_INPUTS[m][s.key]);
    assert.ok(v >= s.min && v <= s.max, `${m}.${s.key} base fora dos limites`);
  }));
});

test('Formatação brasileira', () => {
  assert.equal(F.money(1896.3e6), 'R$ 1,90 bi');
  assert.equal(F.money(97.21e6), 'R$ 97,2 mi');
  assert.equal(F.money(5.61e6), 'R$ 5,61 mi');
  assert.equal(F.moneyMi(1896.3e6), 'R$ 1.896,3 mi');
  assert.equal(F.pct(0.0978, 2), '9,78%');
  assert.equal(F.compact(2.6e6), '2,6 mi');
  assert.equal(F.signedPct(0.1), '+10,0%');
  assert.equal(F.brl(3.5).replace(/\s/g, ' '), 'R$ 3,50');
});
