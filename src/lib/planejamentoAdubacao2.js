export function criarMarcacoesPadrao(rec, elementos) {
  const marcacoes = {};
  for (const elemento of elementos || []) {
    const valorRecomendado = elemento.temRec ? Number(rec?.[elemento.key]) : 0;
    marcacoes[elemento.key] = Boolean(elemento.temRec && Number.isFinite(valorRecomendado) && valorRecomendado > 0);
  }
  return marcacoes;
}

export function listarElementosManuaisMarcados(elementos, marcados, rec) {
  return (elementos || []).filter(elemento => {
    if (!marcados?.[elemento.key]) return false;
    if (!elemento.temRec) return true;
    const valorRecomendado = Number(rec?.[elemento.key]);
    return !Number.isFinite(valorRecomendado) || valorRecomendado <= 0;
  });
}

export function calcularPosicaoDropdown(rect, viewportWidth, viewportHeight) {
  const margem = 8;
  const largura = Math.min(480, Math.max(280, viewportWidth - margem * 2));
  const alturaEstimada = 282;
  const left = Math.min(
    Math.max(margem, rect.left),
    Math.max(margem, viewportWidth - largura - margem),
  );

  let top = rect.bottom + 4;
  if (top + alturaEstimada > viewportHeight - margem && rect.top >= alturaEstimada + margem) {
    top = rect.top - alturaEstimada - 4;
  }
  top = Math.max(margem, Math.min(top, viewportHeight - margem - 120));

  return { top, left, width: largura };
}

function timestampRegistro(registro) {
  const valor = registro?.updated_date || registro?.created_date || registro?.updatedAt || registro?.createdAt;
  const timestamp = valor ? Date.parse(valor) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Mantém um único planejamento por talhão. Quando já existem duplicados no banco,
 * usa o registro atualizado mais recentemente sem apagar dados automaticamente.
 */
export function consolidarPlanejamentosPorTalhao(registros) {
  const porTalhao = new Map();
  (registros || []).forEach((registro, indice) => {
    if (!registro?.talhao_id) return;
    const atual = porTalhao.get(registro.talhao_id);
    const candidato = { registro, timestamp: timestampRegistro(registro), indice };
    if (!atual || candidato.timestamp > atual.timestamp ||
        (candidato.timestamp === atual.timestamp && candidato.indice > atual.indice)) {
      porTalhao.set(registro.talhao_id, candidato);
    }
  });
  return Array.from(porTalhao.values(), item => item.registro);
}
