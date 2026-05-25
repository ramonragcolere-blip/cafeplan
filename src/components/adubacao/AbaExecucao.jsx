import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Loader2, ClipboardCheck } from 'lucide-react';

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

function calcStatus(dosePlan, doseExec, prodPlanNome, prodExecNome, mesesPlan, dataExec) {
  const statuses = [];
  if (prodPlanNome && prodExecNome && prodPlanNome !== prodExecNome) {
    statuses.push({ label: 'Produto diferente', cor: 'bg-purple-100 text-purple-700' });
  }
  const dP = parseFloat(dosePlan) || 0;
  const dE = parseFloat(doseExec) || 0;
  if (!dE) {
    statuses.push({ label: 'Não executado', cor: 'bg-muted text-muted-foreground' });
  } else {
    const pct = dP > 0 ? Math.abs((dE - dP) / dP) * 100 : 0;
    if (pct <= 5) statuses.push({ label: 'Dentro do planejado', cor: 'bg-green-100 text-green-700' });
    else if (dE < dP) statuses.push({ label: 'Abaixo', cor: 'bg-amber-100 text-amber-700' });
    else statuses.push({ label: 'Acima', cor: 'bg-orange-100 text-orange-700' });
    if (mesesPlan.length > 0 && dataExec) {
      const mesExec = getMesData(dataExec);
      if (mesExec && !mesesPlan.includes(mesExec)) {
        statuses.push({ label: 'Fora da época', cor: 'bg-red-100 text-red-700' });
      }
    }
  }
  return statuses;
}

// Chave única para identificar um registro de execução
function execKey(nutKey, parcela) {
  return `${nutKey}__${parcela ?? 1}`;
}

