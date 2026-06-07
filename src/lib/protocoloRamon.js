/**
 * Protocolo Ramon — Lógica de cálculo de recomendação nutricional
 * para cafeeiro em produção baseada na média bienal de produtividade.
 */

// ── Tabelas ─────────────────────────────────────────────────────────────────

const TABELA_N_RAMON = [
  { sc: 10, kgPorSaca: 10 },
  { sc: 20, kgPorSaca: 9.1 },
  { sc: 25, kgPorSaca: 8 },
  { sc: 30, kgPorSaca: 7.67 },
  { sc: 35, kgPorSaca: 6.7 },
  { sc: 40, kgPorSaca: 6.35 },
  { sc: 45, kgPorSaca: 6 },
  { sc: 50, kgPorSaca: 5.85 },
  { sc: 55, kgPorSaca: 5.35 },
  { sc: 60, kgPorSaca: 5.35 },
  { sc: 65, kgPorSaca: 5.35 },
  { sc: 70, kgPorSaca: 5.35 },
  { sc: 75, kgPorSaca: 5.35 },
  { sc: 80, kgPorSaca: 5.35 },
  { sc: 85, kgPorSaca: 5.35 },
  { sc: 90, kgPorSaca: 5.5 },
];

const TABELA_K_RAMON = [
  { sc: 20, kgHa: 125 },
  { sc: 30, kgHa: 195 },
  { sc: 40, kgHa: 255 },
  { sc: 50, kgHa: 315 },
  { sc: 60, kgHa: 380 },
];

const TABELA_P_RAMON = [
  { sc: 20, kgHa: 17.5 },
  { sc: 30, kgHa: 29 },
  { sc: 40, kgHa: 37.5 },
  { sc: 50, kgHa: 45 },
  { sc: 60, kgHa: 60 },
];

// ── Helpers de interpolação ──────────────────────────────────────────────────

function interpolar(tabela, scKey, valKey, media) {
  if (media == null || media <= 0) return null;
  const sorted = [...tabela].sort((a, b) => a[scKey] - b[scKey]);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (media <= first[scKey]) return first[valKey];

  // Extrapolação linear acima do último ponto
  if (media > last[scKey]) {
    const prev = sorted[sorted.length - 2];
    const slope = (last[valKey] - prev[valKey]) / (last[scKey] - prev[scKey]);
    return last[valKey] + slope * (media - last[scKey]);
  }

  // Interpolação linear entre pontos
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (media >= a[scKey] && media <= b[scKey]) {
      const t = (media - a[scKey]) / (b[scKey] - a[scKey]);
      return a[valKey] + t * (b[valKey] - a[valKey]);
    }
  }
  return null;
}

// ── Cálculos por nutriente ───────────────────────────────────────────────────

export function calcN_Ramon(mediaBienal) {
  if (mediaBienal == null || mediaBienal <= 0) return null;
  const kgPorSaca = interpolar(TABELA_N_RAMON, 'sc', 'kgPorSaca', mediaBienal);
  if (kgPorSaca == null) return null;
  return Math.round(kgPorSaca * mediaBienal);
}

export function calcK_Ramon(mediaBienal, kSolo0020_mgdm3, kSolo2040_mgdm3) {
  if (mediaBienal == null || mediaBienal <= 0) return null;
  const doseBase = interpolar(TABELA_K_RAMON, 'sc', 'kgHa', mediaBienal);
  if (doseBase == null) return null;

  // Soma das camadas (já em mg/dm³)
  const k1 = kSolo0020_mgdm3 != null ? Number(kSolo0020_mgdm3) : null;
  const k2 = kSolo2040_mgdm3 != null ? Number(kSolo2040_mgdm3) : null;
  const kTotal = k1 != null && k2 != null ? k1 + k2 : k1;

  if (kTotal == null) return Math.round(doseBase);

  // Ajuste pela disponibilidade no solo
  if (kTotal < 60)               return Math.round(doseBase * 1.30);
  if (kTotal <= 120)             return Math.round(doseBase * 1.10);
  if (kTotal <= 150)             return Math.round(doseBase);
  if (kTotal <= 200)             return Math.round(doseBase * 0.70);
  return 0; // > 200 → dispensar
}

export function calcP_Ramon(mediaBienal, pSolo_mgdm3) {
  if (mediaBienal == null || mediaBienal <= 0) return null;
  const doseBase = interpolar(TABELA_P_RAMON, 'sc', 'kgHa', mediaBienal);
  if (doseBase == null) return null;

  if (pSolo_mgdm3 == null) return Math.round(doseBase);

  const p = Number(pSolo_mgdm3);
  if (p < 10)        return Math.round(doseBase * 1.50);
  if (p <= 15)       return Math.round(doseBase);
  if (p <= 20)       return Math.round(doseBase * 0.50);
  return 0; // > 20 → dispensar
}

export function calcB_Ramon(bSolo_mgdm3) {
  if (bSolo_mgdm3 == null) return null;
  const b = Number(bSolo_mgdm3);
  if (b < 0.5)       return 7;
  if (b <= 0.8)      return 5;
  if (b <= 1.0)      return 3;
  return 0;
}

/**
 * Calcula a recomendação completa pelo Protocolo Ramon para um talhão.
 * @param {number} mediaBienal - Média bienal de produtividade em sc/ha
 * @param {object} analise - Análise de solo 0-20cm
 * @param {object|null} analise2040 - Análise de solo 20-40cm (opcional, usado apenas para K)
 * @returns {object} Recomendação com N, P, K, B, e ações para Zn, Cu, Mn
 */
export function calcRecomendacaoRamon(mediaBienal, analise, analise2040) {
  if (mediaBienal == null || mediaBienal <= 0 || !analise) return null;

  const kSolo = analise.potassio != null ? Number(analise.potassio) : null;
  const kSolo2040 = analise2040?.potassio != null ? Number(analise2040.potassio) : null;

  return {
    N: calcN_Ramon(mediaBienal),
    P: calcP_Ramon(mediaBienal, analise.fosforo),
    K: calcK_Ramon(mediaBienal, kSolo, kSolo2040),
    B: calcB_Ramon(analise.boro),
  };
}