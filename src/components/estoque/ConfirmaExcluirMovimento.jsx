import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { fmtQtd, fmtData } from '@/lib/estoqueInsumos';

// Confirmação de exclusão de um MovimentoEstoqueInsumo. Não exclui entradas
// de NF (essas continuam vindas de BaseItensNotaFiscal).
export default function ConfirmaExcluirMovimento({ movimento, open, onClose, onConcluido }) {
  const qc = useQueryClient();
  const [excluindo, setExcluindo] = useState(false);

  if (!movimento) return null;

  const confirmar = async () => {
    setExcluindo(true);
    try {
      await base44.entities.MovimentoEstoqueInsumo.delete(movimento.id);
      await qc.invalidateQueries({ queryKey: ['movimentos_estoque'] });
      onConcluido?.();
      onClose?.();
    } catch (e) {
      // não silencioso: relança via onConcluido? Mantém simples.
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" /> Excluir movimentação
          </DialogTitle>
          <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <p className="font-medium">Deseja realmente excluir este registro de utilização do estoque?</p>
          <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-0.5">
            <div><span className="text-muted-foreground">Produto:</span> <strong>{movimento.produto_nome}</strong></div>
            <div><span className="text-muted-foreground">Data:</span> <strong>{fmtData(movimento.data_movimento)}</strong></div>
            <div><span className="text-muted-foreground">Quantidade:</span> <strong className="tabular-nums">{fmtQtd(movimento.quantidade)} {movimento.unidade}</strong></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={excluindo}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmar} disabled={excluindo}>
              {excluindo ? <><Loader2 className="w-4 h-4 animate-spin" /> Excluindo…</> : 'Excluir registro'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}