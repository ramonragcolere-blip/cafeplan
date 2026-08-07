// Análises de Estoque — somente VISUALIZAÇÃO. Não persiste nada, não duplica
// dados, não cria entidade. Deriva tudo de MovimentoEstoqueInsumo (saídas),
// BaseItensNotaFiscal, BaseNotasFiscais e Base de Insumos.
//
// Regras:
//  - Apenas tipo_movimento === 'saida' conta como aplicação. Ajustes NÃO contam.
//  - Época = MovimentoEstoqueInsumo.data_movimento (mês/ano).
//  - Área estimada = qtd_base / dose.valor (quando dose.ha válida e unidade
//    compatível). Sem dose => não inventa (null => "—").
//    Quando há filtro de talhão, a área passa a ser a histórica do talhão
//    (talhoes_aplicacao.area_ha), não a estimada por dose.
//  - Custo = custo médio ponderado HISTÓRICO das compras (NFs) até a data da
//    aplicação, com conversão de embalagem via converterItem. Compra futura
//    NÃO recalcula aplicação antiga. Sem preço => não inventa (null).
//  - Talhões: cada saída pode conter talhoes_aplicacao [{talhao_id, talhao_nome,
//    area_ha, quantidade_rateada}]. Com filtro de talhão ativo, cada saída é
//    "expandida" no shard daquele talhão, usando quantidade/custo RATEADOS
//    (sem duplicar a quantidade total em cada talhão).
// Reaproveita conversão/dose de estoqueInsumos e categorias de
// notasFiscaisCategorias — NÃO cria classificação paralela.
import {
  converterItem, parseDose, construirInsumosIndex, matchInsumo, formatDose,
} from '@/lib/estoqueInsumos';
import { normalizarNome, classificarProduto } from '@/lib/notasFiscaisCategorias';

export const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

export const CATEGORIAS_ANALISE = [
  'Fungicida', 'Inseticida', 'Herbicida', 'Acaricida',
  'Nutrição foliar', 'Adjuvante', 'Adubo/Fertilizante', 'Corretivo', 'Outros',
];

// Label de dose em base l/kg -> "0,5 L/ha" / "2 kg/ha".
function labelDose(dose) {
  if (!dose) return null;
  const unidadeAplicacao = dose.unit === 'kg' ? 'kg/ha' : 'L/ha';
  const s = formatDose(dose.valor, unidadeAplicacao);
  return s || null;
}

// Época: mês/ano a partir de data_movimento (YYYY-MM-DD) -> "AGO/26".
export function mesChaveData(dateStr) {
  const [y, m] = String(dateStr || '').split('-');
  if (!y || !m) return null;
  const mi = parseInt(m, 10) - 1;
  if (mi < 0 || mi > 11) return null;
  return `${MESES[mi]}/${String(y).slice(-2)}`;
}

