import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X } from 'lucide-react';
import { CATEGORIAS_NOTAS } from '@/lib/notasFiscaisCategorias';

const SITUACOES = ['Normal', 'Atenção', 'Estoque baixo', 'Sem estoque'];

export default function FiltrosEstoque({
  busca, setBusca,
  categoria, setCategoria,
  situacao, setSituacao,
  dataInicial, setDataInicial,
  dataFinal, setDataFinal,
  onLimpar, temFiltro,
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="w-4 h-4" /> Filtros
      </div>

      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs text-muted-foreground mb-1">Produto</label>
        <Input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome…"
          className="h-9 text-sm"
        />
      </div>

      <div className="w-[180px]">
        <label className="block text-xs text-muted-foreground mb-1">Categoria</label>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {CATEGORIAS_NOTAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="w-[170px]">
        <label className="block text-xs text-muted-foreground mb-1">Situação</label>
        <Select value={situacao} onValueChange={setSituacao}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {SITUACOES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="w-[150px]">
        <label className="block text-xs text-muted-foreground mb-1">Entrada inicial</label>
        <Input type="date" value={dataInicial} onChange={e => setDataInicial(e.target.value)} className="h-9 text-sm" />
      </div>
      <div className="w-[150px]">
        <label className="block text-xs text-muted-foreground mb-1">Entrada final</label>
        <Input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)} className="h-9 text-sm" />
      </div>

      {temFiltro && (
        <Button variant="outline" size="sm" onClick={onLimpar} className="h-9 gap-1">
          <X className="w-4 h-4" /> Limpar
        </Button>
      )}
    </div>
  );
}