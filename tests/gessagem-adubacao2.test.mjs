import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calcularCustoGessagem,
  calcularFornecimentoGesso,
  calcularGessagemLopes,
  calcularRecomendacaoGessagem,
  ORIENTACAO_APLICACAO_GESSAGEM,
  ALERTA_LIXIVIACAO_GESSAGEM,
  montarLinhaGessagemResumo,
} from '../src/lib/gessagemAdubacao2.js';
import { consolidarComprasAdubacao2, montarGruposResumoAdubacao2 } from '../src/lib/calagemAdubacao2.js';
import { normalizarPlanosAdubacao } from '../src/lib/integracaoPlanejamentos.js';

const talhao = { id: 't1', nome: 'Talhao 1', area_ha: 2, num_plantas: 1000, espacamento: '3,5x0,7' };
const analise2040 = {
  talhao_id: 't1',
  calcio: 0.3,
  aluminio: 0.6,
  magnesio: 0.2,
  potassio: 25,
  saturacao_aluminio: 35,
  argila_pct: 40,
};
const gesso = { id: 'gesso1', nome: 'Gesso agricola', ca_pct: 18, s_pct: 15 };

test('gessagem indica somente por analise 20-40 e mostra mensagem quando ausente', () => {
  const semAnalise = calcularRecomendacaoGessagem({ talhao, analise2040: null });
  const recomendado = calcularRecomendacaoGessagem({ talhao, analise2040 });

  assert.equal(semAnalise.temAnalise2040, false);
  assert.equal(semAnalise.mensagem, 'Análise de subsuperfície necessária para recomendar gessagem.');
  assert.equal(semAnalise.indicada, false);
  assert.equal(recomendado.temAnalise2040, true);
  assert.equal(recomendado.indicada, true);
  assert.deepEqual(recomendado.motivos, ['m% maior que 30%', 'Ca menor que 0,4 cmolc/dm³', 'Al maior que 0,5 cmolc/dm³']);
});

test('5a Aproximacao calcula faixa por teor de argila somente quando houver indicacao', () => {
  assert.deepEqual(calcularRecomendacaoGessagem({ talhao, analise2040: { ...analise2040, argila_pct: 10 } }).faixa5a, { minT: 0, maxT: 0.4, minKgHa: 0, maxKgHa: 400 });
  assert.deepEqual(calcularRecomendacaoGessagem({ talhao, analise2040: { ...analise2040, argila_pct: 20 } }).faixa5a, { minT: 0.4, maxT: 0.8, minKgHa: 400, maxKgHa: 800 });
  assert.deepEqual(calcularRecomendacaoGessagem({ talhao, analise2040: { ...analise2040, argila_pct: 50 } }).faixa5a, { minT: 0.8, maxT: 1.2, minKgHa: 800, maxKgHa: 1200 });
  assert.deepEqual(calcularRecomendacaoGessagem({ talhao, analise2040: { ...analise2040, argila_pct: 70 } }).faixa5a, { minT: 1.2, maxT: 1.6, minKgHa: 1200, maxKgHa: 1600 });
  assert.equal(calcularRecomendacaoGessagem({ talhao, analise2040: { calcio: 1, aluminio: 0.1, saturacao_aluminio: 5, argila_pct: 40 } }).faixa5a, null);
});

test('metodo Lopes calcula gesso e calcario ajustado', () => {
  const lopes = calcularGessagemLopes({ doseCalcarioKgHa: 2000, caoCalcarioPct: 40, caoGessoPct: 25 });

  assert.equal(lopes.caoCalcarioKgHa, 800);
  assert.equal(lopes.caoSubstituirKgHa, 200);
  assert.equal(lopes.gessoKgHa, 800);
  assert.equal(lopes.calcarioAjustadoKgHa, 1500);
});

test('dose sugerida usa menor valor entre Lopes e teto da 5a Aproximacao', () => {
  const recomendacao = calcularRecomendacaoGessagem({
    talhao,
    analise2040,
    doseCalcarioKgHa: 3000,
    caoCalcarioPct: 40,
    caoGessoPct: 25,
  });

  assert.equal(recomendacao.lopes.gessoKgHa, 1200);
  assert.equal(recomendacao.faixa5a.maxKgHa, 1200);
  assert.equal(recomendacao.doseSugeridaKgHa, 1200);
});

