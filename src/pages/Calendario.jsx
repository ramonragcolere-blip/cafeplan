import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays } from 'lucide-react';
import MesCard from '@/components/calendario/MesCard';
import MesDetalheModal from '@/components/calendario/MesDetalheModal';
import { calcularPlanejamento } from '@/lib/calcularPlanejamento';

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const MESES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const GRUPOS_DEFENSIVO = ['Fungicida','Inseticida','Inseticida Biológico','Inseticida de Solo','Acaricida'];
const GRUPOS_HERBICIDA = ['Herbicida'];

function getMesIndex(mesStr) {
  return MESES.indexOf(mesStr?.toUpperCase());
}

function getMesColheita(dataInicio) {
  if (!dataInicio) return -1;
  const d = new Date(dataInicio);
  return isNaN(d) ? -1 : d.getMonth();
}

export default function Calendario() {
  const [produtorFiltro, setProdutorFiltro] = useState('');
  const [safraFiltro, setSafraFiltro] = useState('');
  const [mesSelecionado, setMesSelecionado] = useState(null); // 0-11

  const { data: produtores = [] } = useQuery({ queryKey: ['produtores'], queryFn: () => base44.entities.Produtor.list() });
  const { data: talhoes = [] } = useQuery({ queryKey: ['talhoes'], queryFn: () => base44.entities.Talhao.list() });
  const { data: planos = [] } = useQuery({ queryKey: ['base_planejamento'], queryFn: () => base44.entities.BasePlanejamentoAdubacao.list() });
  const { data: aplicacoesFoliares = [] } = useQuery({ queryKey: ['aplicacoes_foliares'], queryFn: () => base44.entities.AplicacaoFoliar.list() });

  // Safras disponíveis
  const safras = useMemo(() => {
    const set = new Set();
    planos.forEach(p => p.safra && set.add(p.safra));
    aplicacoesFoliares.forEach(a => a.safra && set.add(a.safra));
    return [...set].sort().reverse();
  }, [planos, aplicacoesFoliares]);

  const safraAtiva = safraFiltro || safras[0] || '';

  // Filtrar por produtor
  const planosFiltrados = useMemo(() =>
    planos.filter(p =>
      (!safraAtiva || p.safra === safraAtiva) &&
      (!produtorFiltro || p.codigo_produtor === produtorFiltro)
    ), [planos, safraAtiva, produtorFiltro]);

  const aplicacoesFiltradas = useMemo(() =>
    aplicacoesFoliares.filter(a =>
      (!safraAtiva || a.safra === safraAtiva) &&
      (!produtorFiltro || a.codigo_produtor === produtorFiltro)
    ), [aplicacoesFoliares, safraAtiva, produtorFiltro]);

  const talhoesFiltrados = useMemo(() =>
    talhoes.filter(t => !produtorFiltro || t.codigo_produtor === produtorFiltro),
    [talhoes, produtorFiltro]);

  // Calcular colheita por talhão (sequência)
  const colheitaPorMes = useMemo(() => {
    const mapa = {}; // mes(0-11) → [talhao]
    if (produtorFiltro) {
      const produtor = produtores.find(p => p.codigo === produtorFiltro);
      if (produtor) {
        const tProdutor = talhoesFiltrados;
        const result = calcularPlanejamento(produtor, tProdutor);
        result.talhoes.forEach(t => {
          const mes = getMesColheita(t.dataInicio);
          if (mes >= 0) {
            if (!mapa[mes]) mapa[mes] = [];
            mapa[mes].push(t);
          }
        });
      }
    } else {
      produtores.forEach(produtor => {
        const tProdutor = talhoes.filter(t => t.codigo_produtor === produtor.codigo);
        if (!tProdutor.length) return;
        const result = calcularPlanejamento(produtor, tProdutor);
        result.talhoes.forEach(t => {
          const mes = getMesColheita(t.dataInicio);
          if (mes >= 0) {
            if (!mapa[mes]) mapa[mes] = [];
            mapa[mes].push(t);
          }
        });
      });
    }
    return mapa;
  }, [produtores, talhoes, talhoesFiltrados, produtorFiltro]);

  // Montar dados por mês
  const dadosPorMes = useMemo(() => {
    return MESES.map((mes, idx) => {
      // Adubação via solo
      const adubacaoSolo = planosFiltrados.filter(p => {
        const todosMeses = (p.meses || []).flat();
        return todosMeses.includes(mes);
      });

      // Aplicações foliares
      const foliares = aplicacoesFiltradas.filter(a =>
        (a.meses || []).includes(mes)
      );

      const foliarAdubacao = foliares.filter(a =>
        (a.produtos || []).some(p => !GRUPOS_DEFENSIVO.includes(p.grupo) && !GRUPOS_HERBICIDA.includes(p.grupo))
      );
      const foliarDefensivo = foliares.filter(a =>
        (a.produtos || []).some(p => GRUPOS_DEFENSIVO.includes(p.grupo))
      );
      const foliarHerbicida = foliares.filter(a =>
        (a.produtos || []).some(p => GRUPOS_HERBICIDA.includes(p.grupo))
      );

      // Colheita
      const colheita = colheitaPorMes[idx] || [];

      return {
        mes,
        mesIdx: idx,
        mesNome: MESES_NOME[idx],
        adubacaoSolo,
        foliarAdubacao,
        foliarDefensivo,
        foliarHerbicida,
        colheita,
        temAtividade: adubacaoSolo.length > 0 || foliares.length > 0 || colheita.length > 0,
      };
    });
  }, [planosFiltrados, aplicacoesFiltradas, colheitaPorMes]);

  const dadosMesSelecionado = mesSelecionado !== null ? dadosPorMes[mesSelecionado] : null;

  return (
    <div className="space-y-6">
      {/* Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-8 h-8 text-primary" />
            Calendário Agrícola
          </h1>
          <p className="text-muted-foreground mt-1">Visão mensal das atividades planejadas</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={produtorFiltro} onValueChange={setProdutorFiltro}>
            <SelectTrigger className="w-full sm:w-60">
              <SelectValue placeholder="Todos os produtores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Todos os produtores</SelectItem>
              {produtores.map(p => (
                <SelectItem key={p.id} value={p.codigo}>{p.codigo} — {p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={safraAtiva} onValueChange={setSafraFiltro}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Safra" />
            </SelectTrigger>
            <SelectContent>
              {safras.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid 12 meses */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {dadosPorMes.map((dados) => (
          <MesCard
            key={dados.mes}
            dados={dados}
            selecionado={mesSelecionado === dados.mesIdx}
            onClick={() => setMesSelecionado(mesSelecionado === dados.mesIdx ? null : dados.mesIdx)}
          />
        ))}
      </div>

      {/* Modal de detalhe */}
      {dadosMesSelecionado && (
        <MesDetalheModal
          dados={dadosMesSelecionado}
          talhoes={talhoesFiltrados}
          onFechar={() => setMesSelecionado(null)}
        />
      )}
    </div>
  );
}