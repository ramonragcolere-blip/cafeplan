import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcCalagemVpct,
  calcularCustoCalagem,
  calcularDistribuicaoCalagem,
  consolidarComprasAdubacao2,
  atualizarListaCalagens,
  formatarPrecoUnitarioCalagem,
  formatarPeriodoAplicacao,
  lerDadosAnaliseCalagem,
  montarGruposResumoAdubacao2,
  podeSalvarRecomendacaoCalagem,
  resolverRegistroCalagemAtual,
  selecionarRegistroCalagem,
} from '../src/lib/calagemAdubacao2.js';
import {
  calcularDoseProdutoPorAlvo,
  calcularBalancoNutrientes,
  combinarCatalogoInsumos,
  formatarNutrientesFornecidosAdubacao2,
  listarNutrientesFornecidosAdubacao2,
  montarLinhasProdutos,
  montarProdutosEfetivosPlanejamento,
  normalizarComposicaoProdutoAdubacao2,
  produtoNuloAdubacao2,
} from '../src/lib/planejamentoProdutosAdubacao2.js';
import { readFileSync } from 'node:fs';

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

test('Calagem duplicada prefere registro valido com dose positiva sobre registro vazio mais recente', () => {
  const selecionado = selecionarRegistroCalagem([
    { id: 'valido', talhao_id: 't1', produto_id: 'calc1', produto_nome: 'Calcario A', dose_kg_ha: 1500, updated_date: '2026-07-01T10:00:00Z' },
    { id: 'vazio', talhao_id: 't1', produto_id: '', produto_nome: '', dose_kg_ha: 0, updated_date: '2026-07-02T10:00:00Z' },
  ]);

  assert.equal(selecionado.id, 'valido');
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

test('periodo de aplicacao formata parcelamento com uma parcela', () => {
  assert.equal(formatarPeriodoAplicacao({ parcelas: [{ pct: 100, meses: ['OUT', 'NOV'] }] }), '100% — OUT/NOV');
});

test('periodo de aplicacao formata duas ou mais parcelas na ordem cadastrada', () => {
  assert.equal(formatarPeriodoAplicacao({
    parcelas: [
      { pct: 60, meses: ['OUT', 'NOV'] },
      { pct: 40, meses: ['JAN', 'FEV'] },
      { pct: 10, meses: ['MAR'] },
    ],
  }), '1ª parcela: 60% — OUT/NOV\n2ª parcela: 40% — JAN/FEV\n3ª parcela: 10% — MAR');
});

test('Resumo Geral mostra periodo do produto principal, complemento e produto manual', () => {
  const produtosEfetivos = {
    t1: {
      produto: { id: 'npk', nome: '20-00-20' },
      doseKgHa: 400,
      complementos: [
        { produto: { id: 'boro', nome: 'Ácido bórico' }, doseKgHa: 10, nutrientes: [{ label: 'B' }] },
        { produto: { id: 'zinco', nome: 'Sulfato de zinco' }, doseKgHa: 5, nutrientes: [], isManualExtra: true },
      ],
    },
  };
  const registrosSalvos = [{
    talhao_id: 't1',
    detalhamento: {
      parcelamentos: {
        npk: { parcelas: [{ pct: 100, meses: ['OUT', 'NOV'] }] },
        boro: { parcelas: [{ pct: 50, meses: ['OUT'] }, { pct: 50, meses: ['JAN'] }] },
        zinco: { parcelas: [{ pct: 100, meses: ['DEZ'] }] },
      },
    },
  }];
  const grupos = montarGruposResumoAdubacao2({
    resultados: [{ talhao: talhoesBase[0], rec: { N: 1 }, mediaBienal: 30 }],
    produtosEfetivos,
    talhoes: talhoesBase,
    registrosSalvos,
  });

  assert.equal(grupos[0].linhas.find(l => l.produtoId === 'npk').periodoAplicacao, '100% — OUT/NOV');
  assert.equal(grupos[0].linhas.find(l => l.produtoId === 'boro').periodoAplicacao, '1ª parcela: 50% — OUT\n2ª parcela: 50% — JAN');
  assert.equal(grupos[0].linhas.find(l => l.produtoId === 'zinco').periodoAplicacao, '100% — DEZ');
});

test('ausencia de parcelamento retorna A definir no Resumo Geral', () => {
  const grupos = montarGruposResumoAdubacao2({
    resultados: [{ talhao: talhoesBase[0], rec: { N: 1 }, produtoSugerido: { id: 'npk', nome: '20-00-20' }, doseProdutoHa: 400 }],
    talhoes: talhoesBase,
    registrosSalvos: [{ talhao_id: 't1', detalhamento: { parcelamentos: {} } }],
  });

  assert.equal(grupos[0].linhas[0].periodoAplicacao, 'A definir');
});

test('impressao do Resumo Geral inclui coluna Periodo de aplicacao', () => {
  const componente = readFileSync(new URL('../src/components/adubacao2/AbaResumoGeral2.jsx', import.meta.url), 'utf8');

  assert.match(componente, /Período de aplicação/);
  assert.match(componente, /resumo2-detalhe-tabela/);
});

test('periodo de aplicacao nao altera consolidacao, doses, custos ou quantidades', () => {
  const resultados = [{
    talhao: talhoesBase[0],
    rec: { N: 1 },
    produtoSugerido: { id: 'npk', nome: '20-00-20' },
    doseProdutoHa: 400,
    mediaBienal: 30,
  }];
  const registrosSalvos = [{
    talhao_id: 't1',
    detalhamento: { parcelamentos: { npk: { parcelas: [{ pct: 100, meses: ['OUT'] }] } } },
  }];
  const semPeriodo = montarGruposResumoAdubacao2({ resultados, talhoes: talhoesBase });
  const comPeriodo = montarGruposResumoAdubacao2({ resultados, talhoes: talhoesBase, registrosSalvos });
  const comprasAntes = consolidarComprasAdubacao2({ resultados, talhoes: talhoesBase });
  const comprasDepois = consolidarComprasAdubacao2({ resultados, talhoes: talhoesBase });
  const camposResumo = ({ periodoAplicacao: _periodoAplicacao, ...linha }) => linha;

  assert.deepEqual(camposResumo(comPeriodo[0].linhas[0]), camposResumo(semPeriodo[0].linhas[0]));
  assert.deepEqual(comprasDepois, comprasAntes);
});

test('salvar preco do calcario em R$/t calcula custo por hectare e custo total', () => {
  const custo = calcularCustoCalagem({
    doseKgHa: 1000,
    doseTotalKg: 2000,
    precoUnitario: 500,
    unidadePreco: 't',
  });

  assert.equal(custo.precoUnitario, 500);
  assert.equal(custo.unidadePreco, 't');
  assert.equal(custo.custoHa, 500);
  assert.equal(custo.custoTotal, 1000);
});

test('salvar preco em R$/kg calcula custo por hectare, custo total e formata unidade', () => {
  const custo = calcularCustoCalagem({
    doseKgHa: 1000,
    doseTotalKg: 2000,
    precoUnitario: 2.5,
    unidadePreco: 'kg',
  });

  assert.equal(custo.custoHa, 2500);
  assert.equal(custo.custoTotal, 5000);
  assert.equal(formatarPrecoUnitarioCalagem(500, 't'), 'R$ 500,00/t');
  assert.equal(formatarPrecoUnitarioCalagem(2.5, 'kg'), 'R$ 2,50/kg');
});

test('restaurar preco salvo da calagem leva preco e custos ao Resumo Geral', () => {
  const grupos = montarGruposResumoAdubacao2({
    resultados: [],
    calagens: [{
      id: 'c1',
      talhao_id: 't1',
      produto_id: 'calc1',
      produto_nome: 'Calcario A',
      dose_kg_ha: 1000,
      dose_total_kg: 2000,
      preco_unitario: 500,
      unidade_preco: 't',
    }],
    talhoes: talhoesBase,
  });
  const linha = grupos[0].linhas[0];

  assert.equal(linha.precoUnitario, 500);
  assert.equal(linha.unidadePreco, 't');
  assert.equal(linha.custoHa, 500);
  assert.equal(linha.custoTotal, 1000);
});

test('calagem soma no Total Geral e na Consolidacao de Compras sem depender de R$/kg', () => {
  const compras = consolidarComprasAdubacao2({
    resultados: [],
    calagens: [{
      id: 'c1',
      talhao_id: 't1',
      produto_id: 'calc1',
      produto_nome: 'Calcario A',
      dose_kg_ha: 1000,
      dose_total_kg: 2000,
      preco_unitario: 500,
      unidade_preco: 't',
    }],
    talhoes: talhoesBase,
  });

  assert.equal(compras[0].isCalagem, true);
  assert.equal(compras[0].preco, 500);
  assert.equal(compras[0].unidadePreco, 't');
  assert.equal(compras[0].custoTotal, 1000);
});

test('produto id 0 e nome 0 sao reconhecidos como nulos e ignorados visualmente', () => {
  assert.equal(produtoNuloAdubacao2({ id: 0, nome: 'Calcario' }), true);
  assert.equal(produtoNuloAdubacao2({ id: 'calc1', nome: '0' }), true);

  const grupos = montarGruposResumoAdubacao2({
    resultados: [{ talhao: talhoesBase[0], rec: { N: 1 }, produtoSugerido: { id: '0', nome: '0' }, doseProdutoHa: 400 }],
    calagens: [{ id: 'c0', talhao_id: 't2', produto_id: '0', produto_nome: '0', dose_kg_ha: 1000, dose_total_kg: 3000 }],
    talhoes: talhoesBase,
  });
  const compras = consolidarComprasAdubacao2({
    resultados: [{ talhao: talhoesBase[0], rec: { N: 1 }, produtoSugerido: { id: '0', nome: '0' }, doseProdutoHa: 400 }],
    calagens: [{ id: 'c0', talhao_id: 't2', produto_id: '0', produto_nome: '0', dose_kg_ha: 1000, dose_total_kg: 3000 }],
    talhoes: talhoesBase,
  });

  assert.equal(grupos.length, 0);
  assert.equal(compras.length, 0);
});

test('produto 0 fica ausente do PDF e somente linha do talhao recebe cor fixa no HTML de impressao', () => {
  const componente = readFileSync(new URL('../src/components/adubacao2/AbaResumoGeral2.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(componente, /talhao-cor-/);
  assert.doesNotMatch(componente, /#dbeafe|#fef3c7|#ede9fe/);
  assert.match(componente, /\.print-row-talhao \{ background-color: #d9f2df !important;/);
  assert.match(componente, /\.row-talhao td \{ background: #d9f2df !important; font-weight: 700; \}/);
  assert.match(componente, /-webkit-print-color-adjust: exact/);
  assert.match(componente, /print-color-adjust: exact/);
  assert.match(componente, /Preço unitário/);
});

test('ocultar produto automatico remove de compras resumo e permanece no payload efetivo', () => {
  const ureia = { id: 'ureia', nome: 'Ureia', n_pct: 45, p2o5_pct: 0, k2o_pct: 0, b_pct: 0, _tipo: 'fonte' };
  const resultados = [{ talhao: talhoesBase[0], rec: { N: 90 }, produtoSugerido: ureia, doseProdutoHa: 200 }];
  const produtosEfetivos = montarProdutosEfetivosPlanejamento({
    resultados,
    todosFiltrados: [ureia],
    todosCatalogo: [ureia],
    produtosOcultosPorTalhao: { t1: [{ linhaId: 'n_pct:ureia', produtoId: 'ureia' }] },
  });
  const compras = consolidarComprasAdubacao2({ resultados, produtosEfetivos, talhoes: talhoesBase });
  const resumo = montarGruposResumoAdubacao2({ resultados, produtosEfetivos, talhoes: talhoesBase });

  assert.equal(produtosEfetivos.t1.produtos_ocultos.length, 1);
  assert.equal(compras.length, 0);
  assert.equal(resumo.length, 0);
});

test('remover produto principal, complemento automatico e produto livre respeita produtos ocultos', () => {
  const ureia = { id: 'ureia', nome: 'Ureia', n_pct: 45, p2o5_pct: 0, k2o_pct: 0, b_pct: 0, _tipo: 'fonte' };
  const boro = { id: 'boro', nome: 'Acido borico', n_pct: 0, p2o5_pct: 0, k2o_pct: 0, b_pct: 17, _tipo: 'fonte' };
  const map = { id: 'map', nome: 'MAP', n_pct: 11, p2o5_pct: 52, k2o_pct: 0, b_pct: 0, _tipo: 'fonte' };
  const resultados = [{ talhao: talhoesBase[0], rec: { N: 90, B: 1.7 }, produtoSugerido: ureia, doseProdutoHa: 200 }];
  const produtosEfetivos = montarProdutosEfetivosPlanejamento({
    resultados,
    todosFiltrados: [ureia, boro, map],
    todosCatalogo: [ureia, boro, map],
    extrasPorTalhao: { t1: { 'manual-map': { produtoId: 'map', doseKgHa: 100, isManualLivre: true, usoSeparado: true } } },
    produtosOcultosPorTalhao: {
      t1: [
        { linhaId: 'n_pct:ureia', produtoId: 'ureia' },
        { linhaId: 'b_pct:boro', produtoId: 'boro' },
        { linhaId: 'manual-map', produtoId: 'map' },
      ],
    },
  });

  assert.equal(produtosEfetivos.t1.produto, null);
  assert.equal(produtosEfetivos.t1.complementos.length, 0);
  assert.equal(produtosEfetivos.t1.produtos_ocultos.length, 3);
});

test('remover produto selecionado em cards Zn e Mg mantem cards marcados e oculta produto', () => {
  const sulfatoZn = { id: 'zn', nome: 'Sulfato de zinco', zn_pct: 20, mg_pct: 0, n_pct: 0, p2o5_pct: 0, k2o_pct: 0, b_pct: 0, _tipo: 'fonte' };
  const sulfatoMg = { id: 'mg', nome: 'Sulfato de magnesio', mg_pct: 9, zn_pct: 0, n_pct: 0, p2o5_pct: 0, k2o_pct: 0, b_pct: 0, _tipo: 'fonte' };
  const resultados = [{ talhao: talhoesBase[0], rec: { N: 0 }, produtoSugerido: null, doseProdutoHa: null }];
  const produtosEfetivos = montarProdutosEfetivosPlanejamento({
    resultados,
    todosFiltrados: [sulfatoZn, sulfatoMg],
    todosCatalogo: [sulfatoZn, sulfatoMg],
    marcadosPorTalhao: { t1: { Zn: true, Mg: true } },
    extrasPorTalhao: {
      t1: {
        Zn: { produtoId: 'zn', doseKgHa: 10, nutriente_alvo: 'zn_pct', nutKey: 'zn_pct' },
        Mg: { produtoId: 'mg', doseKgHa: 20, nutriente_alvo: 'mg_pct', nutKey: 'mg_pct' },
      },
    },
    produtosOcultosPorTalhao: { t1: [{ linhaId: 'Zn', produtoId: 'zn' }, { linhaId: 'Mg', produtoId: 'mg' }] },
  });

  assert.equal(produtosEfetivos.t1.marcados.Zn, true);
  assert.equal(produtosEfetivos.t1.marcados.Mg, true);
  assert.equal(produtosEfetivos.t1.complementos.length, 0);
  assert.equal(produtosEfetivos.t1.produtos_ocultos.length, 2);
});

test('restaurar produto oculto devolve produto automatico a compras e resumo', () => {
  const ureia = { id: 'ureia', nome: 'Ureia', n_pct: 45, p2o5_pct: 0, k2o_pct: 0, b_pct: 0, _tipo: 'fonte' };
  const resultados = [{ talhao: talhoesBase[0], rec: { N: 90 }, produtoSugerido: ureia, doseProdutoHa: 200 }];
  const produtosEfetivos = montarProdutosEfetivosPlanejamento({
    resultados,
    todosFiltrados: [ureia],
    todosCatalogo: [ureia],
    produtosOcultosPorTalhao: { t1: [] },
  });

  assert.equal(consolidarComprasAdubacao2({ resultados, produtosEfetivos, talhoes: talhoesBase }).length, 1);
  assert.equal(montarGruposResumoAdubacao2({ resultados, produtosEfetivos, talhoes: talhoesBase }).length, 1);
});

test('BR Solo 66 consolidado para B e Zn sem dupla contagem e com nutriente-alvo editavel', () => {
  const brSolo66 = { id: 'br66', nome: 'BR Solo 66', b_pct: 6, zn_pct: 6, n_pct: 0, p2o5_pct: 0, k2o_pct: 0, _tipo: 'fonte' };
  const linhas = montarLinhasProdutos([brSolo66], { B: 6, Zn: 6 }, {}, brSolo66, 100, null, { B: 6, Zn: 6 });
  const linha = linhas[0];
  const nutrientes = listarNutrientesFornecidosAdubacao2(brSolo66, 100);
  const balanco = calcularBalancoNutrientes({ B: 6, Zn: 6 }, [{ produto: brSolo66, doseKgHa: 100 }]);

  assert.equal(linhas.length, 1);
  assert.equal(linha.produto.id, 'br66');
  assert.equal(linha.doseKgHa, 100);
  assert.equal(linha.nutrientes.some(n => n.label === 'B'), true);
  assert.equal(linha.nutrientes.some(n => n.label === 'Zn'), true);
  assert.equal(nutrientes.find(n => n.label === 'B').fornecido, 6);
  assert.equal(nutrientes.find(n => n.label === 'Zn').fornecido, 6);
  assert.equal(formatarNutrientesFornecidosAdubacao2(brSolo66, 100), 'B 6,0 kg/ha · Zn 6,0 kg/ha');
  assert.equal(balanco.find(n => n.nutriente === 'B').situacao, 'Atendido');
  assert.equal(balanco.find(n => n.nutriente === 'Zn').situacao, 'Atendido');
  assert.equal(calcularDoseProdutoPorAlvo(brSolo66, 'zn_pct', { Zn: 6 }), 100);
});

test('BR Solo 66 carrega composicao canonica de B e Zn sem depender do nome', () => {
  const produtoTexto = {
    id: 'br66',
    nome: 'Produto comercial qualquer 66',
    composicao_texto: 'Garantias: 6% B e 6% Zn',
    outros_nutrientes: '',
  };
  const normalizado = normalizarComposicaoProdutoAdubacao2(produtoTexto);
  const [catalogo] = combinarCatalogoInsumos([produtoTexto], []);

  assert.equal(normalizado.b_pct, 6);
  assert.equal(normalizado.zn_pct, 6);
  assert.equal(catalogo.b_pct, 6);
  assert.equal(catalogo.zn_pct, 6);
});

test('fallback textual aceita Boro/Zinco antes ou depois do percentual e preserva numero existente', () => {
  const textoAntes = normalizarComposicaoProdutoAdubacao2({
    id: 'txt1',
    nome: 'Fonte texto',
    composicao_texto: 'Boro 6% / Zinco 6%',
  });
  const textoDepois = normalizarComposicaoProdutoAdubacao2({
    id: 'txt2',
    nome: 'Fonte texto',
    outros_nutrientes: '6% B; 6% Zn',
  });
  const comNumero = normalizarComposicaoProdutoAdubacao2({
    id: 'num',
    nome: 'Fonte numero',
    b_pct: 5,
    zn_pct: 4,
    composicao_texto: '6% B e 6% Zn',
  });
  const semTextoClaro = normalizarComposicaoProdutoAdubacao2({
    id: 'nome',
    nome: 'BR Solo Zinco e Boro 66',
  });

  assert.equal(textoAntes.b_pct, 6);
  assert.equal(textoAntes.zn_pct, 6);
  assert.equal(textoDepois.b_pct, 6);
  assert.equal(textoDepois.zn_pct, 6);
  assert.equal(comNumero.b_pct, 5);
  assert.equal(comNumero.zn_pct, 4);
  assert.equal(semTextoClaro.b_pct, undefined);
  assert.equal(semTextoClaro.zn_pct, undefined);
});

test('BR Solo 66 fornece B e Zn em kg por hectare para doses de 100 e 130 kg/ha', () => {
  const brSolo66 = normalizarComposicaoProdutoAdubacao2({
    id: 'br66',
    nome: 'BR Solo Zinco e Boro 66',
    composicao_texto: 'B 6% Zn 6%',
  });
  const nutrientes100 = listarNutrientesFornecidosAdubacao2(brSolo66, 100);
  const nutrientes130 = listarNutrientesFornecidosAdubacao2(brSolo66, 130);
  const balanco = calcularBalancoNutrientes({ B: 6, Zn: 6 }, [{ produto: brSolo66, doseKgHa: 100 }]);
  const compras = consolidarComprasAdubacao2({
    resultados: [{ talhao: talhoesBase[0], rec: { B: 6, Zn: 6 }, produtoSugerido: brSolo66, doseProdutoHa: 100 }],
    produtosEfetivos: { t1: { produto: brSolo66, doseKgHa: 100, complementos: [] } },
    talhoes: talhoesBase,
  });

  assert.equal(nutrientes100.find(n => n.label === 'B').fornecido, 6);
  assert.equal(nutrientes100.find(n => n.label === 'Zn').fornecido, 6);
  assert.equal(nutrientes130.find(n => n.label === 'B').fornecido, 7.8);
  assert.equal(nutrientes130.find(n => n.label === 'Zn').fornecido, 7.8);
  assert.equal(formatarNutrientesFornecidosAdubacao2(brSolo66, 100), 'B 6,0 kg/ha · Zn 6,0 kg/ha');
  assert.equal(balanco.find(n => n.nutriente === 'B').fornecido, 6);
  assert.equal(balanco.find(n => n.nutriente === 'Zn').fornecido, 6);
  assert.equal(compras.length, 1);
  assert.equal(compras[0].qtdTotal, 200);
});

test('Detalhamento por Talhao calcula custo por hectare de fertilizante e preserva calagem', () => {
  const ureia = { id: 'ureia', nome: 'Ureia', n_pct: 45, p2o5_pct: 0, k2o_pct: 0, b_pct: 0 };
  const grupos = montarGruposResumoAdubacao2({
    resultados: [{ talhao: talhoesBase[0], rec: { N: 90 }, produtoSugerido: ureia, doseProdutoHa: 100 }],
    produtosEfetivos: { t1: { produto: ureia, doseKgHa: 100, complementos: [] } },
    registrosSalvos: [{ talhao_id: 't1', detalhamento: { precos: { ureia: 6.10 } } }],
    calagens: [{
      id: 'c1',
      talhao_id: 't1',
      produto_id: 'calc1',
      produto_nome: 'Calcario A',
      dose_kg_ha: 1000,
      dose_total_kg: 2000,
      preco_unitario: 500,
      unidade_preco: 't',
    }],
    talhoes: talhoesBase,
  });

  const fertilizante = grupos[0].linhas.find(l => l.produtoId === 'ureia');
  const calagem = grupos[0].linhas.find(l => l.isCalagem);
  assert.equal(fertilizante.precoUnitario, 6.10);
  assert.equal(fertilizante.custoHa, 610);
  assert.equal(fertilizante.custoTotal, 1220);
  assert.equal(calagem.custoHa, 500);
  assert.equal(calagem.custoTotal, 1000);
});

test('PDF compras e resumo respeitam produtos ocultos sem duplicar quantidade nem custo', () => {
  const brSolo66 = { id: 'br66', nome: 'BR Solo 66', b_pct: 6, zn_pct: 6, n_pct: 0, p2o5_pct: 0, k2o_pct: 0, _tipo: 'fonte' };
  const resultados = [{ talhao: talhoesBase[0], rec: { B: 6, Zn: 6 }, produtoSugerido: brSolo66, doseProdutoHa: 100 }];
  const visivel = montarProdutosEfetivosPlanejamento({ resultados, todosFiltrados: [brSolo66], todosCatalogo: [brSolo66] });
  const oculto = montarProdutosEfetivosPlanejamento({
    resultados,
    todosFiltrados: [brSolo66],
    todosCatalogo: [brSolo66],
    produtosOcultosPorTalhao: { t1: [{ linhaId: 'n_pct:br66', produtoId: 'br66' }] },
  });

  assert.equal(consolidarComprasAdubacao2({ resultados, produtosEfetivos: visivel, talhoes: talhoesBase })[0].qtdTotal, 200);
  assert.equal(montarGruposResumoAdubacao2({ resultados, produtosEfetivos: visivel, talhoes: talhoesBase })[0].linhas.length, 1);
  assert.equal(consolidarComprasAdubacao2({ resultados, produtosEfetivos: oculto, talhoes: talhoesBase }).length, 0);
  assert.equal(montarGruposResumoAdubacao2({ resultados, produtosEfetivos: oculto, talhoes: talhoesBase }).length, 0);
});

test('schema e fallback de observacoes restauram preco da calagem apos reabrir ou atualizar', () => {
  const schema = readFileSync(new URL('../base44/entities/BaseRecomendacaoCalagem.jsonc', import.meta.url), 'utf8');
  assert.match(schema, /"preco_unitario"/);
  assert.match(schema, /"unidade_preco"/);

  const grupos = montarGruposResumoAdubacao2({
    resultados: [],
    calagens: [{
      id: 'c-meta',
      talhao_id: 't1',
      produto_id: 'calc1',
      produto_nome: 'Calcario A',
      dose_kg_ha: 1000,
      dose_total_kg: 2000,
      observacoes: JSON.stringify({ _tipo: 'calagem_adubacao2', preco_unitario: 500, unidade_preco: 't' }),
    }],
    talhoes: talhoesBase,
  });

  assert.equal(grupos[0].linhas[0].precoUnitario, 500);
  assert.equal(grupos[0].linhas[0].unidadePreco, 't');
  assert.equal(grupos[0].linhas[0].custoTotal, 1000);
});

test('PDF recupera layout anterior e mantem dados funcionais da PR 19', () => {
  const componente = readFileSync(new URL('../src/components/adubacao2/AbaResumoGeral2.jsx', import.meta.url), 'utf8');

  assert.match(componente, /body \{ font-family: Arial, sans-serif; font-size: 13px; margin: 24px; \}/);
  assert.match(componente, /h2 \{ font-size: 15px; margin-bottom: 4px; \}/);
  assert.match(componente, /table \{ width: 100%; border-collapse: collapse; margin-bottom: 8px; table-layout: fixed; \}/);
  assert.match(componente, /th, td \{ border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; overflow-wrap: anywhere; \}/);
  assert.match(componente, /Preço unitário/);
  assert.match(componente, /Custo\/ha/);
  assert.match(componente, /formatarPrecoUnitarioCalagem/);
});

test('PDF usa detalhamento compacto sem Custo total nem Nutrientes e mantem tela normal', () => {
  const componente = readFileSync(new URL('../src/components/adubacao2/AbaResumoGeral2.jsx', import.meta.url), 'utf8');
  const inicioTela = componente.indexOf("id=\"resumo2-detalhe-tabela\"");
  const inicioPrint = componente.indexOf("id=\"resumo2-detalhe-print-tabela\"");
  const trechoTela = componente.slice(inicioTela, inicioPrint);
  const trechoPrint = componente.slice(inicioPrint);

  assert.match(trechoTela, /'Custo total'/);
  assert.match(trechoTela, /'Nutrientes'/);
  assert.match(trechoPrint, /\['Produto', 'Qtd\. total', 'g\/planta', 'g\/metro', 'Preço unitário', 'Custo\/ha', 'Período de aplicação'\]/);
  assert.doesNotMatch(trechoPrint, /'Custo total'/);
  assert.doesNotMatch(trechoPrint, /'Nutrientes'/);
  assert.match(componente, /document\.getElementById\('resumo2-detalhe-print-tabela'\)/);
  assert.match(componente, /\.resumo2-screen-detail \{ display: none !important; \}/);
  assert.match(componente, /\.resumo2-print-only \{ display: block !important; \}/);
  assert.match(componente, /\.row-talhao td \{ background: #d9f2df !important; font-weight: 700; \}/);
  assert.doesNotMatch(componente, /talhao-cor-/);
  assert.doesNotMatch(componente, /#dbeafe|#fef3c7|#ede9fe/);
});
