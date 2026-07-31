export const CAMPOS_ANALISE_020 = [
  'ph',
  'materia_organica',
  'fosforo',
  'potassio',
  'calcio',
  'magnesio',
  'enxofre',
  'boro',
  'zinco',
  'cobre',
  'manganes',
  'ferro',
  'ctc',
  'saturacao_bases',
  'data_analise',
];

export const CAMPOS_ANALISE_2040 = [
  'ph',
  'materia_organica',
  'fosforo',
  'potassio',
  'calcio',
  'magnesio',
  'aluminio',
  'h_al',
  'sb',
  'enxofre',
  'boro',
  'zinco',
  'cobre',
  'manganes',
  'ferro',
  'ctc',
  'saturacao_bases',
  'data_analise',
];

const CAMPOS_NUMERICOS = new Set([
  'ph',
  'materia_organica',
  'fosforo',
  'potassio',
  'calcio',
  'magnesio',
  'aluminio',
  'h_al',
  'sb',
  'enxofre',
  'boro',
  'zinco',
  'cobre',
  'manganes',
  'ferro',
  'ctc',
  'saturacao_bases',
]);

export const UNIDADES_INTERNAS_ANALISE_SOLO = {
  materia_organica: 'g/dm3',
  fosforo: 'mg/dm3',
  potassio: 'mg/dm3',
  calcio: 'cmolc/dm3',
  magnesio: 'cmolc/dm3',
  aluminio: 'cmolc/dm3',
  h_al: 'cmolc/dm3',
  sb: 'cmolc/dm3',
  soma_bases: 'cmolc/dm3',
  ctc: 'cmolc/dm3',
  enxofre: 'mg/dm3',
  boro: 'mg/dm3',
  zinco: 'mg/dm3',
  cobre: 'mg/dm3',
  manganes: 'mg/dm3',
  ferro: 'mg/dm3',
  saturacao_bases: '%',
};

export const UNIDADES_ORIGINAIS_ANALISE_SOLO = [
  'mmolc/dm3',
  'cmolc/dm3',
  'mg/dm3',
  'g/dm3',
  '%',
];

const CAMPOS_EXIGEM_UNIDADE = new Set(Object.keys(UNIDADES_INTERNAS_ANALISE_SOLO));
const CAMPOS_BASES_CTC = new Set(['calcio', 'magnesio', 'aluminio', 'h_al', 'sb', 'soma_bases', 'ctc']);
const ALIASES_CAMPOS = {
  k: 'potassio',
  potassio: 'potassio',
  potássio: 'potassio',
  ca: 'calcio',
  calcio: 'calcio',
  cálcio: 'calcio',
  mg: 'magnesio',
  magnesio: 'magnesio',
  magnésio: 'magnesio',
  al: 'aluminio',
  aluminio: 'aluminio',
  alumínio: 'aluminio',
  'h+al': 'h_al',
  hal: 'h_al',
  'h al': 'h_al',
  's.b.': 'sb',
  sb: 'sb',
  'soma de bases': 'sb',
  ctc: 'ctc',
  'c.t.c.': 'ctc',
  p: 'fosforo',
  fosforo: 'fosforo',
  fósforo: 'fosforo',
  s: 'enxofre',
  enxofre: 'enxofre',
  b: 'boro',
  boro: 'boro',
  zn: 'zinco',
  zinco: 'zinco',
  cu: 'cobre',
  cobre: 'cobre',
  mn: 'manganes',
  manganes: 'manganes',
  manganês: 'manganes',
  fe: 'ferro',
  ferro: 'ferro',
  mo: 'materia_organica',
  'm.o.': 'materia_organica',
  'materia organica': 'materia_organica',
  'matéria orgânica': 'materia_organica',
  v: 'saturacao_bases',
  'v%': 'saturacao_bases',
};

export function getCamposAnaliseSolo(profundidade = '0-20') {
  return profundidade === '20-40' ? CAMPOS_ANALISE_2040 : CAMPOS_ANALISE_020;
}

