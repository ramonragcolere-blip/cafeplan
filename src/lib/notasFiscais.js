export function consolidarPrecosItens(itens = []) {
  const mapa = {};

  itens.forEach(item => {
    const nome = String(item?.produto_nome || '').trim();
    const unidade = String(item?.unidade_medida || '').toUpperCase().trim();
    if (!nome) return;
    const chave = `${nome.toLowerCase()}||${unidade}`;
    if (!mapa[chave]) {
      mapa[chave] = {
        produto_nome: nome,
        unidade_medida: unidade,
        precos: [],
        valorPonderado: 0,
        quantidadePonderada: 0,
        nota_ids: new Set(),
      };
    }

    const preco = Number(item.preco_unitario) || 0;
    const quantidade = Number(item.quantidade) || 0;
    if (preco > 0) {
      mapa[chave].precos.push(preco);
      if (quantidade > 0) {
        mapa[chave].valorPonderado += preco * quantidade;
        mapa[chave].quantidadePonderada += quantidade;
      }
    }
    if (item.nota_fiscal_id) mapa[chave].nota_ids.add(item.nota_fiscal_id);
  });

  return Object.values(mapa)
    .map(grupo => ({
      produto_nome: grupo.produto_nome,
      unidade_medida: grupo.unidade_medida,
      menor_preco: grupo.precos.length ? Math.min(...grupo.precos) : null,
      maior_preco: grupo.precos.length ? Math.max(...grupo.precos) : null,
      preco_medio: grupo.quantidadePonderada > 0
        ? grupo.valorPonderado / grupo.quantidadePonderada
        : (grupo.precos.length ? grupo.precos.reduce((soma, valor) => soma + valor, 0) / grupo.precos.length : null),
      num_notas: grupo.nota_ids.size,
    }))
    .sort((a, b) => (a.produto_nome || '').localeCompare(b.produto_nome || '', 'pt-BR'));
}
