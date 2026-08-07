// Utilidades para seleção de talhões e rateio de quantidade/custo por talhão
// nas saídas de estoque (MovimentoEstoqueInsumo). Reutiliza a relação
// Talhao.codigo_produtor === Produtor.codigo já usada pelos demais módulos.
//
// Não altera cálculos de estoque nem análises existentes — apenas provê as
// peças para enriquecer as saídas com talhões e distribuir quantidade/custo.

const EQ_TOL = 0.0001;

function fmtNum(v) {
  return Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

// Talhões de um produtor. produtorId = Produtor.id (usado no estoque/NFs).
// Relaciona via Produtor.codigo <-> Talhao.codigo_produtor.
export function talhoesDoProdutor(talhoes = [], produtores = [], produtorId) {
  if (!produtorId) return [];
  const produtor = (produtores || []).find((p) => p.id === produtorId);
  if (!produtor || !produtor.codigo) return [];
  return (talhoes || []).filter((t) => t.codigo_produtor === produtor.codigo);
}

// Computa o array talhoes_aplicacao + área total a partir da seleção do modal.
// ids: talhao_id[] selecionados; mode: 'proporcional' | 'manual';
// manual: { [talhao_id]: quantidadeRateada }; quantidadeTotal: qtd da saída.
// Retorna { talhoes_aplicacao, area_total, erro, soma }.
export function computarTalhoesAplicacao({
  talhoes = [], ids = [], mode = 'proporcional', manual = {}, quantidadeTotal = 0,
} = {}) {
  const total = Number(quantidadeTotal) || 0;
  const idSet = new Set((ids || []).map(String));
  const sel = (talhoes || []).filter((t) => idSet.has(String(t.id)));
  const areaTotal = sel.reduce((s, t) => s + (Number(t.area_ha) || 0), 0);

  let erro = null;
  let talhoesAplicacao;

  if (mode === 'manual') {
    talhoesAplicacao = sel.map((t) => {
      const v = Number(manual[t.id] ?? 0) || 0;
      return {
        talhao_id: t.id,
        talhao_nome: t.nome,
        area_ha: Number(t.area_ha) || 0,
        quantidade_rateada: v,
      };
    });
    const soma = talhoesAplicacao.reduce((s, x) => s + x.quantidade_rateada, 0);
    if (Math.abs(soma - total) > EQ_TOL) {
      erro = `A soma das quantidades distribuídas entre os talhões (${fmtNum(soma)}) deve ser igual à quantidade total utilizada (${fmtNum(total)}).`;
    }
  } else {
    talhoesAplicacao = sel.map((t) => {
      const area = Number(t.area_ha) || 0;
      let rateada;
      if (areaTotal > 0) rateada = total * (area / areaTotal);
      else rateada = sel.length > 0 ? total / sel.length : 0;
      rateada = Math.round(rateada * 100000) / 100000;
      return { talhao_id: t.id, talhao_nome: t.nome, area_ha: area, quantidade_rateada: rateada };
    });
  }

  return {
    talhoes_aplicacao: talhoesAplicacao,
    area_total: Math.round(areaTotal * 100) / 100,
    erro,
    soma: talhoesAplicacao.reduce((s, x) => s + x.quantidade_rateada, 0),
  };
}

// Reconstrói o estado de edição (ids/mode/manual) a partir de um movimento
// existente. Detecta "proporcional" quando as quantidades rateadas gravadas
// correspondem à distribuição proporcional pela área; senão "manual".
export function estadoTalhoesDeMovimento(movimento) {
  const arr = Array.isArray(movimento?.talhoes_aplicacao) ? movimento.talhoes_aplicacao : [];
  const ids = arr.map((x) => x.talhao_id).filter(Boolean);
  const qtd = Number(movimento?.quantidade) || 0;
  const areaTotal = arr.reduce((s, x) => s + (Number(x.area_ha) || 0), 0);

  let proporcional = true;
  if (arr.length && qtd > 0) {
    for (const x of arr) {
      const area = Number(x.area_ha) || 0;
      const esp = areaTotal > 0 ? qtd * (area / areaTotal) : qtd / arr.length;
      if (Math.abs(esp - (Number(x.quantidade_rateada) || 0)) > EQ_TOL) { proporcional = false; break; }
    }
  }

  const manual = {};
  arr.forEach((x) => { if (x.talhao_id) manual[x.talhao_id] = Number(x.quantidade_rateada) || 0; });
  return { ids, mode: proporcional ? 'proporcional' : 'manual', manual };
}

// Label curto de dose em base (l/kg) -> "0,5 L/ha" / "2 kg/ha".
export function labelDoseBase(dose) {
  if (!dose || !dose.valor) return null;
  const u = dose.unit === 'kg' ? 'kg/ha' : 'L/ha';
  return `${Number(dose.valor).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${u}`;
}