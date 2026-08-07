// Análise de Preços do módulo Notas Fiscais — Banco de Preços (comparativo por
// fornecedor) e Alerta de aumento de preço na importação.
//
// FONTE ÚNICA: BaseNotasFiscais + BaseItensNotaFiscal + Base de Insumos
// (FertilizanteFormulado/FonteSimples). NÃO persiste nada, NÃO cria segunda
// base de preços. Mesma metodologia para Banco de Preços e Alerta (regra #24).
//
// IDENTIFICAÇÃO DO PRODUTO (regra #2): prioridade
//   1) item.insumo_id + insumo_tipo (vínculo direto à Base de Insumos)
//   2) matchInsumo() por palavra inteira na Base de Insumos
//   3) nome normalizado -> chave nf_<nome normalizado>
//   Mesmo resolver do Controle de Estoque e das Análises -> consistência total.
//
// PREÇO COMPARÁVEL (regra #3, #22): reutiliza converterItem() (estoqueInsumos).
//   - "1 GL ORKESTRA SC 5 L" -> 5 L -> R$/L (não R$/GL)
//   - ML->L, g->kg, t->kg. Embalagem sem volume identificado permanece na
//     unidade original. Compara-se SOMENTE registros com a MESMA unidade
//     comparável — L nunca se mistura com kg.
//
// MÉDIA PONDERADA (regra #6): Σ(preço_total) / Σ(qtd_comparavel). Preserva o
// conceito existente, agora sobre a quantidade comparável (convertida).
//
// ÚLTIMO PREÇO (regra #4): compra mais recente por BaseNotasFiscais.data_emissao
// (NUNCA created_date).
//
// ALERTA (Parte 2): calculado durante a revisão, ANTES de salvar. O histórico
// é o que JÁ existe no banco (a nova NF ainda não foi salva -> não contamina a
// média). Em lote, todas as NFs comparam contra o mesmo histórico pré-lote
// (regra #18). Variação % vs média ponderada histórica; níveis 10/15/20%
// (regra #14). Não bloqueia a importação (regra #14).
import { converterItem, construirInsumosIndex, matchInsumo } from '@/lib/estoqueInsumos';
import { normalizarNome, classificarProduto } from '@/lib/notasFiscaisCategorias';

// ---- Resolver de insumo (idêntico ao do estoque/analises) ----------------------
export function resolverItemPrecos(item, fertMap, fonteMap, idx) {
  if (item.insumo_id) {
    if (item.insumo_tipo === 'fonte' && fonteMap[item.insumo_id]) {
      return { tipo: 'fonte', id: item.insumo_id, record: fonteMap[item.insumo_id] };
    }
    if (item.insumo_tipo === 'formulado' && fertMap[item.insumo_id]) {
      return { tipo: 'fert', id: item.insumo_id, record: fertMap[item.insumo_id] };
    }
  }
  return matchInsumo(item.produto_nome, idx);
}

export function chavePrecos(ins, nome) {
  return ins ? `${ins.tipo}_${ins.id}` : `nf_${normalizarNome(nome)}`;
}

// Unidade comparável para exibição: 'l' -> 'L', 'kg' -> 'kg', embalagem -> alta.
export function unidadeDisplay(u) {
  if (!u) return '—';
  if (u === 'l') return 'L';
  if (u === 'kg') return 'kg';
  return String(u).toUpperCase();
}

