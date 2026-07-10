import test from 'node:test';
import assert from 'node:assert/strict';
import {
  criarMarcacoesPadrao,
  listarElementosManuaisMarcados,
  calcularPosicaoDropdown,
} from '../src/lib/planejamentoAdubacao2.js';

const elementos = [
  { key: 'N', temRec: true },
  { key: 'P', temRec: true },
  { key: 'Zn', temRec: false },
];

test('marca automaticamente apenas nutrientes com reposição positiva', () => {
  assert.deepEqual(criarMarcacoesPadrao({ N: 120, P: 0 }, elementos), { N: true, P: false, Zn: false });
});

test('nutriente recomendado com dose zero vira linha manual quando marcado', () => {
  const manuais = listarElementosManuaisMarcados(elementos, { N: true, P: true, Zn: true }, { N: 120, P: 0 });
  assert.deepEqual(manuais.map(x => x.key), ['P', 'Zn']);
});

test('dropdown fixo usa coordenadas da viewport e permanece visível', () => {
  const pos = calcularPosicaoDropdown({ left: 900, top: 700, bottom: 730 }, 1024, 768);
  assert.ok(pos.left + pos.width <= 1016);
  assert.ok(pos.top >= 8 && pos.top < 730);
});

import { filtrarInsumosPlanejamentoFoliar } from '../src/lib/planejamentoFoliar.js';

test('planejamento foliar exibe todos os produtos ativos, inclusive grupos não previstos na lista antiga', () => {
  const produtos = [
    { id: '1', nome: 'Fertilizante X', grupo: 'Fertilizante Foliar', ativo: true },
    { id: '2', nome: 'Produto Especial', grupo: 'Outro', ativo: true },
    { id: '3', nome: 'Fungicida Y', grupo: 'Fungicida', ativo: true },
    { id: '4', nome: 'Inativo', grupo: 'Fungicida', ativo: false },
  ];
  const ids = filtrarInsumosPlanejamentoFoliar(produtos).map(p => p.id);
  assert.deepEqual(new Set(ids), new Set(['1', '2', '3']));
  assert.equal(ids[0], '3'); // grupos usuais continuam priorizados
});

test('busca de produtos foliares ignora acentos e considera fornecedor e ingrediente ativo', () => {
  const produtos = [
    { id: '1', nome: 'Produto A', grupo: 'Outro', fornecedor: 'Café Forte', ingrediente_ativo: 'Cobre', ativo: true },
    { id: '2', nome: 'Produto B', grupo: 'Outro', fornecedor: 'Empresa B', ingrediente_ativo: 'Boro', ativo: true },
  ];
  assert.deepEqual(filtrarInsumosPlanejamentoFoliar(produtos, 'cafe').map(p => p.id), ['1']);
  assert.deepEqual(filtrarInsumosPlanejamentoFoliar(produtos, 'cobre').map(p => p.id), ['1']);
});

import { consolidarPlanejamentosPorTalhao } from '../src/lib/planejamentoAdubacao2.js';

test('ao haver planejamentos duplicados, restaura o registro mais recente de cada talhão', () => {
  const registros = [
    { id: 'antigo', talhao_id: 't1', updated_date: '2026-06-01T10:00:00Z' },
    { id: 'outro', talhao_id: 't2', updated_date: '2026-06-02T10:00:00Z' },
    { id: 'novo', talhao_id: 't1', updated_date: '2026-06-03T10:00:00Z' },
  ];
  const resultado = consolidarPlanejamentosPorTalhao(registros);
  assert.equal(resultado.length, 2);
  assert.equal(resultado.find(r => r.talhao_id === 't1').id, 'novo');
});

import { combinarInsumosFoliares } from '../src/lib/planejamentoFoliar.js';

test('planejamento foliar combina formulados e fontes simples na mesma caixa de produtos', () => {
  const resultado = combinarInsumosFoliares(
    [{ id: 'f1', nome: 'Produto Formulado', grupo: 'Fertilizante Foliar' }],
    [{ id: 's1', nome: 'Sulfato de Magnésio', nutriente_principal: 'Mg', unidade_padrao: 'kg' }],
  );
  assert.deepEqual(resultado.map(p => p.id), ['f1', 's1']);
  assert.equal(resultado[1].grupo, 'Fonte de Mg');
  assert.equal(resultado[1].unidade_aplicacao, 'kg');
});

import { aplicacaoFoliarIncluiTalhao, limparPayloadCronogramaFoliar } from '../src/lib/planejamentoFoliar.js';

test('PDF foliar reconhece tanto planejamento antigo quanto cronograma com vários talhões', () => {
  assert.equal(aplicacaoFoliarIncluiTalhao({ talhao_id: 't1' }, 't1'), true);
  assert.equal(aplicacaoFoliarIncluiTalhao({ talhao_ids: ['t1', 't2'] }, 't2'), true);
  assert.equal(aplicacaoFoliarIncluiTalhao({ talhao_ids: ['t1'] }, 't3'), false);
});

test('payload do cronograma não envia id nem metadados internos ao criar ou atualizar', () => {
  const limpo = limparPayloadCronogramaFoliar({
    id: 'interno', created_date: 'data', titulo: 'Aplicação 1', safra: '2026/2027', produtos: [],
  });
  assert.deepEqual(limpo, { titulo: 'Aplicação 1', safra: '2026/2027', produtos: [] });
});
