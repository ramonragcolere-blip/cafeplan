export const MENSAGEM_SEM_ANALISE_2040 = 'Análise de subsuperfície necessária para recomendar gessagem.';
export const ORIENTACAO_APLICACAO_GESSAGEM = 'Aplicar após o calcário e distribuir em faixa uniforme.';
export const ALERTA_LIXIVIACAO_GESSAGEM = 'Monitorar Mg e K: doses elevadas de gesso podem aumentar o risco de lixiviação de Mg e K.';

export function normalizarNumeroGessagem(valor) {
  if (valor == null || valor === '') return null;
  const normalizado = typeof valor === 'string' ? valor.trim().replace(',', '.') : valor;
  if (normalizado === '') return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

export function normalizarUnidadePrecoGessagem(unidade) {
  return unidade === 'kg' || unidade === 'R$/kg' ? 'kg' : 't';
}

function timestampRegistro(registro) {
  const valor = registro?.updated_date || registro?.created_date || registro?.updatedAt || registro?.createdAt;
  const timestamp = valor ? Date.parse(valor) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function doseCalagemRegistro(registro) {
  return normalizarNumeroGessagem(
    registro?.dose_kg_ha ??
    registro?.dose_calcario_kg_ha ??
    registro?.doseFinalHa ??
    registro?.dose_final_kg_ha
  );
}

function produtoCalagemPreenchido(registro) {
  const id = registro?.produto_id;
  const nome = registro?.produto_nome;
  const idValido = id != null && id !== '' && id !== 0 && id !== '0';
  const nomeValido = nome != null && nome !== '' && nome !== 0 && nome !== '0';
  return Boolean(idValido || nomeValido);
}

function qualidadeRegistroCalagem(registro) {
  const dose = doseCalagemRegistro(registro);
  const temDosePositiva = dose != null && dose > 0;
  const temProduto = produtoCalagemPreenchido(registro);
  if (temDosePositiva && temProduto) return 3;
  if (temDosePositiva) return 2;
  if (temProduto) return 1;
  return 0;
}

function parseMetadadosJson(texto) {
  if (!texto || typeof texto !== 'string') return {};
  try {
    const parsed = JSON.parse(texto);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function extrairCaoPctExplicito(...fontes) {
  const textos = fontes
    .filter(valor => typeof valor === 'string' && valor.trim())
    .map(valor => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  for (const texto of textos) {
    const direto = texto.match(/\b(?:CaO|oxido\s+de\s+calcio)\b\s*:?\s*(\d+(?:[,.]\d+)?)\s*%/i);
    if (direto) return normalizarNumeroGessagem(direto[1]);
    const invertido = texto.match(/(\d+(?:[,.]\d+)?)\s*%\s*(?:de\s+)?\b(?:CaO|oxido\s+de\s+calcio)\b/i);
    if (invertido) return normalizarNumeroGessagem(invertido[1]);
  }
  return null;
}

export function selecionarRegistroCalagemParaGessagem({ calagens = [], codigoProdutor = null, safra = null, talhaoId = null } = {}) {
  let selecionado = null;
  let selecionadoQualidade = -1;
  let selecionadoTimestamp = -1;
  let selecionadoIndice = -1;
  (calagens || []).forEach((calagem, indice) => {
    if (!calagem || !codigoProdutor || !safra || !talhaoId) return;
    if (calagem.codigo_produtor !== codigoProdutor) return;
    if (calagem.safra !== safra) return;
    if (calagem.talhao_id !== talhaoId) return;
    const qualidade = qualidadeRegistroCalagem(calagem);
    const timestamp = timestampRegistro(calagem);
    if (!selecionado || qualidade > selecionadoQualidade ||
        (qualidade === selecionadoQualidade && timestamp > selecionadoTimestamp) ||
        (qualidade === selecionadoQualidade && timestamp === selecionadoTimestamp && indice > selecionadoIndice)) {
      selecionado = calagem;
      selecionadoQualidade = qualidade;
      selecionadoTimestamp = timestamp;
      selecionadoIndice = indice;
    }
  });
  return selecionado;
}

export function normalizarCalagemParaGessagem({
  calagens = [],
  produtos = [],
  codigoProdutor = null,
  safra = null,
  talhaoId = null,
} = {}) {
  const calagem = selecionarRegistroCalagemParaGessagem({ calagens, codigoProdutor, safra, talhaoId });
  if (!calagem) return null;
  const produto = (produtos || []).find(p => p?.id && p.id === calagem.produto_id) ||
    (produtos || []).find(p => p?.nome && calagem.produto_nome && p.nome === calagem.produto_nome) ||
    null;
  const metadados = parseMetadadosJson(calagem.observacoes);
  const preco = normalizarNumeroGessagem(calagem.preco_unitario ?? metadados.preco_unitario);
  const caoCampo = normalizarNumeroGessagem(calagem.cao_calcario_pct ?? metadados.cao_calcario_pct);
  const caoProduto = normalizarNumeroGessagem(produto?.cao_pct);
  const caoTexto = extrairCaoPctExplicito(
    calagem.composicao_texto,
    calagem.observacoes,
    produto?.composicao_texto,
    produto?.outros_nutrientes,
    produto?.nutrientes_secundarios,
    produto?.observacoes
  );

  return {
    registro: calagem,
    produto,
    doseCalcarioKgHa: doseCalagemRegistro(calagem),
    produtoId: calagem.produto_id || produto?.id || '',
    produtoNome: calagem.produto_nome || produto?.nome || '',
    precoUnitario: preco != null && preco >= 0 ? preco : null,
    unidadePreco: calagem.unidade_preco === 'kg' || metadados.unidade_preco === 'kg' ? 'kg' : 't',
    prnt: normalizarNumeroGessagem(calagem.prnt_calcario ?? calagem.prnt ?? metadados.prnt_efetivo ?? produto?.prnt),
    caoCalcarioPct: caoCampo ?? caoProduto ?? caoTexto,
    caPct: normalizarNumeroGessagem(calagem.ca_calcario_pct ?? produto?.ca_pct),
    mgPct: normalizarNumeroGessagem(calagem.mg_calcario_pct ?? produto?.mg_pct),
  };
}

export function selecionarRegistroGessagem(registros) {
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

export function atualizarListaGessagens(listaAtual, registroAtualizado) {
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

function calcularMPercentual(analise) {
  const informado = normalizarNumeroGessagem(
    analise?.saturacao_aluminio ?? analise?.m_pct ?? analise?.m
  );
  if (informado != null) return informado;
  const aluminio = normalizarNumeroGessagem(analise?.aluminio);
  const sb = normalizarNumeroGessagem(analise?.sb);
  if (aluminio == null || sb == null || aluminio + sb <= 0) return null;
  return Math.round((aluminio / (aluminio + sb)) * 1000) / 10;
}

export function lerDadosAnaliseGessagem(analise2040, argilaManual = null) {
  if (!analise2040) {
    return {
      temAnalise2040: false,
      ca2040: null,
      al2040: null,
      mPercentual: null,
      mg2040: null,
      k2040: null,
      argilaPct: normalizarNumeroGessagem(argilaManual),
    };
  }

  const argilaAnalise = normalizarNumeroGessagem(
    analise2040.argila_pct ??
    analise2040.teor_argila ??
    analise2040.argila ??
    analise2040.textura_argila_pct
  );

  return {
    temAnalise2040: true,
    ca2040: normalizarNumeroGessagem(analise2040.calcio),
    al2040: normalizarNumeroGessagem(analise2040.aluminio),
    mPercentual: calcularMPercentual(analise2040),
    mg2040: normalizarNumeroGessagem(analise2040.magnesio),
    k2040: normalizarNumeroGessagem(analise2040.potassio),
    argilaPct: argilaAnalise ?? normalizarNumeroGessagem(argilaManual),
  };
}

export function calcularFaixa5aAproximacao(argilaPct) {
  const argila = normalizarNumeroGessagem(argilaPct);
  if (argila == null) return null;
  if (argila <= 15) return { minT: 0, maxT: 0.4, minKgHa: 0, maxKgHa: 400 };
  if (argila <= 35) return { minT: 0.4, maxT: 0.8, minKgHa: 400, maxKgHa: 800 };
  if (argila <= 60) return { minT: 0.8, maxT: 1.2, minKgHa: 800, maxKgHa: 1200 };
  return { minT: 1.2, maxT: 1.6, minKgHa: 1200, maxKgHa: 1600 };
}

export function calcularGessagemLopes({ doseCalcarioKgHa, caoCalcarioPct, caoGessoPct = 25 } = {}) {
  const doseCalcario = normalizarNumeroGessagem(doseCalcarioKgHa);
  const pctCalcario = normalizarNumeroGessagem(caoCalcarioPct);
  const pctGesso = normalizarNumeroGessagem(caoGessoPct) ?? 25;
  if (doseCalcario == null || pctCalcario == null || doseCalcario < 0 || pctCalcario <= 0 || pctGesso <= 0) {
    return null;
  }
  const caoCalcarioKgHa = doseCalcario * pctCalcario / 100;
  const caoSubstituirKgHa = caoCalcarioKgHa * 0.25;
  const gessoKgHa = caoSubstituirKgHa / (pctGesso / 100);
  return {
    caoCalcarioKgHa: Math.round(caoCalcarioKgHa * 10) / 10,
    caoSubstituirKgHa: Math.round(caoSubstituirKgHa * 10) / 10,
    gessoKgHa: Math.round(gessoKgHa * 10) / 10,
    calcarioAjustadoKgHa: Math.round(doseCalcario * 0.75 * 10) / 10,
    caoGessoPct: pctGesso,
  };
}

export function calcularRecomendacaoGessagem({
  talhao = null,
  analise2040 = null,
  argilaManual = null,
  doseCalcarioKgHa = null,
  caoCalcarioPct = null,
  caoGessoPct = 25,
} = {}) {
  const dados = lerDadosAnaliseGessagem(analise2040, argilaManual);
  if (!dados.temAnalise2040) {
    return {
      ...dados,
      talhao,
      indicada: false,
      motivos: [],
      faixa5a: null,
      lopes: null,
      doseSugeridaKgHa: null,
      mensagem: MENSAGEM_SEM_ANALISE_2040,
    };
  }

  const motivos = [];
  if (dados.mPercentual != null && dados.mPercentual > 30) motivos.push('m% maior que 30%');
  if (dados.ca2040 != null && dados.ca2040 < 0.4) motivos.push('Ca menor que 0,4 cmolc/dm³');
  if (dados.al2040 != null && dados.al2040 > 0.5) motivos.push('Al maior que 0,5 cmolc/dm³');
  const indicada = motivos.length > 0;
  const faixa5a = calcularFaixa5aAproximacao(dados.argilaPct);
  const lopes = calcularGessagemLopes({ doseCalcarioKgHa, caoCalcarioPct, caoGessoPct });
  const candidatos = [lopes?.gessoKgHa, faixa5a?.maxKgHa]
    .map(normalizarNumeroGessagem)
    .filter(valor => valor != null && valor >= 0);
  const doseSugeridaKgHa = indicada && candidatos.length > 0 ? Math.min(...candidatos) : null;

  return {
    ...dados,
    talhao,
    indicada,
    motivos,
    faixa5a,
    lopes,
    doseSugeridaKgHa,
    mensagem: indicada ? null : 'Gessagem não indicada pela análise 20–40 cm.',
  };
}

function doseFaixa5aKgHa(faixa, posicao = 'media') {
  if (!faixa) return null;
  if (posicao === 'minima') return faixa.minKgHa;
  if (posicao === 'maxima') return faixa.maxKgHa;
  return Math.round(((faixa.minKgHa + faixa.maxKgHa) / 2) * 10) / 10;
}

export function selecionarDoseMetodoGessagem({
  recomendacao,
  metodoCalculo = 'combinado_conservador',
  faixa5aPosicao = 'media',
  doseManualKgHa = null,
  aplicarSemIndicacao = false,
} = {}) {
  const rec = recomendacao || {};
  const doseManual = normalizarNumeroGessagem(doseManualKgHa);
  const dose5a = doseFaixa5aKgHa(rec.faixa5a, faixa5aPosicao);
  const doseLopes = normalizarNumeroGessagem(rec.lopes?.gessoKgHa);
  const candidatosCombinados = [doseLopes, rec.faixa5a?.maxKgHa]
    .map(normalizarNumeroGessagem)
    .filter(valor => valor != null && valor >= 0);
  let doseMatematica = null;

  if (metodoCalculo === 'dose_manual') doseMatematica = doseManual;
  else if (metodoCalculo === 'lopes') doseMatematica = doseLopes;
  else if (metodoCalculo === '5a_aproximacao') doseMatematica = dose5a;
  else doseMatematica = candidatosCombinados.length > 0 ? Math.min(...candidatosCombinados) : null;

  const indicada = Boolean(rec.indicada);
  const doseTecnica = indicada ? doseMatematica : null;
  const doseFinal = indicada || aplicarSemIndicacao ? doseMatematica : null;

  return {
    metodoCalculo,
    faixa5aPosicao,
    dose5aKgHa: dose5a,
    doseLopesKgHa: doseLopes,
    doseMatematicaKgHa: doseMatematica,
    doseTecnicaKgHa: doseTecnica,
    doseFinalKgHa: doseFinal,
    aplicarSemIndicacao: Boolean(aplicarSemIndicacao),
  };
}

export function calcularCustoGessagem({ doseKgHa, areaHa, precoUnitario, unidadePreco = 't' } = {}) {
  const dose = normalizarNumeroGessagem(doseKgHa);
  const area = normalizarNumeroGessagem(areaHa) || 0;
  const preco = normalizarNumeroGessagem(precoUnitario);
  const unidade = normalizarUnidadePrecoGessagem(unidadePreco);
  const quantidadeTotalKg = dose != null && area > 0 ? Math.round(dose * area) : null;
  if (dose == null || preco == null || preco < 0) {
    return { quantidadeTotalKg, precoUnitario: null, unidadePreco: unidade, custoHa: null, custoTotal: null };
  }
  const custoHa = unidade === 'kg' ? dose * preco : (dose / 1000) * preco;
  const custoTotal = quantidadeTotalKg != null ? (unidade === 'kg' ? quantidadeTotalKg * preco : (quantidadeTotalKg / 1000) * preco) : null;
  return { quantidadeTotalKg, precoUnitario: preco, unidadePreco: unidade, custoHa, custoTotal };
}

export function calcularFornecimentoGesso({ produto, doseKgHa } = {}) {
  const dose = normalizarNumeroGessagem(doseKgHa);
  if (dose == null) return { caKgHa: null, sKgHa: null };
  const caPct = normalizarNumeroGessagem(produto?.ca_pct) || 0;
  const sPct = normalizarNumeroGessagem(produto?.s_pct) || 0;
  return {
    caKgHa: Math.round(dose * caPct) / 100,
    sKgHa: Math.round(dose * sPct) / 100,
  };
}

export function calcularDistribuicaoGessagem({ doseKgHa, quantidadeTotalKg, talhao }) {
  const dose = normalizarNumeroGessagem(doseKgHa);
  const area = normalizarNumeroGessagem(talhao?.area_ha) || 0;
  const numPlantas = normalizarNumeroGessagem(talhao?.num_plantas) || 0;
  const totalSalvo = normalizarNumeroGessagem(quantidadeTotalKg);
  const totalKg = totalSalvo != null ? Math.round(totalSalvo) : dose != null && area > 0 ? Math.round(dose * area) : null;
  const partesEsp = talhao?.espacamento?.split(/[xX×]/).map(p => normalizarNumeroGessagem(p));
  const entreLinhasM = partesEsp?.[0] || 0;
  const entrePlantasM = partesEsp?.[1] || 0;
  const metros = normalizarNumeroGessagem(talhao?.metros_lineares) ||
    (numPlantas > 0 && entrePlantasM > 0 ? numPlantas * entrePlantasM : area > 0 && entreLinhasM > 0 ? (area * 10000) / entreLinhasM : 0);
  return {
    totalKg,
    gPlanta: numPlantas > 0 && totalKg != null ? Math.round((totalKg * 1000) / numPlantas) : null,
    gMetro: metros > 0 && totalKg != null ? Math.round((totalKg * 1000) / metros) : null,
  };
}

export function formatarPrecoUnitarioGessagem(preco, unidade = 't') {
  const valor = normalizarNumeroGessagem(preco);
  if (valor == null || valor < 0) return '—';
  const sufixo = normalizarUnidadePrecoGessagem(unidade) === 'kg' ? '/kg' : '/t';
  return `${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${sufixo}`;
}

export function montarPayloadGessagem({
  codigoProdutor,
  safra,
  talhao,
  analise2040,
  produto,
  doseCalcarioKgHa,
  caoCalcarioPct,
  caoGessoPct,
  argilaManual,
  doseFinalKgHa,
  metodoCalculo = 'combinado_conservador',
  faixa5aPosicao = 'media',
  doseMatematicaKgHa = null,
  doseTecnicaKgHa = null,
  aplicarSemIndicacao = false,
  calagemImportada = null,
  precoUnitario,
  unidadePreco,
  observacoes,
} = {}) {
  const recomendacao = calcularRecomendacaoGessagem({
    talhao,
    analise2040,
    argilaManual,
    doseCalcarioKgHa,
    caoCalcarioPct,
    caoGessoPct,
  });
  const doseFinal = normalizarNumeroGessagem(doseFinalKgHa) ?? recomendacao.doseSugeridaKgHa;
  const custo = calcularCustoGessagem({
    doseKgHa: doseFinal,
    areaHa: talhao?.area_ha,
    precoUnitario,
    unidadePreco,
  });
  const fornecimento = calcularFornecimentoGesso({ produto, doseKgHa: doseFinal });
  return {
    codigo_produtor: codigoProdutor,
    safra,
    talhao_id: talhao?.id,
    talhao_nome: talhao?.nome,
    ca_2040: recomendacao.ca2040,
    al_2040: recomendacao.al2040,
    saturacao_aluminio: recomendacao.mPercentual,
    magnesio_2040: recomendacao.mg2040,
    potassio_2040: recomendacao.k2040,
    argila_pct: recomendacao.argilaPct,
    dose_calcario_kg_ha: normalizarNumeroGessagem(doseCalcarioKgHa),
    cao_calcario_pct: normalizarNumeroGessagem(caoCalcarioPct),
    cao_gesso_pct: normalizarNumeroGessagem(caoGessoPct) ?? 25,
    metodo_calculo: metodoCalculo,
    faixa_5a_posicao: faixa5aPosicao,
    indicada: recomendacao.indicada,
    motivos: recomendacao.motivos,
    faixa_5a_min_t_ha: recomendacao.faixa5a?.minT ?? null,
    faixa_5a_max_t_ha: recomendacao.faixa5a?.maxT ?? null,
    dose_lopes_kg_ha: recomendacao.lopes?.gessoKgHa ?? null,
    calcario_ajustado_kg_ha: recomendacao.lopes?.calcarioAjustadoKgHa ?? null,
    dose_matematica_kg_ha: normalizarNumeroGessagem(doseMatematicaKgHa),
    dose_tecnica_kg_ha: normalizarNumeroGessagem(doseTecnicaKgHa),
    aplicar_sem_indicacao_tecnica: Boolean(aplicarSemIndicacao),
    dose_sugerida_kg_ha: recomendacao.doseSugeridaKgHa,
    dose_final_kg_ha: doseFinal,
    produto_calcario_id: calagemImportada?.produtoId || '',
    produto_calcario_nome: calagemImportada?.produtoNome || '',
    preco_calcario_unitario: calagemImportada?.precoUnitario ?? null,
    unidade_preco_calcario: calagemImportada?.unidadePreco || 't',
    prnt_calcario: calagemImportada?.prnt ?? null,
    ca_calcario_pct: calagemImportada?.caPct ?? null,
    mg_calcario_pct: calagemImportada?.mgPct ?? null,
    produto_id: produto?.id || '',
    produto_nome: produto?.nome || '',
    preco_unitario: custo.precoUnitario,
    unidade_preco: custo.unidadePreco,
    quantidade_total_kg: custo.quantidadeTotalKg,
    custo_ha: custo.custoHa,
    custo_total: custo.custoTotal,
    ca_fornecido_kg_ha: fornecimento.caKgHa,
    s_fornecido_kg_ha: fornecimento.sKgHa,
    orientacao: ORIENTACAO_APLICACAO_GESSAGEM,
    alerta_lixiviacao: ALERTA_LIXIVIACAO_GESSAGEM,
    observacoes: observacoes || '',
  };
}

export function listarGessagensRecentesPorTalhao({ gessagens = [], talhoes = [], codigoProdutor = null, safra = null }) {
  const talhoesIds = new Set((talhoes || []).map(t => t.id));
  const porTalhao = {};
  (gessagens || []).forEach(gessagem => {
    if (!gessagem?.talhao_id) return;
    if (talhoesIds.size > 0 && !talhoesIds.has(gessagem.talhao_id)) return;
    if (codigoProdutor && gessagem.codigo_produtor && gessagem.codigo_produtor !== codigoProdutor) return;
    if (safra && gessagem.safra && gessagem.safra !== safra) return;
    if (!porTalhao[gessagem.talhao_id]) porTalhao[gessagem.talhao_id] = [];
    porTalhao[gessagem.talhao_id].push(gessagem);
  });
  return Object.values(porTalhao).map(registros => selecionarRegistroGessagem(registros)).filter(Boolean);
}

export function montarLinhaGessagemResumo({ gessagem, talhao }) {
  const doseKgHa = normalizarNumeroGessagem(gessagem?.dose_final_kg_ha ?? gessagem?.dose_sugerida_kg_ha);
  if (doseKgHa == null || doseKgHa <= 0) return null;
  const produtoNome = (gessagem?.produto_nome || '').trim();
  if (!produtoNome || produtoNome === '0') return null;
  const distribuicao = calcularDistribuicaoGessagem({
    doseKgHa,
    quantidadeTotalKg: gessagem.quantidade_total_kg,
    talhao,
  });
  const custo = calcularCustoGessagem({
    doseKgHa,
    areaHa: talhao?.area_ha,
    precoUnitario: gessagem.preco_unitario,
    unidadePreco: gessagem.unidade_preco,
  });
  const caFornecido = normalizarNumeroGessagem(gessagem.ca_fornecido_kg_ha);
  const sFornecido = normalizarNumeroGessagem(gessagem.s_fornecido_kg_ha);
  const nutLabels = [
    caFornecido != null ? `Ca ${caFornecido.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg/ha` : null,
    sFornecido != null ? `S ${sFornecido.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg/ha` : null,
  ].filter(Boolean);

  return {
    produtoNome,
    produtoId: gessagem.produto_id || null,
    doseKgHa,
    totalKg: distribuicao.totalKg,
    gPlanta: distribuicao.gPlanta,
    gMetro: distribuicao.gMetro,
    nutLabels: nutLabels.length > 0 ? nutLabels : ['Gessagem'],
    isGessagem: true,
    periodoAplicacao: 'Aplicar após o calcário',
    precoUnitario: custo.precoUnitario,
    unidadePreco: custo.unidadePreco,
    custoHa: custo.custoHa,
    custoTotal: custo.custoTotal,
    metodoCalculo: gessagem.metodo_calculo || '',
    indicacaoTecnica: gessagem.indicada ? 'Sim' : 'Não',
    aplicadaSemIndicacao: Boolean(gessagem.aplicar_sem_indicacao_tecnica),
    observacaoTecnica: [
      gessagem.metodo_calculo ? `Método utilizado: ${gessagem.metodo_calculo}` : null,
      `Indicação técnica: ${gessagem.indicada ? 'Sim' : 'Não'}`,
      gessagem.aplicar_sem_indicacao_tecnica ? 'Aplicada sem indicação técnica.' : null,
      gessagem.observacoes || null,
    ].filter(Boolean).join(' · '),
  };
}

export function consolidarGessagensPorProduto({ mapa = {}, gessagens = [], talhoes = [], codigoProdutor = null, safra = null } = {}) {
  const talhaoPorId = new Map((talhoes || []).map(t => [t.id, t]));
  listarGessagensRecentesPorTalhao({ gessagens, talhoes, codigoProdutor, safra }).forEach(gessagem => {
    const talhao = talhaoPorId.get(gessagem.talhao_id);
    if (!talhao) return;
    const linha = montarLinhaGessagemResumo({ gessagem, talhao });
    if (!linha?.totalKg) return;
    const produtoId = (linha.produtoId || '').trim();
    const chave = produtoId ? `id:${produtoId}` : `nome:${linha.produtoNome.toLowerCase().trim()}`;
    if (!mapa[chave]) {
      mapa[chave] = {
        produto: { id: produtoId || chave, nome: linha.produtoNome },
        produtoId: produtoId || null,
        produtoNome: linha.produtoNome,
        talhoes: [],
        qtdTotal: 0,
        areaTotal: 0,
        sacasTotal: 0,
        doseKgHa: linha.doseKgHa,
        isGessagem: true,
        preco: linha.precoUnitario,
        unidadePreco: linha.unidadePreco,
        custoTotal: 0,
      };
    }
    if (!mapa[chave].talhoes.includes(talhao.nome)) mapa[chave].talhoes.push(talhao.nome);
    mapa[chave].qtdTotal += linha.totalKg;
    mapa[chave].areaTotal += normalizarNumeroGessagem(talhao.area_ha) || 0;
    mapa[chave].custoTotal += linha.custoTotal || 0;
    if (mapa[chave].preco == null && linha.precoUnitario != null) mapa[chave].preco = linha.precoUnitario;
    mapa[chave].unidadePreco = linha.unidadePreco;
  });
  return mapa;
}
