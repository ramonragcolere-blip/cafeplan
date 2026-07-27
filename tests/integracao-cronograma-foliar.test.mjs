import test from 'node:test';
import assert from 'node:assert/strict';
import { extrairMesesAplicacaoFoliar } from '../src/lib/dashboardPlanejamento.js';
import { normalizarAplicacoesFoliares } from '../src/lib/integracaoPlanejamentos.js';
import {
  CATEGORIA_ADUBACAO_FOLIAR,
  CATEGORIA_PLANTAS_DANINHAS,
  CATEGORIA_PRAGAS_DOENCAS,
  calcularCustosFoliaresPorCategoria,
  calcularCustosFoliaresPorTalhao,
  classificarCategoriaProdutoFoliar,
  formatarDoseNormalizadaFoliar,
  formatarPeriodoAplicacaoFoliar,
  normalizarProdutosAplicacaoFoliar,
} from '../src/lib/unidadesAplicacoesFoliares.js';

const talhoes = [
  { id: 't1', codigo_produtor: 'P001', nome: 'Talhao 1', area_ha: 2 },
  { id: 't2', codigo_produtor: 'P001', nome: 'Talhao 2', area_ha: 3 },
  { id: 't3', codigo_produtor: 'P001', nome: 'Talhao 3', area_ha: 1 },
  { id: 'x1', codigo_produtor: 'P002', nome: 'Outro produtor', area_ha: 5 },
];

test('CronogramaFoliar aparece no calendario no mes correto por data e periodo', () => {
  assert.deepEqual(extrairMesesAplicacaoFoliar({ data_prevista: '2026-08-10' }), ['AGO']);
  assert.deepEqual(extrairMesesAplicacaoFoliar({ periodo_aplicacao: 'OUT/NOV' }), ['OUT', 'NOV']);
});

test('cronograma com varios talhoes expande cada talhao uma vez sem duplicacao', () => {
  const resultado = normalizarAplicacoesFoliares([], [{
    id: 'c1',
    codigo_produtor: 'P001',
    safra: '2026/2027',
    talhao_ids: ['t1', 't2'],
    data_prevista: '2026-08-10',
    produtos: [],
  }], talhoes);

  assert.deepEqual(resultado.map(item => item.talhao_id), ['t1', 't2']);
  assert.equal(new Set(resultado.map(item => item.id)).size, 2);
  assert.deepEqual(resultado[0].meses, ['AGO']);
});

test('custos foliares respeitam filtros de produtor e safra', () => {
  const aplicacoes = [
    { codigo_produtor: 'P001', safra: '2026/2027', talhao_ids: ['t1'], produtos: [{ dose: '2', unidade: 'L/ha', preco: '10' }] },
    { codigo_produtor: 'P001', safra: '2025/2026', talhao_ids: ['t2'], produtos: [{ dose: '2', unidade: 'L/ha', preco: '10' }] },
    { codigo_produtor: 'P002', safra: '2026/2027', talhao_ids: ['x1'], produtos: [{ dose: '2', unidade: 'L/ha', preco: '10' }] },
  ];

  const custos = calcularCustosFoliaresPorCategoria(aplicacoes, talhoes, {
    codigoProdutor: 'P001',
    safra: '2026/2027',
  });

  assert.equal(custos[CATEGORIA_ADUBACAO_FOLIAR], 40);
});

test('Dashboard classifica custos por categoria de produto', () => {
  const aplicacoes = [{
    codigo_produtor: 'P001',
    safra: '2026/2027',
    talhao_ids: ['t1', 't2'],
    produtos: [
      { produto_nome: 'Fertilizante', grupo: 'Fertilizante Foliar', dose: '2', unidade: 'L/ha', preco: '10' },
      { produto_nome: 'Fungicida', grupo: 'Fungicida', dose: '1', unidade: 'kg/ha', preco: '5' },
      { produto_nome: 'Herbicida', grupo: 'Herbicida', dose: '500', unidade: 'g/ha', preco: '8' },
    ],
  }];

  const custos = calcularCustosFoliaresPorCategoria(aplicacoes, talhoes);

  assert.equal(classificarCategoriaProdutoFoliar({ grupo: 'Acaricida' }), CATEGORIA_PRAGAS_DOENCAS);
  assert.equal(classificarCategoriaProdutoFoliar({ grupo: 'Herbicida' }), CATEGORIA_PLANTAS_DANINHAS);
  assert.equal(classificarCategoriaProdutoFoliar({ grupo: 'Bioestimulante' }), CATEGORIA_ADUBACAO_FOLIAR);
  assert.equal(custos[CATEGORIA_ADUBACAO_FOLIAR], 100);
  assert.equal(custos[CATEGORIA_PRAGAS_DOENCAS], 25);
  assert.equal(custos[CATEGORIA_PLANTAS_DANINHAS], 20);
});

