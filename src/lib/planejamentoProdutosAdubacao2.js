import { sugerirProdutosInteligente } from './sugerirProdutos2.js';

export const MENSAGEM_FALLBACK_ADUBACAO2 = 'Não foi possível carregar este planejamento. Os dados não foram apagados.';

export const KEY_PARA_LABEL = {
  n_pct: 'N',
  p2o5_pct: 'P2O5',
  k2o_pct: 'K2O',
  b_pct: 'B',
  mg_pct: 'Mg',
  ca_pct: 'Ca',
  s_pct: 'S',
  zn_pct: 'Zn',
  cu_pct: 'Cu',
  mn_pct: 'Mn',
  fe_pct: 'Fe',
};
export const LABEL_PARA_REC = { N: 'N', K2O: 'K', P2O5: 'P', B: 'B', Mg: 'Mg', Ca: 'Ca', S: 'S', Zn: 'Zn', Cu: 'Cu', Mn: 'Mn', Fe: 'Fe' };
export const NUTRIENTES_PLANEJAMENTO = [
  { recKey: 'N', nutKey: 'n_pct', label: 'N' },
  { recKey: 'K', nutKey: 'k2o_pct', label: 'K2O' },
  { recKey: 'P', nutKey: 'p2o5_pct', label: 'P2O5' },
  { recKey: 'B', nutKey: 'b_pct', label: 'B' },
];
export const NUTRIENTES_ALVO_ADUBACAO2 = [
  { value: 'n_pct', recKey: 'N', label: 'Nitrogênio' },
  { value: 'p2o5_pct', recKey: 'P', label: 'P2O5' },
  { value: 'k2o_pct', recKey: 'K', label: 'K2O' },
  { value: 'b_pct', recKey: 'B', label: 'Boro' },
  { value: 'mg_pct', recKey: 'Mg', label: 'Magnésio' },
  { value: 'ca_pct', recKey: 'Ca', label: 'Cálcio' },
  { value: 's_pct', recKey: 'S', label: 'Enxofre' },
  { value: 'zn_pct', recKey: 'Zn', label: 'Zinco' },
  { value: 'cu_pct', recKey: 'Cu', label: 'Cobre' },
  { value: 'mn_pct', recKey: 'Mn', label: 'Manganês' },
  { value: 'fe_pct', recKey: 'Fe', label: 'Ferro' },
  { value: 'dose_manual', recKey: null, label: 'Dose manual' },
];

const TEM_NUTRIENTE_KEYS = ['n_pct', 'p2o5_pct', 'k2o_pct', 'b_pct'];
const NUMERICOS_COMPOSICAO = ['n_pct', 'p2o5_pct', 'k2o_pct', 'ca_pct', 'mg_pct', 's_pct', 'b_pct', 'zn_pct', 'cu_pct', 'mn_pct', 'fe_pct'];
export const CAMPOS_FERTILIZANTE_FORMULADO = [
  'nome', 'fornecedor', 'grupo', 'tipo_produto', 'tipo_formulacao', 'funcao_composicao', 'ingrediente_ativo',
  ...NUMERICOS_COMPOSICAO,
  'outros_nutrientes', 'dose_viveiro', 'dose_plantio', 'dose_1ano_recepa', 'dose_producao', 'dose_esqueletado',
  'unidade_costal', 'unidade_aplicacao', 'instrucoes_uso', 'composicao_texto', 'intervalo_seguranca', 'observacoes', 'ativo',
];
export const CAMPOS_FONTE_SIMPLES = [
  'nome', 'nutriente_principal', 'nutrientes_secundarios',
  ...NUMERICOS_COMPOSICAO,
  'unidade_padrao', 'observacoes', 'ativo',
];

export function produtoAtivo(produto) {
  return produto?.ativo !== false;
}

