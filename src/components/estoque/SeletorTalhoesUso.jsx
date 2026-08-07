import React, { useMemo } from 'react';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { computarTalhoesAplicacao, labelDoseBase } from '@/lib/talhoesAplicacao';

// Seleção múltipla de talhões + rateio (proporcional à área ou manual).
// Reaproveita o padrão visual do LateralTalhoes (foliar), porém inline no modal.
//
// Props:
//  - talhoes: [{id, nome, area_ha, fase_atual}] (JÁ filtrados ao produtor)
//  - quantidadeTotal, unidade: da saída sendo registrada/editada
//  - dose: {valor, unit} em base (l/kg) ou null (para referência de quantidade estimada)
//  - value: { ids: string[], mode: 'proporcional'|'manual', manual: {[id]: number} }
//  - onChange(value)
//  - obrigatorio: boolean (saídas exigem talhão)
export default function SeletorTalhoesUso({
  talhoes = [], quantidadeTotal = 0, unidade = '', dose = null,
  value, onChange, obrigatorio = false,
}) {
  const ids = value?.ids || [];
  const mode = value?.mode || 'proporcional';
  const manual = value?.manual || {};
  const total = Number(quantidadeTotal) || 0;
  const idsSet = new Set(ids.map(String));

  const sel = (talhoes || []).filter((t) => idsSet.has(String(t.id)));
  const areaTotal = sel.reduce((s, t) => s + (Number(t.area_ha) || 0), 0);

  const { talhoes_aplicacao: rateado, erro, soma } = useMemo(
    () => computarTalhoesAplicacao({ talhoes, ids, mode, manual, quantidadeTotal: total }),
    [talhoes, ids, mode, manual, total],
  );

  const toggle = (id) => {
    const next = new Set(idsSet);
    next.has(String(id)) ? next.delete(String(id)) : next.add(String(id));
    onChange({ ...value, ids: [...next] });
  };
  const toggleAll = () => {
    if (idsSet.size === (talhoes || []).length) onChange({ ...value, ids: [] });
    else onChange({ ...value, ids: (talhoes || []).map((t) => t.id) });
  };
  const setMode = (m) => onChange({ ...value, mode: m });
  const setManual = (id, v) => onChange({ ...value, manual: { ...manual, [id]: v } });

  const doseOk = !!dose && dose.valor > 0 && (dose.unit === 'l' || dose.unit === 'kg')
    && (unidade === 'l' || unidade === 'kg');
  const qtdEstimada = doseOk ? areaTotal * dose.valor : null;
  const doseEfetiva = areaTotal > 0 && total > 0 ? total / areaTotal : null;
  const unidadeBase = dose?.unit === 'kg' ? 'kg' : 'L';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">
          Talhões onde o produto foi utilizado {obrigatorio && <span className="text-destructive">*</span>}
        </label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {idsSet.size} talhão(ões) · {areaTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha
        </span>
      </div>

      {(talhoes || []).length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Nenhum talhão cadastrado para este produtor. O registro pode ser salvo sem talhão.
        </p>
      ) : (
        <div className="border border-border rounded-lg max-h-56 overflow-y-auto divide-y divide-border/40">
          <label className="flex items-center gap-3 px-3 py-2 bg-muted/10 hover:bg-muted/30 cursor-pointer sticky top-0">
            <input type="checkbox"
              checked={idsSet.size === (talhoes || []).length && (talhoes || []).length > 0}
              onChange={toggleAll}
              className="w-4 h-4 rounded accent-primary" />
            <span className="text-xs font-semibold">Selecionar todos</span>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {(talhoes || []).reduce((s, t) => s + (Number(t.area_ha) || 0), 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha
            </span>
          </label>
          {(talhoes || []).map((t) => {
            const on = idsSet.has(String(t.id));
            return (
              <label key={t.id}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${on ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(t.id)}
                  className="w-4 h-4 rounded accent-primary shrink-0" />
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 min-w-0 truncate">{t.nome}</span>
                {t.fase_atual && (
                  <span className="text-[10px] text-muted-foreground hidden sm:block shrink-0">{t.fase_atual}</span>
                )}
                <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                  {(Number(t.area_ha) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* Resumo + referências */}
      <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Área selecionada</span>
          <span className="font-semibold tabular-nums">{areaTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha</span>
        </div>
        {doseOk && qtdEstimada != null && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dose padrão</span>
              <span className="font-semibold">{labelDoseBase(dose)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantidade estimada p/ a área</span>
              <span className="font-semibold tabular-nums">
                {qtdEstimada.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {unidadeBase}
              </span>
            </div>
          </>
        )}
        {doseEfetiva != null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dose efetiva</span>
            <span className="font-semibold tabular-nums">
              {doseEfetiva.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {dose?.unit === 'kg' ? 'kg' : 'L'}/ha
            </span>
          </div>
        )}
      </div>

      {/* Rateio */}
      {sel.length > 0 && total > 0 && (
        <div className="space-y-2">
          <div className="inline-flex rounded-lg border border-border bg-muted/20 p-0.5 text-xs">
            <button
              type="button" onClick={() => setMode('proporcional')}
              className={`px-3 py-1 rounded-md ${mode === 'proporcional' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >Distribuir proporcionalmente pela área</button>
            <button
              type="button" onClick={() => setMode('manual')}
              className={`px-3 py-1 rounded-md ${mode === 'manual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >Ajustar distribuição</button>
          </div>

          {mode === 'proporcional' ? (
            <div className="space-y-1">
              {rateado.map((r) => (
                <div key={r.talhao_id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-muted/10">
                  <span className="truncate flex-1">{r.talhao_nome}</span>
                  <span className="text-muted-foreground tabular-nums mr-3">{(r.area_ha || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha</span>
                  <span className="font-medium tabular-nums w-24 text-right">{(r.quantidade_rateada || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {unidade}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {rateado.map((r) => (
                <div key={r.talhao_id} className="flex items-center gap-2 text-xs">
                  <span className="truncate flex-1">{r.talhao_nome}</span>
                  <span className="text-muted-foreground tabular-nums">{(r.area_ha || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha</span>
                  <Input type="number" inputMode="decimal" step="any" min="0"
                    value={manual[r.talhao_id] ?? r.quantidade_rateada ?? ''}
                    onChange={(e) => setManual(r.talhao_id, e.target.value)}
                    className="h-8 w-28 text-sm tabular-nums" />
                  <span className="text-muted-foreground w-8">{unidade}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs px-2">
                <span className="text-muted-foreground">Soma distribuída</span>
                <span className={`font-semibold tabular-nums ${Math.abs(soma - total) > 0.0001 ? 'text-destructive' : 'text-foreground'}`}>
                  {soma.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} / {total.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {unidade}
                </span>
              </div>
            </div>
          )}
          {erro && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <ChevronUp className="w-3 h-3" /> {erro}
            </p>
          )}
        </div>
      )}
    </div>
  );
}