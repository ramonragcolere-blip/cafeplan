import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAMPOS_ANALISE_020,
  CAMPOS_ANALISE_2040,
  classificarExtracaoAnaliseSolo,
  criarControladorGravacaoAnalise,
  desembrulharRespostaAnaliseSolo,
  gerarChaveArquivoAnaliseSolo,
  interpretarRespostaAnaliseSolo,
  normalizarDataAnaliseSolo,
  normalizarNumeroAnaliseSolo,
  prepararDadosParaRevisao,
  resumirResultadosImportacaoAnaliseSolo,
  validarCompletudeExtracao,
} from '../src/lib/analiseSoloImportacao.js';

const root = process.cwd();
const privateManifestPath = join(
  root,
  'tests',
  'fixtures',
  'analise-solo-privadas',
  'manifesto-analise-solo-real.private.json',
);

const source = {
  pagina: readFileSync(join(root, 'src', 'pages', 'Adubacao2.jsx'), 'utf8'),
  individual020: readFileSync(join(root, 'src', 'components', 'adubacao2', 'ImportarPDFTalhao.jsx'), 'utf8'),
  agrupado020: readFileSync(join(root, 'src', 'components', 'adubacao2', 'ImportarAgrupado020.jsx'), 'utf8'),
  agrupado2040: readFileSync(join(root, 'src', 'components', 'adubacao2', 'ImportarAgrupado2040.jsx'), 'utf8'),
};

const camposLaudo = [
  'ph',
  'materia_organica',
  'fosforo',
  'potassio',
  'calcio',
  'magnesio',
  'enxofre',
  'boro',
  'zinco',
  'cobre',
  'manganes',
  'ferro',
  'ctc',
  'saturacao_bases',
  'aluminio',
  'h_al',
  'sb',
  'data_analise',
];

const camposLaudo020 = camposLaudo.filter((campo) => !['aluminio', 'h_al', 'sb'].includes(campo));
const camposLaudo2040 = camposLaudo;

function lerManifestoPrivado(t) {
  if (!existsSync(privateManifestPath)) {
    t.skip('manifesto privado ausente; copie os PDFs reais e gere o manifesto local ignorado pelo Git');
  }
  return JSON.parse(readFileSync(privateManifestPath, 'utf8'));
}

function itensPorProfundidade(manifesto, profundidade) {
  return manifesto.items.filter((item) => item.depth === profundidade);
}

function extrairKeysCampos(codigo, nomeConstante) {
  const inicio = codigo.indexOf(`const ${nomeConstante} = [`);
  assert.notEqual(inicio, -1, `Nao encontrou ${nomeConstante} no codigo de producao`);
  const fim = codigo.indexOf('];', inicio);
  assert.notEqual(fim, -1, `Nao encontrou fechamento de ${nomeConstante}`);
  return [...codigo.slice(inicio, fim).matchAll(/key:\s*['"]([^'"]+)['"]/g)].map((item) => item[1]);
}

function faltantes(recebidos, esperados) {
  return esperados.filter((campo) => !recebidos.includes(campo));
}

function payloadCompleto020() {
  return Object.fromEntries(CAMPOS_ANALISE_020.map((campo) => [
    campo,
    campo === 'data_analise' ? '2026-07-03' : 1,
  ]));
}

test('inventario privado contem um PDF 0-20 individual, dois em lote, sete em lote e sete 20-40', (t) => {
  const manifesto = lerManifestoPrivado(t);
  assert.equal(itensPorProfundidade(manifesto, '0-20').length, 7);
  assert.equal(itensPorProfundidade(manifesto, '20-40').length, 7);
  assert.ok(itensPorProfundidade(manifesto, '0-20')[0]);
  assert.equal(itensPorProfundidade(manifesto, '0-20').slice(0, 2).length, 2);
});

