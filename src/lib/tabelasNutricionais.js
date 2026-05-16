// Tabela de nitrogênio: sacas/ha → pontos de N por saca
export const TABELA_N = [
  { sacas: 10, pontos: 10 },
  { sacas: 20, pontos: 9.1 },
  { sacas: 25, pontos: 8 },
  { sacas: 30, pontos: 7.67 },
  { sacas: 35, pontos: 6.7 },
  { sacas: 40, pontos: 6.35 },
  { sacas: 45, pontos: 6 },
  { sacas: 50, pontos: 5.85 },
  { sacas: 55, pontos: 5.35 },
  { sacas: 60, pontos: 5.35 },
  { sacas: 65, pontos: 5.35 },
  { sacas: 70, pontos: 5.35 },
  { sacas: 75, pontos: 5.35 },
  { sacas: 80, pontos: 5.35 },
  { sacas: 85, pontos: 5.35 },
  { sacas: 90, pontos: 5.5 },
];

// Tabela geral de nutrientes: produtividade (sc/ha) → N, P2O5, K2O (kg/ha)
export const TABELA_NPK = [
  { sacas: 10,  N: 100, P: 20,  K: 60  },
  { sacas: 20,  N: 182, P: 40,  K: 120 },
  { sacas: 25,  N: 200, P: 50,  K: 150 },
  { sacas: 30,  N: 230, P: 60,  K: 180 },
  { sacas: 35,  N: 235, P: 70,  K: 200 },
  { sacas: 40,  N: 254, P: 80,  K: 240 },
  { sacas: 45,  N: 270, P: 90,  K: 270 },
  { sacas: 50,  N: 293, P: 100, K: 300 },
  { sacas: 55,  N: 294, P: 110, K: 330 },
  { sacas: 60,  N: 321, P: 120, K: 360 },
  { sacas: 70,  N: 375, P: 140, K: 420 },
  { sacas: 80,  N: 428, P: 160, K: 480 },
  { sacas: 90,  N: 495, P: 180, K: 540 },
];

// Busca o valor de pontos de N por saca, interpolando entre faixas
export function getPontosN(mediaBienal) {
  if (!mediaBienal || mediaBienal <= 0) return null;
  const sorted = [...TABELA_N].sort((a, b) => a.sacas - b.sacas);
  if (mediaBienal <= sorted[0].sacas) return sorted[0].pontos;
  if (mediaBienal >= sorted[sorted.length - 1].sacas) return sorted[sorted.length - 1].pontos;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (mediaBienal >= a.sacas && mediaBienal <= b.sacas) {
      const t = (mediaBienal - a.sacas) / (b.sacas - a.sacas);
      return a.pontos + t * (b.pontos - a.pontos);
    }
  }
  return null;
}

// Busca doses base de N, P, K da tabela geral
export function getDosesBase(mediaBienal) {
  if (!mediaBienal || mediaBienal <= 0) return { N: null, P: null, K: null };
  const sorted = [...TABELA_NPK].sort((a, b) => a.sacas - b.sacas);
  if (mediaBienal <= sorted[0].sacas) return { N: sorted[0].N, P: sorted[0].P, K: sorted[0].K };
  if (mediaBienal >= sorted[sorted.length - 1].sacas) {
    const last = sorted[sorted.length - 1];
    return { N: last.N, P: last.P, K: last.K };
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (mediaBienal >= a.sacas && mediaBienal <= b.sacas) {
      const t = (mediaBienal - a.sacas) / (b.sacas - a.sacas);
      return {
        N: Math.round(a.N + t * (b.N - a.N)),
        P: Math.round(a.P + t * (b.P - a.P)),
        K: Math.round(a.K + t * (b.K - a.K)),
      };
    }
  }
  return { N: null, P: null, K: null };
}

// Cálculo N
export function calcN(safrAnterior, safrEstimada) {
  if (!safrAnterior || !safrEstimada) return null;
  const media = (Number(safrAnterior) + Number(safrEstimada)) / 2;
  const pontos = getPontosN(media);
  if (!pontos) return null;
  return { media, pontos: parseFloat(pontos.toFixed(2)), dose: Math.round(media * pontos) };
}

// Ajuste fósforo (P2O5)
export function classificarP(p) {
  const v = Number(p);
  if (isNaN(v)) return null;
  if (v < 10) return { classe: 'Baixo', fator: 1.5 };
  if (v <= 15) return { classe: 'Médio', fator: 1.0 };
  if (v <= 20) return { classe: 'Bom', fator: 0.5 };
  return { classe: 'Ótimo', fator: 0, dispensar: true };
}

// Ajuste potássio (K2O)
export function classificarK(k) {
  const v = Number(k);
  if (isNaN(v)) return null;
  if (v < 60)  return { classe: 'Baixo', fator: 1.3 };
  if (v <= 120) return { classe: 'Médio', fator: 1.1 };
  if (v <= 150) return { classe: 'Bom', fator: 1.0 };
  if (v <= 200) return { classe: 'Bom+', fator: 0.7 };
  return { classe: 'Alto', fator: 0, dispensar: true };
}

// Dose de boro
export function calcB(b) {
  const v = Number(b);
  if (isNaN(v)) return null;
  if (v < 0.5) return { classe: 'Baixo', dose: 7 };
  if (v <= 0.8) return { classe: 'Médio', dose: 5 };
  if (v <= 1.0) return { classe: 'Bom', dose: 3 };
  if (v <= 1.5) return { classe: 'Ótimo', dose: 0, dispensar: true };
  return { classe: 'Alto', dose: 0, observacao: 'Avaliar — evitar excesso' };
}