import { sugerirProdutosInteligente } from './sugerirProdutos2.js';

export const KEY_PARA_LABEL = { n_pct: 'N', k2o_pct: 'K2O', p2o5_pct: 'P2O5', b_pct: 'B' };
export const LABEL_PARA_REC = { N: 'N', K2O: 'K', P2O5: 'P', B: 'B' };
export const NUTRIENTES_PLANEJAMENTO = [
  { recKey: 'N', nutKey: 'n_pct', label: 'N' },
  { recKey: 'K', nutKey: 'k2o_pct', label: 'K2O' },
  { recKey: 'P', nutKey: 'p2o5_pct', label: 'P2O5' },
  { recKey: 'B', nutKey: 'b_pct', label: 'B' },
];

const TEM_NUTRIENTE_KEYS = ['n_pct', 'p2o5_pct', 'k2o_pct', 'b_pct'];

export function produtoAtivo(produto) {
  return produto?.ativo !== false;
}

export function produtoTemNutrientePlanejamento(produto) {
  return TEM_NUTRIENTE_KEYS.some(key => (parseFloat(produto?.[key]) || 0) > 0);
}

export function origemProdutoCatalogoLabel(produto) {
  return produto?._tipo === 'fonte' ? 'Fonte simples' : 'Fertilizante formulado';
}

export function filtrarProdutosPlanejamento(todos = [], filtro = {}) {
  const fornecedores = Array.isArray(filtro.fornecedores) ? filtro.fornecedores : [];
  const produtoId = filtro.produtoId || '';
  const incluirFontesSemFornecedor = Boolean(filtro.incluirFontesSemFornecedor);

  return (todos || [])
    .filter(produtoAtivo)
    .filter(produtoTemNutrientePlanejamento)
    .filter(produto => {
      if (produtoId) return produto.id === produtoId;
      if (fornecedores.length === 0) return true;
      if (fornecedores.includes(produto.fornecedor)) return true;
      return incluirFontesSemFornecedor && produto._tipo === 'fonte' && !produto.fornecedor;
    })
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
}

function nutKeyParaRecKey(nutKey) {
  return LABEL_PARA_REC[KEY_PARA_LABEL[nutKey]] || nutKey;
}

function doseParaNutriente(produto, nutKey, rec, recKey = null) {
  const pct = parseFloat(produto?.[nutKey]) || 0;
  const alvo = rec?.[recKey || nutKeyParaRecKey(nutKey)] || 0;
  if (pct <= 0 || alvo <= 0) return null;
  return Math.round((alvo / (pct / 100)) * 10) / 10;
}

function fornecidoPelo(prod, dose) {
  return {
    N: (parseFloat(prod?.n_pct) || 0) / 100 * (dose || 0),
    P: (parseFloat(prod?.p2o5_pct) || 0) / 100 * (dose || 0),
    K: (parseFloat(prod?.k2o_pct) || 0) / 100 * (dose || 0),
    B: (parseFloat(prod?.b_pct) || 0) / 100 * (dose || 0),
  };
}