export function produtoNuloAdubacao2(produto) {
  if (!produto) return true;
  if (produto === 0 || produto === '0') return true;
  if (typeof produto !== 'object') return String(produto || '').trim() === '';
  const id = produto.id ?? produto.produto_id ?? produto.value ?? null;
  const nome = produto.nome ?? produto.produto_nome ?? produto.label ?? null;
  if (id === 0 || id === '0') return true;
  if (nome === 0 || nome === '0') return true;
  return String(id ?? '').trim() === '' && String(nome ?? '').trim() === '';
}

export function produtoValidoAdubacao2(produto) {
  return !produtoNuloAdubacao2(produto);
}

export function listaSeguraAdubacao2(valor) {
  if (Array.isArray(valor)) return valor.filter(Boolean);
  if (valor && typeof valor === 'object') return Object.values(valor).filter(Boolean);
  return [];
}

export function objetoSeguroAdubacao2(valor) {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {};
}

export function normalizarProdutoAdubacao2(produto, fallback = {}) {
  if (produtoNuloAdubacao2(produto) && produtoNuloAdubacao2({ id: fallback.produto_id, nome: fallback.produto_nome || fallback.nome })) return null;
  if (produtoNuloAdubacao2(produto) && !produtoNuloAdubacao2({ id: fallback.produto_id, nome: fallback.produto_nome || fallback.nome })) {
    produto = null;
  }
  if (!produto && !fallback.produto_id && !fallback.produto_nome) return null;
  if (produto && typeof produto !== 'object') {
    return { id: fallback.produto_id || null, nome: String(produto || fallback.produto_nome || 'Produto não definido') };
  }
  const id = produto?.id || fallback.produto_id || null;
  const nome = produto?.nome || fallback.produto_nome || fallback.nome || 'Produto não definido';
  if (produtoNuloAdubacao2({ id, nome })) return null;
  return {
    ...(produto || {}),
    id,
    nome,
  };
}

