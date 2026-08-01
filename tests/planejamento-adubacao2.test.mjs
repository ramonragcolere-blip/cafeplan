import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import {
  ajustarDoseLinha,
  calcularBalancoNutrientes,
  calcularDoseProdutoPorAlvo,
  calcularNutrientesFornecidos,
  combinarCatalogoInsumos,
  contarUsoProdutoPlanejamento,
  filtrarProdutosPlanejamento,
  listarNutrientesNaoAtendidos,
  montarLinhasProdutos,
  montarProdutosEfetivosPlanejamento,
  resolverAcaoProdutoDuplicado,
  restaurarDoseCalculadaLinha,
  sanitizarPayloadInsumo,
} from '../src/lib/planejamentoProdutosAdubacao2.js';
import { consolidarPlanejamentosPorTalhao } from '../src/lib/planejamentoAdubacao2.js';
import { consolidarComprasAdubacao2, montarGruposResumoAdubacao2 } from '../src/lib/calagemAdubacao2.js';
import { normalizarPlanosAdubacao } from '../src/lib/integracaoPlanejamentos.js';
import {
  calcularResultadoTalhaoAdubacao2,
  mesclarResultadoTalhaoAdubacao2,
  montarPayloadPlanejamentoTalhaoAdubacao2,
} from '../src/lib/calculoIndividualAdubacao2.js';

const ureia = { id: 'ureia', nome: 'Ureia', _tipo: 'fonte', n_pct: 45, p2o5_pct: 0, k2o_pct: 0, b_pct: 0 };
const kcl = { id: 'kcl', nome: 'KCl', _tipo: 'fonte', n_pct: 0, p2o5_pct: 0, k2o_pct: 60, b_pct: 0 };
const formuladoA = { id: 'npk-a', nome: '20-00-20 A', fornecedor: 'Fornecedor A', _tipo: 'formulado', n_pct: 20, p2o5_pct: 0, k2o_pct: 20, b_pct: 0 };
const formuladoB = { id: 'npk-b', nome: '12-00-12 B', fornecedor: 'Fornecedor B', _tipo: 'formulado', n_pct: 12, p2o5_pct: 0, k2o_pct: 12, b_pct: 0 };
const map = { id: 'map', nome: 'MAP', _tipo: 'fonte', n_pct: 11, p2o5_pct: 52, k2o_pct: 0, b_pct: 0 };
const acidoBorico = { id: 'boro', nome: 'Ácido bórico', _tipo: 'fonte', n_pct: 0, p2o5_pct: 0, k2o_pct: 0, b_pct: 17 };
const formulado210009 = { id: 'formulado-21-00-09', nome: 'Formulado 21-00-09', fornecedor: 'Manual', _tipo: 'formulado', n_pct: 21, p2o5_pct: 0, k2o_pct: 9, b_pct: 0 };
const formulado270010Turbo = { id: 'formulado-27-00-10-turbo', nome: 'Formulado 27-00-10 Turbo', fornecedor: 'Filtro', _tipo: 'formulado', n_pct: 27, p2o5_pct: 0, k2o_pct: 10, b_pct: 0 };
const recNK = { N: 90, P: 0, K: 120, B: 0 };
const recNPKB = { N: 90, P: 52, K: 120, B: 1.7 };
const talhao = { id: 't1', nome: 'Talhao 1', area_ha: 2, num_plantas: 1000, espacamento: '3,5x0,7' };
const talhao2 = { id: 't2', nome: 'Talhao 2', area_ha: 3, num_plantas: 1200, espacamento: '3,5x0,7' };
const analiseBase = { talhao_id: 't1', safra: '2026/2027', fosforo: 8, potassio: 50, boro: 0.3 };
const analiseBase2 = { talhao_id: 't2', safra: '2026/2027', fosforo: 14, potassio: 130, boro: 0.9 };
const fonteAdubacao2 = readFileSync(new URL('../src/pages/Adubacao2.jsx', import.meta.url), 'utf8');

test('fornecedor selecionado nao inclui fontes simples sem fornecedor por padrao', () => {
  const filtrados = filtrarProdutosPlanejamento([formuladoA, formuladoB, ureia], {
    fornecedores: ['Fornecedor A'],
    produtoId: '',
    incluirFontesSemFornecedor: false,
  });

  assert.deepEqual(filtrados.map(p => p.id), ['npk-a']);
});

test('opcao explicita inclui fontes simples sem fornecedor', () => {
  const filtrados = filtrarProdutosPlanejamento([formuladoA, formuladoB, ureia], {
    fornecedores: ['Fornecedor A'],
    produtoId: '',
    incluirFontesSemFornecedor: true,
  });

  assert.deepEqual(filtrados.map(p => p.id).sort(), ['npk-a', 'ureia']);
});

test('produto especifico e usado exclusivamente na recomendacao', () => {
  const filtrados = filtrarProdutosPlanejamento([formuladoA, ureia, kcl], { produtoId: 'kcl' });
  const linhas = montarLinhasProdutos(filtrados, recNK);

  assert.deepEqual(linhas.map(l => l.produto.id), ['kcl']);
});

