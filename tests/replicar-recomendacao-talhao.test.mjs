import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODULOS_REPLICACAO_RECOMENDACAO,
  aplicarReplicacaoRecomendacaoTalhoes,
  calcularResumoReplicacaoRecomendacao,
  criarMetadadosReplicacao,
  detectarAlertasGessagemDestino,
  produtoEquivalenteReplicacao,
} from '../src/lib/replicarRecomendacaoTalhao.js';
import { consolidarComprasAdubacao2, montarGruposResumoAdubacao2 } from '../src/lib/calagemAdubacao2.js';

const produtor = { codigo: 'P001', nome: 'Produtor QA' };
const safra = '2026/2027';
const talhaoOrigem = { id: 'origem', nome: 'Origem', codigo_produtor: 'P001', area_ha: 2, num_plantas: 1000, espacamento: '3,5x0,7' };
const talhaoDestino = { id: 'destino', nome: 'Destino', codigo_produtor: 'P001', area_ha: 3, num_plantas: 1500, espacamento: '4x0,5' };
const talhaoOutroProdutor = { id: 'outro-produtor', nome: 'Outro produtor', codigo_produtor: 'P002', area_ha: 3, num_plantas: 1500, espacamento: '4x0,5' };

const ureia = { id: 'ureia', nome: 'Ureia', n_pct: 45 };
const map = { id: 'map', nome: 'MAP', n_pct: 11, p2o5_pct: 52 };
const boro = { id: 'boro', nome: 'Acido borico', b_pct: 17 };

function criarBase() {
  return {
    planejamentos: [{
      id: 'plan-origem',
      codigo_produtor: produtor.codigo,
      safra,
      talhao_id: talhaoOrigem.id,
      talhao_nome: talhaoOrigem.nome,
      safra1_sc_ha: 30,
      safra2_sc_ha: 34,
      analise2040: { calcio: 0.3, aluminio: 0.6 },
      doses_editadas: { N: 92 },
      detalhamento: {
        rec: { N: 90, P: 52, K: 120, B: 1.7 },
        mediaBienal: 32,
        produtoSugerido: ureia,
        doseProdutoHa: 200,
        dose_calculada_kg_ha: 200,
        dose_utilizada_kg_ha: 220,
        dose_ajustada_manualmente: true,
        nutriente_alvo: 'n_pct',
        complementos: [
          { produto: map, doseKgHa: 100, dose_utilizada_kg_ha: 100, nutriente_alvo: 'p2o5_pct', nutKey: 'p2o5_pct' },
          { produto: boro, doseKgHa: 10, dose_utilizada_kg_ha: 10, nutriente_alvo: 'b_pct', nutKey: 'b_pct', isManualExtra: true },
        ],
        trocas: { n_pct: 'ureia' },
        marcados: { N: true, P: true, K: false, B: true },
        produtos_ocultos: [{ linhaId: 'k2o_pct:kcl', produtoId: 'kcl', nutriente_alvo: 'k2o_pct' }],
        precos: { ureia: 6, map: 7, boro: 12 },
        parcelamentos: {
          ureia: { parcelas: [{ pct: 60, meses: ['OUT'] }, { pct: 40, meses: ['JAN'] }] },
          map: { parcelas: [{ pct: 100, meses: ['NOV'] }] },
        },
        observacoes: 'Observacao do planejamento',
      },
    }],
    calagens: [{
      id: 'cal-origem',
      codigo_produtor: produtor.codigo,
      safra,
      talhao_id: talhaoOrigem.id,
      talhao_nome: talhaoOrigem.nome,
      meta: 'Bom',
      produto_id: 'calc1',
      produto_nome: 'Calcario dolomitico',
      cao_calcario_pct: 35,
      ca_calcario_pct: 26,
      mg_calcario_pct: 12,
      prnt_calcario: 88,
      dose_kg_ha: 1500,
      dose_total_kg: 3000,
      preco_unitario: 500,
      unidade_preco: 't',
      observacoes: 'Observacao calagem',
    }],
    gessagens: [{
      id: 'ges-origem',
      codigo_produtor: produtor.codigo,
      safra,
      talhao_id: talhaoOrigem.id,
      talhao_nome: talhaoOrigem.nome,
      ca_2040: 0.3,
      al_2040: 0.6,
      saturacao_aluminio: 35,
      indicada: true,
      motivos: ['Ca menor que 0,4 cmolc/dm³'],
      metodo_calculo: 'dose_manual',
      dose_final_kg_ha: 1000,
      produto_id: 'gesso1',
      produto_nome: 'Gesso agricola',
      cao_gesso_pct: 25,
      preco_unitario: 500,
      unidade_preco: 't',
      quantidade_total_kg: 2000,
      custo_ha: 500,
      custo_total: 1000,
      ca_fornecido_kg_ha: 180,
      s_fornecido_kg_ha: 150,
      aplicar_sem_indicacao_tecnica: true,
      observacoes: 'Observacao gessagem',
    }],
    analisesDestino: {
      destino: { calcio: 1, aluminio: 0.1, saturacao_aluminio: 5, argila_pct: 40 },
    },
  };
}

