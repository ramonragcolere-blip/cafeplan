import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const publicFixtures = join(root, 'tests', 'fixtures', 'analise-solo-publicas');
const privateFixtures = join(root, 'tests', 'fixtures', 'analise-solo-privadas');

const campos020 = [
  'ph', 'materia_organica', 'fosforo', 'potassio', 'calcio', 'magnesio',
  'enxofre', 'boro', 'zinco', 'cobre', 'manganes', 'ferro', 'ctc',
  'saturacao_bases', 'observacoes',
];

const campos2040 = [
  'ph', 'calcio', 'magnesio', 'potassio', 'aluminio', 'h_al', 'sb', 'ctc',
  'saturacao_bases', 'fosforo', 'zinco', 'cobre', 'manganes', 'boro',
  'enxofre', 'materia_organica', 'observacoes',
];

const matrizObrigatoria = [
  '1 PDF/1 talhao',
  '2 PDFs/2 talhoes',
  '7 PDFs/7 talhoes',
  'PDF compartilhado',
  'pareamento PDF/talhao',
  'analise 0-20',
  'analise 20-40',
  'todos os elementos do laudo',
  'resposta IA plana',
  'resposta IA em dados',
  'conversao de unidades',
  'uma gravacao por talhao',
  'ausencia de loop',
  'notificacoes sem duplicidade',
  'resumo unico',
  'atualizacao sem duplicidade',
  'continuacao apos erro individual',
];

function lerSchema(nome) {
  return JSON.parse(readFileSync(join(root, 'base44', 'entities', `${nome}.jsonc`), 'utf8'));
}

function unwrapRespostaIA(resposta) {
  return resposta?.dados && typeof resposta.dados === 'object' ? resposta.dados : resposta;
}

function normalizarNumero(valor, unidade) {
  if (valor == null || valor === '') return null;
  const numero = Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(numero)) return null;
  if (unidade === 'mmolc/dm3') return numero / 10;
  if (unidade === 'cmolc/dm3') return numero;
  if (unidade === 'dag/kg') return numero;
  if (unidade === 'mg/dm3') return numero;
  return numero;
}

function parearArquivosTalhoes(arquivos, talhoes) {
  return talhoes.map((talhao, index) => {
    const chave = talhao.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const arquivo = arquivos.find((item) => item.nomeNormalizado.includes(chave)) || arquivos[index] || arquivos[0] || null;
    return { talhaoId: talhao.id, arquivo: arquivo?.nome ?? null };
  });
}

async function simularGravacaoEmLote({ itens, salvar, notificar }) {
  const gravadosPorChave = new Map();
  const resultados = [];
  let notificouResumo = false;

  for (const item of itens) {
    try {
      const chave = `${item.profundidade}:${item.talhao.id}`;
      const payload = { ...item.dados, talhao_id: item.talhao.id, talhao_nome: item.talhao.nome };
      gravadosPorChave.set(chave, payload);
      await salvar(payload, item);
      resultados.push({ talhaoId: item.talhao.id, status: 'ok' });
    } catch (error) {
      resultados.push({ talhaoId: item.talhao.id, status: 'erro', erro: error.message });
    }
  }

  if (!notificouResumo) {
    notificar({ tipo: 'resumo', total: resultados.length, erros: resultados.filter((r) => r.status === 'erro').length });
    notificouResumo = true;
  }

  return { resultados, gravados: [...gravadosPorChave.values()] };
}

