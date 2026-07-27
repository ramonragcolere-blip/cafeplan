import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularBalancoNutrientes,
  listaSeguraAdubacao2,
  MENSAGEM_FALLBACK_ADUBACAO2,
  montarProdutosEfetivosPlanejamento,
  normalizarComplementosAdubacao2,
  normalizarProdutoAdubacao2,
  objetoSeguroAdubacao2,
} from '../src/lib/planejamentoProdutosAdubacao2.js';
import { consolidarPlanejamentosPorTalhao } from '../src/lib/planejamentoAdubacao2.js';

const ureia = { id: 'ureia', nome: 'Ureia', _tipo: 'fonte', n_pct: 45, p2o5_pct: 0, k2o_pct: 0, b_pct: 0 };
const map = { id: 'map', nome: 'MAP', _tipo: 'fonte', n_pct: 11, p2o5_pct: 52, k2o_pct: 0, b_pct: 0 };
const boro = { id: 'boro', nome: 'Ácido bórico', _tipo: 'fonte', n_pct: 0, p2o5_pct: 0, k2o_pct: 0, b_pct: 17 };
const talhao1 = { id: 't1', nome: 'Talhão 1', area_ha: 2 };
const talhao2 = { id: 't2', nome: 'Talhão 2', area_ha: 3 };
const rec = { N: 90, P: 52, K: 0, B: 1.7 };

function montar({ resultados = [], registrosSalvos = [], todos = [ureia, map, boro], extrasPorTalhao = {}, ajustesDosePorTalhao = {} } = {}) {
  return montarProdutosEfetivosPlanejamento({
    resultados,
    registrosSalvos,
    todosFiltrados: todos,
    todosCatalogo: todos,
    extrasPorTalhao,
    ajustesDosePorTalhao,
  });
}

test('selecionar produtor sem planejamento nao gera tela branca', () => {
  assert.doesNotThrow(() => montar({ resultados: [{ talhao: talhao1, rec }] }));
});

test('selecionar produtor com planejamento antigo aceita complementos em objeto', () => {
  const antigos = [{
    talhao_id: 't1',
    detalhamento: {
      produtoSugerido: { id: 'ureia', nome: 'Ureia' },
      doseProdutoHa: 200,
      complementos: {
        boro: { produto: { id: 'boro', nome: 'Ácido bórico' }, doseKgHa: 10, nutKey: 'b_pct' },
      },
    },
  }];
  const mapa = montar({
    resultados: [{ talhao: talhao1, rec, produtoSugerido: ureia, doseProdutoHa: 200, temRegistroSalvo: true }],
    registrosSalvos: antigos,
  });

  assert.equal(mapa.t1.produto.id, 'ureia');
  assert.equal(mapa.t1.complementos.some(c => c.produto.id === 'boro'), true);
});

test('selecionar produtor com planejamento da PR 15 preserva dose manual', () => {
  const mapa = montar({
    resultados: [{ talhao: talhao1, rec, produtoSugerido: ureia, doseProdutoHa: 250, temRegistroSalvo: true }],
    ajustesDosePorTalhao: {
      t1: { 'n_pct:ureia': { dose_calculada_kg_ha: 200, dose_utilizada_kg_ha: 250, dose_ajustada_manualmente: true } },
    },
  });

  assert.equal(mapa.t1.dose_calculada_kg_ha, 200);
  assert.equal(mapa.t1.dose_utilizada_kg_ha, 250);
  assert.equal(mapa.t1.dose_ajustada_manualmente, true);
});

test('trocar entre dois produtores nao mistura planejamentos', () => {
  const registros = [
    { id: 'p1', codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'ureia' }, doseProdutoHa: 200 } },
    { id: 'p2', codigo_produtor: 'P002', safra: '2026/2027', talhao_id: 't2', detalhamento: { produtoSugerido: { id: 'map' }, doseProdutoHa: 100 } },
  ];
  const p1 = consolidarPlanejamentosPorTalhao(registros.filter(r => r.codigo_produtor === 'P001'));
  const p2 = consolidarPlanejamentosPorTalhao(registros.filter(r => r.codigo_produtor === 'P002'));

  assert.equal(p1.length, 1);
  assert.equal(p1[0].talhao_id, 't1');
  assert.equal(p2[0].talhao_id, 't2');
});

