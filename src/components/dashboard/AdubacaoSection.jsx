import React from 'react';
import { CheckCircle2, CircleDot, Clock, ClipboardList } from 'lucide-react';
import { categorizarStatusPlanejamento, proximasAdubacoesDashboard } from '@/lib/dashboardPlanejamento';

function mesAtualIndex() { return new Date().getMonth(); } // 0-based

export default function AdubacaoSection({ talhoes, planos, filtroProdutorCodigo, safra }) {
  const talhoesFiltrados = filtroProdutorCodigo
    ? talhoes.filter(t => t.codigo_produtor === filtroProdutorCodigo)
    : talhoes;

  const talhaoMap = Object.fromEntries(talhoesFiltrados.map(t => [t.id, t]));
  const { totais } = categorizarStatusPlanejamento({
    talhoes,
    planos,
    codigoProdutor: filtroProdutorCodigo,
    safra,
  });
  const proximasUnicas = proximasAdubacoesDashboard({
    talhoes,
    planos,
    codigoProdutor: filtroProdutorCodigo,
    safra,
    mesAtualIndice: mesAtualIndex(),
  });

  if (talhoesFiltrados.length === 0) return null;

  const totalTalhoes = totais.totalTalhoes || 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Adubação</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status planejamento */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Status do Planejamento</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Concluído</span>
              </div>
              <span className="font-bold text-green-700">{totais.concluido}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Em execução</span>
              </div>
              <span className="font-bold text-amber-600">{totais.emExecucao}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <CircleDot className="w-4 h-4 text-blue-600" />
                <span>Planejado</span>
              </div>
              <span className="font-bold text-blue-700">{totais.planejado}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                <span>Sem planejamento</span>
              </div>
              <span className="font-bold text-muted-foreground">{totais.semPlanejamento}</span>
            </div>
          </div>
          {/* Barra visual */}
          {totalTalhoes > 0 && (
            <div className="h-2 bg-muted rounded-full overflow-hidden flex">
              <div className="bg-green-500 h-full" style={{ width: `${(totais.concluido / totalTalhoes) * 100}%` }} />
              <div className="bg-amber-400 h-full" style={{ width: `${(totais.emExecucao / totalTalhoes) * 100}%` }} />
              <div className="bg-blue-500 h-full" style={{ width: `${(totais.planejado / totalTalhoes) * 100}%` }} />
            </div>
          )}
        </div>

        {/* Próximas adubações */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-3">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Próximas Adubações (30 dias)
          </h3>
          {proximasUnicas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma adubação prevista para os próximos 30 dias.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {proximasUnicas.map((p, i) => {
                const talhao = talhaoMap[p.talhao_id];
                return (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/30 last:border-0">
                    <span className="font-medium">{talhao?.nome || p.talhao_nome}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{p.nutriente_label || p.nutriente_key}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
