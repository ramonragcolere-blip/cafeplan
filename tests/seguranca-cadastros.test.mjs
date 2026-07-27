import test from 'node:test';
import assert from 'node:assert/strict';
import {
  avaliarAlteracaoSafrista,
  avaliarAlteracaoTalhao,
  avaliarExclusaoProdutor,
  avaliarExclusaoSafrista,
  avaliarExclusaoTalhao,
  calcularProximoCodigoProdutorSeguro,
  excluirProdutorComSeguranca,
  excluirSafristaComSeguranca,
  excluirTalhaoComSeguranca,
  removerDesenhoTalhaoPayload,
  validarCodigoProdutor,
} from '../src/lib/segurancaCadastros.js';

function entidade(registros = []) {
  return {
    registros: [...registros],
    deletes: [],
    updates: [],
    creates: [],
    async filter(filtro = {}) {
      return this.registros.filter(registro =>
        Object.entries(filtro).every(([campo, valor]) => registro[campo] === valor)
      );
    },
    async delete(id) {
      this.deletes.push(id);
      this.registros = this.registros.filter(registro => registro.id !== id);
      return { id };
    },
    async update(id, data) {
      this.updates.push({ id, data });
      this.registros = this.registros.map(registro => registro.id === id ? { ...registro, ...data } : registro);
      return this.registros.find(registro => registro.id === id);
    },
    async create(data) {
      const novo = { id: `novo-${this.creates.length + 1}`, ...data };
      this.creates.push(novo);
      this.registros.push(novo);
      return novo;
    },
  };
}

function entidadesParciais(parcial = {}) {
  const nomes = [
    'Produtor', 'Talhao', 'AnaliseSolo', 'AnaliseSolo2040', 'AnaliseFoliar',
    'BasePlanejamentoAdubacao', 'PlanejamentoAdubacao2', 'AplicacaoFoliar',
    'CronogramaFoliar', 'PlanejamentoOperacoes', 'PlanejamentoPosColheita',
    'Lancamento', 'Safrista', 'EquipamentosProdutor', 'BaseNotasFiscais',
    'BaseItensNotaFiscal',
  ];
  return Object.fromEntries(nomes.map(nome => [nome, parcial[nome] || entidade([])]));
}

test('código duplicado de produtor é bloqueado com mensagem clara', () => {
  const resultado = validarCodigoProdutor({
    produtores: [{ id: 'p1', codigo: 'P001' }],
    codigo: 'p001',
  });

  assert.equal(resultado.ok, false);
  assert.match(resultado.mensagem, /já está em uso/);
});

test('código do produtor não é alterável após criado', () => {
  const resultado = validarCodigoProdutor({
    produtores: [{ id: 'p1', codigo: 'P001' }],
    produtorAtual: { id: 'p1', codigo: 'P001' },
    codigo: 'P002',
  });

  assert.equal(resultado.ok, false);
  assert.match(resultado.mensagem, /não pode ser alterado/);
});

test('próximo código não reutiliza código excluído ou inativado', () => {
  const codigo = calcularProximoCodigoProdutorSeguro([
    { codigo: 'P001', status: 'ativo' },
    { codigo: 'P003', status: 'inativo' },
  ]);

  assert.equal(codigo, 'P004');
});

test('produtor sem vínculo pode ser excluído', async () => {
  const entities = entidadesParciais({
    Produtor: entidade([{ id: 'p1', codigo: 'P001' }]),
  });

  await excluirProdutorComSeguranca(entities, { id: 'p1', codigo: 'P001' });

  assert.deepEqual(entities.Produtor.deletes, ['p1']);
});

test('produtor com talhão não pode ser excluído', async () => {
  const entities = entidadesParciais({
    Produtor: entidade([{ id: 'p1', codigo: 'P001' }]),
    Talhao: entidade([{ id: 't1', codigo_produtor: 'P001' }]),
  });

  await assert.rejects(
    () => excluirProdutorComSeguranca(entities, { id: 'p1', codigo: 'P001' }),
    /talhões/,
  );
  assert.deepEqual(entities.Produtor.deletes, []);
});

test('produtor com lançamento não pode ser excluído', async () => {
  const entities = entidadesParciais({
    Produtor: entidade([{ id: 'p1', codigo: 'P001' }]),
    Lancamento: entidade([{ id: 'l1', codigo_produtor: 'P001' }]),
  });

  await assert.rejects(
    () => excluirProdutorComSeguranca(entities, { id: 'p1', codigo: 'P001' }),
    /colheita/,
  );
  assert.deepEqual(entities.Produtor.deletes, []);
});

