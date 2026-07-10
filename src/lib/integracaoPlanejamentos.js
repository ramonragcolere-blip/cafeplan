export const MESES_PLANEJAMENTO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function numero(valor) {
  if (valor === '' || valor == null) return 0;
  const n = Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function mesesDoParcelamento(parcelamento) {
  const meses = (parcelamento?.parcelas || [])
    .flatMap(parcela => parcela?.meses || [])
    .map(mes => String(mes || '').toUpperCase())
    .filter(mes => MESES_PLANEJAMENTO.includes(mes));
  return [...new Set(meses)];
}

function mesesDaData(data) {
  if (!data || typeof data !== 'string') return [];
  const match = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return [];
  const indice = Number(match[2]) - 1;
  return MESES_PLANEJAMENTO[indice] ? [MESES_PLANEJAMENTO[indice]] : [];
}

function produtoNormalizado(produto, fallback = {}) {
  if (!produto && !fallback.produto_nome) return null;
  return {
    id: produto?.id || fallback.produto_id || null,
    nome: produto?.nome || fallback.produto_nome || 'Produto não definido',
    doseKgHa: numero(fallback.doseKgHa ?? fallback.dose_rec_manual ?? fallback.dose),
  };
}

/**
 * Converte o formato novo do Adubação 2.0 em linhas compatíveis com calendário,
 * dashboard e visão geral. Os registros legados são preservados.
 */
export function normalizarPlanosAdubacao(planosLegados = [], planejamentos2 = []) {
  const legados = planosLegados.map(plano => ({ ...plano, _origem: 'legado' }));
  const novos = [];

  planejamentos2.forEach(registro => {
    const det = registro?.detalhamento || {};
    const precos = det.precos || {};
    const parcelamentos = det.parcelamentos || {};
    const produtos = [];

    const principal = produtoNormalizado(det.produtoSugerido, { doseKgHa: det.doseProdutoHa });
    if (principal) produtos.push(principal);

    (det.complementos || []).forEach(complemento => {
      const produto = produtoNormalizado(complemento?.produto, {
        produto_id: complemento?.produto_id,
        produto_nome: complemento?.produto_nome,
        doseKgHa: complemento?.doseKgHa ?? complemento?.dose_kg_ha,
      });
      if (produto) produtos.push(produto);
    });

    // Evita duplicidade caso o mesmo produto esteja no principal e nos complementos.
    const unicos = [...new Map(produtos.map(produto => [produto.id || produto.nome, produto])).values()];

    if (unicos.length === 0) {
      novos.push({
        ...registro,
        id: `${registro.id || registro.talhao_id}:adubacao2`,
        _origem: 'adubacao2',
        produto_nome: 'Planejamento Adubação 2.0',
        dose_rec_manual: 0,
        preco: 0,
        custo_rha: 0,
        meses: [[]],
        status: registro.status || 'planejado',
      });
      return;
    }

    unicos.forEach((produto, indice) => {
      const preco = numero(produto.id ? precos[produto.id] : 0);
      const meses = produto.id ? mesesDoParcelamento(parcelamentos[produto.id]) : [];
      novos.push({
        ...registro,
        id: `${registro.id || registro.talhao_id}:adubacao2:${produto.id || indice}`,
        _origem: 'adubacao2',
        nutriente_key: indice === 0 ? 'principal' : 'complemento',
        produto_id: produto.id,
        produto_nome: produto.nome,
        dose_rec_manual: produto.doseKgHa,
        preco,
        custo_rha: produto.doseKgHa * preco,
        meses: [meses],
        status: registro.status || 'planejado',
      });
    });
  });

  return [...legados, ...novos];
}

/**
 * Expande cada cronograma novo em uma aplicação por talhão, mantendo o formato
 * antigo esperado pelas telas de calendário e custos.
 */
export function normalizarAplicacoesFoliares(aplicacoesLegadas = [], cronogramas = [], talhoes = []) {
  const legadas = aplicacoesLegadas.map(aplicacao => ({ ...aplicacao, _origem: 'legado' }));
  const talhaoMap = Object.fromEntries(talhoes.map(talhao => [talhao.id, talhao]));
  const novas = [];

  cronogramas.forEach(cronograma => {
    const ids = Array.isArray(cronograma.talhao_ids) && cronograma.talhao_ids.length
      ? cronograma.talhao_ids
      : [null];
    const meses = mesesDaData(cronograma.data_limite);

    ids.forEach((talhaoId, indice) => {
      const talhao = talhaoMap[talhaoId];
      novas.push({
        ...cronograma,
        id: `${cronograma.id || 'cronograma'}:${talhaoId || indice}`,
        _origem: 'cronograma_foliar',
        talhao_id: talhaoId,
        talhao_nome: talhao?.nome || '',
        meses,
        produtos: Array.isArray(cronograma.produtos) ? cronograma.produtos : [],
      });
    });
  });

  return [...legadas, ...novas];
}

export function calcularCustoAdubacaoHa(plano) {
  if (numero(plano?.custo_rha)) return numero(plano.custo_rha);
  return numero(plano?.dose_rec_manual) * numero(plano?.preco);
}

export function calcularCustoProdutoFoliarHa(produto) {
  return numero(produto?.dose) * numero(produto?.preco);
}

export function proximoCodigoProdutor(produtores = []) {
  const maior = produtores.reduce((maximo, produtor) => {
    const match = String(produtor?.codigo || '').trim().match(/^P(\d+)$/i);
    return match ? Math.max(maximo, Number(match[1])) : maximo;
  }, 0);
  return `P${String(maior + 1).padStart(3, '0')}`;
}
