import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, TreePine, ClipboardList, Package } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import ProducerProgressTable from '../components/dashboard/ProducerProgressTable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(142,40%,32%)', 'hsl(28,60%,50%)', 'hsl(35,30%,55%)', 'hsl(200,45%,45%)', 'hsl(0,72%,51%)'];

export default function Dashboard() {
  const { data: produtores = [] } = useQuery({ queryKey: ['produtores'], queryFn: () => base44.entities.Produtor.list() });
  const { data: talhoes = [] } = useQuery({ queryKey: ['talhoes'], queryFn: () => base44.entities.Talhao.list() });
  const { data: lancamentos = [] } = useQuery({ queryKey: ['lancamentos'], queryFn: () => base44.entities.Lancamento.list() });
  const { data: safristas = [] } = useQuery({ queryKey: ['safristas'], queryFn: () => base44.entities.Safrista.list() });

  const totalMedidas = talhoes.reduce((sum, t) => {
    if (!t.litros_por_pe || !t.num_plantas) return sum;
    const prod = produtores.find((p) => p.codigo === t.codigo_produtor);
    const ref = prod?.ref_medida_litros || 60;
    return sum + t.litros_por_pe * t.num_plantas * (t.pct_colher || 1) / ref;
  }, 0);

  const totalColhidas = lancamentos.reduce((sum, l) => sum + (l.medidas_colhidas || 0), 0);
  const totalValor = lancamentos.reduce((sum, l) => sum + (l.valor_total || 0), 0);

  // Colheita por método
  const metodoCounts = {};
  talhoes.forEach((t) => {
    if (t.metodo_colheita) {
      metodoCounts[t.metodo_colheita] = (metodoCounts[t.metodo_colheita] || 0) + 1;
    }
  });
  const metodoData = Object.entries(metodoCounts).map(([name, value]) => ({ name, value }));

  // Top 5 produtores por medidas
  const topProdutores = produtores.map((p) => {
    const pLancs = lancamentos.filter((l) => l.codigo_produtor === p.codigo);
    const total = pLancs.reduce((s, l) => s + (l.medidas_colhidas || 0), 0);
    return { name: p.nome?.split(' ').slice(0, 2).join(' '), medidas: total };
  }).sort((a, b) => b.medidas - a.medidas).slice(0, 5).filter((p) => p.medidas > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel</h1>
        <p className="text-muted-foreground mt-1">Visão geral da colheita de café</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Produtores" value={produtores.length} icon={Users} color="primary" />
        <StatCard title="Talhões" value={talhoes.length} icon={TreePine} color="accent" />
        <StatCard title="Medidas Previstas" value={totalMedidas.toFixed(0)} subtitle={`${totalColhidas.toFixed(0)} colhidas`} icon={Package} color="muted" />
        <StatCard title="Valor Colhido" value={`R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={ClipboardList} color="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {metodoData.length > 0 &&
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <h3 className="font-semibold text-lg mb-4">Talhões por Método de Colheita</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={metodoData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {metodoData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        }

        {topProdutores.length > 0 &&
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <h3 className="font-semibold text-lg mb-4">Top Produtores — Medidas Colhidas</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topProdutores}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="medidas" fill="hsl(142,40%,32%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        }
      </div>

      {produtores.length > 0 &&
      <ProducerProgressTable produtores={produtores} talhoes={talhoes} lancamentos={lancamentos} />
      }

      {produtores.length === 0 &&
      <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum dado cadastrado</h3>
          <p className="text-muted-foreground text-sm">Comece cadastrando produtores para ver os dados aqui.</p>
        </div>
      }
    </div>);

}