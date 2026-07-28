import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import {
  classificarNutrienteSoloAdubacao2,
  gerarSvgAdequacaoSolo,
  gerarSvgComparacaoTalhoesSolo,
  gerarSvgEvolucaoSolo,
  montarAdequacaoSafraAtual,
  montarComparacaoTalhoesSafraAtual,
  montarResumoComparacaoTalhoesSolo,
  montarResumoEvolucaoAnalisesSolo,
  montarSerieEvolucaoAnalises,
  montarSeriesTodosElementosEvolucao,
} from '../src/lib/graficosAnalisesSoloAdubacao2.js';

const talhoes = [
  { id: 't1', nome: 'Eucalipto' },
  { id: 't2', nome: 'Mundo Novo' },
];

const analises020 = [
  { talhao_id: 't1', safra: '2024/2025', profundidade: '0-20', magnesio: 0.4, fosforo: 8, ph: 5.2, potassio: 80, calcio: 2.1, boro: 0.3, zinco: 1.2, cobre: 0.4, manganes: 4, enxofre: 7, ctc: 8, saturacao_bases: 45 },
  { talhao_id: 't1', safra: '2025/2026', profundidade: '0-20', magnesio: 0.5, fosforo: 14, ph: 5.6, potassio: 130, calcio: 3.6, boro: 0.7, zinco: 2.5, cobre: 1, manganes: 12, enxofre: 12, ctc: 10, saturacao_bases: 60 },
  { talhao_id: 't1', safra: '2026/2027', profundidade: '0-20', magnesio: 0.6, fosforo: 22, ph: 6.1, potassio: 220, calcio: 5, boro: 1.7, zinco: 6, cobre: 3.5, manganes: 32, enxofre: 20, ctc: 14, saturacao_bases: 75 },
  { talhao_id: 't2', safra: '2026/2027', profundidade: '0-20', magnesio: 9.9, fosforo: 99 },
];

const analises2040 = [
  { talhao_id: 't1', safra: '2026/2027', profundidade: '20-40', magnesio: 0.2, calcio: 0.3, aluminio: 0.6, saturacao_aluminio: 35 },
  { talhao_id: 't1', safra: '2025/2026', profundidade: '20-40', magnesio: 0.3, calcio: 0.5, aluminio: 0.4, saturacao_aluminio: 20 },
  { talhao_id: 't2', safra: '2026/2027', profundidade: '20-40', magnesio: 8.8 },
];

test('classificacao dos nutrientes usa faixas centrais e cores consistentes', () => {
  assert.equal(classificarNutrienteSoloAdubacao2('fosforo', 8).classificacao, 'baixo');
  assert.equal(classificarNutrienteSoloAdubacao2('fosforo', 14).classificacao, 'adequado');
  assert.equal(classificarNutrienteSoloAdubacao2('fosforo', 22).classificacao, 'muito alto');
  assert.equal(classificarNutrienteSoloAdubacao2('potassio', 220).cor, '#2563eb');
  assert.equal(classificarNutrienteSoloAdubacao2('aluminio', 0.8).classificacao, 'alto');
});

test('profundidades 0-20 e 20-40 sao mantidas separadas', () => {
  const atual020 = montarAdequacaoSafraAtual({ analises020, analises2040, talhaoId: 't1', safra: '2026/2027', profundidade: '0-20' });
  const atual2040 = montarAdequacaoSafraAtual({ analises020, analises2040, talhaoId: 't1', safra: '2026/2027', profundidade: '20-40' });

  assert.equal(atual020.find(n => n.key === 'magnesio').valor, 0.6);
  assert.equal(atual2040.find(n => n.key === 'magnesio').valor, 0.2);
});

test('comparacao entre safras filtra talhao nutriente e profundidade sem misturar talhoes', () => {
  const serie = montarSerieEvolucaoAnalises({
    analises020,
    analises2040,
    talhaoId: 't1',
    nutriente: 'magnesio',
    profundidade: '0-20',
    safras: ['2024/2025', '2025/2026', '2026/2027'],
  });

  assert.deepEqual(serie.pontos.map(p => p.valor), [0.4, 0.5, 0.6]);
  assert.equal(serie.pontos.some(p => p.valor === 9.9), false);
  assert.equal(serie.unidade, 'cmolc/dm³');
});

