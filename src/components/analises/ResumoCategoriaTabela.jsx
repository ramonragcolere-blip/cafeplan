import React from 'react';
import { fmtR, fmtNum } from '@/components/analises/helpers';

// Tabela resumo Aplicação x Custo por categoria.
export default function ResumoCategoriaTabela({ resumo }) {
  if (!resumo || !resumo.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
        Nenhum dado para o resumo no período selecionado.
      </div>
    );
  }
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="font-semibold text-sm">Resumo por Categoria</h3>
        <p className="text-xs text-muted-foreground">Aplicações x Custos — área calculada somente quando há dose válida</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              {['Categoria', 'Nº aplicações', 'Área estimada', 'Custo total', 'Custo médio/aplicação'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumo.map((r) => (
              <tr key={r.categoria} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                <td className="px-4 py-2.5 font-medium">{r.categoria}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.aplicacoes}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.area != null ? `${fmtNum(r.area)} ha` : '—'}</td>
                <td className="px-4 py-2.5 tabular-nums font-medium">{fmtR(r.custo)}</td>
                <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{fmtR(r.custoMedio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}