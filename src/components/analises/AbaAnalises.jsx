import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart3 } from 'lucide-react';
import FiltrosAnalises, { iso, safraHoje } from '@/components/analises/FiltrosAnalises';
import CardsAnalises from '@/components/analises/CardsAnalises';
import { GraficoTemporal, GraficoPorProduto, GraficoPorCategoria, DistribuicaoMensal, GraficoPorTalhao } from '@/components/analises/GraficosAnalises';
import ResumoCategoriaTabela from '@/components/analises/ResumoCategoriaTabela';
import ModalDrillDown from '@/components/analises/ModalDrillDown';
import { MapPin } from 'lucide-react';
import {
  construirAplicacoes, filtrarAplicacoes, cardsAplicacoes, cardsCustos,
  resumoPorCategoria, safrasDisponiveis, filtrarDrillDown, countSemTalhao,
} from '@/lib/analisesEstoque';

// Aba de Análises — pura visualização sobre MovimentoEstoqueInsumo (saídas),
// BaseItensNotaFiscal (custo) e Base de Insumos (dose/categoria). Não persiste,
// não duplica dados e não altera os demais módulos.
export default function AbaAnalises({
  notas, itens, produtores, fertilizantes, fontes, catalogoCategorias,
}) {
  const [modo, setModo] = useState('aplicacoes'); // 'aplicacoes' | 'custos'
  const [indicador, setIndicador] = useState('aplicacoes'); // 'aplicacoes' | 'area' | 'custo'
  const [filtros, setFiltros] = useState({
    produtor: 'todos', produto: '', categoria: 'todos',
    dataInicial: '', dataFinal: '', safra: 'todas', talhao: 'todos',
  });
  const [agruparPor, setAgruparPor] = useState('produto');
  const [categoriaFoco, setCategoriaFoco] = useState(null);
  const [drill, setDrill] = useState(null);

  const { data: saidas = [] } = useQuery({
    queryKey: ['movimentos_estoque', 'analises'],
    queryFn: () => base44.entities.MovimentoEstoqueInsumo.list('-data_movimento', 5000),
  });
  const { data: configs = [] } = useQuery({
    queryKey: ['configs_estoque', 'analises'],
    queryFn: () => base44.entities.ConfiguracaoEstoqueProduto.list(undefined, 5000),
  });
  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes', 'analises'],
    queryFn: () => base44.entities.Talhao.list(undefined, 5000),
  });

  const aplicacoes = useMemo(
    () => construirAplicacoes({
      saidas, itens, notas, fertilizantes, fontes, catalogoCategorias, configs,
    }),
    [saidas, itens, notas, fertilizantes, fontes, catalogoCategorias, configs],
  );

  const aplicacoesFiltradas = useMemo(
    () => filtrarAplicacoes(aplicacoes, filtros),
    [aplicacoes, filtros],
  );

  // Indicador real usado nos gráficos: em modo custo sempre R$.
  const metrica = modo === 'custos' ? 'custo' : (indicador === 'area' ? 'area' : 'aplicacoes');

  const cards = useMemo(
    () => (modo === 'aplicacoes' ? cardsAplicacoes(aplicacoesFiltradas) : cardsCustos(aplicacoesFiltradas)),
    [modo, aplicacoesFiltradas],
  );
  const resumo = useMemo(() => resumoPorCategoria(aplicacoesFiltradas), [aplicacoesFiltradas]);
  const safras = useMemo(() => safrasDisponiveis(aplicacoes), [aplicacoes]);

  const trocarModo = (m) => {
    setModo(m);
    setIndicador(m === 'custos' ? 'custo' : 'aplicacoes');
  };

  const onAtalho = (id) => {
    const h = new Date();
    const hojeIso = iso(h);
    const sub = (dias) => { const d = new Date(h); d.setDate(d.getDate() - dias); return iso(d); };
    if (id === '30d') setFiltros((f) => ({ ...f, dataInicial: sub(30), dataFinal: hojeIso, safra: 'todas' }));
    else if (id === '90d') setFiltros((f) => ({ ...f, dataInicial: sub(90), dataFinal: hojeIso, safra: 'todas' }));
    else if (id === 'ano') {
      const y = h.getFullYear();
      setFiltros((f) => ({ ...f, dataInicial: `${y}-01-01`, dataFinal: `${y}-12-31`, safra: 'todas' }));
    } else if (id === 'safra') {
      setFiltros((f) => ({ ...f, dataInicial: '', dataFinal: '', safra: safraHoje() }));
    } else if (id === 'tudo') {
      setFiltros((f) => ({ ...f, dataInicial: '', dataFinal: '', safra: 'todas' }));
    }
  };

  const onDrillDown = ({ titulo, filtro }) => {
    const lista = filtrarDrillDown(aplicacoesFiltradas, filtro);
    setDrill({ titulo, descricao: `${lista.length} ${lista.length === 1 ? 'registro' : 'registros'}`, lista });
  };

  const produtorNome = (id) => {
    const p = (produtores || []).find((x) => x.id === id);
    return p ? (p.nome || p.fazenda || p.id) : id;
  };
  const consolidado = filtros.produtor === 'todos';

  return (
    <div className="space-y-4">
      {/* Seletor de modo */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-sm">Análises de Aplicações e Custos</h2>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
          <button
            onClick={() => trocarModo('aplicacoes')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${modo === 'aplicacoes' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >Aplicações</button>
          <button
            onClick={() => trocarModo('custos')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${modo === 'custos' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >Custos</button>
        </div>
      </div>

      <FiltrosAnalises
        filtros={filtros} setFiltros={setFiltros}
        produtores={produtores || []} talhoes={talhoes} safras={safras}
        modo={modo} indicador={indicador} setIndicador={setIndicador}
        onAtalho={onAtalho}
      />

      <CardsAnalises modo={modo} cards={cards} />

      {(filtros.talhao === 'todos' || filtros.talhao === undefined) && countSemTalhao(aplicacoesFiltradas) > 0 && (
        <div className="flex items-center gap-2 border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-800">
          <MapPin className="w-4 h-4 shrink-0" />
          <span>
            {countSemTalhao(aplicacoesFiltradas)} {countSemTalhao(aplicacoesFiltradas) === 1 ? 'aplicação antiga sem talhão informado' : 'aplicações antigas sem talhão informado'} — não aparecem ao filtrar por talhão específico.
          </span>
        </div>
      )}

      {aplicacoesFiltradas.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">
          Sem aplicações registradas para os filtros selecionados.
          <p className="mt-1 text-xs">As aplicações vêm das saídas registradas no Controle de Estoque (ajustes não contam).</p>
        </div>
      ) : (
        <>
          <GraficoTemporal
            aplicacoes={aplicacoesFiltradas}
            agruparPor={agruparPor} setAgruparPor={setAgruparPor}
            metrica={metrica} categoriaFoco={categoriaFoco}
            onDrillDown={onDrillDown}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GraficoPorProduto
              aplicacoes={aplicacoesFiltradas} metrica={metrica}
              categoriaFoco={categoriaFoco} onDrillDown={onDrillDown}
            />
            <GraficoPorCategoria
              aplicacoes={aplicacoesFiltradas} metrica={metrica}
              categoriaFoco={categoriaFoco} setCategoriaFoco={setCategoriaFoco}
            />
          </div>

          <DistribuicaoMensal
            aplicacoes={aplicacoesFiltradas} metrica={metrica}
            categoriaFoco={categoriaFoco} onDrillDown={onDrillDown}
          />

          <GraficoPorTalhao
            aplicacoes={aplicacoesFiltradas} metrica={metrica}
            onSelecionarTalhao={(id) => setFiltros((f) => ({ ...f, talhao: id }))}
          />

          <ResumoCategoriaTabela resumo={resumo} />
        </>
      )}

      <ModalDrillDown
        open={!!drill}
        onClose={() => setDrill(null)}
        titulo={drill?.titulo}
        descricao={drill?.descricao}
        itens={drill?.lista}
        produtorNome={produtorNome}
        consolidado={consolidado}
      />
    </div>
  );
}