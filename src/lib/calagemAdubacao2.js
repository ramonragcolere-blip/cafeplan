export const NIVEIS_CALAGEM = {
  Mínimo: { ca: 3.0, mg: 1.0, k: 0.33, label: 'Mínimo' },
  Bom: { ca: 3.6, mg: 1.2, k: 0.40, label: 'Bom' },
  Excelente: { ca: 4.5, mg: 1.5, k: 0.50, label: 'Excelente' },
};

export function normalizarNumeroCalagem(valor) {
  if (valor == null || valor === '') return null;
  const normalizado = typeof valor === 'string' ? valor.trim().replace(',', '.') : valor;
  if (normalizado === '') return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

export function lerDadosAnaliseCalagem(analise) {
  const caAtual = normalizarNumeroCalagem(analise?.calcio);
  const mgAtual = normalizarNumeroCalagem(analise?.magnesio);
  const potassioMgDm3 = normalizarNumeroCalagem(analise?.potassio);
  const kAtual = potassioMgDm3 != null ? potassioMgDm3 / 391 : null;
  const v1 = normalizarNumeroCalagem(analise?.saturacao_bases);
  const ctcAtual = normalizarNumeroCalagem(analise?.ctc);
  return { caAtual, mgAtual, kAtual, v1, ctcAtual };
}

export function calcCalagemElevacao(caAtual, mgAtual, nivel, produto, area) {
  const meta = NIVEIS_CALAGEM[nivel] || NIVEIS_CALAGEM.Bom;
  const ca = normalizarNumeroCalagem(caAtual);
  const mg = normalizarNumeroCalagem(mgAtual);
  const areaHa = normalizarNumeroCalagem(area) || 0;
  const defCa = ca != null ? Math.max(0, meta.ca - ca) : null;
  const defMg = mg != null ? Math.max(0, meta.mg - mg) : null;
  if (defCa == null || defMg == null) return { defCa, defMg, meta, incompleto: true };
  if (!produto) return { defCa, defMg, meta };

  const pctCa = normalizarNumeroCalagem(produto.ca_pct) || 0;
  const pctMg = normalizarNumeroCalagem(produto.mg_pct) || 0;

  let dosePeloCa = 0;
  if (pctCa > 0 && defCa > 0) {
    const cmolcPorTonCa = (1000 * (pctCa / 100)) / 560;
    dosePeloCa = (defCa / cmolcPorTonCa) * 1000;
  }
  let dosePeloMg = 0;
  if (pctMg > 0 && defMg > 0) {
    const cmolcPorTonMg = (1000 * (pctMg / 100)) / 400;
    dosePeloMg = (defMg / cmolcPorTonMg) * 1000;
  }

  const doseFinalHa = Math.max(dosePeloCa, dosePeloMg);
  const totalKg = areaHa > 0 ? doseFinalHa * areaHa : null;

  return {
    defCa, defMg, meta,
    dosePeloCa: Math.round(dosePeloCa),
    dosePeloMg: Math.round(dosePeloMg),
    doseFinalHa: Math.round(doseFinalHa),
    totalKg: totalKg != null ? Math.round(totalKg) : null,
    ton: totalKg != null ? parseFloat((totalKg / 1000).toFixed(3)) : null,
    sc40: totalKg != null ? parseFloat((totalKg / 40).toFixed(1)) : null,
    sc50: totalKg != null ? parseFloat((totalKg / 50).toFixed(1)) : null,
  };
}

export function calcCalagemVpct({ ctc, v1, v2, prnt, area }) {
  const ctcNum = normalizarNumeroCalagem(ctc);
  const v1Num = normalizarNumeroCalagem(v1);
  const v2Num = normalizarNumeroCalagem(v2);
  const prntNum = normalizarNumeroCalagem(prnt);
  const areaHa = normalizarNumeroCalagem(area) || 0;
  if (ctcNum == null || v1Num == null || v2Num == null) return null;
  if (v2Num <= v1Num) return { doseFinalHa: 0, totalKg: areaHa > 0 ? 0 : null, ton: areaHa > 0 ? 0 : null, sc40: areaHa > 0 ? 0 : null, sc50: areaHa > 0 ? 0 : null };
  let nc = ctcNum * (v2Num - v1Num) / 100;
  if (prntNum > 0) nc = nc * (100 / prntNum);
  const doseFinalHa = Math.max(0, Math.round(nc * 1000));
  if (!Number.isFinite(doseFinalHa)) return null;
  const totalKg = areaHa > 0 ? Math.round(doseFinalHa * areaHa) : null;
  return {
    doseFinalHa,
    totalKg,
    ton: totalKg != null ? parseFloat((totalKg / 1000).toFixed(3)) : null,
    sc40: totalKg != null ? parseFloat((totalKg / 40).toFixed(1)) : null,
    sc50: totalKg != null ? parseFloat((totalKg / 50).toFixed(1)) : null,
  };
}

export function calcularMetrosLinearesTalhao(talhao) {
  const metrosInformados = normalizarNumeroCalagem(talhao?.metros_lineares);
  if (metrosInformados > 0) return Math.round(metrosInformados);
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => normalizarNumeroCalagem(p));
  const entreLinhasM = partes?.[0] || 0;
  const entrePlantasM = partes?.[1] || 0;
  const numPlantas = normalizarNumeroCalagem(talhao?.num_plantas) || 0;
  const areaHa = normalizarNumeroCalagem(talhao?.area_ha) || 0;
  if (numPlantas > 0 && entrePlantasM > 0) return Math.round(numPlantas * entrePlantasM);
  if (areaHa > 0 && entreLinhasM > 0) return Math.round((areaHa * 10000) / entreLinhasM);
  return 0;
}

