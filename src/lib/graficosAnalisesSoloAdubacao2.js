import { calcB, classificarCu, classificarK, classificarMn, classificarP, classificarZn } from './tabelasNutricionais.js';

export const PROFUNDIDADES_ANALISE_SOLO = ['0-20', '20-40'];

export const NUTRIENTES_GRAFICOS_SOLO = [
  { key: 'ph', label: 'pH', unidade: '' },
  { key: 'fosforo', label: 'P', unidade: 'mg/dm³' },
  { key: 'potassio', label: 'K', unidade: 'mg/dm³' },
  { key: 'calcio', label: 'Ca', unidade: 'cmolc/dm³' },
  { key: 'magnesio', label: 'Mg', unidade: 'cmolc/dm³' },
  { key: 'aluminio', label: 'Al', unidade: 'cmolc/dm³' },
  { key: 'materia_organica', label: 'MO', unidade: 'dag/kg' },
  { key: 'boro', label: 'B', unidade: 'mg/dm³' },
  { key: 'zinco', label: 'Zn', unidade: 'mg/dm³' },
  { key: 'cobre', label: 'Cu', unidade: 'mg/dm³' },
  { key: 'manganes', label: 'Mn', unidade: 'mg/dm³' },
  { key: 'enxofre', label: 'S', unidade: 'mg/dm³' },
  { key: 'ctc', label: 'CTC', unidade: 'cmolc/dm³' },
  { key: 'saturacao_bases', label: 'V%', unidade: '%' },
  { key: 'saturacao_aluminio', label: 'm%', unidade: '%' },
];

export const NUTRIENTES_PADRAO_TODOS_TALHOES = ['ph', 'fosforo', 'potassio', 'calcio', 'magnesio', 'boro', 'zinco'];

const CORES_CLASSIFICACAO = {
  baixo: '#dc2626',
  adequado: '#16a34a',
  alto: '#f59e0b',
  'muito alto': '#2563eb',
  'sem referência': '#6b7280',
};

const CENTROS_ADEQUACAO = {
  ph: 6,
  fosforo: 15,
  potassio: 130,
  calcio: 3.75,
  magnesio: 1.25,
  aluminio: 0.3,
  materia_organica: 3,
  boro: 1,
  zinco: 3.25,
  cobre: 1.75,
  manganes: 17.5,
  enxofre: 12.5,
  ctc: 10,
  saturacao_bases: 60,
  saturacao_aluminio: 30,
};

const CORES_SERIES = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#be185d', '#4b5563'];