export default function AbaExecucao({ talhao, produtor, safra }) {
  const queryClient = useQueryClient();
  const area = talhao?.area_ha || 0;
  const numPlantas = talhao?.num_plantas || 0;
  const metros = getMetros(talhao);

  const codigoProdutor = produtor?.codigo;
  const talhaoId = talhao?.id;
  const ctxKey = `${codigoProdutor}|${safra}|${talhaoId}`;

  // Busca planejamentos da base nova
  const { data: planejamentos = [], isLoading: loadingPlan } = useQuery({
    queryKey: ['base_planejamento', ctxKey],
    queryFn: () => codigoProdutor && safra && talhaoId
      ? base44.entities.BasePlanejamentoAdubacao.filter({ codigo_produtor: codigoProdutor, safra, talhao_id: talhaoId })
      : Promise.resolve([]),
    enabled: !!(codigoProdutor && safra && talhaoId),
  });

  // Busca execuções salvas
  const { data: execucoesSalvas = [], isLoading: loadingExec } = useQuery({
    queryKey: ['base_execucao', ctxKey],
    queryFn: () => codigoProdutor && safra && talhaoId
      ? base44.entities.BaseExecucaoAdubacao.filter({ codigo_produtor: codigoProdutor, safra, talhao_id: talhaoId })
      : Promise.resolve([]),
    enabled: !!(codigoProdutor && safra && talhaoId),
  });

  // Estado local dos campos editáveis, keyed por `nutKey__parcela`
  const [campos, setCampos] = useState({});
  const [registroIds, setRegistroIds] = useState({}); // key -> id salvo

  // Carrega execuções salvas no estado local (apenas uma vez por contexto)
  useEffect(() => {
    if (loadingExec) return;
    const novoCampos = {};
    const novoIds = {};
    execucoesSalvas.forEach(e => {
      const k = execKey(e.nutriente_key, e.parcela);
      novoCampos[k] = {
        produto_exec_id: e.produto_exec_id || '',
        produto_exec_nome: e.produto_exec_nome || '',
        dose_exec_kgha: e.dose_exec_kgha != null ? String(e.dose_exec_kgha) : '',
        qtd_aplicada_kg: e.qtd_aplicada_kg != null ? String(e.qtd_aplicada_kg) : '',
        data_aplicacao: e.data_aplicacao || '',
        responsavel: e.responsavel || '',
        observacoes: e.observacoes || '',
      };
      novoIds[k] = e.id;
    });
    setCampos(novoCampos);
    setRegistroIds(novoIds);
  }, [execucoesSalvas, loadingExec, ctxKey]);

  // Busca produtos para o seletor
  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples = [] } = useQuery({ queryKey: ['fontes_simples'], queryFn: () => base44.entities.FonteSimples.list() });
  const todosProdutos = useMemo(() => [
    ...fertilizantes.map(f => ({ ...f, _tipo: 'formulado' })),
    ...fontesSimples.map(f => ({ ...f, _tipo: 'fonte' })),
  ], [fertilizantes, fontesSimples]);

  const getCampo = (k) => campos[k] || { produto_exec_id: '', produto_exec_nome: '', dose_exec_kgha: '', qtd_aplicada_kg: '', data_aplicacao: '', responsavel: '', observacoes: '' };
  const setCampo = (k, field, value) => setCampos(prev => ({ ...prev, [k]: { ...getCampo(k), [field]: value } }));

  const { mutate: salvarLinha, isPending: salvando } = useMutation({
    mutationFn: async ({ plano, parcela, c }) => {
      const mesesPlan = getMesesDoPlano(plano.meses);
      const dosePlan = parseFloat(plano.dose_rec_manual) || 0;
      const doseExec = parseFloat(c.dose_exec_kgha) || 0;
      const prodExecObj = todosProdutos.find(p => p.id === c.produto_exec_id);

      const status = !doseExec ? 'nao_executado'
        : Math.abs((doseExec - dosePlan) / (dosePlan || 1)) <= 0.05 ? 'executado'
        : 'parcial';

      const payload = {
        codigo_produtor: codigoProdutor,
        safra,
        talhao_id: talhaoId,
        talhao_nome: talhao?.nome || '',
        nutriente_key: plano.nutriente_key,
        nutriente_label: plano.nutriente_label || plano.nutriente_key,
        parcela: parcela ?? 1,
        produto_plan_id: plano.produto_id || '',
        produto_plan_nome: plano.produto_nome || '',
        dose_plan_kgha: dosePlan,
        produto_exec_id: c.produto_exec_id || '',
        produto_exec_nome: prodExecObj?.nome || c.produto_exec_nome || '',
        dose_exec_kgha: doseExec || null,
        qtd_aplicada_kg: parseFloat(c.qtd_aplicada_kg) || null,
        data_aplicacao: c.data_aplicacao || null,
        responsavel: c.responsavel || '',
        observacoes: c.observacoes || '',
        status,
      };

      const k = execKey(plano.nutriente_key, parcela ?? 1);
      const existeId = registroIds[k];
      if (existeId) {
        return { res: await base44.entities.BaseExecucaoAdubacao.update(existeId, payload), k };
      } else {
        return { res: await base44.entities.BaseExecucaoAdubacao.create(payload), k };
      }
    },
    onSuccess: ({ res, k }) => {
      if (res?.id) setRegistroIds(prev => ({ ...prev, [k]: res.id }));
      queryClient.invalidateQueries({ queryKey: ['base_execucao', ctxKey] });
    },
  });

  const handleSalvarLinha = (plano, parcela) => {
    const k = execKey(plano.nutriente_key, parcela ?? 1);
    salvarLinha({ plano, parcela, c: getCampo(k) });
  };

  if (!talhao || !codigoProdutor || !safra) {
    return <div className="text-center py-12 text-muted-foreground">Selecione um talhão para registrar a execução.</div>;
  }

  if (loadingPlan || loadingExec) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Carregando dados...</span>
      </div>
    );
  }

  if (planejamentos.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground">
        <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="font-medium">Nenhum planejamento encontrado</p>
        <p className="text-xs mt-1">Acesse a aba Planejamento e salve os produtos desejados.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 bg-green-50 border-b border-border">
        <ClipboardCheck className="w-4 h-4 text-green-700" />
        <span className="font-semibold text-sm text-green-800">Execução de Aplicações — {talhao.nome}</span>
      </div>

      <div className="divide-y divide-border">
        {planejamentos.map((plano) => {
          // Para calagem ou planejamentos de parcela única, parcela = 1
          const numAplic = plano.num_aplic || 1;
          const parcelas = Array.from({ length: numAplic }, (_, i) => i + 1);

          return parcelas.map((parcela) => {
            const k = execKey(plano.nutriente_key, parcela);
            const c = getCampo(k);
            const mesesPlan = getMesesDoPlano(plano.meses);
            const dosePlanHa = parseFloat(plano.dose_rec_manual) || 0;
            const pctParcela = plano.pcts?.[parcela - 1] ?? (100 / numAplic);
            const doseParcHa = dosePlanHa > 0 ? Math.round((dosePlanHa * pctParcela) / 100 * 10) / 10 : dosePlanHa;
            const totalPlan = doseParcHa && area > 0 ? Math.round(doseParcHa * area) : null;
            const gPlantaPlan = totalPlan && numPlantas > 0 ? ((totalPlan * 1000) / numPlantas).toFixed(1) : null;
            const gMetroPlan = totalPlan && metros > 0 ? ((totalPlan * 1000) / metros).toFixed(1) : null;
            const mesesParcela = plano.meses?.[parcela - 1] || mesesPlan;

            const doseExecHa = parseFloat(c.dose_exec_kgha) || 0;
            const totalExec = doseExecHa && area > 0 ? Math.round(doseExecHa * area) : null;
            const gPlantaExec = totalExec && numPlantas > 0 ? ((totalExec * 1000) / numPlantas).toFixed(1) : null;
            const gMetroExec = totalExec && metros > 0 ? ((totalExec * 1000) / metros).toFixed(1) : null;

            const statuses = calcStatus(doseParcHa, doseExecHa, plano.produto_nome, c.produto_exec_nome || plano.produto_nome, mesesParcela, c.data_aplicacao);

            return (
              <div key={k} className="p-5 space-y-4">
                {/* Cabeçalho */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-primary text-base">{plano.nutriente_label || plano.nutriente_key}</span>
                  {numAplic > 1 && <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Parcela {parcela}/{numAplic} ({pctParcela}%)</span>}
                  <div className="flex flex-wrap gap-1.5">
                    {statuses.map((s, i) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cor}`}>{s.label}</span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Planejado */}
                  <div className="bg-muted/30 rounded-xl p-4 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Planejado</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Produto</span>
                        <span className="font-medium text-right max-w-[200px] truncate">{plano.produto_nome || <em className="text-muted-foreground">Nenhum</em>}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Dose</span>
                        <span className="font-medium">{doseParcHa ? `${doseParcHa} kg/ha` : '—'}</span>
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
                        <span className="text-muted-foreground">Nº aplicações</span>
                        <span className="font-medium">{numAplic}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Meses</span>
                        <span className="font-medium">{Array.isArray(mesesParcela) && mesesParcela.length > 0 ? mesesParcela.join(', ') : '—'}</span>
                      </div>
                      {plano.observacoes && (
                        <div className="pt-1 text-xs text-muted-foreground border-t border-border/40">{plano.observacoes}</div>
                      )}
                    </div>
                  </div>

                  {/* Executado */}
                  <div className="bg-green-50/60 rounded-xl p-4 space-y-2 border border-green-100">
                    <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-2">Executado</p>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-0.5">Produto aplicado</label>
                        <Input
                          value={c.produto_exec_nome}
                          onChange={e => setCampo(k, 'produto_exec_nome', e.target.value)}
                          className="h-8 text-sm"
                          placeholder={plano.produto_nome || 'Nome do produto...'}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-0.5">Dose aplicada (kg/ha)</label>
                        <Input type="number" value={c.dose_exec_kgha}
                          onChange={e => setCampo(k, 'dose_exec_kgha', e.target.value)}
                          className="h-8 text-sm" placeholder="kg/ha" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-0.5">Quantidade aplicada (kg total)</label>
                        <Input type="number" value={c.qtd_aplicada_kg}
                          onChange={e => setCampo(k, 'qtd_aplicada_kg', e.target.value)}
                          className="h-8 text-sm" placeholder="kg" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-white rounded-lg p-2 text-center border border-green-100">
                          <p className="text-xs text-muted-foreground">Total calc.</p>
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
                        <Input type="date" value={c.data_aplicacao}
                          onChange={e => setCampo(k, 'data_aplicacao', e.target.value)}
                          className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-0.5">Responsável</label>
                        <Input value={c.responsavel}
                          onChange={e => setCampo(k, 'responsavel', e.target.value)}
                          className="h-8 text-sm" placeholder="Nome..." />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-0.5">Observações da execução</label>
                        <Input value={c.observacoes}
                          onChange={e => setCampo(k, 'observacoes', e.target.value)}
                          className="h-8 text-sm" placeholder="Obs..." />
                      </div>
                      <div className="pt-1">
                        <Button size="sm" className="w-full gap-2" onClick={() => handleSalvarLinha(plano, parcela)} disabled={salvando}>
                          {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Salvar execução
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}