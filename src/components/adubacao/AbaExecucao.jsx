import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Loader2, ClipboardCheck } from 'lucide-react';

const APLICACOES = ['1ª', '2ª', '3ª'];

function getMetros(talhao) {
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',', '.')));
  const linhaM = partes?.[0] || 0;
  if (talhao?.num_plantas && linhaM > 0) return talhao.num_plantas * linhaM;
  if (talhao?.area_ha && linhaM > 0) return Math.round((talhao.area_ha * 10000) / linhaM);
  return 0;
}

function indicadorDif(planejado, executado) {
  const plan = parseFloat(planejado) || 0;
  const exec = parseFloat(executado) || 0;
  if (!plan) return null;
  if (!exec) return { label: '🕐', cor: 'text-muted-foreground', texto: 'Não executado' };
  const pct = Math.abs((exec - plan) / plan) * 100;
  const diff = exec - plan;
  if (pct <= 5) return { label: '✅', cor: 'text-green-600', texto: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} kg/ha` };
  if (pct <= 20) return { label: '⚠️', cor: 'text-amber-600', texto: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} kg/ha (${pct.toFixed(0)}%)` };
  return { label: '🔴', cor: 'text-red-600', texto: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} kg/ha (${pct.toFixed(0)}%)` };
}

export default function AbaExecucao({ talhao, plano, onSave, saving }) {
  const [aplicacaoSel, setAplicacaoSel] = useState('1ª');
  const [execucoes, setExecucoes] = useState({});

  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples = [] } = useQuery({ queryKey: ['fontes_simples'], queryFn: () => base44.entities.FonteSimples.list() });

  const todosProdutos = useMemo(() => [
    ...fertilizantes.map(f => ({ ...f, _tipo: 'formulado' })),
    ...fontesSimples.map(f => ({ ...f, _tipo: 'fonte' })),
  ], [fertilizantes, fontesSimples]);

  // Hidratar execuções salvas
  useEffect(() => {
    setExecucoes(plano?.execucoes || {});
  }, [plano?.id]);

  // Produtos planejados para a aplicação selecionada
  const linhasPlano = useMemo(() =>
    (plano?.plano_aplicacoes || []).filter(l => l.aplicacao === aplicacaoSel && l.produto_id),
    [plano, aplicacaoSel]);

  const area = talhao?.area_ha || 0;
  const numPlantas = talhao?.num_plantas || 0;
  const metros = getMetros(talhao);

  const chave = (produto_id) => `${produto_id}__${aplicacaoSel}`;

  const getExec = (produto_id) => execucoes[chave(produto_id)] || { dose_exec_kgha: '', data_aplicacao: '', responsavel: '', observacoes: '' };
  const setExec = (produto_id, campo, valor) => {
    setExecucoes(prev => ({
      ...prev,
      [chave(produto_id)]: { ...getExec(produto_id), [campo]: valor },
    }));
  };

  const handleSave = () => onSave({ execucoes });

  if (!talhao || !plano) return (
    <div className="text-center py-12 text-muted-foreground">Selecione um talhão com planejamento salvo.</div>
  );

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 bg-green-50 border-b border-border">
        <ClipboardCheck className="w-4 h-4 text-green-700" />
        <span className="font-semibold text-sm text-green-800">Execução de Aplicações</span>
        <div className="flex gap-1 ml-auto">
          {APLICACOES.map(a => (
            <button key={a} type="button"
              onClick={() => setAplicacaoSel(a)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${aplicacaoSel === a ? 'bg-green-700 text-white border-green-700' : 'bg-white text-muted-foreground border-border hover:bg-muted/30'}`}>
              {a} Aplicação
            </button>
          ))}
        </div>
      </div>

      {linhasPlano.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <p>Nenhum produto planejado para a {aplicacaoSel} aplicação.</p>
          <p className="text-xs mt-1">Acesse a aba Planejamento para adicionar produtos.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2 pl-4 pr-2 font-medium text-muted-foreground min-w-[160px]">Produto</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground w-28">Plan. kg/ha</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground w-28 bg-green-50">Exec. kg/ha</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground w-28">Qtd Exec. (kg)</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground w-24">g/planta</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground w-24">g/metro</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground w-24">Diferença</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground w-28">Data Aplic.</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground w-32">Responsável</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground w-36">Obs</th>
              </tr>
            </thead>
            <tbody>
              {linhasPlano.map(l => {
                const prod = todosProdutos.find(p => p.id === l.produto_id);
                const nomeProd = prod?.nome || l.produto_id;
                const ex = getExec(l.produto_id);

                // Dose planejada: usa dose_ajust_kgha ou dose_calc_kgha, ou calcula do qtd_planejado
                const doseHaPlan = parseFloat(l.dose_ajust_kgha) ||
                  (l.qtd_planejado && area > 0 ? parseFloat(l.qtd_planejado) / area : null);

                const doseHaExec = parseFloat(ex.dose_exec_kgha) || null;
                const qtdExec = doseHaExec && area > 0 ? Math.round(doseHaExec * area) : null;
                const gPeExec = qtdExec && numPlantas > 0 ? ((qtdExec * 1000) / numPlantas).toFixed(1) : null;
                const gMtExec = qtdExec && metros > 0 ? ((qtdExec * 1000) / metros).toFixed(1) : null;
                const ind = indicadorDif(doseHaPlan, doseHaExec);

                return (
                  <tr key={l.produto_id} className="border-b border-border/40 hover:bg-muted/10">
                    <td className="py-2 pl-4 pr-2 font-medium">{nomeProd}</td>
                    <td className="py-2 px-2 text-center text-muted-foreground">{doseHaPlan ? doseHaPlan.toFixed(1) : '—'}</td>
                    <td className="py-1.5 px-2 bg-green-50/30">
                      <Input type="number" value={ex.dose_exec_kgha}
                        onChange={e => setExec(l.produto_id, 'dose_exec_kgha', e.target.value)}
                        className="h-7 text-xs text-center" placeholder="kg/ha" />
                    </td>
                    <td className="py-2 px-2 text-center font-semibold">{qtdExec ? `${qtdExec} kg` : '—'}</td>
                    <td className="py-2 px-2 text-center">{gPeExec ? `${gPeExec} g` : '—'}</td>
                    <td className="py-2 px-2 text-center">{gMtExec ? `${gMtExec} g` : '—'}</td>
                    <td className="py-2 px-2 text-center">
                      {ind ? (
                        <div>
                          <div className="text-base">{ind.label}</div>
                          <div className={`text-xs ${ind.cor}`}>{ind.texto}</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="py-1.5 px-2">
                      <Input type="date" value={ex.data_aplicacao}
                        onChange={e => setExec(l.produto_id, 'data_aplicacao', e.target.value)}
                        className="h-7 text-xs" />
                    </td>
                    <td className="py-1.5 px-2">
                      <Input value={ex.responsavel}
                        onChange={e => setExec(l.produto_id, 'responsavel', e.target.value)}
                        className="h-7 text-xs" placeholder="Nome..." />
                    </td>
                    <td className="py-1.5 px-2">
                      <Input value={ex.observacoes}
                        onChange={e => setExec(l.produto_id, 'observacoes', e.target.value)}
                        className="h-7 text-xs" placeholder="Obs..." />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-5 py-3 border-t border-border flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Execução
        </Button>
      </div>
    </div>
  );
}