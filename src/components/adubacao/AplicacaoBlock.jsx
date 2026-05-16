import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2 } from 'lucide-react';

const CAMPOS_NUTRIENTES = [
  { key: 'nitrogenio_kg', label: 'N (kg)' },
  { key: 'fosforo_kg', label: 'P (kg)' },
  { key: 'potassio_kg', label: 'K (kg)' },
  { key: 'calcio_kg', label: 'Ca (kg)' },
  { key: 'magnesio_kg', label: 'Mg (kg)' },
  { key: 'enxofre_kg', label: 'S (kg)' },
  { key: 'boro_kg', label: 'B' },
  { key: 'zinco_kg', label: 'Zn' },
  { key: 'cobre_kg', label: 'Cu' },
  { key: 'manganes_kg', label: 'Mn' },
];

const empty = () => ({
  produto: '', data_planejada: '', data_executada: '',
  nitrogenio_kg: '', fosforo_kg: '', potassio_kg: '', calcio_kg: '',
  magnesio_kg: '', enxofre_kg: '', boro_kg: '', zinco_kg: '', cobre_kg: '', manganes_kg: '',
  dose_total_kg: '', dose_total_sacos: '',
  gramas_por_pe_1: '', gramas_por_pe_2: '', gramas_por_pe_3: '',
  gramas_por_metro_1: '', gramas_por_metro_2: '', gramas_por_metro_3: '',
  observacoes: '',
});

// Cálculos automáticos
function calcular(form, talhao) {
  const numPlantas = talhao?.num_plantas || 0;
  const metrosLineares = numPlantas > 0 && talhao?.espacamento ? numPlantas * (parseFloat(talhao.espacamento?.split(/[xX]/)?.[0]) || 0) : 0;
  const doseTotalKg = parseFloat(form.dose_total_kg) || 0;
  const gPorPe = numPlantas > 0 && doseTotalKg > 0 ? ((doseTotalKg * 1000) / numPlantas).toFixed(1) : '';
  const gPorMetro = metrosLineares > 0 && doseTotalKg > 0 ? ((doseTotalKg * 1000) / metrosLineares).toFixed(1) : '';
  const sacos = doseTotalKg > 0 ? (doseTotalKg / 50).toFixed(2) : '';
  return { gPorPe, gPorMetro, sacos };
}

export default function AplicacaoBlock({ numero, tipo, dados, talhao, onSave, saving }) {
  const [form, setForm] = useState(empty());

  useEffect(() => {
    const ap = dados?.aplicacoes?.find(a => a.numero === numero && a.tipo === tipo);
    setForm(ap ? { ...empty(), ...ap } : empty());
  }, [dados?.id, numero, tipo]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const calc = calcular(form, talhao);

  const cor = tipo === 'planejado'
    ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-emerald-50 border-emerald-200 text-emerald-800';

  const handleSave = () => {
    const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;
    const ap = {
      numero, tipo,
      produto: form.produto,
      data_planejada: form.data_planejada || undefined,
      data_executada: form.data_executada || undefined,
      nitrogenio_kg: toNum(form.nitrogenio_kg),
      fosforo_kg: toNum(form.fosforo_kg),
      potassio_kg: toNum(form.potassio_kg),
      calcio_kg: toNum(form.calcio_kg),
      magnesio_kg: toNum(form.magnesio_kg),
      enxofre_kg: toNum(form.enxofre_kg),
      boro_kg: form.boro_kg || undefined,
      zinco_kg: form.zinco_kg || undefined,
      cobre_kg: form.cobre_kg || undefined,
      manganes_kg: form.manganes_kg || undefined,
      dose_total_kg: toNum(form.dose_total_kg),
      dose_total_sacos: toNum(form.dose_total_sacos) || (calc.sacos ? Number(calc.sacos) : undefined),
      observacoes: form.observacoes || undefined,
    };
    onSave(ap);
  };

  return (
    <div className={`border rounded-xl overflow-hidden ${cor.split(' ').slice(1).join(' ')}`}>
      <div className={`flex items-center justify-between px-4 py-2 ${cor.split(' ')[0]} border-b`}>
        <span className={`font-semibold text-sm ${cor.split(' ')[2]}`}>
          {tipo === 'planejado' ? `📋 Planejado` : `✅ Executado`} — {numero}ª Aplicação
        </span>
        <Button size="sm" variant="outline" onClick={handleSave} disabled={saving} className="h-7 gap-1 text-xs">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Salvar
        </Button>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card">
        <div className="col-span-2">
          <Label className="text-xs mb-1 block">Produto / Formulado</Label>
          <Input value={form.produto} onChange={e => set('produto', e.target.value)} className="h-8 text-sm" placeholder="Ex: 29-00-00 Timac" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Data Planejada</Label>
          <Input type="date" value={form.data_planejada} onChange={e => set('data_planejada', e.target.value)} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Data Executada</Label>
          <Input type="date" value={form.data_executada} onChange={e => set('data_executada', e.target.value)} className="h-8 text-sm" />
        </div>

        {CAMPOS_NUTRIENTES.map(c => (
          <div key={c.key}>
            <Label className="text-xs mb-1 block">{c.label}</Label>
            <Input value={form[c.key] || ''} onChange={e => set(c.key, e.target.value)} className="h-8 text-sm" placeholder="—" />
          </div>
        ))}

        <div>
          <Label className="text-xs mb-1 block">Dose Total (kg)</Label>
          <Input type="number" value={form.dose_total_kg} onChange={e => set('dose_total_kg', e.target.value)} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Total em Sacos</Label>
          <Input value={calc.sacos || form.dose_total_sacos} readOnly className="h-8 text-sm bg-muted/50" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">g/Pé (calc.)</Label>
          <Input value={calc.gPorPe} readOnly className="h-8 text-sm bg-muted/50" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">g/Metro (calc.)</Label>
          <Input value={calc.gPorMetro} readOnly className="h-8 text-sm bg-muted/50" />
        </div>

        <div className="col-span-2 sm:col-span-4">
          <Label className="text-xs mb-1 block">Observações</Label>
          <Textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} className="text-sm" />
        </div>
      </div>
    </div>
  );
}