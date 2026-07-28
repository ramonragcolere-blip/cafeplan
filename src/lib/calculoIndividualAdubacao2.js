import { calcRecomendacaoRamon } from './protocoloRamon.js';
import {
  listaSeguraAdubacao2,
  montarLinhasProdutos,
  normalizarProdutoAdubacao2,
  objetoSeguroAdubacao2,
  produtoNuloAdubacao2,
} from './planejamentoProdutosAdubacao2.js';

function numeroOuNull(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function calcularMediaBienal(locProd = {}) {
  const s1 = numeroOuNull(locProd.safra1);
  const s2 = numeroOuNull(locProd.safra2);
  if (s1 != null && s2 != null) return (s1 + s2) / 2;
  if (s1 != null) return s1;
  if (s2 != null) return s2;
  return null;
}

export function calcularResultadoTalhaoAdubacao2({
  talhao,
  registrosSalvos = [],
  produtividadeLocal = {},
  analises = [],
  analises2040Local = {},
  todos = [],
  listaCalculo = null,
  substituirSalvos = false,
}) {
  const produtosCalculo = listaSeguraAdubacao2(listaCalculo || todos);
  const catalogoCompleto = listaSeguraAdubacao2(todos);
  const registroSalvo = listaSeguraAdubacao2(registrosSalvos).find(r => r?.talhao_id === talhao?.id) || null;
  const detSalvo = objetoSeguroAdubacao2(registroSalvo?.detalhamento);
  const locProd = objetoSeguroAdubacao2(produtividadeLocal[talhao?.id]);
  const mediaBienal = calcularMediaBienal(locProd);
  const analise = listaSeguraAdubacao2(analises).find(a => a?.talhao_id === talhao?.id) || null;
  const analise2040 = analises2040Local?.[talhao?.id] || null;
  const rec = mediaBienal != null && analise ? calcRecomendacaoRamon(mediaBienal, analise, analise2040) : null;

  let produtoSugerido = null;
  let doseProdutoHa = null;
  if (rec && detSalvo.produtoSugerido && !substituirSalvos && !produtoNuloAdubacao2(detSalvo.produtoSugerido)) {
    const salvo = normalizarProdutoAdubacao2(detSalvo.produtoSugerido);
    const produtoBase = produtosCalculo.find(p => p.id === salvo?.id) || catalogoCompleto.find(p => p.id === salvo?.id) || salvo;
    produtoSugerido = {
      ...produtoBase,
      dose_calculada_kg_ha: detSalvo.dose_calculada_kg_ha ?? detSalvo.doseProdutoHa ?? null,
      dose_utilizada_kg_ha: detSalvo.dose_utilizada_kg_ha ?? detSalvo.doseProdutoHa ?? null,
      dose_ajustada_manualmente: Boolean(detSalvo.dose_ajustada_manualmente),
      nutriente_alvo: detSalvo.nutriente_alvo || 'n_pct',
    };
    doseProdutoHa = detSalvo.dose_utilizada_kg_ha ?? detSalvo.doseProdutoHa ?? null;
  } else if (rec && produtosCalculo.length > 0) {
    const linhas = montarLinhasProdutos(produtosCalculo, { N: rec.N, P: rec.P, K: rec.K, B: rec.B }, {}, null, null, null, rec);
    const principal = linhas.find(l => l.ehPrincipal);
    if (principal) {
      produtoSugerido = principal.produto;
      doseProdutoHa = principal.doseKgHa;
    }
  }

  return {
    talhao,
    mediaBienal,
    analise,
    analise2040,
    rec,
    produtoSugerido,
    doseProdutoHa,
    dose_calculada_kg_ha: detSalvo.dose_calculada_kg_ha ?? doseProdutoHa,
    dose_utilizada_kg_ha: detSalvo.dose_utilizada_kg_ha ?? doseProdutoHa,
    dose_ajustada_manualmente: Boolean(detSalvo.dose_ajustada_manualmente),
    nutriente_alvo: detSalvo.nutriente_alvo || 'n_pct',
    temRegistroSalvo: Boolean(registroSalvo),
    substituirSalvo: Boolean(substituirSalvos && registroSalvo),
  };
}

export function mesclarResultadoTalhaoAdubacao2(resultadosAtuais = [], novoResultado, talhoes = []) {
  const talhaoId = novoResultado?.talhao?.id;
  if (!talhaoId) return listaSeguraAdubacao2(resultadosAtuais);
  const base = listaSeguraAdubacao2(resultadosAtuais);
  const mapa = new Map(base.filter(r => r?.talhao?.id).map(r => [r.talhao.id, r]));
  if (mapa.size === 0) {
    listaSeguraAdubacao2(talhoes).forEach(talhao => {
      if (talhao?.id) mapa.set(talhao.id, { talhao, mediaBienal: null, analise: null, analise2040: null, rec: null, produtoSugerido: null, doseProdutoHa: null, temRegistroSalvo: false });
    });
  }
  mapa.set(talhaoId, novoResultado);
  return listaSeguraAdubacao2(talhoes).length > 0
    ? listaSeguraAdubacao2(talhoes).map(talhao => mapa.get(talhao.id) || { talhao, mediaBienal: null, analise: null, analise2040: null, rec: null, produtoSugerido: null, doseProdutoHa: null, temRegistroSalvo: false })
    : Array.from(mapa.values());
}

export function montarPayloadPlanejamentoTalhaoAdubacao2({
  resultado,
  produtor,
  safra,
  produtividadeLocal = {},
  analises2040Local = {},
  dosesEditadas = {},
  produtoEfetivo = null,
  precos = {},
  parcelamentos = {},
}) {
  const talhao = resultado?.talhao;
  const locProd = objetoSeguroAdubacao2(produtividadeLocal[talhao?.id]);
  const loc2040 = analises2040Local?.[talhao?.id] || null;
  const produtoPrincipalSalvo = !produtoNuloAdubacao2(produtoEfetivo?.produto)
    ? produtoEfetivo.produto
    : (!produtoNuloAdubacao2(resultado?.produtoSugerido) ? resultado.produtoSugerido : null);
  const dosePrincipalSalva = produtoPrincipalSalvo
    ? (produtoEfetivo?.dose_utilizada_kg_ha ?? produtoEfetivo?.doseKgHa ?? resultado?.doseProdutoHa)
    : null;

  return {
    codigo_produtor: produtor?.codigo,
    safra,
    talhao_id: talhao?.id,
    talhao_nome: talhao?.nome,
    safra1_sc_ha: locProd.safra1 ? parseFloat(locProd.safra1) : null,
    safra2_sc_ha: locProd.safra2 ? parseFloat(locProd.safra2) : null,
    analise2040: loc2040 || null,
    doses_editadas: dosesEditadas[talhao?.id] || {},
    detalhamento: {
      rec: resultado?.rec,
      mediaBienal: resultado?.mediaBienal,
      produtoSugerido: produtoPrincipalSalvo ? { id: produtoPrincipalSalvo.id, nome: produtoPrincipalSalvo.nome } : null,
      doseProdutoHa: dosePrincipalSalva,
      dose_calculada_kg_ha: produtoPrincipalSalvo ? (produtoEfetivo?.dose_calculada_kg_ha ?? resultado?.dose_calculada_kg_ha ?? resultado?.doseProdutoHa) : null,
      dose_utilizada_kg_ha: dosePrincipalSalva,
      dose_ajustada_manualmente: Boolean(produtoPrincipalSalvo && produtoEfetivo?.dose_ajustada_manualmente),
      nutriente_alvo: produtoPrincipalSalvo ? (produtoEfetivo?.nutriente_alvo || resultado?.nutriente_alvo || 'n_pct') : null,
      complementos: produtoEfetivo?.complementos || [],
      trocas: produtoEfetivo?.trocas || {},
      marcados: produtoEfetivo?.marcados || null,
      produtos_ocultos: produtoEfetivo?.produtos_ocultos || [],
      precos,
      parcelamentos: parcelamentos[talhao?.id] || {},
    },
  };
}
