import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ChevronDown, AlertTriangle, Save, Loader2 } from 'lucide-react';

const NUTRIENTES = [
  { key: 'n_pct',    label: 'N',    recKey: 'N' },
  { key: 'p2o5_pct', label: 'P₂O₅', recKey: 'P' },
  { key: 'k2o_pct',  label: 'K₂O',  recKey: 'K' },
  { key: 'b_pct',    label: 'B',    recKey: 'B' },
  { key: 'mg_pct',   label: 'Mg',   recKey: 'Mg' },
  { key: 'zn_pct',   label: 'Zn',   recKey: 'Zn' },
  { key: 'cu_pct',   label: 'Cu',   recKey: 'Cu' },
  { key: 'mn_pct',   label: 'Mn',   recKey: 'Mn' },
  { key: 'fe_pct',   label: 'Fe',   recKey: 'Fe' },
];

const PCT_DEFAULTS = {
  1:[100],2:[50,50],3:[34,33,33],4:[25,25,25,25],
  5:[20,20,20,20,20],6:[17,17,17,17,16,16],
};
const APLIC_LABELS = ['1ª','2ª','3ª','4ª','5ª','6ª'];
const MESES_LIST = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

function calcDoses(doseNutKgHa, pctNut, areaHa, numPlantas, metros) {
  const pct = parseFloat(pctNut) || 0;
  const rec = parseFloat(doseNutKgHa) || 0;
  const area = parseFloat(areaHa) || 0;
  if (!pct || !rec || !area) return null;
  const doseHa = rec / (pct / 100);
  const total = doseHa * area;
  return {
    doseHa: Math.round(doseHa * 10) / 10,
    total: Math.round(total),
    ton: (total / 1000).toFixed(3),
    sc50: (total / 50).toFixed(1),
    gPlanta: numPlantas > 0 ? ((total * 1000) / numPlantas).toFixed(1) : null,
    gMetro: metros > 0 ? ((total * 1000) / metros).toFixed(1) : null,
  };
}

function getMetros(talhao) {
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',','.')));
  const linhaM = partes?.[0] || 0;
  if (talhao?.num_plantas && linhaM > 0) return talhao.num_plantas * linhaM;
  if (talhao?.area_ha && linhaM > 0) return Math.round((talhao.area_ha * 10000) / linhaM);
  return 0;
}

