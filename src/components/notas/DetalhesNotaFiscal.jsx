import React, { useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink } from 'lucide-react';

const fmtR = (v) => v != null
  ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : '—';

const fmtData = (d) => {
  if (!d) return '—';
  const [y, m, day] = String(d).split('-');
  if (y && m && day) return `${day}/${m}/${y}`;
  return d;
};

// Modal SOMENTE de consulta: mostra cabeçalho da nota, todos os itens
// (relação BaseItensNotaFiscal.nota_fiscal_id === nota.id) e o valor total
// já salvo. Não edita, não exclui, não recalcula.
export default function DetalhesNotaFiscal({ nota, itens = [], produtorNome, onClose }) {
  const open = !!nota;

  const itensDaNota = useMemo(() => {
    if (!nota) return [];
    return itens
      .filter(i => i.nota_fiscal_id === nota.id)
      .sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
  }, [nota, itens]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
        {/* Header fixo */}
        <DialogHeader className="p-5 border-b border-border space-y-1">
          <div className="flex items-center gap-2 pr-8">
            <FileText className="w-5 h-5 text-primary" />
            <DialogTitle className="text-lg">Detalhes da Nota Fiscal</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Consulta — nenhum dado pode ser alterado.
          </DialogDescription>
        </DialogHeader>

        {/* Corpo rolável */}
        {nota && (
          <div className="overflow-y-auto p-5 space-y-5">
            {/* Cabeçalho da nota */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Número da Nota</p>
                <p className="font-mono font-semibold text-foreground">{nota.numero_nota || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Produtor</p>
                <p className="font-medium text-foreground">{produtorNome ? produtorNome(nota.produtor_id) : (nota.produtor_id || '—')}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Fornecedor</p>
                <p className="font-medium text-foreground">{nota.fornecedor_nome || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">CNPJ do Fornecedor</p>
                <p className="font-mono text-foreground">{nota.fornecedor_cnpj || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Data de Emissão</p>
                <p className="tabular-nums text-foreground">{fmtData(nota.data_emissao)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor Total da Nota</p>
                <p className="tabular-nums font-bold text-primary">{fmtR(nota.valor_total)}</p>
              </div>
            </div>

            {/* Tabela de itens */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-muted/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Itens da Nota ({itensDaNota.length})
                </p>
              </div>
              {itensDaNota.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum item vinculado a esta nota.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/5">
                        {['Produto', 'Qtd.', 'Unidade', 'Preço Unit.', 'Total'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {itensDaNota.map((it, idx) => (
                        <tr key={it.id || idx} className={`border-b border-border/50 last:border-0 ${idx % 2 === 1 ? 'bg-muted/5' : ''}`}>
                          <td className="px-3 py-2.5 font-medium max-w-[280px]">{it.produto_nome || '—'}</td>
                          <td className="px-3 py-2.5 tabular-nums">{it.quantidade != null ? Number(it.quantidade).toLocaleString('pt-BR') : '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded font-mono">{it.unidade_medida || '—'}</span>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">{fmtR(it.preco_unitario)}</td>
                          <td className="px-3 py-2.5 tabular-nums font-medium">{fmtR(it.preco_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Total destacado */}
            <div className="flex justify-end">
              <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5 text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor Total da Nota</p>
                <p className="text-lg font-bold text-primary tabular-nums">{fmtR(nota.valor_total)}</p>
              </div>
            </div>

            {/* Botão arquivo original */}
            {nota.arquivo_url ? (
              <div className="flex justify-end">
                <a href={nota.arquivo_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2">
                    <ExternalLink className="w-4 h-4" /> Abrir arquivo original
                  </Button>
                </a>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}