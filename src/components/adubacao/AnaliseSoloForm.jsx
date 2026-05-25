import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2, FlaskConical } from 'lucide-react';

const CAMPOS = [
  { key: 'data_analise',     label: 'Data da Análise',              type: 'date'   },
  { key: 'ph',               label: 'pH',                           type: 'number', step: '0.01'  },
  { key: 'materia_organica', label: 'M.O. (g/dm³)',                 type: 'number', step: '0.01'  },
  { key: 'fosforo',          label: 'Fósforo — P (mg/dm³)',         type: 'number', step: '0.01'  },
  { key: 'potassio',         label: 'K (mmolc/dm³)',                 type: 'number', step: '0.01'  },
  { key: 'calcio',           label: 'Ca (mmolc/dm³)',                type: 'number', step: '0.01'  },
  { key: 'magnesio',         label: 'Mg (mmolc/dm³)',                type: 'number', step: '0.01'  },
  { key: 'enxofre',          label: 'Enxofre — S (mg/dm³)',         type: 'number', step: '0.01'  },
  { key: 'boro',             label: 'Boro — B (mg/dm³)',            type: 'number', step: '0.001' },
  { key: 'zinco',            label: 'Zinco — Zn (mg/dm³)',          type: 'number', step: '0.01'  },
  { key: 'cobre',            label: 'Cobre — Cu (mg/dm³)',          type: 'number', step: '0.01'  },
  { key: 'manganes',         label: 'Manganês — Mn (mg/dm³)',       type: 'number', step: '0.01'  },
  { key: 'ferro',            label: 'Ferro — Fe (mg/dm³)',          type: 'number', step: '0.01'  },
  { key: 'ctc',              label: 'CTC',                          type: 'number', step: '0.01'  },
  { key: 'saturacao_bases',  label: 'V% (Saturação de Bases)',      type: 'number', step: '0.1'   },
];

const empty = () => CAMPOS.reduce((acc, c) => ({ ...acc, [c.key]: '' }), { observacoes: '' });

export default function AnaliseSoloForm({ dados, onSave, saving }) {
  const [form, setForm] = useState(empty());

  useEffect(() => {
    setForm(dados ? { ...empty(), ...dados } : empty());
  }, [dados?.id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;
    const data = { ...form };
    CAMPOS.forEach(c => { if (c.type === 'number') data[c.key] = toNum(form[c.key]); });
    onSave(data);
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-green-50 border-b border-border">
        <FlaskConical className="w-4 h-4 text-green-700" />
        <span className="font-semibold text-sm text-green-800">Análise de Solo — Camada 0–20 cm</span>
      </div>
      <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CAMPOS.map(c => (
          <div key={c.key}>
            <Label className="text-xs mb-1 block">{c.label}</Label>
            <Input
              type={c.type}
              step={c.step}
              value={form[c.key] ?? ''}
              onChange={e => set(c.key, e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        ))}
        <div className="col-span-2 sm:col-span-4">
          <Label className="text-xs mb-1 block">Observações</Label>
          <Textarea value={form.observacoes || ''} onChange={e => set('observacoes', e.target.value)} rows={2} className="text-sm" />
        </div>
      </div>
      <div className="px-5 pb-4 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Análise 0–20 cm
        </Button>
      </div>
    </div>
  );
}