test('produto especifico incapaz mostra nutrientes nao atendidos', () => {
  const linhas = montarLinhasProdutos([kcl], recNK);
  const naoAtendidos = listarNutrientesNaoAtendidos(recNK, linhas);

  assert.deepEqual(naoAtendidos, ['N']);
});

test('produto especifico sem N vira principal quando fornece nutriente recomendado', () => {
  const linhas = montarLinhasProdutos([kcl], recNK);
  const principal = linhas.find(l => l.ehPrincipal);

  assert.equal(principal.produto.id, 'kcl');
  assert.equal(principal.doseKgHa, 200);
});

test('substituir produto salvo usa filtro atual e ignora Ureia salva', () => {
  const mapa = montarProdutosEfetivosPlanejamento({
    resultados: [{
      talhao,
      rec: recNK,
      produtoSugerido: formuladoA,
      doseProdutoHa: 450,
      temRegistroSalvo: true,
      substituirSalvo: true,
    }],
    registrosSalvos: [{
      talhao_id: 't1',
      detalhamento: { produtoSugerido: { id: 'ureia', nome: 'Ureia' }, doseProdutoHa: 200 },
    }],
    todosFiltrados: [formuladoA],
    todosCatalogo: [formuladoA, ureia],
  });

  assert.equal(mapa.t1.produto.id, 'npk-a');
  assert.equal(mapa.t1.complementos.some(c => c.produto.id === 'ureia'), false);
});

test('manter produto salvo preserva produto principal salvo', () => {
  const mapa = montarProdutosEfetivosPlanejamento({
    resultados: [{ talhao, rec: recNK, produtoSugerido: ureia, doseProdutoHa: 200, temRegistroSalvo: true }],
    registrosSalvos: [{ talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'ureia', nome: 'Ureia' }, doseProdutoHa: 200 } }],
    todosFiltrados: [formuladoA, ureia],
    todosCatalogo: [formuladoA, ureia],
  });

  assert.equal(mapa.t1.produto.id, 'ureia');
});

test('produto salvo manual prevalece sobre sugestao automatica no planejamento 0-20, 20-40, compras, resumo e PDF', () => {
  const resultadoTalhao1 = {
    talhao,
    rec: recNK,
    analise: { ...analiseBase, profundidade: '0-20' },
    analise2040: { talhao_id: 't1', profundidade: '20-40', calcio: 0.3, aluminio: 0.5 },
    produtoSugerido: formulado270010Turbo,
    doseProdutoHa: 333.3,
    mediaBienal: 30,
    temRegistroSalvo: true,
  };
  const resultadoTalhao2 = {
    talhao: talhao2,
    rec: recNK,
    analise: { ...analiseBase2, profundidade: '0-20' },
    analise2040: { talhao_id: 't2', profundidade: '20-40', calcio: 0.4, aluminio: 0.4 },
    produtoSugerido: formulado270010Turbo,
    doseProdutoHa: 333.3,
    mediaBienal: 25,
    temRegistroSalvo: false,
  };
  const registrosSalvos = [{
    talhao_id: 't1',
    detalhamento: {
      produtoSugerido: { id: 'formulado-21-00-09', nome: 'Formulado 21-00-09' },
      doseProdutoHa: 428.6,
      dose_calculada_kg_ha: 428.6,
      dose_utilizada_kg_ha: 410,
      dose_ajustada_manualmente: true,
      nutriente_alvo: 'n_pct',
      precos: { 'formulado-21-00-09': 4.2, 'formulado-27-00-10-turbo': 4.8 },
      parcelamentos: { 'formulado-21-00-09': { parcelas: [{ pct: 100, meses: ['OUT'] }] } },
    },
  }];

  const mapa = montarProdutosEfetivosPlanejamento({
    resultados: [resultadoTalhao1, resultadoTalhao2],
    registrosSalvos,
    todosFiltrados: [formulado270010Turbo],
    todosCatalogo: [formulado210009, formulado270010Turbo],
  });
  const compras = consolidarComprasAdubacao2({
    resultados: [resultadoTalhao1, resultadoTalhao2],
    produtosEfetivos: mapa,
    talhoes: [talhao, talhao2],
  });
  const resumo = montarGruposResumoAdubacao2({
    resultados: [resultadoTalhao1, resultadoTalhao2],
    produtosEfetivos: mapa,
    talhoes: [talhao, talhao2],
    registrosSalvos,
  });
  const payload = montarPayloadPlanejamentoTalhaoAdubacao2({
    resultado: resultadoTalhao1,
    produtor: { codigo: 'P001' },
    safra: '2026/2027',
    produtividadeLocal: { t1: { safra1: '30', safra2: '30' } },
    analises2040Local: { t1: resultadoTalhao1.analise2040 },
    produtoEfetivo: mapa.t1,
    precos: registrosSalvos[0].detalhamento.precos,
    parcelamentos: { t1: registrosSalvos[0].detalhamento.parcelamentos },
  });
  const planosPdf = normalizarPlanosAdubacao([], [{ id: 'pl-t1', talhao_id: 't1', detalhamento: payload.detalhamento }]);

  assert.equal(mapa.t1.produto.id, 'formulado-21-00-09');
  assert.equal(mapa.t1.origemUso, 'Produto escolhido manualmente');
  assert.equal(mapa.t1.produtoSugeridoAutomatico.id, 'formulado-27-00-10-turbo');
  assert.equal(mapa.t1.doseKgHa, 410);
  assert.equal(mapa.t2.produto.id, 'formulado-27-00-10-turbo');
  assert.equal(compras.find(c => c.produto.id === 'formulado-21-00-09').qtdTotal, 820);
  assert.equal(compras.find(c => c.produto.id === 'formulado-27-00-10-turbo').qtdTotal, 1028.7);
  assert.equal(resumo.find(g => g.talhao.id === 't1').linhas[0].produtoId, 'formulado-21-00-09');
  assert.equal(resumo.find(g => g.talhao.id === 't2').linhas[0].produtoId, 'formulado-27-00-10-turbo');
  assert.equal(payload.detalhamento.produtoSugerido.id, 'formulado-21-00-09');
  assert.equal(planosPdf.find(p => p.talhao_id === 't1').produto_id, 'formulado-21-00-09');
});

