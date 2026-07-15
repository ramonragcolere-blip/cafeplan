import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcCalagemVpct,
  calcularDistribuicaoCalagem,
  consolidarComprasAdubacao2,
  atualizarListaCalagens,
  lerDadosAnaliseCalagem,
  montarGruposResumoAdubacao2,
  podeSalvarRecomendacaoCalagem,
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

const talhoesBase = [
  { id: 't1', nome: 'Talhao 1', area_ha: 2, num_plantas: 1000, espacamento: '3,5x0,7' },
  { id: 't2', nome: 'Talhao 2', area_ha: 3, num_plantas: 1500, espacamento: '3,5x0,7' },
];

test('calagem salva aparece na Consolidacao de Compras mesmo sendo o unico planejamento', () => {
  const linhas = consolidarComprasAdubacao2({
    resultados: null,
    calagens: [{
      id: 'c1', talhao_id: 't1', produto_id: 'calc1', produto_nome: 'Calcario A',
      dose_kg_ha: 1000, dose_total_kg: 2000, updated_date: '2026-07-01T10:00:00Z',
    }],
    talhoes: talhoesBase,
  });

  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].produto.nome, 'Calcario A');
  assert.equal(linhas[0].qtdTotal, 2000);
});

test('Consolidacao de Compras soma dois talhoes usando o mesmo corretivo e escolhe duplicado mais recente', () => {
  const linhas = consolidarComprasAdubacao2({
    resultados: [],
    calagens: [
      { id: 'antigo', talhao_id: 't1', produto_id: 'calc1', produto_nome: 'Calcario A', dose_kg_ha: 300, dose_total_kg: 600, updated_date: '2026-07-01T10:00:00Z' },
      { id: 'novo', talhao_id: 't1', produto_id: 'calc1', produto_nome: 'Calcario A', dose_kg_ha: 1000, dose_total_kg: 2000, updated_date: '2026-07-02T10:00:00Z' },
      { id: 't2', talhao_id: 't2', produto_id: 'calc1', produto_nome: 'Calcario A', dose_kg_ha: 1000, dose_total_kg: 3000, updated_date: '2026-07-02T11:00:00Z' },
    ],
    talhoes: talhoesBase,
  });

  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].qtdTotal, 5000);
  assert.deepEqual(linhas[0].talhoes, ['Talhao 1', 'Talhao 2']);
});

test('Consolidacao de Compras filtra calagem por produtor e safra', () => {
  const linhas = consolidarComprasAdubacao2({
    resultados: [],
    calagens: [
      { id: 'ok', codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1', produto_id: 'calc1', produto_nome: 'Calcario A', dose_kg_ha: 1000 },
      { id: 'produtor-errado', codigo_produtor: 'P002', safra: '2026/2027', talhao_id: 't2', produto_id: 'calc1', produto_nome: 'Calcario A', dose_kg_ha: 1000 },
      { id: 'safra-errada', codigo_produtor: 'P001', safra: '2025/2026', talhao_id: 't2', produto_id: 'calc1', produto_nome: 'Calcario A', dose_kg_ha: 1000 },
    ],
    talhoes: talhoesBase,
    codigoProdutor: 'P001',
    safra: '2026/2027',
  });

  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].qtdTotal, 2000);
});

test('Resumo Geral inclui calagem salva e mantem distribuicao igual a aba Calagem', () => {
  const grupos = montarGruposResumoAdubacao2({
    resultados: null,
    calagens: [{
      id: 'c1', talhao_id: 't1', produto_id: 'calc1', produto_nome: 'Calcario A',
      dose_kg_ha: 1000, dose_total_kg: 2000, updated_date: '2026-07-01T10:00:00Z',
    }],
    talhoes: talhoesBase,
  });

  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].linhas[0].doseKgHa, 1000);
  assert.equal(grupos[0].linhas[0].totalKg, 2000);
  assert.equal(grupos[0].linhas[0].gPlanta, 2000);
  assert.equal(grupos[0].linhas[0].gMetro, 2857);
});

test('Resumo Geral nao oculta silenciosamente calagem positiva sem produto', () => {
  const grupos = montarGruposResumoAdubacao2({
    resultados: [],
    calagens: [{ id: 'c1', talhao_id: 't1', produto_nome: '', dose_kg_ha: 1000, dose_total_kg: 2000 }],
    talhoes: talhoesBase,
  });

  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].linhas[0].pendenteProduto, true);
});

test('V% com PRNT manual sem produto calcula, mas exige corretivo antes de salvar compra positiva', () => {
  const resultado = calcCalagemVpct({ ctc: 10, v1: 50, v2: 70, prnt: 80, area: 2 });
  assert.equal(resultado.doseFinalHa, 2500);
  assert.equal(podeSalvarRecomendacaoCalagem({ resultado, produto: null }), false);
  assert.equal(podeSalvarRecomendacaoCalagem({ resultado, produto: { id: 'calc1', nome: 'Calcario A' } }), true);

  const grupos = montarGruposResumoAdubacao2({
    resultados: [],
    calagens: [{ id: 'vpct', talhao_id: 't1', produto_nome: '', dose_kg_ha: resultado.doseFinalHa, dose_total_kg: resultado.totalKg }],
    talhoes: talhoesBase,
  });

  assert.equal(grupos[0].linhas[0].pendenteProduto, true);
});

test('Compras e Resumo preservam kg/ha, total, g/planta e g/metro da Calagem', () => {
  const calagens = [{ id: 'c1', talhao_id: 't1', produto_id: 'calc1', produto_nome: 'Calcario A', dose_kg_ha: 1000, dose_total_kg: 2000 }];
  const compras = consolidarComprasAdubacao2({ resultados: [], calagens, talhoes: talhoesBase });
  const resumo = montarGruposResumoAdubacao2({ resultados: [], calagens, talhoes: talhoesBase });

  assert.equal(compras[0].doseKgHa, 1000);
  assert.equal(compras[0].qtdTotal, resumo[0].linhas[0].totalKg);
  assert.equal(resumo[0].linhas[0].gPlanta, 2000);
  assert.equal(resumo[0].linhas[0].gMetro, 2857);
});

test('atualizacao imediata apos salvar substitui a calagem no cache sem duplicar', () => {
  const lista = atualizarListaCalagens([
    { id: 'c1', codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1', produto_nome: 'Calcario A', dose_kg_ha: 500 },
  ], {
    id: 'c1', codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1', produto_nome: 'Calcario A', dose_kg_ha: 1000,
  });

  assert.equal(lista.length, 1);
  assert.equal(lista[0].dose_kg_ha, 1000);
});
