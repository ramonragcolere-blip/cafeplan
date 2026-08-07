import { fmtData } from '@/lib/estoqueInsumos';

// Paleta consistente para os gráficos das Análises.
export const CORES = [
  '#0f766e', '#b45309', '#15803d', '#1d4ed8', '#9333ea',
  '#db2777', '#0891b2', '#ca8a04', '#dc2626', '#475569',
  '#7c3aed', '#0ea5e9', '#65a30d', '#e11d48', '#0d9488',
];

export const fmtR = (v) => (v == null
  ? '—'
  : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

export const fmtNum = (v) => (v == null
  ? '—'
  : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));

export { fmtData };