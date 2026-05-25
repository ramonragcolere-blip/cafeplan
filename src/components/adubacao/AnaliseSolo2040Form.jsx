import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2, FlaskConical, ChevronDown, ChevronRight } from 'lucide-react';

const CAMPOS = [
  { key: 'data_analise',     label: 'Data da Análise',         type: 'date'                   },
  { key: 'ph',               label: 'pH',                      type: 'number', step: '0.01'   },
  { key: 'materia_organica', label: 'M.O. (g/dm³)',            type: 'number', step: '0.01'   },
  { key: 'fosforo',          label: 'P (mg/dm³)',              type: 'number', step: '0.01'   },
  { key: 'potassio',         label: 'K (mmolc/dm³)',           type: 'number', step: '0.01'   },
  { key: 'calcio',           label: 'Ca (mmolc/dm³)',          type: 'number', step: '0.01'   },
  { key: 'magnesio',         label: 'Mg (mmolc/dm³)',          type: 'number', step: '0.01'   },
  { key: 'aluminio',         label: 'Al (cmolc/dm³)',          type: 'number', step: '0.01'   },
  { key: 'h_al',             label: 'H+Al (cmolc/dm³)',        type: 'number', step: '0.01'   },
  { key: 'sb',               label: 'SB (cmolc/dm³)',          type: 'number', step: '0.01'   },
  { key: 'ctc',              label: 'CTC (cmolc/dm³)',         type: 'number', step: '0.01'   },
  { key: 'saturacao_bases',  label: 'V% (Saturação de Bases)', type: 'number', step: '0.1'    },
  { key: 'boro',             label: 'B (mg/dm³)',              type: 'number', step: '0.001'  },
  { key: 'zinco',            label: 'Zn (mg/dm³)',             type: 'number', step: '0.01'   },
  { key: 'cobre',            label: 'Cu (mg/dm³)',             type: 'number', step: '0.01'   },
  { key: 'manganes',         label: 'Mn (mg/dm³)',             type: 'number', step: '0.01'   },
  { key: 'ferro',            label: 'Fe (mg/dm³)',             type: 'number', step: '0.01'   },
  { key: 'enxofre',          label: 'S (mg/dm³)',              type: 'number', step: '0.01'   },
];

const NUM_KEYS = new Set(CAMPOS.filter(c => c.type === 'number').map(c => c.key));
const empty = () => CAMPOS.reduce((acc, c) => ({ ...acc, [c.key]: '' }), { observacoes: '' });

export default function AnaliseSolo2040Form({ dados, onSave, saving }) {
  const [aberto, setAberto] = useState(false);
  const [semAnalise, setSemAnalise] = useState(false);
  const [form, setForm] = useState(empty());

  // Sincroniza quando os dados externos chegarem (carregamento ou troca de talhão/safra)
  useEffect(() => {
    if (dados) {
      setSemAnalise(dados.sem_analise_2040 === true);
      setForm({ ...empty(), ...dados });
    } else {
      setSemAnalise(false);
      setForm(empty());
    }
  }, [dados?.id, dados?.talhao_id, dados?.safra, dados?.codigo_produtor]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (semAnalise) {
      // Salva apenas o flag, sem exigir campos
      onSave({ sem_analise_2040: true });
      return;
    }
    const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;
    const data = { ...form, sem_analise_2040: false };
    NUM_KEYS.forEach(k => { data[k] = toNum(form[k]); });
    onSave(data);
  };

  // Status resumido para o cabeçalho colapsado
  const statusBadge = dados?.sem_analise_2040
    ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Não possui</span>
    : dados
    ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Com dados</span>
    : <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">Não cadastrada</span>;

  return (
    <div className="bg-card border-2 border-blue-200 rounded-2xl overflow-hidden">

      {/* Cabeçalho recolhível */}
      <button
        type="button"
        className="w-full flex items-center gap-2 px-5 py-3 bg-blue-50 border-b border-blue-200 hover:bg-blue-100 transition-colors text-left"
        onClick={() => setAberto(a => !a)}
      >
        <FlaskConical className="w-4 h-4 text-blue-700 shrink-0" />
        <span className="font-semibold text-sm text-blue-800 flex-1">
          Análise de Solo — Camada 20–40 cm
        </span>
        {statusBadge}
        {aberto
          ? <ChevronDown className="w-4 h-4 text-blue-600 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-blue-600 shrink-0" />
        }
      </button>

      {/* Corpo expansível */}
      {aberto && (
        <>
          {/* Checkbox "não possui" */}
          <div className="px-5 pt-4 pb-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="sem_analise_2040"
              checked={semAnalise}
              onChange={e => setSemAnalise(e.target.checked)}
              className="w-4 h-4 accent-amber-500 cursor-pointer"
            />
            <label htmlFor="sem_analise_2040" className="text-sm text-muted-foreground cursor-pointer select-none">
              Produtor não possui análise de solo 20–40 cm
            </label>
          </div>

          {/* Campos — ocultos quando "não possui" */}
          {!semAnalise && (
            <div className="px-5 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                <Textarea
                  value={form.observacoes || ''}
                  onChange={e => set('observacoes', e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>
            </div>
          )}

          <div className="px-5 pb-4 flex justify-end">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-2 bg-blue-700 hover:bg-blue-800 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {semAnalise ? 'Salvar — Sem análise 20–40 cm' : 'Salvar Análise 20–40 cm'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}