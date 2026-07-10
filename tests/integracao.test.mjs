import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarPlanosAdubacao,
  normalizarAplicacoesFoliares,
  calcularCustoAdubacaoHa,
  proximoCodigoProdutor,
} from '../src/lib/integracaoPlanejamentos.js';
import { consolidarPrecosItens } from '../src/lib/notasFiscais.js';

test('Adubação 2.0 é convertida para calendário e custos sem depender do módulo antigo', () => {
  const resultado = normalizarPlanosAdubacao([], [{
    id: 'plan1', codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1', talhao_nome: 'Sede',
    detalhamento: {
      produtoSugerido: { id: 'prod1', nome: '20-05-20' },
      doseProdutoHa: 300,
      precos: { prod1: 2.5 },
      parcelamentos: { prod1: { parcelas: [{ pct: 60, meses: ['OUT', 'NOV'] }, { pct: 40, meses: ['JAN'] }] } },
      complementos: [{ produto: { id: 'prod2', nome: 'Ácido bórico' }, doseKgHa: 30 }],
    },
  }]);

  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].produto_nome, '20-05-20');
  assert.deepEqual(resultado[0].meses, [['OUT', 'NOV', 'JAN']]);
  assert.equal(calcularCustoAdubacaoHa(resultado[0]), 750);
  assert.equal(resultado[1].produto_nome, 'Ácido bórico');
});

test('cronograma foliar com vários talhões é expandido e usa o mês da data limite', () => {
  const resultado = normalizarAplicacoesFoliares([], [{
    id: 'c1', codigo_produtor: 'P001', safra: '2026/2027', data_limite: '2026-08-10',
    talhao_ids: ['t1', 't2'], produtos: [{ produto_nome: 'Cobre', dose: 1, preco: 20 }],
  }], [{ id: 't1', nome: 'Sede' }, { id: 't2', nome: 'Baixada' }]);

  assert.equal(resultado.length, 2);
  assert.deepEqual(resultado.map(x => x.meses), [['AGO'], ['AGO']]);
  assert.deepEqual(resultado.map(x => x.talhao_nome), ['Sede', 'Baixada']);
});

test('próximo código de produtor usa o maior número e não a quantidade de registros', () => {
  assert.equal(proximoCodigoProdutor([{ codigo: 'P001' }, { codigo: 'P003' }]), 'P004');
  assert.equal(proximoCodigoProdutor([]), 'P001');
});

test('preço médio de notas fiscais é ponderado pela quantidade', () => {
  const tabela = consolidarPrecosItens([
    { produto_nome: 'Ureia', unidade_medida: 'SC', quantidade: 1, preco_unitario: 100, nota_fiscal_id: 'n1' },
    { produto_nome: 'Ureia', unidade_medida: 'SC', quantidade: 9, preco_unitario: 200, nota_fiscal_id: 'n2' },
  ]);
  assert.equal(tabela.length, 1);
  assert.equal(tabela[0].preco_medio, 190);
  assert.equal(tabela[0].num_notas, 2);
});
