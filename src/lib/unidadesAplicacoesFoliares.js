import { extrairMesesAplicacaoFoliar } from './dashboardPlanejamento.js';

export const CUSTO_PENDENTE_FOLIAR = 'Custo pendente — revisar dose, unidade ou preço';
export const STATUS_REVISAR_UNIDADE = 'revisar_unidade';
export const STATUS_UNIDADE_NORMALIZADA = 'normalizada';
export const CATEGORIA_ADUBACAO_FOLIAR = 'adubacao_foliar';
export const CATEGORIA_PRAGAS_DOENCAS = 'pragas_doencas';
export const CATEGORIA_PLANTAS_DANINHAS = 'plantas_daninhas';

const UNIDADES = {
  L_HA: 'L/ha',
  ML_HA: 'ml/ha',
  ML_20L: 'ml/20 L',
  ML_100L: 'ml/100 L',
  KG_HA: 'kg/ha',
  G_HA: 'g/ha',
  G_20L: 'g/20 L',
  G_100L: 'g/100 L',
};

const MESES_FOLIARES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const GRUPOS_DEFENSIVO = new Set([
  'fungicida',
  'inseticida',
  'inseticidabiologico',
  'inseticidadesolo',
  'acaricida',
  'defensivo',
  'defensivoagricola',
]);
const GRUPOS_HERBICIDA = new Set(['herbicida']);

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[—–]/g, '-')
    .trim()
    .toLowerCase();
}

export function normalizarNomeProdutoFoliar(nome) {
  return normalizarTexto(nome).replace(/\s+/g, '');
}

export function produtoEhSupera(produto) {
  return normalizarNomeProdutoFoliar(produto?.produto_nome || produto?.nome) === 'supera';
}

