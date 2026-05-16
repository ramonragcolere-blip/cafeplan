import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MapPin } from 'lucide-react';

export default function SeletorContexto({ produtores, talhoes, produtor, talhaoId, safra, onProdutor, onTalhao, onSafra }) {
  const safras = ['2024/2025', '2025/2026', '2026/2027', '2027/2028'];
  const talhoesProdutor = produtor ? talhoes.filter(t => t.codigo_produtor === produtor.codigo) : [];

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <MapPin className="w-4 h-4 text-primary" />
        <span className="font-semibold text-sm">Selecionar contexto</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs mb-1 block">Produtor</Label>
          <Select value={produtor?.id || 'none'} onValueChange={v => onProdutor(v === 'none' ? null : v)}>
            <SelectTrigger><SelectValue placeholder="Selecione o produtor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Selecione...</SelectItem>
              {produtores.map(p => <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Talhão</Label>
          <Select value={talhaoId || 'none'} onValueChange={v => onTalhao(v === 'none' ? null : v)} disabled={!produtor}>
            <SelectTrigger><SelectValue placeholder="Selecione o talhão" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Selecione...</SelectItem>
              {talhoesProdutor.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Safra</Label>
          <Select value={safra || 'none'} onValueChange={v => onSafra(v === 'none' ? null : v)} disabled={!talhaoId}>
            <SelectTrigger><SelectValue placeholder="Selecione a safra" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Selecione...</SelectItem>
              {safras.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {produtor && (
        <p className="text-xs text-muted-foreground">
          Fazenda: <strong>{produtor.fazenda}</strong> — {produtor.municipio}/{produtor.uf}
        </p>
      )}
    </div>
  );
}