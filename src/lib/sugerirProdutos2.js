/**
 * Sugestão inteligente de produtos para um conjunto de nutrientes.
 * Lógica agronômica: seleciona o produto principal baseado no N,
 * depois busca complementares para os nutrientes residuais.
 *
 * rec: { N, P, K, B } — doses em kg/ha de nutriente puro
 * todos: array de produtos (FertilizanteFormulado + FonteSimples)
 * Retorna: { [nutriente_key]: { produtoId, doseManual } }
 */

const NUT_KEY = {
  N: 'n_pct',
  P: 'p2o5_pct',
  K: 'k2o_pct',
  B: 'b_pct',
};

// Nutrientes com restrição de toxicidade: não podem ultrapassar a rec
const TOXICOS_KEY = {
  K:  'k2o_pct',
  B:  'b_pct',
  Mn: 'mn_pct',
  Zn: 'zn_pct',
  Cu: 'cu_pct',
};

const ORDEM = ['N', 'K', 'P', 'B'];

function escolherProduto(todos, saldo, rec) {
  // Encontra o nutriente de maior demanda ainda em saldo (prioridade N > K > P > B)
  const simboloPrincipal = ORDEM.find(s => (saldo[s] || 0) > 0);
  if (!simboloPrincipal) return null;

  const nutKeyPrincipal = NUT_KEY[simboloPrincipal];
  const demandaPrincipal = saldo[simboloPrincipal];

  let melhor = null;
  let melhorScore = -Infinity;
  let melhorDose = Infinity;

  for (const prod of todos) {
    const pctPrincipal = parseFloat(prod[nutKeyPrincipal]) || 0;
    if (pctPrincipal === 0) continue;

    // Dose baseada no nutriente principal
    const doseHa = demandaPrincipal / (pctPrincipal / 100);

    // Verificar restrições de toxicidade — descarta o produto se ultrapassar
    let toxico = false;
    for (const [simToxico, keyToxico] of Object.entries(TOXICOS_KEY)) {
      const pctToxico = parseFloat(prod[keyToxico]) || 0;
      if (pctToxico === 0) continue;
      const fornecimento = doseHa * (pctToxico / 100);
      const limite = rec[simToxico] != null ? (rec[simToxico] || 0) : 0;
      if (fornecimento > limite) {
        toxico = true;
        break;
      }
    }
    if (toxico) continue;

    // Score: +1 para cada nutriente em déficit que o produto fornece nessa dose
    let score = 0;
    for (const [s, k] of Object.entries(NUT_KEY)) {
      const pct = parseFloat(prod[k]) || 0;
      if (pct === 0) continue;
      if ((saldo[s] || 0) > 0) score += 1;
    }

    // Desempate: menor dose vence (produto mais concentrado)
    if (score > melhorScore || (score === melhorScore && doseHa < melhorDose)) {
      melhorScore = score;
      melhorDose = doseHa;
      melhor = { prod, doseHa, simboloPrincipal, nutKeyPrincipal };
    }
  }

  return melhor;
}

export function sugerirProdutosInteligente(todos, rec) {
  if (!todos || !todos.length || !rec) return {};

  // Inicializa saldo com as recomendações originais
  const saldo = {};
  for (const s of ORDEM) {
    const v = rec[s];
    saldo[s] = typeof v === 'number' && v > 0 ? v : 0;
  }

  const sugestoes = {};

  // Itera até esgotar os nutrientes em saldo (máx 4 iterações)
  for (let iter = 0; iter < ORDEM.length; iter++) {
    const resultado = escolherProduto(todos, saldo, rec);
    if (!resultado) break;

    const { prod, doseHa, simboloPrincipal, nutKeyPrincipal } = resultado;

    // Registra o produto para o nutriente principal
    sugestoes[nutKeyPrincipal] = {
      produtoId: prod.id,
      doseManual: String(Math.round(doseHa * 10) / 10),
    };

    // Subtrai todos os nutrientes fornecidos por esse produto do saldo
    for (const [s, k] of Object.entries(NUT_KEY)) {
      const pct = parseFloat(prod[k]) || 0;
      if (pct > 0) {
        const repoe = doseHa * (pct / 100);
        saldo[s] = Math.max(0, (saldo[s] || 0) - repoe);
      }
    }

    // Marca o nutriente principal como atendido
    saldo[simboloPrincipal] = 0;
  }

  // Nutrientes sem produto atribuído: preenche com null
  for (const k of Object.values(NUT_KEY)) {
    if (!sugestoes[k]) {
      sugestoes[k] = { produtoId: null, doseManual: '' };
    }
  }

  return sugestoes;
}