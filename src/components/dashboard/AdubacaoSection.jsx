import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function mesAtualIndex() { return new Date().getMonth(); } // 0-based

export default function AdubacaoSection({ talhoes, planos, filtroProdutorCodigo }) {
  const talhoesFiltrados = filtroProdutorCodigo
    ? talhoes.filter(t => t.codigo_produtor === filtroProdutorCodigo)
    : talhoes;

  const planosFiltrados = filtroProdutorCodigo
    ? planos.filter(p => p.codigo_produtor === filtroProdutorCodigo)
    : planos;

  // Status por talhão (usando BasePlanejamentoAdubacao)
  const talhaoIds = [...new Set(talhoesFiltrados.map(t => t.id))];
  const talhaoMap = Object.fromEntries(talhoesFiltrados.map(t => [t.id, t]));

  const concluidos = new Set(planosFiltrados.filter(p => p.status === 'concluido').map(p => p.talhao_id));
  const emExecucao = new Set(planosFiltrados.filter(p => p.status === 'em_execucao').map(p => p.talhao_id));
  const comPlano = new Set(planosFiltrados.map(p => p.talhao_id));

  const numConcluidos = talhaoIds.filter(id => concluidos.has(id)).length;
  const numEmExecucao = talhaoIds.filter(id => emExecucao.has(id) && !concluidos.has(id)).length;
  const numPendentes = talhaoIds.filter(id => !comPlano.has(id)).length;

  // Próximas adubações nos próximos 30 dias
  const mesAtual = mesAtualIndex();
  const mesProximo = (mesAtual + 1) % 12;
  const proximasAdubacoes = planosFiltrados.filter(p => {
    if (!p.meses) return false;
    const mesesFlat = p.meses.flat().map(m => MESES.indexOf(String(m || '').toUpperCase()));
    return mesesFlat.some(m => m === mesAtual || m === mesProximo);
  });

  const proximasUnicas = [...new Map(proximasAdubacoes.map(p => [p.talhao_id + p.nutriente_key, p])).values()];

  if (talhoesFiltrados.length === 0) return null;

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
              <span className="font-bold text-green-700">{numConcluidos}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Em execução</span>
              </div>
              <span className="font-bold text-amber-600">{numEmExecucao}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>Sem planejamento</span>
              </div>
              <span className="font-bold text-muted-foreground">{numPendentes}</span>
            </div>
          </div>
          {/* Barra visual */}
          {talhaoIds.length > 0 && (
            <div className="h-2 bg-muted rounded-full overflow-hidden flex">
              <div className="bg-green-500 h-full" style={{ width: `${(numConcluidos / talhaoIds.length) * 100}%` }} />
              <div className="bg-amber-400 h-full" style={{ width: `${(numEmExecucao / talhaoIds.length) * 100}%` }} />
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