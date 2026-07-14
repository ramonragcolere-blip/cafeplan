import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcCalagemVpct,
  calcularDistribuicaoCalagem,
  lerDadosAnaliseCalagem,
  resolverRegistroCalagemAtual,
} from '../src/lib/calagemAdubacao2.js';

test('Calagem V% exige CTC numerica da analise 0-20 e nao usa soma de bases como CTC', () => {
  const dados = lerDadosAnaliseCalagem({
    calcio: 2.4,
    magnesio: 0.8,
    potassio: 117.3,
    saturacao_bases: 45,
  });

  assert.equal(dados.ctcAtual, null);
  assert.equal(calcCalagemVpct({ ctc: dados.ctcAtual, v1: dados.v1, v2: 70, prnt: 100, area: 2 }), null);
});

test('Calagem V% aplica PRNT e bloqueia NaN, Infinity e strings invalidas', () => {
  assert.equal(calcCalagemVpct({ ctc: 10, v1: 50, v2: 70, prnt: 80, area: 2 }).doseFinalHa, 2500);
  assert.equal(calcCalagemVpct({ ctc: 'abc', v1: 50, v2: 70, prnt: 80, area: 2 }), null);
  assert.equal(calcCalagemVpct({ ctc: 10, v1: 'abc', v2: 70, prnt: 80, area: 2 }), null);
  assert.equal(calcCalagemVpct({ ctc: 10, v1: 50, v2: 70, prnt: 0, area: 2 }).doseFinalHa, 2000);
});

test('troca de safra sem registro salvo limpa o id anterior para nao atualizar registro antigo', () => {
  assert.equal(resolverRegistroCalagemAtual([{ id: 'calagem-safra-antiga' }], null), 'calagem-safra-antiga');
  assert.equal(resolverRegistroCalagemAtual([], 'calagem-safra-antiga'), null);
});

test('dose por planta e por metro usam area, numero de plantas e espacamento correto', () => {
  const distribuicao = calcularDistribuicaoCalagem({
    doseKgHa: 1000,
    talhao: { area_ha: 2, num_plantas: 1000, espacamento: '3,5x0,7' },
  });

  assert.equal(distribuicao.totalKg, 2000);
  assert.equal(distribuicao.gPlanta, 2000);
  assert.equal(distribuicao.gMetro, 2857);
});
