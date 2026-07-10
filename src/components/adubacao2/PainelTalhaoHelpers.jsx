import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronUp, RefreshCcw } from 'lucide-react';
import { classificarZn, classificarCu, classificarMn } from '@/lib/tabelasNutricionais';
import { CheckCircle2, Clock } from 'lucide-react';

export const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

export const TODOS_ELEMENTOS_GRID = [
  { key: 'N',  label: 'N',    tipo: 'dose',  unit: 'kg/ha',  temRec: true,  nutField: 'n_pct' },
  { key: 'P',  label: 'P₂O₅', tipo: 'dose',  unit: 'kg/ha',  temRec: true,  nutField: 'p2o5_pct' },
  { key: 'K',  label: 'K₂O',  tipo: 'dose',  unit: 'kg/ha',  temRec: true,  nutField: 'k2o_pct' },
  { key: 'B',  label: 'B',    tipo: 'dose',  unit: 'kg/ha',  temRec: true,  nutField: 'b_pct' },
  { key: 'Zn', label: 'Zn',   tipo: 'class', temRec: false,  nutField: 'zn_pct' },
  { key: 'Cu', label: 'Cu',   tipo: 'class', temRec: false,  nutField: 'cu_pct' },
  { key: 'Mn', label: 'Mn',   tipo: 'class', temRec: false,  nutField: 'mn_pct' },
  { key: 'Ca', label: 'Ca',   tipo: 'dose',  unit: 'kg/ha',  temRec: false,  nutField: 'ca_pct' },
  { key: 'Mg', label: 'Mg',   tipo: 'dose',  unit: 'kg/ha',  temRec: false,  nutField: 'mg_pct' },
  { key: 'Fe', label: 'Fe',   tipo: 'class', temRec: false,  nutField: 'fe_pct' },
  { key: 'MO', label: 'M.O.', tipo: 'valor', temRec: false,  nutField: null },
];

export function calcMicros(analise) {
  if (!analise) return {};
  return {
    Zn: analise.zinco != null ? classificarZn(analise.zinco) : null,
    Cu: analise.cobre != null ? classificarCu(analise.cobre) : null,
    Mn: analise.manganes != null ? classificarMn(analise.manganes) : null,
  };
}

export function classBadgeColor(classe) {
  if (classe === 'Baixo')  return 'text-red-600 bg-red-50 border-red-200';
  if (classe === 'Médio')  return 'text-amber-600 bg-amber-50 border-amber-200';
  if (classe === 'Bom')    return 'text-blue-600 bg-blue-50 border-blue-200';
  if (classe === 'Ótimo')  return 'text-green-600 bg-green-50 border-green-200';
  return 'text-muted-foreground bg-muted border-border';
}

export function fmt(v, dec = 0) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmtR(v) {
  if (v == null || isNaN(v)) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ResumoParcelamento({ parc }) {
  if (!parc || parc.parcelas.length === 0) return <span className="text-muted-foreground text-xs">Nenhum</span>;
  const partes = parc.parcelas.map((p) => {
    const mesesStr = (p.meses || []).join('/');
    return `${p.pct}% ${mesesStr}`;
  });
  return <span className="text-xs font-mono">{parc.parcelas.length}x · {partes.join(' · ')}</span>;
}

export function EditorParcelamento({ parc, onChange, onAplicarTodos, onRecolher }) {
  const [local, setLocal] = useState(() => parc || { parcelas: [{ pct: 100, meses: [] }] });

  const setNumParcelas = (n) => {
    setLocal(prev => {
      const novas = Array.from({ length: n }, (_, i) => prev.parcelas[i] || { pct: Math.round(100 / n), meses: [] });
      return { parcelas: novas };
    });
  };

  const setPct = (i, val) => {
    setLocal(prev => {
      const p = [...prev.parcelas];
      p[i] = { ...p[i], pct: val };
      return { parcelas: p };
    });
  };

  const toggleMes = (i, mes) => {
    setLocal(prev => {
      const p = [...prev.parcelas];
      const ms = p[i].meses || [];
      p[i] = { ...p[i], meses: ms.includes(mes) ? ms.filter(m => m !== mes) : [...ms, mes] };
      return { parcelas: p };
    });
  };

  const salvar = () => onChange(local);

  return (
    <div className="mt-2 p-3 bg-muted/20 border border-border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Parcelas:</span>
          {[1,2,3,4,5].map(n => (
            <button key={n} type="button"
              onClick={() => setNumParcelas(n)}
              className={`w-7 h-7 text-xs rounded border transition-colors ${local.parcelas.length === n ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted/60'}`}>
              {n}x
            </button>
          ))}
        </div>
        {onRecolher && (
          <button type="button" onClick={onRecolher}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 hover:bg-muted/40 transition-colors">
            <ChevronUp className="w-3 h-3" /> Recolher
          </button>
        )}
      </div>
      {local.parcelas.map((p, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Parcela {i+1}:</span>
            <input type="number" min="0" max="100" value={p.pct}
              onChange={e => setPct(i, Number(e.target.value))}
              className="w-16 h-6 text-xs border border-input rounded px-2 text-right bg-background tabular-nums" />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
          <div className="flex flex-wrap gap-1 ml-16">
            {MESES.map(m => (
              <button key={m} type="button"
                onClick={() => toggleMes(i, m)}
                className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${(p.meses||[]).includes(m) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted/60'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="text-xs h-7" onClick={salvar}>Aplicar</Button>
        {onAplicarTodos && (
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { salvar(); onAplicarTodos(local); }}>
            Aplicar para todos os talhões com este produto
          </Button>
        )}
      </div>
    </div>
  );
}

export function DropdownTrocarProduto({ todos, onTrocar }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aberto]);

  const produtosFiltrados = useMemo(() => {
    const q = busca.toLowerCase();
    return todos
      .filter(p => !q || (p.nome || '').toLowerCase().includes(q))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [todos, busca]);

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setAberto(a => !a)}
        className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary border border-dashed border-muted-foreground/30 hover:border-primary rounded px-1.5 py-0.5 transition-colors">
        <RefreshCcw className="w-2.5 h-2.5" /> Trocar
      </button>
      {aberto && (
        <div className="absolute z-50 left-0 top-full mt-1 w-64 bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <input autoFocus type="text" placeholder="Buscar produto..."
              value={busca} onChange={e => setBusca(e.target.value)}
              className="w-full h-7 text-xs border border-input rounded px-2 bg-background" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {produtosFiltrados.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum produto encontrado</p>
            ) : produtosFiltrados.map(p => (
              <button key={p.id} type="button"
                onClick={() => { onTrocar(p); setAberto(false); setBusca(''); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 truncate">
                {p.nome}
                {p.fornecedor && <span className="text-muted-foreground ml-1">· {p.fornecedor}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function StatusBadgePlan({ rec }) {
  if (!rec) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="w-3 h-3" /> Pendente
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
      <CheckCircle2 className="w-3 h-3" /> Calculado
    </span>
  );
}