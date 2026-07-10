// Faixas de classificação foliar do cafeeiro
export const FAIXAS = {
  n_pct:  { label: 'N',  unidade: '%',   deficiente: [null, 2.5],  limiar: [2.5, 3.0],  adequado: [3.0, 3.5],  excessivo: [3.5, null] },
  p_pct:  { label: 'P',  unidade: '%',   deficiente: [null, 0.05], limiar: [0.05, 0.12], adequado: [0.12, 0.15], excessivo: [0.15, null] },
  k_pct:  { label: 'K',  unidade: '%',   deficiente: [null, 1.2],  limiar: [1.2, 1.8],  adequado: [1.8, 2.3],  excessivo: [2.3, null] },
  ca_pct: { label: 'Ca', unidade: '%',   deficiente: [null, 0.5],  limiar: [0.5, 1.0],  adequado: [1.0, 1.5],  excessivo: [1.5, null] },
  mg_pct: { label: 'Mg', unidade: '%',   deficiente: [null, 0.2],  limiar: [0.2, 0.35], adequado: [0.35, 0.5], excessivo: [0.5, null] },
  s_pct:  { label: 'S',  unidade: '%',   deficiente: [null, 0.05], limiar: [0.05, 0.15], adequado: [0.15, 0.20], excessivo: [0.20, null] },
  zn_ppm: { label: 'Zn', unidade: 'ppm', deficiente: [null, 7],    limiar: [7, 10],     adequado: [10, 20],    excessivo: [20, null] },
  b_ppm:  { label: 'B',  unidade: 'ppm', deficiente: [null, 30],   limiar: [30, 40],    adequado: [40, 80],    excessivo: [80, null] },
  cu_ppm: { label: 'Cu', unidade: 'ppm', deficiente: [null, 4],    limiar: [4, 8],      adequado: [8, 30],     excessivo: [30, null] },
  mn_ppm: { label: 'Mn', unidade: 'ppm', deficiente: [null, 30],   limiar: [30, 50],    adequado: [50, 200],   excessivo: [200, null] },
  fe_ppm: { label: 'Fe', unidade: 'ppm', deficiente: [null, 50],   limiar: [50, 70],    adequado: [70, 200],   excessivo: [200, null] },
};

export const NUTRIENTES_KEYS = Object.keys(FAIXAS);

export function classificar(key, valor) {
  if (valor == null || valor === '') return null;
  const f = FAIXAS[key];
  if (!f) return null;
  const v = Number(valor);
  if (isNaN(v)) return null;
  if (f.deficiente[1] != null && v < f.deficiente[1]) return 'deficiente';
  if (f.limiar[1] != null && v < f.limiar[1]) return 'limiar';
  if (f.adequado[1] != null && v < f.adequado[1]) return 'adequado';
  return 'excessivo';
}

export const CLASS_BADGE = {
  deficiente: 'bg-red-100 text-red-700 border border-red-300',
  limiar:     'bg-yellow-100 text-yellow-700 border border-yellow-300',
  adequado:   'bg-green-100 text-green-700 border border-green-300',
  excessivo:  'bg-purple-100 text-purple-700 border border-purple-300',
};

export const CLASS_LABEL = {
  deficiente: 'Deficiente',
  limiar:     'Limiar',
  adequado:   'Adequado',
  excessivo:  'Excessivo',
};

// Mantidos como reexports para preservar compatibilidade com imports existentes.
export { GRUPOS_RECOMENDACAO, GRUPOS_PLANEJAMENTO } from '@/lib/gruposFoliares';

export const EPOCAS = [
  'Pós-colheita',
  'Pré-florada',
  'Pós-florada',
  'Novembro/Dezembro',
  'Janeiro/Fevereiro',
  'Março/Abril',
];

// Ordem de calda por tipo de formulação
export const ORDEM_CALDA = { WG: 1, SC: 2, SL: 3, EC: 4, EW: 4, outro: 5 };
export function ordenarCalda(produtos) {
  return [...produtos].sort((a, b) => {
    const isAdjA = (a.grupo || '').toLowerCase() === 'adjuvante';
    const isAdjB = (b.grupo || '').toLowerCase() === 'adjuvante';
    if (isAdjA && !isAdjB) return 1;
    if (!isAdjA && isAdjB) return -1;
    const oa = ORDEM_CALDA[a.tipo_formulacao] || 3;
    const ob = ORDEM_CALDA[b.tipo_formulacao] || 3;
    return oa - ob;
  });
}