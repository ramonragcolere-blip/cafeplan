import React from 'react';

/**
 * Calcula quanto um produto/fonte fornece de um nutriente específico (kg/ha)
 * baseado na dose do nutriente-alvo da linha e na composição do produto.
 *
 * doseNutAlvo: dose do nutriente-alvo em kg/ha (ex: N = 200 kg/ha)
 * pctNutAlvo: % do nutriente-alvo no produto (ex: 30 para 30%)
 * pctNutAlvo → dose do produto em kg/ha = doseNutAlvo / (pctNutAlvo / 100)
 * contribuição do nutrienteX = doseHaProduto × (pctNutX / 100)
 */
function calcContribuicao(linha, nutAlvoKey, nutXKey, todos) {
  if (!linha.produtoId) return 0;
  const produto = todos.find(p => p.id === linha.produtoId);
  if (!produto) return 0;

  const pctNutAlvo = parseFloat(produto[nutAlvoKey]) || 0;
  if (!pctNutAlvo) return 0;

  const doseManual = linha.doseRecManual !== '' ? parseFloat(linha.doseRecManual) : null;
  // Precisamos da dose do nutriente-alvo em kg/ha; se não tiver, não calcula
  if (doseManual == null || isNaN(doseManual) || doseManual <= 0) return 0;

  const doseHaProduto = doseManual / (pctNutAlvo / 100);
  const pctNutX = parseFloat(produto[nutXKey]) || 0;
  return doseHaProduto * (pctNutX / 100);
}

/**
 * Balanço cruzado para um nutriente X:
 * soma as contribuições de todos os produtos de OUTROS nutrientes (nutAlvoKey ≠ nutXKey)
 * e do próprio nutriente (caso tenha múltiplas fontes que têm nutriente X).
 *
 * linhasState: { [nutKey]: [fonte, ...] }
 * nutrienteAtualKey: o nutriente desta seção (para excluir das "outras" contribuições)
 * nutrienteXKey: o nutriente cujo balanço estamos calculando (= nutrienteAtualKey quando usamos no header)
 * todos: lista de todos os produtos
 */
export function calcBalancoCruzado(linhasState, nutrienteAtualKey, nutrienteXKey, todos) {
  const contribuicoes = []; // { nutAlvoLabel, produtoNome, contribuicaoKgHa }

  Object.entries(linhasState).forEach(([nutAlvoKey, fontes]) => {
    // Só considerar outros nutrientes (não o atual) para "já fornecido por outros produtos"
    if (nutAlvoKey === nutrienteAtualKey) return;
    // Ignora chaves compostas (fontes adicionais: n_pct__1, etc.)
    if (nutAlvoKey.includes('__')) return;

    fontes.forEach(linha => {
      if (!linha.produtoId) return;
      const produto = todos.find(p => p.id === linha.produtoId);
      if (!produto) return;

      const contrib = calcContribuicao(linha, nutAlvoKey, nutrienteXKey, todos);
      if (contrib > 0) {
        contribuicoes.push({
          nutAlvoKey,
          produtoNome: produto.nome,
          contribuicaoKgHa: contrib,
        });
      }
    });
  });

  const totalContribuido = contribuicoes.reduce((s, c) => s + c.contribuicaoKgHa, 0);
  return { contribuicoes, totalContribuido };
}

/**
 * Componente visual do balanço nutricional cruzado
 * Exibido abaixo da recomendação no cabeçalho de cada ElementoNutriente
 */
export default function BalancoNutricional({ nutriente, recKgHa, linhasState, todos }) {
  const { contribuicoes, totalContribuido } = React.useMemo(
    () => calcBalancoCruzado(linhasState, nutriente.key, nutriente.key, todos),
    [linhasState, nutriente.key, todos]
  );

  // Sem recomendação e sem contribuição → nada a mostrar
  if (recKgHa == null && totalContribuido === 0) return null;
  // Sem contribuição de outros produtos → nada a mostrar
  if (totalContribuido === 0) return null;

  const saldo = recKgHa != null ? recKgHa - totalContribuido : null;

  let statusEl = null;
  if (saldo != null) {
    if (saldo <= 0) {
      const excesso = Math.abs(saldo);
      if (excesso < 0.01) {
        statusEl = <span className="text-green-700 font-semibold">✅ Suprido</span>;
      } else {
        statusEl = <span className="text-orange-600 font-semibold">⚠️ Excesso de {excesso.toFixed(1)} kg/ha</span>;
      }
    } else {
      statusEl = <span className="text-yellow-700 font-semibold">⚠️ Falta {saldo.toFixed(1)} kg/ha</span>;
    }
  }

  return (
    <div className="mt-1.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-blue-700 font-semibold">
          Já fornecido por outros produtos: {totalContribuido.toFixed(1)} kg/ha
        </span>
        {statusEl}
      </div>
      <div className="flex flex-wrap gap-1.5 text-blue-600">
        {contribuicoes.map((c, i) => (
          <span key={i} className="bg-blue-100 px-1.5 py-0.5 rounded">
            {c.produtoNome} → {c.contribuicaoKgHa.toFixed(1)} kg/ha
          </span>
        ))}
      </div>
    </div>
  );
}