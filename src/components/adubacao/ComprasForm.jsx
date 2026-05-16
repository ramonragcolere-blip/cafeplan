import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Save, Loader2, ShoppingCart } from 'lucide-react';

const emptyItem = () => ({ produto: '', quantidade: '', unidade: 'kg', preco_unitario: '', valor_total: '', observacoes: '' });

export default function ComprasForm({ dados, onSave, saving }) {
  const [itens, setItens] = useState([emptyItem()]);

  useEffect(() => {
    setItens(dados?.compras?.length ? dados.compras.map(c => ({ ...emptyItem(), ...c })) : [emptyItem()]);
  }, [dados?.id]);

  const set = (i, k, v) => {
    setItens(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [k]: v };
      // Auto calcular valor total
      if (k === 'quantidade' || k === 'preco_unitario') {
        const qty = parseFloat(k === 'quantidade' ? v : next[i].quantidade) || 0;
        const price = parseFloat(k === 'preco_unitario' ? v : next[i].preco_unitario) || 0;
        next[i].valor_total = qty > 0 && price > 0 ? (qty * price).toFixed(2) : '';
      }
      return next;
    });
  };

  const add = () => setItens(p => [...p, emptyItem()]);
  const remove = i => setItens(p => p.filter((_, idx) => idx !== i));

  const handleSave = () => {
    const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;
    const compras = itens.filter(it => it.produto).map(it => ({
      ...it,
      quantidade: toNum(it.quantidade),
      preco_unitario: toNum(it.preco_unitario),
      valor_total: toNum(it.valor_total),
    }));
    onSave({ compras });
  };

  const totalGeral = itens.reduce((sum, it) => sum + (parseFloat(it.valor_total) || 0), 0);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-violet-50 border-b border-border">
        <ShoppingCart className="w-4 h-4 text-violet-700" />
        <span className="font-semibold text-sm text-violet-800">Planejado Comprado</span>
      </div>
      <div className="p-5 space-y-2">
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground mb-1 px-1">
          <span className="col-span-3">Produto</span>
          <span className="col-span-2">Qtd</span>
          <span className="col-span-1">Un.</span>
          <span className="col-span-2">Preço Unit.</span>
          <span className="col-span-2">Total (R$)</span>
          <span className="col-span-1">Obs</span>
          <span className="col-span-1"></span>
        </div>
        {itens.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <Input value={it.produto} onChange={e => set(i, 'produto', e.target.value)} className="h-7 text-xs col-span-3" placeholder="Nome do produto" />
            <Input type="number" value={it.quantidade} onChange={e => set(i, 'quantidade', e.target.value)} className="h-7 text-xs col-span-2" />
            <select value={it.unidade} onChange={e => set(i, 'unidade', e.target.value)} className="h-7 text-xs border border-input rounded-md px-1 bg-transparent col-span-1">
              {['kg', 'sc', 'L', 't', 'un'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <Input type="number" value={it.preco_unitario} onChange={e => set(i, 'preco_unitario', e.target.value)} className="h-7 text-xs col-span-2" placeholder="R$" />
            <Input value={it.valor_total} readOnly className="h-7 text-xs col-span-2 bg-muted/50" />
            <Input value={it.observacoes} onChange={e => set(i, 'observacoes', e.target.value)} className="h-7 text-xs col-span-1" />
            <Button variant="ghost" size="icon" className="h-7 w-7 col-span-1" onClick={() => remove(i)}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={add} className="gap-1 text-xs h-7 mt-1">
          <Plus className="w-3 h-3" /> Adicionar item
        </Button>
        {totalGeral > 0 && (
          <p className="text-sm font-semibold text-right text-primary pt-1">
            Total geral: R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>
      <div className="px-5 pb-4 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Compras
        </Button>
      </div>
    </div>
  );
}