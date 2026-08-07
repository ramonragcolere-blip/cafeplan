import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { fmtQtd, fmtData } from '@/lib/estoqueInsumos';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

// Detalhes do produto: histórico de entradas (NFs) e saídas registradas.
export default function ModalDetalheEstoque({ row, open, onClose }) {
  if (!row) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="truncate">{row.produto_nome}</span>
          </DialogTitle>
          <DialogDescription>
            Categoria: {row.categoria} · Saldo: {fmtQtd(row.saldo)} {row.unidade} · Entradas: {fmtQtd(row.total_entrada)} {row.unidade} · Usado: {fmtQtd(row.total_saida)} {row.unidade}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Entradas */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-green-700">
              <ArrowDownToLine className="w-4 h-4" /> Entradas ({row.entradas.length})
            </h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/10 border-b border-border">
                    {['Data', 'NF', 'Fornecedor', 'Quantidade', 'Unidade'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {row.entradas.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">Nenhuma entrada registrada.</td></tr>
                  ) : row.entradas.map((e, i) => (
                    <tr key={i} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtData(e.data)}</td>
                      <td className="px-3 py-2 font-mono">{e.numero || '—'}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate">{e.fornecedor || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(e.quantidade)}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{e.unidade || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Saídas */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-amber-700">
              <ArrowUpFromLine className="w-4 h-4" /> Saídas ({row.saidas.length})
            </h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/10 border-b border-border">
                    {['Data', 'Quantidade', 'Unidade', 'Tipo', 'Observação'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {row.saidas.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">Nenhuma saída registrada.</td></tr>
                  ) : row.saidas.map((s, i) => (
                    <tr key={i} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtData(s.data)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(s.quantidade)}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{row.unidade || '—'}</td>
                      <td className="px-3 py-2"><span className="text-xs bg-secondary px-2 py-0.5 rounded">{s.tipo}</span></td>
                      <td className="px-3 py-2 max-w-[200px] truncate text-muted-foreground">{s.observacao || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}