import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin } from 'lucide-react';

export default function ProdutorSelector({ produtores, produtorSelecionado, onSelect }) {
  const produtor = produtores.find(p => p.id === produtorSelecionado);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            ☕ Selecione o Produtor
          </label>
          <Select
            value={produtorSelecionado || ''}
            onValueChange={val => onSelect(val || null)}
          >
            <SelectTrigger className="w-full max-w-xl text-base h-12">
              <SelectValue placeholder="Clique para selecionar um produtor..." />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {produtores.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="font-mono text-xs text-muted-foreground mr-2">{p.codigo}</span>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {produtor && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-xl px-4 py-3">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">{produtor.fazenda}</p>
              <p>{produtor.municipio}{produtor.uf ? ` / ${produtor.uf}` : ''} — {produtor.ano_agricola || '2025/2026'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}