export function normalizarNumeroAnaliseSolo(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : undefined;
  if (typeof valor !== 'string') return undefined;

  const trimmed = valor.trim();
  if (!trimmed || trimmed === '-') return undefined;

  const normalized = trimmed
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizarDataAnaliseSolo(valor) {
  if (typeof valor !== 'string') return undefined;
  const trimmed = valor.trim();
  if (!trimmed) return undefined;

  const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

export function normalizarNomeLaboratorioAnaliseSolo(laboratorio = 'OUTRO') {
  const texto = String(laboratorio || 'OUTRO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (texto.includes('COOXUPE') || texto.includes('COOPERATIVAREGIONALDECAFEICULTORES')) return 'COOXUPE';
  if (texto.includes('LABVICOSA') || texto.includes('LABSOLOSVICOSA') || texto.includes('VICOSA')) return 'LAB_VICOSA';
  return texto || 'OUTRO';
}

export function normalizarUnidadeAnaliseSolo(unidade) {
  if (unidade == null) return '';
  const texto = String(unidade)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/³/g, '3')
    .replace(/[·•]/g, '')
    .replace(/_/g, '')
    .replace(/\s+/g, '')
    .trim();

  if (texto === '%') return '%';
  if (/^mmolc?\/?dm3$/.test(texto) || /^mmolc?dm3$/.test(texto)) return 'mmolc/dm3';
  if (/^cmolc?\/?dm3$/.test(texto) || /^cmolc?dm3$/.test(texto)) return 'cmolc/dm3';
  if (/^mg\/?dm3$/.test(texto) || /^mgdm3$/.test(texto)) return 'mg/dm3';
  if (/^g\/?dm3$/.test(texto) || /^gdm3$/.test(texto)) return 'g/dm3';
  if (/^dag\/?kg$/.test(texto) || /^dagkg$/.test(texto)) return 'dag/kg';
  return '';
}

export function formatarUnidadeAnaliseSolo(unidade) {
  const canonica = normalizarUnidadeAnaliseSolo(unidade) || unidade || '';
  return String(canonica).replace(/dm3/g, 'dm³');
}

function normalizarTextoBusca(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extrairUnidadesDoTextoCompleto(textoCompleto = '') {
  const texto = normalizarTextoBusca(textoCompleto).replace(/³/g, '3');
  const unidades = {};
  Object.entries(ALIASES_CAMPOS).forEach(([alias, campo]) => {
    if (unidades[campo]) return;
    const unidade = '(mmol\\s*_?\\s*c\\s*/\\s*dm3|cmol\\s*_?\\s*c\\s*/\\s*dm3|mg\\s*/\\s*dm3|g\\s*/\\s*dm3|%)';
    const regex = new RegExp(`(?:^|[^a-z0-9])${escaparRegex(alias)}(?:[^a-z0-9]+[a-z0-9.+-]+){0,4}[^a-z0-9%]+${unidade}`, 'i');
    const match = texto.match(regex);
    const canonica = normalizarUnidadeAnaliseSolo(match?.[1]);
    if (canonica) unidades[campo] = canonica;
  });
  return unidades;
}

function unidadesFallbackLaboratorio(laboratorio) {
  const lab = normalizarNomeLaboratorioAnaliseSolo(laboratorio);
  if (lab !== 'COOXUPE') return {};
  return {
    potassio: 'mmolc/dm3',
    calcio: 'mmolc/dm3',
    magnesio: 'mmolc/dm3',
    aluminio: 'mmolc/dm3',
    h_al: 'mmolc/dm3',
    sb: 'mmolc/dm3',
    soma_bases: 'mmolc/dm3',
    ctc: 'mmolc/dm3',
    fosforo: 'mg/dm3',
    enxofre: 'mg/dm3',
    boro: 'mg/dm3',
    zinco: 'mg/dm3',
    cobre: 'mg/dm3',
    manganes: 'mg/dm3',
    ferro: 'mg/dm3',
    materia_organica: 'g/dm3',
    saturacao_bases: '%',
  };
}

function obterUnidadeOriginal({ campo, unidadesLinha = {}, unidadesTexto = {}, fallbackLab = {} }) {
  return normalizarUnidadeAnaliseSolo(unidadesLinha[campo])
    || normalizarUnidadeAnaliseSolo(unidadesTexto[campo])
    || normalizarUnidadeAnaliseSolo(fallbackLab[campo])
    || '';
}

function arredondarAnaliseSolo(valor) {
  return +Number(valor).toFixed(3);
}

export function converterValorAnaliseSolo({ campo, valorOriginal, unidadeOriginal, unidadeDestino }) {
  const numero = normalizarNumeroAnaliseSolo(valorOriginal);
  const origem = normalizarUnidadeAnaliseSolo(unidadeOriginal);
  const destino = normalizarUnidadeAnaliseSolo(unidadeDestino);

  if (numero === undefined || !origem || !destino) {
    return { valor: numero, convertido: false, origem, destino, unidadeDesconhecida: !origem && CAMPOS_EXIGEM_UNIDADE.has(campo) };
  }

  if (origem === destino) {
    return { valor: numero, convertido: false, origem, destino, unidadeDesconhecida: false };
  }

  if (campo === 'potassio') {
    if (origem === 'mmolc/dm3' && destino === 'mg/dm3') {
      return { valor: +(numero * 39.1).toFixed(1), convertido: true, origem, destino, unidadeDesconhecida: false };
    }
    if (origem === 'cmolc/dm3' && destino === 'mg/dm3') {
      return { valor: +(numero * 391).toFixed(1), convertido: true, origem, destino, unidadeDesconhecida: false };
    }
  }

  if (CAMPOS_BASES_CTC.has(campo)) {
    if (origem === 'mmolc/dm3' && destino === 'cmolc/dm3') {
      return { valor: arredondarAnaliseSolo(numero / 10), convertido: true, origem, destino, unidadeDesconhecida: false };
    }
    if (origem === 'cmolc/dm3' && destino === 'cmolc/dm3') {
      return { valor: numero, convertido: false, origem, destino, unidadeDesconhecida: false };
    }
  }

  if (
    (['fosforo', 'enxofre', 'boro', 'zinco', 'cobre', 'manganes', 'ferro'].includes(campo) && origem === 'mg/dm3' && destino === 'mg/dm3')
    || (campo === 'materia_organica' && origem === 'g/dm3' && destino === 'g/dm3')
    || (campo === 'saturacao_bases' && origem === '%' && destino === '%')
  ) {
    return { valor: numero, convertido: false, origem, destino, unidadeDesconhecida: false };
  }

  return { valor: numero, convertido: false, origem, destino, unidadeDesconhecida: true };
}

export function desembrulharRespostaAnaliseSolo(resposta) {
  let parsed = resposta;
  if (typeof resposta === 'string') {
    const match = resposta.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return { laboratorio: 'OUTRO', dados: {} };
  }

  const base = parsed.dados && typeof parsed.dados === 'object' ? parsed.dados : parsed;
  const laboratorio = normalizarNomeLaboratorioAnaliseSolo(parsed.laboratorio || base.laboratorio || 'OUTRO');
  const unidades = parsed.unidades && typeof parsed.unidades === 'object'
    ? parsed.unidades
    : (base.unidades && typeof base.unidades === 'object' ? base.unidades : {});
  const textoCompleto = parsed.texto_completo || parsed.textoCompleto || base.texto_completo || base.textoCompleto || '';
  const { laboratorio: _laboratorio, dados: _dados, unidades: _unidades, texto_completo: _textoCompleto, textoCompleto: _textoCompletoCamel, ...planos } = base;
  const resultado = { laboratorio, dados: planos };
  if (Object.keys(unidades).length > 0) resultado.unidades = unidades;
  if (textoCompleto) resultado.textoCompleto = textoCompleto;
  return resultado;
}

/**
 * @param {Record<string, unknown>} dados
 * @param {string} laboratorio
 */
export function converterUnidadesAnaliseSolo(dados = {}, laboratorio = 'OUTRO', opcoes = {}) {
  const convertido = { ...dados };
  const unidadesFinais = {};
  const revisoesUnidade = [];
  const pendenciasUnidade = [];
  const unidadesLinha = opcoes.unidades || {};
  const unidadesTexto = extrairUnidadesDoTextoCompleto(opcoes.textoCompleto || '');
  const fallbackLab = unidadesFallbackLaboratorio(laboratorio);

  Object.entries(dados || {}).forEach(([campo, valorOriginal]) => {
    if (!CAMPOS_NUMERICOS.has(campo)) return;
    const unidadeDestino = UNIDADES_INTERNAS_ANALISE_SOLO[campo];
    if (!unidadeDestino) return;

    const unidadeOriginal = obterUnidadeOriginal({ campo, unidadesLinha, unidadesTexto, fallbackLab });
    const resultado = converterValorAnaliseSolo({ campo, valorOriginal, unidadeOriginal, unidadeDestino });

    if (resultado.valor !== undefined) convertido[campo] = resultado.valor;
    if (resultado.origem && !resultado.unidadeDesconhecida) unidadesFinais[campo] = resultado.destino;

    if (resultado.convertido) {
      revisoesUnidade.push({
        campo,
        valorOriginal: normalizarNumeroAnaliseSolo(valorOriginal),
        unidadeOriginal: resultado.origem,
        valorConvertido: resultado.valor,
        unidadeDestino: resultado.destino,
      });
    }

    if (resultado.unidadeDesconhecida) {
      pendenciasUnidade.push({
        campo,
        valorOriginal: normalizarNumeroAnaliseSolo(valorOriginal),
        unidadeOriginal: unidadeOriginal || '',
        unidadeDestino,
      });
    }
  });

  return { dados: convertido, unidades: unidadesFinais, revisoesUnidade, pendenciasUnidade };
}

export function interpretarRespostaAnaliseSolo(resposta, profundidade = '0-20') {
  const { laboratorio, dados, unidades, textoCompleto } = desembrulharRespostaAnaliseSolo(resposta);
  const permitidos = new Set([...getCamposAnaliseSolo(profundidade), 'laboratorio']);
  /** @type {Record<string, unknown>} */
  const normalizados = {};

  Object.entries(dados || {}).forEach(([key, value]) => {
    if (!permitidos.has(key) || value == null) return;
    if (CAMPOS_NUMERICOS.has(key)) {
      const numero = normalizarNumeroAnaliseSolo(value);
      if (numero !== undefined) normalizados[key] = numero;
      return;
    }
    if (key === 'data_analise') {
      const data = normalizarDataAnaliseSolo(value);
      if (data) normalizados[key] = data;
      return;
    }
    normalizados[key] = value;
  });

  const conversao = converterUnidadesAnaliseSolo(normalizados, laboratorio, { unidades, textoCompleto });
  return {
    laboratorio,
    dados: conversao.dados,
    unidades: conversao.unidades,
    revisoesUnidade: conversao.revisoesUnidade,
    pendenciasUnidade: conversao.pendenciasUnidade,
  };
}

export function temPendenciasUnidadeAnaliseSolo(item = {}) {
  return Array.isArray(item.pendenciasUnidade) && item.pendenciasUnidade.length > 0;
}

export function gerarChaveArquivoAnaliseSolo(file) {
  if (!file) return '';
  return [
    file.name || '',
    file.size ?? '',
    file.lastModified ?? '',
  ].join('|');
}

export function validarCompletudeExtracao(dados = {}, profundidade = '0-20') {
  const campos = getCamposAnaliseSolo(profundidade);
  const ausentes = campos.filter((campo) => dados[campo] == null || dados[campo] === '');
  return {
    completo: ausentes.length === 0,
    camposAusentes: ausentes,
  };
}

export function temPayloadAnaliseSolo(dados = {}, profundidade = '0-20') {
  return getCamposAnaliseSolo(profundidade).some((campo) => dados[campo] != null && dados[campo] !== '');
}

export function classificarExtracaoAnaliseSolo(dados = {}, profundidade = '0-20') {
  const validacao = validarCompletudeExtracao(dados, profundidade);
  if (!temPayloadAnaliseSolo(dados, profundidade)) {
    return {
      status: 'erro',
      completo: false,
      parcial: false,
      temDados: false,
      camposAusentes: validacao.camposAusentes,
    };
  }

  return {
    status: validacao.completo ? 'ok' : 'parcial',
    completo: validacao.completo,
    parcial: !validacao.completo,
    temDados: true,
    camposAusentes: validacao.camposAusentes,
  };
}

export function resumirResultadosImportacaoAnaliseSolo(resultados = []) {
  const completas = resultados.filter((resultado) => resultado.status === 'ok').length;
  const parciais = resultados.filter((resultado) => resultado.status === 'parcial').length;
  const erros = resultados.filter((resultado) => resultado.status === 'erro').length;
  return {
    completas,
    parciais,
    erros,
    totalSalvas: completas + parciais,
  };
}

export function prepararDadosParaRevisao({ pares = [], cacheExtracao = {}, profundidade = '0-20', dadosExistentes = {} }) {
  return pares.map((par) => {
    const chaveArquivo = gerarChaveArquivoAnaliseSolo(par.arquivo);
    const extraido = par.arquivo ? cacheExtracao[chaveArquivo] : null;
    const dados = par.arquivo ? { ...(extraido?.dados || {}) } : { ...(dadosExistentes?.[par.talhao.id] || {}) };
    return {
      talhao: par.talhao,
      arquivo: par.arquivo,
      arquivoNome: par.arquivo?.name || '',
      chaveArquivo,
      dados,
      laboratorio: extraido?.laboratorio || 'OUTRO',
      unidades: extraido?.unidades || {},
      revisoesUnidade: extraido?.revisoesUnidade || [],
      pendenciasUnidade: extraido?.pendenciasUnidade || [],
      validacao: validarCompletudeExtracao(dados, profundidade),
      erroExtracao: extraido?.erro || null,
    };
  });
}

export function criarControladorGravacaoAnalise({ buscarExistentes, criar, atualizar }) {
  const idsPorChave = new Map();
  const filasPorChave = new Map();

  const salvar = (payload) => {
    const chave = `${payload.talhao_id}|${payload.safra}`;
    const anterior = filasPorChave.get(chave) || Promise.resolve();
    const tarefa = anterior.catch(() => undefined).then(async () => {
      let idExistente = idsPorChave.get(chave);
      if (!idExistente) {
        const existentes = await buscarExistentes(payload);
        const existente = Array.isArray(existentes) ? existentes.find((item) => item?.id) : null;
        idExistente = existente?.id || null;
        if (idExistente) idsPorChave.set(chave, idExistente);
      }

      if (idExistente) return atualizar(idExistente, payload);

      const criado = await criar(payload);
      if (criado?.id) idsPorChave.set(chave, criado.id);
      return criado;
    });

    const filaFinal = tarefa.finally(() => {
      if (filasPorChave.get(chave) === filaFinal) filasPorChave.delete(chave);
    });
    filasPorChave.set(chave, filaFinal);
    return filaFinal;
  };

  salvar.registrarExistentes = (registros = []) => {
    registros.forEach((registro) => {
      if (!registro?.id || !registro?.talhao_id || !registro?.safra) return;
      idsPorChave.set(`${registro.talhao_id}|${registro.safra}`, registro.id);
    });
  };

  return salvar;
}

export function getErrorMessageAnaliseSolo(error) {
  return error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message
    || String(error || 'Erro desconhecido');
}
