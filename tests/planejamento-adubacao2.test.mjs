import test from 'node:test';
import assert from 'node:assert/strict';
import {
  combinarCatalogoInsumos,
  contarUsoProdutoPlanejamento,
  filtrarProdutosPlanejamento,
  listarNutrientesNaoAtendidos,
  montarLinhasProdutos,
  montarProdutosEfetivosPlanejamento,
} from '../src/lib/planejamentoProdutosAdubacao2.js';
import { consolidarPlanejamentosPorTalhao } from '../src/lib/planejamentoAdubacao2.js';
import { consolidarComprasAdubacao2, montarGruposResumoAdubacao2 } from '../src/lib/calagemAdubacao2.js';

const ureia = { id: 'ureia', nome: 'Ureia', _tipo: 'fonte', n_pct: 45, p2o5_pct: 0, k2o_pct: 0, b_pct: 0 };
const kcl = { id: 'kcl', nome: 'KCl', _tipo: 'fonte', n_pct: 0, p2o5_pct: 0, k2o_pct: 60, b_pct: 0 };
const formuladoA = { id: 'npk-a', nome: '20-00-20 A', fornecedor: 'Fornecedor A', _tipo: 'formulado', n_pct: 20, p2o5_pct: 0, k2o_pct: 20, b_pct: 0 };
const formuladoB = { id: 'npk-b', nome: '12-00-12 B', fornecedor: 'Fornecedor B', _tipo: 'formulado', n_pct: 12, p2o5_pct: 0, k2o_pct: 12, b_pct: 0 };
const recNK = { N: 90, P: 0, K: 120, B: 0 };
const talhao = { id: 't1', nome: 'Talhao 1', area_ha: 2, num_plantas: 1000, espacamento: '3,5x0,7' };

test('fornecedor selecionado nao inclui fontes simples sem fornecedor por padrao', () => {
  const filtrados = filtrarProdutosPlanejamento([formuladoA, formuladoB, ureia], {
    fornecedores: ['Fornecedor A'],
    produtoId: '',
    incluirFontesSemFornecedor: false,
  });

  assert.deepEqual(filtrados.map(p => p.id), ['npk-a']);
});

test('opcao explicita inclui fontes simples sem fornecedor', () => {
  const filtrados = filtrarProdutosPlanejamento([formuladoA, formuladoB, ureia], {
    fornecedores: ['Fornecedor A'],
    produtoId: '',
    incluirFontesSemFornecedor: true,
  });

  assert.deepEqual(filtrados.map(p => p.id).sort(), ['npk-a', 'ureia']);
});

test('produto especifico e usado exclusivamente na recomendacao', () => {
  const filtrados = filtrarProdutosPlanejamento([formuladoA, ureia, kcl], { produtoId: 'kcl' });
  const linhas = montarLinhasProdutos(filtrados, recNK);

  assert.deepEqual(linhas.map(l => l.produto.id), ['kcl']);
});

test('produto especifico incapaz mostra nutrientes nao atendidos', () => {
  const linhas = montarLinhasProdutos([kcl], recNK);
  const naoAtendidos = listarNutrientesNaoAtendidos(recNK, linhas);

  assert.deepEqual(naoAtendidos, ['N']);
});

test('substituir produto salvo usa filtro atual e ignora Ureia salva', () => {
  const mapa = montarProdutosEfetivosPlanejamento({
    resultados: [{
      talhao,
      rec: recNK,
      produtoSugerido: formuladoA,
      doseProdutoHa: 450,
      temRegistroSalvo: true,
      substituirSalvo: true,
    }],
    registrosSalvos: [{
      talhao_id: 't1',
      detalhamento: { produtoSugerido: { id: 'ureia', nome: 'Ureia' }, doseProdutoHa: 200 },
    }],
    todosFiltrados: [formuladoA],
    todosCatalogo: [formuladoA, ureia],
  });

  assert.equal(mapa.t1.produto.id, 'npk-a');
  assert.equal(mapa.t1.complementos.some(c => c.produto.id === 'ureia'), false);
});

test('manter produto salvo preserva produto principal salvo', () => {
  const mapa = montarProdutosEfetivosPlanejamento({
    resultados: [{ talhao, rec: recNK, produtoSugerido: ureia, doseProdutoHa: 200, temRegistroSalvo: true }],
    registrosSalvos: [{ talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'ureia', nome: 'Ureia' }, doseProdutoHa: 200 } }],
    todosFiltrados: [formuladoA, ureia],
    todosCatalogo: [formuladoA, ureia],
  });

  assert.equal(mapa.t1.produto.id, 'ureia');
});