test('Ureia salva e substituida quando resultado recalculado traz outro principal', () => {
  const mapa = montarProdutosEfetivosPlanejamento({
    resultados: [{ talhao, rec: recNK, produtoSugerido: formuladoB, doseProdutoHa: 750, temRegistroSalvo: true, substituirSalvo: true }],
    registrosSalvos: [{ talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'ureia', nome: 'Ureia' }, doseProdutoHa: 200 } }],
    todosFiltrados: [formuladoB],
    todosCatalogo: [formuladoB, ureia],
  });

  assert.equal(mapa.t1.produto.id, 'npk-b');
});

test('Ureia salva e substituida exclusivamente por KCl sem produto null', () => {
  const mapa = montarProdutosEfetivosPlanejamento({
    resultados: [{ talhao, rec: recNK, produtoSugerido: null, doseProdutoHa: null, temRegistroSalvo: true, substituirSalvo: true }],
    registrosSalvos: [{
      talhao_id: 't1',
      detalhamento: {
        produtoSugerido: { id: 'ureia', nome: 'Ureia' },
        doseProdutoHa: 200,
        complementos: [{ produto: { id: 'npk-b', nome: '12-00-12 B' }, doseKgHa: 50, nutKey: 'p2o5_pct' }],
      },
    }],
    todosFiltrados: [kcl],
    todosCatalogo: [kcl, ureia, formuladoB],
  });
  const naoAtendidos = listarNutrientesNaoAtendidos(recNK, [mapa.t1]);

  assert.equal(mapa.t1.produto.id, 'kcl');
  assert.equal(mapa.t1.doseKgHa, 200);
  assert.deepEqual(mapa.t1.complementos, []);
  assert.deepEqual(naoAtendidos, ['N']);
});

test('planejamentos de dois produtores nao se misturam quando filtrados por produtor', () => {
  const planejamentos = [
    { id: 'p1', codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'npk-a' } } },
    { id: 'p2', codigo_produtor: 'P002', safra: '2026/2027', talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'ureia' } } },
  ];
  const p001 = consolidarPlanejamentosPorTalhao(planejamentos.filter(p => p.codigo_produtor === 'P001' && p.safra === '2026/2027'));

  assert.equal(p001.length, 1);
  assert.equal(p001[0].detalhamento.produtoSugerido.id, 'npk-a');
});

test('troca de safra usa somente registros da safra selecionada', () => {
  const planejamentos = [
    { id: 'antiga', codigo_produtor: 'P001', safra: '2025/2026', talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'ureia' } } },
    { id: 'nova', codigo_produtor: 'P001', safra: '2026/2027', talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'npk-a' } } },
  ];
  const safraNova = consolidarPlanejamentosPorTalhao(planejamentos.filter(p => p.codigo_produtor === 'P001' && p.safra === '2026/2027'));

  assert.equal(safraNova[0].id, 'nova');
});

test('calculo individual recalcula somente um talhao', () => {
  const anteriorTalhao2 = { talhao: talhao2, rec: { N: 10 }, produtoSugerido: kcl, doseProdutoHa: 20, mediaBienal: 20 };
  const novoTalhao1 = calcularResultadoTalhaoAdubacao2({
    talhao,
    produtividadeLocal: { t1: { safra1: '30', safra2: '30' } },
    analises: [analiseBase],
    todos: [ureia, kcl],
    listaCalculo: [ureia, kcl],
  });
  const mesclado = mesclarResultadoTalhaoAdubacao2([{ talhao, rec: null }, anteriorTalhao2], novoTalhao1, [talhao, talhao2]);

  assert.equal(mesclado.length, 2);
  assert.equal(mesclado.find(r => r.talhao.id === 't1').rec.N, 230);
  assert.deepEqual(mesclado.find(r => r.talhao.id === 't2'), anteriorTalhao2);
});

