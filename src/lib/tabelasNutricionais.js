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

// Ajuste potássio (K2O) — valor em mg/dm³
export function classificarK(k) {
  const v = Number(k);
  if (isNaN(v)) return null;
  if (v < 60)  return { classe: 'Baixo', fator: 1.3 };
  if (v <= 120) return { classe: 'Médio', fator: 1.1 };
  if (v <= 150) return { classe: 'Bom', fator: 1.0 };
  if (v <= 200) return { classe: 'Bom+', fator: 0.7 };
  return { classe: 'Alto', fator: 0, dispensar: true };
}

// Classificação de Zinco (Zn) — mg/dm³
export function classificarZn(zn) {
  const v = Number(zn);
  if (isNaN(v)) return null;
  if (v < 1.5)  return { classe: 'Baixo',          acao: 'Aplicar' };
  if (v <= 2.0) return { classe: 'Médio',           acao: 'Avaliar' };
  if (v <= 3.0) return { classe: 'Bom',             acao: 'Avaliar' };
  if (v <= 5.0) return { classe: 'Ótimo',           acao: 'Dispensar' };
  return             { classe: 'Alto/Inadequado', acao: 'Dispensar' };
}

// Classificação de Cobre (Cu) — mg/dm³
export function classificarCu(cu) {
  const v = Number(cu);
  if (isNaN(v)) return null;
  if (v < 0.5)  return { classe: 'Baixo',             acao: 'Aplicar' };
  if (v <= 1.5) return { classe: 'Médio',              acao: 'Avaliar' };
  if (v <= 2.0) return { classe: 'Bom',                acao: 'Avaliar' };
  if (v <= 2.5) return { classe: 'Ótimo',              acao: 'Dispensar' };
  if (v <= 3.0) return { classe: 'Adequado/Atenção',   acao: 'Dispensar' };
  return             { classe: 'Alto/Inadequado',    acao: 'Dispensar' };
}

// Classificação de Manganês (Mn) — mg/dm³
export function classificarMn(mn) {
  const v = Number(mn);
  if (isNaN(v)) return null;
  if (v < 5)    return { classe: 'Baixo',             acao: 'Aplicar' };
  if (v <= 10)  return { classe: 'Médio',              acao: 'Avaliar' };
  if (v <= 15)  return { classe: 'Bom',                acao: 'Avaliar' };
  if (v <= 25)  return { classe: 'Ótimo',              acao: 'Dispensar' };
  if (v <= 30)  return { classe: 'Adequado/Atenção',   acao: 'Dispensar' };
  return             { classe: 'Alto/Inadequado',    acao: 'Dispensar' };
}

// Calagem — baseada em pH e V% (saturação de bases)
// V_desejado para cafeeiro = 60%
// Fórmula PRNT 100%: NC = (V_desejado - V_atual) × CTC / 100  (t/ha)
export function calcCalagem(ph, vPct, ctc) {
  const vAtual = Number(vPct);
  const ctcVal = Number(ctc);
  const phVal  = Number(ph);

  const resultado = {
    ph: isNaN(phVal) ? null : phVal,
    vAtual: isNaN(vAtual) ? null : vAtual,
    necessidade: false,
    nc: null,       // toneladas de corretivo/ha (PRNT 100%)
    classe: null,   // 'Adequado' | 'Necessário'
    observacao: '',
  };

  if (!isNaN(vAtual) && !isNaN(ctcVal) && ctcVal > 0) {
    const V_des = 60;
    if (vAtual >= V_des) {
      resultado.necessidade = false;
      resultado.classe = 'Adequado';
      resultado.observacao = 'V% adequado para cafeeiro (≥60%)';
    } else {
      resultado.necessidade = true;
      resultado.classe = 'Necessário';
      const nc = ((V_des - vAtual) * ctcVal) / 100;
      resultado.nc = parseFloat(nc.toFixed(2));
      resultado.observacao = `NC = ${resultado.nc} t/ha de calcário (PRNT 100%)`;
    }
  } else if (!isNaN(phVal)) {
    // fallback só por pH
    if (phVal >= 5.5) {
      resultado.necessidade = false;
      resultado.classe = 'Adequado';
      resultado.observacao = 'pH adequado (≥5,5)';
    } else {
      resultado.necessidade = true;
      resultado.classe = 'Necessário';
      resultado.observacao = 'pH abaixo do ideal — fornecer V% e CTC para calcular NC';
    }
  }
  return resultado;
}

// Metas de K em mg/dm³
export const META_K = {
  minimo:    60,
  bom:       120,
  excelente: 150,
};

// Decisão de K com soma das duas camadas
// Retorna: { kTotal, metaUsada, metaLabel, dispensar, deficit, classK0020 }
export function calcKSomaCamadas(k0020, k2040, mediaBienal, metaNivel = 'bom') {
  const k1 = Number(k0020) || 0;
  const k2 = Number(k2040) || 0;
  const ambas = k0020 != null && k2040 != null;
  const kBase = ambas ? k1 + k2 : k1;
  const meta = META_K[metaNivel] ?? META_K.bom;
  const classK = classificarK(ambas ? kBase : k1);

  if (ambas && kBase >= meta) {
    return { kTotal: kBase, metaUsada: meta, metaLabel: metaNivel, dispensar: true, deficit: 0, classK };
  }

  // Se temos soma mas abaixo da meta, calculamos com o déficit
  if (ambas && kBase < meta) {
    // A recomendação padrão usa k0020, mas avisamos que a soma ainda é insuficiente
    return { kTotal: kBase, metaUsada: meta, metaLabel: metaNivel, dispensar: false, deficit: meta - kBase, classK };
  }

  // Sem camada 2040: comportamento original
  return { kTotal: k1, metaUsada: meta, metaLabel: metaNivel, dispensar: classK?.dispensar ?? false, deficit: null, classK };
}

// Alertas informativos da camada 20-40 cm
export function alertas2040(analise2040) {
  if (!analise2040) return [];
  const alertas = [];
  const ph  = Number(analise2040.ph);
  const al  = Number(analise2040.aluminio);
  const ca  = Number(analise2040.calcio);
  const mg  = Number(analise2040.magnesio);
  if (!isNaN(ph)  && ph < 5.0)  alertas.push({ tipo: 'acidez',   msg: 'Acidez subsuperficial — avaliar calagem profunda' });
  if (!isNaN(al)  && al > 0.5)  alertas.push({ tipo: 'aluminio', msg: 'Alumínio tóxico em profundidade' });
  // Ca e Mg estão em mmolc/dm³ → converter para cmolc/dm³ (÷10) antes de comparar
  const caCmolc = !isNaN(ca) ? ca / 10 : NaN;
  const mgCmolc = !isNaN(mg) ? mg / 10 : NaN;
  if ((!isNaN(caCmolc) && caCmolc < 1.5) || (!isNaN(mgCmolc) && mgCmolc < 0.5))
    alertas.push({ tipo: 'gesso', msg: 'Ca ou Mg baixo em profundidade — avaliar gesso agrícola' });
  return alertas;
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