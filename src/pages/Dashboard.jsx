import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, TreePine, ClipboardList, AlertTriangle } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import ColheitaProgressoSection from '@/components/dashboard/ColheitaProgressoSection';
import AdubacaoSection from '@/components/dashboard/AdubacaoSection';
import AlertasSection from '@/components/dashboard/AlertasSection';
import ResumoProdutorSection from '@/components/dashboard/ResumoProdutorSection';
import CustosPlanejadosSection from '@/components/dashboard/CustosPlanejadosSection';
import { normalizarPlanosAdubacao, normalizarAplicacoesFoliares } from '@/lib/integracaoPlanejamentos';

function ProdutorAutocomplete({ produtores, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Sincroniza o texto quando o valor externo muda (ex: seleção via tabela)
  useEffect(() => {
    if (!value) { setQuery(''); return; }
    const p = produtores.find(p => p.codigo === value);
    if (p) setQuery(`${p.codigo} — ${p.nome}`);
  }, [value, produtores]);

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtrados = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return produtores.filter(p =>
      p.nome?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q)
    );
  }, [query, produtores]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    if (val === '') onChange('');
  };

  const handleSelect = (p) => {
    setQuery(`${p.codigo} — ${p.nome}`);
    onChange(p.codigo);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative w-full sm:w-72">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => { if (query.trim()) setOpen(true); }}
        placeholder="Digite o nome do produtor..."
        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {open && filtrados.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border bg-popover shadow-md">
          {filtrados.map(p => (
            <div
              key={p.id}
              onMouseDown={() => handleSelect(p)}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
            >
              {p.codigo} — {p.nome}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [produtorFiltro, setProdutorFiltro] = useState('');

  const { data: produtores = [] } = useQuery({ queryKey: ['produtores', 'completo'], queryFn: () => base44.entities.Produtor.list(undefined, 5000) });
  const { data: talhoes = [] } = useQuery({ queryKey: ['talhoes', 'completo'], queryFn: () => base44.entities.Talhao.list(undefined, 5000) });
  const { data: lancamentos = [] } = useQuery({ queryKey: ['lancamentos', 'dashboard'], queryFn: () => base44.entities.Lancamento.list('-data', 5000) });
  const { data: analises = [] } = useQuery({ queryKey: ['analises_solo', 'completo'], queryFn: () => base44.entities.AnaliseSolo.list(undefined, 5000) });
  const { data: planosLegados = [] } = useQuery({ queryKey: ['base_planejamento', 'completo'], queryFn: () => base44.entities.BasePlanejamentoAdubacao.list(undefined, 5000) });
  const { data: planosAdubacao2 = [] } = useQuery({ queryKey: ['planejamento_adubacao2', 'dashboard'], queryFn: () => base44.entities.PlanejamentoAdubacao2.list(undefined, 5000) });
  const { data: aplicacoesLegadas = [] } = useQuery({ queryKey: ['aplicacoes_foliares', 'completo'], queryFn: () => base44.entities.AplicacaoFoliar.list(undefined, 5000) });
  const { data: cronogramasFoliares = [] } = useQuery({ queryKey: ['cronograma_foliar', 'dashboard'], queryFn: () => base44.entities.CronogramaFoliar.list(undefined, 5000) });

  const planos = useMemo(() => normalizarPlanosAdubacao(planosLegados, planosAdubacao2), [planosLegados, planosAdubacao2]);
  const aplicacoesFoliares = useMemo(() => normalizarAplicacoesFoliares(aplicacoesLegadas, cronogramasFoliares, talhoes), [aplicacoesLegadas, cronogramasFoliares, talhoes]);

  const produtorAtivo = produtorFiltro ? produtores.find(p => p.codigo === produtorFiltro) : null;

  // Safra predominante: a mais comum entre os planos/aplicações filtrados
  const safraAtiva = useMemo(() => {
    const fonte = produtorFiltro
      ? planos.filter(p => p.codigo_produtor === produtorFiltro)
      : planos;
    if (!fonte.length) return null;
    const contagem = {};
    fonte.forEach(p => { if (p.safra) contagem[p.safra] = (contagem[p.safra] || 0) + 1; });
    return Object.entries(contagem).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }, [planos, produtorFiltro]);

  // Cards resumo
  const produtoresAtivos = produtores.filter(p => p.status !== 'inativo');
  const talhoesFiltrados = produtorFiltro ? talhoes.filter(t => t.codigo_produtor === produtorFiltro) : talhoes;
  const lancsFiltrados = produtorFiltro ? lancamentos.filter(l => l.codigo_produtor === produtorFiltro) : lancamentos;
  const analisesMap = Object.fromEntries(analises.map(a => [a.talhao_id, a]));
  const semAnalise = talhoesFiltrados.filter(t => !analisesMap[t.id]).length;
  const valorTotal = lancsFiltrados.reduce((s, l) => s + (l.valor_total || 0), 0);

  return (
    <div className="space-y-8">
      {/* Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel</h1>
          <p className="text-muted-foreground mt-1">Visão geral da colheita de café</p>
        </div>
        <ProdutorAutocomplete
          produtores={produtores}
          value={produtorFiltro}
          onChange={setProdutorFiltro}
        />
      </div>

      {/* Resumo propriedade (produtor específico) */}
      {produtorAtivo && (
        <ResumoProdutorSection
          produtor={produtorAtivo}
          talhoes={talhoes}
          lancamentos={lancamentos}
        />
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={produtorFiltro ? 'Talhões' : 'Produtores Ativos'}
          value={produtorFiltro ? talhoesFiltrados.length : produtoresAtivos.length}
          icon={produtorFiltro ? TreePine : Users}
          color="primary"
        />
        <StatCard
          title="Talhões Cadastrados"
          value={talhoesFiltrados.length}
          icon={TreePine}
          color="accent"
        />
        <StatCard
          title="Valor Total Colhido"
          value={`R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={ClipboardList}
          color="primary"
        />
        <StatCard
          title="Sem Análise de Solo"
          value={semAnalise}
          subtitle={semAnalise > 0 ? 'talhões sem dados' : 'todos com análise'}
          icon={AlertTriangle}
          color={semAnalise > 0 ? 'destructive' : 'muted'}
        />
      </div>

      {/* Seção Colheita */}
      <ColheitaProgressoSection
        produtores={produtores}
        talhoes={talhoes}
        lancamentos={lancamentos}
        filtroProdutorCodigo={produtorFiltro}
        onSelecionarProdutor={setProdutorFiltro}
      />

      {/* Seção Adubação */}
      <AdubacaoSection
        talhoes={talhoes}
        planos={planos}
        filtroProdutorCodigo={produtorFiltro}
      />

      {/* Seção Alertas */}
      <AlertasSection
        talhoes={talhoes}
        analises={analises}
        filtroProdutorCodigo={produtorFiltro}
      />

      {/* Seção Custos Planejados */}
      <CustosPlanejadosSection
        produtor={produtorAtivo}
        planos={planos}
        aplicacoesFoliares={aplicacoesFoliares}
        talhoes={talhoes}
        safra={safraAtiva}
      />
    </div>
  );
}