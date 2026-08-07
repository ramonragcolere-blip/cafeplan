import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Filter, X } from 'lucide-react';

// Filtros próprios da aba Análises (independentes dos demais módulos).
// Indicador varia conforme o modo (Aplicações => nº aplicações/área; Custo => R$).
const ATALHOS = [
  { id: '30d', label: '30 dias' },
  { id: '90d', label: '90 dias' },
  { id: 'ano', label: 'Ano atual' },
  { id: 'safra', label: 'Safra atual' },
  { id: 'tudo', label: 'Tudo' },
];

function hoje() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function iso(d) { return d.toISOString().slice(0, 10); }
function safraHoje() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

export default function FiltrosAnalises({
  filtros, setFiltros, produtores, safras, modo, indicador, setIndicador, onAtalho,
}) {
  const set = (k, v) => setFiltros((f) => ({ ...f, [k]: v }));
  const temFiltro = !!(filtros.produtor !== 'todos' || filtros.produto || filtros.categoria !== 'todos'
    || filtros.dataInicial || filtros.dataFinal || filtros.safra !== 'todas');

  const limpar = () => setFiltros({
    produtor: 'todos', produto: '', categoria: 'todos',
    dataInicial: '', dataFinal: '', safra: 'todas',
  });

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Filter className="w-4 h-4 text-primary" /> Filtros
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Produtor</label>
          <Select value={filtros.produtor} onValueChange={(v) => set('produtor', v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todos os produtores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os produtores</SelectItem>
              {produtores.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome || p.fazenda || p.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Produto</label>
          <Input
            className="h-9 text-sm"
            placeholder="Buscar produto..."
            value={filtros.produto}
            onChange={(e) => set('produto', e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-xs text-muted-foreground">Categoria</label>
          <Select value={filtros.categoria} onValueChange={(v) => set('categoria', v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {['Fungicida', 'Inseticida', 'Herbicida', 'Acaricida', 'Nutrição foliar', 'Adjuvante', 'Adubo/Fertilizante', 'Corretivo', 'Outros'].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs text-muted-foreground">Data inicial</label>
          <Input type="date" className="h-9 text-sm" value={filtros.dataInicial} onChange={(e) => set('dataInicial', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs text-muted-foreground">Data final</label>
          <Input type="date" className="h-9 text-sm" value={filtros.dataFinal} onChange={(e) => set('dataFinal', e.target.value)} />
        </div>

        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs text-muted-foreground">Safra</label>
          <Select value={filtros.safra} onValueChange={(v) => set('safra', v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as safras</SelectItem>
              {safras.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 min-w-[170px]">
          <label className="text-xs text-muted-foreground">Indicador</label>
          <Select value={indicador} onValueChange={setIndicador}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {modo === 'aplicacoes' ? (
                <>
                  <SelectItem value="aplicacoes">Nº de aplicações</SelectItem>
                  <SelectItem value="area">Área estimada (ha)</SelectItem>
                </>
              ) : (
                <SelectItem value="custo">Custo (R$)</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {temFiltro && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground" onClick={limpar}>
            <X className="w-4 h-4" /> Limpar filtros
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {ATALHOS.map((a) => (
          <Button key={a.id} variant="outline" size="sm" className="h-8 text-xs" onClick={() => onAtalho(a.id)}>
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export { hoje, iso, safraHoje };