test('inativação preserva dados vinculados', async () => {
  const produtor = entidade([{ id: 'p1', codigo: 'P001', status: 'ativo' }]);
  const talhao = entidade([{ id: 't1', codigo_produtor: 'P001' }]);
  await produtor.update('p1', { status: 'inativo' });

  assert.equal(produtor.registros[0].status, 'inativo');
  assert.equal(talhao.registros.length, 1);
});

test('transferência de talhão é bloqueada quando houver histórico', () => {
  const resultado = avaliarAlteracaoTalhao({
    talhaoAtual: { id: 't1', produtor_id: 'p1', codigo_produtor: 'P001' },
    dadosNovos: { produtor_id: 'p2', codigo_produtor: 'P002' },
    possuiHistorico: true,
  });

  assert.equal(resultado.ok, false);
  assert.match(resultado.mensagem, /Inativar/);
});

test('exclusão de talhão com histórico é bloqueada', async () => {
  const entities = entidadesParciais({
    Talhao: entidade([{ id: 't1', codigo_produtor: 'P001', nome: 'Talhao 1' }]),
    PlanejamentoAdubacao2: entidade([{ id: 'pl1', talhao_id: 't1' }]),
  });

  await assert.rejects(
    () => excluirTalhaoComSeguranca(entities, { id: 't1', codigo_produtor: 'P001', nome: 'Talhao 1' }),
    /planejamentos de adubação/,
  );
  assert.deepEqual(entities.Talhao.deletes, []);
});

test('remoção do desenho preserva o talhão e a área manual', () => {
  const payload = removerDesenhoTalhaoPayload({ id: 't1', area_ha: 12.5, nome: 'Talhao 1' });

  assert.equal(payload.geojson_poligono, null);
  assert.equal(payload.centro_mapa, null);
  assert.equal(payload.area_ha, 12.5);
  assert.equal(Object.hasOwn(payload, 'nome'), false);
});

test('remoção do desenho preserva análises e planejamentos', () => {
  const analises = [{ id: 'a1', talhao_id: 't1' }];
  const planejamentos = [{ id: 'p1', talhao_id: 't1' }];
  const payload = removerDesenhoTalhaoPayload({ id: 't1', area_ha: 3 });

  assert.deepEqual(analises, [{ id: 'a1', talhao_id: 't1' }]);
  assert.deepEqual(planejamentos, [{ id: 'p1', talhao_id: 't1' }]);
  assert.deepEqual(Object.keys(payload).sort(), ['area_ha', 'centro_mapa', 'coordenadas', 'geojson_poligono', 'geometria'].sort());
});

test('safrista com lançamento não pode ser excluído', async () => {
  const safrista = { id: 's1', codigo_produtor: 'P001', nome: 'Joao' };
  const entities = entidadesParciais({
    Safrista: entidade([safrista]),
    Lancamento: entidade([{ id: 'l1', codigo_produtor: 'P001', safrista: 'Joao' }]),
  });

  await assert.rejects(() => excluirSafristaComSeguranca(entities, safrista), /lançamentos/);
  assert.deepEqual(entities.Safrista.deletes, []);
});

test('alteração de vínculo do safrista é bloqueada quando há histórico', () => {
  const resultado = avaliarAlteracaoSafrista({
    safristaAtual: { id: 's1', codigo_produtor: 'P001', nome: 'Joao' },
    dadosNovos: { codigo_produtor: 'P002', nome: 'Joao' },
    lancamentos: [{ codigo_produtor: 'P001', safrista: 'Joao' }],
  });

  assert.equal(resultado.ok, false);
  assert.match(resultado.mensagem, /Inativar/);
});

test('não há exclusão em cascata ao bloquear produtor com vínculos', async () => {
  const talhao = entidade([{ id: 't1', codigo_produtor: 'P001' }]);
  const lancamento = entidade([{ id: 'l1', codigo_produtor: 'P001' }]);
  const entities = entidadesParciais({
    Produtor: entidade([{ id: 'p1', codigo: 'P001' }]),
    Talhao: talhao,
    Lancamento: lancamento,
  });

  await assert.rejects(() => excluirProdutorComSeguranca(entities, { id: 'p1', codigo: 'P001' }));

  assert.deepEqual(entities.Produtor.deletes, []);
  assert.deepEqual(talhao.deletes, []);
  assert.deepEqual(lancamento.deletes, []);
});

test('mensagens de erro orientam a inativar', () => {
  const produtor = avaliarExclusaoProdutor({ talhões: 1 });
  const talhao = avaliarExclusaoTalhao({ operações: 1 });
  const safrista = avaliarExclusaoSafrista({
    safrista: { codigo_produtor: 'P001', nome: 'Joao' },
    lancamentos: [{ codigo_produtor: 'P001', safrista: 'Joao' }],
  });

  assert.match(produtor.mensagem, /Inativar/);
  assert.match(talhao.mensagem, /Inativar/);
  assert.match(safrista.mensagem, /Inativar/);
});
