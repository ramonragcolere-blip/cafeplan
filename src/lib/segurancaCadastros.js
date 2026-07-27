import { proximoCodigoProdutor } from './integracaoPlanejamentos.js';

export const MENSAGEM_INATIVAR =
  'Este cadastro possui registros vinculados e não pode ser excluído. Utilize a opção Inativar para preservar o histórico.';

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function normalizarCodigo(valor) {
  return normalizarTexto(valor).toUpperCase();
}

function normalizarNome(valor) {
  return normalizarTexto(valor).toLowerCase();
}

function contar(lista) {
  return Array.isArray(lista) ? lista.length : 0;
}

function tiposComVinculo(vinculos = {}) {
  return Object.entries(vinculos)
    .filter(([, total]) => Number(total) > 0)
    .map(([tipo]) => tipo);
}

export function mensagemCadastroComVinculos(tipos = []) {
  const lista = tipos.length ? ` Registros vinculados: ${tipos.join(', ')}.` : '';
  return `${MENSAGEM_INATIVAR}${lista}`;
}

export function validarCodigoProdutor({ produtores = [], produtorAtual = null, codigo }) {
  const codigoNormalizado = normalizarCodigo(codigo);
  if (!codigoNormalizado) {
    return { ok: false, mensagem: 'O código do produtor é obrigatório.' };
  }
  if (produtorAtual && normalizarCodigo(produtorAtual.codigo) !== codigoNormalizado) {
    return { ok: false, mensagem: 'O código do produtor não pode ser alterado após o cadastro.' };
  }
  const duplicado = produtores.some(produtor =>
    produtor?.id !== produtorAtual?.id && normalizarCodigo(produtor?.codigo) === codigoNormalizado
  );
  if (duplicado) {
    return { ok: false, mensagem: `O código ${codigoNormalizado} já está em uso por outro produtor.` };
  }
  return { ok: true, codigo: codigoNormalizado };
}

export function calcularProximoCodigoProdutorSeguro(produtores = []) {
  return proximoCodigoProdutor(produtores);
}

export function avaliarExclusaoProdutor(vinculos = {}) {
  const tipos = tiposComVinculo(vinculos);
  return {
    podeExcluir: tipos.length === 0,
    tipos,
    mensagem: tipos.length ? mensagemCadastroComVinculos(tipos) : '',
  };
}

export function avaliarAlteracaoTalhao({ talhaoAtual, dadosNovos, possuiHistorico }) {
  if (!talhaoAtual || !possuiHistorico) return { ok: true };
  const trocaCodigo = normalizarCodigo(talhaoAtual.codigo_produtor) !== normalizarCodigo(dadosNovos.codigo_produtor);
  const trocaProdutorId = normalizarTexto(talhaoAtual.produtor_id) !== normalizarTexto(dadosNovos.produtor_id);
  if (trocaCodigo || trocaProdutorId) {
    return {
      ok: false,
      mensagem: 'Este talhão possui histórico vinculado. Não altere o produtor ou o código interno de vínculo; utilize Inativar para preservar o histórico.',
    };
  }
  return { ok: true };
}

export function avaliarExclusaoTalhao(vinculos = {}) {
  const tipos = tiposComVinculo(vinculos);
  return {
    podeExcluir: tipos.length === 0,
    tipos,
    mensagem: tipos.length ? mensagemCadastroComVinculos(tipos) : '',
  };
}

export function removerDesenhoTalhaoPayload(talhao = {}) {
  return {
    geojson_poligono: null,
    centro_mapa: null,
    coordenadas: null,
    geometria: null,
    area_ha: talhao.area_ha,
  };
}

export function avaliarExclusaoSafrista({ safrista, lancamentos = [] }) {
  const vinculados = lancamentos.filter(lancamento =>
    normalizarCodigo(lancamento.codigo_produtor) === normalizarCodigo(safrista?.codigo_produtor) &&
    normalizarNome(lancamento.safrista) === normalizarNome(safrista?.nome)
  );
  const possuiHistorico = vinculados.length > 0;
  return {
    podeExcluir: !possuiHistorico,
    total: vinculados.length,
    mensagem: possuiHistorico ? mensagemCadastroComVinculos(['lançamentos']) : '',
  };
}

