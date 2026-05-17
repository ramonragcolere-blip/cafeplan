import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CAMPOS = [
  { key: 'n_pct', label: 'N %' },
  { key: 'p2o5_pct', label: 'P₂O₅ %' },
  { key: 'k2o_pct', label: 'K₂O %' },
  { key: 'ca_pct', label: 'Ca %' },
  { key: 'mg_pct', label: 'Mg %' },
  { key: 's_pct', label: 'S %' },
  { key: 'b_pct', label: 'B %' },
  { key: 'zn_pct', label: 'Zn %' },
  { key: 'cu_pct', label: 'Cu %' },
  { key: 'mn_pct', label: 'Mn %' },
  { key: 'fe_pct', label: 'Fe %' },
];

export { CAMPOS };

export default function CamposComposicao({ form, set }) {
  return (
    <>
      <div className="col-span-2 sm:col-span-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Composição Nutricional (%)</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {CAMPOS.map(c => (
            <div key={c.key}>
              <Label className="text-xs mb-0.5 block">{c.label}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form[c.key] ?? ''}
                onChange={e => set(c.key, e.target.value)}
                className="h-8 text-sm"
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}