// ---- Entrada de preço comparável ---------------------------------------------
// Converte um item de NF em uma "entrada" com preço comparável (R$/unidade
// comparável). Retorna null se não houver preço/quantidade utilizáveis.
export function itemParaEntrada(item, nota, fertMap, fonteMap, idx, catalogoCategorias) {
  const nome = String(item.produto_nome || '').trim();
  if (!nome) return null;
  const qtd = Number(item.quantidade) || 0;
  if (qtd <= 0) return null;
  const precoTotal = Number(item.preco_total) || 0;
  const precoUnit = Number(item.preco_unitario) || 0;
  if (precoTotal <= 0 && precoUnit <= 0) return null;

  const ins = resolverItemPrecos(item, fertMap, fonteMap, idx);
  const chave = chavePrecos(ins, nome);
  const nomePadrao = ins ? ins.record.nome : nome;
  const categoria = classificarProduto(nome, catalogoCategorias);
  const conv = converterItem(item);
  const qtdComp = Number(conv.q) || 0;
  if (qtdComp <= 0) return null;
  const unidadeComp = conv.unit;
  const precoTotalUsado = precoTotal > 0 ? precoTotal : precoUnit * qtd;
  const precoUnitComp = precoTotalUsado / qtdComp;

  return {
    chave,
    produtor_id: item.produtor_id,
    nome_padrao: nomePadrao,
    nome_nf: nome,
    categoria,
    fornecedor: nota?.fornecedor_nome || '',
    nota_numero: nota?.numero_nota || '',
    nota_id: item.nota_fiscal_id || '',
    data: nota?.data_emissao || '',
    quantidade: qtd,
    unidade_original: String(item.unidade_medida || '').toUpperCase(),
    qtd_comparavel: qtdComp,
    unidade_comparavel: unidadeComp,
    preco_total: precoTotalUsado,
    preco_unit_comparavel: precoUnitComp,
  };
}

// Agrupa entradas por (chave + unidade_comparavel). Mesmo produto em L e em kg
// (embalagens diferentes/conversões diferentes) ficam em linhas separadas.
// "Produtor = Todos" consolida entre produtores (a chave não inclui produtor).
export function agruparEntradas(entradas) {
  const map = {};
  entradas.forEach((e) => {
    const k = `${e.chave}||${e.unidade_comparavel}`;
    if (!map[k]) {
      map[k] = { chave: e.chave, unidade_comparavel: e.unidade_comparavel, nome_padrao: e.nome_padrao, categoria: e.categoria, entradas: [] };
    }
    map[k].entradas.push(e);
  });
  return Object.values(map);
}

// ---- Referência de preço de um conjunto de entradas --------------------------
// dataLimite opcional (regra #12): quando informada, usa SOMENTE entradas com
// data < dataLimite (anteriores à nova NF). Entradas sem data são descartadas
// no modo com-limite (não dá pra confirmar que são anteriores).
export function calcularReferenciaPreco(entradas, dataLimite = '') {
  const validas = dataLimite
    ? entradas.filter((e) => e.data && e.data < dataLimite)
    : entradas.slice();
  if (!validas.length) return null;

  const sortedDesc = [...validas].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const ultimo = sortedDesc[0];
  let menor = validas[0];
  let maior = validas[0];
  validas.forEach((e) => {
    if (e.preco_unit_comparavel < menor.preco_unit_comparavel) menor = e;
    if (e.preco_unit_comparavel > maior.preco_unit_comparavel) maior = e;
  });
  const sumQ = validas.reduce((s, e) => s + e.qtd_comparavel, 0);
  const sumP = validas.reduce((s, e) => s + e.preco_total, 0);
  const medio = sumQ > 0 ? sumP / sumQ : null;

  return {
    numCompras: validas.length,
    unidade_comparavel: validas[0].unidade_comparavel,
    precoMedio: medio,
    menor: {
      preco: menor.preco_unit_comparavel,
      fornecedor: menor.fornecedor,
      data: menor.data,
      nota: menor.nota_numero,
    },
    maior: {
      preco: maior.preco_unit_comparavel,
      fornecedor: maior.fornecedor,
      data: maior.data,
      nota: maior.nota_numero,
    },
    ultimo: {
      preco: ultimo.preco_unit_comparavel,
      fornecedor: ultimo.fornecedor,
      data: ultimo.data,
      nota: ultimo.nota_numero,
    },
    qtdTotal: sumQ,
    entradas_usadas: validas,
  };
}

