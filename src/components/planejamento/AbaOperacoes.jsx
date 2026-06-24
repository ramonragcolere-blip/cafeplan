import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const TIPOS = ['Mecanizado', 'Manual', 'Misto'];

const OPS_PADRAO = [
  { operacao: 'Roçada', tipo: 'Mecanizado', trator_implemento: 'Trator + Roçadeira' },
  { operacao: 'Controle químico de mato', tipo: 'Mecanizado', trator_implemento: 'Trator + Pulverizador' },
  { operacao: 'Adubação via solo', tipo: 'Mecanizado', trator_implemento: 'Trator + Carreta' },
  { operacao: 'Aplicação foliar', tipo: 'Mecanizado', trator_implemento: 'Trator + Pulverizador' },
  { operacao: 'Poda/Desbrota', tipo: 'Manual', trator_implemento: '' },
  { operacao: 'Colheita', tipo: 'Misto', trator_implemento: 'Colhedora + Manual' },
  { operacao: 'Transporte interno', tipo: 'Mecanizado', trator_implemento: 'Trator + Carreta' },
];

const emptyRow = (talhaoId, talhaoNome, codigoProdutor, safra, op) => ({
  codigo_produtor: codigoProdutor,
  safra,
  talhao_id: talhaoId,
  talhao_nome: talhaoNome,
  operacao: op.operacao,
  meses: [],
  tipo: op.tipo,
  trator_implemento: op.trator_implemento,
  horas_ha: '',
  consumo_diesel_lha: '',
  custo_diesel_rha: '',
  horas_mo_ha: '',
  custo_mo_rha: '',
  custo_total_rha: '',
});

function calcRow(row, equip, params) {
  const horas = Number(row.horas_ha) || 0;
  let consLha = Number(row.consumo_diesel_lha) || 0;
  if (!consLha && equip && horas) {
    const op = row.operacao;
    if (op === 'Roçada') consLha = equip.trator_consumo_rocada || 0;
    else if (op === 'Controle químico de mato') consLha = equip.trator_consumo_trincha || 0;
    else if (op === 'Adubação via solo' || op === 'Transporte interno') consLha = equip.trator_consumo_carreta_pesada || 0;
    else consLha = equip.trator_consumo_sem_implemento || 0;
    consLha = horas * consLha;
  }
  const diesel = Number(equip?.preco_diesel) || Number(params?.diesel) || 0;
  const custoDiesel = consLha * diesel;
  const horasMO = Number(row.horas_mo_ha) || 0;
  const diaria = Number(params?.diaria_mo) || 150;
  const custoMO = horasMO * (diaria / 8);
  const total = custoDiesel + custoMO;
  return { consLha, custoDiesel, custoMO, total };
}

