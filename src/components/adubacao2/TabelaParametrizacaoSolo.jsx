import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { unidadesDoNutriente } from '@/lib/conversaoUnidadesSolo';
import { validarParametros } from '@/lib/parametrosSoloDefault';

// Tabela de parametrização com validação em tempo real.
// Em mobile, transforma em cards empilhados.
export default function TabelaParametrizacaoSolo({ nutrientes, erros, onChange }) {
  const erroMap = React.useMemo(() => {
    const m = {};
    (erros || []).forEach(e => { m[e.key] = e.mensagens; });
    return m;
  }, [erros]);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      {/* Desktop: tabela */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground uppercase">
              <th className="px-3 py-2 text-left font-semibold">Nutriente</th>
              <th className="px-3 py-2 text-left font-semibold">Unid. Referência</th>
              <th className="px-3 py-2 text-right font-semibold">Mínimo</th>
              <th className="px-3 py-2 text-right font-semibold">Ideal</th>
              <th className="px-3 py-2 text-right font-semibold">Máximo</th>
            </tr>
          </thead>
          <tbody>
            {nutrientes.map((n) => {
              const temErro = !!erroMap[n.key];
              return (
                <tr key={n.key} className={`border-b border-border/40 last:border-0 ${temErro ? 'bg-red-50/60' : ''}`}>
                  <td className="px-3 py-2 font-medium align-middle">
                    {n.nome}
                    {temErro && (
                      <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                        <AlertTriangle className="w-3 h-3" /> {erroMap[n.key].join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Select value={n.unidade_escolhida} onValueChange={(v) => onChange(n.key, 'unidade_escolhida', v)}>
                      <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {unidadesDoNutriente(n.key).map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2"><Input type="number" step="0.01" value={n.minimo ?? ''} onChange={(e) => onChange(n.key, 'minimo', e.target.value)} className="h-8 text-xs text-right tabular-nums" /></td>
                  <td className="px-3 py-2"><Input type="number" step="0.01" value={n.ideal ?? ''} onChange={(e) => onChange(n.key, 'ideal', e.target.value)} className="h-8 text-xs text-right tabular-nums" /></td>
                  <td className="px-3 py-2"><Input type="number" step="0.01" value={n.maximo ?? ''} onChange={(e) => onChange(n.key, 'maximo', e.target.value)} className="h-8 text-xs text-right tabular-nums" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards empilhados */}
      <div className="md:hidden space-y-3">
        {nutrientes.map((n) => {
          const temErro = !!erroMap[n.key];
          return (
            <div key={n.key} className={`border rounded-lg p-3 ${temErro ? 'border-red-300 bg-red-50/40' : 'border-border'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{n.nome}</span>
                <Select value={n.unidade_escolhida} onValueChange={(v) => onChange(n.key, 'unidade_escolhida', v)}>
                  <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {unidadesDoNutriente(n.key).map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {temErro && (
                <div className="flex items-center gap-1 text-xs text-red-600 mb-2">
                  <AlertTriangle className="w-3 h-3" /> {erroMap[n.key].join(' · ')}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {[['Mínimo', 'minimo'], ['Ideal', 'ideal'], ['Máximo', 'maximo']].map(([label, campo]) => (
                  <label key={campo} className="block">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <Input type="number" step="0.01" value={n[campo] ?? ''} onChange={(e) => onChange(n.key, campo, e.target.value)} className="h-8 text-xs text-right tabular-nums mt-0.5" />
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}