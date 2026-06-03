import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['hsl(142,40%,32%)', 'hsl(28,60%,50%)', 'hsl(35,30%,55%)', 'hsl(200,45%,45%)', 'hsl(0,72%,51%)'];

function ProgressBar({ label, colhidas, previstas, pct }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium truncate max-w-[60%]">{label}</span>
        <span className="text-muted-foreground text-xs">{colhidas.toFixed(0)} / {previstas.toFixed(0)} med ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-2 rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function ColheitaProgressoSection({ produtores, talhoes, lancamentos, filtroProdutorCodigo }) {
  const produtoresFiltrados = filtroProdutorCodigo
    ? produtores.filter(p => p.codigo === filtroProdutorCodigo)
    : produtores;

  // Progresso por produtor (ou por talhão se filtrado)
  const progressoRows = filtroProdutorCodigo
    ? talhoes
        .filter(t => t.codigo_produtor === filtroProdutorCodigo)
        .map(t => {
          const prod = produtores.find(p => p.codigo === t.codigo_produtor);
          const ref = prod?.ref_medida_litros || 60;
          const previstas = t.litros_por_pe && t.num_plantas
            ? (t.litros_por_pe * t.num_plantas * (t.pct_colher || 1)) / ref
            : 0;
          const colhidas = lancamentos
            .filter(l => l.codigo_produtor === t.codigo_produtor && l.talhao === t.nome)
            .reduce((s, l) => s + (l.medidas_colhidas || 0), 0);
          return { label: t.nome, colhidas, previstas, pct: previstas > 0 ? (colhidas / previstas) * 100 : 0 };
        })
    : produtoresFiltrados.map(p => {
        const pTalhoes = talhoes.filter(t => t.codigo_produtor === p.codigo);
        const ref = p.ref_medida_litros || 60;
        const previstas = pTalhoes.reduce((s, t) => {
          if (!t.litros_por_pe || !t.num_plantas) return s;
          return s + (t.litros_por_pe * t.num_plantas * (t.pct_colher || 1)) / ref;
        }, 0);
        const colhidas = lancamentos
          .filter(l => l.codigo_produtor === p.codigo)
          .reduce((s, l) => s + (l.medidas_colhidas || 0), 0);
        return { label: p.nome?.split(' ').slice(0, 2).join(' '), colhidas, previstas, pct: previstas > 0 ? (colhidas / previstas) * 100 : 0 };
      });

  // Gráfico métodos
  const talhoesFiltrados = filtroProdutorCodigo
    ? talhoes.filter(t => t.codigo_produtor === filtroProdutorCodigo)
    : talhoes;
  const metodoCounts = {};
  talhoesFiltrados.forEach(t => {
    if (t.metodo_colheita) metodoCounts[t.metodo_colheita] = (metodoCounts[t.metodo_colheita] || 0) + 1;
  });
  const metodoData = Object.entries(metodoCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Colheita</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progresso */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Progresso {filtroProdutorCodigo ? 'por Talhão' : 'por Produtor'}
          </h3>
          {progressoRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dado disponível.</p>
          ) : (
            <div className="space-y-3">
              {progressoRows.map((r, i) => <ProgressBar key={i} {...r} />)}
            </div>
          )}
        </div>

        {/* Métodos */}
        {metodoData.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-4">Talhões por Método</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={metodoData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}>
                  {metodoData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}