// Dropdown de produto
function ProdutoDropdown({ nutKey, nutLabel, todos, produtoId, onChange }) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  const produto = todos.find(p => p.id === produtoId) || null;

  useEffect(() => {
    if (!aberto) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [aberto]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return todos
      .filter(p => (p.nome||'').toLowerCase().includes(q))
      .sort((a,b) => (parseFloat(b[nutKey])||0) - (parseFloat(a[nutKey])||0));
  }, [todos, busca, nutKey]);

  return (
    <div ref={ref} className="relative">
      <button type="button"
        className="w-full h-8 text-xs border border-input rounded px-2 text-left flex items-center justify-between bg-transparent hover:bg-muted/20"
        onClick={() => setAberto(a=>!a)}>
        <span className={produto ? 'truncate text-foreground' : 'text-muted-foreground'}>
          {produto ? produto.nome : '— Selecionar —'}
        </span>
        <ChevronDown className="w-3 h-3 shrink-0 ml-1 text-muted-foreground" />
      </button>
      {aberto && (
        <div className="absolute z-50 top-full left-0 w-72 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <input autoFocus className="w-full h-6 text-xs border border-input rounded px-2 bg-background"
              placeholder="Buscar…" value={busca} onChange={e=>setBusca(e.target.value)} />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button type="button" className="w-full text-left px-3 py-1.5 hover:bg-muted/60 text-xs text-muted-foreground border-b border-border/30"
              onMouseDown={e=>e.preventDefault()}
              onClick={()=>{onChange(null);setAberto(false);setBusca('');}}>
              — Nenhum produto —
            </button>
            {filtrados.map(p=>{
              const pct = parseFloat(p[nutKey])||0;
              return (
                <button key={p.id} type="button"
                  className="w-full text-left px-3 py-1.5 hover:bg-muted/60 text-xs border-b border-border/30 last:border-0"
                  onMouseDown={e=>e.preventDefault()}
                  onClick={()=>{onChange(p.id);setAberto(false);setBusca('');}}>
                  <div className="flex justify-between">
                    <span className="font-medium truncate">{p.nome}</span>
                    {pct>0 && <span className="text-primary ml-2 shrink-0">{nutLabel}: {pct}%</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Bloco de um nutriente com produto + parcelamento
function BlocoNutriente({ nut, rec, talhao, todos, estado, onChange }) {
  const { produtoId, doseManual, numAplic=1, pcts=[100], meses=[[]] } = estado;
  const produto = todos.find(p => p.id === produtoId) || null;
  const area = talhao?.area_ha || 0;
  const numPlantas = talhao?.num_plantas || 0;
  const metros = getMetros(talhao);
  const recKgHa = rec?.[nut.recKey];
  const doseAtiva = doseManual !== '' && doseManual != null ? parseFloat(doseManual) : recKgHa;
  const pctNut = produto ? parseFloat(produto[nut.key])||0 : 0;
  const dosesCalc = produto && doseAtiva && pctNut > 0
    ? calcDoses(doseAtiva, pctNut, area, numPlantas, metros) : null;

  const [preco, setPreco] = useState(estado.preco||'');
  const precoNum = parseFloat(preco)||0;
  const custoHa = dosesCalc && precoNum>0 ? dosesCalc.doseHa * precoNum : null;

  const setNumAplic = n => {
    onChange({...estado, numAplic:n, pcts: PCT_DEFAULTS[n]||[100], meses: Array(n).fill([])});
  };
  const setPct = (i, v) => { const a=[...pcts]; a[i]=v; onChange({...estado,pcts:a}); };
  const setMes = (i, m) => {
    const arr = Array.isArray(meses[i]) ? meses[i] : [];
    const novo = arr.includes(m) ? arr.filter(x=>x!==m) : arr.length<3 ? [...arr,m] : arr;
    const novos=[...meses]; novos[i]=novo;
    onChange({...estado,meses:novos});
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border">
        <span className="font-bold text-sm text-primary w-10 shrink-0">{nut.label}</span>
        <span className="text-xs text-muted-foreground">Rec:</span>
        <span className="text-xs font-semibold">{recKgHa != null ? `${recKgHa} kg/ha` : '—'}</span>
        {recKgHa == null && <span className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Sem recomendação</span>}
      </div>
      <div className="p-3 space-y-3">
        {/* Produto + dose manual + preço */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-1">
            <Label className="text-[10px] text-muted-foreground mb-0.5 block">Produto</Label>
            <ProdutoDropdown nutKey={nut.key} nutLabel={nut.label} todos={todos} produtoId={produtoId}
              onChange={id => onChange({...estado, produtoId: id})} />
            {produto && pctNut===0 && (
              <p className="text-[10px] text-amber-600 mt-0.5">Produto sem {nut.label}</p>
            )}
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground mb-0.5 block">Dose manual (kg/ha)</Label>
            <input type="number" value={doseManual??''} step="0.1"
              onChange={e=>onChange({...estado, doseManual: e.target.value})}
              className="w-full h-8 text-xs border border-input rounded px-2 bg-background tabular-nums"
              placeholder={recKgHa != null ? String(recKgHa) : 'kg/ha'} />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground mb-0.5 block">Preço (R$/kg)</Label>
            <input type="number" value={preco} step="0.01" min="0"
              onChange={e=>{setPreco(e.target.value); onChange({...estado,preco:e.target.value});}}
              className="w-full h-8 text-xs border border-input rounded px-2 bg-background tabular-nums"
              placeholder="0,00" />
          </div>
        </div>

        {/* Resultado do cálculo */}
        {dosesCalc && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs mb-2">
              {[
                {l:'Dose prod.',v:`${dosesCalc.doseHa} kg/ha`},
                {l:'Total',v:`${dosesCalc.total} kg`},
                {l:'Sacos 50kg',v:`${dosesCalc.sc50} sc`},
                {l:'Toneladas',v:`${dosesCalc.ton} t`},
                dosesCalc.gPlanta && {l:'g/planta',v:`${dosesCalc.gPlanta} g`},
                dosesCalc.gMetro  && {l:'g/metro', v:`${dosesCalc.gMetro} g`},
              ].filter(Boolean).map(x=>(
                <div key={x.l} className="bg-white rounded border border-green-100 p-1.5 text-center">
                  <p className="text-muted-foreground text-[10px]">{x.l}</p>
                  <p className="font-bold text-xs">{x.v}</p>
                </div>
              ))}
              {custoHa && (
                <div className="bg-amber-50 rounded border border-amber-200 p-1.5 text-center">
                  <p className="text-amber-600 text-[10px]">Custo/ha</p>
                  <p className="font-bold text-xs text-amber-800">{custoHa.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
                </div>
              )}
            </div>
            {/* Parcelamento */}
            <div className="border-t border-green-200 pt-2">
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-[10px] font-semibold text-green-800">Parcelamento:</span>
                {[1,2,3,4,5,6].map(n=>(
                  <button key={n} type="button" onClick={()=>setNumAplic(n)}
                    className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${numAplic===n?'bg-green-700 text-white border-green-700':'bg-white text-muted-foreground border-border hover:bg-muted/30'}`}>
                    {n}x
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {Array.from({length:numAplic}).map((_,i)=>{
                  const pct = parseFloat(pcts[i])||0;
                  const kgAplic = dosesCalc.total*(pct/100);
                  const mesArr = Array.isArray(meses[i]) ? meses[i] : [];
                  return (
                    <div key={i} className="bg-white rounded border border-green-100 p-2 space-y-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-semibold text-green-700">{APLIC_LABELS[i]}:</span>
                        <input type="number" value={pcts[i]??''} onChange={e=>setPct(i,e.target.value)}
                          className="w-14 h-6 text-[10px] border border-input rounded px-1 bg-background tabular-nums" />
                        <span className="text-[10px] text-muted-foreground">%</span>
                        <span className="text-[10px] text-muted-foreground ml-1">= {Math.round(kgAplic)} kg</span>
                      </div>
                      <div className="flex flex-wrap gap-0.5">
                        {MESES_LIST.map(m=>(
                          <button key={m} type="button" onClick={()=>setMes(i,m)}
                            className={`px-1 py-0.5 text-[9px] rounded border transition-colors ${mesArr.includes(m)?'bg-green-700 text-white border-green-700':'bg-white text-muted-foreground border-border/60 hover:bg-green-50'}`}>
                            {m}
                          </button>
                        ))}
                      </div>
                      {mesArr.length>0 && <p className="text-[9px] text-green-700">{mesArr.join(', ')}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ModalDetalheTalhao({ resultado, todos, detalhamento, onSave, onClose }) {
  const { talhao, rec, mediaBienal } = resultado;

  // Estado local de detalhamento: { [nutKey]: { produtoId, doseManual, numAplic, pcts, meses, preco } }
  const [estado, setEstado] = useState(() => {
    const init = {};
    NUTRIENTES.forEach(n => {
      init[n.key] = detalhamento?.[n.key] || { produtoId: null, doseManual: '', numAplic: 1, pcts: [100], meses: [[]], preco: '' };
    });
    return init;
  });
  const [salvando, setSalvando] = useState(false);

  const handleSave = async () => {
    setSalvando(true);
    await onSave(estado);
    setSalvando(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">
            Detalhamento — {talhao.nome}
            {mediaBienal != null && <span className="ml-2 text-xs font-normal text-muted-foreground">Média: {mediaBienal.toFixed(1)} sc/ha</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {NUTRIENTES.map(nut => (
            <BlocoNutriente
              key={nut.key}
              nut={nut}
              rec={rec}
              talhao={talhao}
              todos={todos}
              estado={estado[nut.key] || { produtoId: null, doseManual: '', numAplic: 1, pcts: [100], meses: [[]], preco: '' }}
              onChange={novo => setEstado(prev => ({ ...prev, [nut.key]: novo }))}
            />
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border mt-3">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          <Button size="sm" onClick={handleSave} disabled={salvando} className="gap-2">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar detalhamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}