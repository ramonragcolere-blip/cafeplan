import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lerSchemasEntidades,
  listarPropriedadesDuplicadasJsonc,
  validarPayloadEntidade,
} from './helpers/validarPayloadEntidade.mjs';
import { criarCafePlanQa2Fixtures } from '../../src/testing/qa2/fixtures/cafeplanQa2Fixtures.js';
import { montarPayloadGessagem } from '../../src/lib/gessagemAdubacao2.js';
import { montarPayloadPlanejamentoTalhaoAdubacao2 } from '../../src/lib/calculoIndividualAdubacao2.js';

const schemas = lerSchemasEntidades();
const tiposValidos = new Set(['string', 'number', 'integer', 'boolean', 'object', 'array']);

test('todos os schemas Base44 sao JSONC validos com nome e propriedades', () => {
  assert.ok(schemas.size > 0);
  for (const [nome, entrada] of schemas) {
    assert.equal(entrada.schema.name, nome);
    assert.equal(entrada.schema.type, 'object');
    assert.equal(typeof entrada.schema.properties, 'object', `${entrada.arquivo} sem properties`);
    assert.deepEqual(listarPropriedadesDuplicadasJsonc(entrada.texto), [], `${entrada.arquivo} possui propriedades duplicadas`);
  }
});

test('schemas usam tipos validos e required aponta para campos existentes', () => {
  for (const [nome, entrada] of schemas) {
    const propriedades = entrada.schema.properties || {};
    for (const [campo, definicao] of Object.entries(propriedades)) {
      assert.ok(tiposValidos.has(definicao.type), `${nome}.${campo} usa tipo invalido ${definicao.type}`);
    }
    for (const campo of entrada.schema.required || []) {
      assert.ok(propriedades[campo], `${nome} required inexistente: ${campo}`);
    }
  }
});

test('contratos explicitos possuem campos recentes exigidos pela QA 2.0', () => {
  const exigidos = {
    PlanejamentoAdubacao2: ['codigo_produtor', 'safra', 'talhao_id', 'detalhamento'],
    BaseRecomendacaoCalagem: ['codigo_produtor', 'safra', 'talhao_id', 'preco_unitario', 'unidade_preco', 'cao_calcario_pct', 'dose_kg_ha'],
    BaseRecomendacaoGessagem: ['codigo_produtor', 'safra', 'talhao_id', 'dose_final_kg_ha', 'metodo_calculo', 'preco_unitario', 'unidade_preco'],
    AnaliseSolo: ['talhao_id', 'safra', 'fosforo', 'potassio', 'calcio', 'magnesio'],
    FertilizanteFormulado: ['nome', 'b_pct', 'zn_pct', 'cao_pct'],
    FonteSimples: ['nome', 'cao_pct'],
    Produtor: ['codigo', 'nome'],
    Talhao: ['codigo_produtor', 'nome'],
  };

  for (const [nomeEntidade, campos] of Object.entries(exigidos)) {
    const schema = schemas.get(nomeEntidade)?.schema;
    assert.ok(schema, `schema ausente: ${nomeEntidade}`);
    for (const campo of campos) {
      assert.ok(schema.properties?.[campo], `${nomeEntidade} sem campo ${campo}`);
    }
  }
});

test('payloads criticos gerados pelo codigo sao compativeis com schemas Base44', () => {
  const fixtures = criarCafePlanQa2Fixtures();
  const talhao = fixtures.Talhao[0];
  const ureia = fixtures.FertilizanteFormulado.find(produto => produto.id === 'ureia');
  const gesso = fixtures.FertilizanteFormulado.find(produto => produto.id === 'gesso-agricola');

  const payloadPlanejamento = montarPayloadPlanejamentoTalhaoAdubacao2({
    resultado: {
      talhao,
      rec: { N: 90, P: 52, K: 120, B: 1.7 },
      produtoSugerido: ureia,
      doseProdutoHa: 200,
      mediaBienal: 31,
    },
    produtor: fixtures.Produtor[0],
    safra: '2026/2027',
    produtividadeLocal: { [talhao.id]: { safra1: 30, safra2: 32 } },
    produtoEfetivo: { produto: ureia, doseKgHa: 200, complementos: [] },
  });
  assert.equal(Array.isArray(payloadPlanejamento.detalhamento?.parcelamentos), false);
  validarPayloadEntidade('PlanejamentoAdubacao2', payloadPlanejamento, schemas);

  const { id: _idCalagem, updated_date: _updatedCalagem, ...payloadCalagem } = fixtures.BaseRecomendacaoCalagem[1];
  validarPayloadEntidade('BaseRecomendacaoCalagem', payloadCalagem, schemas);

  const payloadGessagem = montarPayloadGessagem({
    codigoProdutor: 'P002',
    safra: '2026/2027',
    talhao,
    analise2040: fixtures.PlanejamentoAdubacao2[0].analise2040,
    produto: gesso,
    doseCalcarioKgHa: 1500,
    caoCalcarioPct: 35,
    caoGessoPct: 25,
    argilaManual: 35,
    doseFinalKgHa: 525,
    metodoCalculo: 'combinado_conservador',
    faixa5aPosicao: 'media',
    doseMatematicaKgHa: 525,
    doseTecnicaKgHa: 525,
    calagemImportada: {
      produtoId: 'calcario-dolomitico',
      produtoNome: 'Calcário dolomítico',
      precoUnitario: 500,
      unidadePreco: 't',
      prnt: 88,
      caPct: 26,
      mgPct: 12,
    },
    precoUnitario: 450,
    unidadePreco: 't',
  });
  validarPayloadEntidade('BaseRecomendacaoGessagem', payloadGessagem, schemas);
});

test('validarPayloadEntidade falha com campo inexistente no schema', () => {
  assert.throws(
    () => validarPayloadEntidade('BaseRecomendacaoGessagem', {
      codigo_produtor: 'P002',
      safra: '2026/2027',
      talhao_id: 'talhao-a',
      campo_inexistente: true,
    }, schemas),
    /Campo desconhecido em BaseRecomendacaoGessagem: campo_inexistente/
  );
});
