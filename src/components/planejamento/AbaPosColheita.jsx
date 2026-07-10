import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const toN = v => (v !== '' && v != null) ? Number(v) : 0;
const fmt = (v, d = 0) => v != null ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

function TalhaoPos({ talhao, equip, params, codigoProdutor, safra, saved }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    prod_estimada_sc: '', lavagem_horas: '', lavagem_kwh: '', lavagem_custo_r: '',
    secagem_bateladas: '', secagem_kwh_total: '', secagem_custo_r: '', secagem_tarifa_tipo: 'Verde',
    beneficio_r_saca: '', armazenagem_r_saca: '', outros_r_saca: '',
  });

  useEffect(() => {
    if (saved) setForm(current => ({ ...current, ...saved }));
  }, [saved]);

  const lavadorNome = [equip?.lavador_marca, equip?.lavador_modelo].filter(Boolean).join(' ');
  const secadorNome = [equip?.secador_marca, equip?.secador_modelo].filter(Boolean).join(' ');

  const tarifa = form.secagem_tarifa_tipo === 'Verde'
    ? (toN(params?.tarifa_verde) || toN(equip?.tarifa_energia_cemig) || 0.8)
    : (toN(params?.tarifa_azul) || 0.6);

  const kwh_saca_sec = equip?.secador_kwh_saca || 0;
  const cap_sec = equip?.secador_capacidade_sacas || 1;
  const prodSc = toN(form.prod_estimada_sc);
  const bateladas = cap_sec ? Math.ceil(prodSc / cap_sec) : 0;
  const kwhTotal = kwh_saca_sec * prodSc;
  const custoSec = kwhTotal * tarifa;

  const lavKwh = toN(form.lavagem_kwh);
  const custoLav = lavKwh * (toN(params?.tarifa_verde) || toN(equip?.tarifa_energia_cemig) || 0.8);

  const custoOutrosSaca = toN(form.beneficio_r_saca) + toN(form.armazenagem_r_saca) + toN(form.outros_r_saca);
  const custoOutrosTotal = custoOutrosSaca * prodSc;
  const custoTotalPos = custoLav + custoSec + custoOutrosTotal;
  const custoPosSaca = prodSc ? custoTotalPos / prodSc : 0;
  const custoPosHa = talhao.area_ha ? custoTotalPos / talhao.area_ha : 0;

  const saveMutation = useMutation({
    mutationFn: () => {
      const data = {
        codigo_produtor: codigoProdutor, safra,
        talhao_id: talhao.id, talhao_nome: talhao.nome,
        prod_estimada_sc: toN(form.prod_estimada_sc),
        lavagem_horas: toN(form.lavagem_horas),
        lavagem_kwh: lavKwh,
        lavagem_custo_r: custoLav,
        secagem_bateladas: bateladas,
        secagem_kwh_total: kwhTotal,
        secagem_custo_r: custoSec,
        secagem_tarifa_tipo: form.secagem_tarifa_tipo,
        beneficio_r_saca: toN(form.beneficio_r_saca),
        armazenagem_r_saca: toN(form.armazenagem_r_saca),
        outros_r_saca: toN(form.outros_r_saca),
      };
      return saved?.id
        ? base44.entities.PlanejamentoPosColheita.update(saved.id, data)
        : base44.entities.PlanejamentoPosColheita.create(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plan_pos'] }); toast({ title: 'Salvo!' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message), variant: 'destructive' }),
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = (k, label, placeholder) => (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" value={form[k] || ''} onChange={e => set(k, e.target.value)} placeholder={placeholder} className="h-7 text-xs mt-0.5" />
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="bg-muted/40 px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="font-semibold text-sm">{talhao.nome} — {talhao.area_ha} ha</p>
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-1.5 h-7 text-xs">
          {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
        </Button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Produção estimada (sc)</Label>
          <Input type="number" value={form.prod_estimada_sc || ''} onChange={e => set('prod_estimada_sc', e.target.value)} className="h-7 text-xs mt-0.5 max-w-xs" />
        </div>

        {/* Lavagem */}
        <div className="border border-border rounded-xl p-3 space-y-2">
          <p className="font-medium text-xs text-primary">💧 Lavagem</p>
          {lavadorNome && <p className="text-xs text-muted-foreground">Lavador: {lavadorNome}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {inp('lavagem_horas', 'Horas de operação', 'h')}
            {inp('lavagem_kwh', 'Consumo kWh total', 'kWh')}
          </div>
          <p className="text-xs text-muted-foreground">Custo estimado: <strong>R$ {fmt(custoLav, 2)}</strong> (tarifa Verde)</p>
        </div>

        {/* Secagem */}
        <div className="border border-border rounded-xl p-3 space-y-2">
          <p className="font-medium text-xs text-primary">🔥 Secagem</p>
          {secadorNome && <p className="text-xs text-muted-foreground">Secador: {secadorNome} — {cap_sec} sc/batelada — {kwh_saca_sec} kWh/saca</p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Nº bateladas (calc.)</Label>
              <p className="text-sm font-bold mt-1">{bateladas || '—'}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">kWh total (calc.)</Label>
              <p className="text-sm font-bold mt-1">{fmt(kwhTotal, 0)}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tarifa</Label>
              <Select value={form.secagem_tarifa_tipo} onValueChange={v => set('secagem_tarifa_tipo', v)}>
                <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Verde">Verde</SelectItem>
                  <SelectItem value="Azul">Azul</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Custo estimado: <strong>R$ {fmt(custoSec, 2)}</strong> ({tarifa} R$/kWh)</p>
        </div>

        {/* Benefício / Armazenagem */}
        <div className="border border-border rounded-xl p-3 space-y-2">
          <p className="font-medium text-xs text-primary">📦 Benefício e Armazenagem</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {inp('beneficio_r_saca', 'Benefício (R$/saca)', '0')}
            {inp('armazenagem_r_saca', 'Armazenagem (R$/saca)', '0')}
            {inp('outros_r_saca', 'Outros (R$/saca)', '0')}
          </div>
        </div>

        {/* Totais */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          {[
            { label: 'Custo Pós-Col./saca', value: `R$ ${fmt(custoPosSaca, 2)}` },
            { label: 'Custo Pós-Col./ha', value: `R$ ${fmt(custoPosHa, 0)}` },
            { label: 'Custo Total Pós-Col.', value: `R$ ${fmt(custoTotalPos, 0)}` },
          ].map(c => (
            <div key={c.label} className="bg-muted/40 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="font-bold text-base">{c.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AbaPosColheita({ talhoes, produtor: _produtor, equip, safra, codigoProdutor }) {
  const { data: params = {} } = useQuery({
    queryKey: ['params_plan'],
    queryFn: async () => {
      const list = await base44.entities.ParametrosPlanejamento.list(undefined, 5000);
      const map = {};
      list.forEach(p => { map[p.chave] = p.valor; });
      return map;
    },
  });

  const { data: savedAll = [] } = useQuery({
    queryKey: ['plan_pos', codigoProdutor, safra],
    queryFn: () => base44.entities.PlanejamentoPosColheita.filter({ codigo_produtor: codigoProdutor, safra }),
    enabled: !!codigoProdutor,
  });

  return (
    <div className="space-y-6 mt-4">
      {talhoes.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-16">Nenhum talhão cadastrado</p>
      ) : talhoes.map(t => (
        <TalhaoPos
          key={t.id}
          talhao={t}
          equip={equip}
          params={params}
          codigoProdutor={codigoProdutor}
          safra={safra}
          saved={savedAll.find(s => s.talhao_id === t.id)}
        />
      ))}
    </div>
  );
}