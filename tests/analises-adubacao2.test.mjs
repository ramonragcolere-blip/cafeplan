import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  montarCamposAnaliseAdubacao2,
  prepararModalAnalisesAdubacao2,
  selecionarAnalisesTalhaoAdubacao2,
} from '../src/lib/analisesAdubacao2.js';

const produtor = { codigo: 'P001', nome: 'Produtor Um' };
const outroProdutor = { codigo: 'P002', nome: 'Produtor Dois' };
const talhao1 = { id: 't1', nome: 'Talhao 1' };
const talhao2 = { id: 't2', nome: 'Talhao 2' };

test('dados de um talhao nao aparecem em outro no modal de analises', () => {
  const dados = prepararModalAnalisesAdubacao2({
    produtor,
    talhao: talhao2,
    safra: '2026/2027',
    analises: [{ talhao_id: 't1', codigo_produtor: 'P001', safra: '2026/2027', ph: 5.5 }],
    analises2040PorTalhao: {},
  });

  assert.equal(dados.abas[0].campos.length, 0);
});

test('analises de produtores diferentes nao se misturam', () => {
  const { analise020 } = selecionarAnalisesTalhaoAdubacao2({
    talhao: talhao1,
    safra: '2026/2027',
    codigoProdutor: produtor.codigo,
    analises: [{ talhao_id: 't1', codigo_produtor: outroProdutor.codigo, safra: '2026/2027', ph: 6 }],
  });

  assert.equal(analise020, null);
});

test('analises de safras diferentes nao se misturam', () => {
  const { analise020, analise2040 } = selecionarAnalisesTalhaoAdubacao2({
    talhao: talhao1,
    safra: '2026/2027',
    codigoProdutor: produtor.codigo,
    analises: [{ talhao_id: 't1', codigo_produtor: 'P001', safra: '2025/2026', ph: 6 }],
    analises2040PorTalhao: { t1: { safra: '2025/2026', ph: 5.1 } },
  });

  assert.equal(analise020, null);
  assert.equal(analise2040, null);
});

test('analise 0-20 e exibida com nomes amigaveis, unidades e valores', () => {
  const dados = prepararModalAnalisesAdubacao2({
    produtor,
    talhao: talhao1,
    safra: '2026/2027',
    analises: [{
      talhao_id: 't1',
      codigo_produtor: 'P001',
      safra: '2026/2027',
      ph: 5.8,
      materia_organica: 3.2,
      fosforo: 12,
      potassio: 110,
      calcio: 2.1,
      magnesio: 0.8,
      boro: 0.4,
      campo_extra: 'presente',
    }],
  });
  const campos = dados.abas[0].campos;

  assert.deepEqual(campos.find(c => c.key === 'ph'), { key: 'ph', label: 'pH', unidade: '', valor: '5,8' });
  assert.equal(campos.find(c => c.key === 'materia_organica').label, 'Matéria orgânica');
  assert.equal(campos.find(c => c.key === 'fosforo').unidade, 'mg/dm³');
  assert.equal(campos.find(c => c.key === 'calcio').unidade, 'cmolc/dm³');
  assert.equal(campos.find(c => c.key === 'campo_extra').label, 'Campo extra');
});

test('analise 20-40 e exibida a partir dos dados carregados do talhao', () => {
  const dados = prepararModalAnalisesAdubacao2({
    produtor,
    talhao: talhao1,
    safra: '2026/2027',
    analises: [],
    analises2040PorTalhao: {
      t1: { ph: 5.1, potassio: 70, calcio: 1.2, magnesio: 0.4, aluminio: 0.1, h_al: 3 },
    },
  });

  assert.equal(dados.abas[1].profundidade, '20–40 cm');
  assert.equal(dados.abas[1].campos.find(c => c.key === 'potassio').valor, '70');
  assert.equal(dados.abas[1].campos.find(c => c.key === 'h_al').label, 'H+Al');
});

test('profundidade sem dados fica sem campos para exibir mensagem de indisponibilidade', () => {
  const dados = prepararModalAnalisesAdubacao2({
    produtor,
    talhao: talhao1,
    safra: '2026/2027',
    analises: [{ talhao_id: 't1', codigo_produtor: 'P001', safra: '2026/2027', ph: 5.8 }],
    analises2040PorTalhao: {},
  });

  assert.equal(dados.abas[1].campos.length, 0);
});

test('valores zero sao preservados e valores ausentes nao viram NaN', () => {
  const campos = montarCamposAnaliseAdubacao2({
    ph: 0,
    fosforo: null,
    potassio: undefined,
    calcio: '',
    magnesio: Number.NaN,
    aluminio: 0,
  });

  assert.equal(campos.find(c => c.key === 'ph').valor, '0');
  assert.equal(campos.find(c => c.key === 'aluminio').valor, '0');
  assert.equal(campos.some(c => c.valor === 'NaN'), false);
  assert.equal(campos.some(c => c.key === 'fosforo'), false);
});

test('modal Ver analises e somente leitura e nao executa gravacao', () => {
  const componente = readFileSync(new URL('../src/components/adubacao2/ModalVerAnalisesTalhao.jsx', import.meta.url), 'utf8');

  assert.match(componente, /Fechar/);
  assert.doesNotMatch(componente, /onSave|Salvar|mutate|create|update|Input/);
});