test('calculo individual permite calcular talhao recem-cadastrado sem recalcular antigos', () => {
  const resultadoNovo = calcularResultadoTalhaoAdubacao2({
    talhao: talhao2,
    produtividadeLocal: { t2: { safra1: '25', safra2: '25' } },
    analises: [analiseBase2],
    todos: [ureia, kcl],
    listaCalculo: [ureia, kcl],
  });
  const antigo = { talhao, rec: { N: 90 }, produtoSugerido: ureia, doseProdutoHa: 200 };
  const mesclado = mesclarResultadoTalhaoAdubacao2([antigo], resultadoNovo, [talhao, talhao2]);

  assert.equal(mesclado.length, 2);
  assert.deepEqual(mesclado.find(r => r.talhao.id === 't1'), antigo);
  assert.equal(mesclado.find(r => r.talhao.id === 't2').rec.N, 200);
});

test('payload do calculo individual usa produtor safra e talhao_id para nao duplicar planejamento', () => {
  const resultado = calcularResultadoTalhaoAdubacao2({
    talhao,
    produtividadeLocal: { t1: { safra1: '30', safra2: '30' } },
    analises: [analiseBase],
    todos: [ureia],
    listaCalculo: [ureia],
  });
  const payload = montarPayloadPlanejamentoTalhaoAdubacao2({
    resultado,
    produtor: { codigo: 'P001' },
    safra: '2026/2027',
    produtividadeLocal: { t1: { safra1: '30', safra2: '30' } },
    produtoEfetivo: { produto: ureia, doseKgHa: 511.1, complementos: [] },
  });

  assert.equal(payload.codigo_produtor, 'P001');
  assert.equal(payload.safra, '2026/2027');
  assert.equal(payload.talhao_id, 't1');
  assert.equal(`${payload.codigo_produtor}|${payload.safra}|${payload.talhao_id}`, 'P001|2026/2027|t1');
});

test('calculo individual preserva produtos manuais ao substituir automaticos', () => {
  const resultado = calcularResultadoTalhaoAdubacao2({
    talhao,
    registrosSalvos: [{ talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'ureia', nome: 'Ureia' }, doseProdutoHa: 200 } }],
    produtividadeLocal: { t1: { safra1: '30', safra2: '30' } },
    analises: [analiseBase],
    todos: [ureia, formuladoA, map],
    listaCalculo: [formuladoA, map],
    substituirSalvos: true,
  });
  const efetivos = montarProdutosEfetivosPlanejamento({
    resultados: [resultado],
    registrosSalvos: [{ talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'ureia', nome: 'Ureia' }, doseProdutoHa: 200 } }],
    todosFiltrados: [formuladoA, map],
    todosCatalogo: [ureia, formuladoA, map],
    extrasPorTalhao: { t1: { 'manual-map': { produtoId: 'map', doseKgHa: 100, nutriente_alvo: 'p2o5_pct', nutKey: 'p2o5_pct', isManualLivre: true, usoSeparado: true } } },
  });

  assert.equal(resultado.substituirSalvo, true);
  assert.equal(efetivos.t1.produto.id, 'npk-a');
  assert.equal(efetivos.t1.complementos.some(c => c.produto.id === 'map' && c.isManualLivre), true);
});

test('calculo individual preserva precos parcelamentos e produtos ocultos', () => {
  const resultado = calcularResultadoTalhaoAdubacao2({
    talhao,
    produtividadeLocal: { t1: { safra1: '30', safra2: '30' } },
    analises: [analiseBase],
    todos: [ureia, acidoBorico],
    listaCalculo: [ureia, acidoBorico],
  });
  const efetivos = montarProdutosEfetivosPlanejamento({
    resultados: [resultado],
    todosFiltrados: [ureia, acidoBorico],
    todosCatalogo: [ureia, acidoBorico],
    produtosOcultosPorTalhao: { t1: [{ linhaId: 'b_pct:boro', produtoId: 'boro', nutriente_alvo: 'b_pct' }] },
  });
  const payload = montarPayloadPlanejamentoTalhaoAdubacao2({
    resultado,
    produtor: { codigo: 'P001' },
    safra: '2026/2027',
    produtividadeLocal: { t1: { safra1: '30', safra2: '30' } },
    produtoEfetivo: efetivos.t1,
    precos: { ureia: '6.10', boro: '12.00' },
    parcelamentos: { t1: { ureia: { parcelas: [{ pct: 100, meses: ['OUT'] }] } }, t2: { kcl: { parcelas: [{ pct: 100, meses: ['JAN'] }] } } },
  });

  assert.equal(payload.detalhamento.precos.ureia, '6.10');
  assert.equal(payload.detalhamento.parcelamentos.ureia.parcelas[0].meses[0], 'OUT');
  assert.equal(payload.detalhamento.parcelamentos.kcl, undefined);
  assert.equal(payload.detalhamento.produtos_ocultos.length, 1);
});

