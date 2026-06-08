/**
 * Sugestão inteligente de produtos para um conjunto de nutrientes.
 * Baseada na mesma lógica do módulo AbaPlanejamento (Adubação clássica).
 *
 * rec: { N, P, K, B } — doses em kg/ha de nutriente
 * todos: array de produtos (FertilizanteFormulado + FonteSimples)
 * Retorna: { [nutriente_key]: { produtoId, doseManual } }
 */

const SALDO_PARA_KEY = {
  N: 'n_pct',
  K: 'k2o_pct',
  P: 'p2o5_pct',
  B: 'b_pct',
};

const ORDEM = ['N', 'K', 'P', 'B'];
const TOXICOS = new Set(['B']);

export function sugerirProdutosInteligente(todos, rec) {
  if (!todos.length || !rec) return {};

  const saldo = {};
  for (const [simbolo, key] of Object.entries(SALDO_PARA_KEY)) {
    const v = rec[simbolo];
    saldo[simbolo] = typeof v === 'number' && v > 0 ? v : 0;
  }

  const sugestoes = {};

  for (const simbolo of ORDEM) {
    const nutKey = SALDO_PARA_KEY[simbolo];

    if (saldo[simbolo] <= 0) {
      sugestoes[nutKey] = { produtoId: null, doseManual: '' };
      continue;
    }

    const saldoAtual = saldo[simbolo];
    let melhor = null;
    let melhorScore = -Infinity;
    let melhorDose = Infinity;

    for (const prod of todos) {
      const pctPrincipal = parseFloat(prod[nutKey]) || 0;
      if (pctPrincipal === 0) continue;

      let score = 0;
      for (const s of ORDEM) {
        const temNutriente = (parseFloat(prod[SALDO_PARA_KEY[s]]) || 0) > 0;
        if (!temNutriente) continue;
        score += (rec[s] != null && rec[s] > 0) ? 1 : -2;
      }

      const doseNecessaria = saldoAtual / (pctPrincipal / 100);

      for (const toxico of TOXICOS) {
        const pctToxico = parseFloat(prod[SALDO_PARA_KEY[toxico]]) || 0;
        if (pctToxico === 0) continue;
        const fornecimento = doseNecessaria * (pctToxico / 100);
        const recToxico = rec[toxico] || 0;
        if (recToxico > 0 && fornecimento > recToxico) score -= 10;
      }

      if (score > melhorScore || (score === melhorScore && doseNecessaria < melhorDose)) {
        melhorScore = score;
        melhorDose = doseNecessaria;
        melhor = prod;
      }
    }

    if (!melhor) {
      sugestoes[nutKey] = { produtoId: null, doseManual: '' };
      continue;
    }

    const recOriginal = rec[simbolo] || 0;
    const doseSugerida = TOXICOS.has(simbolo)
      ? Math.min(saldoAtual, recOriginal)
      : saldoAtual;
    sugestoes[nutKey] = { produtoId: melhor.id, doseManual: String(Math.round(doseSugerida * 10) / 10) };

    const pctEscolhido = parseFloat(melhor[nutKey]) || 0;
    const doseProdutoHa = pctEscolhido > 0 ? saldo[simbolo] / (pctEscolhido / 100) : 0;

    for (const [outroSimbolo, outroKey] of Object.entries(SALDO_PARA_KEY)) {
      if (outroSimbolo === simbolo) continue;
      const pctOutro = parseFloat(melhor[outroKey]) || 0;
      if (pctOutro > 0) {
        const repoe = doseProdutoHa * (pctOutro / 100);
        saldo[outroSimbolo] = Math.max(0, (saldo[outroSimbolo] || 0) - repoe);
      }
    }
    saldo[simbolo] = 0;
  }

  return sugestoes;
}