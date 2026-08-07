import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { fmtQtd } from '@/lib/estoqueInsumos';

// Alerta de estoque baixo (saldo <= 10% do total) ou sem estoque.
// Quando "Todos os produtores", identifica o produtor na linha.
export default function AlertasEstoque({ rows, produtores, produtorFiltro }) {
  const alertas = rows.filter(r => r.alerta && r.total_entrada > 0);
  if (alertas.length === 0) return null;

  const nomeProdutor = (id) => {
    const p = (produtores || []).find(x => x.id === id);
    return p ? (p.nome || p.codigo_produtor || id) : id;
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-amber-800">Alertas de Estoque</h3>
      </div>
      <ul className="space-y-1 text-sm">
        {alertas.map(r => (
          <li key={r.key} className="flex items-center gap-1.5 text-amber-800">
            <span>⚠️</span>
            {produtorFiltro === 'todos' && (
              <span className="font-medium">{nomeProdutor(r.produtor_id)} —</span>
            )}
            <span>{r.produto_nome}</span>
            <span className="text-amber-700">
              — restam {Math.round(r.pct * 100)}% ({fmtQtd(r.saldo)} {r.unidade})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}