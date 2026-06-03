import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, TreePine, ClipboardList, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatCard from '@/components/dashboard/StatCard';
import ColheitaProgressoSection from '@/components/dashboard/ColheitaProgressoSection';
import AdubacaoSection from '@/components/dashboard/AdubacaoSection';
import AlertasSection from '@/components/dashboard/AlertasSection';
import ResumoProdutorSection from '@/components/dashboard/ResumoProdutorSection';

export default function Dashboard() {
  const [produtorFiltro, setProdutorFiltro] = useState('');

  const { data: produtores = [] } = useQuery({ queryKey: ['produtores'], queryFn: () => base44.entities.Produtor.list() });
  const { data: talhoes = [] } = useQuery({ queryKey: ['talhoes'], queryFn: () => base44.entities.Talhao.list() });
  const { data: lancamentos = [] } = useQuery({ queryKey: ['lancamentos'], queryFn: () => base44.entities.Lancamento.list() });
  const { data: analises = [] } = useQuery({ queryKey: ['analises_solo'], queryFn: () => base44.entities.AnaliseSolo.list() });
  const { data: planos = [] } = useQuery({ queryKey: ['base_planejamento'], queryFn: () => base44.entities.BasePlanejamentoAdubacao.list() });

  const produtorAtivo = produtorFiltro ? produtores.find(p => p.codigo === produtorFiltro) : null;

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
        <div className="w-full sm:w-72">
          <Select value={produtorFiltro} onValueChange={setProdutorFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os produtores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Todos os produtores</SelectItem>
              {produtores.map(p => (
                <SelectItem key={p.id} value={p.codigo}>{p.codigo} — {p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
    </div>
  );
}