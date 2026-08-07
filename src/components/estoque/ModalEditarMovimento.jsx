import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2 } from 'lucide-react';
import { fmtQtd } from '@/lib/estoqueInsumos';

// Edita um MovimentoEstoqueInsumo existente.
// Validação: a quantidade editada não pode exceder
//   saldo atual + quantidade original da saída
// (a própria saída sendo editada "volta" para o saldo).
export default function ModalEditarMovimento({ movimento, row, open, onClose, onConcluido }) {
  const qc = useQueryClient();
  const [quantidade, setQuantidade] = useState('');
  const [dataMov, setDataMov] = useState('');
  const [tipo, setTipo] = useState('saida');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open && movimento) {
      setQuantidade(String(movimento.quantidade ?? ''));
      setDataMov(movimento.data_movimento || new Date().toISOString().slice(0, 10));
      setTipo(movimento.tipo_movimento || 'saida');
      setObs(movimento.observacao || '');
      setErro('');
    }
  }, [open, movimento?.id]);

  if (!movimento) return null;
  const saldoAtual = Number(row?.saldo) || 0;
  const qtdOriginal = Number(movimento.quantidade) || 0;
  const maxDisponivel = saldoAtual + qtdOriginal;
  const unidade = movimento.unidade || row?.unidade || '';

  const handleSalvar = async () => {
    setErro('');
    const q = parseFloat(String(quantidade).replace(',', '.'));
    if (isNaN(q) || q <= 0) { setErro('Informe uma quantidade válida.'); return; }
    if (q > maxDisponivel) {
      setErro(`A quantidade não pode ser maior que o máximo disponível (${fmtQtd(maxDisponivel)} ${unidade}).`);
      return;
    }
    if (!dataMov) { setErro('Informe a data do movimento.'); return; }
    setSalvando(true);
    try {
      await base44.entities.MovimentoEstoqueInsumo.update(movimento.id, {
        quantidade: q,
        data_movimento: dataMov,
        tipo_movimento: tipo,
        observacao: obs || '',
      });
      await qc.invalidateQueries({ queryKey: ['movimentos_estoque'] });
      onConcluido?.();
      onClose?.();
    } catch (e) {
      setErro('Erro ao atualizar: ' + (e?.message || String(e)));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar movimentação</DialogTitle>
          <DialogDescription>{row?.produto_nome}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <div className="bg-muted/30 rounded-lg p-3 text-xs">
            <div>Saldo atual do estoque: <strong className="tabular-nums">{fmtQtd(saldoAtual)} {unidade}</strong></div>
            <div>Quantidade original da saída: <strong className="tabular-nums">{fmtQtd(qtdOriginal)} {unidade}</strong></div>
            <div>Máximo disponível para esta edição: <strong className="tabular-nums text-primary">{fmtQtd(maxDisponivel)} {unidade}</strong></div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Quantidade</label>
            <Input type="number" inputMode="decimal" step="any" min="0" value={quantidade}
              onChange={e => setQuantidade(e.target.value)} className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Data</label>
              <Input type="date" value={dataMov} onChange={e => setDataMov(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Tipo</label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Observação (opcional)</label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className="text-sm" />
          </div>
          {erro && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />{erro}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</> : 'Salvar alterações'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}