function numero(valor) {
  if (valor == null || valor === '') return null;
  const n = Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function arredondar(valor, casas = 2) {
  const n = numero(valor);
  if (n == null) return null;
  const fator = 10 ** casas;
  return Math.round(n * fator) / fator;
}

function clamp(valor, min, max) {
  return Math.max(min, Math.min(max, valor));
}

function escaparSvg(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatarValor(valor, unidade) {
  const n = numero(valor);
  if (n == null) return '—';
  const casas = Math.abs(n) >= 10 ? 1 : 2;
  const txt = n.toLocaleString('pt-BR', { maximumFractionDigits: casas });
  return unidade ? `${txt} ${unidade}` : txt;
}

function faixa(label) {
  return { adequado: label };
}

function mapClasse(classe) {
  const normalizada = String(classe || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/baixo/.test(normalizada)) return 'baixo';
  if (/alto.inadequado|otimo|alto/.test(normalizada)) return 'muito alto';
  if (/medio|bom|adequado/.test(normalizada)) return 'adequado';
  return 'sem referência';
}

function classificarPorFaixas(valor, faixas) {
  const v = numero(valor);
  if (v == null) return { classificacao: 'sem referência', nivelAdequado: 'Sem referência' };
  for (const faixaItem of faixas) {
    if (v >= faixaItem.min && v <= faixaItem.max) {
      return { classificacao: faixaItem.classificacao, nivelAdequado: faixaItem.nivelAdequado };
    }
  }
  return { classificacao: 'sem referência', nivelAdequado: 'Sem referência' };
}

export function classificarNutrienteSoloAdubacao2(key, valor) {
  const info = NUTRIENTES_GRAFICOS_SOLO.find(item => item.key === key) || { key, label: key, unidade: '' };
  const v = numero(valor);
  let classificacao = 'sem referência';
  let nivelAdequado = 'Sem referência';

  if (v != null) {
    if (key === 'fosforo') {
      const c = classificarP(v);
      classificacao = mapClasse(c?.classe);
      nivelAdequado = '10 a 20 mg/dm³';
    } else if (key === 'potassio') {
      const c = classificarK(v);
      classificacao = c?.classe === 'Alto' ? 'muito alto' : mapClasse(c?.classe);
      nivelAdequado = '60 a 200 mg/dm³';
    } else if (key === 'boro') {
      const c = calcB(v);
      classificacao = mapClasse(c?.classe);
      nivelAdequado = '0,5 a 1,5 mg/dm³';
    } else if (key === 'zinco') {
      const c = classificarZn(v);
      classificacao = mapClasse(c?.classe);
      nivelAdequado = '1,5 a 5,0 mg/dm³';
    } else if (key === 'cobre') {
      const c = classificarCu(v);
      classificacao = mapClasse(c?.classe);
      nivelAdequado = '0,5 a 3,0 mg/dm³';
    } else if (key === 'manganes') {
      const c = classificarMn(v);
      classificacao = mapClasse(c?.classe);
      nivelAdequado = '5 a 30 mg/dm³';
    } else {
      ({ classificacao, nivelAdequado } = classificarPorFaixas(v, {
        ph: [
          { min: -Infinity, max: 5.49, classificacao: 'baixo', nivelAdequado: '5,5 a 6,5' },
          { min: 5.5, max: 6.5, classificacao: 'adequado', nivelAdequado: '5,5 a 6,5' },
          { min: 6.51, max: 7, classificacao: 'alto', nivelAdequado: '5,5 a 6,5' },
          { min: 7.01, max: Infinity, classificacao: 'muito alto', nivelAdequado: '5,5 a 6,5' },
        ],
        calcio: [
          { min: -Infinity, max: 2.99, classificacao: 'baixo', nivelAdequado: '3,0 a 4,5 cmolc/dm³' },
          { min: 3, max: 4.5, classificacao: 'adequado', nivelAdequado: '3,0 a 4,5 cmolc/dm³' },
          { min: 4.51, max: 6, classificacao: 'alto', nivelAdequado: '3,0 a 4,5 cmolc/dm³' },
          { min: 6.01, max: Infinity, classificacao: 'muito alto', nivelAdequado: '3,0 a 4,5 cmolc/dm³' },
        ],
        magnesio: [
          { min: -Infinity, max: 0.99, classificacao: 'baixo', nivelAdequado: '1,0 a 1,5 cmolc/dm³' },
          { min: 1, max: 1.5, classificacao: 'adequado', nivelAdequado: '1,0 a 1,5 cmolc/dm³' },
          { min: 1.51, max: 2, classificacao: 'alto', nivelAdequado: '1,0 a 1,5 cmolc/dm³' },
          { min: 2.01, max: Infinity, classificacao: 'muito alto', nivelAdequado: '1,0 a 1,5 cmolc/dm³' },
        ],
        aluminio: [
          { min: -Infinity, max: 0.3, classificacao: 'adequado', nivelAdequado: 'até 0,3 cmolc/dm³' },
          { min: 0.31, max: Infinity, classificacao: 'alto', nivelAdequado: 'até 0,3 cmolc/dm³' },
        ],
        materia_organica: [
          { min: -Infinity, max: 1.99, classificacao: 'baixo', nivelAdequado: '2,0 a 4,0 dag/kg' },
          { min: 2, max: 4, classificacao: 'adequado', nivelAdequado: '2,0 a 4,0 dag/kg' },
          { min: 4.01, max: 6, classificacao: 'alto', nivelAdequado: '2,0 a 4,0 dag/kg' },
          { min: 6.01, max: Infinity, classificacao: 'muito alto', nivelAdequado: '2,0 a 4,0 dag/kg' },
        ],
        enxofre: [
          { min: -Infinity, max: 9.99, classificacao: 'baixo', nivelAdequado: '10 a 15 mg/dm³' },
          { min: 10, max: 15, classificacao: 'adequado', nivelAdequado: '10 a 15 mg/dm³' },
          { min: 15.01, max: 20, classificacao: 'alto', nivelAdequado: '10 a 15 mg/dm³' },
          { min: 20.01, max: Infinity, classificacao: 'muito alto', nivelAdequado: '10 a 15 mg/dm³' },
        ],
        ctc: [
          { min: -Infinity, max: 7.99, classificacao: 'baixo', nivelAdequado: '8 a 12 cmolc/dm³' },
          { min: 8, max: 12, classificacao: 'adequado', nivelAdequado: '8 a 12 cmolc/dm³' },
          { min: 12.01, max: 18, classificacao: 'alto', nivelAdequado: '8 a 12 cmolc/dm³' },
          { min: 18.01, max: Infinity, classificacao: 'muito alto', nivelAdequado: '8 a 12 cmolc/dm³' },
        ],
        saturacao_bases: [
          { min: -Infinity, max: 49.99, classificacao: 'baixo', nivelAdequado: '50 a 70%' },
          { min: 50, max: 70, classificacao: 'adequado', nivelAdequado: '50 a 70%' },
          { min: 70.01, max: 85, classificacao: 'alto', nivelAdequado: '50 a 70%' },
          { min: 85.01, max: Infinity, classificacao: 'muito alto', nivelAdequado: '50 a 70%' },
        ],
        saturacao_aluminio: [
          { min: -Infinity, max: 30, classificacao: 'adequado', nivelAdequado: 'até 30%' },
          { min: 30.01, max: 50, classificacao: 'alto', nivelAdequado: 'até 30%' },
          { min: 50.01, max: Infinity, classificacao: 'muito alto', nivelAdequado: 'até 30%' },
        ],
      }[key] || []));
    }
  }

  return {
    key: info.key,
    label: info.label,
    unidade: info.unidade,
    valor: v,
    valorFormatado: formatarValor(v, info.unidade),
    nivelAdequado,
    classificacao,
    cor: CORES_CLASSIFICACAO[classificacao] || CORES_CLASSIFICACAO['sem referência'],
  };
}

function selecionarAnalisesPorProfundidade({ analises020 = [], analises2040 = [], profundidade = '0-20' }) {
  return profundidade === '20-40' ? analises2040 : analises020;
}

function encontrarAnalise({ analises020 = [], analises2040 = [], talhaoId, safra, profundidade = '0-20' }) {
  return selecionarAnalisesPorProfundidade({ analises020, analises2040, profundidade })
    .find(analise => analise?.talhao_id === talhaoId && analise?.safra === safra) || null;
}

export function montarAdequacaoSafraAtual({ analises020 = [], analises2040 = [], talhaoId, safra, profundidade = '0-20' } = {}) {
  const analise = encontrarAnalise({ analises020, analises2040, talhaoId, safra, profundidade });
  return NUTRIENTES_GRAFICOS_SOLO.map(info => classificarNutrienteSoloAdubacao2(info.key, analise?.[info.key]));
}

export function montarSerieEvolucaoAnalises({ analises020 = [], analises2040 = [], talhaoId, nutriente, profundidade = '0-20', safras = [] } = {}) {
  const info = NUTRIENTES_GRAFICOS_SOLO.find(item => item.key === nutriente) || NUTRIENTES_GRAFICOS_SOLO[0];
  const lista = selecionarAnalisesPorProfundidade({ analises020, analises2040, profundidade });
  const safrasOrdenadas = (safras.length > 0 ? safras : [...new Set(lista
    .filter(analise => analise?.talhao_id === talhaoId)
    .map(analise => analise.safra)
    .filter(Boolean))]).sort();
  const pontos = safrasOrdenadas.map(safra => {
    const analise = lista.find(item => item?.talhao_id === talhaoId && item?.safra === safra);
    const valor = arredondar(analise?.[info.key], 2);
    return {
      safra,
      valor,
      valorFormatado: formatarValor(valor, info.unidade),
      classificacao: classificarNutrienteSoloAdubacao2(info.key, valor).classificacao,
    };
  });
  return {
    nutriente: info.key,
    label: info.label,
    unidade: info.unidade,
    profundidade,
    pontos,
    temHistoricoSuficiente: pontos.filter(ponto => ponto.valor != null).length >= 2,
  };
}

export function montarSeriesTodosElementosEvolucao({ analises020 = [], analises2040 = [], talhaoId, profundidade = '0-20', safras = [] } = {}) {
  return NUTRIENTES_GRAFICOS_SOLO.map(info => montarSerieEvolucaoAnalises({
    analises020,
    analises2040,
    talhaoId,
    nutriente: info.key,
    profundidade,
    safras,
  }));
}

export function calcularIndiceAdequacaoSolo(key, valor) {
  const v = numero(valor);
  const centro = CENTROS_ADEQUACAO[key];
  if (v == null || centro == null || centro <= 0) return null;
  return Math.round((v / centro) * 1000) / 10;
}

export function montarComparacaoTalhoesSafraAtual({
  talhoes = [],
  analises020 = [],
  analises2040 = [],
  safra,
  profundidade = '0-20',
  nutrientes = NUTRIENTES_PADRAO_TODOS_TALHOES,
} = {}) {
  const nutrientesValidos = (nutrientes || [])
    .map(key => NUTRIENTES_GRAFICOS_SOLO.find(info => info.key === key))
    .filter(Boolean);
  const series = nutrientesValidos.map((info, indiceSerie) => {
    const pontos = (talhoes || []).map(talhao => {
      const analise = encontrarAnalise({ analises020, analises2040, talhaoId: talhao.id, safra, profundidade });
      const valorReal = arredondar(analise?.[info.key], 2);
      const classificacao = classificarNutrienteSoloAdubacao2(info.key, valorReal);
      const indiceAdequacao = calcularIndiceAdequacaoSolo(info.key, valorReal);
      const detalhe = `${talhao.nome || 'Talhão'} · ${info.label}: ${formatarValor(valorReal, info.unidade)} · índice ${indiceAdequacao != null ? `${indiceAdequacao}%` : '—'} · ${classificacao.classificacao}`;
      return {
        talhaoId: talhao.id,
        talhaoNome: talhao.nome || talhao.id,
        nutriente: info.key,
        label: info.label,
        unidade: info.unidade,
        valorReal,
        valorFormatado: formatarValor(valorReal, info.unidade),
        indiceAdequacao,
        classificacao: classificacao.classificacao,
        corClassificacao: classificacao.cor,
        detalhe,
      };
    });
    return {
      nutriente: info.key,
      label: info.label,
      unidade: info.unidade,
      cor: CORES_SERIES[indiceSerie % CORES_SERIES.length],
      pontos,
    };
  });
  return {
    modo: 'todos_talhoes',
    safra,
    profundidade,
    talhoes: (talhoes || []).map(talhao => ({ id: talhao.id, nome: talhao.nome || talhao.id })),
    series,
  };
}

export function gerarSvgAdequacaoSolo(dados = [], opcoes = {}) {
  const largura = opcoes.largura || 720;
  const alturaLinha = 25;
  const margemTopo = 34;
  const margemEsquerda = 96;
  const larguraBarra = 360;
  const altura = Math.max(260, margemTopo + dados.length * alturaLinha + 58);
  const linhas = dados.map((item, indice) => {
    const y = margemTopo + indice * alturaLinha;
    const valorVisual = item.valor == null ? 0.12 : clamp(Math.abs(item.valor) / 100, 0.12, 1);
    const w = Math.round(larguraBarra * valorVisual);
    return `
      <text x="16" y="${y + 14}" font-size="11" fill="#111827">${escaparSvg(item.label)}</text>
      <rect x="${margemEsquerda}" y="${y}" width="${w}" height="16" rx="3" fill="${item.cor}" />
      <text x="${margemEsquerda + larguraBarra + 14}" y="${y + 13}" font-size="11" fill="#374151">${escaparSvg(item.valorFormatado)} · ${escaparSvg(item.classificacao)}</text>
      <text x="${margemEsquerda + larguraBarra + 180}" y="${y + 13}" font-size="10" fill="#6b7280">${escaparSvg(item.nivelAdequado)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" role="img">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="16" y="20" font-size="14" font-weight="700" fill="#111827">Situação da Safra Atual</text>
    ${linhas}
    <text x="16" y="${altura - 30}" font-size="11" font-weight="700" fill="#111827">Legenda</text>
    <circle cx="74" cy="${altura - 34}" r="5" fill="#dc2626"/><text x="84" y="${altura - 30}" font-size="10" fill="#374151">baixo</text>
    <circle cx="134" cy="${altura - 34}" r="5" fill="#16a34a"/><text x="144" y="${altura - 30}" font-size="10" fill="#374151">adequado</text>
    <circle cx="216" cy="${altura - 34}" r="5" fill="#f59e0b"/><text x="226" y="${altura - 30}" font-size="10" fill="#374151">atenção</text>
    <circle cx="286" cy="${altura - 34}" r="5" fill="#2563eb"/><text x="296" y="${altura - 30}" font-size="10" fill="#374151">excesso</text>
  </svg>`;
}

export function gerarSvgEvolucaoSolo(serie = {}, opcoes = {}) {
  const pontos = Array.isArray(serie.pontos) ? serie.pontos : [];
  const largura = opcoes.largura || 720;
  const altura = opcoes.altura || 260;
  const plot = { x: 54, y: 36, w: largura - 90, h: altura - 88 };
  const valores = pontos.map(p => numero(p.valor)).filter(v => v != null);
  const min = valores.length ? Math.min(...valores) : 0;
  const max = valores.length ? Math.max(...valores) : 1;
  const range = max === min ? 1 : max - min;
  const coords = pontos.map((ponto, indice) => {
    const x = pontos.length <= 1 ? plot.x + plot.w / 2 : plot.x + (plot.w / (pontos.length - 1)) * indice;
    const valor = numero(ponto.valor);
    const y = valor == null ? null : plot.y + plot.h - ((valor - min) / range) * plot.h;
    return { ...ponto, x: Math.round(x), y: y == null ? null : Math.round(y) };
  });
  const linha = coords.filter(p => p.y != null).map(p => `${p.x},${p.y}`).join(' ');
  const marcadores = coords.map(ponto => {
    const yTexto = ponto.y == null ? plot.y + plot.h + 18 : ponto.y - 8;
    return `
      ${ponto.y == null ? '' : `<circle cx="${ponto.x}" cy="${ponto.y}" r="4" fill="#2563eb"/>`}
      <text x="${ponto.x}" y="${plot.y + plot.h + 20}" font-size="10" text-anchor="middle" fill="#374151">${escaparSvg(ponto.safra)}</text>
      <text x="${ponto.x}" y="${yTexto}" font-size="10" text-anchor="middle" fill="#111827">${escaparSvg(ponto.valorFormatado || '—')}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" role="img">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="16" y="20" font-size="14" font-weight="700" fill="#111827">Evolução entre Safras · ${escaparSvg(serie.label || '')} ${serie.unidade ? `(${escaparSvg(serie.unidade)})` : ''}</text>
    <line x1="${plot.x}" y1="${plot.y + plot.h}" x2="${plot.x + plot.w}" y2="${plot.y + plot.h}" stroke="#d1d5db"/>
    <line x1="${plot.x}" y1="${plot.y}" x2="${plot.x}" y2="${plot.y + plot.h}" stroke="#d1d5db"/>
    ${linha ? `<polyline points="${linha}" fill="none" stroke="#2563eb" stroke-width="2"/>` : ''}
    ${marcadores}
  </svg>`;
}

// Quebra nomes longos em até 2 linhas (balanceado por palavras), para não
// cortar em ... nem virar 3/4 linhas. Cada linha <= 16 chars normalmente.
function quebrarNomeTalhao(nome) {
  const s = String(nome ?? '').trim();
  if (s.length <= 16) return [s];
  const palavras = s.split(/\s+/);
  let acc = '';
  const linhas = [];
  for (const p of palavras) {
    const cand = acc ? `${acc} ${p}` : p;
    if (cand.length <= 16) acc = cand;
    else { if (acc) linhas.push(acc); acc = p; }
  }
  if (acc) linhas.push(acc);
  if (linhas.length <= 2) return linhas;
  return [linhas[0], linhas.slice(1).join(' ')];
}

// layout_amplo (largura >= 1000): usa largura/altura dinâmicas, nomes inclinados
// (-32°) e quebrados, legenda horizontal e mais área de plot. No formato antigo
// (<= 1000, ex.: 680x300) mantém o layout original — não afeta outros gráficos.
export function gerarSvgComparacaoTalhoesSolo(comparacao = {}, opcoes = {}) {
  const talhoes = Array.isArray(comparacao.talhoes) ? comparacao.talhoes : [];
  const series = Array.isArray(comparacao.series) ? comparacao.series : [];
  const largura = opcoes.largura || 720;
  const altura = opcoes.altura || 320;
  const layoutAmplo = largura >= 1000;
  const plot = layoutAmplo
    ? { x: 118, y: 52, w: largura - 118 - 38, h: altura - 208 }
    : { x: 58, y: 48, w: largura - 96, h: altura - 118 };
  const maxIndice = Math.max(160, ...series.flatMap(serie => serie.pontos.map(ponto => numero(ponto.indiceAdequacao) || 0)));
  const escalaMax = Math.min(220, Math.ceil(maxIndice / 20) * 20);
  const xTalhao = indice => talhoes.length <= 1 ? plot.x + plot.w / 2 : plot.x + (plot.w / (talhoes.length - 1)) * indice;
  const yIndice = indice => {
    const valor = numero(indice);
    if (valor == null) return null;
    return plot.y + plot.h - (clamp(valor, 0, escalaMax) / escalaMax) * plot.h;
  };
  const linhas = series.map((serie, serieIdx) => {
    const coords = serie.pontos.map((ponto, indice) => ({
      ...ponto,
      x: Math.round(xTalhao(indice)),
      y: yIndice(ponto.indiceAdequacao),
    }));
    const polyline = coords.filter(ponto => ponto.y != null).map(ponto => `${ponto.x},${Math.round(ponto.y)}`).join(' ');
    const offTexto = layoutAmplo ? (serieIdx % 2) * 12 : 0;
    const pontosSvg = coords.map(ponto => ponto.y == null ? '' : `
      <circle cx="${ponto.x}" cy="${Math.round(ponto.y)}" r="4" fill="${ponto.corClassificacao}" stroke="#ffffff" stroke-width="1.5">
        <title>${escaparSvg(ponto.detalhe)}</title>
      </circle>
      <text x="${ponto.x}" y="${Math.round(ponto.y) - 8 - offTexto}" font-size="9" text-anchor="middle" fill="#111827">${escaparSvg(ponto.valorFormatado)}</text>`).join('');
    return `
      ${polyline ? `<polyline points="${polyline}" fill="none" stroke="${serie.cor}" stroke-width="2"/>` : ''}
      ${pontosSvg}`;
  }).join('');
  const labelsTalhoes = talhoes.map((talhao, indice) => {
    const x = Math.round(xTalhao(indice));
    if (layoutAmplo) {
      const linhasNome = quebrarNomeTalhao(talhao.nome);
      const yBase = plot.y + plot.h + 16;
      return linhasNome.map((linha, k) => {
        const y = yBase + k * 13;
        return `<text x="${x}" y="${y}" font-size="10.5" text-anchor="end" fill="#374151" transform="rotate(-32 ${x} ${y})">${escaparSvg(linha)}</text>`;
      }).join('');
    }
    return `<text x="${x}" y="${plot.y + plot.h + 20}" font-size="10" text-anchor="middle" fill="#374151">${escaparSvg(talhao.nome)}</text>`;
  }).join('');
  let legendasSeries;
  if (layoutAmplo) {
    let x = 18;
    const y = altura - 24;
    legendasSeries = series.map(serie => {
      const larguraItem = 22 + serie.label.length * 6.2 + 16;
      let xItem = x;
      if (xItem + larguraItem > largura - 18) { xItem = 18; x = 18 + larguraItem; } else { x = xItem + larguraItem; }
      return `<line x1="${xItem}" y1="${y - 3}" x2="${xItem + 16}" y2="${y - 3}" stroke="${serie.cor}" stroke-width="2"/><text x="${xItem + 22}" y="${y}" font-size="10" fill="#374151">${escaparSvg(serie.label)}</text>`;
    }).join('');
  } else {
    legendasSeries = series.map((serie, indice) => {
      const x = 18 + (indice % 4) * 150;
      const y = altura - 42 + Math.floor(indice / 4) * 14;
      return `<line x1="${x}" y1="${y - 3}" x2="${x + 16}" y2="${y - 3}" stroke="${serie.cor}" stroke-width="2"/><text x="${x + 22}" y="${y}" font-size="10" fill="#374151">${escaparSvg(serie.label)}</text>`;
    }).join('');
  }
  const legendaHeading = layoutAmplo ? '' : `<text x="16" y="${altura - 58}" font-size="11" font-weight="700" fill="#111827">Legenda</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" role="img">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="16" y="22" font-size="14" font-weight="700" fill="#111827">Comparação Nutricional entre Talhões</text>
    <text x="16" y="38" font-size="10" fill="#6b7280">Safra ${escaparSvg(comparacao.safra || '—')} · Profundidade ${escaparSvg(comparacao.profundidade || '0-20')} cm · Eixo Y: Índice de adequação (%)</text>
    <line x1="${plot.x}" y1="${plot.y + plot.h}" x2="${plot.x + plot.w}" y2="${plot.y + plot.h}" stroke="#d1d5db"/>
    <line x1="${plot.x}" y1="${plot.y}" x2="${plot.x}" y2="${plot.y + plot.h}" stroke="#d1d5db"/>
    <line x1="${plot.x}" y1="${Math.round(yIndice(100))}" x2="${plot.x + plot.w}" y2="${Math.round(yIndice(100))}" stroke="#16a34a" stroke-width="1" stroke-dasharray="4 4"/>
    <text x="12" y="${Math.round(yIndice(100)) + 4}" font-size="10" fill="#16a34a">100</text>
    <text x="10" y="${plot.y + 8}" font-size="10" fill="#6b7280">${escaparSvg(escalaMax)}%</text>
    <text x="8" y="${plot.y + plot.h}" font-size="10" fill="#6b7280">0%</text>
    ${linhas}
    ${labelsTalhoes}
    ${legendaHeading}
    ${legendasSeries}
  </svg>`;
}

export function montarResumoEvolucaoAnalisesSolo({
  talhoes = [],
  analises020 = [],
  analises2040 = [],
  talhaoId,
  safraAtual,
  profundidade = '0-20',
  nutriente = 'ph',
  safrasComparadas = [],
} = {}) {
  const talhao = talhoes.find(t => t.id === talhaoId) || null;
  const adequacao = montarAdequacaoSafraAtual({ analises020, analises2040, talhaoId, safra: safraAtual, profundidade });
  const serie = montarSerieEvolucaoAnalises({ analises020, analises2040, talhaoId, nutriente, profundidade, safras: safrasComparadas });
  const safrasAnalisadas = serie.pontos.map(p => p.safra);
  return {
    talhaoId,
    talhaoNome: talhao?.nome || '',
    profundidade,
    nutriente,
    safrasAnalisadas,
    adequacao,
    serie,
    svgAdequacao: gerarSvgAdequacaoSolo(adequacao),
    svgEvolucao: gerarSvgEvolucaoSolo(serie),
    mensagemHistorico: serie.temHistoricoSuficiente ? '' : 'Não há histórico suficiente para comparar esta seleção.',
  };
}

export function montarResumoComparacaoTalhoesSolo({
  talhoes = [],
  analises020 = [],
  analises2040 = [],
  safraAtual,
  profundidade = '0-20',
  nutrientes = NUTRIENTES_PADRAO_TODOS_TALHOES,
} = {}) {
  const comparacao = montarComparacaoTalhoesSafraAtual({
    talhoes,
    analises020,
    analises2040,
    safra: safraAtual,
    profundidade,
    nutrientes,
  });
  return {
    titulo: 'Comparação Nutricional entre Talhões',
    safra: safraAtual,
    profundidade,
    nutrientes,
    comparacao,
    svgComparacao: gerarSvgComparacaoTalhoesSolo(comparacao, { largura: 680, altura: 300 }),
    mensagem: talhoes.length === 0 ? 'Nenhum talhão disponível para comparar.' : '',
  };
}