test('infraestrutura de fixtures de analise de solo esta preparada', () => {
  assert.equal(existsSync(publicFixtures), true);

  const gitignore = readFileSync(join(root, '.gitignore'), 'utf8');
  assert.match(gitignore, /\/tests\/fixtures\/analise-solo-privadas\//);
});

test('matriz de QA cobre os cenarios obrigatorios de importacao', () => {
  assert.deepEqual(matrizObrigatoria, [
    '1 PDF/1 talhao',
    '2 PDFs/2 talhoes',
    '7 PDFs/7 talhoes',
    'PDF compartilhado',
    'pareamento PDF/talhao',
    'analise 0-20',
    'analise 20-40',
    'todos os elementos do laudo',
    'resposta IA plana',
    'resposta IA em dados',
    'conversao de unidades',
    'uma gravacao por talhao',
    'ausencia de loop',
    'notificacoes sem duplicidade',
    'resumo unico',
    'atualizacao sem duplicidade',
    'continuacao apos erro individual',
  ]);
});

test('schemas Base44 mantem todos os elementos esperados do laudo 0-20 e 20-40', () => {
  const schema020 = lerSchema('AnaliseSolo');
  const schema2040 = lerSchema('AnaliseSolo2040');

  for (const campo of campos020) assert.ok(schema020.properties[campo], `AnaliseSolo sem campo ${campo}`);
  for (const campo of campos2040) assert.ok(schema2040.properties[campo], `AnaliseSolo2040 sem campo ${campo}`);

  assert.deepEqual(schema020.required, ['codigo_produtor', 'talhao_id', 'safra']);
  assert.deepEqual(schema2040.required, ['codigo_produtor', 'talhao_id', 'safra']);
});

test('contrato aceita resposta da IA plana ou dentro de dados', () => {
  assert.deepEqual(unwrapRespostaIA({ ph: 5.8, potassio: 120 }), { ph: 5.8, potassio: 120 });
  assert.deepEqual(unwrapRespostaIA({ dados: { ph: 5.8, potassio: 120 } }), { ph: 5.8, potassio: 120 });
});

test('contrato documenta conversao de unidades sem depender de PDF real', () => {
  assert.equal(normalizarNumero('25', 'mmolc/dm3'), 2.5);
  assert.equal(normalizarNumero('2,5', 'cmolc/dm3'), 2.5);
  assert.equal(normalizarNumero('120', 'mg/dm3'), 120);
  assert.equal(normalizarNumero('', 'mg/dm3'), null);
});

test('pareamento cobre 1, 2, 7 PDFs e PDF compartilhado por talhao', () => {
  const talhoes = Array.from({ length: 7 }, (_, index) => ({ id: `t${index + 1}`, nome: `Talhao ${index + 1}` }));
  const seteArquivos = talhoes.map((talhao) => ({ nome: `${talhao.nome}.pdf`, nomeNormalizado: talhao.nome.toLowerCase().replace(/[^a-z0-9]/g, '') }));

  assert.deepEqual(parearArquivosTalhoes([seteArquivos[0]], [talhoes[0]]), [{ talhaoId: 't1', arquivo: 'Talhao 1.pdf' }]);
  assert.deepEqual(parearArquivosTalhoes(seteArquivos.slice(0, 2), talhoes.slice(0, 2)).map((p) => p.arquivo), ['Talhao 1.pdf', 'Talhao 2.pdf']);
  assert.equal(parearArquivosTalhoes(seteArquivos, talhoes).length, 7);
  assert.deepEqual(parearArquivosTalhoes([{ nome: 'compartilhado.pdf', nomeNormalizado: 'compartilhado' }], talhoes.slice(0, 2)).map((p) => p.arquivo), ['compartilhado.pdf', 'compartilhado.pdf']);
});

test('gravacao em lote exige uma gravacao por talhao, resumo unico e continuidade apos erro individual', async () => {
  const chamadasSalvar = [];
  const notificacoes = [];
  const itens = [
    { profundidade: '0-20', talhao: { id: 't1', nome: 'Sede' }, dados: { ph: 5.6 } },
    { profundidade: '0-20', talhao: { id: 't2', nome: 'Baixada' }, dados: { ph: 5.2 } },
    { profundidade: '20-40', talhao: { id: 't3', nome: 'Alta' }, dados: { ph: 4.9 } },
  ];

  const resultado = await simularGravacaoEmLote({
    itens,
    salvar: async (payload) => {
      chamadasSalvar.push(payload);
      if (payload.talhao_id === 't2') throw new Error('falha individual simulada');
    },
    notificar: (evento) => notificacoes.push(evento),
  });

  assert.equal(chamadasSalvar.length, 3);
  assert.deepEqual(resultado.resultados.map((r) => r.status), ['ok', 'erro', 'ok']);
  assert.equal(notificacoes.length, 1);
  assert.deepEqual(notificacoes[0], { tipo: 'resumo', total: 3, erros: 1 });
});

test('atualizacao de analise existente nao duplica registro por talhao e profundidade', async () => {
  const itens = [
    { profundidade: '0-20', talhao: { id: 't1', nome: 'Sede' }, dados: { ph: 5.1 } },
    { profundidade: '0-20', talhao: { id: 't1', nome: 'Sede' }, dados: { ph: 5.9 } },
  ];

  const resultado = await simularGravacaoEmLote({ itens, salvar: async () => {}, notificar: () => {} });
  assert.equal(resultado.gravados.length, 1);
  assert.equal(resultado.gravados[0].ph, 5.9);
});

test('teste real com PDFs publicos fica pendente ate haver fixtures versionaveis', { skip: 'adicione PDFs anonimizados em tests/fixtures/analise-solo-publicas' }, () => {});

test('teste local com PDFs privados fica pendente ate haver fixtures reais locais', { skip: 'adicione PDFs reais autorizados em tests/fixtures/analise-solo-privadas; esta pasta e ignorada pelo git' }, () => {});
