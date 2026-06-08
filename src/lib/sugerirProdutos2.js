const ORDEM = ['N', 'K', 'P', 'B', 'Zn', 'Mn', 'Cu'];
const TOXICOS = new Set(['K', 'B', 'Zn', 'Mn', 'Cu']);
const NUT_KEY = {
  N: 'n_pct', K: 'k2o_pct', P: 'p2o5_pct', B: 'b_pct',
  Zn: 'zn_pct', Mn: 'mn_pct', Cu: 'cu_pct', Mg: 'mg_pct'
};

export function sugerirProdutosInteligente(todos, rec) {
  if (!todos.length || !rec) return {};
  const saldo = {};
  for (const [s, key] of Object.entries(NUT_KEY)) {
    const v = rec[s];
    saldo[s] = typeof v === 'number' && v > 0 ? v : 0;
  }
  const sugestoes = {};
  for (const simbolo of ORDEM) {
    const nutKey = NUT_KEY[simbolo];
    if (!nutKey || saldo[simbolo] <= 0) {
      if (nutKey) sugestoes[nutKey] = { produtoId: null, doseManual: '' };
      continue;
    }
    let melhor = null, melhorScore = -Infinity, melhorDose = Infinity;
    for (const prod of todos) {
      const pct = parseFloat(prod[nutKey]) || 0;
      if (pct === 0) continue;
      const dose = saldo[simbolo] / (pct / 100);
      let score = 0;
      const PESOS = { N: 3, K: 3, P: 3, B: 1, Zn: 1, Mn: 1, Cu: 1, Mg: 1 };
      for (const [s2, k2] of Object.entries(NUT_KEY)) {
        const temNut = (parseFloat(prod[k2]) || 0) > 0;
        const peso = PESOS[s2] || 1;
        if (!temNut) continue;
        score += saldo[s2] > 0 ? peso : -2;
      }
      let toxico = false;
      for (const tox of TOXICOS) {
        const pctTox = parseFloat(prod[NUT_KEY[tox]]) || 0;
        if (pctTox === 0) continue;
        const fornece = dose * (pctTox / 100);
        const recTox = rec[tox] || 0;
        if (fornece > (recTox > 0 ? recTox : 0.001)) { toxico = true; break; }
      }
      if (toxico) continue;
      if (score > melhorScore || (score === melhorScore && dose < melhorDose)) {
        melhorScore = score; melhorDose = dose; melhor = prod;
      }
    }
    if (!melhor) { sugestoes[nutKey] = { produtoId: null, doseManual: '' }; continue; }
    const pctEsc = parseFloat(melhor[nutKey]) || 0;
    const doseEsc = pctEsc > 0 ? saldo[simbolo] / (pctEsc / 100) : 0;
    sugestoes[nutKey] = { produtoId: melhor.id, doseManual: String(Math.round(doseEsc * 10) / 10) };
    for (const [s2, k2] of Object.entries(NUT_KEY)) {
      if (s2 === simbolo) continue;
      const pct2 = parseFloat(melhor[k2]) || 0;
      if (pct2 > 0) saldo[s2] = Math.max(0, (saldo[s2] || 0) - doseEsc * (pct2 / 100));
    }
    saldo[simbolo] = 0;
  }
  return sugestoes;
}