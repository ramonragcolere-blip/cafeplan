// Card "Valor Atual em Estoque" — valor financeiro dos produtos que AINDA
// estão fisicamente disponíveis no estoque.
//
// Reuso obrigatório (sem lógica paralela):
//  - construirEstoque (estoqueInsumos.js): mesmo saldo físico do Controle de
//    Estoque (entradas das NFs - saídas/ajustes registrados). Saldo idêntico ao
//    mostrado na aba Estoque.
//  - calcularValorAtualEstoque (analisesEstoque.js): custo médio ponderado
//    CUMULATIVO das entradas (BaseItensNotaFiscal) com conversão de embalagem
//    via converterItem — mesma fonte de custo da aba Análises, sem limite de
//    data (saldo atual, não movimento do período).
//
// Filtros respeitados: produtor, produto (nome), categoria.
// Filtro de data NÃO se aplica (estoque atual não desaparece por período).
// Produtos sem custo calculável são excluídos da soma e contados.
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { construirEstoque } from '@/lib/estoqueInsumos';
import { calcularValorAtualEstoque } from '@/lib/analisesEstoque';
import { normalizarNome, classificarProduto } from '@/lib/notasFiscaisCategorias';

const fmtR = (v) => v != null
  ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : 'R$ 0,00';

export default function CardValorEstoque({
  produtorFiltro = 'todos',
  buscaProduto = '',
  categoriaFiltro = 'todos',
  notas = [],
  itens = [],
  fertilizantes = [],
  fontes = [],
  catalogoCategorias = [],
}) {
  const { data: saidas = [] } = useQuery({
    queryKey: ['movimento_estoque_insumo', 'card_estoque'],
    queryFn: () => base44.entities.MovimentoEstoqueInsumo.list('-data_movimento', 10000),
  });
  const { data: configs = [] } = useQuery({
    queryKey: ['configuracao_estoque_produto', 'card_estoque'],
    queryFn: () => base44.entities.ConfiguracaoEstoqueProduto.list(undefined, 5000),
  });

  const { valor, semCusto } = useMemo(() => {
    const rows = construirEstoque({
      itens, notas, saidas, fertilizantes, fontes, catalogoCategorias, configs, produtorFiltro,
    });
    const termo = normalizarNome(buscaProduto);
    const filtradas = rows.filter((r) => {
      if (termo && !normalizarNome(r.produto_nome).includes(termo)) return false;
      const cat = r.categoria || classificarProduto(r.produto_nome, catalogoCategorias);
      if (categoriaFiltro !== 'todos' && cat !== categoriaFiltro) return false;
      return true;
    });
    return calcularValorAtualEstoque({ estoqueRows: filtradas, itens, notas, fertilizantes, fontes });
  }, [saidas, configs, itens, notas, fertilizantes, fontes, catalogoCategorias,
      produtorFiltro, buscaProduto, categoriaFiltro]);

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between">
      <div className="flex items-start gap-1.5">
        <p className="text-xs text-muted-foreground mb-1">Valor Atual em Estoque</p>
        <Info
          className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0 mt-0.5"
          aria-label="Valor estimado dos produtos que ainda possuem saldo físico no estoque, calculado pelo custo médio ponderado das compras."
        >
          <title>Valor estimado dos produtos que ainda possuem saldo físico no estoque, calculado pelo custo médio ponderado das compras.</title>
        </Info>
      </div>
      <div>
        <p className="text-lg font-bold text-primary break-words">{fmtR(valor)}</p>
        {semCusto > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1.5">
            {semCusto} {semCusto === 1 ? 'produto com saldo sem custo definido' : 'produtos com saldo sem custo definido'}
          </p>
        )}
      </div>
    </div>
  );
}