test('calculo individual preserva dose ajustada manualmente quando nao ha confirmacao explicita', () => {
  const resultado = calcularResultadoTalhaoAdubacao2({
    talhao,
    produtividadeLocal: { t1: { safra1: '30', safra2: '30' } },
    analises: [analiseBase],
    todos: [ureia],
    listaCalculo: [ureia],
  });
  const efetivos = montarProdutosEfetivosPlanejamento({
    resultados: [resultado],
    todosFiltrados: [ureia],
    todosCatalogo: [ureia],
    ajustesDosePorTalhao: {
      t1: {
        'n_pct:ureia': {
          linhaId: 'n_pct:ureia',
          dose_calculada_kg_ha: resultado.doseProdutoHa,
          dose_utilizada_kg_ha: 300,
          doseKgHa: 300,
          dose_ajustada_manualmente: true,
          nutriente_alvo: 'n_pct',
        },
      },
    },
  });

  assert.equal(efetivos.t1.doseKgHa, 300);
  assert.equal(efetivos.t1.dose_ajustada_manualmente, true);
});

test('calculo global continua calculando todos os talhoes', () => {
  const resultados = [talhao, talhao2].map(t => calcularResultadoTalhaoAdubacao2({
    talhao: t,
    produtividadeLocal: { t1: { safra1: '30', safra2: '30' }, t2: { safra1: '25', safra2: '25' } },
    analises: [analiseBase, analiseBase2],
    todos: [ureia, kcl],
    listaCalculo: [ureia, kcl],
  }));

  assert.equal(resultados.length, 2);
  assert.equal(resultados.every(r => r.rec), true);
  assert.deepEqual(resultados.map(r => r.talhao.id), ['t1', 't2']);
});