test('copiar dose em kg/ha recalcula quantidade total, custo total, gramas por planta e gramas por metro pela area do destino', () => {
  const base = criarBase();
  const resultado = aplicarReplicacaoRecomendacaoTalhoes({
    produtor,
    safra,
    talhaoOrigem,
    talhoesDestino: [talhaoDestino],
    planejamentos: base.planejamentos,
    calagens: base.calagens,
    gessagens: base.gessagens,
    analises2040PorTalhao: base.analisesDestino,
    modulos: MODULOS_REPLICACAO_RECOMENDACAO,
    politicaConflito: 'substituir',
    agora: '2026-07-31T12:00:00.000Z',
  });

  const planejamento = resultado.planejamentosCriados[0];
  const calagem = resultado.calagensCriadas[0];
  const gessagem = resultado.gessagensCriadas[0];
  assert.equal(planejamento.id, undefined);
  assert.equal(planejamento.talhao_id, talhaoDestino.id);
  assert.equal(planejamento.detalhamento.dose_utilizada_kg_ha, 220);
  assert.equal(calagem.id, undefined);
  assert.equal(calagem.dose_kg_ha, 1500);
  assert.equal(calagem.dose_total_kg, 4500);
  assert.equal(gessagem.id, undefined);
  assert.equal(gessagem.quantidade_total_kg, 3000);
  assert.equal(gessagem.custo_ha, 500);
  assert.equal(gessagem.custo_total, 1500);

  const resumo = montarGruposResumoAdubacao2({
    resultados: [{ talhao: talhaoDestino, rec: planejamento.detalhamento.rec, produtoSugerido: ureia, doseProdutoHa: 220, mediaBienal: 32 }],
    produtosEfetivos: { destino: { produto: ureia, doseKgHa: 220, complementos: planejamento.detalhamento.complementos } },
    registrosSalvos: [planejamento],
    calagens: [calagem],
    gessagens: [gessagem],
    talhoes: [talhaoDestino],
  });
  const linhaUreia = resumo[0].linhas.find(linha => linha.produtoId === 'ureia');
  assert.equal(linhaUreia.totalKg, 660);
  assert.equal(linhaUreia.gPlanta, 440);
  assert.equal(linhaUreia.gMetro, 880);
  assert.equal(linhaUreia.custoTotal, 3960);
});

test('nao duplica produtos ausentes e preserva existentes ao adicionar somente produtos ausentes', () => {
  const base = criarBase();
  base.planejamentos.push({
    id: 'plan-destino',
    codigo_produtor: produtor.codigo,
    safra,
    talhao_id: talhaoDestino.id,
    talhao_nome: talhaoDestino.nome,
    detalhamento: {
      rec: { N: 80 },
      produtoSugerido: { id: 'ureia', nome: 'Ureia' },
      doseProdutoHa: 180,
      dose_utilizada_kg_ha: 180,
      complementos: [{ produto: { nome: 'MAP', p2o5_pct: 52 }, doseKgHa: 90 }],
      precos: { ureia: 5 },
      parcelamentos: {},
    },
  });

  const resultado = aplicarReplicacaoRecomendacaoTalhoes({
    produtor,
    safra,
    talhaoOrigem,
    talhoesDestino: [talhaoDestino],
    planejamentos: base.planejamentos,
    calagens: base.calagens,
    gessagens: base.gessagens,
    modulos: ['planejamento'],
    politicaConflito: 'adicionar_ausentes',
    agora: '2026-07-31T12:00:00.000Z',
  });

  const atualizado = resultado.planejamentosAtualizados[0];
  assert.equal(atualizado.id, 'plan-destino');
  assert.equal(atualizado.detalhamento.produtoSugerido.id, 'ureia');
  assert.equal(atualizado.detalhamento.dose_utilizada_kg_ha, 180);
  assert.equal(atualizado.detalhamento.complementos.length, 2);
  assert.equal(atualizado.detalhamento.complementos.filter(c => produtoEquivalenteReplicacao(c.produto, map)).length, 1);
  assert.equal(atualizado.detalhamento.complementos.some(c => c.produto.id === 'boro'), true);
});

