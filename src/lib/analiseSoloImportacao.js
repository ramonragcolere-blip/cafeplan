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
  const laboratorio = parsed.laboratorio || base.laboratorio || 'OUTRO';
  const { laboratorio: _laboratorio, dados: _dados, ...planos } = base;
  return { laboratorio, dados: planos };
}

/**
 * @param {Record<string, unknown>} dados
 * @param {string} laboratorio
 */
export function converterUnidadesAnaliseSolo(dados = {}, laboratorio = 'OUTRO') {
  const convertido = { ...dados };
  const n = (value) => {
    const numero = normalizarNumeroAnaliseSolo(value);
    return numero === undefined ? null : numero;
  };
  const getNumero = (key) => n(convertido[key]);

  if (laboratorio === 'COOXUPE') {
    const potassio = getNumero('potassio');
    if (potassio != null) {
      convertido.potassio = +(potassio * 39.1).toFixed(1);
    }
    ['calcio', 'magnesio', 'aluminio', 'h_al', 'sb', 'ctc'].forEach((key) => {
      const valor = getNumero(key);
      if (valor != null) convertido[key] = +(valor / 10).toFixed(3);
    });
  } else if (laboratorio === 'LAB_VICOSA') {
    const potassio = getNumero('potassio');
    if (potassio != null && potassio < 3) {
      convertido.potassio = +(potassio * 391).toFixed(1);
    }
  }

  return convertido;
}

export function interpretarRespostaAnaliseSolo(resposta, profundidade = '0-20') {
  const { laboratorio, dados } = desembrulharRespostaAnaliseSolo(resposta);
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

  return {
    laboratorio,
    dados: converterUnidadesAnaliseSolo(normalizados, laboratorio),
  };
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
