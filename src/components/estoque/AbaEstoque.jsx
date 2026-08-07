import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { montarCatalogoCategorias } from '@/lib/notasFiscaisCategorias';
import { construirEstoque, fmtData } from '@/lib/estoqueInsumos';
import FiltrosEstoque from '@/components/estoque/FiltrosEstoque';
import CardsEstoque from '@/components/estoque/CardsEstoque';
import AlertasEstoque from '@/components/estoque/AlertasEstoque';
import TabelaEstoque from '@/components/estoque/TabelaEstoque';
import ModalRegistrarUso from '@/components/estoque/ModalRegistrarUso';
import ModalDetalheEstoque from '@/components/estoque/ModalDetalheEstoque';

// Aba de Controle de Estoque. Entradas derivam das NFs (itens) já carregadas
// na página; só saídas são persistidas (MovimentoEstoqueInsumo). Não altera
// filtros da página, nem dados das NFs.
export default function AbaEstoque({ notas, itens, produtores, produtorFiltro }) {
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('todos');
  const [situacao, setSituacao] = useState('todos');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [rowUso, setRowUso] = useState(null);
  const [rowDetalhe, setRowDetalhe] = useState(null);

  // Saídas registradas (mesma RLS por produtor/created_by_id)
  const { data: saidas = [], refetch: refetchSaidas } = useQuery({
    queryKey: ['movimentos_estoque', produtorFiltro],
    queryFn: () => base44.entities.MovimentoEstoqueInsumo.list('-data_movimento', 5000),
  });

  // Base de Insumos para relação/dose (mesmas entidades já usadas pelas notas)
  const { data: fertilizantes = [] } = useQuery({
    queryKey: ['fertilizantes_formulados', 'catalogo_estoque'],
    queryFn: () => base44.entities.FertilizanteFormulado.list(undefined, 5000),
  });
  const { data: fontes = [] } = useQuery({
    queryKey: ['fontes_simples', 'catalogo_estoque'],
    queryFn: () => base44.entities.FonteSimples.list(undefined, 5000),
  });

  const catalogoCategorias = useMemo(
    () => montarCatalogoCategorias(fertilizantes, fontes),
    [fertilizantes, fontes]
  );

  // Linhas de estoque (por produtor + produto)
  const rows = useMemo(() => construirEstoque({
    itens, notas, saidas, fertilizantes, fontes, catalogoCategorias, produtorFiltro,
  }), [itens, notas, saidas, fertilizantes, fontes, catalogoCategorias, produtorFiltro]);

  // Filtros independentes do estoque
  const rowsFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return rows.filter(r => {
      if (termo && !r.produto_nome.toLowerCase().includes(termo)) return false;
      if (categoria !== 'todos' && r.categoria !== categoria) return false;
      if (situacao !== 'todos' && r.situacao !== situacao) return false;
      if (dataInicial && (!r.ultima_entrada || r.ultima_entrada < dataInicial)) return false;
      if (dataFinal && (!r.ultima_entrada || r.ultima_entrada > dataFinal)) return false;
      return true;
    });
  }, [rows, busca, categoria, situacao, dataInicial, dataFinal]);

  const temFiltro = !!(busca || categoria !== 'todos' || situacao !== 'todos' || dataInicial || dataFinal);
  const limparFiltros = () => {
    setBusca(''); setCategoria('todos'); setSituacao('todos'); setDataInicial(''); setDataFinal('');
  };
  const showProdutor = produtorFiltro === 'todos';

  return (
    <div className="space-y-4">
      <CardsEstoque rows={rowsFiltradas} />
      <AlertasEstoque rows={rowsFiltradas} produtores={produtores} produtorFiltro={produtorFiltro} />

      <FiltrosEstoque
        busca={busca} setBusca={setBusca}
        categoria={categoria} setCategoria={setCategoria}
        situacao={situacao} setSituacao={setSituacao}
        dataInicial={dataInicial} setDataInicial={setDataInicial}
        dataFinal={dataFinal} setDataFinal={setDataFinal}
        onLimpar={limparFiltros} temFiltro={temFiltro}
      />

      <div className="px-1 text-xs text-muted-foreground">
        Estoque por produtor · entradas automáticas das NFs importadas · saídas registradas manualmente.
      </div>

      <TabelaEstoque
        rows={rowsFiltradas}
        showProdutor={showProdutor}
        onRegistrarUso={setRowUso}
        onVerDetalhe={setRowDetalhe}
      />

      <ModalRegistrarUso
        row={rowUso}
        open={!!rowUso}
        onClose={() => setRowUso(null)}
        onSalvo={refetchSaidas}
      />
      <ModalDetalheEstoque
        row={rowDetalhe}
        open={!!rowDetalhe}
        onClose={() => setRowDetalhe(null)}
      />
    </div>
  );
}