// ---- Consolidar por fornecedor (detalhe do Banco de Preços) -----------------
// Ordenado do MENOR preço comparável para o maior (melhor fornecedor no topo).
export function consolidarPorFornecedor(entradas, dataLimite = '') {
  const validas = dataLimite
    ? entradas.filter((e) => e.data && e.data < dataLimite)
    : entradas.slice();
  const map = {};
  validas.forEach((e) => {
    const f = e.fornecedor || '—';
    if (!map[f]) map[f] = { fornecedor: f, entradas: [] };
    map[f].entradas.push(e);
  });
  const out = Object.values(map).map((g) => {
    const ref = calcularReferenciaPreco(g.entradas);
    const sortedDesc = [...g.entradas].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const ultimo = sortedDesc[0];
    return {
      fornecedor: g.fornecedor,
      ultima_data: ultimo?.data || '',
      ultimo_preco: ultimo?.preco_unit_comparavel || null,
      menor: ref?.menor.preco ?? null,
      maior: ref?.maior.preco ?? null,
      medio: ref?.precoMedio ?? null,
      qtd_total: ref?.qtdTotal ?? 0,
      num_compras: g.entradas.length,
    };
  });
  out.sort((a, b) => (a.menor ?? Infinity) - (b.menor ?? Infinity));
  return out;
}

// ---- Nível de alerta (Parte 2, regra #14) ------------------------------------
// níveis: semHistorico | novoMenor | melhorPreco | normal | atencao |
//         relevante | forte | queda
export function calcularVariacaoPreco(novoPreco, referencia) {
  if (!referencia || novoPreco == null) {
    return { nivel: 'semHistorico', variacaoPct: null, texto: 'Sem histórico para comparação', cor: 'muted', icone: 'none' };
  }
  const base = referencia.precoMedio;
  const menor = referencia.menor.preco;
  const pctBase = base != null && base > 0 ? ((novoPreco - base) / base) * 100 : null;

  // Novo menor preço histórico (regra #15)
  if (novoPreco < menor - 1e-9) {
    return { nivel: 'novoMenor', variacaoPct: pctBase, texto: '✓ Novo menor preço histórico', cor: 'verde', icone: 'check' };
  }
  // Igual ao menor (melhor preço atual)
  if (Math.abs(novoPreco - menor) < 1e-9) {
    return { nivel: 'melhorPreco', variacaoPct: 0, texto: 'Melhor preço atual', cor: 'verde', icone: 'check', pctVsMedia: pctBase };
  }
  // Acima da média -> faixas 10/15/20
  if (pctBase != null && pctBase > 0) {
    if (pctBase < 10) return { nivel: 'normal', variacaoPct: pctBase, texto: `${pctBase.toFixed(1)}% acima da média`, cor: 'muted', icone: 'none', pctVsMedia: pctBase };
    if (pctBase < 15) return { nivel: 'atencao', variacaoPct: pctBase, texto: `ATENÇÃO: ${pctBase.toFixed(1)}% acima da média`, cor: 'amarelo', icone: 'alert', pctVsMedia: pctBase };
    if (pctBase < 20) return { nivel: 'relevante', variacaoPct: pctBase, texto: `AUMENTO RELEVANTE: ${pctBase.toFixed(1)}% acima da média`, cor: 'laranja', icone: 'alert', pctVsMedia: pctBase };
    return { nivel: 'forte', variacaoPct: pctBase, texto: `AUMENTO FORTE: ${pctBase.toFixed(1)}% acima da média`, cor: 'vermelho', icone: 'alert', pctVsMedia: pctBase };
  }
  // Abaixo da média (queda discreta, regra #15)
  if (pctBase != null && pctBase < 0) {
    return { nivel: 'queda', variacaoPct: pctBase, texto: `${Math.abs(pctBase).toFixed(1)}% abaixo da média histórica`, cor: 'verdeclaro', icone: 'down', pctVsMedia: pctBase };
  }
  return { nivel: 'normal', variacaoPct: 0, texto: 'Preço dentro da média', cor: 'muted', icone: 'none', pctVsMedia: pctBase };
}