export function montarLinhasProdutos(todos, rec, trocas = {}, produtoSalvo = null, doseSalva = null, complementosSalvos = null, recOriginal = null) {
  const _recOrig = recOriginal || rec;
  if (!rec || !todos?.length) return [];

  if (produtoSalvo) {
    const principal = todos.find(p => p.id === produtoSalvo.id) || produtoSalvo;
    const produtoTrocado = trocas.n_pct ? todos.find(p => p.id === trocas.n_pct) : null;
    const prodPrincipal = produtoTrocado || principal;
    const doseKgHa = produtoTrocado
      ? (doseParaNutriente(produtoTrocado, 'n_pct', rec, 'N') ?? doseSalva)
      : (doseSalva ?? doseParaNutriente(principal, 'n_pct', rec, 'N'));

    const cobertos = fornecidoPelo(prodPrincipal, doseKgHa);
    const nutrientesPrincipal = [];
    if ((parseFloat(prodPrincipal.n_pct) || 0) > 0 && rec.N) nutrientesPrincipal.push({ label: 'N', fornecido: cobertos.N });
    if ((parseFloat(prodPrincipal.p2o5_pct) || 0) > 0 && rec.P) nutrientesPrincipal.push({ label: 'P2O5', fornecido: cobertos.P });
    if ((parseFloat(prodPrincipal.k2o_pct) || 0) > 0 && rec.K) nutrientesPrincipal.push({ label: 'K2O', fornecido: cobertos.K });
    if ((parseFloat(prodPrincipal.b_pct) || 0) > 0 && rec.B) nutrientesPrincipal.push({ label: 'B', fornecido: cobertos.B });

    const mapa = {};
    mapa[prodPrincipal.id] = {
      produto: prodPrincipal,
      nutrientes: nutrientesPrincipal,
      ehPrincipal: true,
      nutKey: 'n_pct',
      doseKgHa,
      origemUso: produtoTrocado ? 'Produto escolhido manualmente' : 'Produto salvo',
    };

    if (complementosSalvos?.length > 0) {
      for (const comp of complementosSalvos) {
        if (comp.isManualExtra || !comp.produto?.id || comp.produto.id === prodPrincipal.id) continue;
        const prodComp = todos.find(p => p.id === comp.produto.id) || comp.produto;
        const prodFinal = trocas[comp.nutKey] ? todos.find(p => p.id === trocas[comp.nutKey]) : prodComp;
        if (!prodFinal || mapa[prodFinal.id]) continue;
        mapa[prodFinal.id] = {
          produto: prodFinal,
          nutrientes: comp.nutrientes || [],
          ehPrincipal: false,
          nutKey: comp.nutKey,
          doseKgHa: comp.doseKgHa,
          origemUso: trocas[comp.nutKey] ? 'Produto escolhido manualmente' : 'Produto salvo',
        };
      }
    }

    const fornecidoTotal = { N: 0, P: 0, K: 0, B: 0 };
    Object.values(mapa).forEach(linha => {
      const d = linha.doseKgHa || 0;
      const fornecido = fornecidoPelo(linha.produto, d);
      fornecidoTotal.N += fornecido.N;
      fornecidoTotal.P += fornecido.P;
      fornecidoTotal.K += fornecido.K;
      fornecidoTotal.B += fornecido.B;
    });

    const recResidual = {
      N: Math.max(0, (rec.N || 0) - fornecidoTotal.N),
      P: Math.max(0, (rec.P || 0) - fornecidoTotal.P),
      K: Math.max(0, (rec.K || 0) - fornecidoTotal.K),
      B: Math.max(0, (rec.B || 0) - fornecidoTotal.B),
    };
    const temResidual = recResidual.N > 1 || recResidual.P > 1 || recResidual.K > 1 || recResidual.B > 1;
    if (temResidual) {
      const sugestoesResidual = sugerirProdutosInteligente(todos, recResidual, _recOrig);
      for (const [nutKey, sug] of Object.entries(sugestoesResidual)) {
        if (!sug?.produtoId) continue;
        const prodId = trocas[nutKey] || sug.produtoId;
        if (prodId === prodPrincipal.id) continue;
        const prod = todos.find(p => p.id === prodId);
        if (!prod || mapa[prod.id]) continue;
        const doseComp = doseParaNutriente(prod, nutKey, recResidual);
        const pct = parseFloat(prod[nutKey]) || 0;
        if (doseComp != null && doseComp > 0 && pct > 0) {
          const label = KEY_PARA_LABEL[nutKey] || nutKey;
          mapa[prod.id] = {
            produto: prod,
            nutrientes: [{ label, fornecido: doseComp * (pct / 100) }],
            ehPrincipal: false,
            nutKey,
            doseKgHa: doseComp,
            origemUso: trocas[nutKey] ? 'Produto escolhido manualmente' : 'Produto sugerido',
          };
        }
      }
    }

    return Object.values(mapa);
  }

  const sugestoes = sugerirProdutosInteligente(todos, { N: rec.N, P: rec.P, K: rec.K, B: rec.B }, rec);
  const principalId = trocas.n_pct || sugestoes.n_pct?.produtoId || null;
  const mapa = {};

  for (const [nutKey, sug] of Object.entries(sugestoes)) {
    if (!sug?.produtoId) continue;
    const prodId = trocas[nutKey] || sug.produtoId;
    const prod = todos.find(p => p.id === prodId);
    if (!prod) continue;
    if (!mapa[prod.id]) {
      mapa[prod.id] = {
        produto: prod,
        nutrientes: [],
        ehPrincipal: prod.id === principalId,
        nutKey,
        origemUso: trocas[nutKey] ? 'Produto escolhido manualmente' : 'Produto sugerido',
      };
    }
    const doseKgHa = doseParaNutriente(prod, nutKey, rec);
    const pct = parseFloat(prod[nutKey]) || 0;
    if (doseKgHa != null && pct > 0) {
      mapa[prod.id].nutrientes.push({ label: KEY_PARA_LABEL[nutKey] || nutKey, fornecido: doseKgHa * (pct / 100) });
      if (!mapa[prod.id].doseKgHa || nutKey === 'n_pct') mapa[prod.id].doseKgHa = doseKgHa;
    }
  }

  return Object.values(mapa);
}

