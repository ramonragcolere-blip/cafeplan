import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const NUTRIENTES_RESUMO = [
  { key: 'fosforo',        label: 'P',  unidade: 'mg/dm³' },
  { key: 'potassio',       label: 'K',  unidade: 'mg/dm³' },
  { key: 'calcio',         label: 'Ca', unidade: 'cmolc/dm³' },
  { key: 'magnesio',       label: 'Mg', unidade: 'cmolc/dm³' },
  { key: 'boro',           label: 'B',  unidade: 'mg/dm³' },
  { key: 'zinco',          label: 'Z',  unidade: 'mg/dm³' },
  { key: 'materia_organica', label: 'MO', unidade: '%' },
];

function fmt(v) {
  if (v == null || v === '' || isNaN(Number(v))) return '—';
  const n = Number(v);
  return n.toLocaleString('pt-BR', { maximumFractionDigits: abs(n) >= 10 ? 1 : 2 });
}
function abs(n) { return Math.abs(n); }

// Resumo histórico comparando as duas análises mais recentes do talhão.
export default function ResumoHistoricoAnalises({ talhaoNome, analisesTalhao }) {
  const dados = useMemo(() => {
    const ordenadas = (analisesTalhao || [])
      .filter(a => a?.data_analise)
      .sort((a, b) => String(b.data_analise).localeCompare(String(a.data_analise)));
    const atual = ordenadas[0] || null;
    const anterior = ordenadas[1] || null;
    return { atual, anterior };
  }, [analisesTalhao]);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground">Resumo das Análises — {talhaoNome || 'Selecione um talhão'}</h3>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Atual: <strong className="text-foreground">{dados.atual?.data_analise || '—'}</strong></span>
          <span>Anterior: <strong className="text-foreground">{dados.anterior?.data_analise || '—'}</strong></span>
        </div>
      </div>

      {!dados.atual && !dados.anterior ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma análise de solo lançada para este talhão.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                <th className="px-3 py-2 text-left font-semibold">Nutriente</th>
                <th className="px-3 py-2 text-right font-semibold">Anterior</th>
                <th className="px-3 py-2 text-right font-semibold">Atual</th>
                <th className="px-3 py-2 text-center font-semibold">Tendência</th>
              </tr>
            </thead>
            <tbody>
              {NUTRIENTES_RESUMO.map(n => {
                const valA = dados.anterior?.[n.key];
                const valB = dados.atual?.[n.key];
                const tend = (valA == null || valB == null) ? null
                  : Number(valB) > Number(valA) ? 'up'
                  : Number(valB) < Number(valA) ? 'down' : 'flat';
                return (
                  <tr key={n.key} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 font-medium">{n.label} <span className="text-xs text-muted-foreground">({n.unidade})</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(valA)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(valB)}</td>
                    <td className="px-3 py-2 text-center">
                      {tend === 'up'   && <TrendingUp   className="w-4 h-4 text-green-600 mx-auto" />}
                      {tend === 'down' && <TrendingDown className="w-4 h-4 text-red-600 mx-auto" />}
                      {tend === 'flat' && <Minus       className="w-4 h-4 text-muted-foreground mx-auto" />}
                      {tend === null   && <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}