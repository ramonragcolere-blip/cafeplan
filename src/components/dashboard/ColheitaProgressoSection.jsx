import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronDown, ChevronRight } from 'lucide-react';

const COLORS = ['hsl(142,40%,32%)', 'hsl(28,60%,50%)', 'hsl(35,30%,55%)', 'hsl(200,45%,45%)', 'hsl(0,72%,51%)'];

function ProgressBar({ label, colhidas, previstas, pct, onClick }) {
  return (
    <div className={`space-y-1 ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`} onClick={onClick}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium truncate max-w-[60%]">{label}</span>
        <span className="text-muted-foreground text-xs">{colhidas.toFixed(0)} / {previstas.toFixed(0)} med ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export default function ColheitaProgressoSection({ produtores, talhoes, lancamentos, filtroProdutorCodigo, onSelecionarProdutor }) {
  const [expandido, setExpandido] = useState(false);

  // Cálculo por produtor sempre
  const rowsPorProdutor = produtores.map(p => {
    const pTalhoes = talhoes.filter(t => t.codigo_produtor === p.codigo);
    const ref = p.ref_medida_litros || 60;
    const previstas = pTalhoes.reduce((s, t) => {
      if (!t.litros_por_pe || !t.num_plantas) return s;
      return s + (t.litros_por_pe * t.num_plantas * (t.pct_colher || 1)) / ref;
    }, 0);
    const colhidas = lancamentos.filter(l => l.codigo_produtor === p.codigo).reduce((s, l) => s + (l.medidas_colhidas || 0), 0);
    return { codigo: p.codigo, label: p.nome?.split(' ').slice(0, 2).join(' '), colhidas, previstas, pct: previstas > 0 ? (colhidas / previstas) * 100 : 0 };
  });

  // Cálculo por talhão (quando filtrado por produtor)
  const rowsPorTalhao = filtroProdutorCodigo
    ? talhoes.filter(t => t.codigo_produtor === filtroProdutorCodigo).map(t => {
        const prod = produtores.find(p => p.codigo === t.codigo_produtor);
        const ref = prod?.ref_medida_litros || 60;
        const previstas = t.litros_por_pe && t.num_plantas ? (t.litros_por_pe * t.num_plantas * (t.pct_colher || 1)) / ref : 0;
        const colhidas = lancamentos.filter(l => l.codigo_produtor === t.codigo_produtor && l.talhao === t.nome).reduce((s, l) => s + (l.medidas_colhidas || 0), 0);
        return { label: t.nome, colhidas, previstas, pct: previstas > 0 ? (colhidas / previstas) * 100 : 0 };
      })
    : [];

  // Totais gerais (ou do produtor filtrado)
  const rowsParaTotal = filtroProdutorCodigo ? rowsPorProdutor.filter(r => r.codigo === filtroProdutorCodigo) : rowsPorProdutor;
  const totalColhidas = rowsParaTotal.reduce((s, r) => s + r.colhidas, 0);
  const totalPrevistas = rowsParaTotal.reduce((s, r) => s + r.previstas, 0);
  const pctGeral = totalPrevistas > 0 ? (totalColhidas / totalPrevistas) * 100 : 0;
  const comColheita = rowsPorProdutor.filter(r => r.colhidas > 0).length;

  // Gráfico de barras — métodos
  const talhoesFiltrados = filtroProdutorCodigo ? talhoes.filter(t => t.codigo_produtor === filtroProdutorCodigo) : talhoes;
  const metodoCounts = {};
  talhoesFiltrados.forEach(t => {
    if (t.metodo_colheita) metodoCounts[t.metodo_colheita] = (metodoCounts[t.metodo_colheita] || 0) + 1;
  });
  const metodoData = Object.entries(metodoCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Colheita</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Card de progresso geral */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Progresso {filtroProdutorCodigo ? 'por Talhão' : 'Geral da Safra'}
          </h3>

          {/* Barra geral */}
          {!filtroProdutorCodigo && (
            <div className="space-y-2">
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold">{pctGeral.toFixed(0)}%</span>
                <span className="text-sm text-muted-foreground">{totalColhidas.toFixed(0)} / {totalPrevistas.toFixed(0)} medidas</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-3 rounded-full bg-primary transition-all" style={{ width: `${Math.min(pctGeral, 100)}%` }} />
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{comColheita}</span> de <span className="font-semibold text-foreground">{produtores.length}</span> produtores com colheita iniciada
              </p>
            </div>
          )}

          {/* Progresso por talhão (produtor filtrado) */}
          {filtroProdutorCodigo && (
            <div className="space-y-3">
              {rowsPorTalhao.length === 0
                ? <p className="text-sm text-muted-foreground">Nenhum talhão com dados.</p>
                : rowsPorTalhao.map((r, i) => <ProgressBar key={i} {...r} />)
              }
            </div>
          )}

          {/* Expandir lista por produtor (visão geral) */}
          {!filtroProdutorCodigo && (
            <div>
              <button
                type="button"
                onClick={() => setExpandido(v => !v)}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Ver progresso por produtor
              </button>
              {expandido && (
                <div className="mt-4 space-y-3 border-t border-border/40 pt-4">
                  {rowsPorProdutor.map((r, i) => (
                    <ProgressBar key={i} {...r} onClick={() => onSelecionarProdutor?.(r.codigo)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Gráfico de barras por método */}
        {metodoData.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-4">Talhões por Método de Colheita</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metodoData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Talhões" radius={[6, 6, 0, 0]}>
                  {metodoData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}