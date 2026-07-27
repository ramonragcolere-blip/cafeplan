import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAFRA_VAZIA_DASHBOARD,
  categorizarStatusPlanejamento,
  opcoesSafraDashboard,
  resolverSafraDashboard,
} from '../src/lib/dashboardPlanejamento.js';
import {
  atualizarProdutoReceitaFoliar,
  calcularResumoAplicacaoFoliar,
  formatarDoseNormalizadaFoliar,
  normalizarProdutosAplicacaoFoliar,
  produtoReceitaFoliarDeInsumo,
  removerProdutoReceitaFoliar,
} from '../src/lib/unidadesAplicacoesFoliares.js';

const talhoes = [
  { id: 't1', codigo_produtor: 'P001', area_ha: 2 },
  { id: 't2', codigo_produtor: 'P001', area_ha: 3 },
  { id: 'x1', codigo_produtor: 'P002', area_ha: 4 },
];

const insumos = [
  { id: 'supera', nome: 'Supera', dose_producao: '2', unidade_aplicacao: 'ml/20 L de água', grupo: 'Fertilizante Foliar' },
  { id: 'boro', nome: 'Boro', dose_producao: '500', unidade_aplicacao: 'g/ha', grupo: 'Fertilizante Foliar' },
  { id: 'fung', nome: 'Fungicida', dose_producao: '1', unidade_aplicacao: 'L/ha', grupo: 'Fungicida' },
];

test('seletor de safra tem opcoes renderizaveis quando ha safras', () => {
  const opcoes = opcoesSafraDashboard(['2026/2027', '2025/2026']);

  assert.deepEqual(opcoes, [
    { value: '2026/2027', label: '2026/2027', disabled: false },
    { value: '2025/2026', label: '2025/2026', disabled: false },
  ]);
});

test('seletor de safra permanece visivel com lista vazia', () => {
  const opcoes = opcoesSafraDashboard([]);

  assert.equal(opcoes.length, 1);
  assert.equal(opcoes[0].value, SAFRA_VAZIA_DASHBOARD);
  assert.equal(opcoes[0].label, 'Sem safras disponíveis');
  assert.equal(opcoes[0].disabled, true);
});