test('custos no Planejamento por talhao batem com os totais do Dashboard', () => {
  const aplicacoes = [{
    codigo_produtor: 'P001',
    safra: '2026/2027',
    talhao_ids: ['t1', 't2'],
    produtos: [
      { grupo: 'Fertilizante Foliar', dose: '2', unidade: 'L/ha', preco: '10' },
      { grupo: 'Fungicida', dose: '1', unidade: 'kg/ha', preco: '5' },
    ],
  }];
  const porTalhao = calcularCustosFoliaresPorTalhao(aplicacoes, talhoes, { codigoProdutor: 'P001', safra: '2026/2027' });
  const categorias = calcularCustosFoliaresPorCategoria(aplicacoes, talhoes, { codigoProdutor: 'P001', safra: '2026/2027' });
  const totalPlanejamento = porTalhao.t1.custoTotal + porTalhao.t2.custoTotal;
  const totalDashboard = categorias[CATEGORIA_ADUBACAO_FOLIAR] + categorias[CATEGORIA_PRAGAS_DOENCAS] + categorias[CATEGORIA_PLANTAS_DANINHAS];

  assert.equal(porTalhao.t1.custoHa, 25);
  assert.equal(porTalhao.t2.custoHa, 25);
  assert.equal(totalPlanejamento, totalDashboard);
});

test('PDF e relatorios usam data ou epoca e doses normalizadas do CronogramaFoliar', () => {
  const produto = normalizarProdutosAplicacaoFoliar([
    { produto_nome: 'Produto', dose: '600', unidade: 'ml/ha', preco: '20' },
  ])[0];

  assert.equal(formatarPeriodoAplicacaoFoliar({ periodo_aplicacao: 'JAN/FEV' }), 'JAN/FEV');
  assert.equal(formatarDoseNormalizadaFoliar(produto), '0,6 L/ha');
});

test('Supera permanece em 2 L/ha na integracao completa', () => {
  const produto = normalizarProdutosAplicacaoFoliar([
    { produto_nome: 'Supera', dose: '2', unidade: 'ml/20 L de água', preco: '30' },
  ], { volumeCaldaHa: 200 })[0];

  assert.equal(produto.dose, 2);
  assert.equal(produto.unidade, 'L/ha');
  assert.equal(formatarDoseNormalizadaFoliar(produto), '2 L/ha');
});

test('custos invalidos geram pendencia sem NaN', () => {
  const custos = calcularCustosFoliaresPorCategoria([{
    codigo_produtor: 'P001',
    safra: '2026/2027',
    talhao_ids: ['t1'],
    produtos: [{ produto_nome: 'Duvidoso', dose: 'texto', unidade: 'frasco', preco: '10' }],
  }], talhoes);

  assert.equal(custos.pendencias, 1);
  assert.equal(Number.isNaN(custos[CATEGORIA_ADUBACAO_FOLIAR]), false);
  assert.equal(custos[CATEGORIA_ADUBACAO_FOLIAR], 0);
});

test('registros legados de AplicacaoFoliar sao preservados na normalizacao', () => {
  const legados = normalizarAplicacoesFoliares([{
    id: 'a1',
    codigo_produtor: 'P001',
    safra: '2026/2027',
    talhao_id: 't1',
    meses: ['SET'],
    produtos: [{ produto_nome: 'Legado', dose: '1', unidade: 'L/ha', preco: '10' }],
  }], [], talhoes);

  assert.equal(legados[0]._origem, 'legado');
  assert.equal(legados[0].talhao_id, 't1');
  assert.deepEqual(legados[0].meses, ['SET']);
});