export default function AbaOperacoes({ talhoes, produtor, equip, safra, codigoProdutor }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rows, setRows] = useState({});

  const { data: saved = [], isLoading } = useQuery({
    queryKey: ['plan_operacoes', codigoProdutor, safra],
    queryFn: () => base44.entities.PlanejamentoOperacoes.filter({ codigo_produtor: codigoProdutor, safra }),
    enabled: !!codigoProdutor,
  });

  const { data: params = {} } = useQuery({
    queryKey: ['params_plan'],
    queryFn: async () => {
      const list = await base44.entities.ParametrosPlanejamento.list();
      const map = {};
      list.forEach(p => { map[p.chave] = p.valor; });
      return map;
    },
  });

  useEffect(() => {
    if (!talhoes.length) return;
    const init = {};
    talhoes.forEach(t => {
      init[t.id] = OPS_PADRAO.map(op => {
        const existing = saved.find(s => s.talhao_id === t.id && s.operacao === op.operacao);
        return existing || emptyRow(t.id, t.nome, codigoProdutor, safra, op);
      });
    });
    setRows(init);
  }, [talhoes, saved]);

  const updateRow = (talhaoId, idx, field, val) => {
    setRows(prev => {
      const updated = [...(prev[talhaoId] || [])];
      updated[idx] = { ...updated[idx], [field]: val };
      const calc = calcRow(updated[idx], equip, params);
      updated[idx].consumo_diesel_lha = calc.consLha || updated[idx].consumo_diesel_lha;
      updated[idx].custo_diesel_rha = calc.custoDiesel || updated[idx].custo_diesel_rha;
      updated[idx].custo_mo_rha = calc.custoMO || updated[idx].custo_mo_rha;
      updated[idx].custo_total_rha = calc.total || updated[idx].custo_total_rha;
      return { ...prev, [talhaoId]: updated };
    });
  };

  const toggleMes = (talhaoId, idx, mes) => {
    setRows(prev => {
      const updated = [...(prev[talhaoId] || [])];
      const meses = updated[idx].meses || [];
      updated[idx] = { ...updated[idx], meses: meses.includes(mes) ? meses.filter(m => m !== mes) : [...meses, mes] };
      return { ...prev, [talhaoId]: updated };
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const all = Object.values(rows).flat();
      for (const row of all) {
        const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;
        const data = {
          ...row,
          horas_ha: toNum(row.horas_ha),
          consumo_diesel_lha: toNum(row.consumo_diesel_lha),
          custo_diesel_rha: toNum(row.custo_diesel_rha),
          horas_mo_ha: toNum(row.horas_mo_ha),
          custo_mo_rha: toNum(row.custo_mo_rha),
          custo_total_rha: toNum(row.custo_total_rha),
        };
        if (row.id) await base44.entities.PlanejamentoOperacoes.update(row.id, data);
        else await base44.entities.PlanejamentoOperacoes.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan_operacoes'] });
      toast({ title: 'Operações salvas!' });
    },
    onError: err => toast({ title: 'Erro ao salvar', description: String(err?.message), variant: 'destructive' }),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 mt-4">
      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar tudo
        </Button>
      </div>

      {talhoes.map(t => (
        <div key={t.id} className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="bg-muted/40 px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm">{t.nome} — {t.area_ha} ha</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/20 text-muted-foreground">
                  <th className="px-3 py-2 text-left">Operação</th>
                  <th className="px-3 py-2 text-left">Meses</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Trator/Impl.</th>
                  <th className="px-3 py-2 text-right">H/ha</th>
                  <th className="px-3 py-2 text-right">Diesel (L/ha)</th>
                  <th className="px-3 py-2 text-right">Custo Diesel (R$/ha)</th>
                  <th className="px-3 py-2 text-right">MO (H/ha)</th>
                  <th className="px-3 py-2 text-right">Custo MO (R$/ha)</th>
                  <th className="px-3 py-2 text-right">Total (R$/ha)</th>
                </tr>
              </thead>
              <tbody>
                {(rows[t.id] || []).map((row, idx) => (
                  <tr key={idx} className="border-t border-border hover:bg-muted/10">
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap">{row.operacao}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex flex-wrap gap-0.5">
                        {MESES.map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => toggleMes(t.id, idx, m)}
                            className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${(row.meses || []).includes(m) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}
                          >{m}</button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <Select value={row.tipo} onValueChange={v => updateRow(t.id, idx, 'tipo', v)}>
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{TIPOS.map(tp => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-1.5">
                      <Input value={row.trator_implemento || ''} onChange={e => updateRow(t.id, idx, 'trator_implemento', e.target.value)} className="h-7 text-xs w-40" />
                    </td>
                    <td className="px-3 py-1.5">
                      <Input type="number" value={row.horas_ha || ''} onChange={e => updateRow(t.id, idx, 'horas_ha', e.target.value)} className="h-7 text-xs w-16 text-right" />
                    </td>
                    <td className="px-3 py-1.5 text-right">{row.consumo_diesel_lha ? Number(row.consumo_diesel_lha).toFixed(1) : '—'}</td>
                    <td className="px-3 py-1.5 text-right">{row.custo_diesel_rha ? `R$ ${Number(row.custo_diesel_rha).toFixed(0)}` : '—'}</td>
                    <td className="px-3 py-1.5">
                      <Input type="number" value={row.horas_mo_ha || ''} onChange={e => updateRow(t.id, idx, 'horas_mo_ha', e.target.value)} className="h-7 text-xs w-16 text-right" />
                    </td>
                    <td className="px-3 py-1.5 text-right">{row.custo_mo_rha ? `R$ ${Number(row.custo_mo_rha).toFixed(0)}` : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{row.custo_total_rha ? `R$ ${Number(row.custo_total_rha).toFixed(0)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}