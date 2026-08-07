import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { fmtR, fmtNum, fmtData } from '@/components/analises/helpers';

// Detalha os registros que originaram um valor de gráfico (drill-down).
export default function ModalDrillDown({ open, onClose, titulo, descricao, itens, produtorNome, consolidado }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">{titulo || 'Detalhamento'}</DialogTitle>
          {descricao && <DialogDescription>{descricao}</DialogDescription>}
        </DialogHeader>
        <div className="overflow-auto -mx-2 px-2">
          {(!itens || !itens.length) ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum registro para este detalhamento.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-border">
                  {['Data', ...(consolidado ? ['Produtor'] : []), 'Produto', 'Categoria', 'Qtd. utilizada', 'Dose/ha', 'Área est.', 'Custo unit.', 'Custo aplic.', 'Observação'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.map((a, i) => (
                  <tr key={a.id || `${a.data}-${a.produto_nome}-${i}`} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtData(a.data)}</td>
                    {consolidado && <td className="px-3 py-2 text-muted-foreground">{produtorNome ? produtorNome(a.produtor_id) : a.produtor_id}</td>}
                    <td className="px-3 py-2 font-medium">{a.produto_nome_padrao}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.categoria}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtNum(a.qtd_base)} {a.unidade_base}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{a.dose_label || '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{a.ha_estimado != null ? `${fmtNum(a.ha_estimado)} ha` : '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{a.custo_unitario != null ? fmtR(a.custo_unitario) : '—'}</td>
                    <td className="px-3 py-2 tabular-nums font-medium">{a.custo != null ? fmtR(a.custo) : '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[220px] truncate" title={a.observacao}>{a.observacao || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}