import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function Card({ label, value, sub }) {
  return (
    <div className="bg-primary/5 border border-primary/15 rounded-xl text-center px-1 py-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold mt-1 text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>);

}

function fmt(n, decimals = 0) {
  if (!n || isNaN(n)) return '0';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(d) {
  if (!d) return '—';
  try {return format(new Date(d), 'dd/MM/yyyy', { locale: ptBR });} catch {return '—';}
}

export default function ResumoProdutor({ planejamento }) {
  const {
    totalLitros, totalMedidas, totalDias, totalSemanas,
    totalSacas, totalCusto, dataInicioProdutor, dataFimGeral
  } = planejamento;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
        📊 Resumo do Produtor
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card label="Litros Totais" value={fmt(totalLitros)} sub="L" />
        <Card label="Medidas Prev." value={fmt(totalMedidas, 1)} sub="medidas" />
        <Card label="Dias Nec." value={fmt(totalDias, 1)} sub="dias" />
        <Card label="Semanas" value={fmt(totalSemanas, 1)} sub="semanas" />
        <Card label="Sacas Est." value={fmt(totalSacas, 1)} sub="60 kg" />
        <Card label="Custo Prev." value={`R$ ${fmt(totalCusto, 2)}`} />
        <Card label="Data Início" value={fmtDate(dataInicioProdutor)} />
        <Card label="Data Fim Est." value={fmtDate(dataFimGeral)} />
      </div>
    </div>);

}