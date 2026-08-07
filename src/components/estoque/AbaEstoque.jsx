import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { montarCatalogoCategorias } from '@/lib/notasFiscaisCategorias';
import { construirEstoque } from '@/lib/estoqueInsumos';
import { talhoesDoProdutor } from '@/lib/talhoesAplicacao';
import FiltrosEstoque from '@/components/estoque/FiltrosEstoque';
import CardsEstoque from '@/components/estoque/CardsEstoque';
import AlertasEstoque from '@/components/estoque/AlertasEstoque';
import TabelaEstoque from '@/components/estoque/TabelaEstoque';
import ModalRegistrarUso from '@/components/estoque/ModalRegistrarUso';
import ModalDetalheEstoque from '@/components/estoque/ModalDetalheEstoque';
import ModalEditarMovimento from '@/components/estoque/ModalEditarMovimento';
import ConfirmaExcluirMovimento from '@/components/estoque/ConfirmaExcluirMovimento';
import ModalEditarDose from '@/components/estoque/ModalEditarDose';
import ModalCadastrarInsumo from '@/components/estoque/ModalCadastrarInsumo';
import DetalhesNotaFiscal from '@/components/notas/DetalhesNotaFiscal';

// Aba de Controle de Estoque. Entradas derivam das NFs (itens) já carregadas
// na página; só saídas e configurações de dose são persistidas. Não altera
// filtros da página, nem dados das NFs, nem Banco de Preços.
export default function AbaEstoque({ notas, itens, produtores, produtorFiltro }) {
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('todos');
  const [situacao, setSituacao] = useState('todos');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [rowUso, setRowUso] = useState(null);
  const [rowDetalhe, setRowDetalhe] = useState(null);
  const [movEdicao, setMovEdicao] = useState(null); // {row, mov}
  const [movExcluir, setMovExcluir] = useState(null); // {row, mov}
  const [rowDose, setRowDose] = useState(null);
  const [rowCadastrar, setRowCadastrar] = useState(null); // {row, doseInicial, unidadeInicial}
  const [notaDetalhe, setNotaDetalhe] = useState(null);

  const { data: saidas = [] } = useQuery({
    queryKey: ['movimentos_estoque', produtorFiltro],
    queryFn: () => base44.entities.MovimentoEstoqueInsumo.list('-data_movimento', 5000),
  });
  const { data: configs = [] } = useQuery({
    queryKey: ['configs_estoque', produtorFiltro],
    queryFn: () => base44.entities.ConfiguracaoEstoqueProduto.list(undefined, 5000),
  });
  const { data: fertilizantes = [] } = useQuery({
    queryKey: ['fertilizantes_formulados', 'catalogo_estoque'],
    queryFn: () => base44.entities.FertilizanteFormulado.list(undefined, 5000),
  });
  const { data: fontes = [] } = useQuery({
    queryKey: ['fontes_simples', 'catalogo_estoque'],
    queryFn: () => base44.entities.FonteSimples.list(undefined, 5000),
  });
  // Talhões carregados uma única vez; filtrados por produtor ao abrir modais
  // (relação Talhao.codigo_produtor === Produtor.codigo).
  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes', 'estoque'],
    queryFn: () => base44.entities.Talhao.list(undefined, 5000),
  });

  const catalogoCategorias = useMemo(
    () => montarCatalogoCategorias(fertilizantes, fontes),
    [fertilizantes, fontes]
  );

  const rows = useMemo(() => construirEstoque({
    itens, notas, saidas, fertilizantes, fontes, catalogoCategorias, configs, produtorFiltro,
  }), [itens, notas, saidas, fertilizantes, fontes, catalogoCategorias, configs, produtorFiltro]);

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

  const produtorNome = (id) => {
    const p = (produtores || []).find(x => x.id === id);
    return p ? (p.nome || p.codigo_produtor || id) : id;
  };

  const abrirNota = (notaId) => {
    const nota = (notas || []).find(n => n.id === notaId) || null;
    setNotaDetalhe(nota);
  };

  const abrirCadastrarViaDetalhe = (row) => {
    setRowDetalhe(null);
    setRowCadastrar({ row, doseInicial: null, unidadeInicial: 'L/ha' });
  };

  const abrirCadastrarViaDose = (row, doseVal, unidade) => {
    setRowCadastrar({ row, doseInicial: doseVal, unidadeInicial: unidade });
  };

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
        Estoque por produtor · entradas automáticas das NFs importadas · saídas e doses editáveis manualmente.
      </div>

      <TabelaEstoque
        rows={rowsFiltradas}
        showProdutor={showProdutor}
        onRegistrarUso={setRowUso}
        onVerDetalhe={setRowDetalhe}
        onEditarDose={setRowDose}
      />

      <ModalRegistrarUso
        row={rowUso} open={!!rowUso} onClose={() => setRowUso(null)}
        talhoes={talhoesDoProdutor(talhoes, produtores, rowUso?.produtor_id)}
      />
      <ModalDetalheEstoque
        row={rowDetalhe} open={!!rowDetalhe} onClose={() => setRowDetalhe(null)}
        onEditarMovimento={(row, mov) => { setRowDetalhe(null); setMovEdicao({ row, mov }); }}
        onExcluirMovimento={(row, mov) => { setRowDetalhe(null); setMovExcluir({ row, mov }); }}
        onAbrirNota={abrirNota}
        onEditarDose={(row) => { setRowDetalhe(null); setRowDose(row); }}
        onCadastrarInsumo={abrirCadastrarViaDetalhe}
      />
      <ModalEditarMovimento
        movimento={movEdicao?.mov} row={movEdicao?.row}
        open={!!movEdicao} onClose={() => setMovEdicao(null)}
        talhoes={talhoesDoProdutor(talhoes, produtores, movEdicao?.row?.produtor_id)}
      />
      <ConfirmaExcluirMovimento
        movimento={movExcluir?.mov} open={!!movExcluir} onClose={() => setMovExcluir(null)}
      />
      <ModalEditarDose
        row={rowDose} open={!!rowDose} onClose={() => setRowDose(null)}
        onCadastrarNaBase={abrirCadastrarViaDose}
      />
      <ModalCadastrarInsumo
        row={rowCadastrar?.row}
        doseInicial={rowCadastrar?.doseInicial}
        unidadeInicial={rowCadastrar?.unidadeInicial}
        open={!!rowCadastrar} onClose={() => setRowCadastrar(null)}
      />

      <DetalhesNotaFiscal
        nota={notaDetalhe}
        itens={itens}
        produtorNome={produtorNome}
        onClose={() => setNotaDetalhe(null)}
      />
    </div>
  );
}