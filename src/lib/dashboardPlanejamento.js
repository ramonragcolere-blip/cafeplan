export const MESES_DASHBOARD = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
export const SAFRA_VAZIA_DASHBOARD = '__sem_safra__';

const MESES_ALIASES = new Map([
  ['JAN', 'JAN'], ['JANEIRO', 'JAN'],
  ['FEV', 'FEV'], ['FEVEREIRO', 'FEV'],
  ['MAR', 'MAR'], ['MARCO', 'MAR'], ['MARÇO', 'MAR'],
  ['ABR', 'ABR'], ['ABRIL', 'ABR'],
  ['MAI', 'MAI'], ['MAIO', 'MAI'],
  ['JUN', 'JUN'], ['JUNHO', 'JUN'],
  ['JUL', 'JUL'], ['JULHO', 'JUL'],
  ['AGO', 'AGO'], ['AGOSTO', 'AGO'],
  ['SET', 'SET'], ['SETEMBRO', 'SET'],
  ['OUT', 'OUT'], ['OUTUBRO', 'OUT'],
  ['NOV', 'NOV'], ['NOVEMBRO', 'NOV'],
  ['DEZ', 'DEZ'], ['DEZEMBRO', 'DEZ'],
]);

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

export function normalizarMesPlanejamento(valor) {
  const texto = normalizarTexto(valor);
  if (!texto) return null;
  return MESES_ALIASES.get(texto.slice(0, 3)) || MESES_ALIASES.get(texto) || null;
}

export function ordenarMesesPlanejamento(meses = []) {
  const unicos = new Set();
  (meses || []).forEach(mes => {
    const normalizado = normalizarMesPlanejamento(mes);
    if (normalizado) unicos.add(normalizado);
  });
  return MESES_DASHBOARD.filter(mes => unicos.has(mes));
}

function compararSafrasDesc(a, b) {
  const [a1 = 0, a2 = 0] = String(a || '').match(/\d{4}/g)?.map(Number) || [];
  const [b1 = 0, b2 = 0] = String(b || '').match(/\d{4}/g)?.map(Number) || [];
  return (b1 - a1) || (b2 - a2) || String(b).localeCompare(String(a), 'pt-BR');
}

export function coletarSafrasDisponiveis({
  planejamentosAdubacao2 = [],
  planosLegados = [],
  cronogramasFoliares = [],
  aplicacoesFoliares = [],
} = {}) {
  const safras = new Set();
  [...planejamentosAdubacao2, ...planosLegados, ...cronogramasFoliares, ...aplicacoesFoliares]
    .forEach(registro => {
      const safra = String(registro?.safra || '').trim();
      if (safra) safras.add(safra);
    });
  return [...safras].sort(compararSafrasDesc);
}

export function resolverSafraDashboard(safraFiltro = '', safrasDisponiveis = []) {
  if (safraFiltro && safrasDisponiveis.includes(safraFiltro)) return safraFiltro;
  return safrasDisponiveis[0] || '';
}

export function opcoesSafraDashboard(safrasDisponiveis = []) {
  if (!safrasDisponiveis.length) {
    return [{ value: SAFRA_VAZIA_DASHBOARD, label: 'Sem safras disponíveis', disabled: true }];
  }
  return safrasDisponiveis.map(safra => ({ value: safra, label: safra, disabled: false }));
}

function filtrarTalhoes(talhoes = [], codigoProdutor = '') {
  return codigoProdutor ? talhoes.filter(talhao => talhao.codigo_produtor === codigoProdutor) : talhoes;
}

function filtrarPlanos(planos = [], { codigoProdutor = '', safra = '' } = {}) {
  return planos.filter(plano =>
    (!codigoProdutor || plano.codigo_produtor === codigoProdutor) &&
    (!safra || plano.safra === safra)
  );
}

export function categorizarStatusPlanejamento({ talhoes = [], planos = [], codigoProdutor = '', safra = '' } = {}) {
  const talhoesFiltrados = filtrarTalhoes(talhoes, codigoProdutor);
  const planosFiltrados = filtrarPlanos(planos, { codigoProdutor, safra });
  const planosPorTalhao = new Map();

  planosFiltrados.forEach(plano => {
    if (!plano?.talhao_id) return;
    if (!planosPorTalhao.has(plano.talhao_id)) planosPorTalhao.set(plano.talhao_id, []);
    planosPorTalhao.get(plano.talhao_id).push(plano);
  });

  const categorias = {
    planejado: [],
    emExecucao: [],
    concluido: [],
    semPlanejamento: [],
  };

  talhoesFiltrados.forEach(talhao => {
    const planosTalhao = planosPorTalhao.get(talhao.id) || [];
    if (planosTalhao.some(plano => plano.status === 'concluido')) categorias.concluido.push(talhao);
    else if (planosTalhao.some(plano => plano.status === 'em_execucao')) categorias.emExecucao.push(talhao);
    else if (planosTalhao.length > 0) categorias.planejado.push(talhao);
    else categorias.semPlanejamento.push(talhao);
  });

  return {
    categorias,
    totais: {
      planejado: categorias.planejado.length,
      emExecucao: categorias.emExecucao.length,
      concluido: categorias.concluido.length,
      semPlanejamento: categorias.semPlanejamento.length,
      totalTalhoes: talhoesFiltrados.length,
    },
  };
}