test('Ureia salva e substituida quando resultado recalculado traz outro principal', () => {
  const mapa = montarProdutosEfetivosPlanejamento({
    resultados: [{ talhao, rec: recNK, produtoSugerido: formuladoB, doseProdutoHa: 750, temRegistroSalvo: true, substituirSalvo: true }],
    registrosSalvos: [{ talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'ureia', nome: 'Ureia' }, doseProdutoHa: 200 } }],
    todosFiltrados: [formuladoB],
    todosCatalogo: [formuladoB, ureia],
  });

  assert.equal(mapa.t1.produto.id, 'npk-b');
});

test('planejamentos de dois produtores nao se misturam quando filtrados por produtor', () => {
  const planejamentos = [
    { id: 'p1', codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'npk-a' } } },
    { id: 'p2', codigo_produtor: 'P002', safra: '2026/2027', talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'ureia' } } },
  ];
  const p001 = consolidarPlanejamentosPorTalhao(planejamentos.filter(p => p.codigo_produtor === 'P001' && p.safra === '2026/2027'));

  assert.equal(p001.length, 1);
  assert.equal(p001[0].detalhamento.produtoSugerido.id, 'npk-a');
});

test('troca de safra usa somente registros da safra selecionada', () => {
  const planejamentos = [
    { id: 'antiga', codigo_produtor: 'P001', safra: '2025/2026', talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'ureia' } } },
    { id: 'nova', codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'npk-a' } } },
  ];
  const safraNova = consolidarPlanejamentosPorTalhao(planejamentos.filter(p => p.codigo_produtor === 'P001' && p.safra === '2026/2027'));

  assert.equal(safraNova[0].id, 'nova');
});

test('ausencia de produtos compativeis nao cria recomendacao fora do filtro', () => {
  const linhas = montarLinhasProdutos([], recNK);

  assert.deepEqual(linhas, []);
});

test('persistencia escolhe registro recente e nao duplica por talhao', () => {
  const consolidados = consolidarPlanejamentosPorTalhao([
    { id: 'antigo', talhao_id: 't1', updated_date: '2026-07-01T10:00:00Z' },
    { id: 'novo', talhao_id: 't1', updated_date: '2026-07-02T10:00:00Z' },
  ]);

  assert.equal(consolidados.length, 1);
  assert.equal(consolidados[0].id, 'novo');
});

test('Consolidacao de Compras e Resumo Geral refletem produto substituido', () => {
  const produtosEfetivos = { t1: { produto: formuladoA, doseKgHa: 450, complementos: [] } };
  const resultados = [{ talhao, rec: recNK, produtoSugerido: ureia, doseProdutoHa: 200, mediaBienal: 30 }];
  const compras = consolidarComprasAdubacao2({ resultados, produtosEfetivos, talhoes: [talhao] });
  const resumo = montarGruposResumoAdubacao2({ resultados, produtosEfetivos, talhoes: [talhao] });

  assert.equal(compras.length, 1);
  assert.equal(compras[0].produto.id, 'npk-a');
  assert.equal(compras[0].qtdTotal, 900);
  assert.equal(resumo[0].linhas[0].produtoId, 'npk-a');
});

test('FonteSimples fica visivel no catalogo completo da Base de Insumos', () => {
  const catalogo = combinarCatalogoInsumos([formuladoA], [ureia]);
  const item = catalogo.find(p => p.nome === 'Ureia');

  assert.equal(item._tipo, 'fonte');
  assert.equal(item._origemLabel, 'Fonte simples');
});

test('contagem de uso considera produto principal e complementos', () => {
  const usos = contarUsoProdutoPlanejamento([
    { detalhamento: { produtoSugerido: { id: 'ureia' }, complementos: [] } },
    { detalhamento: { produtoSugerido: { id: 'npk-a' }, complementos: [{ produto: { id: 'ureia' } }] } },
  ], 'ureia');

  assert.equal(usos, 2);
});

test('doses calculadas sao finitas, positivas e sem NaN', () => {
  const linhas = montarLinhasProdutos([formuladoA], recNK);

  assert.ok(linhas.length > 0);
  linhas.forEach(linha => {
    assert.equal(Number.isFinite(linha.doseKgHa), true);
    assert.equal(linha.doseKgHa > 0, true);
  });
});
