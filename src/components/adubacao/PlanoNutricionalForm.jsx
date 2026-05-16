import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Leaf } from 'lucide-react';

const NUTRIENTES = [
  { key: 'nitrogenio', label: 'Nitrogênio (N)' },
  { key: 'fosforo', label: 'Fósforo (P)' },
  { key: 'potassio', label: 'Potássio (K)' },
  { key: 'calcio', label: 'Cálcio (Ca)' },
  { key: 'magnesio', label: 'Magnésio (Mg)' },
  { key: 'enxofre', label: 'Enxofre (S)' },
  { key: 'boro', label: 'Boro (B)' },
  { key: 'zinco', label: 'Zinco (Zn)' },
  { key: 'cobre', label: 'Cobre (Cu)' },
  { key: 'manganes', label: 'Manganês (Mn)' },
  { key: 'ferro', label: 'Ferro (Fe)' },
];

const emptyNutriente = () => ({ dose_recomendada: '', observacao: '', via: 'solo', dispensado: false });
const emptyForm = () => NUTRIENTES.reduce((acc, n) => ({ ...acc, [n.key]: emptyNutriente() }), {});

export default function PlanoNutricionalForm({ dados, onSave, saving }) {
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (dados?.nutrientes) {
      const f = emptyForm();
      Object.keys(dados.nutrientes).forEach(k => { f[k] = { ...emptyNutriente(), ...dados.nutrientes[k] }; });
      setForm(f);
    } else {
      setForm(emptyForm());
    }
  }, [dados?.id]);

  const set = (nutriente, campo, valor) =>
    setForm(f => ({ ...f, [nutriente]: { ...f[nutriente], [campo]: valor } }));

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-lime-50 border-b border-border">
        <Leaf className="w-4 h-4 text-lime-700" />
        <span className="font-semibold text-sm text-lime-800">Planejado Nutricional</span>
      </div>
      <div className="p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-3 font-medium text-muted-foreground w-36">Nutriente</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground w-36">Dose Recomendada</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground w-32">Via</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Observação</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-24">Dispensado</th>
            </tr>
          </thead>
          <tbody>
            {NUTRIENTES.map(n => (
              <tr key={n.key} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-1.5 pr-3 font-medium text-sm">{n.label}</td>
                <td className="py-1.5 px-2">
                  <Input
                    value={form[n.key]?.dose_recomendada || ''}
                    onChange={e => set(n.key, 'dose_recomendada', e.target.value)}
                    className="h-7 text-xs"
                    placeholder="Ex: 200 kg/ha"
                  />
                </td>
                <td className="py-1.5 px-2">
                  <select
                    value={form[n.key]?.via || 'solo'}
                    onChange={e => set(n.key, 'via', e.target.value)}
                    className="h-7 text-xs border border-input rounded-md px-2 bg-transparent w-full"
                  >
                    <option value="solo">Solo</option>
                    <option value="folha">Via Folha</option>
                    <option value="fertirrigacao">Fertirrigação</option>
                  </select>
                </td>
                <td className="py-1.5 px-2">
                  <Input
                    value={form[n.key]?.observacao || ''}
                    onChange={e => set(n.key, 'observacao', e.target.value)}
                    className="h-7 text-xs"
                    placeholder="Obs..."
                  />
                </td>
                <td className="py-1.5 px-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!form[n.key]?.dispensado}
                    onChange={e => set(n.key, 'dispensado', e.target.checked)}
                    className="w-4 h-4 accent-primary"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 pb-4 flex justify-end">
        <Button size="sm" onClick={() => onSave({ nutrientes: form })} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Nutricional
        </Button>
      </div>
    </div>
  );
}