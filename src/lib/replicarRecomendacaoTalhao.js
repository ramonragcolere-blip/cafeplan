import {
  calcularCustoCalagem,
  calcularDistribuicaoCalagem,
  normalizarNumeroCalagem,
  selecionarRegistroCalagem,
} from './calagemAdubacao2.js';
import {
  calcularCustoGessagem,
  calcularFornecimentoGesso,
  calcularRecomendacaoGessagem,
  normalizarNumeroGessagem,
  selecionarRegistroGessagem,
} from './gessagemAdubacao2.js';
import {
  normalizarComplementosAdubacao2,
  normalizarProdutoAdubacao2,
  objetoSeguroAdubacao2,
  produtoNuloAdubacao2,
} from './planejamentoProdutosAdubacao2.js';

export const MODULOS_REPLICACAO_RECOMENDACAO = ['planejamento', 'calagem', 'gessagem'];
export const POLITICAS_CONFLITO_REPLICACAO = ['ignorar_existentes', 'substituir', 'adicionar_ausentes'];

const CAMPOS_CONTROLE = new Set([
  'id',
  'created_date',
  'updated_date',
  'createdAt',
  'updatedAt',
  'created_by',
  'updated_by',
]);

function clonar(valor) {
  return valor == null ? valor : JSON.parse(JSON.stringify(valor));
}

function numero(valor) {
  if (valor == null || valor === '') return null;
  const n = Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function semAcento(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function copiarSemId(registro = {}) {
  const payload = {};
  Object.entries(registro || {}).forEach(([campo, valor]) => {
    if (CAMPOS_CONTROLE.has(campo)) return;
    payload[campo] = clonar(valor);
  });
  return payload;
}

function porTalhao(registros = [], talhaoId) {
  return (registros || []).filter(registro => registro?.talhao_id === talhaoId);
}

function selecionarPlanejamento(registros = []) {
  return [...(registros || [])]
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.updated_date || b.created_date || 0) - Date.parse(a.updated_date || a.created_date || 0))[0] || null;
}

function registroExiste(registro, modulo) {
  if (!registro) return false;
  if (modulo === 'planejamento') {
    const det = objetoSeguroAdubacao2(registro.detalhamento);
    return Boolean(det.rec || det.produtoSugerido || det.doseProdutoHa != null || normalizarComplementosAdubacao2(det.complementos).length > 0);
  }
  if (modulo === 'calagem') return normalizarNumeroCalagem(registro.dose_kg_ha) != null || !produtoNuloAdubacao2({ id: registro.produto_id, nome: registro.produto_nome });
  if (modulo === 'gessagem') return normalizarNumeroGessagem(registro.dose_final_kg_ha) != null || !produtoNuloAdubacao2({ id: registro.produto_id, nome: registro.produto_nome });
  return Boolean(registro);
}

export function criarMetadadosReplicacao({
  talhaoOrigem,
  modulos = MODULOS_REPLICACAO_RECOMENDACAO,
  politicaConflito = 'ignorar_existentes',
  usuario = null,
  agora = null,
} = {}) {
  const data = agora || new Date().toISOString();
  return {
    talhao_origem_id: talhaoOrigem?.id || null,
    talhao_origem_nome: talhaoOrigem?.nome || '',
    replicado_em: data,
    usuario: usuario?.email || usuario?.full_name || usuario?.id || null,
    modulos: [...modulos],
    politica_conflito: politicaConflito,
    mensagem: `Recomendação replicada do talhão '${talhaoOrigem?.nome || ''}' em ${formatarDataReplicacao(data)}.`,
  };
}

