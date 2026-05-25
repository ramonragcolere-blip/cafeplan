import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2, FlaskConical } from 'lucide-react';

const CAMPOS_QUIMICOS = [
  { key: 'ph',                label: 'pH',                           type: 'number', step: '0.01' },
  { key: 'materia_organica',  label: 'Matéria Orgânica',             type: 'number', step: '0.01' },
  { key: 'fosforo',           label: 'Fósforo — P (mg/dm³)',         type: 'number', step: '0.01' },
  { key: 'potassio',          label: 'Potássio — K (mg/dm³)',        type: 'number', step: '0.01' },
  { key: 'calcio',            label: 'Cálcio — Ca (cmolc/dm³)',      type: 'number', step: '0.01' },
  { key: 'magnesio',          label: 'Magnésio — Mg (cmolc/dm³)',    type: 'number', step: '0.01' },
  { key: 'enxofre',           label: 'Enxofre — S (mg/dm³)',         type: 'number', step: '0.01' },
  { key: 'boro',              label: 'Boro — B (mg/dm³)',            type: 'number', step: '0.001' },
  { key: 'zinco',             label: 'Zinco — Zn (mg/dm³)',          type: 'number', step: '0.01' },
  { key: 'cobre',             label: 'Cobre — Cu (mg/dm³)',          type: 'number', step: '0.01' },
  { key: 'manganes',          label: 'Manganês — Mn (mg/dm³)',       type: 'number', step: '0.01' },
  { key: 'ferro',             label: 'Ferro — Fe (mg/dm³)',          type: 'number', step: '0.01' },
  { key: 'ctc',               label: 'CTC',                          type: 'number', step: '0.01' },
  { key: 'saturacao_bases',   label: 'V% (Saturação de Bases)',      type: 'number', step: '0.1'  },
];

// Campos da camada 20-40 cm (mesmos atributos com sufixo _2040)
const CAMPOS_2040 = CAMPOS_QUIMICOS.map(c => ({
  ...c,
  key: `${c.key}_2040`,
}));

const ALL_KEYS = [
  'data_analise',
  ...CAMPOS_QUIMICOS.map(c => c.key),
  'observacoes',
  ...CAMPOS_2040.map(c => c.key),
  'observacoes_2040',
];

const empty = () => ALL_KEYS.reduce((acc, k) => ({ ...acc, [k]: '' }), {});

const NUMERO_KEYS = new Set([
  ...CAMPOS_QUIMICOS.map(c => c.key),
  ...CAMPOS_2040.map(c => c.key),
]);

export default function AnaliseSoloForm({ dados, onSave, saving }) {
  const [form, setForm]     = useState(empty());
  const [camada, setCamada] = useState('0020'); // '0020' | '2040'

  useEffect(() => {
    setForm(dados ? { ...empty(), ...dados } : empty());
  }, [dados?.id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;
    const data = { ...form };
    NUMERO_KEYS.forEach(k => { data[k] = toNum(form[k]); });
    if (form.data_analise) data.data_analise = form.data_analise;
    onSave(data);
  };

  const camposCorrentes  = camada === '0020' ? CAMPOS_QUIMICOS : CAMPOS_2040;
  const obsKey           = camada === '0020' ? 'observacoes'   : 'observacoes_2040';

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-green-50 border-b border-border">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-green-700" />
          <span className="font-semibold text-sm text-green-800">Dados da Análise de Solo</span>
        </div>
        {/* Seletor de camada */}
        <div className="flex rounded-lg border border-green-300 overflow-hidden text-xs font-medium">
          <button
            type="button"
            onClick={() => setCamada('0020')}
            className={`px-3 py-1.5 transition-colors ${camada === '0020' ? 'bg-green-700 text-white' : 'bg-white text-green-800 hover:bg-green-50'}`}
          >
            0–20 cm
          </button>
          <button
            type="button"
            onClick={() => setCamada('2040')}
            className={`px-3 py-1.5 transition-colors border-l border-green-300 ${camada === '2040' ? 'bg-green-700 text-white' : 'bg-white text-green-800 hover:bg-green-50'}`}
          >
            20–40 cm
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Data da análise — só aparece na camada 0-20 */}
        {camada === '0020' && (
          <div className="max-w-xs">
            <Label className="text-xs mb-1 block">Data da Análise</Label>
            <Input
              type="date"
              value={form.data_analise ?? ''}
              onChange={e => set('data_analise', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        )}

        {/* Campos químicos da camada selecionada */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {camposCorrentes.map(c => (
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
            <Textarea
              value={form[obsKey] || ''}
              onChange={e => set(obsKey, e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
        </div>
      </div>

      <div className="px-5 pb-4 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Análise
        </Button>
      </div>
    </div>
  );
}