test('selecao de produtor e safra resolve safra ativa sem misturar safras', () => {
  assert.equal(resolverSafraDashboard('2025/2026', ['2026/2027', '2025/2026']), '2025/2026');
  assert.equal(resolverSafraDashboard('', ['2026/2027', '2025/2026']), '2026/2027');

  const { totais } = categorizarStatusPlanejamento({
    talhoes,
    codigoProdutor: 'P001',
    safra: '2026/2027',
    planos: [
      { codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1', status: 'planejado' },
      { codigo_produtor: 'P001', safra: '2025/2026', talhao_id: 't2', status: 'concluido' },
      { codigo_produtor: 'P002', safra: '2026/2027', talhao_id: 'x1', status: 'concluido' },
    ],
  });

  assert.equal(totais.planejado, 1);
  assert.equal(totais.concluido, 0);
  assert.equal(totais.semPlanejamento, 1);
});

test('edicao da dose recalcula normalizacao e custos', () => {
  const produtos = [{ produto_id: 'fung', produto_nome: 'Fungicida', dose: '1', unidade: 'L/ha', preco: '10' }];
  const editados = atualizarProdutoReceitaFoliar(produtos, 0, { dose: '2' }, { insumos });
  const resumo = calcularResumoAplicacaoFoliar({ talhao_ids: ['t1'], produtos: editados }, talhoes);

  assert.equal(editados[0].dose_normalizada, 2);
  assert.equal(resumo.custoHa, 20);
  assert.equal(resumo.custoTotal, 40);
});

test('edicao da unidade recalcula quantidade total', () => {
  const produtos = [{ produto_id: 'boro', produto_nome: 'Boro', dose: '500', unidade: 'g/ha', preco: '8' }];
  const editados = atualizarProdutoReceitaFoliar(produtos, 0, { unidade: 'kg/ha', dose: '1' }, { insumos });
  const resumo = calcularResumoAplicacaoFoliar({ talhao_ids: ['t1'], produtos: editados }, talhoes);

  assert.equal(editados[0].dose_normalizada, 1);
  assert.equal(resumo.produtos[0].custo.quantidade_total, 2);
});

test('edicao do preco atualiza custo por hectare', () => {
  const produtos = [{ produto_id: 'fung', produto_nome: 'Fungicida', dose: '1', unidade: 'L/ha', preco: '10' }];
  const editados = atualizarProdutoReceitaFoliar(produtos, 0, { preco: '15' }, { insumos });
  const resumo = calcularResumoAplicacaoFoliar({ talhao_ids: ['t1'], produtos: editados }, talhoes);

  assert.equal(resumo.custoHa, 15);
});

test('troca do produto atualiza nome, dose e unidade do insumo selecionado', () => {
  const produtos = [{ produto_id: 'fung', produto_nome: 'Fungicida', dose: '1', unidade: 'L/ha', preco: '10' }];
  const editados = atualizarProdutoReceitaFoliar(produtos, 0, { produto_id: 'boro', preco: '8' }, { insumos });

  assert.equal(editados[0].produto_nome, 'Boro');
  assert.equal(editados[0].dose, '500');
  assert.equal(editados[0].unidade, 'g/ha');
  assert.equal(editados[0].dose_normalizada, 0.5);
});

test('exclusao remove somente um produto e nao exclui a aplicacao', () => {
  const aplicacao = {
    id: 'ap1',
    talhao_ids: ['t1'],
    produtos: [
      { produto_nome: 'Fungicida', dose: '1', unidade: 'L/ha', preco: '10' },
      { produto_nome: 'Boro', dose: '500', unidade: 'g/ha', preco: '8' },
    ],
  };
  const produtos = removerProdutoReceitaFoliar(aplicacao.produtos, 0);
  const atualizada = { ...aplicacao, produtos };

  assert.equal(atualizada.id, 'ap1');
  assert.equal(atualizada.produtos.length, 1);
  assert.equal(atualizada.produtos[0].produto_nome, 'Boro');
});

test('persistencia apos salvar preserva edicoes ao reabrir receita', () => {
  const produtos = [{ produto_id: 'fung', produto_nome: 'Fungicida', dose: '1', unidade: 'L/ha', preco: '10' }];
  const editados = atualizarProdutoReceitaFoliar(produtos, 0, { dose: '2', unidade: 'L/ha', preco: '15' }, { insumos });
  const payloadSalvo = {
    id: 'ap1',
    talhao_ids: ['t1'],
    produtos: normalizarProdutosAplicacaoFoliar(editados),
  };
  const reaberto = payloadSalvo.produtos[0];

  assert.equal(reaberto.dose, '2');
  assert.equal(reaberto.unidade, 'L/ha');
  assert.equal(reaberto.preco, '15');
  assert.equal(reaberto.dose_normalizada, 2);
});

test('pendencias atualizam quando unidade invalida e voltam ao corrigir', () => {
  const invalido = atualizarProdutoReceitaFoliar([
    { produto_nome: 'Duvidoso', dose: '2', unidade: 'frasco', preco: '10' },
  ], 0, { unidade: 'frasco' }, { insumos });
  const pendente = calcularResumoAplicacaoFoliar({ talhao_ids: ['t1'], produtos: invalido }, talhoes);
  const corrigido = atualizarProdutoReceitaFoliar(invalido, 0, { unidade: 'L/ha' }, { insumos });
  const ok = calcularResumoAplicacaoFoliar({ talhao_ids: ['t1'], produtos: corrigido }, talhoes);

  assert.equal(pendente.pendencias, 1);
  assert.equal(ok.pendencias, 0);
});

test('Supera permanece em 2 L/ha ao adicionar e editar produto', () => {
  const supera = produtoReceitaFoliarDeInsumo(insumos[0], { preco: '30' }, { volumeCaldaHa: 200 });
  const editado = atualizarProdutoReceitaFoliar([supera], 0, { unidade: 'ml/20 L de água' }, {
    volumeCaldaHa: 200,
    insumos,
  })[0];

  assert.equal(supera.dose, 2);
  assert.equal(supera.unidade, 'L/ha');
  assert.equal(editado.dose, 2);
  assert.equal(editado.unidade, 'L/ha');
  assert.equal(formatarDoseNormalizadaFoliar(editado), '2 L/ha');
});
