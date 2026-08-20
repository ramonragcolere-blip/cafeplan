import { converterValorSolo } from './conversaoUnidadesSolo';

// Padrões agronômicos médios para café (Adubação via Solo).
// Unidades e valores médios de mercado; o usuário pode editar tudo.

export const NUTRIENTES_SOLO = [
  { key: 'materia_organica', nome: 'Matéria Orgânica (MO)', unidade: '%' },
  { key: 'fosforo',         nome: 'Fósforo (P)',            unidade: 'mg/dm³' },
  { key: 'potassio',        nome: 'Potássio (K)',          unidade: 'mg/dm³' },
  { key: 'calcio',          nome: 'Cálcio (Ca)',            unidade: 'cmolc/dm³' },
  { key: 'magnesio',        nome: 'Magnésio (Mg)',          unidade: 'cmolc/dm³' },
  { key: 'enxofre',         nome: 'Enxofre (S)',            unidade: 'mg/dm³' },
  { key: 'boro',           nome: 'Boro (B)',              unidade: 'mg/dm³' },
  { key: 'cobre',          nome: 'Cobre (Cu)',             unidade: 'mg/dm³' },
  { key: 'zinco',          nome: 'Zinco (Zn)',             unidade: 'mg/dm³' },
  { key: 'manganes',       nome: 'Manganês (Mn)',          unidade: 'mg/dm³' },
];

export const VALORES_PADRAO_SOLO = {
  materia_organica: { minimo: 2,   ideal: 3,   maximo: 5 },
  fosforo:         { minimo: 8,   ideal: 15,  maximo: 30 },
  potassio:        { minimo: 80,  ideal: 150, maximo: 240 },
  calcio:          { minimo: 2,   ideal: 4,   maximo: 6 },
  magnesio:        { minimo: 0.8, ideal: 1.2, maximo: 2 },
  enxofre:         { minimo: 6,   ideal: 12,  maximo: 20 },
  boro:            { minimo: 0.4, ideal: 0.8, maximo: 1.2 },
  cobre:           { minimo: 1,   ideal: 2,   maximo: 4 },
  zinco:           { minimo: 2,   ideal: 4,   maximo: 6 },
  manganes:        { minimo: 4,   ideal: 12,  maximo: 25 },
};

export function montarNutrientesPadrao(profundidade) {
  return NUTRIENTES_SOLO.map((n) => {
    const padrao = VALORES_PADRAO_SOLO[n.key] || {};
    return {
      key: n.key,
      nome: n.nome,
      unidade_escolhida: n.unidade,
      minimo: padrao.minimo ?? null,
      ideal: padrao.ideal ?? null,
      maximo: padrao.maximo ?? null,
    };
  });
}

// Recomendação: aplica regra após conversão do valor da análise
// para a unidade de referência escolhida pelo usuário.
export function avaliarRecomendacao(paramNutriente, valorAnalise, unidadeAnalise) {
  if (paramNutriente == null || valorAnalise == null) return null;
  const valorConvertido = converterValorSolo(
    paramNutriente.key,
    valorAnalise,
    unidadeAnalise || paramNutriente.unidade_escolhida,
    paramNutriente.unidade_escolhida,
  );
  if (valorConvertido == null) return { status: 'indisponivel', mensagem: 'Conversão indisponível.' };
  const min = paramNutriente.minimo;
  const max = paramNutriente.maximo;
  if (max != null && valorConvertido > max) {
    return { status: 'nao_recomendar', valorConvertido, mensagem: `Não recomendar adubação com ${paramNutriente.nome} (Teor adequado ou em excesso).` };
  }
  if (min != null && valorConvertido < min) {
    return { status: 'correcao_maxima', valorConvertido, mensagem: `Recomendar dose de correção máxima para ${paramNutriente.nome}.` };
  }
  return { status: 'manutencao', valorConvertido, mensagem: `Teor de ${paramNutriente.nome} dentro da faixa. Manutenção.` };
}

export function validarParametros(nutrientes) {
  const erros = [];
  (nutrientes || []).forEach((n) => {
    const err = [];
    if (n.minimo != null && n.ideal != null && n.minimo > n.ideal) err.push('Mínimo maior que Ideal');
    if (n.ideal != null && n.maximo != null && n.ideal > n.maximo) err.push('Ideal maior que Máximo');
    if (n.minimo != null && n.maximo != null && n.minimo > n.maximo) err.push('Mínimo maior que Máximo');
    if (err.length) erros.push({ key: n.key, nome: n.nome, mensagens: err });
  });
  return erros;
}