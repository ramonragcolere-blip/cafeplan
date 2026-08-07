import React from 'react';
import { Package, AlertTriangle, PackageX } from 'lucide-react';

export default function CardsEstoque({ rows }) {
  const total = rows.length;
  const baixo = rows.filter(r => r.situacao === 'Estoque baixo').length;
  const sem = rows.filter(r => r.situacao === 'Sem estoque').length;

  const cards = [
    { label: 'Produtos em estoque', value: total, icon: Package, color: 'text-primary' },
    { label: 'Produtos com estoque baixo', value: baixo, icon: AlertTriangle, color: 'text-amber-600' },
    { label: 'Produtos sem estoque', value: sem, icon: PackageX, color: 'text-destructive' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <c.icon className={`w-8 h-8 ${c.color}`} />
          <div>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{c.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}