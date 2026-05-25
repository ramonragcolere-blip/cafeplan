import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Loader2, ClipboardCheck } from 'lucide-react';

const NUTRIENTES_CHAVE = [
  { key: 'n_pct',    label: 'N'    },
  { key: 'p2o5_pct', label: 'P₂O₅' },
  { key: 'k2o_pct',  label: 'K₂O'  },
  { key: 'b_pct',    label: 'B'    },
];

function getMetros(talhao) {
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',', '.')));
  const linhaM = partes?.[0] || 0;
  if (talhao?.num_plantas && linhaM > 0) return talhao.num_plantas * linhaM;
  if (talhao?.area_ha && linhaM > 0) return Math.round((talhao.area_ha * 10000) / linhaM);
  return 0;
}

function getMesesDoPlano(meses) {
  if (!meses) return [];
  const flat = [];
  meses.forEach(m => {
    if (Array.isArray(m)) flat.push(...m);
    else if (m) flat.push(m);
  });
  return flat.filter(Boolean);
}

function getMesData(dataStr) {
  if (!dataStr) return null;
  const meses = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  const d = new Date(dataStr + 'T00:00:00');
  if (isNaN(d)) return null;
  return meses[d.getMonth()];
}

function calcStatus(plan, exec, prodPlan, prodExec, mesesPlan, dataExec) {
  const statuses = [];

  // Produto diferente
  if (prodPlan && prodExec && prodPlan !== prodExec) statuses.push({ label: 'Produto diferente', cor: 'bg-purple-100 text-purple-700' });

  // Dose
  const doseP = parseFloat(plan) || 0;
  const doseE = parseFloat(exec) || 0;
  if (!doseE) {
    statuses.push({ label: 'Não executado', cor: 'bg-muted text-muted-foreground' });
  } else {
    const pct = doseP > 0 ? Math.abs((doseE - doseP) / doseP) * 100 : 0;
    if (pct <= 5) statuses.push({ label: 'Dentro do planejado', cor: 'bg-green-100 text-green-700' });
    else if (doseE < doseP) statuses.push({ label: 'Abaixo', cor: 'bg-amber-100 text-amber-700' });
    else statuses.push({ label: 'Acima', cor: 'bg-orange-100 text-orange-700' });

    // Época
    if (mesesPlan.length > 0 && dataExec) {
      const mesExec = getMesData(dataExec);
      if (mesExec && !mesesPlan.includes(mesExec)) {
        statuses.push({ label: 'Fora da época', cor: 'bg-red-100 text-red-700' });
      }
    }
  }

  return statuses;
}

