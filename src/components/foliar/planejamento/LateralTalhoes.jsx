import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, MapPin } from 'lucide-react';

export default function LateralTalhoes({ talhoes, talhaoIdsSelecionados, onAplicar, onCancelar }) {
  const [selecionados, setSelecionados] = useState(() => new Set(talhaoIdsSelecionados || []));

  const toggleTalhao = (id) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (selecionados.size === talhoes.length) setSelecionados(new Set());
    else setSelecionados(new Set(talhoes.map(t => t.id)));
  };

  const areaTotal = talhoes.filter(t => selecionados.has(t.id)).reduce((s, t) => s + (t.area_ha || 0), 0);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[360px] max-w-full bg-card border-l border-border shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20 shrink-0">
        <div>
          <p className="font-bold text-sm">Selecionar Talhões</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selecionados.size} de {talhoes.length} talhão(ões) · {areaTotal.toFixed(1)} ha
          </p>
        </div>
        <button type="button" onClick={onCancelar} className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
        {/* Selecionar todos */}
        <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer bg-muted/10">
          <input type="checkbox"
            checked={selecionados.size === talhoes.length && talhoes.length > 0}
            onChange={toggleTodos}
            className="w-4 h-4 rounded accent-primary" />
          <span className="text-sm font-semibold text-foreground">Selecionar todos</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {talhoes.reduce((s, t) => s + (t.area_ha || 0), 0).toFixed(1)} ha
          </span>
        </label>

        <div className="border-t border-border/40 my-1" />

        {talhoes.map(t => {
          const sel = selecionados.has(t.id);
          return (
            <label key={t.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${sel ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/30'}`}>
              <input type="checkbox" checked={sel} onChange={() => toggleTalhao(t.id)}
                className="w-4 h-4 rounded accent-primary shrink-0" />
              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1 min-w-0 truncate">{t.nome}</span>
              {t.fase_atual && (
                <span className="text-[10px] text-muted-foreground hidden sm:block shrink-0">{t.fase_atual}</span>
              )}
              <span className="text-xs tabular-nums text-muted-foreground shrink-0">{t.area_ha ? `${t.area_ha} ha` : '—'}</span>
            </label>
          );
        })}
      </div>

      {/* Resumo + footer */}
      <div className="px-5 py-4 border-t border-border bg-muted/10 space-y-3 shrink-0">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{selecionados.size} talhão(ões) selecionado(s)</span>
          <span className="font-bold tabular-nums">{areaTotal.toFixed(1)} ha</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 text-sm" onClick={onCancelar}>Cancelar</Button>
          <Button className="flex-1 text-sm bg-primary" onClick={() => onAplicar(Array.from(selecionados))}>
            Aplicar seleção
          </Button>
        </div>
      </div>
    </div>
  );
}