// Safra de café (reutiliza convenção "YYYY/YYYY+1" já usada no app, ex. 2026/2027).
// Safra começa em julho: meses >= 7 pertencem à safra year/year+1.
export function safraDeData(dateStr) {
  const [y, m] = String(dateStr || '').split('-');
  if (!y || !m) return null;
  const year = parseInt(y, 10);
  const mi = parseInt(m, 10);
  return mi >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

export function ordenarMeses(mesKeys) {
  return mesKeys.map((m) => {
    const [lab, yy] = m.split('/');
    return { m, key: (2000 + Number(yy)) * 12 + MESES.indexOf(lab) };
  }).sort((a, b) => a.key - b.key).map((x) => x.m);
}

// Constrói a base de custo: agrega itens de NF por (produtor + chave do produto),
// ordenados por data_emissao, já convertidos para a unidade base (l/kg).
function construirBaseCusto({ itens = [], notas = [], resolverItem, chaveDe }) {
  const notasMap = {};
  (notas || []).forEach((n) => { notasMap[n.id] = n; });
  const itensPorChave = {};
  (itens || []).forEach((item) => {
    const pid = item.produtor_id;
    if (!pid) return;
    const nome = String(item.produto_nome || '').trim();
    if (!nome) return;
    const nota = item.nota_fiscal_id ? notasMap[item.nota_fiscal_id] : null;
    const data = nota?.data_emissao || '';
    const conv = converterItem(item);
    const qtdBase = Number(conv.q) || 0;
    const precoTotal = Number(item.preco_total) || (Number(item.preco_unitario) * Number(item.quantidade)) || 0;
    if (qtdBase <= 0 || precoTotal <= 0) return; // sem preço/quantidade => não entra no custo
    const ins = resolverItem(item);
    const ch = chaveDe(ins, nome);
    const key = `${pid}||${ch}`;
    if (!itensPorChave[key]) itensPorChave[key] = [];
    itensPorChave[key].push({ data, qtdBase, precoTotal, unit: conv.unit });
  });
  return itensPorChave;
}

// Custo médio ponderado HISTÓRICO até a data da aplicação, na mesma unidade base.
// Não usa compras futuras. Retorna R$ por unidade base, ou null se não houver.
export function custoUnitarioHistorico(itensPorChave, pid, ch, dataLimite, unidadeBase) {
  const arr = itensPorChave[`${pid}||${ch}`] || [];
  const validos = arr.filter((e) =>
    e.unit === unidadeBase && e.data && dataLimite && e.data <= dataLimite);
  if (!validos.length) return null;
  const sumQ = validos.reduce((s, e) => s + e.qtdBase, 0);
  const sumP = validos.reduce((s, e) => s + e.precoTotal, 0);
  if (sumQ <= 0) return null;
  return sumP / sumQ; // R$/baseUnit
}

// Constrói a lista de aplicações a partir das saídas. Cada aplicação é um
// objeto "pronto para gráfico" com quantidade base, dose, hectares e custo.
// Inclui talhoes_aplicacao (snapshot histórico) e area_total_aplicada.
export function construirAplicacoes({
  saidas = [], itens = [], notas = [], fertilizantes = [], fontes = [],
  catalogoCategorias = [], configs = [],
} = {}) {
  const fertMap = {};
  (fertilizantes || []).forEach((f) => { fertMap[f.id] = f; });
  const fonteMap = {};
  (fontes || []).forEach((f) => { fonteMap[f.id] = f; });
  const idx = construirInsumosIndex(fertilizantes, fontes);
  const configsMap = {};
  (configs || []).forEach((c) => { configsMap[`${c.produtor_id}||${c.produto_chave}`] = c; });

  const resolverSaida = (s) => {
    if (s.produto_id) {
      if (s.produto_tipo === 'fonte' && fonteMap[s.produto_id]) return { tipo: 'fonte', id: s.produto_id, record: fonteMap[s.produto_id] };
      if (s.produto_tipo === 'fert' && fertMap[s.produto_id]) return { tipo: 'fert', id: s.produto_id, record: fertMap[s.produto_id] };
    }
    return matchInsumo(s.produto_nome, idx);
  };
  const resolverItem = (item) => {
    if (item.insumo_id) {
      if (item.insumo_tipo === 'fonte' && fonteMap[item.insumo_id]) return { tipo: 'fonte', id: item.insumo_id, record: fonteMap[item.insumo_id] };
      if (item.insumo_tipo === 'formulado' && fertMap[item.insumo_id]) return { tipo: 'fert', id: item.insumo_id, record: fertMap[item.insumo_id] };
    }
    return matchInsumo(item.produto_nome, idx);
  };
  const chaveDe = (ins, nome) => (ins ? `${ins.tipo}_${ins.id}` : `nf_${normalizarNome(nome)}`);

  const itensPorChave = construirBaseCusto({ itens, notas, resolverItem, chaveDe });

  const aplicacoes = [];
  (saidas || []).forEach((s) => {
    if ((s.tipo_movimento || 'saida') !== 'saida') return; // ajustes NÃO são aplicações
    const pid = s.produtor_id;
    if (!pid) return;
    const nome = String(s.produto_nome || '').trim();
    if (!nome) return;
    const ins = resolverSaida(s);
    const ch = chaveDe(ins, nome);
    const nomePadrao = ins ? ins.record.nome : nome;
    const categoria = classificarProduto(nome, catalogoCategorias);
    const conv = converterItem({ quantidade: s.quantidade, unidade_medida: s.unidade, produto_nome: nome });
    const qtdBase = Number(conv.q) || 0;
    const unidadeBase = conv.unit;

    // dose: override do estoque -> Base de Insumos -> sem dose
    const config = configsMap[`${pid}||${ch}`] || null;
    let dose = ins?.tipo === 'fert' ? parseDose(ins.record.dose_producao, ins.record.unidade_aplicacao) : null;
    if (config?.dose_ha != null && config.unidade_dose) {
      const dOver = parseDose(`${config.dose_ha} ${config.unidade_dose}`);
      if (dOver) dose = dOver;
    }

    let ha = null;
    if (dose && qtdBase > 0 && dose.unit === unidadeBase && dose.valor > 0) {
      ha = Math.round((qtdBase / dose.valor) * 100) / 100;
    }

    const data = s.data_movimento || '';
    const custoUnit = custoUnitarioHistorico(itensPorChave, pid, ch, data, unidadeBase);
    const custo = custoUnit != null && qtdBase > 0 ? Math.round(custoUnit * qtdBase * 100) / 100 : null;

    const talhoesAplicacao = Array.isArray(s.talhoes_aplicacao)
      ? s.talhoes_aplicacao.map((x) => ({
        talhao_id: x.talhao_id,
        talhao_nome: x.talhao_nome,
        area_ha: Number(x.area_ha) || 0,
        quantidade_rateada: Number(x.quantidade_rateada) || 0,
      }))
      : [];

    aplicacoes.push({
      id: s.id || null,
      produtor_id: pid,
      produto_id: ins?.id || s.produto_id || null,
      produto_tipo: ins ? ins.tipo : (s.produto_tipo || 'nf'),
      produto_nome: nome,
      produto_nome_padrao: nomePadrao,
      categoria,
      data,
      mes: mesChaveData(data),
      mesIndex: (() => { const mi = MESES.indexOf((mesChaveData(data) || '').slice(0, 3)); return mi >= 0 ? mi : null; })(),
      safra: safraDeData(data),
      quantidade: Number(s.quantidade) || 0,
      unidade: s.unidade || '',
      qtd_base: qtdBase,
      unidade_base: unidadeBase,
      dose,
      dose_label: labelDose(dose),
      ha_estimado: ha,
      custo,
      custo_unitario: custoUnit != null ? Math.round(custoUnit * 100) / 100 : null,
      tem_custo: custo != null,
      observacao: s.observacao || '',
      chave: ch,
      talhoes_aplicacao: talhoesAplicacao,
      area_total_aplicada: s.area_total_aplicada != null ? Number(s.area_total_aplicada) : null,
    });
  });
  aplicacoes.sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  return aplicacoes;
}

// Expande uma aplicação no shard de um talhão específico, usando quantidade e
// custo RATEADOS (proporcionais à área). Retorna null se o talhão não participate.
// A área do shard passa a ser a histórica do talhão (não a estimada por dose).
export function expandirAplicacaoPorTalhao(aplicacao, talhaoId) {
  const arr = Array.isArray(aplicacao.talhoes_aplicacao) ? aplicacao.talhoes_aplicacao : [];
  const entry = arr.find((x) => x.talhao_id === talhaoId);
  if (!entry) return null;
  const qtdRateada = Number(entry.quantidade_rateada) || 0;
  const fracao = aplicacao.quantidade > 0 ? qtdRateada / aplicacao.quantidade : 0;
  const qtdBaseShard = (aplicacao.qtd_base || 0) * fracao;
  const custoShard = aplicacao.custo != null ? aplicacao.custo * fracao : null;
  return {
    ...aplicacao,
    id: `${aplicacao.id || ''}__${talhaoId}`,
    talhao_id: entry.talhao_id,
    talhao_nome: entry.talhao_nome,
    talhoes_aplicacao: [entry],
    area_total_aplicada: Number(entry.area_ha) || 0,
    quantidade: qtdRateada,
    qtd_base: Math.round(qtdBaseShard * 100000) / 100000,
    ha_estimado: Number(entry.area_ha) || 0,
    custo: custoShard != null ? Math.round(custoShard * 100) / 100 : null,
  };
}

// Aplica filtros independentes (todos opcionais). Quando o filtro de talhão
// está ativo, cada aplicação que contém aquele talhão é expandida no shard
// correspondente (quantidade/custo rateados) — evita duplicar a qtd total.
export function filtrarAplicacoes(aplicacoes, {
  produtor = 'todos', produto = '', categoria = 'todos',
  dataInicial = '', dataFinal = '', safra = 'todas', talhao = 'todos',
} = {}) {
  const termo = normalizarNome(produto);
  const base = aplicacoes.filter((a) => {
    if (produtor !== 'todos' && a.produtor_id !== produtor) return false;
    if (termo && !normalizarNome(a.produto_nome_padrao).includes(termo) && !normalizarNome(a.produto_nome).includes(termo)) return false;
    if (categoria !== 'todos' && a.categoria !== categoria) return false;
    if (dataInicial && (!a.data || a.data < dataInicial)) return false;
    if (dataFinal && (!a.data || a.data > dataFinal)) return false;
    if (safra !== 'todas' && a.safra !== safra) return false;
    return true;
  });
  if (talhao && talhao !== 'todos') {
    const shards = [];
    base.forEach((a) => {
      const s = expandirAplicacaoPorTalhao(a, talhao);
      if (s) shards.push(s);
    });
    return shards;
  }
  return base;
}

// Agrega por produto. Cada item: {nome, categoria, unidade_base, aplicacoes,
// area (null se nenhuma com dose), custo (soma), com_custo, sem_dose}.
export function agregarPorProduto(aplicacoes, categoriaFoco = null) {
  const map = {};
  aplicacoes.forEach((a) => {
    if (categoriaFoco && a.categoria !== categoriaFoco) return;
    const nome = a.produto_nome_padrao;
    if (!map[nome]) map[nome] = { nome, categoria: a.categoria, unidade_base: a.unidade_base, aplicacoes: 0, area: 0, custo: 0, com_area: 0, com_custo: 0, sem_dose: 0, qtd_total: 0 };
    const r = map[nome];
    r.aplicacoes += 1;
    r.qtd_total += a.qtd_base || 0;
    if (a.ha_estimado != null) { r.area += a.ha_estimado; r.com_area += 1; } else r.sem_dose += 1;
    if (a.custo != null) { r.custo += a.custo; r.com_custo += 1; }
  });
  return Object.values(map).map((r) => ({
    ...r,
    qtd_total: Math.round(r.qtd_total * 100) / 100,
    area: r.com_area ? Math.round(r.area * 100) / 100 : null,
    custo: Math.round(r.custo * 100) / 100,
  }));
}

// Agrega por categoria.
export function agregarPorCategoria(aplicacoes, categoriaFoco = null) {
  const map = {};
  aplicacoes.forEach((a) => {
    if (categoriaFoco && a.categoria !== categoriaFoco) return;
    const cat = a.categoria;
    if (!map[cat]) map[cat] = { categoria: cat, aplicacoes: 0, area: 0, custo: 0, com_area: 0, com_custo: 0, sem_dose: 0, sem_preco: 0 };
    const r = map[cat];
    r.aplicacoes += 1;
    if (a.ha_estimado != null) { r.area += a.ha_estimado; r.com_area += 1; } else r.sem_dose += 1;
    if (a.custo != null) { r.custo += a.custo; r.com_custo += 1; } else r.sem_preco += 1;
  });
  return Object.values(map).map((r) => ({
    ...r,
    area: r.com_area ? Math.round(r.area * 100) / 100 : null,
    custo: Math.round(r.custo * 100) / 100,
    custo_medio: r.com_custo ? Math.round((r.custo / r.aplicacoes) * 100) / 100 : null,
  }));
}

// Agrega por talhão. Cada aplicação é expandida em um shard por talhão (com
// quantidade/custo rateados). Aplicações sem talhão entram no bucket
// "Talhão não informado".
export function agregarPorTalhao(aplicacoes) {
  const map = {};
  const naoInfo = { nome: 'Talhão não informado', talhao_id: null, aplicacoes: 0, area: 0, custo: 0, com_area: 0, com_custo: 0, qtd_total: 0 };
  aplicacoes.forEach((a) => {
    const arr = Array.isArray(a.talhoes_aplicacao) ? a.talhoes_aplicacao : [];
    if (!arr.length) {
      naoInfo.aplicacoes += 1;
      naoInfo.qtd_total += a.qtd_base || 0;
      if (a.ha_estimado != null) { naoInfo.area += a.ha_estimado; naoInfo.com_area += 1; }
      if (a.custo != null) { naoInfo.custo += a.custo; naoInfo.com_custo += 1; }
      return;
    }
    arr.forEach((entry) => {
      const tid = entry.talhao_id;
      const fracao = a.quantidade > 0 && entry.quantidade_rateada != null
        ? (Number(entry.quantidade_rateada) || 0) / a.quantidade : 0;
      if (!map[tid]) map[tid] = {
        nome: entry.talhao_nome || '—', talhao_id: tid, aplicacoes: 0, area: 0, custo: 0,
        com_area: 0, com_custo: 0, qtd_total: 0, unidade_base: a.unidade_base,
      };
      const r = map[tid];
      r.aplicacoes += 1;
      r.area += Number(entry.area_ha) || 0; r.com_area += 1;
      r.qtd_total += (a.qtd_base || 0) * fracao;
      if (a.custo != null) { r.custo += a.custo * fracao; r.com_custo += 1; }
    });
  });
  const out = Object.values(map).map((r) => ({
    ...r,
    qtd_total: Math.round(r.qtd_total * 100) / 100,
    area: Math.round(r.area * 100) / 100,
    custo: Math.round(r.custo * 100) / 100,
  }));
  if (naoInfo.aplicacoes > 0) {
    naoInfo.qtd_total = Math.round(naoInfo.qtd_total * 100) / 100;
    naoInfo.area = naoInfo.com_area ? Math.round(naoInfo.area * 100) / 100 : null;
    naoInfo.custo = Math.round(naoInfo.custo * 100) / 100;
    out.push(naoInfo);
  }
  return out;
}

// valor da métrica de uma aplicação conforme indicador.
function valorMetrica(a, metrica) {
  if (metrica === 'aplicacoes') return 1;
  if (metrica === 'area') return a.ha_estimado || 0;
  if (metrica === 'custo') return a.custo || 0;
  return 0;
}
function descartaMetrica(a, metrica) {
  if (metrica === 'area' && a.ha_estimado == null) return true;
  if (metrica === 'custo' && a.custo == null) return true;
  return false;
}

// Série temporal: eixo X = mês/ano, barras empilhadas por série (produto ou categoria).
export function dadosGraficoTemporal(aplicacoes, { agruparPor = 'produto', metrica = 'aplicacoes', categoriaFoco = null } = {}) {
  const mesesSet = new Set();
  const seriesSet = new Set();
  const accum = {};
  aplicacoes.forEach((a) => {
    if (categoriaFoco && a.categoria !== categoriaFoco) return;
    if (descartaMetrica(a, metrica)) return;
    const sName = agruparPor === 'categoria' ? a.categoria : a.produto_nome_padrao;
    seriesSet.add(sName);
    if (a.mes) mesesSet.add(a.mes);
    if (!accum[sName]) accum[sName] = {};
    accum[sName][a.mes] = (accum[sName][a.mes] || 0) + valorMetrica(a, metrica);
  });
  const meses = ordenarMeses([...mesesSet]);
  const data = meses.map((m) => {
    const row = { mes: m };
    seriesSet.forEach((s) => { row[s] = Math.round((accum[s][m] || 0) * 100) / 100; });
    return row;
  });
  return { data, series: [...seriesSet].sort(), meses };
}

// Distribuição mensal por categoria (JAN..DEZ, agregando anos). Barras empilhadas.
export function dadosDistribuicaoMensal(aplicacoes, { metrica = 'aplicacoes', categoriaFoco = null } = {}) {
  const cats = new Set();
  const accum = {};
  aplicacoes.forEach((a) => {
    if (categoriaFoco && a.categoria !== categoriaFoco) return;
    if (descartaMetrica(a, metrica)) return;
    if (a.mesIndex == null) return;
    cats.add(a.categoria);
    if (!accum[a.categoria]) accum[a.categoria] = Array(12).fill(0);
    accum[a.categoria][a.mesIndex] += valorMetrica(a, metrica);
  });
  const data = MESES.map((m) => {
    const row = { mes: m };
    cats.forEach((c) => { row[c] = Math.round((accum[c][MESES.indexOf(m)] || 0) * 100) / 100; });
    return row;
  });
  return { data, series: [...cats].sort() };
}

// Cards do modo Aplicações.
export function cardsAplicacoes(aplicacoes) {
  const produtos = new Set(); const categorias = new Set();
  let area = 0; let comArea = 0; let semDose = 0;
  aplicacoes.forEach((a) => {
    produtos.add(a.produto_nome_padrao);
    categorias.add(a.categoria);
    if (a.ha_estimado != null) { area += a.ha_estimado; comArea += 1; } else semDose += 1;
  });
  return {
    totalAplicacoes: aplicacoes.length,
    produtosUtilizados: produtos.size,
    categoriasUtilizadas: categorias.size,
    areaEstimada: comArea ? Math.round(area * 100) / 100 : null,
    semDose,
  };
}

// Cards do modo Custos.
export function cardsCustos(aplicacoes) {
  let total = 0; let comCusto = 0; let semPreco = 0;
  aplicacoes.forEach((a) => { if (a.custo != null) { total += a.custo; comCusto += 1; } else semPreco += 1; });
  const porProd = agregarPorProduto(aplicacoes);
  const porCat = agregarPorCategoria(aplicacoes);
  const topProd = porProd.filter((r) => r.custo > 0).sort((a, b) => b.custo - a.custo)[0] || null;
  const topCat = porCat.filter((r) => r.custo > 0).sort((a, b) => b.custo - a.custo)[0] || null;
  return {
    custoTotal: Math.round(total * 100) / 100,
    custoMedio: comCusto ? Math.round((total / comCusto) * 100) / 100 : null,
    produtoMaiorCusto: topProd ? { nome: topProd.nome, valor: topProd.custo } : null,
    categoriaMaiorCusto: topCat ? { nome: topCat.categoria, valor: topCat.custo } : null,
    semPreco,
  };
}

// Resumo por categoria (tabela Aplicação x Custo).
export function resumoPorCategoria(aplicacoes) {
  return agregarPorCategoria(aplicacoes).map((r) => ({
    categoria: r.categoria,
    aplicacoes: r.aplicacoes,
    area: r.area,
    custo: r.custo,
    custoMedio: r.custo_medio,
    semDose: r.sem_dose,
    semPreco: r.sem_preco,
  })).sort((a, b) => (b.custo || 0) - (a.custo || 0));
}

// Lista de safras presentes para o filtro.
export function safrasDisponiveis(aplicacoes) {
  const set = new Set();
  aplicacoes.forEach((a) => { if (a.safra) set.add(a.safra); });
  return [...set].sort();
}

// Conta aplicações sem talhão informado (registros antigos).
export function countSemTalhao(aplicacoes) {
  return aplicacoes.reduce((s, a) => {
    const arr = Array.isArray(a.talhoes_aplicacao) ? a.talhoes_aplicacao : [];
    return s + (arr.length ? 0 : 1);
  }, 0);
}

// Drill-down: filtra aplicações por dimensão clicada.
export function filtrarDrillDown(aplicacoes, { mes = null, mesIndex = null, produto = null, categoria = null } = {}) {
  return aplicacoes.filter((a) => {
    if (mes && a.mes !== mes) return false;
    if (mesIndex != null && a.mesIndex !== mesIndex) return false;
    if (produto && a.produto_nome_padrao !== produto) return false;
    if (categoria && a.categoria !== categoria) return false;
    return true;
  });
}