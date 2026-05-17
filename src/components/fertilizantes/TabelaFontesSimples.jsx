import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';

const NUTRIENTES_PRINCIPAIS = ['Todos', 'N', 'P', 'K', 'Ca', 'Mg', 'S', 'B', 'Zn', 'Cu', 'Mn', 'Fe'];
const COLS = [
  { key: 'n_pct', label: 'N%' }, { key: 'p2o5_pct', label: 'P₂O₅%' }, { key: 'k2o_pct', label: 'K₂O%' },
  { key: 'ca_pct', label: 'Ca%' }, { key: 'mg_pct', label: 'Mg%' }, { key: 's_pct', label: 'S%' },
  { key: 'b_pct', label: 'B%' }, { key: 'zn_pct', label: 'Zn%' },
];

export default function TabelaFontesSimples({ dados, loading, onNovo, onEditar, onDeletar }) {
  const [busca, setBusca] = useState('');
  const [nutriente, setNutriente] = useState('Todos');

  const filtrados = dados.filter(f => {
    const matchBusca = (f.nome || '').toLowerCase().includes(busca.toLowerCase());
    const matchNut = nutriente === 'Todos' || f.nutriente_principal === nutriente;
    return matchBusca && matchNut;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar fonte..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-10 w-56" />
          </div>
          <Select value={nutriente} onValueChange={setNutriente}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Nutriente" /></SelectTrigger>
            <SelectContent>
              {NUTRIENTES_PRINCIPAIS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onNovo} className="gap-2"><Plus className="w-4 h-4" />Nova Fonte</Button>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Nutriente</th>
                {COLS.map(c => (
                  <th key={c.key} className="text-center px-2 py-3 font-medium text-muted-foreground">{c.label}</th>
                ))}
                <th className="text-center px-3 py-3 font-medium text-muted-foreground w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={COLS.length + 3} className="text-center py-10 text-muted-foreground">Carregando...</td></tr>
              )}
              {!loading && filtrados.length === 0 && (
                <tr><td colSpan={COLS.length + 3} className="text-center py-10 text-muted-foreground">Nenhuma fonte encontrada.</td></tr>
              )}
              {filtrados.map(f => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{f.nome}</td>
                  <td className="px-3 py-2.5">
                    {f.nutriente_principal && <Badge variant="outline" className="text-xs">{f.nutriente_principal}</Badge>}
                  </td>
                  {COLS.map(c => (
                    <td key={c.key} className="px-2 py-2.5 text-center text-xs text-muted-foreground">
                      {f[c.key] > 0 ? `${f[c.key]}%` : '—'}
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditar(f)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeletar(f)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
          {filtrados.length} fonte(s)
        </div>
      </div>
    </div>
  );
}