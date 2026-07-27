import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTO_PENDENTE_FOLIAR,
  calcularCustoProdutoFoliarDetalhado,
  calcularResumoAplicacaoFoliar,
  formatarDoseNormalizadaFoliar,
  migrarSuperaFoliar,
  normalizarDoseProdutoFoliar,
  normalizarProdutosAplicacaoFoliar,
  validarPeriodoAplicacaoFoliar,
} from '../src/lib/unidadesAplicacoesFoliares.js';
import { normalizarAplicacoesFoliares } from '../src/lib/integracaoPlanejamentos.js';
import { limparPayloadCronogramaFoliar } from '../src/lib/planejamentoFoliar.js';

const talhoes = [
  { id: 't1', codigo_produtor: 'P001', nome: 'Talhao 1', area_ha: 2 },
  { id: 't2', codigo_produtor: 'P001', nome: 'Talhao 2', area_ha: 3 },
  { id: 'x1', codigo_produtor: 'P002', nome: 'Outro produtor', area_ha: 5 },
];

test('normaliza unidades liquidas L/ha, ml/ha e ml/20 L', () => {
  assert.equal(normalizarDoseProdutoFoliar({ dose: '2', unidade: 'L/ha' }).dose_normalizada, 2);
  assert.equal(normalizarDoseProdutoFoliar({ dose: '600', unidade: 'ml/ha' }).dose_normalizada, 0.6);
  assert.equal(normalizarDoseProdutoFoliar({ dose: '50', unidade: 'ml/20 L' }, { volumeCaldaHa: 200 }).dose_normalizada, 0.5);
});

test('normaliza unidades solidas kg/ha, g/ha e g/20 L', () => {
  assert.equal(normalizarDoseProdutoFoliar({ dose: '2', unidade: 'kg/ha' }).dose_normalizada, 2);
  assert.equal(normalizarDoseProdutoFoliar({ dose: '500', unidade: 'g/ha' }).dose_normalizada, 0.5);
  assert.equal(normalizarDoseProdutoFoliar({ dose: '250', unidade: 'g/20 L' }, { volumeCaldaHa: 200 }).dose_normalizada, 2.5);
});

test('marca Revisar unidade quando falta volume de calda, unidade desconhecida ou dose textual', () => {
  const semVolume = normalizarDoseProdutoFoliar({ dose: '50', unidade: 'ml/20 L' });
  const unidadeDesconhecida = normalizarDoseProdutoFoliar({ dose: '2', unidade: 'frasco' });
  const doseTextual = normalizarDoseProdutoFoliar({ dose: 'duas tampas', unidade: 'L/ha' });

  assert.equal(semVolume.status_unidade, 'revisar_unidade');
  assert.equal(unidadeDesconhecida.status_unidade, 'revisar_unidade');
  assert.equal(doseTextual.status_unidade, 'revisar_unidade');
});

test('preserva valores zero sem gerar NaN', () => {
  const doseZero = calcularCustoProdutoFoliarDetalhado({ dose: '0', unidade: 'L/ha', preco: '10' }, { areaHa: 2 });
  const precoZero = calcularCustoProdutoFoliarDetalhado({ dose: '2', unidade: 'L/ha', preco: '0' }, { areaHa: 2 });

  assert.equal(doseZero.valido, true);
  assert.equal(doseZero.custo_ha, 0);
  assert.equal(precoZero.valido, true);
  assert.equal(precoZero.custo_total, 0);
  assert.equal(Number.isNaN(doseZero.custo_ha), false);
});

test('corrige Supera registrado como 2 ml/20 L de agua para 2 L/ha', () => {
  const produto = normalizarProdutosAplicacaoFoliar([
    { produto_nome: '  suPEra ', dose: '2', unidade: 'ml/20 L de água', preco: '30' },
  ], { volumeCaldaHa: 200 })[0];
  const custo = calcularCustoProdutoFoliarDetalhado(produto, { areaHa: 4 });

  assert.equal(produto.dose, 2);
  assert.equal(produto.unidade, 'L/ha');
  assert.equal(produto.dose_normalizada, 2);
  assert.equal(produto.unidade_normalizada, 'L/ha');
  assert.equal(custo.custo_ha, 60);
  assert.equal(custo.custo_total, 240);
});