test('aba de analises renderiza botao de calculo individual por talhao', () => {
  assert.match(fonteAdubacao2, /Calcular talh[aã]o/);
  assert.match(fonteAdubacao2, /handleCalcularTalhao\(talhao\.id,\s*todos/);
  assert.match(fonteAdubacao2, /Calculator className="w-3\.5 h-3\.5"/);
});

test('calculo individual na tabela mostra carregamento somente na linha selecionada', () => {
  assert.match(fonteAdubacao2, /const carregandoTalhao = calculandoTalhaoId === talhao\.id/);
  assert.match(fonteAdubacao2, /Calculando\.\.\./);
  assert.match(fonteAdubacao2, /disabled=\{!podeCacularTalhao \|\| carregandoTalhao\}/);
});

test('aba de analises expoe politica de recalculo individual', () => {
  assert.match(fonteAdubacao2, /Pol[ií]tica de rec[aá]lculo/);
  assert.match(fonteAdubacao2, /Preservar os produtos escolhidos/);
  assert.match(fonteAdubacao2, /Substituir somente sugest[oõ]es autom[aá]ticas/);
  assert.match(fonteAdubacao2, /politicaRecalculoTalhao === 'substituir_automaticos'/);
});

test('AbaPlanejamento2 renderiza produto extra usando handler de remocao recebido por prop', () => {
  const fontePlanejamento = readFileSync(new URL('../src/components/adubacao2/AbaPlanejamento2.jsx', import.meta.url), 'utf8');
  const inicioTabela = fontePlanejamento.indexOf('function TabelaProdutos');
  const fimTabela = fontePlanejamento.indexOf('// ── Painel expandido de um talhão', inicioTabela);
  const tabelaProdutos = fontePlanejamento.slice(inicioTabela, fimTabela);

  assert.match(tabelaProdutos, /onRemoverExtra/);
  assert.doesNotMatch(tabelaProdutos, /handleRemoverExtra\(/);
  assert.match(tabelaProdutos, /onRemoverPlanejamento=\{\(\) => onRemoverExtra\?\.\(el\.key,\s*valorSeguro,\s*false\)\}/);
  assert.match(tabelaProdutos, /onRemoverPlanejamento=\{\(\) => onRemoverExtra\?\.\(key,\s*data,\s*true\)\}/);
  assert.match(fontePlanejamento, /const handleRemoverExtra = useCallback\(\(key,\s*data,\s*isManualLivre = false\) =>/);
  assert.match(fontePlanejamento, /onRemoverExtra=\{handleRemoverExtra\}/);
});

test('ausencia de produtos compativeis nao cria recomendacao fora do filtro', () => {
  const linhas = montarLinhasProdutos([], recNK);

  assert.deepEqual(linhas, []);
});

test('persistencia escolhe registro recente e nao duplica por talhao', () => {
  const consolidados = consolidarPlanejamentosPorTalhao([
    { id: 'antigo', talhao_id: 't1', updated_date: '2026-07-01T10:00:00Z' },
    { id: 'novo', talhao_id: 't1', updated_date: '2026-07-02T10:00:00Z' },
  ]);

  assert.equal(consolidados.length, 1);
  assert.equal(consolidados[0].id, 'novo');
});

test('Consolidacao de Compras e Resumo Geral refletem produto substituido', () => {
  const produtosEfetivos = { t1: { produto: formuladoA, doseKgHa: 450, complementos: [] } };
  const resultados = [{ talhao, rec: recNK, produtoSugerido: ureia, doseProdutoHa: 200, mediaBienal: 30 }];
  const compras = consolidarComprasAdubacao2({ resultados, produtosEfetivos, talhoes: [talhao] });
  const resumo = montarGruposResumoAdubacao2({ resultados, produtosEfetivos, talhoes: [talhao] });

  assert.equal(compras.length, 1);
  assert.equal(compras[0].produto.id, 'npk-a');
  assert.equal(compras[0].qtdTotal, 900);
  assert.equal(resumo[0].linhas[0].produtoId, 'npk-a');
});

test('Consolidacao e Resumo usam KCl quando Ureia salva foi substituida por produto especifico sem N', () => {
  const produtosEfetivos = { t1: { produto: kcl, doseKgHa: 200, complementos: [] } };
  const resultados = [{ talhao, rec: recNK, produtoSugerido: ureia, doseProdutoHa: 200, mediaBienal: 30, substituirSalvo: true }];
  const compras = consolidarComprasAdubacao2({ resultados, produtosEfetivos, talhoes: [talhao] });
  const resumo = montarGruposResumoAdubacao2({ resultados, produtosEfetivos, talhoes: [talhao] });

  assert.equal(compras.length, 1);
  assert.equal(compras[0].produto.id, 'kcl');
  assert.equal(compras[0].qtdTotal, 400);
  assert.equal(resumo[0].linhas[0].produtoId, 'kcl');
});

test('FonteSimples fica visivel no catalogo completo da Base de Insumos', () => {
  const catalogo = combinarCatalogoInsumos([formuladoA], [ureia]);
  const item = catalogo.find(p => p.nome === 'Ureia');

  assert.equal(item._tipo, 'fonte');
  assert.equal(item._origemLabel, 'Fonte simples');
});

test('contagem de uso considera produto principal e complementos', () => {
  const usos = contarUsoProdutoPlanejamento([
    { detalhamento: { produtoSugerido: { id: 'ureia' }, complementos: [] } },
    { detalhamento: { produtoSugerido: { id: 'npk-a' }, complementos: [{ produto: { id: 'ureia' } }] } },
  ], 'ureia');

  assert.equal(usos, 2);
});

test('payload de edicao pela aba Todos remove campos auxiliares e metadados internos', () => {
  const payload = sanitizarPayloadInsumo('fonte', {
    id: 'ureia',
    nome: 'Ureia',
    n_pct: 45,
    _tipo: 'fonte',
    _origemLabel: 'Fonte simples',
    created_date: '2026-01-01',
    updated_date: '2026-01-02',
    created_by: 'usuario',
    campo_interno: true,
  });

  assert.deepEqual(payload, { nome: 'Ureia', n_pct: 45 });
});

test('edicao de FonteSimples pela aba Todos preserva apenas campos validos', () => {
  const [item] = combinarCatalogoInsumos([], [{ id: 'ureia', nome: 'Ureia', nutriente_principal: 'N', n_pct: 45, _meta: 'x' }]);
  const payload = sanitizarPayloadInsumo('fonte', item);

  assert.equal(payload.nome, 'Ureia');
  assert.equal(payload.nutriente_principal, 'N');
  assert.equal(payload.n_pct, 45);
  assert.equal('_tipo' in payload, false);
  assert.equal('_origemLabel' in payload, false);
  assert.equal('id' in payload, false);
});

test('edicao de FertilizanteFormulado pela aba Todos preserva apenas campos validos', () => {
  const [item] = combinarCatalogoInsumos([{ id: 'npk-a', nome: '20-00-20 A', fornecedor: 'Fornecedor A', grupo: 'Fertilizante Solo', n_pct: 20, k2o_pct: 20, created_by: 'x' }], []);
  const payload = sanitizarPayloadInsumo('formulado', item);

  assert.equal(payload.nome, '20-00-20 A');
  assert.equal(payload.fornecedor, 'Fornecedor A');
  assert.equal(payload.grupo, 'Fertilizante Solo');
  assert.equal(payload.k2o_pct, 20);
  assert.equal('_tipo' in payload, false);
  assert.equal('_origemLabel' in payload, false);
  assert.equal('created_by' in payload, false);
});

test('doses calculadas sao finitas, positivas e sem NaN', () => {
  const linhas = montarLinhasProdutos([formuladoA], recNK);

  assert.ok(linhas.length > 0);
  linhas.forEach(linha => {
    assert.equal(Number.isFinite(linha.doseKgHa), true);
    assert.equal(linha.doseKgHa > 0, true);
  });
});

test('editar dose principal guarda dose calculada e dose utilizada', () => {
  const [linha] = montarLinhasProdutos([ureia], recNPKB);
  const ajuste = ajustarDoseLinha(linha, 250);
  const mapa = montarProdutosEfetivosPlanejamento({
    resultados: [{ talhao, rec: recNPKB }],
    todosFiltrados: [ureia],
    todosCatalogo: [ureia],
    ajustesDosePorTalhao: { t1: { [linha.linhaId]: ajuste } },
  });

  assert.equal(linha.dose_calculada_kg_ha, 200);
  assert.equal(mapa.t1.dose_calculada_kg_ha, 200);
  assert.equal(mapa.t1.dose_utilizada_kg_ha, 250);
  assert.equal(mapa.t1.dose_ajustada_manualmente, true);
});

test('editar dose complementar recalcula nutrientes fornecidos', () => {
  const linhas = montarLinhasProdutos([ureia, kcl], recNK);
  const comp = linhas.find(l => l.produto.id === 'kcl');
  const ajuste = ajustarDoseLinha(comp, 250);
  const mapa = montarProdutosEfetivosPlanejamento({
    resultados: [{ talhao, rec: recNK }],
    todosFiltrados: [ureia, kcl],
    todosCatalogo: [ureia, kcl],
    ajustesDosePorTalhao: { t1: { [comp.linhaId]: ajuste } },
  });
  const compEfetivo = mapa.t1.complementos.find(c => c.produto.id === 'kcl');

  assert.equal(comp.dose_calculada_kg_ha, 200);
  assert.equal(compEfetivo.dose_utilizada_kg_ha, 250);
  assert.equal(Math.round(compEfetivo.nutrientes.find(n => n.label === 'K2O').fornecido), 150);
});

test('restaurar dose calculada volta ao valor automatico mais recente', () => {
  const [linha] = montarLinhasProdutos([ureia], recNPKB);
  const restaurado = restaurarDoseCalculadaLinha({ ...linha, dose_utilizada_kg_ha: 260, dose_ajustada_manualmente: true });

  assert.equal(restaurado.dose_utilizada_kg_ha, 200);
  assert.equal(restaurado.dose_ajustada_manualmente, false);
});

test('adicionar e excluir produto manual altera somente a linha manual', () => {
  const extras = {
    'manual-1': { produtoId: 'map', doseKgHa: 100, nutriente_alvo: 'p2o5_pct', nutKey: 'p2o5_pct', isManualLivre: true, usoSeparado: true },
  };
  const mapaComManual = montarProdutosEfetivosPlanejamento({
    resultados: [{ talhao, rec: recNK }],
    todosFiltrados: [ureia],
    todosCatalogo: [ureia, map],
    extrasPorTalhao: { t1: extras },
  });
  const mapaSemManual = montarProdutosEfetivosPlanejamento({
    resultados: [{ talhao, rec: recNK }],
    todosFiltrados: [ureia],
    todosCatalogo: [ureia, map],
    extrasPorTalhao: { t1: {} },
  });

  assert.equal(mapaComManual.t1.complementos.some(c => c.produto.id === 'map'), true);
  assert.equal(mapaSemManual.t1.produto.id, 'ureia');
  assert.equal(mapaSemManual.t1.complementos.some(c => c.produto.id === 'map'), false);
});

test('selecionar nutriente-alvo calcula MAP por P2O5 e contabiliza N secundario', () => {
  const doseMap = calcularDoseProdutoPorAlvo(map, 'p2o5_pct', recNPKB);
  const fornecido = calcularNutrientesFornecidos(map, doseMap);

  assert.equal(doseMap, 100);
  assert.equal(Math.round(fornecido.P), 52);
  assert.equal(Math.round(fornecido.N), 11);
});

test('Ureia usa nitrogenio como alvo e MAP usa P2O5 como alvo', () => {
  const doseUreia = calcularDoseProdutoPorAlvo(ureia, 'n_pct', recNPKB);
  const doseMap = calcularDoseProdutoPorAlvo(map, 'p2o5_pct', recNPKB);

  assert.equal(doseUreia, 200);
  assert.equal(doseMap, 100);
});

test('custos sao recalculados com dose utilizada ajustada', () => {
  const produtosEfetivos = {
    t1: { produto: ureia, doseKgHa: 250, dose_utilizada_kg_ha: 250, complementos: [] },
  };
  const planos = normalizarPlanosAdubacao([], [{
    id: 'pl1',
    talhao_id: 't1',
    detalhamento: {
      produtoSugerido: { id: 'ureia', nome: 'Ureia' },
      doseProdutoHa: 250,
      dose_calculada_kg_ha: 200,
      dose_utilizada_kg_ha: 250,
      dose_ajustada_manualmente: true,
      precos: { ureia: 4 },
      parcelamentos: {},
    },
  }]);
  const compras = consolidarComprasAdubacao2({
    resultados: [{ talhao, rec: recNPKB, produtoSugerido: ureia, doseProdutoHa: 200 }],
    produtosEfetivos,
    talhoes: [talhao],
  });

  assert.equal(planos.find(p => p.produto_id === 'ureia').custo_rha, 1000);
  assert.equal(compras[0].qtdTotal, 500);
});

test('parcelamento e persistencia preservam dose manual ao reabrir', () => {
  const registro = {
    talhao_id: 't1',
    detalhamento: {
      produtoSugerido: { id: 'ureia', nome: 'Ureia' },
      doseProdutoHa: 250,
      dose_calculada_kg_ha: 200,
      dose_utilizada_kg_ha: 250,
      dose_ajustada_manualmente: true,
      nutriente_alvo: 'n_pct',
      parcelamentos: { ureia: { parcelas: [{ pct: 100, meses: ['OUT'] }] } },
    },
  };
  const mapa = montarProdutosEfetivosPlanejamento({
    resultados: [{ talhao, rec: recNPKB, produtoSugerido: { ...ureia, dose_calculada_kg_ha: 200, dose_utilizada_kg_ha: 250, dose_ajustada_manualmente: true }, doseProdutoHa: 250, temRegistroSalvo: true }],
    registrosSalvos: [registro],
    todosFiltrados: [ureia],
    todosCatalogo: [ureia],
    ajustesDosePorTalhao: { t1: { 'n_pct:ureia': { dose_calculada_kg_ha: 200, dose_utilizada_kg_ha: 250, dose_ajustada_manualmente: true } } },
  });

  assert.equal(mapa.t1.dose_utilizada_kg_ha, 250);
  assert.equal(registro.detalhamento.parcelamentos.ureia.parcelas[0].meses[0], 'OUT');
});

test('recalculo preserva produtos manuais e substitui somente sugestoes automaticas', () => {
  const extras = {
    'manual-map': { produtoId: 'map', doseKgHa: 100, nutriente_alvo: 'p2o5_pct', nutKey: 'p2o5_pct', isManualLivre: true, usoSeparado: true },
  };
  const mapaEfetivo = montarProdutosEfetivosPlanejamento({
    resultados: [{ talhao, rec: recNPKB, produtoSugerido: null, doseProdutoHa: null, substituirSalvo: true }],
    registrosSalvos: [{ talhao_id: 't1', detalhamento: { produtoSugerido: { id: 'ureia', nome: 'Ureia' } } }],
    todosFiltrados: [formuladoA],
    todosCatalogo: [formuladoA, map],
    extrasPorTalhao: { t1: extras },
  });

  assert.equal(mapaEfetivo.t1.produto.id, 'npk-a');
  assert.equal(mapaEfetivo.t1.complementos.some(c => c.produto.id === 'map' && c.isManualLivre), true);
});

test('consolidacao de compras e resumo usam dose ajustada e produto manual', () => {
  const produtosEfetivos = {
    t1: {
      produto: ureia,
      doseKgHa: 250,
      dose_utilizada_kg_ha: 250,
      complementos: [{ produto: { id: 'map', nome: 'MAP' }, doseKgHa: 100, dose_utilizada_kg_ha: 100, isManualExtra: true, nutriente_alvo: 'p2o5_pct' }],
    },
  };
  const resultados = [{ talhao, rec: recNPKB, produtoSugerido: ureia, doseProdutoHa: 200, mediaBienal: 30 }];
  const compras = consolidarComprasAdubacao2({ resultados, produtosEfetivos, talhoes: [talhao] });
  const resumo = montarGruposResumoAdubacao2({ resultados, produtosEfetivos, talhoes: [talhao] });

  assert.equal(compras.find(c => c.produto.id === 'ureia').qtdTotal, 500);
  assert.equal(compras.find(c => c.produto.id === 'map').qtdTotal, 200);
  assert.equal(resumo[0].linhas.find(l => l.produtoId === 'ureia').doseKgHa, 250);
  assert.equal(resumo[0].linhas.find(l => l.produtoId === 'map').doseKgHa, 100);
});

test('PDF e integracoes usam dose ajustada normalizada da Adubacao 2.0', () => {
  const planos = normalizarPlanosAdubacao([], [{
    id: 'pl1',
    talhao_id: 't1',
    detalhamento: {
      produtoSugerido: { id: 'ureia', nome: 'Ureia' },
      doseProdutoHa: 250,
      dose_calculada_kg_ha: 200,
      dose_utilizada_kg_ha: 250,
      dose_ajustada_manualmente: true,
      precos: { ureia: 4 },
      parcelamentos: { ureia: { parcelas: [{ pct: 100, meses: ['OUT'] }] } },
    },
  }]);
  const plano = planos.find(p => p.produto_id === 'ureia');

  assert.equal(plano.dose_rec_manual, 250);
  assert.equal(plano.custo_rha, 1000);
  assert.deepEqual(plano.meses, [['OUT']]);
});

test('balanco mostra atendido, faltante, excesso e adicao manual sem necessidade', () => {
  const balanco = calcularBalancoNutrientes({ N: 90, P: 52 }, [
    { produto: ureia, doseKgHa: 100 },
    { produto: map, doseKgHa: 150 },
    { produto: acidoBorico, doseKgHa: 10 },
  ]);

  assert.equal(balanco.find(b => b.nutriente === 'N').situacao, 'Faltante');
  assert.equal(balanco.find(b => b.nutriente === 'P').situacao, 'Acima da recomendação');
  assert.equal(balanco.find(b => b.nutriente === 'B').situacao, 'Adição manual sem necessidade calculada');
});

test('prevencao de duplicacao silenciosa oferece editar linha existente ou uso separado', () => {
  const linhas = montarLinhasProdutos([ureia], recNPKB);
  const acao = resolverAcaoProdutoDuplicado({ produtoId: 'ureia', linhas, manuais: {} });
  const separado = montarProdutosEfetivosPlanejamento({
    resultados: [{ talhao, rec: recNPKB }],
    todosFiltrados: [ureia],
    todosCatalogo: [ureia],
    extrasPorTalhao: { t1: { 'manual-ureia': { produtoId: 'ureia', doseKgHa: 20, isManualLivre: true, usoSeparado: true } } },
  });

  assert.equal(acao.duplicado, true);
  assert.deepEqual(acao.opcoes, ['editar linha existente', 'adicionar uso separado']);
  assert.equal(separado.t1.complementos.some(c => c.produto.id === 'ureia' && c.usoSeparado), true);
});