test('trocar entre duas safras usa somente registros da safra atual', () => {
  const registros = [
    { id: 's1', codigo_produtor: 'P001', safra: '2025/2026', talhao_id: 't1' },
    { id: 's2', codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1' },
  ];
  const safraNova = consolidarPlanejamentosPorTalhao(registros.filter(r => r.safra === '2026/2027'));

  assert.equal(safraNova.length, 1);
  assert.equal(safraNova[0].id, 's2');
});

test('safra sem analises e safra sem talhoes nao quebram montagem', () => {
  assert.deepEqual(montar({ resultados: [] }), {});
  assert.doesNotThrow(() => montar({ resultados: [{ talhao: talhao1, rec: null }] }));
});

test('detalhamento null e produtos null ou vazios sao aceitos', () => {
  assert.deepEqual(objetoSeguroAdubacao2(null), {});
  assert.deepEqual(listaSeguraAdubacao2(null), []);
  assert.equal(normalizarProdutoAdubacao2(null), null);
  assert.doesNotThrow(() => montar({
    resultados: [{ talhao: talhao1, rec, produtoSugerido: null, doseProdutoHa: null }],
    registrosSalvos: [{ talhao_id: 't1', detalhamento: null }],
  }));
});

test('produto salvo sem id nao causa tela branca', () => {
  const produtoSemId = normalizarProdutoAdubacao2({ nome: 'Produto sem id', n_pct: 45 });
  const mapa = montar({
    resultados: [{ talhao: talhao1, rec, produtoSugerido: produtoSemId, doseProdutoHa: 200, temRegistroSalvo: true }],
    todos: [produtoSemId, ureia],
  });

  assert.equal(mapa.t1.produto.nome, 'Produto sem id');
});

test('complemento antigo sem nutriente_alvo recebe fallback seguro', () => {
  const [comp] = normalizarComplementosAdubacao2([{ produto: { id: 'boro', nome: 'Ácido bórico' }, doseKgHa: 10, nutKey: 'b_pct' }]);

  assert.equal(comp.nutriente_alvo, 'b_pct');
  assert.equal(comp.dose_utilizada_kg_ha, 10);
});

test('extra manual incompleto e troca rapida de produtor e safra nao quebram', () => {
  assert.doesNotThrow(() => montar({
    resultados: [{ talhao: talhao1, rec }],
    extrasPorTalhao: { t1: { 'manual-1': { produtoId: '', doseKgHa: '', isManualLivre: true } } },
  }));
  assert.doesNotThrow(() => {
    montar({ resultados: [{ talhao: talhao1, rec }] });
    montar({ resultados: [{ talhao: talhao2, rec: null }], registrosSalvos: [{ talhao_id: 't2', detalhamento: null }] });
  });
});

test('ausencia de mistura entre produtores preserva produtos adicionados por talhao', () => {
  const p1 = montar({
    resultados: [{ talhao: talhao1, rec }],
    extrasPorTalhao: { t1: { 'manual-map': { produtoId: 'map', doseKgHa: 100, isManualLivre: true, usoSeparado: true, nutriente_alvo: 'p2o5_pct' } } },
  });
  const p2 = montar({ resultados: [{ talhao: talhao2, rec }] });

  assert.equal(p1.t1.complementos.some(c => c.produto.id === 'map'), true);
  assert.equal(p2.t2.complementos.some(c => c.produto.id === 'map'), false);
});

test('preserva doses manuais e produtos adicionados', () => {
  const mapa = montar({
    resultados: [{ talhao: talhao1, rec, produtoSugerido: ureia, doseProdutoHa: 250 }],
    extrasPorTalhao: { t1: { 'manual-map': { produtoId: 'map', doseKgHa: 100, isManualLivre: true, usoSeparado: true, nutriente_alvo: 'p2o5_pct' } } },
    ajustesDosePorTalhao: { t1: { 'n_pct:ureia': { dose_calculada_kg_ha: 200, dose_utilizada_kg_ha: 250, dose_ajustada_manualmente: true } } },
  });

  assert.equal(mapa.t1.dose_utilizada_kg_ha, 250);
  assert.equal(mapa.t1.complementos.some(c => c.produto.id === 'map' && c.dose_utilizada_kg_ha === 100), true);
});

test('ausencia de tela branca: formatos legados nao lancam TypeError de map/filter/Object.keys', () => {
  assert.doesNotThrow(() => normalizarComplementosAdubacao2({ boro: { produto_nome: 'Boro', dose_kg_ha: 10 } }));
  assert.doesNotThrow(() => montar({
    resultados: [{ talhao: talhao1, rec, produtoSugerido: { nome: 'Produto legado' }, doseProdutoHa: 1 }],
    registrosSalvos: [{ talhao_id: 't1', detalhamento: { complementos: { boro: { produto_nome: 'Boro', dose_kg_ha: 10 } } } }],
    extrasPorTalhao: null,
    ajustesDosePorTalhao: null,
  }));
});

test('fallback visual existe e nao apaga dados', () => {
  const dados = [{ talhao_id: 't1', detalhamento: { complementos: { boro: { produto_nome: 'Boro' } } } }];
  const copia = JSON.stringify(dados);

  assert.equal(MENSAGEM_FALLBACK_ADUBACAO2, 'Não foi possível carregar este planejamento. Os dados não foram apagados.');
  assert.equal(JSON.stringify(dados), copia);
});

test('balanco nutricional continua funcionando apos normalizacao legada', () => {
  const comps = normalizarComplementosAdubacao2({ map: { produto: map, doseKgHa: 100, nutKey: 'p2o5_pct' } });
  const balanco = calcularBalancoNutrientes(rec, [{ produto: ureia, doseKgHa: 200 }, ...comps.map(comp => ({ produto: comp.produto, doseKgHa: comp.doseKgHa }))]);

  assert.equal(Math.round(balanco.find(item => item.nutriente === 'P').fornecido), 52);
  assert.equal(Math.round(balanco.find(item => item.nutriente === 'N').fornecido), 101);
});
