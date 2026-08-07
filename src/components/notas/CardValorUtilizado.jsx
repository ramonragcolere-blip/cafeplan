// Card "Valor Utilizado (saídas)" — exibe o custo financeiro dos produtos que
// saíram do estoque (tipo_movimento = 'saida'). Reutiliza EXATAMENTE a mesma
// lógica de custo histórico da aba Análises (analisesEstoque.js):
//  - construirAplicacoes: monta cada saída com custo = custo médio ponderado
//    HISTÓRICO das compras até data_movimento (compra futura NÃO recalcula).
//  - filtrarAplicacoes: aplica produtor/produto/categoria/período. O período
//    aqui usa data_movimento (a.data), NÃO data_emissao das notas.
//  - cardsCustos: soma custoTotal e conta semPreco (saídas sem custo definido).
// Ajustes (tipo_movimento = 'ajuste') são ignorados por construirAplicacoes.
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { construirAplicacoes, filtrarAplicacoes, cardsCustos } from '@/lib/analisesEstoque';

const fmtR = (v) => v != null
  ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : 'R$ 0,00';

// Card "Valor Utilizado (saídas)". Recebe os mesmos filtros do topo da página
// e os catálogos/notas/itens já carregados pela página-mãe (evita refetch).
export default function CardValorUtilizado({
  produtorFiltro = 'todos',
  buscaProduto = '',
  categoriaFiltro = 'todos',
  dataInicial = '',
  dataFinal = '',
  notas = [],
  itens = [],
  fertilizantes = [],
  fontes = [],
  catalogoCategorias = [],
}) {
  const { data: saidas = [] } = useQuery({
    queryKey: ['movimento_estoque_insumo', 'card_utilizado'],
    queryFn: () => base44.entities.MovimentoEstoqueInsumo.list('-data_movimento', 10000),
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configuracao_estoque_produto', 'card_utilizado'],
    queryFn: () => base44.entities.ConfiguracaoEstoqueProduto.list(undefined, 5000),
  });

  const { valor, semCusto } = useMemo(() => {
    const aplicacoes = construirAplicacoes({
      saidas, itens, notas, fertilizantes, fontes, catalogoCategorias, configs,
    });
    const filtradas = filtrarAplicacoes(aplicacoes, {
      produtor: produtorFiltro,
      produto: buscaProduto,
      categoria: categoriaFiltro,
      dataInicial,
      dataFinal,
    });
    const c = cardsCustos(filtradas);
    return { valor: c.custoTotal || 0, semCusto: c.semPreco || 0 };
  }, [saidas, itens, notas, fertilizantes, fontes, catalogoCategorias, configs,
      produtorFiltro, buscaProduto, categoriaFiltro, dataInicial, dataFinal]);

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between">
      <div>
        <p className="text-xs text-muted-foreground mb-1">Valor Utilizado (saídas)</p>
        <p className="text-lg font-bold text-primary break-words">{fmtR(valor)}</p>
      </div>
      {semCusto > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-500 mt-1.5">
          {semCusto} {semCusto === 1 ? 'saída sem custo definido' : 'saídas sem custo definido'}
        </p>
      )}
    </div>
  );
}