test('manifesto privado lido dos PDFs cobre todos os elementos do laudo real', (t) => {
  const manifesto = lerManifestoPrivado(t);

  for (const item of manifesto.items) {
    assert.equal(item.laboratorio, 'COOXUPE', `${item.id}: laboratorio nao identificado`);
    assert.ok(item.data_analise, `${item.id}: data da analise/liberacao ausente`);
    assert.equal(item.text_checks.has_cooxupe_header, true, `${item.id}: cabecalho visivel nao confirmado`);
    assert.equal(item.text_checks.has_resultados_analiticos, true, `${item.id}: tabela visivel nao confirmada`);
    assert.equal(item.text_checks.numeric_rows_found >= 2, true, `${item.id}: linhas numericas visiveis insuficientes`);

    const camposEsperados = item.depth === '20-40' ? camposLaudo2040 : camposLaudo020;
    for (const campo of camposEsperados.filter((key) => key !== 'data_analise')) {
      assert.notEqual(item.expected_app[campo], undefined, `${item.id}: campo ${campo} ausente`);
      assert.notEqual(item.expected_app[campo], null, `${item.id}: campo ${campo} ambiguo`);
    }
  }
});

test('modulo compartilhado interpreta resposta plana e resposta em dados sem perder laboratorio', () => {
  assert.deepEqual(desembrulharRespostaAnaliseSolo({ laboratorio: 'COOXUPE', ph: '5,4' }), {
    laboratorio: 'COOXUPE',
    dados: { ph: '5,4' },
  });
  assert.deepEqual(desembrulharRespostaAnaliseSolo({ laboratorio: 'COOXUPE', dados: { ph: '5,4' } }), {
    laboratorio: 'COOXUPE',
    dados: { ph: '5,4' },
  });

  const interpretado = interpretarRespostaAnaliseSolo({
    laboratorio: 'COOXUPE',
    dados: { ph: '5,4', potassio: '4,2', calcio: '40', magnesio: '10', ctc: '83,2', data_analise: '24/06/2026' },
  }, '0-20');
  assert.equal(interpretado.dados.ph, 5.4);
  assert.equal(interpretado.dados.potassio, 164.2);
  assert.equal(interpretado.dados.calcio, 4);
  assert.equal(interpretado.dados.magnesio, 1);
  assert.equal(interpretado.dados.ctc, 8.32);
  assert.equal(interpretado.dados.data_analise, '2026-06-24');
});

test('modulo compartilhado normaliza numeros, datas, chave de arquivo e completude por profundidade', () => {
  assert.equal(normalizarNumeroAnaliseSolo('1.234,5'), 1234.5);
  assert.equal(normalizarNumeroAnaliseSolo('-'), undefined);
  assert.equal(normalizarDataAnaliseSolo('03/07/2026'), '2026-07-03');
  assert.equal(gerarChaveArquivoAnaliseSolo({ name: 'laudo.pdf', size: 10, lastModified: 20 }), 'laudo.pdf|10|20');

  assert.deepEqual(CAMPOS_ANALISE_020.includes('aluminio'), false);
  assert.deepEqual(CAMPOS_ANALISE_2040.includes('aluminio'), true);
  assert.deepEqual(CAMPOS_ANALISE_2040.includes('h_al'), true);
  assert.deepEqual(CAMPOS_ANALISE_2040.includes('sb'), true);

  assert.deepEqual(validarCompletudeExtracao({ ph: 5.4 }, '0-20').completo, false);
  assert.equal(prepararDadosParaRevisao({
    profundidade: '0-20',
    pares: [{ talhao: { id: 't1' }, arquivo: { name: 'a.pdf', size: 1, lastModified: 2 } }],
    cacheExtracao: { 'a.pdf|1|2': { dados: { ph: 5.4 }, laboratorio: 'COOXUPE' } },
  })[0].validacao.completo, false);
});