test('migracao idempotente do Supera conta e corrige base de insumos e receitas', () => {
  const entrada = [
    { id: 'ins1', nome: 'Supera', dose_producao: '2', unidade_aplicacao: 'ml/20 L de água' },
    {
      id: 'rec1',
      volume_calda_ha: 200,
      produtos: [{ produto_nome: 'Supera', dose: '2', unidade: 'ml/20 L de água' }],
    },
  ];

  const primeira = migrarSuperaFoliar(entrada);
  const segunda = migrarSuperaFoliar(primeira.registros);

  assert.equal(primeira.alteracoes, 2);
  assert.equal(primeira.registros[0].dose_producao, '2');
  assert.equal(primeira.registros[0].unidade_aplicacao, 'L/ha');
  assert.equal(primeira.registros[1].produtos[0].unidade, 'L/ha');
  assert.equal(segunda.alteracoes, 0);
});

test('calcula custos liquidos, solidos e multiplos talhoes pela area total', () => {
  const aplicacao = {
    talhao_ids: ['t1', 't2'],
    produtos: [
      { produto_nome: 'Liquido', dose: '2', unidade: 'L/ha', preco: '10' },
      { produto_nome: 'Solido', dose: '500', unidade: 'g/ha', preco: '8' },
    ],
  };
  const resumo = calcularResumoAplicacaoFoliar(aplicacao, talhoes);

  assert.equal(resumo.areaHa, 5);
  assert.equal(resumo.custoHa, 24);
  assert.equal(resumo.custoTotal, 120);
});

test('produto invalido nao entra no total e retorna custo pendente', () => {
  const custo = calcularCustoProdutoFoliarDetalhado({ dose: '2', unidade: 'frasco', preco: '10' }, { areaHa: 2 });
  const resumo = calcularResumoAplicacaoFoliar({
    talhao_ids: ['t1'],
    produtos: [
      { produto_nome: 'Valido', dose: '1', unidade: 'kg/ha', preco: '5' },
      { produto_nome: 'Invalido', dose: '2', unidade: 'frasco', preco: '10' },
    ],
  }, talhoes);

  assert.equal(custo.pendente, true);
  assert.equal(custo.motivo, CUSTO_PENDENTE_FOLIAR);
  assert.equal(resumo.custoTotal, 10);
  assert.equal(resumo.pendencias, 1);
});

test('exige data ou periodo antes da persistencia', () => {
  assert.equal(validarPeriodoAplicacaoFoliar({ titulo: 'Sem data' }), false);
  assert.equal(validarPeriodoAplicacaoFoliar({ data_prevista: '2026-08-10' }), true);
  assert.equal(validarPeriodoAplicacaoFoliar({ periodo_aplicacao: 'OUT/NOV' }), true);
  assert.equal(validarPeriodoAplicacaoFoliar({ meses: ['JAN'] }), true);
});

test('payload persiste campos de periodo e dose normalizada', () => {
  const produto = normalizarProdutosAplicacaoFoliar([
    { produto_nome: 'Produto', dose: '600', unidade: 'ml/ha', preco: '20' },
  ])[0];
  const payload = limparPayloadCronogramaFoliar({
    codigo_produtor: 'P001',
    safra: '2026/2027',
    data_prevista: '2026-08-10',
    periodo_aplicacao: 'AGO',
    produtos: [produto],
  });

  assert.equal(payload.data_prevista, '2026-08-10');
  assert.equal(payload.periodo_aplicacao, 'AGO');
  assert.equal(payload.produtos[0].dose_normalizada, 0.6);
  assert.equal(payload.produtos[0].unidade_original, 'ml/ha');
});

test('normalizacao nao duplica aplicacao com varios talhoes e respeita produtor e safra', () => {
  const resultado = normalizarAplicacoesFoliares([], [{
    id: 'c1',
    codigo_produtor: 'P001',
    safra: '2026/2027',
    talhao_ids: ['t1', 't2'],
    periodo_aplicacao: 'OUT/NOV',
    produtos: [{ produto_nome: 'Produto', dose: '1', unidade: 'L/ha', preco: '10' }],
  }, {
    id: 'c2',
    codigo_produtor: 'P002',
    safra: '2025/2026',
    talhao_ids: ['x1'],
    periodo_aplicacao: 'OUT',
  }], talhoes);

  assert.deepEqual(resultado.filter(a => a.codigo_produtor === 'P001').map(a => a.talhao_id), ['t1', 't2']);
  assert.equal(new Set(resultado.map(a => a.id)).size, resultado.length);
  assert.equal(resultado.find(a => a.talhao_id === 'x1').safra, '2025/2026');
  assert.equal(formatarDoseNormalizadaFoliar(resultado[0].produtos[0]), '1 L/ha');
});
