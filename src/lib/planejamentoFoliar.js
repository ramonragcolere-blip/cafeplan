import { GRUPOS_PLANEJAMENTO } from './gruposFoliares.js';

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[—–]/g, '-')
    .trim()
    .toLowerCase();
}

const GRUPOS_PRIORITARIOS = new Set(GRUPOS_PLANEJAMENTO.map(normalizar));

export function filtrarInsumosPlanejamentoFoliar(insumos, busca = '') {
  const q = normalizar(busca);
  return (insumos || [])
    .filter(produto => produto?.id && produto.ativo !== false)
    .filter(produto => {
      if (!q) return true;
      return [produto.nome, produto.grupo, produto.fornecedor, produto.ingrediente_ativo]
        .some(valor => normalizar(valor).includes(q));
    })
    .sort((a, b) => {
      const aPrioritario = GRUPOS_PRIORITARIOS.has(normalizar(a.grupo));
      const bPrioritario = GRUPOS_PRIORITARIOS.has(normalizar(b.grupo));
      if (aPrioritario !== bPrioritario) return aPrioritario ? -1 : 1;
      return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });
}

export function combinarInsumosFoliares(formulados, fontesSimples) {
  const vistos = new Set();
  const resultado = [];

  for (const produto of formulados || []) {
    if (!produto?.id || vistos.has(produto.id)) continue;
    vistos.add(produto.id);
    resultado.push({ ...produto, _origem: 'formulado' });
  }

  for (const fonte of fontesSimples || []) {
    if (!fonte?.id || vistos.has(fonte.id)) continue;
    vistos.add(fonte.id);
    resultado.push({
      ...fonte,
      grupo: fonte.grupo || (fonte.nutriente_principal ? `Fonte de ${fonte.nutriente_principal}` : 'Fonte Simples'),
      unidade_aplicacao: fonte.unidade_aplicacao || fonte.unidade_padrao || '',
      _origem: 'fonte_simples',
    });
  }

  return resultado;
}

export function aplicacaoFoliarIncluiTalhao(aplicacao, talhaoId) {
  if (!aplicacao || !talhaoId) return false;
  if (aplicacao.talhao_id === talhaoId) return true;
  return Array.isArray(aplicacao.talhao_ids) && aplicacao.talhao_ids.includes(talhaoId);
}

const CAMPOS_CRONOGRAMA = [
  'codigo_produtor', 'safra', 'titulo', 'objetivos', 'talhao_ids', 'produtos',
  'status', 'equipamento', 'volume_calda_ha', 'observacoes', 'meses',
];

export function limparPayloadCronogramaFoliar(aplicacao) {
  const limpo = {};
  CAMPOS_CRONOGRAMA.forEach(campo => {
    if (aplicacao?.[campo] !== undefined) limpo[campo] = aplicacao[campo];
  });
  return limpo;
}
