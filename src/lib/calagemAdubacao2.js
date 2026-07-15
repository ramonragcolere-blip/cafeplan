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
  const totalKg = totalSalvo != null ? Math.round(totalSalvo) : dose != null && area > 0 ? Math.round(dose * area) : null;
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

export function normalizarChaveProdutoCalagem(nome) {
  return (nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function listarCalagensRecentesPorTalhao({ calagens = [], talhoes = [], codigoProdutor = null, safra = null }) {
  const talhoesIds = new Set((talhoes || []).map(t => t.id));
  const porTalhao = {};
  (calagens || []).forEach(calagem => {
    if (!calagem?.talhao_id) return;
    if (talhoesIds.size > 0 && !talhoesIds.has(calagem.talhao_id)) return;
    if (codigoProdutor && calagem.codigo_produtor && calagem.codigo_produtor !== codigoProdutor) return;
    if (safra && calagem.safra && calagem.safra !== safra) return;
    if (!porTalhao[calagem.talhao_id]) porTalhao[calagem.talhao_id] = [];
    porTalhao[calagem.talhao_id].push(calagem);
  });

  return Object.values(porTalhao)
    .map(registros => selecionarRegistroCalagem(registros))
    .filter(Boolean);
}

function produtoCalagemPendente(calagem) {
  const dose = normalizarNumeroCalagem(calagem?.dose_kg_ha) || 0;
  return dose > 0 && !(calagem?.produto_nome || '').trim() && !(calagem?.produto_id || '').trim();
}

export function precisaCorretivoParaCalagemPositiva({ doseKgHa, produto = null }) {
  const dose = normalizarNumeroCalagem(doseKgHa) || 0;
  return dose > 0 && !produto;
}

export function podeSalvarRecomendacaoCalagem({ resultado, produto = null }) {
  const dose = normalizarNumeroCalagem(resultado?.doseFinalHa);
  if (dose == null) return false;
  return !precisaCorretivoParaCalagemPositiva({ doseKgHa: dose, produto });
}

export function atualizarListaCalagens(listaAtual, registroAtualizado) {
  const lista = Array.isArray(listaAtual) ? listaAtual : [];
  if (!registroAtualizado) return lista;
  const indice = lista.findIndex(item =>
    (registroAtualizado.id && item.id === registroAtualizado.id) ||
    (item.codigo_produtor === registroAtualizado.codigo_produtor &&
      item.safra === registroAtualizado.safra &&
      item.talhao_id === registroAtualizado.talhao_id)
  );
  if (indice >= 0) {
    const proxima = [...lista];
    proxima[indice] = { ...proxima[indice], ...registroAtualizado };
    return proxima;
  }
  return [...lista, registroAtualizado];
}

function criarLinhaCalagemResumo(calagem, talhao) {
  const doseKgHa = normalizarNumeroCalagem(calagem?.dose_kg_ha);
  if (doseKgHa == null) return null;
  const { totalKg, gPlanta, gMetro } = calcularDistribuicaoCalagem({
    doseKgHa,
    doseTotalKg: calagem.dose_total_kg,
    talhao,
  });
  const pendenteProduto = produtoCalagemPendente(calagem);
  const produtoNome = (calagem.produto_nome || '').trim() || (pendenteProduto ? 'Corretivo não selecionado' : '');
  if (!produtoNome && doseKgHa <= 0) return null;

  return {
    produtoNome,
    produtoId: calagem.produto_id || null,
    doseKgHa,
    totalKg,
    gPlanta,
    gMetro,
    nutLabels: ['Calagem'],
    isCalagem: true,
    pendenteProduto,
  };
}

export function consolidarComprasAdubacao2({ resultados, produtosEfetivos = {}, calagens = [], talhoes = [], codigoProdutor = null, safra = null }) {
  const mapa = {};

  (resultados || []).forEach(r => {
    const efetivo = produtosEfetivos[r.talhao.id];
    const area = r.talhao.area_ha || 0;
    const sacas = r.mediaBienal != null ? r.mediaBienal * area : 0;

    const produto = efetivo?.produto || r.produtoSugerido;
    const dose = efetivo?.doseKgHa ?? r.doseProdutoHa;
    if (produto) {
      const id = produto.id;
      const chave = `id:${id}`;
      const doseTotal = dose != null ? dose * area : 0;
      if (!mapa[chave]) mapa[chave] = { produto, talhoes: [], qtdTotal: 0, areaTotal: 0, sacasTotal: 0 };
      mapa[chave].talhoes.push(r.talhao.nome);
      mapa[chave].qtdTotal += doseTotal;
      mapa[chave].areaTotal += area;
      mapa[chave].sacasTotal += sacas;
    }

    const complementos = efetivo?.complementos || [];
    for (const comp of complementos) {
      if (!comp.produto?.id || !comp.doseKgHa) continue;
      const id = comp.produto.id;
      const chave = `id:${id}`;
      const doseTotal = comp.doseKgHa * area;
      if (!mapa[chave]) mapa[chave] = { produto: comp.produto, talhoes: [], qtdTotal: 0, areaTotal: 0, sacasTotal: 0 };
      if (!mapa[chave].talhoes.includes(r.talhao.nome)) mapa[chave].talhoes.push(r.talhao.nome);
      mapa[chave].qtdTotal += doseTotal;
      mapa[chave].areaTotal += area;
    }
  });

  const talhaoPorId = new Map((talhoes || []).map(t => [t.id, t]));
  const calagensRecentes = listarCalagensRecentesPorTalhao({ calagens, talhoes, codigoProdutor, safra });
  calagensRecentes.forEach(calagem => {
    const doseKgHa = normalizarNumeroCalagem(calagem.dose_kg_ha);
    if (doseKgHa == null || doseKgHa <= 0) return;
    const produtoNome = (calagem.produto_nome || '').trim();
    if (!produtoNome) return;

    const talhao = talhaoPorId.get(calagem.talhao_id);
    if (!talhao) return;
    const { totalKg } = calcularDistribuicaoCalagem({
      doseKgHa,
      doseTotalKg: calagem.dose_total_kg,
      talhao,
    });
    if (totalKg == null || totalKg <= 0) return;

    const produtoId = (calagem.produto_id || '').trim();
    const chave = produtoId ? `id:${produtoId}` : `nome:${normalizarChaveProdutoCalagem(produtoNome)}`;
    if (!mapa[chave]) {
      mapa[chave] = {
        produto: { id: produtoId || chave, nome: produtoNome },
        produtoId: produtoId || null,
        produtoNome,
        talhoes: [],
        qtdTotal: 0,
        areaTotal: 0,
        sacasTotal: 0,
        doseKgHa,
        isCalagem: true,
      };
    }
    if (!mapa[chave].talhoes.includes(talhao.nome)) mapa[chave].talhoes.push(talhao.nome);
    mapa[chave].qtdTotal += totalKg;
    mapa[chave].areaTotal += normalizarNumeroCalagem(talhao.area_ha) || 0;
  });

  return Object.values(mapa);
}

export function montarGruposResumoAdubacao2({ resultados, todos = [], produtosEfetivos = {}, calagens = [], talhoes = [], codigoProdutor = null, safra = null, sugerirProdutos = null }) {
  const calagensRecentes = listarCalagensRecentesPorTalhao({ calagens, talhoes, codigoProdutor, safra });
  const calagensMap = {};
  calagensRecentes.forEach(calagem => { calagensMap[calagem.talhao_id] = calagem; });

  const talhaoIds = new Set([
    ...(resultados || []).filter(r => r.rec).map(r => r.talhao.id),
    ...calagens.map(c => c.talhao_id),
  ]);

  return Array.from(talhaoIds).map(talhaoId => {
    const resultado = (resultados || []).find(r => r.talhao.id === talhaoId);
    const talhao = resultado?.talhao || talhoes.find(t => t.id === talhaoId);
    if (!talhao) return null;

    const area = normalizarNumeroCalagem(talhao.area_ha) || 0;
    const numPlantas = normalizarNumeroCalagem(talhao.num_plantas) || 0;
    const metros = calcularMetrosLinearesTalhao(talhao);
    const linhas = [];

    if (resultado?.rec) {
      const rec = resultado.rec;
      const efetivo = produtosEfetivos[talhaoId];
      const produtoSalvo = resultado.produtoSugerido || null;
      const doseSalva = resultado.doseProdutoHa || null;

      let produtoPrincipal = efetivo?.produto || produtoSalvo;
      let dosePrincipal = efetivo?.doseKgHa ?? doseSalva;

      if (!produtoPrincipal && todos.length > 0 && sugerirProdutos) {
        const sugestoes = sugerirProdutos(todos, { N: rec.N, P: rec.P, K: rec.K, B: rec.B });
        const sugN = sugestoes['n_pct'];
        if (sugN?.produtoId) {
          const prod = todos.find(p => p.id === sugN.produtoId);
          if (prod) {
            produtoPrincipal = prod;
            const pctN = parseFloat(prod.n_pct) || 0;
            dosePrincipal = pctN > 0 && rec.N != null ? Math.round((rec.N / (pctN / 100)) * 10) / 10 : null;
          }
        }
      }

      if (produtoPrincipal && dosePrincipal) {
        const totalKg = area > 0 ? Math.round(dosePrincipal * area) : null;
        const gPlanta = numPlantas > 0 && totalKg != null ? Math.round((totalKg * 1000) / numPlantas) : null;
        const gMetro = metros > 0 && totalKg != null ? Math.round((totalKg * 1000) / metros) : null;
        linhas.push({ produtoNome: produtoPrincipal.nome, produtoId: produtoPrincipal.id, doseKgHa: dosePrincipal, totalKg, gPlanta, gMetro, nutLabels: ['Principal'], isCalagem: false });
      }

      const complementos = efetivo?.complementos || [];
      for (const comp of complementos) {
        if (!comp.produto?.nome || !comp.doseKgHa) continue;
        const totalKg = area > 0 ? Math.round(comp.doseKgHa * area) : null;
        const gPlanta = numPlantas > 0 && totalKg != null ? Math.round((totalKg * 1000) / numPlantas) : null;
        const gMetro = metros > 0 && totalKg != null ? Math.round((totalKg * 1000) / metros) : null;
        const nutLabels = (comp.nutrientes || []).map(n => n.label).filter(Boolean);
        linhas.push({ produtoNome: comp.produto.nome, produtoId: comp.produto.id, doseKgHa: comp.doseKgHa, totalKg, gPlanta, gMetro, nutLabels: nutLabels.length > 0 ? nutLabels : ['Complemento'], isCalagem: false });
      }
    }

    const calagem = calagensMap[talhaoId];
    const linhaCalagem = criarLinhaCalagemResumo(calagem, talhao);
    if (linhaCalagem) linhas.push(linhaCalagem);

    if (linhas.length === 0) return null;
    return { talhao, linhas };
  }).filter(Boolean);
}