test('substituir completamente troca registro existente e ignorar preserva destino existente', () => {
  const base = criarBase();
  base.calagens.push({ id: 'cal-destino', codigo_produtor: produtor.codigo, safra, talhao_id: talhaoDestino.id, dose_kg_ha: 500 });
  const substituir = aplicarReplicacaoRecomendacaoTalhoes({
    produtor,
    safra,
    talhaoOrigem,
    talhoesDestino: [talhaoDestino],
    planejamentos: base.planejamentos,
    calagens: base.calagens,
    gessagens: base.gessagens,
    modulos: ['calagem'],
    politicaConflito: 'substituir',
  });
  assert.equal(substituir.calagensAtualizadas[0].id, 'cal-destino');
  assert.equal(substituir.calagensAtualizadas[0].dose_kg_ha, 1500);

  const ignorar = aplicarReplicacaoRecomendacaoTalhoes({
    produtor,
    safra,
    talhaoOrigem,
    talhoesDestino: [talhaoDestino],
    planejamentos: base.planejamentos,
    calagens: base.calagens,
    gessagens: base.gessagens,
    modulos: ['calagem'],
    politicaConflito: 'ignorar_existentes',
  });
  assert.equal(ignorar.calagensAtualizadas.length, 0);
  assert.equal(ignorar.ignorados.length, 1);
});

test('nao copia modulos desmarcados e permite copiar cada modulo isoladamente', () => {
  const base = criarBase();
  for (const modulo of MODULOS_REPLICACAO_RECOMENDACAO) {
    const resultado = aplicarReplicacaoRecomendacaoTalhoes({
      produtor,
      safra,
      talhaoOrigem,
      talhoesDestino: [talhaoDestino],
      planejamentos: base.planejamentos,
      calagens: base.calagens,
      gessagens: base.gessagens,
      modulos: [modulo],
      politicaConflito: 'substituir',
    });
    assert.equal(resultado.planejamentosCriados.length, modulo === 'planejamento' ? 1 : 0);
    assert.equal(resultado.calagensCriadas.length, modulo === 'calagem' ? 1 : 0);
    assert.equal(resultado.gessagensCriadas.length, modulo === 'gessagem' ? 1 : 0);
  }
});

test('nao altera analise de solo nem diagnostico proprio de gessagem do destino', () => {
  const base = criarBase();
  const analiseAntes = { ...base.analisesDestino.destino };
  const resultado = aplicarReplicacaoRecomendacaoTalhoes({
    produtor,
    safra,
    talhaoOrigem,
    talhoesDestino: [talhaoDestino],
    planejamentos: base.planejamentos,
    calagens: base.calagens,
    gessagens: base.gessagens,
    analises2040PorTalhao: base.analisesDestino,
    modulos: ['gessagem'],
    politicaConflito: 'substituir',
  });

  assert.deepEqual(base.analisesDestino.destino, analiseAntes);
  assert.equal(resultado.gessagensCriadas[0].indicada, false);
  assert.equal(resultado.gessagensCriadas[0].dose_final_kg_ha, 1000);
});

test('registra rastreabilidade e mantém compatibilidade com registros antigos sem metadados', () => {
  const base = criarBase();
  const resultado = aplicarReplicacaoRecomendacaoTalhoes({
    produtor,
    safra,
    talhaoOrigem,
    talhoesDestino: [talhaoDestino],
    planejamentos: base.planejamentos.map(({ detalhamento, ...registro }) => ({ ...registro, detalhamento: { ...detalhamento, rastreabilidade_replicacao: undefined } })),
    calagens: base.calagens,
    gessagens: base.gessagens,
    modulos: ['planejamento'],
    politicaConflito: 'substituir',
    usuario: { email: 'qa2@cafeplan.local' },
    agora: '2026-07-31T12:00:00.000Z',
  });
  const meta = resultado.planejamentosCriados[0].detalhamento.rastreabilidade_replicacao;
  assert.equal(meta.talhao_origem_id, talhaoOrigem.id);
  assert.equal(meta.talhao_origem_nome, talhaoOrigem.nome);
  assert.equal(meta.usuario, 'qa2@cafeplan.local');
  assert.deepEqual(meta.modulos, ['planejamento']);
  assert.equal(criarMetadadosReplicacao({ talhaoOrigem, modulos: ['calagem'], politicaConflito: 'substituir' }).modulos[0], 'calagem');
});

