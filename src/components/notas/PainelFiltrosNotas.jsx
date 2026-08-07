import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, RotateCcw } from 'lucide-react';
import { CATEGORIAS_NOTAS } from '@/lib/notasFiscaisCategorias';

export default function PainelFiltrosNotas({
  buscaProduto,
  setBuscaProduto,
  categoriaFiltro,
  setCategoriaFiltro,
  dataInicial,
  setDataInicial,
  dataFinal,
  setDataFinal,
  onLimpar,
  temFiltroAtivo,
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Produto</Label>
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={buscaProduto}
              onChange={e => setBuscaProduto(e.target.value)}
              placeholder="Buscar por nome do produto…"
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>
        <div className="min-w-[200px]">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Categoria</Label>
          <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
            <SelectTrigger className="w-full h-9 text-sm">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {CATEGORIAS_NOTAS.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[150px]">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Data inicial</Label>
          <Input
            type="date"
            value={dataInicial}
            onChange={e => setDataInicial(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <div className="min-w-[150px]">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Data final</Label>
          <Input
            type="date"
            value={dataFinal}
            onChange={e => setDataFinal(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        {temFiltroAtivo && (
          <Button variant="outline" size="sm" onClick={onLimpar} className="gap-2 h-9">
            <RotateCcw className="w-4 h-4" /> Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}