// Conta alertas "de aumento" (atencao/relevante/forte) em uma lista de análises.
export function contarAumentosAvisos(analises) {
  let aumentos = 0;
  let avisos = 0;
  let quedas = 0;
  let semHistorico = 0;
  (analises || []).forEach((a) => {
    if (!a || a.skip) return;
    const n = a.variacao?.nivel;
    if (n === 'atencao' || n === 'relevante' || n === 'forte') aumentos += 1;
    else if (n === 'normal') avisos += 1;
    else if (n === 'queda' || n === 'novoMenor' || n === 'melhorPreco') quedas += 1;
    else if (n === 'semHistorico') semHistorico += 1;
  });
  return { aumentos, avisos, quedas, semHistorico, total: (analises || []).filter((a) => a && !a.skip).length };
}

// ---- Alerta de preço da nova NF ---------------------------------------------
// Analisa cada item da nova NF contra o histórico JÁ existente (a nova NF não
// está no banco -> não contamina a referência; em lote, todas comparam contra
// o mesmo histórico pré-lote, regra #18). data limite = data_emissão da nova
// NF (usar preços anteriores, regra #12).
export function analisarPrecosNovaNota({
  dadosNovaNota, produtorId, historicoItens = [], notas = [],
  fertilizantes = [], fontes = [], catalogoCategorias = [],
} = {}) {
  const fertMap = {};
  (fertilizantes || []).forEach((f) => { fertMap[f.id] = f; });
  const fonteMap = {};
  (fontes || []).forEach((f) => { fonteMap[f.id] = f; });
  const idx = construirInsumosIndex(fertilizantes, fontes);
  const notasMap = {};
  (notas || []).forEach((n) => { notasMap[n.id] = n; });

  const novaData = dadosNovaNota?.data_emissao || '';
  const novoFornecedor = dadosNovaNota?.fornecedor_nome || '';
  const novoNumero = String(dadosNovaNota?.numero || '');

  // Histórico do produtor selecionado (a nova NF ainda não está no banco).
  const histEntradas = [];
  (historicoItens || []).forEach((item) => {
    if (produtorId && item.produtor_id !== produtorId) return;
    const nota = item.nota_fiscal_id ? notasMap[item.nota_fiscal_id] : null;
    const e = itemParaEntrada(item, nota, fertMap, fonteMap, idx, catalogoCategorias);
    if (e) histEntradas.push(e);
  });

  // Agrupa histórico por (chave + unidade comparável).
  const grupos = {};
  histEntradas.forEach((e) => {
    const k = `${e.chave}||${e.unidade_comparavel}`;
    if (!grupos[k]) grupos[k] = [];
    grupos[k].push(e);
  });

  const notaFantasma = { fornecedor_nome: novoFornecedor, numero_nota: novoNumero, data_emissao: novaData, id: '' };
  const resultados = [];
  (dadosNovaNota?.itens || []).forEach((itemNovo, idxItem) => {
    const nome = String(itemNovo?.produto_nome || '').trim();
    if (!nome) { resultados.push({ idxItem, skip: true }); return; }
    const eNovo = itemParaEntrada({ ...itemNovo, produtor_id: produtorId }, notaFantasma, fertMap, fonteMap, idx, catalogoCategorias);
    if (!eNovo) { resultados.push({ idxItem, skip: true, nome }); return; }
    const k = `${eNovo.chave}||${eNovo.unidade_comparavel}`;
    const entradasGrupo = grupos[k] || [];
    const referencia = calcularReferenciaPreco(entradasGrupo, novaData);
    const variacao = calcularVariacaoPreco(eNovo.preco_unit_comparavel, referencia);

    let economia = null;
    if (referencia) {
      const diff = eNovo.preco_unit_comparavel - referencia.menor.preco;
      economia = {
        unitaria: diff,
        total: diff * eNovo.qtd_comparavel,
        melhorFornecedor: referencia.menor.fornecedor,
        melhorPreco: referencia.menor.preco,
      };
    }
    let obsCompras = '';
    if (!referencia) obsCompras = 'Primeira compra — sem histórico para comparação';
    else if (referencia.numCompras === 1) obsCompras = 'Baseado em 1 compra anterior';
    else obsCompras = `Baseado em ${referencia.numCompras} compras anteriores`;

    resultados.push({
      idxItem,
      nome,
      entry: eNovo,
      referencia,
      variacao,
      economia,
      numCompras: referencia ? referencia.numCompras : 0,
      obsCompras,
      fornecedorAtual: novoFornecedor,
    });
  });
  return resultados;
}

