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

// Tabela de P₂O₅ e K₂O: pontos de referência por sc/ha
// P = dose base máxima (kg/ha), K = dose base média (kg/ha)
export const TABELA_PK = [
  { sacas: 20, P: 20,  K: 125 },
  { sacas: 30, P: 40,  K: 195 },
  { sacas: 40, P: 50,  K: 255 },
  { sacas: 50, P: 60,  K: 315 },
  { sacas: 60, P: 80,  K: 380 },
];
// Acréscimo por saca acima de 60 sc/ha:
const PK_EXTRA_P = 0.6; // kg/ha por saca
const PK_EXTRA_K = 5.9; // kg/ha por saca

// Tabela geral de nutrientes: apenas N é mantido aqui
// P e K passam a ter tabela própria (TABELA_PK)
export const TABELA_NPK = [
  { sacas: 10,  N: 100 },
  { sacas: 20,  N: 182 },
  { sacas: 25,  N: 200 },
  { sacas: 30,  N: 230 },
  { sacas: 35,  N: 235 },
  { sacas: 40,  N: 254 },
  { sacas: 45,  N: 270 },
  { sacas: 50,  N: 293 },
  { sacas: 55,  N: 294 },
  { sacas: 60,  N: 321 },
  { sacas: 70,  N: 375 },
  { sacas: 80,  N: 428 },
  { sacas: 90,  N: 495 },
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

// Busca dose base de N da tabela geral (N não foi alterado)
function getDoseBaseN(mediaBienal) {
  if (!mediaBienal || mediaBienal <= 0) return null;
  const sorted = [...TABELA_NPK].sort((a, b) => a.sacas - b.sacas);
  if (mediaBienal <= sorted[0].sacas) return sorted[0].N;
  if (mediaBienal >= sorted[sorted.length - 1].sacas) return sorted[sorted.length - 1].N;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (mediaBienal >= a.sacas && mediaBienal <= b.sacas) {
      const t = (mediaBienal - a.sacas) / (b.sacas - a.sacas);
      return Math.round(a.N + t * (b.N - a.N));
    }
  }
  return null;
}

// Busca dose base de P₂O₅ ou K₂O pela tabela TABELA_PK
// Com interpolação entre linhas e extrapolação para sacas > 60
function getDoseBasePK(mediaBienal, nutriente) {
  if (!mediaBienal || mediaBienal <= 0) return null;
  const sorted = [...TABELA_PK].sort((a, b) => a.sacas - b.sacas);
  const last = sorted[sorted.length - 1]; // { sacas: 60, P, K }

  // Acima de 60 sc/ha: extrapolação linear
  if (mediaBienal > last.sacas) {
    const excedente = mediaBienal - last.sacas;
    if (nutriente === 'P') return Math.round(last.P + excedente * PK_EXTRA_P);
    if (nutriente === 'K') return Math.round(last.K + excedente * PK_EXTRA_K);
  }

  // Abaixo do menor valor da tabela
  if (mediaBienal <= sorted[0].sacas) return sorted[0][nutriente];

  // Interpolação entre pontos da tabela
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (mediaBienal >= a.sacas && mediaBienal <= b.sacas) {
      const t = (mediaBienal - a.sacas) / (b.sacas - a.sacas);
      return Math.round(a[nutriente] + t * (b[nutriente] - a[nutriente]));
    }
  }
  return null;
}

// getDosesBase — mantém interface anterior, agora P e K vêm de TABELA_PK
export function getDosesBase(mediaBienal) {
  if (!mediaBienal || mediaBienal <= 0) return { N: null, P: null, K: null };
  return {
    N: getDoseBaseN(mediaBienal),
    P: getDoseBasePK(mediaBienal, 'P'),
    K: getDoseBasePK(mediaBienal, 'K'),
  };
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
  if (v < 60)   return { classe: 'Baixo', fator: 1.3 };
  if (v <= 120) return { classe: 'Médio', fator: 1.1 };
  if (v <= 150) return { classe: 'Bom',   fator: 1.0 };
  if (v <= 200) return { classe: 'Ótimo', fator: 0.7 };
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
// k0020 e k2040 são valores da análise em mmolc/dm³
// Internamente converte para mg/dm³ (× 39,1) para classificação e comparação com META_K
export function calcKSomaCamadas(k0020, k2040, mediaBienal, metaNivel = 'bom') {
  // Converter mmolc/dm³ → mg/dm³ para classificação e comparação
  const k1mg = k0020 != null ? Number(k0020) * 39.1 : 0;
  const k2mg = k2040 != null ? Number(k2040) * 39.1 : 0;
  const ambas = k0020 != null && k2040 != null;
  const kBase = ambas ? k1mg + k2mg : k1mg;
  const meta = META_K[metaNivel] ?? META_K.bom;
  const classK = classificarK(ambas ? kBase : k1mg);
  // kTotal exposto em mg/dm³ (para exibição na tela junto com META_K em mg/dm³)
  const kTotal = ambas ? k1mg + k2mg : k1mg;

  if (ambas && kBase >= meta) {
    return { kTotal, metaUsada: meta, metaLabel: metaNivel, dispensar: true, deficit: 0, classK };
  }

  if (ambas && kBase < meta) {
    return { kTotal, metaUsada: meta, metaLabel: metaNivel, dispensar: false, deficit: meta - kBase, classK };
  }

  // Sem camada 2040: comportamento original
  return { kTotal, metaUsada: meta, metaLabel: metaNivel, dispensar: classK?.dispensar ?? false, deficit: null, classK };
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