test('impede cópia para produtor ou safra diferente', () => {
  const base = criarBase();
  const resultado = aplicarReplicacaoRecomendacaoTalhoes({
    produtor,
    safra,
    talhaoOrigem,
    talhoesDestino: [talhaoOutroProdutor, { ...talhaoDestino, safra: '2025/2026' }],
    planejamentos: base.planejamentos,
    calagens: base.calagens,
    gessagens: base.gessagens,
    modulos: MODULOS_REPLICACAO_RECOMENDACAO,
    politicaConflito: 'substituir',
  });

  assert.equal(resultado.atualizados, 0);
  assert.equal(resultado.erros.length, 2);
});

test('alerta conflito de diagnóstico e exige confirmação para gessagem sem indicação', () => {
  const base = criarBase();
  const alertas = detectarAlertasGessagemDestino({
    origem: base.gessagens[0],
    destinoAnalise2040: base.analisesDestino.destino,
    talhaoDestino,
  });

  assert.equal(alertas.diagnosticoDiferente, true);
  assert.equal(alertas.exigeConfirmacaoSemIndicacao, true);
});

test('Consolidacao de Compras e Resumo Geral usam totais recalculados após replicação', () => {
  const base = criarBase();
  const resultado = aplicarReplicacaoRecomendacaoTalhoes({
    produtor,
    safra,
    talhaoOrigem,
    talhoesDestino: [talhaoDestino],
    planejamentos: base.planejamentos,
    calagens: base.calagens,
    gessagens: base.gessagens,
    analises2040PorTalhao: base.analisesDestino,
    modulos: MODULOS_REPLICACAO_RECOMENDACAO,
    politicaConflito: 'substituir',
  });
  const planejamento = resultado.planejamentosCriados[0];
  const calagensPersistidas = resultado.calagensCriadas.map((registro, indice) => ({ ...registro, id: `cal-nova-${indice}` }));
  const gessagensPersistidas = resultado.gessagensCriadas.map((registro, indice) => ({ ...registro, id: `ges-nova-${indice}` }));
  const produtosEfetivos = {
    destino: {
      produto: planejamento.detalhamento.produtoSugerido,
      doseKgHa: planejamento.detalhamento.dose_utilizada_kg_ha,
      complementos: planejamento.detalhamento.complementos,
    },
  };
  const resultados = [{
    talhao: talhaoDestino,
    rec: planejamento.detalhamento.rec,
    produtoSugerido: planejamento.detalhamento.produtoSugerido,
    doseProdutoHa: planejamento.detalhamento.dose_utilizada_kg_ha,
    mediaBienal: planejamento.detalhamento.mediaBienal,
  }];
  const compras = consolidarComprasAdubacao2({
    resultados,
    produtosEfetivos,
    registrosSalvos: [planejamento],
    calagens: calagensPersistidas,
    gessagens: gessagensPersistidas,
    talhoes: [talhaoDestino],
  });
  const resumo = montarGruposResumoAdubacao2({
    resultados,
    produtosEfetivos,
    registrosSalvos: [planejamento],
    calagens: calagensPersistidas,
    gessagens: gessagensPersistidas,
    talhoes: [talhaoDestino],
  });

  assert.equal(compras.find(l => l.produto.nome === 'Ureia').qtdTotal, 660);
  assert.equal(compras.find(l => l.produto.nome === 'Calcario dolomitico').qtdTotal, 4500);
  assert.equal(compras.find(l => l.produto.nome === 'Gesso agricola').qtdTotal, 3000);
  assert.equal(resumo[0].linhas.find(l => l.produtoNome === 'Ureia').totalKg, 660);
});

test('resumo do modal conta produtos, doses, parcelamentos e custos por hectare', () => {
  const base = criarBase();
  const resumo = calcularResumoReplicacaoRecomendacao({
    talhaoOrigem,
    planejamento: base.planejamentos[0],
    calagem: base.calagens[0],
    gessagem: base.gessagens[0],
  });

  assert.equal(resumo.planejamento.quantidadeProdutos, 3);
  assert.deepEqual(resumo.planejamento.dosesKgHa, [220, 100, 10]);
  assert.equal(resumo.planejamento.parcelamentos, 2);
  assert.equal(resumo.planejamento.custoHa, 2140);
  assert.equal(resumo.calagem.produto, 'Calcario dolomitico');
  assert.equal(resumo.gessagem.custoHa, 500);
});
