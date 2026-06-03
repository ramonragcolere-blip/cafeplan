import React from 'react';

export default function ResumoCustosAdubacao({ label, custoTotal, className = '' }) {
  if (custoTotal == null || custoTotal === 0) return null;
  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-xl p-4 ${className}`}>
      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold text-amber-900">
        {custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>
    </div>
  );
}