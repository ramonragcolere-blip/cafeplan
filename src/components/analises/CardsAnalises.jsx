import React from 'react';
import { Sprout, Layers, Tag, MapPin, DollarSign, Calculator, Crown, Trophy, AlertTriangle } from 'lucide-react';
import { fmtR, fmtNum } from '@/components/analises/helpers';

// Cards de resumo no topo da aba. Variam conforme o modo.
export default function CardsAnalises({ modo, cards }) {
  if (modo === 'aplicacoes') {
    const c = cards || {};
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card icon={Sprout} label="Total de aplicações" value={fmtNum(c.totalAplicacoes)} tone="primary" />
          <Card icon={Layers} label="Produtos utilizados" value={fmtNum(c.produtosUtilizados)} tone="accent" />
          <Card icon={Tag} label="Categorias utilizadas" value={fmtNum(c.categoriasUtilizadas)} tone="green" />
          <Card icon={MapPin} label="Área estimada aplicada" value={c.areaEstimada != null ? `${fmtNum(c.areaEstimada)} ha` : '—'} tone="blue" />
        </div>
        {c.semDose > 0 && (
          <Aviso icon={AlertTriangle} tone="amber">
            {c.semDose} {c.semDose === 1 ? 'aplicação sem dose/ha cadastrada' : 'aplicações sem dose/ha cadastrada'} — não entram na área estimada.
          </Aviso>
        )}
      </div>
    );
  }
  const c = cards || {};
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card icon={DollarSign} label="Custo total" value={fmtR(c.custoTotal)} tone="primary" />
        <Card icon={Calculator} label="Custo médio por aplicação" value={fmtR(c.custoMedio)} tone="accent" />
        <Card icon={Crown} label="Produto com maior custo" value={c.produtoMaiorCusto ? c.produtoMaiorCusto.nome : '—'} sub={c.produtoMaiorCusto ? fmtR(c.produtoMaiorCusto.valor) : null} tone="green" />
        <Card icon={Trophy} label="Categoria com maior custo" value={c.categoriaMaiorCusto ? c.categoriaMaiorCusto.nome : '—'} sub={c.categoriaMaiorCusto ? fmtR(c.categoriaMaiorCusto.valor) : null} tone="blue" />
      </div>
      {c.semPreco > 0 && (
        <Aviso icon={AlertTriangle} tone="amber">
          {c.semPreco} {c.semPreco === 1 ? 'aplicação sem custo calculável' : 'aplicações sem custo calculável'} — preço não identificado nas NFs.
        </Aviso>
      )}
    </div>
  );
}

function Card({ icon: Icon, label, value, sub, tone }) {
  const tones = {
    primary: 'text-primary', accent: 'text-accent', green: 'text-green-700', blue: 'text-blue-700',
  };
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${tones[tone] || 'text-primary'}`} />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-xl font-bold text-foreground truncate">{value}</p>
      {sub && <p className="text-sm font-semibold text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Aviso({ icon: Icon, tone, children }) {
  const tones = { amber: 'bg-amber-50 border-amber-200 text-amber-800' };
  return (
    <div className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-xs ${tones[tone] || 'bg-muted text-muted-foreground'}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}