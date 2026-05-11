import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function ProducerProgressTable({ produtores, talhoes, lancamentos }) {
  const produtorStats = produtores.map(p => {
    const pTalhoes = talhoes.filter(t => t.codigo_produtor === p.codigo);
    const pLancs = lancamentos.filter(l => l.codigo_produtor === p.codigo);
    
    const totalMedidas = pTalhoes.reduce((sum, t) => {
      if (!t.litros_por_pe || !t.num_plantas) return sum;
      return sum + (t.litros_por_pe * t.num_plantas * (t.pct_colher || 1)) / (p.ref_medida_litros || 60);
    }, 0);
    
    const colhidas = pLancs.reduce((sum, l) => sum + (l.medidas_colhidas || 0), 0);
    const pct = totalMedidas > 0 ? (colhidas / totalMedidas) * 100 : 0;

    return { ...p, totalMedidas, colhidas, pct, totalTalhoes: pTalhoes.length };
  });

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="p-6 border-b border-border">
        <h3 className="font-semibold text-lg">Progresso por Produtor</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cód.</TableHead>
              <TableHead>Produtor</TableHead>
              <TableHead>Fazenda</TableHead>
              <TableHead className="text-right">Talhões</TableHead>
              <TableHead className="text-right">Medidas Prev.</TableHead>
              <TableHead className="text-right">Colhidas</TableHead>
              <TableHead className="w-40">Progresso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {produtorStats.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell className="text-muted-foreground">{p.fazenda}</TableCell>
                <TableCell className="text-right">{p.totalTalhoes}</TableCell>
                <TableCell className="text-right font-medium">{p.totalMedidas.toFixed(0)}</TableCell>
                <TableCell className="text-right font-medium">{p.colhidas.toFixed(1)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={Math.min(p.pct, 100)} className="h-2" />
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {p.pct.toFixed(0)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}