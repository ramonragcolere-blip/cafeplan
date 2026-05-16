import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Package } from 'lucide-react';

const FONTES = [
  { key: 'npk', label: 'Formulado NPK' },
  { key: 'fosforo_fonte', label: 'Fonte de Fósforo' },
  { key: 'potassio_fonte', label: 'Fonte de Potássio' },
  { key: 'calcario', label: 'Calcário' },
  { key: 'gesso', label: 'Gesso' },
  { key: 'magnesio_fonte', label: 'Fonte de Magnésio' },
  { key: 'boro_fonte', label: 'Fonte de Boro' },
  { key: 'zinco_fonte', label: 'Fonte de Zinco' },
  { key: 'cobre_fonte', label: 'Fonte de Cobre' },
  { key: 'manganes_fonte', label: 'Fonte de Manganês' },
  { key: 'foliares', label: 'Fertilizantes Foliares' },
  { key: 'outros', label: 'Outros Produtos' },
];

const empty = () => FONTES.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {});

export default function FontesFormulados({ dados, onSave, saving }) {
  const [form, setForm] = useState(empty());

  useEffect(() => {
    setForm(dados?.fontes_formulados ? { ...empty(), ...dados.fontes_formulados } : empty());
  }, [dados?.id]);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-blue-50 border-b border-border">
        <Package className="w-4 h-4 text-blue-700" />
        <span className="font-semibold text-sm text-blue-800">Fontes e Formulados</span>
      </div>
      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {FONTES.map(f => (
          <div key={f.key}>
            <Label className="text-xs mb-1 block">{f.label}</Label>
            <Input
              value={form[f.key] || ''}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="h-8 text-sm"
              placeholder="Nome do produto..."
            />
          </div>
        ))}
      </div>
      <div className="px-5 pb-4 flex justify-end">
        <Button size="sm" onClick={() => onSave({ fontes_formulados: form })} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Fontes
        </Button>
      </div>
    </div>
  );
}