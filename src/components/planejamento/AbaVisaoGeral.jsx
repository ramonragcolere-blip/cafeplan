import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calcularCustoAdubacaoHa } from '@/lib/integracaoPlanejamentos';

const fmt = (v, dec = 0) => v != null ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—';
const fmtR = (v, dec = 0) => v != null ? `R$ ${fmt(v, dec)}` : '—';

export default function AbaVisaoGeral({ talhoes, produtor, safra, planejamentosAdubacao }) {
  const { data: operacoes = [] } = useQuery({
    queryKey: ['plan_operacoes', produtor?.codigo, safra],
    queryFn: () => base44.entities.PlanejamentoOperacoes.filter({ codigo_produtor: produtor?.codigo, safra }),
    enabled: !!produtor?.codigo,
  });

  const { data: posColheitas = [] } = useQuery({
    queryKey: ['plan_pos', produtor?.codigo, safra],
    queryFn: () => base44.entities.PlanejamentoPosColheita.filter({ codigo_produtor: produtor?.codigo, safra }),
    enabled: !!produtor?.codigo,
  });

  const rows = useMemo(() => talhoes.map(t => {
    // Custo adubação: somar custo total dos planejamentos de adubação do talhão
    const planAdub = planejamentosAdubacao.filter(p => p.talhao_id === t.id);
    const custoAdubRha = planAdub.reduce((soma, plano) => soma + calcularCustoAdubacaoHa(plano), 0);

    // Custo operações
    const ops = operacoes.filter(o => o.talhao_id === t.id);
    const custoOpsRha = ops.reduce((s, o) => s + (Number(o.custo_total_rha) || 0), 0);

    // Custo pós-colheita
    const pos = posColheitas.find(p => p.talhao_id === t.id);
    const prodSc = pos?.prod_estimada_sc || 0;
    const custoPosTotalR = (pos?.lavagem_custo_r || 0) + (pos?.secagem_custo_r || 0) +
      ((pos?.beneficio_r_saca || 0) + (pos?.armazenagem_r_saca || 0) + (pos?.outros_r_saca || 0)) * prodSc;
    const custoPosha = t.area_ha ? custoPosTotalR / t.area_ha : 0;

    const custoTotal = custoAdubRha + custoOpsRha + custoPosha;
    const prodEstimada = t.litros_por_pe && t.num_plantas ? (t.litros_por_pe * t.num_plantas) / (t.area_ha * 60 || 1) : null;
    const custoSaca = prodEstimada ? custoTotal / prodEstimada : null;

    return { t, custoAdubRha, custoOpsRha, custoPosha, custoTotal, prodEstimada, custoSaca };
  }), [talhoes, planejamentosAdubacao, operacoes, posColheitas]);

  const totArea = talhoes.reduce((s, t) => s + (t.area_ha || 0), 0);
  const totProd = rows.reduce((s, r) => s + (r.prodEstimada && r.t.area_ha ? r.prodEstimada * r.t.area_ha : 0), 0);
  const totCustoR = rows.reduce((s, r) => s + (r.custoTotal * (r.t.area_ha || 0)), 0);
  const mediaCustoHa = totArea ? totCustoR / totArea : 0;
  const mediaCustoSaca = totProd ? totCustoR / totProd : 0;

  return (
    <div className="space-y-6 mt-4">
      {/* Cards métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Área total', value: `${fmt(totArea, 1)} ha` },
          { label: 'Prod. estimada total', value: `${fmt(totProd, 0)} sc` },
          { label: 'Custo total fazenda', value: fmtR(totCustoR, 0) },
          { label: 'Custo médio/ha', value: fmtR(mediaCustoHa, 0) },
          { label: 'Custo médio/saca', value: fmtR(mediaCustoSaca, 2) },
        ].map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4 space-y-1">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="font-bold text-lg">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Talhão</TableHead>
                <TableHead className="text-right">Área (ha)</TableHead>
                <TableHead className="text-right">Prod. est. (sc/ha)</TableHead>
                <TableHead className="text-right">Custo Adub. (R$/ha)</TableHead>
                <TableHead className="text-right">Custo Oper. (R$/ha)</TableHead>
                <TableHead className="text-right">Custo Pós-Col. (R$/ha)</TableHead>
                <TableHead className="text-right">Custo Total (R$/ha)</TableHead>
                <TableHead className="text-right">Custo/saca</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum talhão cadastrado</TableCell></TableRow>
              ) : rows.map(({ t, custoAdubRha, custoOpsRha, custoPosha, custoTotal, prodEstimada, custoSaca }) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.nome}</TableCell>
                  <TableCell className="text-right">{fmt(t.area_ha, 1)}</TableCell>
                  <TableCell className="text-right">{fmt(prodEstimada, 1)}</TableCell>
                  <TableCell className="text-right">{fmtR(custoAdubRha, 0)}</TableCell>
                  <TableCell className="text-right">{fmtR(custoOpsRha, 0)}</TableCell>
                  <TableCell className="text-right">{fmtR(custoPosha, 0)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtR(custoTotal, 0)}</TableCell>
                  <TableCell className="text-right">{fmtR(custoSaca, 2)}</TableCell>
                </TableRow>
              ))}
              {rows.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>TOTAL FAZENDA</TableCell>
                  <TableCell className="text-right">{fmt(totArea, 1)}</TableCell>
                  <TableCell className="text-right">{fmt(totArea ? totProd / totArea : null, 1)}</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">{fmtR(mediaCustoHa, 0)}</TableCell>
                  <TableCell className="text-right">{fmtR(mediaCustoSaca, 2)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}