test('unidades corretas sao mantidas por nutriente', () => {
  assert.equal(montarSerieEvolucaoAnalises({ analises020, talhaoId: 't1', nutriente: 'fosforo', profundidade: '0-20' }).unidade, 'mg/dm³');
  assert.equal(montarSerieEvolucaoAnalises({ analises020, talhaoId: 't1', nutriente: 'calcio', profundidade: '0-20' }).unidade, 'cmolc/dm³');
  assert.equal(montarSerieEvolucaoAnalises({ analises020, talhaoId: 't1', nutriente: 'saturacao_bases', profundidade: '0-20' }).unidade, '%');
});

test('opcao Todos os elementos cria graficos separados por unidade', () => {
  const series = montarSeriesTodosElementosEvolucao({
    analises020,
    analises2040,
    talhaoId: 't1',
    profundidade: '0-20',
    safras: ['2024/2025', '2025/2026', '2026/2027'],
  });

  assert.equal(series.some(serie => serie.nutriente === 'ph'), true);
  assert.equal(series.some(serie => serie.unidade === 'mg/dm³'), true);
  assert.equal(series.some(serie => serie.unidade === 'cmolc/dm³'), true);
  assert.equal(new Set(series.map(serie => `${serie.nutriente}:${serie.unidade}`)).size, series.length);
});

test('modo Todos os talhoes calcula indice de adequacao sem misturar talhoes', () => {
  const comparacao = montarComparacaoTalhoesSafraAtual({
    talhoes,
    analises020,
    analises2040,
    safra: '2026/2027',
    profundidade: '0-20',
    nutrientes: ['ph', 'fosforo', 'magnesio'],
  });
  const fosforo = comparacao.series.find(serie => serie.nutriente === 'fosforo');
  const pontoT1 = fosforo.pontos.find(ponto => ponto.talhaoId === 't1');
  const pontoT2 = fosforo.pontos.find(ponto => ponto.talhaoId === 't2');

  assert.equal(comparacao.modo, 'todos_talhoes');
  assert.equal(fosforo.unidade, 'mg/dm³');
  assert.equal(pontoT1.valorReal, 22);
  assert.equal(pontoT2.valorReal, 99);
  assert.equal(pontoT1.indiceAdequacao > 100, true);
  assert.equal(fosforo.pontos.some(ponto => ponto.talhaoId === 't3'), false);
});

test('detalhe dos pontos preserva valor real unidade classificacao e nutriente sem referencia', () => {
  const comparacao = montarComparacaoTalhoesSafraAtual({
    talhoes: [...talhoes, { id: 't3', nome: 'Sem analise' }],
    analises020,
    safra: '2026/2027',
    profundidade: '0-20',
    nutrientes: ['fosforo', 'aluminio'],
  });
  const pontoSemAnalise = comparacao.series.find(serie => serie.nutriente === 'fosforo').pontos.find(ponto => ponto.talhaoId === 't3');
  const aluminio = comparacao.series.find(serie => serie.nutriente === 'aluminio');

  assert.equal(pontoSemAnalise.valorReal, null);
  assert.equal(pontoSemAnalise.classificacao, 'sem referência');
  assert.equal(pontoSemAnalise.detalhe.includes('Sem analise'), true);
  assert.equal(aluminio.pontos.find(ponto => ponto.talhaoId === 't1').indiceAdequacao, null);
});

test('grafico SVG funciona com uma safra e com varias safras', () => {
  const umaSafra = montarSerieEvolucaoAnalises({ analises020, talhaoId: 't1', nutriente: 'magnesio', profundidade: '0-20', safras: ['2026/2027'] });
  const varias = montarSerieEvolucaoAnalises({ analises020, talhaoId: 't1', nutriente: 'magnesio', profundidade: '0-20', safras: ['2024/2025', '2025/2026', '2026/2027'] });

  assert.match(gerarSvgEvolucaoSolo(umaSafra), /<svg/);
  assert.match(gerarSvgEvolucaoSolo(varias), /2024\/2025/);
  assert.match(gerarSvgEvolucaoSolo(varias), /0,6 cmolc\/dm³/);
});

