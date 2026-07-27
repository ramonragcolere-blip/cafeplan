import test from 'node:test';
import assert from 'node:assert/strict';
import {
  categorizarStatusPlanejamento,
  coletarSafrasDisponiveis,
  combinarMesesOperacao,
  extrairMesesAplicacaoFoliar,
  mesesAutomaticosAdubacao2PorTalhao,
  mesesAutomaticosFoliaresPorTalhao,
  proximasAdubacoesDashboard,
  separarMesesOperacaoSalva,
} from '../src/lib/dashboardPlanejamento.js';
import { normalizarAplicacoesFoliares, normalizarPlanosAdubacao } from '../src/lib/integracaoPlanejamentos.js';

const talhoes = [
  { id: 't1', nome: 'Talhao 1', codigo_produtor: 'P001', area_ha: 2 },
  { id: 't2', nome: 'Talhao 2', codigo_produtor: 'P001', area_ha: 3 },
  { id: 't3', nome: 'Talhao 3', codigo_produtor: 'P001', area_ha: 1 },
  { id: 't4', nome: 'Talhao 4', codigo_produtor: 'P001', area_ha: 4 },
  { id: 'x1', nome: 'Outro produtor', codigo_produtor: 'P002', area_ha: 5 },
];

test('Dashboard coleta safras de produtor e safra a partir de todas as origens e escolhe a mais recente primeiro', () => {
  const safras = coletarSafrasDisponiveis({
    planejamentosAdubacao2: [{ safra: '2026/2027' }],
    planosLegados: [{ safra: '2024/2025' }],
    cronogramasFoliares: [{ safra: '2027/2028' }],
    aplicacoesFoliares: [{ safra: '2025/2026' }],
  });

  assert.deepEqual(safras, ['2027/2028', '2026/2027', '2025/2026', '2024/2025']);
});