export function numeroDecimal(valor) {
  if (valor === 0) return 0;
  if (valor == null || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const texto = String(valor).trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

function unidadeCanonica(unidade) {
  const texto = normalizarTexto(unidade)
    .replace(/litros?/g, 'l')
    .replace(/quilo(?:s)?|kilograma(?:s)?|quilograma(?:s)?/g, 'kg')
    .replace(/gramas?/g, 'g')
    .replace(/mililitros?/g, 'ml')
    .replace(/\bpor\b/g, '/')
    .replace(/de agua|d'agua|agua/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const compacto = texto.replace(/\s+/g, '');

  if (/^l\/ha$/.test(compacto)) return { unidade: UNIDADES.L_HA, tipo: 'liquido', base: 'L/ha' };
  if (/^ml\/ha$/.test(compacto)) return { unidade: UNIDADES.ML_HA, tipo: 'liquido', base: 'L/ha', divisor: 1000 };
  if (/^ml\/20l$/.test(compacto)) return { unidade: UNIDADES.ML_20L, tipo: 'liquido', base: 'L/ha', volumeBomba: 20, divisor: 1000 };
  if (/^ml\/100l$/.test(compacto)) return { unidade: UNIDADES.ML_100L, tipo: 'liquido', base: 'L/ha', volumeBomba: 100, divisor: 1000 };
  if (/^kg\/ha$/.test(compacto)) return { unidade: UNIDADES.KG_HA, tipo: 'solido', base: 'kg/ha' };
  if (/^g\/ha$/.test(compacto)) return { unidade: UNIDADES.G_HA, tipo: 'solido', base: 'kg/ha', divisor: 1000 };
  if (/^g\/20l$/.test(compacto)) return { unidade: UNIDADES.G_20L, tipo: 'solido', base: 'kg/ha', volumeBomba: 20, divisor: 1000 };
  if (/^g\/100l$/.test(compacto)) return { unidade: UNIDADES.G_100L, tipo: 'solido', base: 'kg/ha', volumeBomba: 100, divisor: 1000 };
  return null;
}

function superaCorrigivel(produto, dose, unidadeInfo) {
  if (!produtoEhSupera(produto)) return false;
  if (dose !== 2) return false;
  if (unidadeInfo?.unidade === UNIDADES.ML_20L) return true;
  const bruto = normalizarTexto(`${produto?.dose || ''} ${produto?.unidade || ''} ${produto?.unidade_aplicacao || ''}`);
  return /(^|\D)2(\.0+)?\s*ml\s*\/\s*20\s*l/.test(bruto.replace(',', '.'));
}

function superaJaCorrigido(produto) {
  if (!produtoEhSupera(produto)) return false;
  const dose = numeroDecimal(produto.dose ?? produto.dose_producao);
  const unidadeInfo = unidadeCanonica(produto.unidade ?? produto.unidade_aplicacao);
  return dose === 2 && unidadeInfo?.unidade === UNIDADES.L_HA;
}

export function normalizarDoseProdutoFoliar(produto = {}, opcoes = {}) {
  const doseOriginal = produto.dose_original ?? produto.dose ?? produto.dose_producao ?? '';
  const unidadeOriginal = produto.unidade_original ?? produto.unidade ?? produto.unidade_aplicacao ?? produto.unidade_padrao ?? '';
  const dosePersistida = numeroDecimal(produto.dose_normalizada);
  if (dosePersistida != null && (produto.unidade_normalizada === 'L/ha' || produto.unidade_normalizada === 'kg/ha')) {
    return {
      valido: true,
      status_unidade: STATUS_UNIDADE_NORMALIZADA,
      dose_original: doseOriginal,
      unidade_original: unidadeOriginal,
      dose_normalizada: dosePersistida,
      unidade_normalizada: produto.unidade_normalizada,
      tipo_fisico: produto.tipo_fisico || (produto.unidade_normalizada === 'L/ha' ? 'liquido' : 'solido'),
      corrigido_supera: Boolean(produto.corrigido_supera),
      mensagem_unidade: '',
    };
  }
  const dose = numeroDecimal(doseOriginal);
  const unidadeInfo = unidadeCanonica(unidadeOriginal);
  const volumeCaldaHa = numeroDecimal(opcoes.volumeCaldaHa ?? opcoes.volume_calda_ha);

  if (superaCorrigivel({ ...produto, dose: doseOriginal, unidade: unidadeOriginal }, dose, unidadeInfo)) {
    return {
      valido: true,
      status_unidade: STATUS_UNIDADE_NORMALIZADA,
      dose_original: doseOriginal,
      unidade_original: unidadeOriginal,
      dose_normalizada: 2,
      unidade_normalizada: 'L/ha',
      tipo_fisico: 'liquido',
      corrigido_supera: true,
      mensagem_unidade: '',
    };
  }

  if (dose == null) {
    return {
      valido: false,
      status_unidade: STATUS_REVISAR_UNIDADE,
      dose_original: doseOriginal,
      unidade_original: unidadeOriginal,
      dose_normalizada: null,
      unidade_normalizada: '',
      tipo_fisico: '',
      mensagem_unidade: 'Revisar unidade',
    };
  }

  if (!unidadeInfo) {
    return {
      valido: false,
      status_unidade: STATUS_REVISAR_UNIDADE,
      dose_original: doseOriginal,
      unidade_original: unidadeOriginal,
      dose_normalizada: null,
      unidade_normalizada: '',
      tipo_fisico: '',
      mensagem_unidade: 'Revisar unidade',
    };
  }

  if (unidadeInfo.volumeBomba && volumeCaldaHa == null) {
    return {
      valido: false,
      status_unidade: STATUS_REVISAR_UNIDADE,
      dose_original: doseOriginal,
      unidade_original: unidadeOriginal,
      dose_normalizada: null,
      unidade_normalizada: '',
      tipo_fisico: unidadeInfo.tipo,
      mensagem_unidade: 'Revisar unidade',
    };
  }

  const doseNormalizada = unidadeInfo.volumeBomba
    ? (dose * (volumeCaldaHa / unidadeInfo.volumeBomba)) / unidadeInfo.divisor
    : dose / (unidadeInfo.divisor || 1);

  return {
    valido: true,
    status_unidade: STATUS_UNIDADE_NORMALIZADA,
    dose_original: doseOriginal,
    unidade_original: unidadeOriginal,
    dose_normalizada: doseNormalizada,
    unidade_normalizada: unidadeInfo.base,
    tipo_fisico: unidadeInfo.tipo,
    corrigido_supera: false,
    mensagem_unidade: '',
  };
}

export function aplicarNormalizacaoProdutoFoliar(produto = {}, opcoes = {}) {
  const normalizado = normalizarDoseProdutoFoliar(produto, opcoes);
  const doseExibida = normalizado.corrigido_supera ? 2 : produto.dose;
  const unidadeExibida = normalizado.corrigido_supera ? 'L/ha' : produto.unidade;

  return {
    ...produto,
    dose: doseExibida,
    unidade: unidadeExibida,
    dose_original: normalizado.dose_original,
    unidade_original: normalizado.unidade_original,
    dose_normalizada: normalizado.dose_normalizada,
    unidade_normalizada: normalizado.unidade_normalizada,
    tipo_fisico: normalizado.tipo_fisico,
    status_unidade: normalizado.status_unidade,
    mensagem_unidade: normalizado.mensagem_unidade,
    corrigido_supera: normalizado.corrigido_supera || produto.corrigido_supera || false,
  };
}

export function normalizarProdutosAplicacaoFoliar(produtos = [], opcoes = {}) {
  return (produtos || []).map(produto => aplicarNormalizacaoProdutoFoliar(produto, opcoes));
}

export function calcularCustoProdutoFoliarDetalhado(produto = {}, opcoes = {}) {
  const areaHa = numeroDecimal(opcoes.areaHa ?? opcoes.area_ha) ?? 0;
  const normalizado = normalizarDoseProdutoFoliar(produto, opcoes);
  const preco = numeroDecimal(produto.preco);

  if (!normalizado.valido || preco == null) {
    return {
      valido: false,
      pendente: true,
      motivo: CUSTO_PENDENTE_FOLIAR,
      custo_ha: null,
      custo_total: null,
      quantidade_total: null,
      ...normalizado,
    };
  }

  const custoHa = normalizado.dose_normalizada * preco;
  return {
    valido: true,
    pendente: false,
    motivo: '',
    custo_ha: custoHa,
    custo_total: custoHa * areaHa,
    quantidade_total: normalizado.dose_normalizada * areaHa,
    ...normalizado,
  };
}

export function calcularResumoAplicacaoFoliar(aplicacao = {}, talhoes = []) {
  const ids = Array.isArray(aplicacao.talhao_ids) && aplicacao.talhao_ids.length
    ? aplicacao.talhao_ids
    : [aplicacao.talhao_id].filter(Boolean);
  const areaHa = talhoes
    .filter(talhao => ids.includes(talhao.id))
    .reduce((total, talhao) => total + (numeroDecimal(talhao.area_ha) ?? 0), 0);

  let custoHa = 0;
  let custoTotal = 0;
  let pendencias = 0;
  const produtos = (aplicacao.produtos || []).map(produto => {
    const custo = calcularCustoProdutoFoliarDetalhado(produto, {
      volumeCaldaHa: aplicacao.volume_calda_ha,
      areaHa,
    });
    if (custo.valido) {
      custoHa += custo.custo_ha;
      custoTotal += custo.custo_total;
    } else {
      pendencias += 1;
    }
    return { produto, custo };
  });

  return { areaHa, custoHa, custoTotal, pendencias, produtos };
}

export function classificarCategoriaProdutoFoliar(produto = {}) {
  const grupo = normalizarNomeProdutoFoliar(produto.grupo);
  if (GRUPOS_HERBICIDA.has(grupo) || grupo.includes('herbicida')) return CATEGORIA_PLANTAS_DANINHAS;
  if (
    GRUPOS_DEFENSIVO.has(grupo) ||
    grupo.includes('fungicida') ||
    grupo.includes('inseticida') ||
    grupo.includes('acaricida') ||
    grupo.includes('defensivo')
  ) {
    return CATEGORIA_PRAGAS_DOENCAS;
  }
  return CATEGORIA_ADUBACAO_FOLIAR;
}

export function calcularCustosFoliaresPorCategoria(aplicacoes = [], talhoes = [], filtros = {}) {
  const totais = {
    [CATEGORIA_ADUBACAO_FOLIAR]: 0,
    [CATEGORIA_PRAGAS_DOENCAS]: 0,
    [CATEGORIA_PLANTAS_DANINHAS]: 0,
    pendencias: 0,
  };
  const talhaoMap = Object.fromEntries((talhoes || []).map(talhao => [talhao.id, talhao]));

  (aplicacoes || []).forEach(aplicacao => {
    if (filtros.codigoProdutor && aplicacao.codigo_produtor !== filtros.codigoProdutor) return;
    if (filtros.safra && aplicacao.safra !== filtros.safra) return;
    const ids = aplicacao.talhao_id
      ? [aplicacao.talhao_id]
      : Array.isArray(aplicacao.talhao_ids) ? aplicacao.talhao_ids : [];

    ids.forEach(talhaoId => {
      const talhao = talhaoMap[talhaoId];
      const areaHa = numeroDecimal(talhao?.area_ha) ?? 0;
      if (!areaHa) return;
      (aplicacao.produtos || []).forEach(produto => {
        const custo = calcularCustoProdutoFoliarDetalhado(produto, {
          volumeCaldaHa: aplicacao.volume_calda_ha,
          areaHa,
        });
        if (!custo.valido) {
          totais.pendencias += 1;
          return;
        }
        totais[classificarCategoriaProdutoFoliar(produto)] += custo.custo_total;
      });
    });
  });

  return totais;
}

export function calcularCustosFoliaresPorTalhao(aplicacoes = [], talhoes = [], filtros = {}) {
  const mapa = {};
  (talhoes || []).forEach(talhao => {
    mapa[talhao.id] = { custoHa: 0, custoTotal: 0, pendencias: 0 };
  });

  (aplicacoes || []).forEach(aplicacao => {
    if (filtros.codigoProdutor && aplicacao.codigo_produtor !== filtros.codigoProdutor) return;
    if (filtros.safra && aplicacao.safra !== filtros.safra) return;
    const ids = aplicacao.talhao_id
      ? [aplicacao.talhao_id]
      : Array.isArray(aplicacao.talhao_ids) ? aplicacao.talhao_ids : [];

    ids.forEach(talhaoId => {
      const areaHa = numeroDecimal(talhoes.find(t => t.id === talhaoId)?.area_ha) ?? 0;
      if (!mapa[talhaoId] || !areaHa) return;
      (aplicacao.produtos || []).forEach(produto => {
        const custo = calcularCustoProdutoFoliarDetalhado(produto, {
          volumeCaldaHa: aplicacao.volume_calda_ha,
          areaHa,
        });
        if (!custo.valido) {
          mapa[talhaoId].pendencias += 1;
          return;
        }
        mapa[talhaoId].custoHa += custo.custo_ha;
        mapa[talhaoId].custoTotal += custo.custo_total;
      });
    });
  });

  return mapa;
}

export function validarPeriodoAplicacaoFoliar(aplicacao = {}) {
  const temData = Boolean(aplicacao.data_prevista || aplicacao.data_limite);
  const meses = Array.isArray(aplicacao.meses) ? aplicacao.meses.filter(Boolean) : [];
  const temMes = Boolean(aplicacao.mes || meses.length);
  const temPeriodo = Boolean(aplicacao.periodo_aplicacao || aplicacao.periodo || aplicacao.epoca);
  return temData || temMes || temPeriodo || extrairMesesAplicacaoFoliar(aplicacao).length > 0;
}

export function formatarDoseNormalizadaFoliar(produto = {}, opcoes = {}) {
  const normalizado = normalizarDoseProdutoFoliar(produto, opcoes);
  if (!normalizado.valido) return 'Revisar unidade';
  return `${normalizado.dose_normalizada.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${normalizado.unidade_normalizada}`;
}

export function formatarPeriodoAplicacaoFoliar(aplicacao = {}) {
  if (aplicacao.data_prevista) return aplicacao.data_prevista;
  if (aplicacao.data_limite) return aplicacao.data_limite;
  if (aplicacao.periodo_aplicacao) return aplicacao.periodo_aplicacao;
  if (aplicacao.periodo) return aplicacao.periodo;
  if (aplicacao.epoca) return aplicacao.epoca;
  const meses = extrairMesesAplicacaoFoliar(aplicacao);
  return meses.length ? meses.map(mes => MESES_FOLIARES.includes(mes) ? mes : mes).join('/') : '';
}

export function corrigirSuperaEmRegistro(registro = {}) {
  let alteracoes = 0;
  const corrigirProduto = produto => {
    if (superaJaCorrigido(produto)) return produto;
    const normalizado = normalizarDoseProdutoFoliar(produto, { volumeCaldaHa: registro.volume_calda_ha });
    if (!normalizado.corrigido_supera) return produto;
    alteracoes += 1;
    return aplicarNormalizacaoProdutoFoliar(produto, { volumeCaldaHa: registro.volume_calda_ha });
  };

  const produtos = Array.isArray(registro.produtos) ? registro.produtos.map(corrigirProduto) : registro.produtos;
  let registroCorrigido = { ...registro, produtos };
  if (produtoEhSupera(registro)) {
    if (superaJaCorrigido(registro)) return { registro: registroCorrigido, alteracoes };
    const corrigido = aplicarNormalizacaoProdutoFoliar(registro, { volumeCaldaHa: registro.volume_calda_ha });
    registroCorrigido = {
      ...corrigido,
      produtos,
      dose_producao: corrigido.corrigido_supera ? '2' : registro.dose_producao,
      unidade_aplicacao: corrigido.corrigido_supera ? 'L/ha' : registro.unidade_aplicacao,
    };
  }

  if (produtoEhSupera(registro) && registroCorrigido.corrigido_supera) alteracoes += 1;
  return { registro: registroCorrigido, alteracoes };
}

export function migrarSuperaFoliar(registros = []) {
  let alteracoes = 0;
  const registrosCorrigidos = (registros || []).map(registro => {
    const resultado = corrigirSuperaEmRegistro(registro);
    alteracoes += resultado.alteracoes;
    return resultado.registro;
  });
  return { registros: registrosCorrigidos, alteracoes };
}