export function avaliarAlteracaoSafrista({ safristaAtual, dadosNovos, lancamentos = [] }) {
  const exclusao = avaliarExclusaoSafrista({ safrista: safristaAtual, lancamentos });
  if (!safristaAtual || !exclusao.total) return { ok: true };
  const trocaProdutor = normalizarCodigo(safristaAtual.codigo_produtor) !== normalizarCodigo(dadosNovos.codigo_produtor);
  const trocaNome = normalizarNome(safristaAtual.nome) !== normalizarNome(dadosNovos.nome);
  if (trocaProdutor || trocaNome) {
    return {
      ok: false,
      mensagem: 'Este safrista possui lançamentos vinculados. Não altere produtor ou nome; utilize Inativar para preservar o histórico.',
    };
  }
  return { ok: true };
}

async function filtrarEntidade(entidade, filtro) {
  if (!entidade?.filter) return [];
  return entidade.filter(filtro);
}

export async function carregarVinculosProdutor(entities, produtor) {
  const codigo = produtor?.codigo;
  const produtorId = produtor?.id;
  const [
    talhoes,
    analisesSolo,
    analisesSolo2040,
    analisesFoliares,
    planejamentosLegados,
    planejamentos2,
    aplicacoesFoliares,
    cronogramasFoliares,
    operacoes,
    posColheitas,
    lancamentos,
    safristas,
    equipamentos,
    notas,
    itensNotas,
  ] = await Promise.all([
    filtrarEntidade(entities.Talhao, { codigo_produtor: codigo }),
    filtrarEntidade(entities.AnaliseSolo, { codigo_produtor: codigo }),
    filtrarEntidade(entities.AnaliseSolo2040, { codigo_produtor: codigo }),
    filtrarEntidade(entities.AnaliseFoliar, { codigo_produtor: codigo }),
    filtrarEntidade(entities.BasePlanejamentoAdubacao, { codigo_produtor: codigo }),
    filtrarEntidade(entities.PlanejamentoAdubacao2, { codigo_produtor: codigo }),
    filtrarEntidade(entities.AplicacaoFoliar, { codigo_produtor: codigo }),
    filtrarEntidade(entities.CronogramaFoliar, { codigo_produtor: codigo }),
    filtrarEntidade(entities.PlanejamentoOperacoes, { codigo_produtor: codigo }),
    filtrarEntidade(entities.PlanejamentoPosColheita, { codigo_produtor: codigo }),
    filtrarEntidade(entities.Lancamento, { codigo_produtor: codigo }),
    filtrarEntidade(entities.Safrista, { codigo_produtor: codigo }),
    filtrarEntidade(entities.EquipamentosProdutor, { codigo_produtor: codigo }),
    filtrarEntidade(entities.BaseNotasFiscais, { produtor_id: produtorId }),
    filtrarEntidade(entities.BaseItensNotaFiscal, { produtor_id: produtorId }),
  ]);

  return {
    talhões: contar(talhoes),
    'análises de solo': contar(analisesSolo) + contar(analisesSolo2040),
    'análises foliares': contar(analisesFoliares),
    'planejamentos de adubação': contar(planejamentosLegados) + contar(planejamentos2),
    'aplicações foliares': contar(aplicacoesFoliares) + contar(cronogramasFoliares),
    operações: contar(operacoes),
    colheita: contar(posColheitas) + contar(lancamentos),
    custos: contar(itensNotas),
    'notas fiscais': contar(notas),
    'safristas/equipes': contar(safristas) + contar(equipamentos),
  };
}