export function formatarDataReplicacao(data) {
  const d = data ? new Date(data) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

function aplicarContextoTalhao(payload, { produtor, safra, talhaoDestino }) {
  return {
    ...payload,
    codigo_produtor: produtor?.codigo || payload.codigo_produtor,
    safra,
    talhao_id: talhaoDestino?.id,
    talhao_nome: talhaoDestino?.nome,
  };
}

function prepararPlanejamento({ origem, existenteDestino, talhaoDestino, produtor, safra, metadados, politicaConflito }) {
  const payload = aplicarContextoTalhao(copiarSemId(origem), { produtor, safra, talhaoDestino });
  const detOrigem = objetoSeguroAdubacao2(origem?.detalhamento);
  payload.detalhamento = {
    ...clonar(detOrigem),
    rastreabilidade_replicacao: metadados,
  };
  payload.rastreabilidade_replicacao = metadados;
  payload.analise2040 = existenteDestino?.analise2040 || null;

  if (politicaConflito === 'adicionar_ausentes' && existenteDestino) {
    return adicionarProdutosAusentesPlanejamento({ origem: payload, destino: existenteDestino, metadados });
  }
  if (existenteDestino?.id) payload.id = existenteDestino.id;
  return payload;
}

function chaveComposicao(produto = {}) {
  return [
    produto.n_pct, produto.p2o5_pct, produto.k2o_pct, produto.ca_pct, produto.mg_pct,
    produto.s_pct, produto.b_pct, produto.zn_pct, produto.cu_pct, produto.mn_pct, produto.fe_pct,
    produto.composicao_texto,
  ].map(valor => String(valor ?? '')).join('|');
}

export function chaveProdutoReplicacao(produto = {}) {
  const normalizado = normalizarProdutoAdubacao2(produto) || produto || {};
  if (normalizado?.id) return `id:${normalizado.id}`;
  return chaveProdutoReplicacaoSemId(normalizado);
}

function chaveProdutoReplicacaoSemId(produto = {}) {
  const normalizado = normalizarProdutoAdubacao2(produto) || produto || {};
  return `nome:${semAcento(normalizado.nome)}|marca:${semAcento(normalizado.marca || normalizado.fornecedor)}|comp:${semAcento(chaveComposicao(normalizado))}`;
}

export function produtoEquivalenteReplicacao(a, b) {
  if (produtoNuloAdubacao2(a) || produtoNuloAdubacao2(b)) return false;
  const pa = normalizarProdutoAdubacao2(a) || a || {};
  const pb = normalizarProdutoAdubacao2(b) || b || {};
  if (pa.id && pb.id) return pa.id === pb.id;
  if (semAcento(pa.nome) && semAcento(pa.nome) === semAcento(pb.nome)) return true;
  return chaveProdutoReplicacaoSemId(pa) === chaveProdutoReplicacaoSemId(pb);
}

function listarProdutosPlanejamento(detalhamento = {}) {
  const produtos = [];
  if (!produtoNuloAdubacao2(detalhamento.produtoSugerido)) {
    produtos.push({
      tipo: 'principal',
      produto: detalhamento.produtoSugerido,
      doseKgHa: detalhamento.dose_utilizada_kg_ha ?? detalhamento.doseProdutoHa,
      item: null,
    });
  }
  normalizarComplementosAdubacao2(detalhamento.complementos).forEach(item => {
    if (!produtoNuloAdubacao2(item.produto)) {
      produtos.push({
        tipo: 'complemento',
        produto: item.produto,
        doseKgHa: item.dose_utilizada_kg_ha ?? item.doseKgHa,
        item,
      });
    }
  });
  return produtos;
}

function adicionarProdutosAusentesPlanejamento({ origem, destino, metadados }) {
  const detDestino = objetoSeguroAdubacao2(destino.detalhamento);
  const detOrigem = objetoSeguroAdubacao2(origem.detalhamento);
  const produtosExistentes = listarProdutosPlanejamento(detDestino).map(item => item.produto);
  const complementos = normalizarComplementosAdubacao2(detDestino.complementos);

  listarProdutosPlanejamento(detOrigem).forEach(item => {
    if (produtosExistentes.some(produto => produtoEquivalenteReplicacao(produto, item.produto))) return;
    produtosExistentes.push(item.produto);
    complementos.push({
      ...(item.item || {}),
      produto: normalizarProdutoAdubacao2(item.produto),
      doseKgHa: item.doseKgHa,
      dose_utilizada_kg_ha: item.doseKgHa,
      dose_calculada_kg_ha: item.item?.dose_calculada_kg_ha ?? item.doseKgHa,
      dose_ajustada_manualmente: item.item?.dose_ajustada_manualmente ?? true,
      nutriente_alvo: item.item?.nutriente_alvo || item.item?.nutKey || 'dose_manual',
      nutKey: item.item?.nutKey || item.item?.nutriente_alvo || 'dose_manual',
      origemUso: item.item?.origemUso || 'Produto replicado',
      isManualExtra: item.tipo === 'principal' ? true : item.item?.isManualExtra,
    });
  });

  return {
    ...copiarSemId(destino),
    id: destino.id,
    detalhamento: {
      ...detDestino,
      complementos,
      precos: { ...objetoSeguroAdubacao2(detOrigem.precos), ...objetoSeguroAdubacao2(detDestino.precos) },
      parcelamentos: { ...objetoSeguroAdubacao2(detOrigem.parcelamentos), ...objetoSeguroAdubacao2(detDestino.parcelamentos) },
      rastreabilidade_replicacao: metadados,
    },
    rastreabilidade_replicacao: metadados,
  };
}

function prepararCalagem({ origem, existenteDestino, talhaoDestino, produtor, safra, metadados }) {
  const doseKgHa = normalizarNumeroCalagem(origem?.dose_kg_ha ?? origem?.doseFinalHa ?? origem?.dose_final_kg_ha);
  const distribuicao = calcularDistribuicaoCalagem({ doseKgHa, talhao: talhaoDestino });
  const custo = calcularCustoCalagem({
    doseKgHa,
    doseTotalKg: distribuicao.totalKg,
    precoUnitario: origem?.preco_unitario,
    unidadePreco: origem?.unidade_preco,
    talhao: talhaoDestino,
  });
  const payload = aplicarContextoTalhao(copiarSemId(origem), { produtor, safra, talhaoDestino });
  if (existenteDestino?.id) payload.id = existenteDestino.id;
  payload.dose_kg_ha = doseKgHa;
  payload.dose_total_kg = distribuicao.totalKg;
  payload.preco_unitario = custo.precoUnitario;
  payload.unidade_preco = custo.unidadePreco;
  payload.custo_ha = custo.custoHa;
  payload.custo_total = custo.custoTotal;
  payload.rastreabilidade_replicacao = metadados;
  return payload;
}

function produtoGessagem(registro = {}) {
  return {
    id: registro.produto_id || '',
    nome: registro.produto_nome || '',
    ca_pct: registro.ca_gesso_pct ?? registro.ca_pct,
    s_pct: registro.s_gesso_pct ?? registro.s_pct ?? registro.enxofre_pct,
  };
}

function prepararGessagem({ origem, existenteDestino, talhaoDestino, produtor, safra, metadados, analise2040Destino }) {
  const doseKgHa = normalizarNumeroGessagem(origem?.dose_final_kg_ha ?? origem?.dose_sugerida_kg_ha);
  const produto = produtoGessagem(origem);
  const recomendacaoDestino = calcularRecomendacaoGessagem({
    talhao: talhaoDestino,
    analise2040: analise2040Destino || null,
    argilaManual: analise2040Destino?.argila_pct,
    doseCalcarioKgHa: origem?.dose_calcario_kg_ha,
    caoCalcarioPct: origem?.cao_calcario_pct,
    caoGessoPct: origem?.cao_gesso_pct,
  });
  const custo = calcularCustoGessagem({
    doseKgHa,
    areaHa: talhaoDestino?.area_ha,
    precoUnitario: origem?.preco_unitario,
    unidadePreco: origem?.unidade_preco,
  });
  const fornecimento = calcularFornecimentoGesso({ produto, doseKgHa });
  const payload = aplicarContextoTalhao(copiarSemId(origem), { produtor, safra, talhaoDestino });
  if (existenteDestino?.id) payload.id = existenteDestino.id;
  payload.ca_2040 = recomendacaoDestino.ca2040;
  payload.al_2040 = recomendacaoDestino.al2040;
  payload.saturacao_aluminio = recomendacaoDestino.mPercentual;
  payload.magnesio_2040 = recomendacaoDestino.mg2040;
  payload.potassio_2040 = recomendacaoDestino.k2040;
  payload.argila_pct = recomendacaoDestino.argilaPct;
  payload.indicada = recomendacaoDestino.indicada;
  payload.motivos = recomendacaoDestino.motivos;
  payload.faixa_5a_min_t_ha = recomendacaoDestino.faixa5a?.minT ?? null;
  payload.faixa_5a_max_t_ha = recomendacaoDestino.faixa5a?.maxT ?? null;
  payload.dose_sugerida_kg_ha = recomendacaoDestino.doseSugeridaKgHa;
  payload.dose_final_kg_ha = doseKgHa;
  payload.quantidade_total_kg = custo.quantidadeTotalKg;
  payload.preco_unitario = custo.precoUnitario;
  payload.unidade_preco = custo.unidadePreco;
  payload.custo_ha = custo.custoHa;
  payload.custo_total = custo.custoTotal;
  payload.ca_fornecido_kg_ha = fornecimento.caKgHa;
  payload.s_fornecido_kg_ha = fornecimento.sKgHa;
  payload.rastreabilidade_replicacao = metadados;
  return payload;
}

export function detectarAlertasGessagemDestino({ origem, destinoAnalise2040, talhaoDestino }) {
  const dose = normalizarNumeroGessagem(origem?.dose_final_kg_ha ?? origem?.dose_sugerida_kg_ha) || 0;
  const destino = calcularRecomendacaoGessagem({
    talhao: talhaoDestino,
    analise2040: destinoAnalise2040 || null,
    argilaManual: destinoAnalise2040?.argila_pct,
    doseCalcarioKgHa: origem?.dose_calcario_kg_ha,
    caoCalcarioPct: origem?.cao_calcario_pct,
    caoGessoPct: origem?.cao_gesso_pct,
  });
  return {
    diagnosticoDiferente: Boolean(origem && origem.indicada !== destino.indicada),
    exigeConfirmacaoSemIndicacao: dose > 0 && !destino.indicada,
    mensagemDiagnostico: 'A recomendação de gessagem será replicada, mas o diagnóstico deste talhão é diferente do talhão de origem.',
  };
}

function registrarResultadoModulo(resultado, modulo, payload, existenteDestino) {
  const chaves = {
    planejamento: { criado: 'planejamentosCriados', atualizado: 'planejamentosAtualizados' },
    calagem: { criado: 'calagensCriadas', atualizado: 'calagensAtualizadas' },
    gessagem: { criado: 'gessagensCriadas', atualizado: 'gessagensAtualizadas' },
  };
  const chave = existenteDestino?.id ? chaves[modulo]?.atualizado : chaves[modulo]?.criado;
  resultado[chave].push(payload);
}

function registrarIgnorado(resultado, talhao, modulo, motivo) {
  resultado.ignorados.push({ talhao_id: talhao?.id, talhao_nome: talhao?.nome, modulo, motivo });
}

function validarDestino({ produtor, safra, talhaoOrigem, talhaoDestino }) {
  if (!talhaoDestino?.id) return 'Talhão de destino inválido.';
  if (talhaoDestino.id === talhaoOrigem?.id) return 'O talhão de origem não pode ser destino.';
  if (talhaoDestino.codigo_produtor && produtor?.codigo && talhaoDestino.codigo_produtor !== produtor.codigo) return 'Talhão de destino pertence a outro produtor.';
  if (talhaoDestino.safra && talhaoDestino.safra !== safra) return 'Talhão de destino pertence a outra safra.';
  return null;
}

export function aplicarReplicacaoRecomendacaoTalhoes({
  produtor,
  safra,
  talhaoOrigem,
  talhoesDestino = [],
  planejamentos = [],
  calagens = [],
  gessagens = [],
  analises2040PorTalhao = {},
  modulos = MODULOS_REPLICACAO_RECOMENDACAO,
  politicaConflito = 'ignorar_existentes',
  usuario = null,
  agora = null,
} = {}) {
  const modulosSelecionados = modulos.filter(modulo => MODULOS_REPLICACAO_RECOMENDACAO.includes(modulo));
  const resultado = {
    planejamentosCriados: [],
    planejamentosAtualizados: [],
    calagensCriadas: [],
    calagensAtualizadas: [],
    gessagensCriadas: [],
    gessagensAtualizadas: [],
    ignorados: [],
    erros: [],
    atualizados: 0,
  };
  const origemPlanejamento = selecionarPlanejamento(porTalhao(planejamentos, talhaoOrigem?.id).filter(r => r.codigo_produtor === produtor?.codigo && r.safra === safra));
  const origemCalagem = selecionarRegistroCalagem(porTalhao(calagens, talhaoOrigem?.id).filter(r => r.codigo_produtor === produtor?.codigo && r.safra === safra));
  const origemGessagem = selecionarRegistroGessagem(porTalhao(gessagens, talhaoOrigem?.id).filter(r => r.codigo_produtor === produtor?.codigo && r.safra === safra));
  const metadados = criarMetadadosReplicacao({ talhaoOrigem, modulos: modulosSelecionados, politicaConflito, usuario, agora });

  for (const talhaoDestino of talhoesDestino || []) {
    const erroDestino = validarDestino({ produtor, safra, talhaoOrigem, talhaoDestino });
    if (erroDestino) {
      resultado.erros.push({ talhao_id: talhaoDestino?.id, talhao_nome: talhaoDestino?.nome, erro: erroDestino });
      continue;
    }
    let mudouTalhao = false;

    for (const modulo of modulosSelecionados) {
      const origem = modulo === 'planejamento' ? origemPlanejamento : modulo === 'calagem' ? origemCalagem : origemGessagem;
      if (!registroExiste(origem, modulo)) {
        registrarIgnorado(resultado, talhaoDestino, modulo, 'Não há recomendação disponível para replicar.');
        continue;
      }
      const registros = modulo === 'planejamento' ? planejamentos : modulo === 'calagem' ? calagens : gessagens;
      const existenteDestino = modulo === 'planejamento'
        ? selecionarPlanejamento(porTalhao(registros, talhaoDestino.id).filter(r => r.codigo_produtor === produtor?.codigo && r.safra === safra))
        : modulo === 'calagem'
          ? selecionarRegistroCalagem(porTalhao(registros, talhaoDestino.id).filter(r => r.codigo_produtor === produtor?.codigo && r.safra === safra))
          : selecionarRegistroGessagem(porTalhao(registros, talhaoDestino.id).filter(r => r.codigo_produtor === produtor?.codigo && r.safra === safra));

      if (registroExiste(existenteDestino, modulo) && politicaConflito === 'ignorar_existentes') {
        registrarIgnorado(resultado, talhaoDestino, modulo, 'Destino já possui recomendação.');
        continue;
      }
      if ((modulo === 'calagem' || modulo === 'gessagem') && politicaConflito === 'adicionar_ausentes' && registroExiste(existenteDestino, modulo)) {
        registrarIgnorado(resultado, talhaoDestino, modulo, 'Adicionar produtos ausentes não se aplica a Calagem ou Gessagem.');
        continue;
      }

      const payload = modulo === 'planejamento'
        ? prepararPlanejamento({ origem, existenteDestino, talhaoDestino, produtor, safra, metadados, politicaConflito })
        : modulo === 'calagem'
          ? prepararCalagem({ origem, existenteDestino, talhaoDestino, produtor, safra, metadados })
          : prepararGessagem({ origem, existenteDestino, talhaoDestino, produtor, safra, metadados, analise2040Destino: analises2040PorTalhao[talhaoDestino.id] });
      registrarResultadoModulo(resultado, modulo, payload, existenteDestino);
      mudouTalhao = true;
    }

    if (mudouTalhao) resultado.atualizados += 1;
  }

  return resultado;
}

export function calcularResumoReplicacaoRecomendacao({ talhaoOrigem, planejamento, calagem, gessagem } = {}) {
  const area = numero(talhaoOrigem?.area_ha) || 0;
  const det = objetoSeguroAdubacao2(planejamento?.detalhamento);
  const produtos = listarProdutosPlanejamento(det);
  const custoHa = produtos.reduce((soma, item) => {
    const id = item.produto?.id;
    const preco = id ? numero(det.precos?.[id]) : null;
    const dose = numero(item.doseKgHa) || 0;
    return soma + (preco != null ? preco * dose : 0);
  }, 0);
  return {
    planejamento: planejamento ? {
      quantidadeProdutos: produtos.length,
      dosesKgHa: produtos.map(item => numero(item.doseKgHa)).filter(valor => valor != null),
      parcelamentos: Object.keys(objetoSeguroAdubacao2(det.parcelamentos)).length,
      custoHa: custoHa || null,
      custoTotalOrigem: custoHa && area > 0 ? custoHa * area : null,
    } : null,
    calagem: calagem ? {
      produto: calagem.produto_nome || '',
      metodo: calagem.metodo_calculo || calagem.meta || '',
      doseKgHa: normalizarNumeroCalagem(calagem.dose_kg_ha),
      custoHa: calcularCustoCalagem({
        doseKgHa: calagem.dose_kg_ha,
        doseTotalKg: calagem.dose_total_kg,
        precoUnitario: calagem.preco_unitario,
        unidadePreco: calagem.unidade_preco,
        talhao: talhaoOrigem,
      }).custoHa,
    } : null,
    gessagem: gessagem ? {
      produto: gessagem.produto_nome || '',
      metodo: gessagem.metodo_calculo || '',
      doseKgHa: normalizarNumeroGessagem(gessagem.dose_final_kg_ha),
      custoHa: calcularCustoGessagem({
        doseKgHa: gessagem.dose_final_kg_ha,
        areaHa: talhaoOrigem?.area_ha,
        precoUnitario: gessagem.preco_unitario,
        unidadePreco: gessagem.unidade_preco,
      }).custoHa,
    } : null,
  };
}