export default function AbaExecucao({ talhao, plano, onSave, saving }) {
  const [execucoes, setExecucoes] = useState({});

  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples = [] } = useQuery({ queryKey: ['fontes_simples'], queryFn: () => base44.entities.FonteSimples.list() });

  const todosProdutos = useMemo(() => [
    ...fertilizantes.map(f => ({ ...f, _tipo: 'formulado' })),
    ...fontesSimples.map(f => ({ ...f, _tipo: 'fonte' })),
  ], [fertilizantes, fontesSimples]);

  useEffect(() => {
    setExecucoes(plano?.execucoes_nutrientes || {});
  }, [plano?.id]);

  const planejamento = plano?.planejamento_nutrientes || {};
  const area = talhao?.area_ha || 0;
  const numPlantas = talhao?.num_plantas || 0;
  const metros = getMetros(talhao);

  // Linhas do planejamento que têm produto ou dose manual
  const linhasPlano = useMemo(() =>
    NUTRIENTES_CHAVE
      .map(n => ({ ...n, linha: planejamento[n.key] }))
      .filter(n => n.linha && (n.linha.produtoId || n.linha.doseRecManual)),
    [planejamento]
  );

  const getExec = (nutKey) => execucoes[nutKey] || { dose_exec_kgha: '', data_aplicacao: '', responsavel: '', produto_exec_id: '', observacoes: '' };
  const setExec = (nutKey, campo, valor) => {
    setExecucoes(prev => ({ ...prev, [nutKey]: { ...getExec(nutKey), [campo]: valor } }));
  };

  const handleSave = () => onSave({ execucoes_nutrientes: execucoes });

  if (!talhao || !plano) return (
    <div className="text-center py-12 text-muted-foreground">Selecione um talhão com planejamento salvo.</div>
  );

  if (linhasPlano.length === 0) return (
    <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground">
      <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p>Nenhum nutriente planejado encontrado.</p>
      <p className="text-xs mt-1">Acesse a aba Planejamento e salve os produtos desejados.</p>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 bg-green-50 border-b border-border">
        <ClipboardCheck className="w-4 h-4 text-green-700" />
        <span className="font-semibold text-sm text-green-800">Execução de Aplicações — {talhao.nome}</span>
      </div>

      <div className="divide-y divide-border">
        {linhasPlano.map(({ key, label, linha }) => {
          const prodPlan = todosProdutos.find(p => p.id === linha.produtoId);
          const ex = getExec(key);

          // Dose planejada de produto (kg produto/ha)
          const doseRec = linha.doseRecManual !== '' ? parseFloat(linha.doseRecManual) : null;
          // Calcula dose produto/ha a partir do nutriente
          const pctNut = prodPlan ? parseFloat(prodPlan[key]) || 0 : 0;
          const doseProdHaPlan = prodPlan && doseRec && pctNut > 0
            ? Math.round((doseRec / (pctNut / 100)) * 10) / 10
            : doseRec; // fallback: usa dose do nutriente

          const totalPlan = doseProdHaPlan && area > 0 ? Math.round(doseProdHaPlan * area) : null;
          const gPlantaPlan = totalPlan && numPlantas > 0 ? ((totalPlan * 1000) / numPlantas).toFixed(1) : null;
          const gMetroPlan = totalPlan && metros > 0 ? ((totalPlan * 1000) / metros).toFixed(1) : null;
          const mesesPlan = getMesesDoPlano(linha.meses);

          // Execução
          const doseExecHa = parseFloat(ex.dose_exec_kgha) || null;
          const totalExec = doseExecHa && area > 0 ? Math.round(doseExecHa * area) : null;
          const gPlantaExec = totalExec && numPlantas > 0 ? ((totalExec * 1000) / numPlantas).toFixed(1) : null;
          const gMetroExec = totalExec && metros > 0 ? ((totalExec * 1000) / metros).toFixed(1) : null;
          const prodExec = todosProdutos.find(p => p.id === ex.produto_exec_id);

          const statuses = calcStatus(doseProdHaPlan, doseExecHa, linha.produtoId, ex.produto_exec_id || linha.produtoId, mesesPlan, ex.data_aplicacao);

          return (
            <div key={key} className="p-5 space-y-4">
              {/* Cabeçalho nutriente */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-primary text-base w-12">{label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {statuses.map((s, i) => (
                    <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cor}`}>{s.label}</span>
                  ))}
                </div>
              </div>

              {/* Comparativo planejado × executado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Coluna planejado */}
                <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Planejado</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Produto</span>
                      <span className="font-medium text-right max-w-[200px] truncate">
                        {linha.produtoId === null ? <em className="text-muted-foreground">Nenhum</em> : (prodPlan?.nome || '—')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dose produto</span>
                      <span className="font-medium">{doseProdHaPlan ? `${doseProdHaPlan} kg/ha` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-medium">{totalPlan ? `${totalPlan} kg` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">g/planta</span>
                      <span className="font-medium">{gPlantaPlan ? `${gPlantaPlan} g` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">g/metro</span>
                      <span className="font-medium">{gMetroPlan ? `${gMetroPlan} g` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Meses</span>
                      <span className="font-medium">{mesesPlan.length > 0 ? mesesPlan.join(', ') : '—'}</span>
                    </div>
                    {linha.observacoes && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Obs.</span>
                        <span className="text-xs text-right max-w-[200px]">{linha.observacoes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Coluna executado */}
                <div className="bg-green-50/60 rounded-xl p-4 space-y-2 border border-green-100">
                  <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-2">Executado</p>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-0.5">Dose produto (kg/ha)</label>
                      <Input type="number" value={ex.dose_exec_kgha}
                        onChange={e => setExec(key, 'dose_exec_kgha', e.target.value)}
                        className="h-8 text-sm" placeholder="kg/ha" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-white rounded-lg p-2 text-center border border-green-100">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-semibold">{totalExec ? `${totalExec} kg` : '—'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center border border-green-100">
                        <p className="text-xs text-muted-foreground">g/planta</p>
                        <p className="font-semibold">{gPlantaExec ? `${gPlantaExec} g` : '—'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center border border-green-100">
                        <p className="text-xs text-muted-foreground">g/metro</p>
                        <p className="font-semibold">{gMetroExec ? `${gMetroExec} g` : '—'}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-0.5">Data de aplicação</label>
                      <Input type="date" value={ex.data_aplicacao}
                        onChange={e => setExec(key, 'data_aplicacao', e.target.value)}
                        className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-0.5">Responsável</label>
                      <Input value={ex.responsavel}
                        onChange={e => setExec(key, 'responsavel', e.target.value)}
                        className="h-8 text-sm" placeholder="Nome..." />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-0.5">Observações</label>
                      <Input value={ex.observacoes}
                        onChange={e => setExec(key, 'observacoes', e.target.value)}
                        className="h-8 text-sm" placeholder="Obs..." />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-border flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Execução
        </Button>
      </div>
    </div>
  );
}