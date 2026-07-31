import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  interpretarRespostaAnaliseSolo,
  prepararDadosParaRevisao,
} from '../src/lib/analiseSoloImportacao.js';

const root = process.cwd();
const fixtureMmolc = JSON.parse(readFileSync(
  join(root, 'tests', 'fixtures', 'analise-solo-publicas', 'cooxupe-mmolc-sintetico.json'),
  'utf8',
));

function interpretar(resposta, profundidade = '20-40') {
  return interpretarRespostaAnaliseSolo(resposta, profundidade);
}

test('converte laudo sintetico em mmolc/dm3 para unidades internas do CafePlan', () => {
  const resultado = interpretar(fixtureMmolc);

  assert.equal(resultado.dados.potassio, 156.4);
  assert.equal(resultado.dados.calcio, 2.8);
  assert.equal(resultado.dados.magnesio, 1.1);
  assert.equal(resultado.dados.h_al, 4.4);
  assert.equal(resultado.dados.aluminio, 0.1);
  assert.equal(resultado.dados.sb, 4.3);
  assert.equal(resultado.dados.ctc, 8.7);
  assert.equal(resultado.dados.fosforo, 27);
  assert.equal(resultado.dados.boro, 0.49);
  assert.equal(resultado.dados.zinco, 3.8);
  assert.equal(resultado.unidades.potassio, 'mg/dm3');
  assert.equal(resultado.unidades.calcio, 'cmolc/dm3');
});

test('potassio em cmolc/dm3 vira mg/dm3 e potassio em mg/dm3 permanece inalterado', () => {
  assert.equal(interpretar({ dados: { potassio: 0.5 }, unidades: { potassio: 'cmolc/dm³' } }).dados.potassio, 195.5);
  assert.equal(interpretar({ dados: { potassio: 156.4 }, unidades: { potassio: 'mg/dm³' } }).dados.potassio, 156.4);
});

test('unidade cmolc/dm3 de bases e CTC nao sofre nova conversao', () => {
  const resultado = interpretar({
    laboratorio: 'COOXUPE',
    dados: { calcio: 2.8, magnesio: 1.1, h_al: 4.4, aluminio: 0.1, sb: 4.3, ctc: 8.7 },
    unidades: { calcio: 'cmolc/dm3', magnesio: 'cmolc/dm3', h_al: 'cmolc/dm3', aluminio: 'cmolc/dm3', sb: 'cmolc/dm3', ctc: 'cmolc/dm3' },
  });

  assert.deepEqual(resultado.dados, {
    calcio: 2.8,
    magnesio: 1.1,
    h_al: 4.4,
    aluminio: 0.1,
    sb: 4.3,
    ctc: 8.7,
  });
});

test('variacoes de unidade com dm3, dm³, espaco e underscore funcionam', () => {
  const resultado = interpretar({
    dados: { potassio: 4, calcio: 28, magnesio: 11, boro: '0,49', materia_organica: 30, saturacao_bases: 55 },
    unidades: {
      potassio: 'mmol c/dm3',
      calcio: 'mmol_c/dm3',
      magnesio: 'mmolc/dm³',
      boro: 'mg/dm³',
      materia_organica: 'g/dm³',
      saturacao_bases: '%',
    },
  });

  assert.equal(resultado.dados.potassio, 156.4);
  assert.equal(resultado.dados.calcio, 2.8);
  assert.equal(resultado.dados.magnesio, 1.1);
  assert.equal(resultado.dados.boro, 0.49);
  assert.equal(resultado.dados.materia_organica, 30);
  assert.equal(resultado.dados.saturacao_bases, 55);
});

test('nome do laboratorio em caixa diferente ou ausente nao bloqueia conversao baseada na unidade', () => {
  assert.equal(interpretar({
    laboratorio: 'cooxupe',
    dados: { potassio: 4 },
    unidades: { potassio: 'mmolc/dm3' },
  }).dados.potassio, 156.4);

  assert.equal(interpretar({
    dados: { calcio: 28 },
    unidades: { calcio: 'mmolc/dm3' },
  }).dados.calcio, 2.8);
});

test('unidade desconhecida nao e convertida silenciosamente e gera pendencia de revisao', () => {
  const resultado = interpretar({
    dados: { potassio: 4, calcio: 28 },
    unidades: { potassio: 'unidade estranha' },
  });

  assert.equal(resultado.dados.potassio, 4);
  assert.equal(resultado.dados.calcio, 28);
  assert.equal(resultado.pendenciasUnidade.some(item => item.campo === 'potassio'), true);
  assert.equal(resultado.pendenciasUnidade.some(item => item.campo === 'calcio'), true);
});

test('reabrir revisao nao converte novamente valores ja marcados como unidade interna', () => {
  const primeira = interpretar(fixtureMmolc);
  const segunda = interpretar({
    laboratorio: primeira.laboratorio,
    dados: primeira.dados,
    unidades: primeira.unidades,
  });

  assert.equal(segunda.dados.potassio, 156.4);
  assert.equal(segunda.dados.calcio, 2.8);
  assert.equal(segunda.dados.ctc, 8.7);
});

test('salvar e restaurar mantem valores convertidos na revisao sem estimativa adicional', () => {
  const interpretado = interpretar(fixtureMmolc);
  const salvo = JSON.parse(JSON.stringify({
    dados: interpretado.dados,
    unidades: interpretado.unidades,
    revisoesUnidade: interpretado.revisoesUnidade,
  }));

  const [restaurado] = prepararDadosParaRevisao({
    profundidade: '20-40',
    pares: [{ talhao: { id: 'talhao-a', nome: 'Talhao A' }, arquivo: null }],
    dadosExistentes: { 'talhao-a': salvo.dados },
  });

  assert.equal(restaurado.dados.potassio, 156.4);
  assert.equal(restaurado.dados.calcio, 2.8);
  assert.equal(restaurado.dados.magnesio, 1.1);
  assert.equal(restaurado.dados.ctc, 8.7);
});
