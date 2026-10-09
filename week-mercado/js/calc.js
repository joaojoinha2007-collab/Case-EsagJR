/*
 * calc.js — Motor de cálculo TAM / SAM / SOM / CAGR (independente da interface).
 *
 * Todas as contas são feitas com precisão total; o arredondamento acontece
 * apenas na exibição (format.js). Os resultados de referência do PDF NUNCA
 * entram no cálculo — servem só para a conferência (reconcile).
 *
 * Estrutura de um resultado:
 *   {
 *     model: 'b2c' | 'b2b',
 *     inputs: {...premissas efetivamente aplicadas...},
 *     factors: { sam: {segId: f}, som: {segId: f} },
 *     levels: {
 *       tam: { segments: { segId: { pessoas, volume, valor, estabelecimentos? } }, total: {...} },
 *       sam: {...}, som: {...}
 *     }
 *   }
 *
 * Funciona no navegador (window.WeekCalc) e no Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.WeekCalc = factory(root.WeekData);
})(typeof self !== 'undefined' ? self : this, function (DATA) {
  'use strict';

  var LEVELS = ['tam', 'sam', 'som'];

  /* ------------------------------------------------------------------ */
  /* Especificação dos controles do simulador (limites e unidades)       */
  /* type: 'pct' → armazenado como fração, exibido em %                  */
  /*       'num' → número simples; 'brl' → reais                         */
  /* ------------------------------------------------------------------ */
  var INPUT_SPECS = {
    b2c: [
      { key: 'pctBanhoAcademia', label: '% de alunos que tomam banho na academia', type: 'pct', min: 0, max: 100, step: 0.5, group: 'Segmentos (TAM)', segment: 'academia' },
      { key: 'pctBanhoTrabalho', label: '% de trabalhadores que tomam banho no trabalho', type: 'pct', min: 0, max: 50, step: 0.5, group: 'Segmentos (TAM)', segment: 'trabalho' },
      { key: 'banhosAno', label: 'Banhos por ano por pessoa (academia e trabalho)', type: 'num', unit: 'banhos/ano', min: 0, max: 365, step: 1, group: 'Segmentos (TAM)', segment: 'academia,trabalho' },
      { key: 'banhosPorViagem', label: 'Banhos por viagem', type: 'num', unit: 'banhos', min: 0, max: 15, step: 0.5, group: 'Segmentos (TAM)', segment: 'viagem' },
      { key: 'preco', label: 'Preço por kit (1 lavagem)', type: 'brl', min: 0.5, max: 20, step: 0.05, group: 'Preço', segment: 'todos' },
      { key: 'pesoSudeste', label: 'Peso do Sudeste na população', type: 'pct', min: 0, max: 100, step: 0.1, group: 'Filtros do SAM (Sudeste)', segment: 'todos' },
      { key: 'pctClassesAB', label: '% classes A e B no Sudeste', type: 'pct', min: 0, max: 100, step: 0.5, group: 'Filtros do SAM (Sudeste)', segment: 'todos' },
      { key: 'pctOnline', label: '% de A/B que compra online', type: 'pct', min: 0, max: 100, step: 0.5, group: 'Filtros do SAM (Sudeste)', segment: 'todos' },
      { key: 'pesoSP', label: 'Fator geográfico do SOM (peso de SP no Sudeste)', type: 'pct', min: 0, max: 100, step: 0.1, group: 'Filtro do SOM (estado de SP)', segment: 'todos' }
    ],
    b2b: [
      { key: 'pctBanhoAcademia', label: '% de alunos que tomam banho na academia', type: 'pct', min: 0, max: 100, step: 0.5, group: 'Academias (TAM)', segment: 'academias' },
      { key: 'banhosAno', label: 'Banhos por ano por aluno', type: 'num', unit: 'banhos/ano', min: 0, max: 365, step: 1, group: 'Academias (TAM)', segment: 'academias' },
      { key: 'ocupacao', label: 'Taxa de ocupação hoteleira', type: 'pct', min: 0, max: 100, step: 0.1, group: 'Hotéis (TAM)', segment: 'hoteis' },
      { key: 'kitsPorQuarto', label: 'Kits por quarto ocupado por noite', type: 'num', unit: 'kits', min: 0, max: 5, step: 0.1, group: 'Hotéis (TAM)', segment: 'hoteis' },
      { key: 'preco', label: 'Preço B2B por kit', type: 'brl', min: 0.5, max: 20, step: 0.05, group: 'Preço', segment: 'todos' },
      { key: 'pesoSPAcademias', label: 'Peso de SP nas academias do Sudeste', type: 'pct', min: 0, max: 100, step: 0.1, group: 'Filtros do SAM (estado de SP)', segment: 'academias' },
      { key: 'pctPremium', label: '% de academias com perfil premium', type: 'pct', min: 0, max: 100, step: 0.5, group: 'Filtros do SAM (estado de SP)', segment: 'academias' },
      { key: 'pesoSPQuartos', label: 'Peso de SP nos quartos do Sudeste', type: 'pct', min: 0, max: 100, step: 0.1, group: 'Filtros do SAM (estado de SP)', segment: 'hoteis' },
      { key: 'pctHoteis', label: '% dos quartos de SP que são de hotéis', type: 'pct', min: 0, max: 100, step: 0.1, group: 'Filtros do SAM (estado de SP)', segment: 'hoteis' },
      { key: 'fatorCampinasAcademias', label: 'Fator de Campinas — academias', type: 'pct', min: 0, max: 20, step: 0.1, group: 'Filtros do SOM (Campinas)', segment: 'academias' },
      { key: 'fatorCampinasHoteis', label: 'Fator de Campinas — hotéis', type: 'pct', min: 0, max: 20, step: 0.1, group: 'Filtros do SOM (Campinas)', segment: 'hoteis' }
    ]
  };

  /* Limites gerais de sanidade para TODAS as entradas numéricas (inclusive as não expostas). */
  var FRACTION_KEYS = {
    b2c: ['pctBanhoAcademia', 'pctBanhoTrabalho', 'pesoSudeste', 'pctClassesAB', 'pctOnline', 'pesoSP'],
    b2b: ['pctBanhoAcademia', 'ocupacao', 'pesoSPAcademias', 'pctPremium', 'pesoSPQuartos', 'pctHoteis', 'fatorCampinasAcademias', 'fatorCampinasHoteis']
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function baseInputs(model) {
    if (!DATA.BASE_INPUTS[model]) throw new Error('Modelo desconhecido: ' + model);
    return clone(DATA.BASE_INPUTS[model]);
  }

  function getSpec(model, key) {
    var list = INPUT_SPECS[model] || [];
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Validação                                                           */
  /* ------------------------------------------------------------------ */
  function validateInputs(model, inputs) {
    var errors = [];
    var base = DATA.BASE_INPUTS[model];
    if (!base) return ['Modelo desconhecido: ' + model];
    Object.keys(base).forEach(function (k) {
      var v = inputs[k];
      if (typeof v !== 'number' || !isFinite(v)) errors.push(k + ': valor ausente ou não numérico');
      else if (v < 0) errors.push(k + ': valor negativo não é permitido');
    });
    FRACTION_KEYS[model].forEach(function (k) {
      if (typeof inputs[k] === 'number' && inputs[k] > 1) errors.push(k + ': percentual acima de 100%');
    });
    return errors;
  }

  /*
   * Converte o texto digitado pelo usuário (na unidade de exibição) em valor interno.
   * Aceita vírgula decimal. Valores fora dos limites são ajustados ao limite e
   * sinalizados; entradas inválidas retornam ok:false e NÃO alteram o cenário.
   */
  function parseUserValue(model, key, raw) {
    var spec = getSpec(model, key);
    if (!spec) return { ok: false, error: 'Premissa desconhecida.' };
    var str = String(raw == null ? '' : raw).trim().replace(/\s/g, '').replace('%', '').replace(/^R\$/i, '');
    if (/,/.test(str)) str = str.replace(/\./g, '').replace(',', '.');
    if (str === '' || !/^-?\d*\.?\d+$/.test(str)) return { ok: false, error: 'Digite um número válido.' };
    var n = parseFloat(str);
    if (!isFinite(n)) return { ok: false, error: 'Digite um número válido.' };
    var note = null;
    if (n < spec.min) { note = 'Valor ajustado ao mínimo permitido (' + spec.min + ').'; n = spec.min; }
    if (n > spec.max) { note = 'Valor ajustado ao máximo permitido (' + spec.max + ').'; n = spec.max; }
    var value = spec.type === 'pct' ? n / 100 : n;
    return { ok: true, value: value, display: n, note: note };
  }

  function toDisplay(model, key, value) {
    var spec = getSpec(model, key);
    return spec && spec.type === 'pct' ? value * 100 : value;
  }

  /* ------------------------------------------------------------------ */
  /* Núcleo genérico: segmento → (pessoas × frequência) × preço          */
  /* ------------------------------------------------------------------ */
  function line(pessoas, porUnidade, preco, estab) {
    var volume = pessoas * porUnidade;
    var o = { pessoas: pessoas, volume: volume, valor: volume * preco };
    if (estab !== undefined) o.estabelecimentos = estab;
    return o;
  }

  function sumLines(segments) {
    var total = { pessoas: 0, volume: 0, valor: 0 };
    var hasEstab = false;
    Object.keys(segments).forEach(function (k) {
      var s = segments[k];
      total.pessoas += s.pessoas; total.volume += s.volume; total.valor += s.valor;
      if (s.estabelecimentos !== undefined) { hasEstab = true; total.estabelecimentos = (total.estabelecimentos || 0) + s.estabelecimentos; }
    });
    if (!hasEstab) delete total.estabelecimentos;
    return total;
  }

  function invalidResult(model, inputs, errors) {
    return { model: model, inputs: inputs, valid: false, errors: errors };
  }

  /* ------------------------------------------------------------------ */
  /* B2C — TAM Brasil, SAM Sudeste, SOM estado de SP                     */
  /* ------------------------------------------------------------------ */
  function factorSamB2C(i) { return i.pesoSudeste * i.pctClassesAB * i.pctOnline; }

  function computeB2C(inputs) {
    var i = inputs || baseInputs('b2c');
    var errors = validateInputs('b2c', i);
    if (errors.length) return invalidResult('b2c', i, errors);

    var fSam = factorSamB2C(i);
    var fSom = i.pesoSP;

    // Base de volume de cada segmento (pessoas ou viagens) e frequência anual
    var base = {
      academia: { pessoas: i.alunosAcademia * i.pctBanhoAcademia, freq: i.banhosAno },
      trabalho: { pessoas: i.trabalhadoresCLT * i.pctBanhoTrabalho, freq: i.banhosAno },
      viagem: { pessoas: i.viagens * i.viajantesPorViagem, freq: i.banhosPorViagem }
    };
    var factors = { sam: {}, som: {} };
    var levels = { tam: { segments: {} }, sam: { segments: {} }, som: { segments: {} } };

    Object.keys(base).forEach(function (seg) {
      var b = base[seg];
      factors.sam[seg] = fSam;
      factors.som[seg] = fSom;
      var pTam = b.pessoas;
      var pSam = pTam * fSam;            // pessoas do TAM × fator do SAM
      var pSom = pSam * fSom;            // pessoas do SAM × fator do SOM
      levels.tam.segments[seg] = line(pTam, b.freq, i.preco);
      levels.sam.segments[seg] = line(pSam, b.freq, i.preco);
      levels.som.segments[seg] = line(pSom, b.freq, i.preco);
    });
    LEVELS.forEach(function (l) { levels[l].total = sumLines(levels[l].segments); });

    return { model: 'b2c', valid: true, inputs: i, factors: factors, factorSummary: { sam: fSam, som: fSom }, levels: levels };
  }

  /* ------------------------------------------------------------------ */
  /* B2B — TAM Sudeste, SAM estado de SP, SOM Campinas                   */
  /* ------------------------------------------------------------------ */
  function computeB2B(inputs) {
    var i = inputs || baseInputs('b2b');
    var errors = validateInputs('b2b', i);
    if (errors.length) return invalidResult('b2b', i, errors);

    var fSamAc = i.pesoSPAcademias * i.pctPremium;
    var fSamHt = i.pesoSPQuartos * i.pctHoteis;
    var fSomAc = i.fatorCampinasAcademias;
    var fSomHt = i.fatorCampinasHoteis;

    // Academias: usuários = academias × alunos/academia × % que toma banho; kits = usuários × banhos/ano
    var usuarios = i.academiasSudeste * i.alunosPorAcademia * i.pctBanhoAcademia;
    // Hotéis: quartos ocupados/noite = quartos × ocupação; kits = ocupados × 365 × kits/quarto
    var ocupados = i.quartosSudeste * i.ocupacao;
    var kitsPorOcupado = i.diasAno * i.kitsPorQuarto;

    var estabAcSam = i.academiasSudeste * fSamAc;     // = academias de SP × % premium
    var levels = {
      tam: { segments: {
        academias: line(usuarios, i.banhosAno, i.preco, i.academiasSudeste),
        hoteis: line(ocupados, kitsPorOcupado, i.preco, i.meiosHospedagemSudeste)
      } },
      sam: { segments: {
        academias: line(usuarios * fSamAc, i.banhosAno, i.preco, estabAcSam),
        hoteis: line(ocupados * fSamHt, kitsPorOcupado, i.preco, i.hoteisSAM)
      } },
      som: { segments: {
        academias: line(usuarios * fSamAc * fSomAc, i.banhosAno, i.preco, estabAcSam * fSomAc),
        hoteis: line(ocupados * fSamHt * fSomHt, kitsPorOcupado, i.preco, i.hoteisCampinas)
      } }
    };
    LEVELS.forEach(function (l) { levels[l].total = sumLines(levels[l].segments); });

    return {
      model: 'b2b', valid: true, inputs: i,
      factors: { sam: { academias: fSamAc, hoteis: fSamHt }, som: { academias: fSomAc, hoteis: fSomHt } },
      factorSummary: {
        sam: levels.tam.total.valor ? levels.sam.total.valor / levels.tam.total.valor : 0,
        som: levels.sam.total.valor ? levels.som.total.valor / levels.sam.total.valor : 0
      },
      levels: levels
    };
  }

  function compute(model, inputs) {
    if (model === 'b2c') return computeB2C(inputs);
    if (model === 'b2b') return computeB2B(inputs);
    throw new Error('Modelo desconhecido: ' + model);
  }

  /* ------------------------------------------------------------------ */
  /* Comparação com o cenário-base                                       */
  /* ------------------------------------------------------------------ */
  function diff(sim, base) {
    var out = {};
    LEVELS.forEach(function (l) {
      var a = sim.levels[l].total, b = base.levels[l].total;
      out[l] = {
        valorAbs: a.valor - b.valor,
        valorRel: b.valor ? (a.valor - b.valor) / b.valor : null,
        volumeAbs: a.volume - b.volume,
        volumeRel: b.volume ? (a.volume - b.volume) / b.volume : null
      };
    });
    return out;
  }

  function changedInputs(model, inputs) {
    var base = DATA.BASE_INPUTS[model];
    return Object.keys(base).filter(function (k) { return Math.abs(inputs[k] - base[k]) > 1e-12; });
  }

  /* ------------------------------------------------------------------ */
  /* Sensibilidade: efeito de +delta (relativo) numa premissa            */
  /* ------------------------------------------------------------------ */
  function sensitivity(model, key, delta, inputs) {
    var d = delta == null ? 0.10 : delta;
    var i = clone(inputs || DATA.BASE_INPUTS[model]);
    if (typeof i[key] !== 'number') return null;
    var base = compute(model, i);
    var j = clone(i);
    j[key] = i[key] * (1 + d);
    if (FRACTION_KEYS[model].indexOf(key) >= 0 && j[key] > 1) j[key] = 1;
    var sim = compute(model, j);
    if (!sim.valid || !base.valid) return null;
    var out = {};
    LEVELS.forEach(function (l) {
      var b = base.levels[l].total.valor;
      out[l] = b ? (sim.levels[l].total.valor - b) / b : 0;
    });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Conferência com o PDF e verificações automáticas                    */
  /* ------------------------------------------------------------------ */
  var TOL_OK = 0.0025;      // até 0,25% → confere
  var TOL_ROUND = 0.015;    // até 1,5% → diferença de arredondamento

  function classify(rel) {
    var a = Math.abs(rel);
    if (a <= TOL_OK) return 'confere';
    if (a <= TOL_ROUND) return 'arredondamento';
    return 'divergencia';
  }

  function reconcile(result) {
    var ref = DATA.REFERENCE[result.model];
    var rows = [];
    LEVELS.forEach(function (l) {
      var keys = Object.keys(ref[l]);
      keys.forEach(function (seg) {
        var calc = seg === 'total' ? result.levels[l].total : result.levels[l].segments[seg];
        Object.keys(ref[l][seg]).forEach(function (metric) {
          var r = ref[l][seg][metric];
          var c = calc[metric];
          var rel = r ? (c - r) / r : 0;
          rows.push({ model: result.model, level: l, segment: seg, metric: metric, calc: c, ref: r, diffAbs: c - r, diffRel: rel, status: classify(rel) });
        });
      });
    });
    return rows;
  }

  function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6) * Math.max(1, Math.abs(a), Math.abs(b)); }

  function checks(result) {
    var out = [];
    function add(id, label, pass, detail) { out.push({ id: id, label: label, pass: !!pass, detail: detail || '' }); }

    if (!result.valid) { add('valid', 'Entradas válidas', false, result.errors.join('; ')); return out; }
    add('valid', 'Entradas válidas (sem negativos, vazios ou percentuais > 100%)', true);

    var finite = true;
    LEVELS.forEach(function (l) {
      var all = [result.levels[l].total].concat(Object.keys(result.levels[l].segments).map(function (k) { return result.levels[l].segments[k]; }));
      all.forEach(function (o) { Object.keys(o).forEach(function (m) { if (!isFinite(o[m]) || o[m] < 0) finite = false; }); });
    });
    add('finite', 'Todos os resultados são números finitos e não negativos', finite);

    var sumsOk = LEVELS.every(function (l) {
      var s = 0; Object.keys(result.levels[l].segments).forEach(function (k) { s += result.levels[l].segments[k].valor; });
      return near(s, result.levels[l].total.valor);
    });
    add('sum', 'Soma dos segmentos = total em TAM, SAM e SOM', sumsOk);

    var t = result.levels.tam.total.valor, s = result.levels.sam.total.valor, o = result.levels.som.total.valor;
    add('order', 'TAM ≥ SAM ≥ SOM', t >= s - 1e-6 && s >= o - 1e-6);

    var factorsOk = true;
    ['sam', 'som'].forEach(function (l) { Object.keys(result.factors[l]).forEach(function (k) { var f = result.factors[l][k]; if (!(f >= 0 && f <= 1)) factorsOk = false; }); });
    add('factors', 'Fatores de filtro entre 0% e 100%', factorsOk);

    var i = result.inputs;
    if (result.model === 'b2c') {
      var fs = i.pesoSudeste * i.pctClassesAB * i.pctOnline;
      add('samcheck', 'Conferência do PDF: TAM total × fator do SAM = SAM total', near(t * fs, s));
      add('somcheck', 'Conferência do PDF: SAM total × fator do SOM = SOM total', near(s * i.pesoSP, o));
      add('scope', 'Filtros geográficos do B2C (Sudeste → SP) aplicados somente ao B2C', result.factors.sam.academia === fs && result.factors.som.viagem === i.pesoSP && result.factors.sam.academias === undefined);
    } else {
      var sa = result.levels.sam.segments;
      add('somcheck', 'Conferência do PDF: SAM academias × fator + SAM hotéis × fator = SOM total',
        near(sa.academias.valor * i.fatorCampinasAcademias + sa.hoteis.valor * i.fatorCampinasHoteis, o));
      add('samcheck', 'Fator do SAM aplicado por segmento (academias e hotéis têm filtros próprios)',
        near(result.levels.tam.segments.academias.valor * i.pesoSPAcademias * i.pctPremium, sa.academias.valor) &&
        near(result.levels.tam.segments.hoteis.valor * i.pesoSPQuartos * i.pctHoteis, sa.hoteis.valor));
      add('scope', 'Filtros geográficos do B2B (SP → Campinas) aplicados somente ao B2B', result.factors.sam.academia === undefined && result.factors.som.hoteis === i.fatorCampinasHoteis);
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* CAGR                                                                */
  /* ------------------------------------------------------------------ */
  function cagr(valorInicial, valorFinal, anos) {
    var vi = Number(valorInicial), vf = Number(valorFinal), n = Number(anos);
    if (![vi, vf, n].every(isFinite)) return { ok: false, error: 'Preencha os três campos com números.' };
    if (vi <= 0) return { ok: false, error: 'O valor inicial precisa ser maior que zero.' };
    if (vf <= 0) return { ok: false, error: 'O valor final precisa ser maior que zero.' };
    if (n <= 0) return { ok: false, error: 'O período precisa ser maior que zero.' };
    if (n > 100) return { ok: false, error: 'Use um período de até 100 anos.' };
    var rate = Math.pow(vf / vi, 1 / n) - 1;
    return { ok: true, rate: rate, multiple: vf / vi, totalGrowth: vf / vi - 1 };
  }

  function projectSeries(valorInicial, rate, anos) {
    var out = [];
    var n = Math.max(0, Math.round(anos));
    for (var k = 0; k <= n; k++) out.push(valorInicial * Math.pow(1 + rate, k));
    return out;
  }

  return {
    LEVELS: LEVELS,
    INPUT_SPECS: INPUT_SPECS,
    TOLERANCE: { ok: TOL_OK, rounding: TOL_ROUND },
    baseInputs: baseInputs,
    getSpec: getSpec,
    validateInputs: validateInputs,
    parseUserValue: parseUserValue,
    toDisplay: toDisplay,
    computeB2C: computeB2C,
    computeB2B: computeB2B,
    compute: compute,
    diff: diff,
    changedInputs: changedInputs,
    sensitivity: sensitivity,
    reconcile: reconcile,
    checks: checks,
    cagr: cagr,
    projectSeries: projectSeries
  };
});