test('classificacao permite laudo completo, laudo parcial com dados validos e bloqueia laudo vazio', () => {
  const completo = classificarExtracaoAnaliseSolo(payloadCompleto020(), '0-20');
  assert.deepEqual({
    status: completo.status,
    completo: completo.completo,
    parcial: completo.parcial,
    temDados: completo.temDados,
    ausentes: completo.camposAusentes,
  }, {
    status: 'ok',
    completo: true,
    parcial: false,
    temDados: true,
    ausentes: [],
  });

  const parcial = classificarExtracaoAnaliseSolo({ ph: 5.4, calcio: 3.2 }, '0-20');
  assert.equal(parcial.status, 'parcial');
  assert.equal(parcial.completo, false);
  assert.equal(parcial.parcial, true);
  assert.equal(parcial.temDados, true);
  assert.ok(parcial.camposAusentes.includes('data_analise'));

  const vazio = classificarExtracaoAnaliseSolo({}, '0-20');
  assert.equal(vazio.status, 'erro');
  assert.equal(vazio.temDados, false);
});

test('resumo de lote separa importacoes completas, parciais e erros sem dados validos', () => {
  const resultados = [
    { talhao: { id: 't1' }, ...classificarExtracaoAnaliseSolo(payloadCompleto020(), '0-20') },
    { talhao: { id: 't2' }, ...classificarExtracaoAnaliseSolo({ ph: 5.1 }, '0-20') },
    { talhao: { id: 't3' }, ...classificarExtracaoAnaliseSolo({}, '0-20') },
  ];

  assert.deepEqual(resultados.map((resultado) => resultado.status), ['ok', 'parcial', 'erro']);
  assert.deepEqual(resumirResultadosImportacaoAnaliseSolo(resultados), {
    completas: 1,
    parciais: 1,
    erros: 1,
    totalSalvas: 2,
  });
});

test('controlador compartilhado serializa gravacoes por talhao e safra e evita dois creates concorrentes', async () => {
  const chamadas = [];
  let criado = null;
  const salvar = criarControladorGravacaoAnalise({
    buscarExistentes: async () => (criado ? [criado] : []),
    criar: async (payload) => {
      chamadas.push(['create', payload.ph]);
      criado = { id: 'a1' };
      return criado;
    },
    atualizar: async (id, payload) => {
      chamadas.push(['update', id, payload.ph]);
      return { id };
    },
  });

  await Promise.all([
    salvar({ talhao_id: 't1', safra: '2026/2027', ph: 5.1 }),
    salvar({ talhao_id: 't1', safra: '2026/2027', ph: 5.9 }),
  ]);

  assert.deepEqual(chamadas, [
    ['create', 5.1],
    ['update', 'a1', 5.9],
  ]);
});