export function listarNutrientesNaoAtendidos(rec, linhas = []) {
  const fornecido = { N: 0, P: 0, K: 0, B: 0 };
  (linhas || []).forEach(linha => {
    const d = Number(linha?.doseKgHa);
    if (!Number.isFinite(d) || d <= 0) return;
    const parcial = fornecidoPelo(linha.produto, d);
    fornecido.N += parcial.N;
    fornecido.P += parcial.P;
    fornecido.K += parcial.K;
    fornecido.B += parcial.B;
  });
  return ['N', 'P', 'K', 'B'].filter(key => (Number(rec?.[key]) || 0) - (fornecido[key] || 0) > 1);
}

export function montarProdutosEfetivosPlanejamento({
  resultados = [],
  registrosSalvos = [],
  todosFiltrados = [],
  todosCatalogo = [],
  trocasPorTalhao = {},
  marcadosPorTalhao = {},
  extrasPorTalhao = {},
  criarMarcacoesPadraoFn = () => ({}),
  elementos = [],
}) {
  const idsSalvos = new Set((registrosSalvos || []).map(r => r.talhao_id));
  const mapa = {};

  resultados.forEach(r => {
    if (!r.rec) return;
    const trocas = trocasPorTalhao[r.talhao.id] || {};
    const marcados = marcadosPorTalhao[r.talhao.id] || null;
    const recFiltrado = { ...r.rec };
    if (marcados) {
      if (!marcados.N) delete recFiltrado.N;
      if (!marcados.P) delete recFiltrado.P;
      if (!marcados.K) delete recFiltrado.K;
      if (!marcados.B) delete recFiltrado.B;
    }

    let produto = r.produtoSugerido || null;
    let doseKgHa = r.doseProdutoHa ?? null;
    if (!produto && !idsSalvos.has(r.talhao.id) && todosFiltrados.length > 0) {
      const linhasAuto = montarLinhasProdutos(todosFiltrados, recFiltrado, trocas, null, null, null, r.rec);
      const principal = linhasAuto.find(l => l.ehPrincipal);
      if (principal) {
        produto = principal.produto;
        doseKgHa = principal.doseKgHa;
      }
    }
    if (!produto && idsSalvos.has(r.talhao.id)) return;

    const compsSalvos = (registrosSalvos || []).find(s => s.talhao_id === r.talhao.id)?.detalhamento?.complementos || null;
    const linhas = montarLinhasProdutos(todosFiltrados, recFiltrado, trocas, produto, doseKgHa, r.substituirSalvo ? null : compsSalvos, r.rec);
    const linhaPrincipal = linhas.find(l => l.ehPrincipal);
    if (linhaPrincipal) {
      produto = linhaPrincipal.produto;
      doseKgHa = linhaPrincipal.doseKgHa;
    }

    const complementos = linhas.filter(l => !l.ehPrincipal).map(l => ({
      produto: { id: l.produto.id, nome: l.produto.nome },
      doseKgHa: l.doseKgHa,
      nutKey: l.nutKey,
      nutrientes: l.nutrientes,
      origemUso: l.origemUso,
    }));

    Object.entries(extrasPorTalhao[r.talhao.id] || {}).forEach(([key, data]) => {
      const doseExtra = Number(data?.doseKgHa);
      if (!data?.produtoId || !Number.isFinite(doseExtra) || doseExtra <= 0) return;
      const prod = todosFiltrados.find(p => p.id === data.produtoId) || todosCatalogo.find(p => p.id === data.produtoId);
      if (prod && !complementos.some(c => c.produto.id === prod.id)) {
        complementos.push({
          produto: { id: prod.id, nome: prod.nome },
          doseKgHa: doseExtra,
          nutKey: key,
          nutrientes: [],
          isManualExtra: true,
          origemUso: 'Produto escolhido manualmente',
        });
      }
    });

    if (produto || complementos.length > 0) {
      mapa[r.talhao.id] = {
        produto,
        doseKgHa,
        complementos,
        trocas,
        marcados: marcados || criarMarcacoesPadraoFn(r.rec, elementos),
      };
    }
  });

  return mapa;
}

export function combinarCatalogoInsumos(formulados = [], fontes = []) {
  return [
    ...(formulados || []).map(produto => ({ ...produto, _tipo: 'formulado', _origemLabel: 'Fertilizante formulado' })),
    ...(fontes || []).map(produto => ({ ...produto, _tipo: 'fonte', _origemLabel: 'Fonte simples' })),
  ];
}

export function contarUsoProdutoPlanejamento(registros = [], produtoId) {
  if (!produtoId) return 0;
  return (registros || []).filter(registro => {
    const det = registro?.detalhamento || {};
    if (det.produtoSugerido?.id === produtoId) return true;
    return (det.complementos || []).some(comp => comp?.produto?.id === produtoId);
  }).length;
}
