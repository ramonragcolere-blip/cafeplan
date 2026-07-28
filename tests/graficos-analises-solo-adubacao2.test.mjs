import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classificarNutrienteSoloAdubacao2,
  gerarSvgAdequacaoSolo,
  gerarSvgEvolucaoSolo,
  montarAdequacaoSafraAtual,
  montarResumoEvolucaoAnalisesSolo,
  montarSerieEvolucaoAnalises,
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

test('grafico SVG funciona com uma safra e com varias safras', () => {
  const umaSafra = montarSerieEvolucaoAnalises({ analises020, talhaoId: 't1', nutriente: 'magnesio', profundidade: '0-20', safras: ['2026/2027'] });
  const varias = montarSerieEvolucaoAnalises({ analises020, talhaoId: 't1', nutriente: 'magnesio', profundidade: '0-20', safras: ['2024/2025', '2025/2026', '2026/2027'] });

  assert.match(gerarSvgEvolucaoSolo(umaSafra), /<svg/);
  assert.match(gerarSvgEvolucaoSolo(varias), /2024\/2025/);
  assert.match(gerarSvgEvolucaoSolo(varias), /0,6 cmolc\/dm³/);
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

test('grafico aparece no Resumo Geral e no HTML de impressao', () => {
  const resumo = readFileSync(new URL('../src/components/adubacao2/AbaResumoGeral2.jsx', import.meta.url), 'utf8');

  assert.match(resumo, /Evolução das Análises de Solo/);
  assert.match(resumo, /resumo2-evolucao-print/);
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
  assert.match(abaGraficos, /Situação da Safra Atual/);
  assert.match(resumo, /gerarSvgAdequacaoSolo/);
  assert.match(resumo, /gerarSvgEvolucaoSolo/);
});