test('importacao individual 0-20 esta ligada ao fluxo real de upload, IA e gravacao por talhao', () => {
  assert.match(source.individual020, /UploadFile\(\{\s*file\s*\}\)/);
  assert.match(source.individual020, /ExtractDataFromUploadedFile/);
  assert.match(source.individual020, /InvokeLLM/);
  assert.match(source.individual020, /interpretarRespostaAnaliseSolo\(resposta,\s*'0-20'\)/);
  assert.match(source.individual020, /onImportarAnalise\(talhao,\s*\{\s*\.\.\.dados/);
  assert.match(source.pagina, /const handleImportarAnalise = async \(talhao,\s*dados = \{\}\)/);
  assert.match(source.pagina, /criarControladorGravacaoAnalise/);
  assert.match(source.pagina, /AnaliseSolo\.filter\(\{\s*talhao_id,\s*safra:\s*safraPayload\s*\}\)/);
});

test('telas de revisao 0-20 e 20-40 exibem todos os campos existentes nos PDFs reais', () => {
  const campos020 = extrairKeysCampos(source.agrupado020, 'CAMPOS_0_20');
  const campos2040 = extrairKeysCampos(source.agrupado2040, 'CAMPOS_2040');

  assert.deepEqual({
    agrupado020: faltantes(campos020, camposLaudo020),
    agrupado2040: faltantes(campos2040, camposLaudo2040),
  }, {
    agrupado020: [],
    agrupado2040: [],
  });
});

test('importacao agrupada aceita resposta da IA plana e tambem resposta em { dados: {...} }', () => {
  const aceitaDados020 = /interpretarRespostaAnaliseSolo\(/.test(source.agrupado020);
  const aceitaDados2040 = /interpretarRespostaAnaliseSolo\(/.test(source.agrupado2040);
  const aceitaDadosIndividual = /interpretarRespostaAnaliseSolo\(/.test(source.individual020);

  assert.equal(aceitaDados020, true, 'ImportarAgrupado020 nao desembrulha resposta da IA em { dados: {...} }');
  assert.equal(aceitaDados2040, true, 'ImportarAgrupado2040 nao desembrulha resposta da IA em { dados: {...} }');
  assert.equal(aceitaDadosIndividual, true, 'ImportarPDFTalhao nao usa a mesma interpretacao compartilhada');
});

test('cache de PDFs agrupados diferencia arquivos distintos mesmo quando o nome e igual', () => {
  assert.equal(/gerarChaveArquivoAnaliseSolo\(par\.arquivo\)/.test(source.agrupado020), true, 'ImportarAgrupado020 nao usa chave unica do arquivo');
  assert.equal(/gerarChaveArquivoAnaliseSolo\(par\.arquivo\)/.test(source.agrupado2040), true, 'ImportarAgrupado2040 nao usa chave unica do arquivo');
  assert.equal(/cacheExtracao\[par\.arquivo\.name\]/.test(source.agrupado020), false, 'ImportarAgrupado020 usa apenas file.name como chave de cache');
  assert.equal(/cacheExtracao\[par\.arquivo\.name\]/.test(source.agrupado2040), false, 'ImportarAgrupado2040 usa apenas file.name como chave de cache');
});

test('lote 0-20 grava uma vez por talhao, tem uma mensagem final, nao usa toast por talhao e continua apos erro', () => {
  assert.match(source.agrupado020, /for \(const item of itens\) \{[\s\S]*await onImportarAnalise\(item\.talhao,\s*\{\s*\.\.\.item\.dados/);
  assert.match(source.agrupado020, /catch \(error\) \{[\s\S]*status:\s*'erro'/);
  assert.match(source.agrupado020, /status:\s*classificacao\.status/);
  assert.doesNotMatch(source.agrupado020, /if \(!validacao\.completo\) throw new Error\(`Extração incompleta/);
  assert.doesNotMatch(source.agrupado2040, /if \(!validacao\.completo\) throw new Error\(`Extração incompleta/);
  assert.doesNotMatch(source.individual020, /throw new Error\(`Extração incompleta/);
  assert.doesNotMatch(source.pagina, /throw new Error\(`Extração incompleta/);
  assert.equal((source.agrupado020.match(/setEtapa\('resumo'\)/g) || []).length, 1);
  assert.match(source.agrupado020, /resumirResultadosImportacaoAnaliseSolo\(resultados\)/);
  assert.doesNotMatch(source.agrupado020, /useToast|toast\(/);
  assert.doesNotMatch(source.agrupado2040, /useToast|toast\(/);
});

test('atualizacao 0-20 e protegida contra duplicacao em chamadas concorrentes', () => {
  assert.match(source.pagina, /const handleImportarAnalise = async \(talhao,\s*dados = \{\}\)/);
  assert.match(source.pagina, /criar:\s*payload => createAnalise\.mutateAsync\(payload\)/);
  assert.match(source.pagina, /atualizar:\s*\(id,\s*payload\) => updateAnalise\.mutateAsync\(\{\s*id,\s*d:\s*payload\s*\}\)/);
  const temFilaAnalise = /criarControladorGravacaoAnalise/.test(source.pagina);
  assert.equal(temFilaAnalise, true, 'handleImportarAnalise nao tem fila/id local para serializar creates concorrentes de AnaliseSolo');
});