export function normalizarComplementosAdubacao2(complementos = []) {
  return listaSeguraAdubacao2(complementos)
    .map(complemento => {
      if (!complemento || typeof complemento !== 'object') return null;
      const produto = normalizarProdutoAdubacao2(complemento.produto, complemento);
      return {
        ...complemento,
        produto,
        doseKgHa: complemento.dose_utilizada_kg_ha ?? complemento.doseKgHa ?? complemento.dose_kg_ha ?? null,
        dose_calculada_kg_ha: complemento.dose_calculada_kg_ha ?? complemento.doseKgHa ?? complemento.dose_kg_ha ?? null,
        dose_utilizada_kg_ha: complemento.dose_utilizada_kg_ha ?? complemento.doseKgHa ?? complemento.dose_kg_ha ?? null,
        dose_ajustada_manualmente: Boolean(complemento.dose_ajustada_manualmente),
        nutriente_alvo: complemento.nutriente_alvo || complemento.nutKey || 'dose_manual',
        nutKey: complemento.nutKey || complemento.nutriente_alvo || 'dose_manual',
      };
    })
    .filter(Boolean);
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

  return listaSeguraAdubacao2(todos)
    .filter(produtoValidoAdubacao2)
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

function numeroDose(valor) {
  if (valor === '' || valor == null) return null;
  const numero = Number(String(valor).replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

function doseParaNutriente(produto, nutKey, rec, recKey = null) {
  const pct = parseFloat(produto?.[nutKey]) || 0;
  const alvo = rec?.[recKey || nutKeyParaRecKey(nutKey)] || 0;
  if (pct <= 0 || alvo <= 0) return null;
  return Math.round((alvo / (pct / 100)) * 10) / 10;
}

export function calcularDoseProdutoPorAlvo(produto, nutrienteAlvo, rec = {}) {
  if (!produto || !nutrienteAlvo || nutrienteAlvo === 'dose_manual') return null;
  const alvo = NUTRIENTES_ALVO_ADUBACAO2.find(item => item.value === nutrienteAlvo);
  return doseParaNutriente(produto, nutrienteAlvo, rec, alvo?.recKey || null);
}

export function calcularNutrientesFornecidos(prod, dose) {
  const doseNum = numeroDose(dose) || 0;
  return {
    N: (parseFloat(prod?.n_pct) || 0) / 100 * doseNum,
    P: (parseFloat(prod?.p2o5_pct) || 0) / 100 * doseNum,
    K: (parseFloat(prod?.k2o_pct) || 0) / 100 * doseNum,
    B: (parseFloat(prod?.b_pct) || 0) / 100 * doseNum,
    Mg: (parseFloat(prod?.mg_pct) || 0) / 100 * doseNum,
    Ca: (parseFloat(prod?.ca_pct) || 0) / 100 * doseNum,
    S: (parseFloat(prod?.s_pct) || 0) / 100 * doseNum,
    Zn: (parseFloat(prod?.zn_pct) || 0) / 100 * doseNum,
    Cu: (parseFloat(prod?.cu_pct) || 0) / 100 * doseNum,
    Mn: (parseFloat(prod?.mn_pct) || 0) / 100 * doseNum,
    Fe: (parseFloat(prod?.fe_pct) || 0) / 100 * doseNum,
  };
}

function fornecidoPelo(prod, dose) {
  return calcularNutrientesFornecidos(prod, dose);
}

function nutrientesDaDose(produto, dose, rec = {}) {
  const fornecido = calcularNutrientesFornecidos(produto, dose);
  return Object.entries(KEY_PARA_LABEL)
    .map(([nutKey, label]) => {
      const valor = fornecido[LABEL_PARA_REC[label] || label] || 0;
      const temComposicao = (parseFloat(produto?.[nutKey]) || 0) > 0;
      const temRec = rec?.[LABEL_PARA_REC[label] || label] != null;
      return temComposicao && valor > 0 ? { label, fornecido: valor, secundario: !temRec } : null;
    })
    .filter(Boolean);
}

export function listarNutrientesFornecidosAdubacao2(produto, dose) {
  const fornecido = calcularNutrientesFornecidos(produto, dose);
  return Object.entries(KEY_PARA_LABEL)
    .map(([nutKey, label]) => {
      const valor = fornecido[LABEL_PARA_REC[label] || label] || 0;
      const temComposicao = (parseFloat(produto?.[nutKey]) || 0) > 0;
      return temComposicao && valor > 0 ? { label, fornecido: valor, unidade: 'kg/ha' } : null;
    })
    .filter(Boolean);
}

export function formatarNutrientesFornecidosAdubacao2(produto, dose) {
  const itens = listarNutrientesFornecidosAdubacao2(produto, dose);
  return itens
    .map(item => `${item.label} ${item.fornecido.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg/ha`)
    .join(' · ');
}

function criarIdLinha(produto, nutKey, sufixo = '') {
  return `${nutKey || 'produto'}:${produto?.id || produto?.nome || 'sem-produto'}${sufixo ? `:${sufixo}` : ''}`;
}

function chavesProdutoOculto(item) {
  if (typeof item === 'string') return [item];
  if (!item || typeof item !== 'object') return [];
  const alvo = item.nutriente_alvo || item.nutKey || '';
  const chaves = [];
  if (item.linhaId) chaves.push(item.linhaId);
  if (item.linhaId || alvo) chaves.push(`${item.linhaId || ''}|${item.produtoId || ''}|${alvo}`);
  if (!item.linhaId && !alvo && item.produtoId) chaves.push(item.produtoId);
  return chaves;
}

function linhaEstaOculta(linha, ocultosSet) {
  const alvo = linha?.nutriente_alvo || linha?.nutKey || '';
  return ocultosSet.has(linha?.linhaId) ||
    ocultosSet.has(`${linha?.linhaId || ''}|${linha?.produto?.id || ''}|${alvo}`);
}

function normalizarLinhaProduto(linha, rec = {}, ajustes = {}) {
  if (!linha?.produto || produtoNuloAdubacao2(linha.produto)) return null;
  const chave = linha.linhaId || criarIdLinha(linha.produto, linha.nutKey);
  const ajustesSeguros = objetoSeguroAdubacao2(ajustes);
  const ajuste = ajustesSeguros[chave] || ajustesSeguros[linha.produto?.id] || {};
  const alvo = ajuste.nutriente_alvo || linha.nutriente_alvo || linha.nutKey || 'dose_manual';
  const doseCalculada = numeroDose(ajuste.dose_calculada_kg_ha ?? linha.dose_calculada_kg_ha ?? linha.doseKgHa);
  const doseAjustada = numeroDose(ajuste.dose_utilizada_kg_ha ?? ajuste.doseKgHa);
  const doseSalva = numeroDose(linha.dose_utilizada_kg_ha);
  const doseUtilizada = doseAjustada ?? doseSalva ?? doseCalculada;
  const ajustada = ajuste.dose_ajustada_manualmente ?? linha.dose_ajustada_manualmente ?? (
    doseCalculada != null && doseUtilizada != null && Math.abs(doseUtilizada - doseCalculada) > 0.0001
  );

  return {
    ...linha,
    linhaId: chave,
    nutriente_alvo: alvo,
    doseKgHa: doseUtilizada,
    dose_calculada_kg_ha: doseCalculada,
    dose_utilizada_kg_ha: doseUtilizada,
    dose_ajustada_manualmente: Boolean(ajustada),
    nutrientes: nutrientesDaDose(linha.produto, doseUtilizada, rec),
  };
}

export function ajustarDoseLinha(linha, dose) {
  const doseUtilizada = numeroDose(dose);
  const doseCalculada = numeroDose(linha?.dose_calculada_kg_ha ?? linha?.doseKgHa);
  return {
    dose_utilizada_kg_ha: doseUtilizada,
    doseKgHa: doseUtilizada,
    dose_ajustada_manualmente: doseCalculada != null && doseUtilizada != null && Math.abs(doseUtilizada - doseCalculada) > 0.0001,
  };
}

export function restaurarDoseCalculadaLinha(linha) {
  const doseCalculada = numeroDose(linha?.dose_calculada_kg_ha ?? linha?.doseKgHa);
  return {
    dose_utilizada_kg_ha: doseCalculada,
    doseKgHa: doseCalculada,
    dose_ajustada_manualmente: false,
  };
}

export function calcularBalancoNutrientes(rec = {}, linhas = []) {
  const chaves = ['N', 'P', 'K', 'B', 'Mg', 'Ca', 'S', 'Zn', 'Cu', 'Mn', 'Fe'];
  const fornecido = Object.fromEntries(chaves.map(key => [key, 0]));
  listaSeguraAdubacao2(linhas).forEach(linha => {
    if (!linha?.produto) return;
    const parcial = calcularNutrientesFornecidos(linha.produto, linha.dose_utilizada_kg_ha ?? linha.doseKgHa);
    chaves.forEach(key => { fornecido[key] += parcial[key] || 0; });
  });

  return chaves
    .filter(key => rec?.[key] != null || fornecido[key] > 0)
    .map(key => {
      const necessidade = rec?.[key] ?? null;
      const valorFornecido = fornecido[key] || 0;
      const saldo = necessidade != null ? necessidade - valorFornecido : null;
      let situacao = 'Adição manual sem necessidade calculada';
      if (necessidade != null) {
        if (saldo > 1) situacao = 'Faltante';
        else if (saldo < -1) situacao = 'Acima da recomendação';
        else situacao = 'Atendido';
      }
      return { nutriente: key, necessidade, fornecido: valorFornecido, saldo, situacao };
    });
}

export function resolverAcaoProdutoDuplicado({ produtoId, linhas = [], manuais = [] }) {
  if (!produtoId || produtoId === '0') return { duplicado: false, acao: 'adicionar' };
  const existe = listaSeguraAdubacao2(linhas).some(linha => linha?.produto?.id === produtoId) ||
    Object.values(objetoSeguroAdubacao2(manuais)).some(item => item?.produtoId === produtoId);
  return existe
    ? { duplicado: true, acao: 'perguntar', opcoes: ['editar linha existente', 'adicionar uso separado'] }
    : { duplicado: false, acao: 'adicionar' };
}

function promoverPrincipalSeNecessario(linhas) {
  const linhasValidas = listaSeguraAdubacao2(linhas);
  if (!linhasValidas.some(linha => linha.ehPrincipal) && linhasValidas.length > 0) {
    linhasValidas[0] = { ...linhasValidas[0], ehPrincipal: true };
  }
  return linhasValidas;
}

export function montarLinhasProdutos(todos, rec, trocas = {}, produtoSalvo = null, doseSalva = null, complementosSalvos = null, recOriginal = null, ajustesDose = {}) {
  const _recOrig = recOriginal || rec;
  const todosLista = listaSeguraAdubacao2(todos).filter(produtoValidoAdubacao2);
  const trocasSeguras = objetoSeguroAdubacao2(trocas);
  if (!rec || !todosLista.length) return [];

  if (produtoSalvo) {
    const produtoSalvoNormalizado = normalizarProdutoAdubacao2(produtoSalvo);
    const principal = todosLista.find(p => p.id === produtoSalvoNormalizado?.id) || produtoSalvoNormalizado;
    if (!principal) return [];
    const produtoTrocado = trocasSeguras.n_pct ? todosLista.find(p => p.id === trocasSeguras.n_pct) : null;
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
    const chavePrincipal = prodPrincipal.id || criarIdLinha(prodPrincipal, 'n_pct');
    mapa[chavePrincipal] = normalizarLinhaProduto({
      linhaId: criarIdLinha(prodPrincipal, 'n_pct'),
      produto: prodPrincipal,
      nutrientes: nutrientesPrincipal,
      ehPrincipal: true,
      nutKey: 'n_pct',
      doseKgHa,
      dose_calculada_kg_ha: produtoTrocado ? doseParaNutriente(produtoTrocado, 'n_pct', rec, 'N') : (produtoSalvo?.dose_calculada_kg_ha ?? doseKgHa),
      dose_utilizada_kg_ha: produtoSalvo?.dose_utilizada_kg_ha ?? doseKgHa,
      dose_ajustada_manualmente: Boolean(produtoSalvo?.dose_ajustada_manualmente),
      nutriente_alvo: produtoSalvo?.nutriente_alvo || 'n_pct',
      origemUso: produtoTrocado ? 'Produto escolhido manualmente' : 'Produto salvo',
    }, rec, ajustesDose);

    const complementosNormalizados = normalizarComplementosAdubacao2(complementosSalvos);
    if (complementosNormalizados.length > 0) {
      for (const comp of complementosNormalizados) {
        if (comp.isManualExtra || !comp.produto || (comp.produto.id && comp.produto.id === prodPrincipal.id)) continue;
        const prodComp = todosLista.find(p => p.id === comp.produto.id) || comp.produto;
        const prodFinal = trocasSeguras[comp.nutKey] ? todosLista.find(p => p.id === trocasSeguras[comp.nutKey]) : prodComp;
        const chaveComp = prodFinal?.id || criarIdLinha(prodFinal, comp.nutKey);
        if (!prodFinal || mapa[chaveComp]) continue;
        mapa[chaveComp] = normalizarLinhaProduto({
          linhaId: comp.linhaId || criarIdLinha(prodFinal, comp.nutKey),
          produto: prodFinal,
          nutrientes: comp.nutrientes || [],
          ehPrincipal: false,
          nutKey: comp.nutKey,
          doseKgHa: comp.doseKgHa,
          dose_calculada_kg_ha: comp.dose_calculada_kg_ha ?? comp.doseKgHa,
          dose_utilizada_kg_ha: comp.dose_utilizada_kg_ha ?? comp.doseKgHa,
          dose_ajustada_manualmente: Boolean(comp.dose_ajustada_manualmente),
          nutriente_alvo: comp.nutriente_alvo || comp.nutKey || 'dose_manual',
          origemUso: trocasSeguras[comp.nutKey] ? 'Produto escolhido manualmente' : 'Produto salvo',
        }, rec, ajustesDose);
      }
    }

    const fornecidoTotal = { N: 0, P: 0, K: 0, B: 0 };
    Object.values(mapa).forEach(linha => {
      if (!linha?.produto) return;
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
      const sugestoesResidual = sugerirProdutosInteligente(todosLista, recResidual, _recOrig);
      for (const [nutKey, sug] of Object.entries(sugestoesResidual)) {
        if (!sug?.produtoId) continue;
        const prodId = trocasSeguras[nutKey] || sug.produtoId;
        if (prodId === prodPrincipal.id) continue;
        const prod = todosLista.find(p => p.id === prodId);
        if (!prod || mapa[prod.id]) continue;
        const doseComp = doseParaNutriente(prod, nutKey, recResidual);
        const pct = parseFloat(prod[nutKey]) || 0;
        if (doseComp != null && doseComp > 0 && pct > 0) {
          const label = KEY_PARA_LABEL[nutKey] || nutKey;
          mapa[prod.id] = normalizarLinhaProduto({
            linhaId: criarIdLinha(prod, nutKey),
            produto: prod,
            nutrientes: [{ label, fornecido: doseComp * (pct / 100) }],
            ehPrincipal: false,
            nutKey,
            doseKgHa: doseComp,
            dose_calculada_kg_ha: doseComp,
            dose_utilizada_kg_ha: doseComp,
            nutriente_alvo: nutKey,
            origemUso: trocasSeguras[nutKey] ? 'Produto escolhido manualmente' : 'Produto sugerido',
          }, rec, ajustesDose);
        }
      }
    }

    return promoverPrincipalSeNecessario(Object.values(mapa));
  }

  const sugestoes = sugerirProdutosInteligente(todosLista, { N: rec.N, P: rec.P, K: rec.K, B: rec.B }, rec);
  const principalId = trocasSeguras.n_pct || sugestoes.n_pct?.produtoId || null;
  const mapa = {};

  for (const [nutKey, sug] of Object.entries(sugestoes)) {
    if (!sug?.produtoId) continue;
    const prodId = trocasSeguras[nutKey] || sug.produtoId;
    const prod = todosLista.find(p => p.id === prodId);
    if (!prod) continue;
    if (!mapa[prod.id]) {
      mapa[prod.id] = {
        linhaId: criarIdLinha(prod, nutKey),
        produto: prod,
        nutrientes: [],
        ehPrincipal: prod.id === principalId,
        nutKey,
        nutriente_alvo: nutKey,
        origemUso: trocasSeguras[nutKey] ? 'Produto escolhido manualmente' : 'Produto sugerido',
      };
    }
    const doseKgHa = doseParaNutriente(prod, nutKey, rec);
    const pct = parseFloat(prod[nutKey]) || 0;
    if (doseKgHa != null && pct > 0) {
      mapa[prod.id].nutrientes.push({ label: KEY_PARA_LABEL[nutKey] || nutKey, fornecido: doseKgHa * (pct / 100) });
      if (!mapa[prod.id].doseKgHa || nutKey === 'n_pct') {
        mapa[prod.id].doseKgHa = doseKgHa;
        mapa[prod.id].dose_calculada_kg_ha = doseKgHa;
        mapa[prod.id].dose_utilizada_kg_ha = doseKgHa;
        mapa[prod.id].nutriente_alvo = nutKey;
      }
    }
  }

  return promoverPrincipalSeNecessario(Object.values(mapa).map(linha => normalizarLinhaProduto(linha, rec, ajustesDose)).filter(Boolean));
}

export function listarNutrientesNaoAtendidos(rec, linhas = []) {
  const fornecido = { N: 0, P: 0, K: 0, B: 0 };
  listaSeguraAdubacao2(linhas).forEach(linha => {
    if (!linha?.produto) return;
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
  ajustesDosePorTalhao = {},
  criarMarcacoesPadraoFn = () => ({}),
  elementos = [],
  produtosOcultosPorTalhao = {},
}) {
  const resultadosLista = listaSeguraAdubacao2(resultados);
  const registrosLista = listaSeguraAdubacao2(registrosSalvos);
  const todosFiltradosLista = listaSeguraAdubacao2(todosFiltrados);
  const todosCatalogoLista = listaSeguraAdubacao2(todosCatalogo);
  const trocasSeguras = objetoSeguroAdubacao2(trocasPorTalhao);
  const marcadosSeguros = objetoSeguroAdubacao2(marcadosPorTalhao);
  const extrasSeguros = objetoSeguroAdubacao2(extrasPorTalhao);
  const ajustesSeguros = objetoSeguroAdubacao2(ajustesDosePorTalhao);
  const ocultosSeguros = objetoSeguroAdubacao2(produtosOcultosPorTalhao);
  const idsSalvos = new Set(registrosLista.map(r => r.talhao_id));
  const mapa = {};

  resultadosLista.forEach(r => {
    if (!r?.rec || !r?.talhao?.id) return;
    const trocas = objetoSeguroAdubacao2(trocasSeguras[r.talhao.id]);
    const marcados = objetoSeguroAdubacao2(marcadosSeguros[r.talhao.id]);
    const recFiltrado = { ...r.rec };
    if (Object.keys(marcados).length > 0) {
      if (!marcados.N) delete recFiltrado.N;
      if (!marcados.P) delete recFiltrado.P;
      if (!marcados.K) delete recFiltrado.K;
      if (!marcados.B) delete recFiltrado.B;
    }

    const compsSalvos = normalizarComplementosAdubacao2(registrosLista.find(s => s.talhao_id === r.talhao.id)?.detalhamento?.complementos);
    let produto = r.substituirSalvo ? null : (r.produtoSugerido || null);
    let doseKgHa = r.substituirSalvo ? null : (r.doseProdutoHa ?? null);
    const extrasTalhao = objetoSeguroAdubacao2(extrasSeguros[r.talhao.id]);
    const produtosOcultosTalhao = listaSeguraAdubacao2(ocultosSeguros[r.talhao.id]);
    const ocultosSet = new Set(produtosOcultosTalhao.flatMap(chavesProdutoOculto).filter(Boolean));
    if (!produto && idsSalvos.has(r.talhao.id) && !r.substituirSalvo && compsSalvos.length === 0 && Object.keys(extrasTalhao).length === 0) return;

    const linhas = montarLinhasProdutos(
      todosFiltradosLista,
      recFiltrado,
      trocas,
      r.substituirSalvo ? null : produto,
      r.substituirSalvo ? null : doseKgHa,
      r.substituirSalvo ? null : compsSalvos,
      r.rec,
      objetoSeguroAdubacao2(ajustesSeguros[r.talhao.id]),
    ).filter(linha => !linhaEstaOculta(linha, ocultosSet));
    const linhaPrincipal = linhas.find(l => l.ehPrincipal);
    if (linhaPrincipal) {
      produto = linhaPrincipal.produto;
      doseKgHa = linhaPrincipal.doseKgHa;
    } else if (produto && (ocultosSet.has(produto.id) || ocultosSet.has(criarIdLinha(produto, r.nutriente_alvo || 'n_pct')))) {
      produto = null;
      doseKgHa = null;
    }

    const complementos = linhas.filter(l => !l.ehPrincipal).map(l => ({
      produto: { id: l.produto?.id || null, nome: l.produto?.nome || 'Produto não definido' },
      doseKgHa: l.doseKgHa,
      dose_calculada_kg_ha: l.dose_calculada_kg_ha,
      dose_utilizada_kg_ha: l.dose_utilizada_kg_ha,
      dose_ajustada_manualmente: l.dose_ajustada_manualmente,
      nutriente_alvo: l.nutriente_alvo,
      linhaId: l.linhaId,
      nutKey: l.nutKey,
      nutrientes: l.nutrientes,
      origemUso: l.origemUso,
    }));

    Object.entries(extrasTalhao).forEach(([key, data]) => {
      const doseExtra = Number(data?.doseKgHa);
      if (!data?.produtoId || data.produtoId === '0' || !Number.isFinite(doseExtra) || doseExtra <= 0) return;
      const alvoExtra = data?.nutriente_alvo || data?.nutKey || key || 'dose_manual';
      if (ocultosSet.has(key) || ocultosSet.has(`${key}|${data.produtoId || ''}|${alvoExtra}`) || ocultosSet.has(data.produtoId)) return;
      const prod = todosFiltradosLista.find(p => p.id === data.produtoId) || todosCatalogoLista.find(p => p.id === data.produtoId);
      const permiteUsoSeparado = Boolean(data?.usoSeparado || data?.isManualLivre || String(key).startsWith('manual-'));
      const complementoExistente = complementos.find(c => c.produto.id === prod?.id);
      if (prod && !permiteUsoSeparado && complementoExistente) {
        complementoExistente.nutrientes = nutrientesDaDose(prod, complementoExistente.dose_utilizada_kg_ha ?? complementoExistente.doseKgHa, r.rec);
      } else if (prod && (permiteUsoSeparado || !complementoExistente)) {
        complementos.push({
          produto: { id: prod.id, nome: prod.nome },
          doseKgHa: doseExtra,
          dose_calculada_kg_ha: null,
          dose_utilizada_kg_ha: doseExtra,
          dose_ajustada_manualmente: true,
          nutriente_alvo: data.nutriente_alvo || data.nutKey || key || 'dose_manual',
          nutKey: data.nutKey || key,
          linhaId: key,
          nutrientes: nutrientesDaDose(prod, doseExtra, r.rec),
          isManualExtra: true,
          isManualLivre: Boolean(data?.isManualLivre || String(key).startsWith('manual-')),
          usoSeparado: permiteUsoSeparado,
          origemUso: 'Produto escolhido manualmente',
        });
      }
    });

    if (produto || complementos.length > 0 || produtosOcultosTalhao.length > 0) {
      mapa[r.talhao.id] = {
        produto,
        doseKgHa,
        dose_calculada_kg_ha: linhaPrincipal?.dose_calculada_kg_ha ?? doseKgHa,
        dose_utilizada_kg_ha: linhaPrincipal?.dose_utilizada_kg_ha ?? doseKgHa,
        dose_ajustada_manualmente: Boolean(linhaPrincipal?.dose_ajustada_manualmente),
        nutriente_alvo: linhaPrincipal?.nutriente_alvo || 'n_pct',
        linhaId: linhaPrincipal?.linhaId,
        complementos,
        trocas,
        marcados: Object.keys(marcados).length > 0 ? marcados : criarMarcacoesPadraoFn(r.rec, elementos),
        produtos_ocultos: produtosOcultosTalhao,
      };
    }
  });

  return mapa;
}

export function combinarCatalogoInsumos(formulados = [], fontes = []) {
  return [
    ...listaSeguraAdubacao2(formulados).map(produto => ({ ...produto, _tipo: 'formulado', _origemLabel: 'Fertilizante formulado' })),
    ...listaSeguraAdubacao2(fontes).map(produto => ({ ...produto, _tipo: 'fonte', _origemLabel: 'Fonte simples' })),
  ].filter(produtoValidoAdubacao2);
}

export function sanitizarPayloadInsumo(tipo, dados = {}) {
  const permitidos = new Set(tipo === 'fonte' ? CAMPOS_FONTE_SIMPLES : CAMPOS_FERTILIZANTE_FORMULADO);
  const payload = {};
  Object.entries(objetoSeguroAdubacao2(dados)).forEach(([key, value]) => {
    if (!permitidos.has(key)) return;
    if (value === undefined) return;
    payload[key] = value;
  });
  return payload;
}

export function contarUsoProdutoPlanejamento(registros = [], produtoId) {
  if (!produtoId || produtoId === '0') return 0;
  return listaSeguraAdubacao2(registros).filter(registro => {
    const det = registro?.detalhamento || {};
    if (det.produtoSugerido?.id === produtoId) return true;
    return normalizarComplementosAdubacao2(det.complementos).some(comp => comp?.produto?.id === produtoId);
  }).length;
}