test('Status do Planejamento respeita produtor e safra sem misturar safras', () => {
  const planos = [
    { codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1', status: 'planejado' },
    { codigo_produtor: 'P001', safra: '2025/2026', talhao_id: 't2', status: 'concluido' },
    { codigo_produtor: 'P002', safra: '2026/2027', talhao_id: 'x1', status: 'concluido' },
  ];
  const { totais } = categorizarStatusPlanejamento({ talhoes, planos, codigoProdutor: 'P001', safra: '2026/2027' });

  assert.equal(totais.planejado, 1);
  assert.equal(totais.concluido, 0);
  assert.equal(totais.semPlanejamento, 3);
});

test('Status separa Planejado, Em execucao, Concluido e Sem planejamento', () => {
  const planos = [
    { codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1', status: 'planejado' },
    { codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't2', status: 'em_execucao' },
    { codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't3', status: 'concluido' },
  ];
  const { totais } = categorizarStatusPlanejamento({ talhoes, planos, codigoProdutor: 'P001', safra: '2026/2027' });

  assert.equal(totais.planejado, 1);
  assert.equal(totais.emExecucao, 1);
  assert.equal(totais.concluido, 1);
  assert.equal(totais.semPlanejamento, 1);
});

test('Soma dos status iguala o numero de talhoes e talhao nao e contado duas vezes', () => {
  const planos = [
    { codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1', status: 'planejado' },
    { codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1', status: 'em_execucao' },
    { codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't2', status: 'concluido' },
  ];
  const { totais } = categorizarStatusPlanejamento({ talhoes, planos, codigoProdutor: 'P001', safra: '2026/2027' });
  const soma = totais.planejado + totais.emExecucao + totais.concluido + totais.semPlanejamento;

  assert.equal(soma, 4);
  assert.equal(totais.emExecucao, 1);
});

test('Proximas adubacoes usa meses dos parcelamentos e corrige dezembro para janeiro', () => {
  const planos = [
    { codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1', produto_id: 'npk', meses: [['JAN']] },
    { codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't2', produto_id: 'boro', meses: [['FEV']] },
    { codigo_produtor: 'P001', safra: '2025/2026', talhao_id: 't3', produto_id: 'kcl', meses: [['JAN']] },
  ];
  const proximas = proximasAdubacoesDashboard({
    talhoes,
    planos,
    codigoProdutor: 'P001',
    safra: '2026/2027',
    mesAtualIndice: 11,
  });

  assert.deepEqual(proximas.map(p => p.talhao_id), ['t1']);
});

test('Meses automaticos da Adubacao 2.0 incluem produto principal, complementos e manuais sem duplicar', () => {
  const mapa = mesesAutomaticosAdubacao2PorTalhao([{
    codigo_produtor: 'P001',
    safra: '2026/2027',
    talhao_id: 't1',
    detalhamento: {
      produtoSugerido: { id: 'npk', nome: '20-00-20' },
      complementos: [
        { produto: { id: 'boro', nome: 'Ácido bórico' } },
        { produto: { id: 'zinco', nome: 'Sulfato de zinco' }, isManualExtra: true },
      ],
      parcelamentos: {
        npk: { parcelas: [{ pct: 60, meses: ['OUT', 'NOV'] }, { pct: 40, meses: ['JAN'] }] },
        boro: { parcelas: [{ pct: 100, meses: ['NOV', 'DEZ'] }] },
        zinco: { parcelas: [{ pct: 100, meses: ['JAN'] }] },
        ignorado: { parcelas: [{ pct: 100, meses: ['MAR'] }] },
      },
    },
  }], { codigoProdutor: 'P001', safra: '2026/2027' });

  assert.deepEqual(mapa.t1, ['JAN', 'OUT', 'NOV', 'DEZ']);
});

test('Meses automaticos preservam meses manuais e removem duplicados na uniao', () => {
  const separados = separarMesesOperacaoSalva({ meses: ['MAR', 'JAN'] }, ['JAN', 'FEV']);

  assert.deepEqual(separados.meses_manuais, ['JAN', 'MAR']);
  assert.deepEqual(separados.meses_automaticos, ['JAN', 'FEV']);
  assert.deepEqual(separados.meses, ['JAN', 'FEV', 'MAR']);
  assert.deepEqual(combinarMesesOperacao({ manuais: ['DEZ'], automaticos: ['JAN', 'DEZ'] }), ['JAN', 'DEZ']);
});

test('CronogramaFoliar alimenta todos os talhoes incluidos usando data, mes ou periodo', () => {
  const mapa = mesesAutomaticosFoliaresPorTalhao([
    { codigo_produtor: 'P001', safra: '2026/2027', talhao_ids: ['t1', 't2'], data_limite: '2026-08-10' },
    { codigo_produtor: 'P001', safra: '2026/2027', talhao_ids: ['t2'], epoca: 'OUT/NOV' },
    { codigo_produtor: 'P001', safra: '2026/2027', talhao_ids: ['t3'], mes: 'Janeiro' },
    { codigo_produtor: 'P002', safra: '2026/2027', talhao_ids: ['x1'], epoca: 'DEZ' },
  ], { codigoProdutor: 'P001', safra: '2026/2027' });

  assert.deepEqual(mapa.t1, ['AGO']);
  assert.deepEqual(mapa.t2, ['AGO', 'OUT', 'NOV']);
  assert.deepEqual(mapa.t3, ['JAN']);
  assert.equal(mapa.x1, undefined);
});

test('Edicao ou exclusao de CronogramaFoliar remove mes automatico ausente da fonte atual', () => {
  const antes = mesesAutomaticosFoliaresPorTalhao([
    { codigo_produtor: 'P001', safra: '2026/2027', talhao_ids: ['t1'], epoca: 'AGO' },
  ], { codigoProdutor: 'P001', safra: '2026/2027' });
  const depois = mesesAutomaticosFoliaresPorTalhao([], { codigoProdutor: 'P001', safra: '2026/2027' });

  assert.deepEqual(antes.t1, ['AGO']);
  assert.equal(depois.t1, undefined);
});

test('Normalizador de CronogramaFoliar usa periodo quando nao ha data limite', () => {
  const resultado = normalizarAplicacoesFoliares([], [{
    id: 'c1',
    codigo_produtor: 'P001',
    safra: '2026/2027',
    epoca: 'Jan/Fev',
    talhao_ids: ['t1'],
    produtos: [],
  }], talhoes);

  assert.deepEqual(resultado[0].meses, ['JAN', 'FEV']);
});

test('Normalizador de Adubacao 2.0 mantem meses dos parcelamentos para principal e complemento', () => {
  const resultado = normalizarPlanosAdubacao([], [{
    id: 'p1',
    codigo_produtor: 'P001',
    safra: '2026/2027',
    talhao_id: 't1',
    detalhamento: {
      produtoSugerido: { id: 'npk', nome: 'NPK' },
      doseProdutoHa: 100,
      complementos: [{ produto: { id: 'boro', nome: 'Boro' }, doseKgHa: 2 }],
      parcelamentos: {
        npk: { parcelas: [{ pct: 100, meses: ['OUT'] }] },
        boro: { parcelas: [{ pct: 100, meses: ['NOV'] }] },
      },
    },
  }]);

  assert.deepEqual(resultado.map(p => p.meses), [[['OUT']], [['NOV']]]);
});

test('Extracao de meses foliares aceita campo periodo de aplicacao', () => {
  assert.deepEqual(extrairMesesAplicacaoFoliar({ periodo_aplicacao: 'Dezembro/Janeiro' }), ['JAN', 'DEZ']);
});
