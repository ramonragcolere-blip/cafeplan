import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Package, X, ChevronDown } from 'lucide-react';

// nutriente_alvo: 'n_pct' | 'p2o5_pct' | 'k2o_pct' | 'b_pct' | 'mg_pct' | etc.
// dose_recomendada_kgha: número (kg/ha do nutriente puro)
// area_ha, num_plantas, metros_lineares: do talhão
export default function SeletorProduto({ onSelect, value, nutriente_alvo, dose_recomendada_kgha, area_ha, num_plantas, metros_lineares }) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');

  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples = [] } = useQuery({ queryKey: ['fontes_simples'], queryFn: () => base44.entities.FonteSimples.list() });

  const todos = useMemo(() => [
    ...fertilizantes.map(f => ({ ...f, _tipo: 'formulado' })),
    ...fontesSimples.map(f => ({ ...f, _tipo: 'fonte' })),
  ], [fertilizantes, fontesSimples]);

  // Ordenar por relevância: produtos que têm o nutriente-alvo primeiro
  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return todos
      .filter(p => (p.nome || '').toLowerCase().includes(q) || (p.fornecedor || '').toLowerCase().includes(q) || (p.grupo || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const aRel = nutriente_alvo && a[nutriente_alvo] > 0 ? -1 : 0;
        const bRel = nutriente_alvo && b[nutriente_alvo] > 0 ? 1 : 0;
        return aRel + bRel;
      });
  }, [todos, busca, nutriente_alvo]);

  const calcDoseProduto = (produto) => {
    if (!nutriente_alvo || !dose_recomendada_kgha || !produto[nutriente_alvo]) return null;
    const pct = produto[nutriente_alvo];
    const doseHa = dose_recomendada_kgha / (pct / 100);
    const total = area_ha ? Math.round(doseHa * area_ha) : null;
    const gPe = (total && num_plantas) ? ((total * 1000) / num_plantas).toFixed(1) : null;
    const gMt = (total && metros_lineares) ? ((total * 1000) / metros_lineares).toFixed(1) : null;
    return { doseHa: Math.round(doseHa), total, gPe, gMt };
  };

  const handleSelect = (produto) => {
    const calc = calcDoseProduto(produto);
    onSelect({ produto, calc });
    setOpen(false);
    setBusca('');
  };

  const handleClear = (e) => { e.stopPropagation(); onSelect(null); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full h-8 text-xs justify-between gap-1 font-normal" size="sm">
          <div className="flex items-center gap-1.5 min-w-0">
            <Package className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="truncate">{value?.produto?.nome || 'Selecionar produto da base...'}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {value && <X className="w-3 h-3 text-muted-foreground hover:text-foreground" onClick={handleClear} />}
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[480px] p-0" align="start">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar produto ou fonte..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {filtrados.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">Nenhum produto encontrado</p>
          )}
          {filtrados.map(p => {
            const calc = calcDoseProduto(p);
            const hasTarget = nutriente_alvo && p[nutriente_alvo] > 0;
            return (
              <button
                key={p.id}
                className={`w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors border-b border-border/30 ${hasTarget ? 'bg-green-50/50' : ''}`}
                onClick={() => handleSelect(p)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{p.nome}</span>
                      <Badge variant={p._tipo === 'formulado' ? 'secondary' : 'outline'} className="text-xs shrink-0">
                        {p._tipo === 'formulado' ? 'Formulado' : 'Fonte'}
                      </Badge>
                    </div>
                    {p.fornecedor && <p className="text-xs text-muted-foreground">{p.fornecedor}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {['n_pct', 'p2o5_pct', 'k2o_pct', 'ca_pct', 'mg_pct', 's_pct', 'b_pct']
                        .filter(k => p[k] > 0)
                        .map(k => {
                          const labels = { n_pct: 'N', p2o5_pct: 'P₂O₅', k2o_pct: 'K₂O', ca_pct: 'Ca', mg_pct: 'Mg', s_pct: 'S', b_pct: 'B' };
                          return `${p[k]}% ${labels[k]}`;
                        }).join(' · ') || p.composicao_texto || '—'}
                    </p>
                  </div>
                  {calc && (
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-primary">{calc.doseHa} kg/ha</p>
                      {calc.total && <p className="text-xs text-muted-foreground">{calc.total} kg total</p>}
                      {calc.gPe && <p className="text-xs text-muted-foreground">{calc.gPe} g/pé</p>}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground">
          {filtrados.length} produto(s) — <a href="/fertilizantes" className="text-primary underline" onClick={() => setOpen(false)}>Gerenciar base</a>
        </div>
      </PopoverContent>
    </Popover>
  );
}