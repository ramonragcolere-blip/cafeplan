import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'warning', label: 'Sem análise' },
  { key: 'danger', label: 'pH baixo' },
  { key: 'info', label: 'K alto' },
];

const corMap = {
  danger: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info:    'bg-blue-50 border-blue-200 text-blue-800',
};
const iconCor = {
  danger:  'text-red-500',
  warning: 'text-amber-500',
  info:    'text-blue-500',
};

export default function AlertasSection({ talhoes, analises, filtroProdutorCodigo }) {
  const [filtroAtivo, setFiltroAtivo] = useState('todos');

  const talhoesFiltrados = filtroProdutorCodigo
    ? talhoes.filter(t => t.codigo_produtor === filtroProdutorCodigo)
    : talhoes;

  const analiseMap = Object.fromEntries(analises.map(a => [a.talhao_id, a]));

  const semAnalise = talhoesFiltrados.filter(t => !analiseMap[t.id]);
  const phBaixo    = talhoesFiltrados.filter(t => { const a = analiseMap[t.id]; return a && a.ph != null && a.ph < 5.5; });
  const kAlto      = talhoesFiltrados.filter(t => { const a = analiseMap[t.id]; return a && a.potassio != null && a.potassio > 200; });

  const todosAlertas = [
    ...semAnalise.map(t => ({ tipo: 'warning', msg: `${t.nome} — sem análise de solo cadastrada` })),
    ...phBaixo.map(t =>    ({ tipo: 'danger',  msg: `${t.nome} — pH ${analiseMap[t.id].ph} (abaixo de 5,5)` })),
    ...kAlto.map(t =>      ({ tipo: 'info',    msg: `${t.nome} — K ${analiseMap[t.id].potassio} mg/dm³ (Alto — dispensado)` })),
  ];

  const alertasFiltrados = filtroAtivo === 'todos'
    ? todosAlertas
    : todosAlertas.filter(a => a.tipo === filtroAtivo);

  if (talhoesFiltrados.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Alertas</h2>

      {/* Filtros */}
      {todosAlertas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {FILTROS.map(f => {
            const count = f.key === 'todos'
              ? todosAlertas.length
              : todosAlertas.filter(a => a.tipo === f.key).length;
            if (f.key !== 'todos' && count === 0) return null;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFiltroAtivo(f.key)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5
                  ${filtroAtivo === f.key
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted/40'}`}
              >
                {f.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
                  ${filtroAtivo === f.key ? 'bg-background/20' : 'bg-muted'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {todosAlertas.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800 font-medium">Nenhum alerta identificado — tudo em ordem!</p>
        </div>
      ) : alertasFiltrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum alerta nesta categoria.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {alertasFiltrados.map((a, i) => (
            <div key={i} className={`rounded-xl border p-4 flex items-start gap-3 ${corMap[a.tipo]}`}>
              <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${iconCor[a.tipo]}`} />
              <p className="text-sm">{a.msg}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}