test('gessagem calcula custo quantidade total Ca e S fornecidos', () => {
  const custo = calcularCustoGessagem({ doseKgHa: 1000, areaHa: 2, precoUnitario: 500, unidadePreco: 't' });
  const fornecimento = calcularFornecimentoGesso({ produto: gesso, doseKgHa: 1000 });

  assert.equal(custo.quantidadeTotalKg, 2000);
  assert.equal(custo.custoHa, 500);
  assert.equal(custo.custoTotal, 1000);
  assert.equal(fornecimento.caKgHa, 180);
  assert.equal(fornecimento.sKgHa, 150);
});

test('gessagem em R$/kg calcula custo e preserva preco zero', () => {
  assert.equal(calcularCustoGessagem({ doseKgHa: 1000, areaHa: 2, precoUnitario: 2, unidadePreco: 'kg' }).custoTotal, 4000);
  assert.equal(calcularCustoGessagem({ doseKgHa: 1000, areaHa: 2, precoUnitario: 0, unidadePreco: 'kg' }).custoTotal, 0);
});

test('Resumo Geral e Consolidacao de Compras incluem gessagem sem duplicar custos', () => {
  const gessagens = [{
    id: 'g1',
    talhao_id: 't1',
    produto_id: 'gesso1',
    produto_nome: 'Gesso agricola',
    dose_final_kg_ha: 1000,
    quantidade_total_kg: 2000,
    preco_unitario: 500,
    unidade_preco: 't',
    updated_date: '2026-07-01T10:00:00Z',
  }];
  const compras = consolidarComprasAdubacao2({ resultados: [], gessagens, talhoes: [talhao] });
  const grupos = montarGruposResumoAdubacao2({ resultados: [], gessagens, talhoes: [talhao] });

  assert.equal(compras.length, 1);
  assert.equal(compras[0].produto.nome, 'Gesso agricola');
  assert.equal(compras[0].qtdTotal, 2000);
  assert.equal(compras[0].custoTotal, 1000);
  assert.equal(grupos[0].linhas[0].isGessagem, true);
  assert.equal(grupos[0].linhas[0].custoHa, 500);
  assert.equal(grupos[0].linhas[0].custoTotal, 1000);
});

test('montar linha de resumo da gessagem preserva distribuicao e periodo', () => {
  const linha = montarLinhaGessagemResumo({
    gessagem: {
      produto_id: 'gesso1',
      produto_nome: 'Gesso agricola',
      dose_final_kg_ha: 1000,
      quantidade_total_kg: 2000,
      preco_unitario: 500,
      unidade_preco: 't',
    },
    talhao,
  });

  assert.equal(linha.produtoNome, 'Gesso agricola');
  assert.equal(linha.totalKg, 2000);
  assert.equal(linha.gPlanta, 2000);
  assert.equal(linha.gMetro, 2857);
  assert.equal(linha.periodoAplicacao, 'Aplicar após o calcário');
});

test('Planejamento Geral soma custo da gessagem junto da Adubacao 2.0', () => {
  const planos = normalizarPlanosAdubacao([], [], [{
    id: 'g1',
    codigo_produtor: 'P001',
    safra: '2026/2027',
    talhao_id: 't1',
    produto_id: 'gesso1',
    produto_nome: 'Gesso agricola',
    dose_final_kg_ha: 1000,
    preco_unitario: 500,
    unidade_preco: 't',
  }]);

  assert.equal(planos.length, 1);
  assert.equal(planos[0].produto_nome, 'Gesso agricola');
  assert.equal(planos[0].custo_rha, 500);
  assert.deepEqual(planos[0].meses, [[]]);
});

test('schema e UI da Gessagem estao registrados no Base44 e na Adubacao 2.0', () => {
  const schema = readFileSync(new URL('../base44/entities/BaseRecomendacaoGessagem.jsonc', import.meta.url), 'utf8');
  const pagina = readFileSync(new URL('../src/pages/Adubacao2.jsx', import.meta.url), 'utf8');
  const componente = readFileSync(new URL('../src/components/adubacao2/AbaGessagem2.jsx', import.meta.url), 'utf8');

  assert.match(schema, /"name": "BaseRecomendacaoGessagem"/);
  assert.match(schema, /"dose_final_kg_ha"/);
  assert.match(pagina, /label: 'Gessagem'/);
  assert.match(pagina, /BaseRecomendacaoGessagem/);
  assert.match(componente, /ORIENTACAO_APLICACAO_GESSAGEM/);
  assert.match(componente, /ALERTA_LIXIVIACAO_GESSAGEM/);
  assert.match(ORIENTACAO_APLICACAO_GESSAGEM, /Aplicar após o calcário e distribuir em faixa uniforme/);
  assert.match(ALERTA_LIXIVIACAO_GESSAGEM, /lixiviação de Mg e K/);
});