export async function carregarVinculosTalhao(entities, talhao) {
  const [analises, analises2040, foliares, planosLegados, planos2, aplicacoes, operacoes, posColheitas, lancamentos, cronogramas] =
    await Promise.all([
      filtrarEntidade(entities.AnaliseSolo, { talhao_id: talhao.id }),
      filtrarEntidade(entities.AnaliseSolo2040, { talhao_id: talhao.id }),
      filtrarEntidade(entities.AnaliseFoliar, { talhao_id: talhao.id }),
      filtrarEntidade(entities.BasePlanejamentoAdubacao, { talhao_id: talhao.id }),
      filtrarEntidade(entities.PlanejamentoAdubacao2, { talhao_id: talhao.id }),
      filtrarEntidade(entities.AplicacaoFoliar, { talhao_id: talhao.id }),
      filtrarEntidade(entities.PlanejamentoOperacoes, { talhao_id: talhao.id }),
      filtrarEntidade(entities.PlanejamentoPosColheita, { talhao_id: talhao.id }),
      filtrarEntidade(entities.Lancamento, { codigo_produtor: talhao.codigo_produtor, talhao: talhao.nome }),
      filtrarEntidade(entities.CronogramaFoliar, { codigo_produtor: talhao.codigo_produtor }),
    ]);
  const cronogramasTalhao = (cronogramas || []).filter(cronograma => (cronograma.talhao_ids || []).includes(talhao.id));
  return {
    'análises de solo': contar(analises) + contar(analises2040),
    'análises foliares': contar(foliares),
    'planejamentos de adubação': contar(planosLegados) + contar(planos2),
    'aplicações foliares': contar(aplicacoes) + contar(cronogramasTalhao),
    operações: contar(operacoes),
    colheita: contar(posColheitas) + contar(lancamentos),
  };
}

export async function excluirProdutorComSeguranca(entities, produtor) {
  const vinculos = await carregarVinculosProdutor(entities, produtor);
  const avaliacao = avaliarExclusaoProdutor(vinculos);
  if (!avaliacao.podeExcluir) throw new Error(avaliacao.mensagem);
  return entities.Produtor.delete(produtor.id);
}

export async function atualizarProdutorComSeguranca(entities, produtores, produtorAtual, data) {
  const validacao = validarCodigoProdutor({ produtores, produtorAtual, codigo: data.codigo });
  if (!validacao.ok) throw new Error(validacao.mensagem);
  return entities.Produtor.update(produtorAtual.id, { ...data, codigo: validacao.codigo });
}

export async function criarProdutorComSeguranca(entities, produtores, data) {
  const validacao = validarCodigoProdutor({ produtores, codigo: data.codigo });
  if (!validacao.ok) throw new Error(validacao.mensagem);
  return entities.Produtor.create({ ...data, codigo: validacao.codigo });
}

export async function excluirTalhaoComSeguranca(entities, talhao) {
  const vinculos = await carregarVinculosTalhao(entities, talhao);
  const avaliacao = avaliarExclusaoTalhao(vinculos);
  if (!avaliacao.podeExcluir) throw new Error(avaliacao.mensagem);
  return entities.Talhao.delete(talhao.id);
}

export async function atualizarTalhaoComSeguranca(entities, talhaoAtual, data) {
  const vinculos = await carregarVinculosTalhao(entities, talhaoAtual);
  const possuiHistorico = tiposComVinculo(vinculos).length > 0;
  const avaliacao = avaliarAlteracaoTalhao({ talhaoAtual, dadosNovos: data, possuiHistorico });
  if (!avaliacao.ok) throw new Error(avaliacao.mensagem);
  return entities.Talhao.update(talhaoAtual.id, data);
}

export async function excluirSafristaComSeguranca(entities, safrista, lancamentos = null) {
  const listaLancamentos = lancamentos || await filtrarEntidade(entities.Lancamento, { codigo_produtor: safrista.codigo_produtor });
  const avaliacao = avaliarExclusaoSafrista({ safrista, lancamentos: listaLancamentos });
  if (!avaliacao.podeExcluir) throw new Error(avaliacao.mensagem);
  return entities.Safrista.delete(safrista.id);
}

export async function atualizarSafristaComSeguranca(entities, safristaAtual, data, lancamentos = null) {
  const listaLancamentos = lancamentos || await filtrarEntidade(entities.Lancamento, { codigo_produtor: safristaAtual.codigo_produtor });
  const avaliacao = avaliarAlteracaoSafrista({ safristaAtual, dadosNovos: data, lancamentos: listaLancamentos });
  if (!avaliacao.ok) throw new Error(avaliacao.mensagem);
  return entities.Safrista.update(safristaAtual.id, data);
}