// ---- Banco de Preços consolidado (Parte 1) ----------------------------------
// Evolução do consolidarPrecosItens: agrupa por produto (chave) + unidade
// comparável, calcula último/menor/maior/médio/melhor-fornecedor/economia +
// detalhe por fornecedor + histórico. Respeita filtros já aplicados aos itens
// (produtor/produto/categoria/período são resolvidos pela página antes de
// chamar).
export function consolidarBancoPrecos({
  itens = [], notas = [], fertilizantes = [], fontes = [], catalogoCategorias = [],
} = {}) {
  const fertMap = {};
  (fertilizantes || []).forEach((f) => { fertMap[f.id] = f; });
  const fonteMap = {};
  (fontes || []).forEach((f) => { fonteMap[f.id] = f; });
  const idx = construirInsumosIndex(fertilizantes, fontes);
  const notasMap = {};
  (notas || []).forEach((n) => { notasMap[n.id] = n; });

  const entradas = [];
  (itens || []).forEach((item) => {
    const nota = item.nota_fiscal_id ? notasMap[item.nota_fiscal_id] : null;
    const e = itemParaEntrada(item, nota, fertMap, fonteMap, idx, catalogoCategorias);
    if (e) entradas.push(e);
  });

  const grupos = agruparEntradas(entradas);
  const rows = grupos.map((g) => {
    const ref = calcularReferenciaPreco(g.entradas);
    const notaIds = new Set();
    g.entradas.forEach((e) => { if (e.nota_id) notaIds.add(e.nota_id); });
    const ultimo = ref.ultimo;
    const menor = ref.menor;
    const economiaUnit = ultimo.preco - menor.preco; // último - menor (regra #7)
    const economiaPct = menor.preco > 0 ? (economiaUnit / menor.preco) * 100 : 0;
    return {
      chave: g.chave,
      produto_nome: g.nome_padrao,
      categoria: g.categoria,
      unidade: g.unidade_comparavel,
      num_notas: notaIds.size,
      num_compras: ref.numCompras,
      ultimo_preco: ultimo.preco,
      ultimo_fornecedor: ultimo.fornecedor,
      ultimo_data: ultimo.data,
      ultimo_nota: ultimo.nota,
      menor_preco: menor.preco,
      menor_fornecedor: menor.fornecedor,
      menor_data: menor.data,
      menor_nota: menor.nota,
      maior_preco: ref.maior.preco,
      preco_medio: ref.precoMedio,
      melhor_fornecedor: menor.fornecedor,
      economia_unit: economiaUnit,
      economia_pct: economiaPct,
      economia_eh_zero: Math.abs(economiaUnit) < 1e-9,
      por_fornecedor: consolidarPorFornecedor(g.entradas),
      historico: [...g.entradas].sort((a, b) => (b.data || '').localeCompare(a.data || '')),
    };
  });
  rows.sort((a, b) => (a.produto_nome || '').localeCompare(b.produto_nome || '', 'pt-BR'));
  return rows;
}