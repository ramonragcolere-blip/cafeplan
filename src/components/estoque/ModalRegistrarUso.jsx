import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Loader2 } from 'lucide-react';
import { fmtQtd } from '@/lib/estoqueInsumos';

// Modal para registrar saída de estoque. Cria MovimentoEstoqueInsumo (tipo=saida).
// Não permite quantidade maior que o saldo disponível.
export default function ModalRegistrarUso({ row, open, onClose, onSalvo }) {
  const qc = useQueryClient();
  const [quantidade, setQuantidade] = useState('');
  const [dataMov, setDataMov] = useState('');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setQuantidade('');
      setDataMov(new Date().toISOString().slice(0, 10));
      setObs('');
      setErro('');
    }
  }, [open, row?.key]);

  if (!row) return null;
  const saldo = Number(row.saldo) || 0;
  const unidade = row.unidade || '';

  const handleSalvar = async () => {
    setErro('');
    const q = parseFloat(String(quantidade).replace(',', '.'));
    if (isNaN(q) || q <= 0) { setErro('Informe uma quantidade válida.'); return; }
    if (q > saldo) { setErro('A quantidade utilizada não pode ser maior que o saldo disponível.'); return; }
    if (!dataMov) { setErro('Informe a data da utilização.'); return; }
    setSalvando(true);
    try {
      await base44.entities.MovimentoEstoqueInsumo.create({
        produtor_id: row.produtor_id,
        produto_id: row.produto_id || null,
        produto_tipo: row.produto_tipo || 'nf',
        produto_nome: row.produto_nome,
        tipo_movimento: 'saida',
        quantidade: q,
        unidade,
        data_movimento: dataMov,
        observacao: obs || '',
      });
      await qc.invalidateQueries({ queryKey: ['movimentos_estoque'] });
      onSalvo?.();
      onClose?.();
    } catch (e) {
      setErro('Erro ao registrar uso: ' + (e?.message || String(e)));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar uso</DialogTitle>
          <DialogDescription>Registro de saída de estoque.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Produto</label>
            <p className="text-sm font-medium">{row.produto_nome}</p>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Saldo atual</label>
            <p className="text-sm font-semibold text-primary tabular-nums">{fmtQtd(saldo)} {unidade}</p>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Quantidade utilizada</label>
            <Input
              type="number" inputMode="decimal" step="any" min="0"
              value={quantidade} onChange={e => setQuantidade(e.target.value)}
              className="h-9 text-sm"
              placeholder={`Ex.: 2 ${unidade}`}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Data da utilização</label>
            <Input type="date" value={dataMov} onChange={e => setDataMov(e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Observação (opcional)</label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className="text-sm" />
          </div>
          {erro && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />{erro}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</> : 'Registrar saída'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}