test('grafico de todos os talhoes gera SVG com legenda e detalhe real', () => {
  const comparacao = montarComparacaoTalhoesSafraAtual({
    talhoes,
    analises020,
    safra: '2026/2027',
    profundidade: '0-20',
    nutrientes: ['ph', 'fosforo'],
  });
  const svg = gerarSvgComparacaoTalhoesSolo(comparacao);

  assert.match(svg, /<svg/);
  assert.match(svg, /Comparação Nutricional entre Talhões/);
  assert.match(svg, /Índice de adequação/);
  assert.match(svg, /Eucalipto/);
  assert.match(svg, /22 mg\/dm³/);
  assert.doesNotMatch(svg, /NaN/);
});

test('grafico de adequacao inclui valores unidades e legenda', () => {
  const dados = montarAdequacaoSafraAtual({ analises020, talhaoId: 't1', safra: '2026/2027', profundidade: '0-20' });
  const svg = gerarSvgAdequacaoSolo(dados);

  assert.match(svg, /<svg/);
  assert.match(svg, /Legenda/);
  assert.match(svg, /pH/);
  assert.match(svg, /mg\/dm³/);
});

test('Resumo Geral monta secao de evolucao e mensagem quando falta historico suficiente', () => {
  const resumo = montarResumoEvolucaoAnalisesSolo({
    talhoes,
    analises020,
    analises2040,
    talhaoId: 't1',
    safraAtual: '2026/2027',
    profundidade: '0-20',
    nutriente: 'magnesio',
    safrasComparadas: ['2026/2027'],
  });

  assert.equal(resumo.talhaoNome, 'Eucalipto');
  assert.equal(resumo.profundidade, '0-20');
  assert.deepEqual(resumo.safrasAnalisadas, ['2026/2027']);
  assert.match(resumo.mensagemHistorico, /histórico suficiente/);
  assert.match(resumo.svgAdequacao, /<svg/);
  assert.match(resumo.svgEvolucao, /<svg/);
});

test('Resumo Geral monta comparacao nutricional entre talhoes como grafico padrao', () => {
  const resumo = montarResumoComparacaoTalhoesSolo({
    talhoes,
    analises020,
    analises2040,
    safraAtual: '2026/2027',
    profundidade: '0-20',
    nutrientes: ['ph', 'fosforo', 'magnesio'],
  });

  assert.equal(resumo.titulo, 'Comparação Nutricional entre Talhões');
  assert.equal(resumo.safra, '2026/2027');
  assert.equal(resumo.profundidade, '0-20');
  assert.match(resumo.svgComparacao, /<svg/);
  assert.match(resumo.svgComparacao, /Eucalipto/);
});

test('grafico aparece no Resumo Geral e no HTML de impressao', () => {
  const resumo = readFileSync(new URL('../src/components/adubacao2/AbaResumoGeral2.jsx', import.meta.url), 'utf8');

  assert.match(resumo, /Comparação Nutricional entre Talhões/);
  assert.match(resumo, /resumo2-comparacao-print/);
  assert.match(resumo, /Ver evolução de um talhão/);
  assert.match(resumo, /dangerouslySetInnerHTML=\{\{ __html: svgComparacaoTalhoes \}\}/);
});

test('dados ausentes nao geram tela branca nem NaN', () => {
  const atual = montarAdequacaoSafraAtual({ analises020: [{ talhao_id: 't1', safra: '2026/2027' }], talhaoId: 't1', safra: '2026/2027' });
  const svg = gerarSvgAdequacaoSolo(atual);

  assert.equal(atual.every(item => item.classificacao === 'sem referência'), true);
  assert.doesNotMatch(svg, /NaN/);
});

test('aba Graficos e secao Evolucao das Analises de Solo aparecem na UI e no HTML de impressao', () => {
  const pagina = readFileSync(new URL('../src/pages/Adubacao2.jsx', import.meta.url), 'utf8');
  const resumo = readFileSync(new URL('../src/components/adubacao2/AbaResumoGeral2.jsx', import.meta.url), 'utf8');
  const abaGraficos = readFileSync(new URL('../src/components/adubacao2/AbaGraficosAnalisesSolo2.jsx', import.meta.url), 'utf8');

  assert.match(pagina, /label: 'Gráficos'/);
  assert.match(pagina, /AbaGraficosAnalisesSolo2/);
  assert.match(abaGraficos, /Todos os elementos/);
  assert.match(abaGraficos, /Todos os talhões/);
  assert.match(abaGraficos, /Situação da Safra Atual/);
  assert.match(resumo, /gerarSvgComparacaoTalhoesSolo/);
  assert.match(resumo, /gerarSvgEvolucaoSolo/);
});