export function proximasAdubacoesDashboard({
  talhoes = [],
  planos = [],
  codigoProdutor = '',
  safra = '',
  mesAtualIndice = new Date().getMonth(),
} = {}) {
  const talhoesFiltrados = filtrarTalhoes(talhoes, codigoProdutor);
  const talhaoIds = new Set(talhoesFiltrados.map(talhao => talhao.id));
  const mesesAlvo = new Set([
    MESES_DASHBOARD[mesAtualIndice],
    MESES_DASHBOARD[(mesAtualIndice + 1) % 12],
  ].filter(Boolean));
  const vistos = new Set();

  return filtrarPlanos(planos, { codigoProdutor, safra })
    .filter(plano => talhaoIds.has(plano.talhao_id))
    .filter(plano => ordenarMesesPlanejamento((plano.meses || []).flat()).some(mes => mesesAlvo.has(mes)))
    .filter(plano => {
      const chave = `${plano.talhao_id}|${plano.produto_id || plano.nutriente_key || plano.produto_nome || plano.id}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
}

function mesesDaData(data) {
  if (!data || typeof data !== 'string') return [];
  const match = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return [];
  return ordenarMesesPlanejamento([MESES_DASHBOARD[Number(match[2]) - 1]]);
}

function mesesDoTexto(texto) {
  if (!texto || typeof texto !== 'string') return [];
  const candidatos = texto
    .split(/[^A-Za-zÀ-ÿ0-9]+/)
    .map(parte => normalizarMesPlanejamento(parte))
    .filter(Boolean);
  return ordenarMesesPlanejamento(candidatos);
}

export function extrairMesesAplicacaoFoliar(aplicacao = {}) {
  return ordenarMesesPlanejamento([
    ...(Array.isArray(aplicacao.meses) ? aplicacao.meses : []),
    ...mesesDaData(aplicacao.data_prevista),
    ...mesesDaData(aplicacao.data_limite),
    ...mesesDoTexto(aplicacao.mes),
    ...mesesDoTexto(aplicacao.periodo_aplicacao),
    ...mesesDoTexto(aplicacao.periodo),
    ...mesesDoTexto(aplicacao.epoca),
  ]);
}

function mesesDoParcelamento(parcelamento) {
  return ordenarMesesPlanejamento((parcelamento?.parcelas || []).flatMap(parcela => parcela?.meses || []));
}

function produtoIdsPlanejamento2(registro = {}) {
  const det = registro.detalhamento || {};
  const ids = [];
  if (det.produtoSugerido?.id) ids.push(det.produtoSugerido.id);
  (det.complementos || []).forEach(complemento => {
    const id = complemento?.produto?.id || complemento?.produto_id;
    if (id) ids.push(id);
  });
  return [...new Set(ids)];
}

export function mesesAutomaticosAdubacao2PorTalhao(registros = [], { codigoProdutor = '', safra = '' } = {}) {
  const mapa = {};
  registros.forEach(registro => {
    if (!registro?.talhao_id) return;
    if (codigoProdutor && registro.codigo_produtor !== codigoProdutor) return;
    if (safra && registro.safra !== safra) return;
    const parcelamentos = registro.detalhamento?.parcelamentos || {};
    const produtoIds = produtoIdsPlanejamento2(registro);
    const meses = produtoIds.flatMap(produtoId => mesesDoParcelamento(parcelamentos[produtoId]));
    mapa[registro.talhao_id] = ordenarMesesPlanejamento([...(mapa[registro.talhao_id] || []), ...meses]);
  });
  return mapa;
}

export function mesesAutomaticosFoliaresPorTalhao(cronogramas = [], { codigoProdutor = '', safra = '' } = {}) {
  const mapa = {};
  cronogramas.forEach(cronograma => {
    if (codigoProdutor && cronograma.codigo_produtor !== codigoProdutor) return;
    if (safra && cronograma.safra !== safra) return;
    const meses = extrairMesesAplicacaoFoliar(cronograma);
    if (meses.length === 0) return;
    (cronograma.talhao_ids || []).forEach(talhaoId => {
      if (!talhaoId) return;
      mapa[talhaoId] = ordenarMesesPlanejamento([...(mapa[talhaoId] || []), ...meses]);
    });
  });
  return mapa;
}

export function combinarMesesOperacao({ manuais = [], automaticos = [] } = {}) {
  return ordenarMesesPlanejamento([...automaticos, ...manuais]);
}

export function separarMesesOperacaoSalva(row = {}, automaticos = []) {
  const mesesAutomaticos = ordenarMesesPlanejamento(automaticos);
  const mesesManuais = Array.isArray(row.meses_manuais)
    ? ordenarMesesPlanejamento(row.meses_manuais)
    : ordenarMesesPlanejamento(row.meses || []);
  return {
    meses_manuais: mesesManuais,
    meses_automaticos: mesesAutomaticos,
    meses: combinarMesesOperacao({ manuais: mesesManuais, automaticos: mesesAutomaticos }),
  };
}
