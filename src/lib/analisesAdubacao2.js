export const CAMPOS_ANALISE_ADUBACAO2 = [
  { key: 'ph', label: 'pH', unidade: '' },
  { key: 'materia_organica', label: 'Matéria orgânica', unidade: 'dag/kg' },
  { key: 'fosforo', label: 'Fósforo', unidade: 'mg/dm³' },
  { key: 'potassio', label: 'Potássio', unidade: 'mg/dm³' },
  { key: 'calcio', label: 'Cálcio', unidade: 'cmolc/dm³' },
  { key: 'magnesio', label: 'Magnésio', unidade: 'cmolc/dm³' },
  { key: 'aluminio', label: 'Alumínio', unidade: 'cmolc/dm³' },
  { key: 'h_al', label: 'H+Al', unidade: 'cmolc/dm³' },
  { key: 'soma_bases', label: 'Soma de bases', unidade: 'cmolc/dm³' },
  { key: 'sb', label: 'Soma de bases', unidade: 'cmolc/dm³' },
  { key: 'ctc', label: 'CTC', unidade: 'cmolc/dm³' },
  { key: 'saturacao_bases', label: 'Saturação por bases', unidade: '%' },
  { key: 'saturacao_aluminio', label: 'Saturação por alumínio', unidade: '%' },
  { key: 'boro', label: 'Boro', unidade: 'mg/dm³' },
  { key: 'zinco', label: 'Zinco', unidade: 'mg/dm³' },
  { key: 'cobre', label: 'Cobre', unidade: 'mg/dm³' },
  { key: 'manganes', label: 'Manganês', unidade: 'mg/dm³' },
  { key: 'ferro', label: 'Ferro', unidade: 'mg/dm³' },
  { key: 'enxofre', label: 'Enxofre', unidade: 'mg/dm³' },
  { key: 'data_analise', label: 'Data da análise', unidade: '' },
  { key: 'observacoes', label: 'Observações', unidade: '' },
];

const CAMPOS_SISTEMA = new Set([
  'id',
  'created_date',
  'updated_date',
  'createdAt',
  'updatedAt',
  'created_by',
  'updated_by',
  'codigo_produtor',
  'talhao_id',
  'talhao_nome',
  'safra',
]);

const DEFINICOES_POR_CHAVE = new Map(CAMPOS_ANALISE_ADUBACAO2.map(campo => [campo.key, campo]));

function temValorExibivel(valor) {
  if (valor == null) return false;
  if (typeof valor === 'string') return valor.trim() !== '';
  if (typeof valor === 'number') return Number.isFinite(valor);
  return true;
}

function formatarChaveCampo(chave) {
  return String(chave || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, letra => letra.toUpperCase());
}

function valorParaTexto(valor) {
  if (typeof valor === 'number') return valor.toLocaleString('pt-BR');
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  return String(valor);
}

export function montarCamposAnaliseAdubacao2(analise) {
  if (!analise) return [];
  const usados = new Set();
  const campos = [];

  CAMPOS_ANALISE_ADUBACAO2.forEach(definicao => {
    const valor = analise[definicao.key];
    if (!temValorExibivel(valor)) return;
    usados.add(definicao.key);
    campos.push({ ...definicao, valor: valorParaTexto(valor) });
  });

  Object.entries(analise).forEach(([key, valor]) => {
    if (usados.has(key) || CAMPOS_SISTEMA.has(key) || DEFINICOES_POR_CHAVE.has(key)) return;
    if (!temValorExibivel(valor)) return;
    campos.push({ key, label: formatarChaveCampo(key), unidade: '', valor: valorParaTexto(valor) });
  });

  return campos;
}

function pertenceAoContexto(analise, { talhaoId, safra, codigoProdutor }) {
  if (!analise || analise.talhao_id !== talhaoId) return false;
  if (safra && analise.safra && analise.safra !== safra) return false;
  if (codigoProdutor && analise.codigo_produtor && analise.codigo_produtor !== codigoProdutor) return false;
  return true;
}

function valorMapeadoPertenceAoContexto(analise, { talhaoId, safra, codigoProdutor }) {
  if (!analise) return false;
  if (analise.talhao_id && analise.talhao_id !== talhaoId) return false;
  if (safra && analise.safra && analise.safra !== safra) return false;
  if (codigoProdutor && analise.codigo_produtor && analise.codigo_produtor !== codigoProdutor) return false;
  return true;
}

export function selecionarAnalisesTalhaoAdubacao2({ talhao, safra, codigoProdutor, analises = [], analises2040PorTalhao = {} }) {
  const talhaoId = talhao?.id;
  const contexto = { talhaoId, safra, codigoProdutor };
  const analise020 = (analises || []).find(analise => pertenceAoContexto(analise, contexto)) || null;
  const analise2040 = valorMapeadoPertenceAoContexto(analises2040PorTalhao?.[talhaoId], contexto)
    ? analises2040PorTalhao[talhaoId]
    : null;

  return { analise020, analise2040 };
}

export function prepararModalAnalisesAdubacao2({ produtor, talhao, safra, analises = [], analises2040PorTalhao = {} }) {
  const { analise020, analise2040 } = selecionarAnalisesTalhaoAdubacao2({
    talhao,
    safra,
    codigoProdutor: produtor?.codigo,
    analises,
    analises2040PorTalhao,
  });

  return {
    produtorNome: produtor?.nome || '—',
    talhaoNome: talhao?.nome || '—',
    safra: safra || '—',
    abas: [
      { id: '0-20', label: '0–20 cm', profundidade: '0–20 cm', campos: montarCamposAnaliseAdubacao2(analise020) },
      { id: '20-40', label: '20–40 cm', profundidade: '20–40 cm', campos: montarCamposAnaliseAdubacao2(analise2040) },
    ],
  };
}