export function calcularDistribuicaoCalagem({ doseKgHa, doseTotalKg, talhao }) {
  const dose = normalizarNumeroCalagem(doseKgHa);
  const area = normalizarNumeroCalagem(talhao?.area_ha) || 0;
  const numPlantas = normalizarNumeroCalagem(talhao?.num_plantas) || 0;
  const totalSalvo = normalizarNumeroCalagem(doseTotalKg);
  const totalKg = dose != null && area > 0 ? Math.round(dose * area) : totalSalvo;
  const metros = calcularMetrosLinearesTalhao(talhao);
  return {
    totalKg,
    gPlanta: numPlantas > 0 && totalKg != null ? Math.round((totalKg * 1000) / numPlantas) : null,
    gMetro: metros > 0 && totalKg != null ? Math.round((totalKg * 1000) / metros) : null,
  };
}

function timestampRegistro(registro) {
  const valor = registro?.updated_date || registro?.created_date || registro?.updatedAt || registro?.createdAt;
  const timestamp = valor ? Date.parse(valor) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function selecionarRegistroCalagem(registros) {
  let selecionado = null;
  let selecionadoTimestamp = -1;
  let selecionadoIndice = -1;
  (registros || []).forEach((registro, indice) => {
    if (!registro?.id) return;
    const timestamp = timestampRegistro(registro);
    if (!selecionado || timestamp > selecionadoTimestamp ||
        (timestamp === selecionadoTimestamp && indice > selecionadoIndice)) {
      selecionado = registro;
      selecionadoTimestamp = timestamp;
      selecionadoIndice = indice;
    }
  });
  return selecionado;
}

export function resolverRegistroCalagemAtual(registros, registroIdAnterior = null) {
  return selecionarRegistroCalagem(registros)?.id || null;
}

export function lerMetadadosCalagem(registro) {
  if (!registro?.observacoes || typeof registro.observacoes !== 'string') return {};
  try {
    const parsed = JSON.parse(registro.observacoes);
    return parsed && typeof parsed === 'object' && parsed._tipo === 'calagem_adubacao2' ? parsed : {};
  } catch {
    return {};
  }
}

export function criarObservacoesCalagem(dados) {
  return JSON.stringify({ _tipo: 'calagem_adubacao2', ...dados });
}
