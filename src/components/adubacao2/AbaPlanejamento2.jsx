import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart2, Save, ChevronRight, ChevronDown, MoreVertical, CheckCircle2, Clock, Filter, X, ChevronUp, RefreshCcw } from 'lucide-react';
import { classificarZn, classificarCu, classificarMn } from '@/lib/tabelasNutricionais';
import { sugerirProdutosInteligente } from '@/lib/sugerirProdutos2';

// ── helpers ────────────────────────────────────────────────────────────────────

const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

function calcMicros(analise) {
  if (!analise) return {};
  return {
    Zn: analise.zinco != null ? classificarZn(analise.zinco) : null,
    Cu: analise.cobre != null ? classificarCu(analise.cobre) : null,
    Mn: analise.manganes != null ? classificarMn(analise.manganes) : null,
  };
}

function classBadgeColor(classe) {
  if (classe === 'Baixo')  return 'text-red-600 bg-red-50 border-red-200';
  if (classe === 'Médio')  return 'text-amber-600 bg-amber-50 border-amber-200';
  if (classe === 'Bom')    return 'text-blue-600 bg-blue-50 border-blue-200';
  if (classe === 'Ótimo')  return 'text-green-600 bg-green-50 border-green-200';
  return 'text-muted-foreground bg-muted border-border';
}

function fmt(v, dec = 0) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtR(v) {
  if (v == null || isNaN(v)) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const KEY_PARA_LABEL = { n_pct: 'N', k2o_pct: 'K₂O', p2o5_pct: 'P₂O₅', b_pct: 'B' };

/** Monta lista de linhas de produto a partir das sugestões do inteligente */
function montarLinhasProdutos(todos, rec, trocas = {}) {
  if (!rec || !todos.length) return [];
  const sugestoes = sugerirProdutosInteligente(todos, { N: rec.N, P: rec.P, K: rec.K, B: rec.B });

  const principalId = sugestoes['n_pct']?.produtoId || null;

  const mapa = {};
  for (const [nutKey, sug] of Object.entries(sugestoes)) {
    if (!sug?.produtoId) continue;
    // Se há troca manual para este nutriente, usa o produto trocado
    const prodId = trocas[nutKey] || sug.produtoId;
    const prod = todos.find(p => p.id === prodId) || todos.find(p => p.id === sug.produtoId);
    if (!prod) continue;
    if (!mapa[prod.id]) {
      mapa[prod.id] = { produto: prod, nutrientes: [], ehPrincipal: prod.id === principalId, nutKey };
    }
    const pct = parseFloat(prod[nutKey]) || 0;
    const nutSimbolo = KEY_PARA_LABEL[nutKey] || nutKey;
    const nutRec = rec[nutSimbolo === 'K₂O' ? 'K' : nutSimbolo === 'P₂O₅' ? 'P' : nutSimbolo] || 0;
    if (pct > 0 && nutRec > 0) {
      const doseKgHa = Math.round((nutRec / (pct / 100)) * 10) / 10;
      const fornecido = doseKgHa * (pct / 100);
      mapa[prod.id].nutrientes.push({ label: nutSimbolo, fornecido });
      if (!mapa[prod.id].doseKgHa || nutKey === 'n_pct') {
        mapa[prod.id].doseKgHa = doseKgHa;
      }
    }
  }

  return Object.values(mapa);
}

// ── Editor de Parcelamento ─────────────────────────────────────────────────────

function ResumoParcelamento({ parc }) {
  if (!parc || parc.parcelas.length === 0) return <span className="text-muted-foreground text-xs">Nenhum</span>;
  const partes = parc.parcelas.map((p) => {
    const mesesStr = (p.meses || []).join('/');
    return `${p.pct}% ${mesesStr}`;
  });
  return <span className="text-xs font-mono">{parc.parcelas.length}x · {partes.join(' · ')}</span>;
}

function EditorParcelamento({ parc, onChange, onAplicarTodos, onRecolher }) {
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
      {/* CORREÇÃO 3: botão Recolher no canto superior direito */}
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

// ── Dropdown de troca de produto (CORREÇÃO 2) ──────────────────────────────────

function DropdownTrocarProduto({ todos, onTrocar }) {
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
            <input
              autoFocus
              type="text"
              placeholder="Buscar produto..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full h-7 text-xs border border-input rounded px-2 bg-background"
            />
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

// ── Linha manual para elementos extras marcados ───────────────────────────────

function LinhaElementoExtra({ elLabel, nutField, todos, area, precos, onPrecoChange, parcelamentos, onParcelamentoChange, onAplicarParcTodos }) {
  const [produtoId, setProdutoId] = useState('');
  const [doseManual, setDoseManual] = useState('');
  const [busca, setBusca] = useState('');
  const [dropAberto, setDropAberto] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    if (!dropAberto) return;
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropAberto(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropAberto]);

  const produtosDoNutriente = useMemo(() => {
    if (!nutField) return todos;
    return todos
      .filter(p => (parseFloat(p[nutField]) || 0) > 0)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [todos, nutField]);

  const produtosFiltrados = useMemo(() => {
    const q = busca.toLowerCase();
    return produtosDoNutriente.filter(p => !q || (p.nome || '').toLowerCase().includes(q));
  }, [produtosDoNutriente, busca]);

  const produtoSelecionado = todos.find(p => p.id === produtoId) || null;
  const doseNum = doseManual !== '' ? parseFloat(doseManual) : null;
  const preco = produtoId ? precos?.[produtoId] : null;
  const precoNum = preco != null && preco !== '' ? parseFloat(preco) : null;
  const custoHa = precoNum != null && doseNum != null ? precoNum * doseNum : null;
  const totalKg = doseNum != null && area ? Math.round(doseNum * area * 10) / 10 : null;
  const custoTotal = custoHa != null && area ? custoHa * area : null;
  const parc = produtoId ? parcelamentos?.[produtoId] : null;
  const [expandidoParc, setExpandidoParc] = useState(false);

  return (
    <React.Fragment>
      <tr className="border-b border-border/50 last:border-0 hover:bg-muted/10 bg-amber-50/30">
        <td className="px-3 py-2 font-medium whitespace-nowrap max-w-[200px]">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">{elLabel}</span>
            <div ref={dropRef} className="relative">
              <button type="button" onClick={() => setDropAberto(a => !a)}
                className="h-6 text-xs border border-input rounded px-2 bg-background flex items-center gap-1 w-40 hover:bg-muted/30">
                <span className="truncate flex-1 text-left">
                  {produtoSelecionado ? produtoSelecionado.nome : <span className="text-muted-foreground">Escolher produto…</span>}
                </span>
                <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
              </button>
              {dropAberto && (
                <div className="absolute z-50 left-0 top-full mt-1 w-64 bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <input autoFocus type="text" placeholder="Buscar..."
                      value={busca} onChange={e => setBusca(e.target.value)}
                      className="w-full h-6 text-xs border border-input rounded px-2 bg-background" />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <button type="button" onClick={() => { setProdutoId(''); setDropAberto(false); setBusca(''); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60">
                      — Nenhum
                    </button>
                    {produtosFiltrados.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => { setProdutoId(p.id); setDropAberto(false); setBusca(''); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 truncate">
                        {p.nome}
                        {p.fornecedor && <span className="text-muted-foreground ml-1">· {p.fornecedor}</span>}
                      </button>
                    ))}
                    {produtosFiltrados.length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum produto encontrado</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-2">
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Manual</span>
        </td>
        <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
          {produtoSelecionado && nutField && (parseFloat(produtoSelecionado[nutField]) || 0) > 0
            ? `${elLabel} ${fmt(parseFloat(produtoSelecionado[nutField]), 1)}%`
            : '—'}
        </td>
        <td className="px-3 py-2 text-right">
          <input type="number" min="0" step="0.1" value={doseManual}
            onChange={e => setDoseManual(e.target.value)} placeholder="—"
            className="w-20 h-6 text-xs text-right border border-input rounded px-2 bg-background tabular-nums" />
        </td>
        <td className="px-3 py-2 tabular-nums text-right text-xs">{totalKg != null ? fmt(totalKg, 1) : '—'}</td>
        <td className="px-3 py-2">
          <input type="number" min="0" step="0.01"
            value={produtoId ? (preco ?? '') : ''}
            onChange={e => produtoId && onPrecoChange(produtoId, e.target.value)}
            placeholder="—" disabled={!produtoId}
            className="w-20 h-6 text-xs text-right border border-input rounded px-2 bg-background tabular-nums disabled:opacity-50" />
        </td>
        <td className="px-3 py-2 tabular-nums text-right text-xs">{custoHa != null ? fmtR(custoHa) : '—'}</td>
        <td className="px-3 py-2 tabular-nums text-right text-xs">{custoTotal != null ? fmtR(custoTotal) : '—'}</td>
        <td className="px-3 py-2">
          {produtoId ? (
            <button type="button" onClick={() => setExpandidoParc(a => !a)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ResumoParcelamento parc={parc} />
              <ChevronDown className={`w-3 h-3 transition-transform ${expandidoParc ? 'rotate-180' : ''}`} />
            </button>
          ) : <span className="text-muted-foreground text-xs">—</span>}
        </td>
      </tr>
      {expandidoParc && produtoId && (
        <tr>
          <td colSpan={9} className="px-3 pb-3 bg-amber-50/20">
            <EditorParcelamento
              parc={parc}
              onChange={p => onParcelamentoChange(produtoId, p)}
              onAplicarTodos={p => onAplicarParcTodos(produtoId, p)}
              onRecolher={() => setExpandidoParc(false)}
            />
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

// ── Tabela de Produtos do Talhão ───────────────────────────────────────────────

function TabelaProdutos({ linhas, area, precos, onPrecoChange, parcelamentos, onParcelamentoChange, onAplicarParcTodos, todos, onTrocarProduto, elementosExtras }) {
  const [expandidoProd, setExpandidoProd] = useState(null);

  const semLinhas = (!linhas || linhas.length === 0) && (!elementosExtras || elementosExtras.length === 0);
  if (semLinhas) {
    return (
      <div className="bg-muted/30 border border-dashed border-border rounded-lg px-4 py-3 text-xs text-muted-foreground text-center">
        Sem produtos sugeridos (verifique se há produtos cadastrados na Base de Insumos).
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/20">
            {['Produto','','Nutrientes fornecidos','Dose (kg/ha)','Total (kg)','Preço (R$/kg)','Custo/ha','Custo total','Parcelamento'].map(h => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(linhas || []).map(linha => {
            const { produto, nutrientes, ehPrincipal, doseKgHa, nutKey } = linha;
            const preco = precos?.[produto.id];
            const precoNum = preco != null && preco !== '' ? parseFloat(preco) : null;
            const custoHa = precoNum != null && doseKgHa != null ? precoNum * doseKgHa : null;
            const totalKg = doseKgHa != null && area ? Math.round(doseKgHa * area * 10) / 10 : null;
            const custoTotal = custoHa != null && area ? custoHa * area : null;
            const parc = parcelamentos?.[produto.id] || null;
            const expandido = expandidoProd === produto.id;
            const nutStr = nutrientes.map(n => `${n.label} ${fmt(n.fornecido, 1)}`).join(' · ');

            return (
              <React.Fragment key={produto.id}>
                <tr className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                  <td className="px-3 py-2 font-medium whitespace-nowrap max-w-[180px]">
                    <div className="flex flex-col gap-0.5">
                      <span className="truncate max-w-[160px]">{produto.nome}</span>
                      {/* CORREÇÃO 2: botão Trocar */}
                      {onTrocarProduto && nutKey && (
                        <DropdownTrocarProduto todos={todos} onTrocar={p => onTrocarProduto(nutKey, p)} />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {ehPrincipal
                      ? <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Principal</span>
                      : <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">Complemento</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-muted-foreground font-mono">{nutStr || '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-right">{fmt(doseKgHa, 1)}</td>
                  <td className="px-3 py-2 tabular-nums text-right">{fmt(totalKg, 1)}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min="0" step="0.01"
                      value={preco ?? ''}
                      onChange={e => onPrecoChange(produto.id, e.target.value)}
                      placeholder="—"
                      className="w-20 h-6 text-xs text-right border border-input rounded px-2 bg-background tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right">{custoHa != null ? fmtR(custoHa) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-right">{custoTotal != null ? fmtR(custoTotal) : '—'}</td>
                  <td className="px-3 py-2">
                    <button type="button"
                      onClick={() => setExpandidoProd(expandido ? null : produto.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <ResumoParcelamento parc={parc} />
                      <ChevronDown className={`w-3 h-3 transition-transform ${expandido ? 'rotate-180' : ''}`} />
                    </button>
                  </td>
                </tr>
                {expandido && (
                  <tr>
                    <td colSpan={9} className="px-3 pb-3">
                      <EditorParcelamento
                        parc={parc}
                        onChange={p => onParcelamentoChange(produto.id, p)}
                        onAplicarTodos={p => onAplicarParcTodos(produto.id, p)}
                        onRecolher={() => setExpandidoProd(null)}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {/* Linhas de elementos extras (Zn, Cu, Mn, Mg, Fe, MO) marcados no grid */}
          {(elementosExtras || []).map(el => (
            <LinhaElementoExtra
              key={`extra-${el.key}`}
              elLabel={el.label}
              nutField={el.nutField}
              todos={todos}
              area={area}
              precos={precos}
              onPrecoChange={onPrecoChange}
              parcelamentos={parcelamentos}
              onParcelamentoChange={onParcelamentoChange}
              onAplicarParcTodos={onAplicarParcTodos}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Painel expandido de um talhão ─────────────────────────────────────────────

const TODOS_ELEMENTOS_GRID = [
  { key: 'N',  label: 'N',    tipo: 'dose',  unit: 'kg/ha',  temRec: true,  nutField: 'n_pct' },
  { key: 'P',  label: 'P₂O₅', tipo: 'dose',  unit: 'kg/ha',  temRec: true,  nutField: 'p2o5_pct' },
  { key: 'K',  label: 'K₂O',  tipo: 'dose',  unit: 'kg/ha',  temRec: true,  nutField: 'k2o_pct' },
  { key: 'B',  label: 'B',    tipo: 'dose',  unit: 'kg/ha',  temRec: true,  nutField: 'b_pct' },
  { key: 'Zn', label: 'Zn',   tipo: 'class', temRec: false,  nutField: 'zn_pct' },
  { key: 'Cu', label: 'Cu',   tipo: 'class', temRec: false,  nutField: 'cu_pct' },
  { key: 'Mn', label: 'Mn',   tipo: 'class', temRec: false,  nutField: 'mn_pct' },
  { key: 'Mg', label: 'Mg',   tipo: 'dose',  unit: 'kg/ha',  temRec: false,  nutField: 'mg_pct' },
  { key: 'Fe', label: 'Fe',   tipo: 'class', temRec: false,  nutField: 'fe_pct' },
  { key: 'MO', label: 'M.O.', tipo: 'valor', temRec: false,  nutField: null },
];

function StatusBadgePlan({ rec }) {
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

function PainelTalhao({ resultado, todos, todosSemFiltro, precosProd, onPrecoChange, parcelamentosProd, onParcelamentoChange, onAplicarParcTodos, onFechar }) {
  const { talhao, rec, mediaBienal, analise, analise2040 } = resultado;
  const micros = calcMicros(analise);
  const area = talhao.area_ha || 0;

  // CORREÇÃO 1: checkbox por elemento
  // Elementos com déficit (temRec=true) começam marcados. Extras começam desmarcados.
  const [marcados, setMarcados] = useState(() => {
    const init = {};
    TODOS_ELEMENTOS_GRID.forEach(el => { init[el.key] = el.temRec; });
    return init;
  });

  // CORREÇÃO 2: trocas manuais de produto por nutriente { [nutKey]: produtoId }
  const [trocas, setTrocas] = useState({});

  const toggleMarcado = (key) => {
    setMarcados(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTrocarProduto = useCallback((nutKey, produto) => {
    setTrocas(prev => ({ ...prev, [nutKey]: produto.id }));
  }, []);

  // Linhas de produtos automáticos: apenas N/P/K/B marcados
  const linhasProdutos = useMemo(() => {
    if (!rec) return [];
    const recFiltrado = { ...rec };
    if (!marcados['N']) delete recFiltrado.N;
    if (!marcados['P']) delete recFiltrado.P;
    if (!marcados['K']) delete recFiltrado.K;
    if (!marcados['B']) delete recFiltrado.B;
    return montarLinhasProdutos(todos, recFiltrado, trocas);
  }, [todos, rec, marcados, trocas]);

  // Elementos extras marcados (não-rec): Zn, Cu, Mn, Mg, Fe, MO
  const elementosExtrasMarcados = useMemo(() => {
    return TODOS_ELEMENTOS_GRID.filter(el => !el.temRec && marcados[el.key]);
  }, [marcados]);

  // Rodapé: totais
  const totais = useMemo(() => {
    let doseTotalHa = 0, totalKgAll = 0, custoTotalHa = 0, custoTotalTalhao = 0;
    linhasProdutos.forEach(l => {
      const dose = l.doseKgHa || 0;
      doseTotalHa += dose;
      totalKgAll += area ? dose * area : 0;
      const preco = precosProd?.[l.produto.id];
      const precoNum = preco != null && preco !== '' ? parseFloat(preco) : null;
      if (precoNum != null) {
        custoTotalHa += dose * precoNum;
        custoTotalTalhao += dose * precoNum * (area || 0);
      }
    });
    return { doseTotalHa, totalKgAll, custoTotalHa, custoTotalTalhao };
  }, [linhasProdutos, precosProd, area]);

  return (
    <div className="bg-muted/20 border-l-4 border-primary px-5 py-4 space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-base text-foreground">{talhao.nome}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
            {talhao.area_ha && <span>{talhao.area_ha} ha</span>}
            {talhao.num_plantas && <span>{talhao.num_plantas.toLocaleString()} plantas</span>}
            {mediaBienal != null && <span>Média: <strong className="text-foreground">{mediaBienal.toFixed(1)} sc/ha</strong></span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadgePlan rec={rec} />
          <button type="button" onClick={onFechar}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 hover:bg-muted/40 transition-colors">
            Fechar detalhes <ChevronDown className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>
      </div>

      {/* CORREÇÃO 1: Grid de nutrientes — todos sempre visíveis com checkbox */}
      {rec ? (
        <div className="space-y-2">
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
            {TODOS_ELEMENTOS_GRID.map(el => {
              const ativo = marcados[el.key];
              let valor = null;
              let classeBadge = null;

              if (el.tipo === 'dose' && el.temRec) {
                valor = rec[el.key];
              } else if (el.tipo === 'dose' && !el.temRec) {
                // dose manual (Mg) — sem valor automático
              } else if (el.tipo === 'class') {
                const cls = micros[el.key];
                if (cls?.classe) classeBadge = cls.classe;
              } else if (el.tipo === 'valor') {
                valor = analise?.materia_organica ?? null;
              }

              const temDeficit = el.temRec && valor != null && valor > 0;

              // ── Teor do solo para exibição ──────────────────────────────
              let teor = null; // { texto, unidade }
              const fmtT = (v) => v != null ? Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : null;
              if (el.key === 'K') {
                const k0 = analise?.potassio != null ? fmtT(analise.potassio) : null;
                const k1 = analise2040?.potassio != null ? fmtT(analise2040.potassio) : null;
                if (k0 != null && k1 != null) teor = { texto: `${k0} (0-20) | ${k1} (20-40)`, unidade: 'mg/dm³' };
                else if (k0 != null) teor = { texto: k0, unidade: 'mg/dm³' };
              } else if (el.key === 'P') {
                const p0 = analise?.fosforo != null ? fmtT(analise.fosforo) : null;
                const p1 = analise2040?.fosforo != null ? fmtT(analise2040.fosforo) : null;
                if (p0 != null && p1 != null) teor = { texto: `${p0} (0-20) | ${p1} (20-40)`, unidade: 'mg/dm³' };
                else if (p0 != null) teor = { texto: p0, unidade: 'mg/dm³' };
              } else if (el.key === 'Ca') {
                const v = analise?.calcio; if (v != null) teor = { texto: fmtT(v), unidade: 'cmolc/dm³' };
              } else if (el.key === 'Mg') {
                const v = analise?.magnesio; if (v != null) teor = { texto: fmtT(v), unidade: 'cmolc/dm³' };
              } else if (el.key === 'B') {
                const v = analise?.boro; if (v != null) teor = { texto: fmtT(v), unidade: 'mg/dm³' };
              } else if (el.key === 'Zn') {
                const v = analise?.zinco; if (v != null) teor = { texto: fmtT(v), unidade: 'mg/dm³' };
              } else if (el.key === 'Cu') {
                const v = analise?.cobre; if (v != null) teor = { texto: fmtT(v), unidade: 'mg/dm³' };
              } else if (el.key === 'Mn') {
                const v = analise?.manganes; if (v != null) teor = { texto: fmtT(v), unidade: 'mg/dm³' };
              } else if (el.key === 'Fe') {
                const v = analise?.ferro; if (v != null) teor = { texto: fmtT(v), unidade: 'mg/dm³' };
              }

              return (
                <div key={el.key}
                  className={`relative bg-card border rounded-lg p-2.5 text-center transition-all ${ativo ? 'border-primary/40 shadow-sm' : 'border-border opacity-60'}`}>
                  {/* Checkbox no canto superior direito */}
                  <div className="absolute top-1.5 right-1.5">
                    <input type="checkbox" checked={ativo}
                      onChange={() => toggleMarcado(el.key)}
                      className="w-3 h-3 rounded accent-primary cursor-pointer" />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium mb-1">{el.label}</p>
                  {el.tipo === 'dose' && el.temRec && (
                    <>
                      <p className={`text-base font-bold tabular-nums ${ativo ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {valor != null ? valor : '—'}
                      </p>
                      {valor != null && <p className="text-[9px] text-muted-foreground">{el.unit}</p>}
                    </>
                  )}
                  {el.tipo === 'class' && (
                    <>
                      <p className="text-base font-bold text-muted-foreground">—</p>
                      {classeBadge && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${classBadgeColor(classeBadge)}`}>
                          {classeBadge}
                        </span>
                      )}
                    </>
                  )}
                  {el.tipo === 'valor' && (
                    <>
                      <p className={`text-base font-bold tabular-nums ${ativo ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {valor != null ? fmt(valor, 1) : '—'}
                      </p>
                      {valor != null && <p className="text-[9px] text-muted-foreground">dag/kg</p>}
                    </>
                  )}
                  {el.tipo === 'dose' && !el.temRec && (
                    <p className="text-base font-bold text-muted-foreground">—</p>
                  )}
                  {/* Teor do solo */}
                  {teor && (
                    <p className="text-[9px] text-blue-600 mt-1 leading-tight font-medium truncate" title={`Solo: ${teor.texto} ${teor.unidade}`}>
                      Solo: {teor.texto} {teor.unidade}
                    </p>
                  )}
                  {/* Indicador de déficit */}
                  {temDeficit && ativo && (
                    <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-primary"></div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-primary mr-1 align-middle"></span>
            Elementos com déficit (marcados automaticamente). Marque outros para adicionar à tabela de produtos.
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
          Sem recomendação calculada. Informe produtividade e análise de solo na aba Análises.
        </div>
      )}

      {/* Tabela de Produtos */}
      {rec && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Produtos Recomendados</p>
          <TabelaProdutos
            linhas={linhasProdutos}
            area={area}
            precos={precosProd}
            onPrecoChange={onPrecoChange}
            parcelamentos={parcelamentosProd}
            onParcelamentoChange={onParcelamentoChange}
            onAplicarParcTodos={onAplicarParcTodos}
            todos={todosSemFiltro}
            onTrocarProduto={handleTrocarProduto}
            elementosExtras={elementosExtrasMarcados}
          />
        </div>
      )}

      {/* Rodapé: 4 cards de totais */}
      {rec && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {[
            { label: 'Dose total (kg/ha)', value: fmt(totais.doseTotalHa, 1) },
            { label: 'Total aplicado (kg)', value: fmt(totais.totalKgAll, 0) },
            { label: 'Custo total/ha', value: totais.custoTotalHa > 0 ? fmtR(totais.custoTotalHa) : '—' },
            { label: 'Custo total do talhão', value: totais.custoTotalTalhao > 0 ? fmtR(totais.custoTotalTalhao) : '—', destaque: true },
          ].map(c => (
            <div key={c.label} className={`rounded-lg border px-3 py-2.5 ${c.destaque ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'}`}>
              <p className="text-[10px] text-muted-foreground mb-0.5">{c.label}</p>
              <p className={`text-sm font-bold tabular-nums ${c.destaque ? 'text-primary' : 'text-foreground'}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Filtro global de Fornecedor / Produto ─────────────────────────────────────
// CORREÇÃO 5: produtos sem fornecedor sempre incluídos na sugestão

function FiltroProdutosGlobal({ todos, filtro, onChange }) {
  const [dropFornAberto, setDropFornAberto] = useState(false);
  const dropRef = useRef(null);

  const fornecedores = useMemo(() => {
    const set = new Set();
    todos.forEach(p => {
      const temNPK = (parseFloat(p.n_pct) || 0) > 0 ||
                     (parseFloat(p.p2o5_pct) || 0) > 0 ||
                     (parseFloat(p.k2o_pct) || 0) > 0;
      if (temNPK && p.fornecedor) set.add(p.fornecedor);
    });
    return Array.from(set).sort();
  }, [todos]);

  const produtosFiltrados = useMemo(() => {
    return todos
      .filter(p => {
        const temNPK = (parseFloat(p.n_pct) || 0) > 0 ||
                       (parseFloat(p.p2o5_pct) || 0) > 0 ||
                       (parseFloat(p.k2o_pct) || 0) > 0;
        if (!temNPK) return false;
        if (filtro.fornecedores.length > 0 && !filtro.fornecedores.includes(p.fornecedor)) return false;
        return true;
      })
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [todos, filtro.fornecedores]);

  useEffect(() => {
    if (!dropFornAberto) return;
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropFornAberto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropFornAberto]);

  const toggleFornecedor = (f) => {
    const novosForn = filtro.fornecedores.includes(f)
      ? filtro.fornecedores.filter(x => x !== f)
      : [...filtro.fornecedores, f];
    onChange({ fornecedores: novosForn, produtoId: '' });
  };

  const handleProduto = (v) => {
    onChange({ ...filtro, produtoId: v === '__todos__' ? '' : v });
  };

  const limpar = () => onChange({ fornecedores: [], produtoId: '' });
  const temFiltro = filtro.fornecedores.length > 0 || filtro.produtoId;

  return (
    <div className="flex flex-wrap items-center gap-2 px-1 py-2">
      <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
        <Filter className="w-3.5 h-3.5" /> Filtrar sugestão automática (N/P/K):
      </span>

      <div ref={dropRef} className="relative">
        <button type="button" onClick={() => setDropFornAberto(a => !a)}
          className="h-7 text-xs border border-input rounded px-2 bg-background flex items-center gap-1 min-w-[140px] max-w-[280px] hover:bg-muted/30">
          {filtro.fornecedores.length === 0 ? (
            <span className="text-muted-foreground truncate">Todos fornecedores</span>
          ) : (
            <span className="flex flex-wrap gap-1 overflow-hidden max-h-5">
              {filtro.fornecedores.map(f => (
                <span key={f} className="inline-flex items-center gap-0.5 bg-primary/10 text-primary rounded px-1 text-[10px] font-medium shrink-0">
                  {f}
                  <span role="button"
                    onMouseDown={e => { e.stopPropagation(); e.preventDefault(); toggleFornecedor(f); }}
                    className="hover:text-destructive cursor-pointer leading-none">✕</span>
                </span>
              ))}
            </span>
          )}
          <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />
        </button>
        {dropFornAberto && (
          <div className="absolute z-50 top-full left-0 mt-1 min-w-[200px] bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            {fornecedores.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum fornecedor cadastrado</p>
            ) : fornecedores.map(f => (
              <button key={f} type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => toggleFornecedor(f)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${filtro.fornecedores.includes(f) ? 'bg-primary border-primary text-white' : 'border-input'}`}>
                  {filtro.fornecedores.includes(f) && <span className="text-[8px] leading-none font-bold">✓</span>}
                </span>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      <select value={filtro.produtoId || '__todos__'} onChange={e => handleProduto(e.target.value)}
        className="h-7 text-xs border border-input rounded px-2 bg-background text-foreground max-w-[220px]">
        <option value="__todos__">Todos produtos</option>
        {produtosFiltrados.map(p => (
          <option key={p.id} value={p.id}>{p.nome}</option>
        ))}
      </select>

      {temFiltro && (
        <button type="button" onClick={limpar}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive underline">
          <X className="w-3 h-3" /> Limpar filtro
        </button>
      )}
      {filtro.fornecedores.length > 0 && (
        <span className="text-[10px] text-muted-foreground italic">
          (fontes simples sem fornecedor sempre incluídas)
        </span>
      )}
    </div>
  );
}

// ── Cards de métricas ─────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, subColor }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex-1 min-w-0">
      <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>
      <p className="text-xl font-bold text-foreground tabular-nums truncate">{value}</p>
      <p className={`text-xs mt-0.5 truncate ${subColor || 'text-muted-foreground'}`}>{sub}</p>
    </div>
  );
}

// ── Menu de ações ─────────────────────────────────────────────────────────────

function MenuAcoes({ onRecalcular, onLimpar }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setAberto(a => !a)}
        className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground transition-colors">
        <MoreVertical className="w-4 h-4" />
      </button>
      {aberto && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg min-w-[140px] overflow-hidden"
          onMouseLeave={() => setAberto(false)}>
          <button type="button" onClick={() => { onRecalcular(); setAberto(false); }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60">Recalcular</button>
          <button type="button" onClick={() => { onLimpar(); setAberto(false); }}
            className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-destructive/10">Limpar</button>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function AbaPlanejamento2({ resultados, todos, calculando, podeCacularTodos, onRecalcular, onSalvar, onPrecosChange, onParcelamentosChange, onProdutosEfetivosChange, precosIniciais, parcelamentosIniciais }) {
  const [expandidos, setExpandidos] = useState(new Set());
  const [precos, setPrecos] = useState(() => precosIniciais || {});
  const [parcelamentos, setParcelamentos] = useState(() => parcelamentosIniciais || {});
  const [filtro, setFiltro] = useState({ fornecedores: [], produtoId: '' });

  const toggleExpand = (id) => setExpandidos(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const expandirTodos = () => setExpandidos(new Set((resultados || []).map(r => r.talhao.id)));
  const recolherTodos = () => setExpandidos(new Set());

  // CORREÇÃO 5: produtos sem fornecedor são sempre incluídos na sugestão automática
  const todosFiltered = useMemo(() => {
    if (filtro.fornecedores.length === 0 && !filtro.produtoId) return todos;
    return todos.filter(p => {
      if (filtro.produtoId) return p.id === filtro.produtoId;
      if (filtro.fornecedores.length > 0) {
        // sem fornecedor = sempre incluir (fontes simples como Ureia, KCl)
        if (!p.fornecedor) return true;
        return filtro.fornecedores.includes(p.fornecedor);
      }
      return true;
    });
  }, [todos, filtro]);

  // Sincroniza quando o pai restaura preços/parcelamentos do banco
  useEffect(() => {
    if (precosIniciais && Object.keys(precosIniciais).length > 0) {
      setPrecos(prev => Object.keys(prev).length === 0 ? precosIniciais : prev);
    }
  }, [precosIniciais]);
  useEffect(() => {
    if (parcelamentosIniciais && Object.keys(parcelamentosIniciais).length > 0) {
      setParcelamentos(prev => Object.keys(prev).length === 0 ? parcelamentosIniciais : prev);
    }
  }, [parcelamentosIniciais]);

  // Notifica pai quando preços ou parcelamentos mudam
  useEffect(() => { onPrecosChange?.(precos); }, [precos]);
  useEffect(() => { onParcelamentosChange?.(parcelamentos); }, [parcelamentos]);

  // Notifica pai com mapa de produto efetivo por talhão { [talhaoId]: { produto, doseKgHa } }
  useEffect(() => {
    if (!onProdutosEfetivosChange || !resultados) return;
    const mapa = {};
    resultados.forEach(r => {
      if (!r.rec || !todosFiltered.length) return;
      const sugestoes = sugerirProdutosInteligente(todosFiltered, { N: r.rec.N, P: r.rec.P, K: r.rec.K, B: r.rec.B });
      const sugN = sugestoes['n_pct'];
      if (sugN?.produtoId) {
        const prod = todosFiltered.find(p => p.id === sugN.produtoId);
        if (prod) {
          const pctN = parseFloat(prod.n_pct) || 0;
          const dose = pctN > 0 && r.rec.N != null ? Math.round((r.rec.N / (pctN / 100)) * 10) / 10 : null;
          mapa[r.talhao.id] = { produto: prod, doseKgHa: dose };
        }
      }
    });
    onProdutosEfetivosChange(mapa);
  }, [todosFiltered, resultados]);

  const handlePrecoChange = useCallback((prodId, val) => {
    setPrecos(prev => ({ ...prev, [prodId]: val }));
  }, []);

  const handleParcelamentoChange = useCallback((talhaoId, prodId, parc) => {
    setParcelamentos(prev => ({
      ...prev,
      [talhaoId]: { ...(prev[talhaoId] || {}), [prodId]: parc },
    }));
  }, []);

  const handleAplicarParcTodos = useCallback((prodId, parc) => {
    setParcelamentos(prev => {
      const next = { ...prev };
      (resultados || []).forEach(r => {
        next[r.talhao.id] = { ...(next[r.talhao.id] || {}), [prodId]: parc };
      });
      return next;
    });
  }, [resultados]);

  const metricas = useMemo(() => {
    if (!resultados || resultados.length === 0) return null;
    const comRec = resultados.filter(r => r.rec);
    const areaTotal = resultados.reduce((s, r) => s + (r.talhao.area_ha || 0), 0);

    let custoFazendaTotal = 0;
    let custoFazendaHaSum = 0;
    let custoFazendaHaCount = 0;
    let somaSacasArea = 0;

    comRec.forEach(r => {
      const area = r.talhao.area_ha || 0;
      const linhas = montarLinhasProdutos(todosFiltered, r.rec);
      linhas.forEach(l => {
        const preco = precos[l.produto.id];
        const precoNum = preco != null && preco !== '' ? parseFloat(preco) : null;
        if (precoNum != null && l.doseKgHa != null) {
          const custo = l.doseKgHa * precoNum;
          custoFazendaHaSum += custo;
          custoFazendaHaCount++;
          custoFazendaTotal += custo * area;
        }
      });
      if (r.mediaBienal != null) somaSacasArea += r.mediaBienal * area;
    });

    const custoSaca = custoFazendaTotal > 0 && somaSacasArea > 0 ? custoFazendaTotal / somaSacasArea : null;

    return {
      calculados: comRec.length,
      total: resultados.length,
      pct: resultados.length > 0 ? Math.round((comRec.length / resultados.length) * 100) : 0,
      areaTotal,
      mediaSc: comRec.length > 0 ? comRec.reduce((s, r) => s + (r.mediaBienal || 0), 0) / comRec.length : null,
      custoFazendaTotal: custoFazendaTotal > 0 ? custoFazendaTotal : null,
      custoHaMedio: custoFazendaHaCount > 0 ? custoFazendaHaSum / custoFazendaHaCount : null,
      custoSaca,
    };
  }, [resultados, todos, precos]);

  if (!resultados || resultados.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" className="gap-1.5 text-xs" disabled={!podeCacularTodos || calculando} onClick={() => onRecalcular(todosFiltered)}>
            {calculando ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Recalcular todos
          </Button>
          <Button variant="secondary" size="sm" className="gap-1.5 text-xs" disabled>
            <BarChart2 className="w-3.5 h-3.5" /> Comparar estratégias
          </Button>
          <Button size="sm" className="gap-1.5 text-xs bg-green-700 hover:bg-green-800 text-white" disabled>
            <Save className="w-3.5 h-3.5" /> Salvar planejamento
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground text-sm">
          Clique em "Calcular recomendação para todos" na aba Análises para gerar o planejamento.
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {/* 1. Barra de botões */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" size="sm" className="gap-1.5 text-xs" disabled={!podeCacularTodos || calculando} onClick={() => onRecalcular(todosFiltered)}>
          {calculando ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Recalcular todos
        </Button>
        <Button variant="secondary" size="sm" className="gap-1.5 text-xs" disabled>
          <BarChart2 className="w-3.5 h-3.5" /> Comparar estratégias
        </Button>
        <Button size="sm" className="gap-1.5 text-xs bg-green-700 hover:bg-green-800 text-white" onClick={onSalvar}>
          <Save className="w-3.5 h-3.5" /> Salvar planejamento
        </Button>
      </div>

      {/* 2. Cards de métricas */}
      {metricas && (
        <div className="flex flex-wrap gap-3">
          <MetricCard label="Talhões calculados" value={`${metricas.calculados}/${metricas.total}`} sub={`${metricas.pct}% concluído`} subColor="text-green-600 font-medium" />
          <MetricCard label="Área total" value={`${metricas.areaTotal.toFixed(1)} ha`} sub="Área planejada" />
          <MetricCard label="Custo total fazenda" value={metricas.custoFazendaTotal != null ? fmtR(metricas.custoFazendaTotal) : '—'} sub="Preencha os preços para calcular" />
          <MetricCard label="Custo/ha médio" value={metricas.custoHaMedio != null ? fmtR(metricas.custoHaMedio) : '—'} sub="Média ponderada" />
          <MetricCard label="Custo/saca" value={metricas.custoSaca != null ? fmtR(metricas.custoSaca) : '—'} sub={metricas.mediaSc != null ? `Base: ${metricas.mediaSc.toFixed(1)} sc/ha` : 'Base: —'} />
        </div>
      )}

      {/* 3. Filtro de fornecedor/produto */}
      <div className="bg-card border border-border rounded-xl px-4 py-2">
        <FiltroProdutosGlobal todos={todos} filtro={filtro} onChange={setFiltro} />
      </div>

      {/* 4. Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/10">
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Talhão</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Área (ha)</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Prod. (sc/ha)</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">N kg/ha</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">P₂O₅ kg/ha</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">K₂O kg/ha</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">B kg/ha</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Produto principal</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Dose (kg/ha)</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custo/ha</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Custo total</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-2 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((r, i) => {
                const expandido = expandidos.has(r.talhao.id);
                const area = r.talhao.area_ha || 0;
                // Bug 2 fix: calcular produto ao vivo com todosFiltered para ser consistente com o painel expandido
                let produtoSugeridoVivo = null;
                let doseProdutoHaVivo = null;
                if (r.rec && todosFiltered.length > 0) {
                  const sugestoes = sugerirProdutosInteligente(todosFiltered, { N: r.rec.N, P: r.rec.P, K: r.rec.K, B: r.rec.B });
                  const sugN = sugestoes['n_pct'];
                  if (sugN?.produtoId) {
                    const prod = todosFiltered.find(p => p.id === sugN.produtoId);
                    if (prod) {
                      produtoSugeridoVivo = prod;
                      const pctN = parseFloat(prod.n_pct) || 0;
                      if (pctN > 0 && r.rec.N != null) doseProdutoHaVivo = Math.round((r.rec.N / (pctN / 100)) * 10) / 10;
                    }
                  }
                }
                const precoPrinc = produtoSugeridoVivo ? precos[produtoSugeridoVivo.id] : null;
                const precoNum = precoPrinc != null && precoPrinc !== '' ? parseFloat(precoPrinc) : null;
                const custoHa = precoNum != null && doseProdutoHaVivo != null ? precoNum * doseProdutoHaVivo : null;
                const custoTotal = custoHa != null ? custoHa * area : null;

                return (
                  <React.Fragment key={r.talhao.id}>
                    <tr className={`border-b border-border/50 transition-colors ${expandido ? 'bg-primary/5 border-l-4 border-l-primary' : i%2===0?'':'bg-muted/5'} hover:bg-muted/10`}>
                      <td className="px-3 py-2.5 text-center">
                        <button type="button" onClick={() => toggleExpand(r.talhao.id)}
                          className="text-muted-foreground hover:text-primary transition-colors">
                          {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">{r.talhao.nome}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.talhao.area_ha ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.mediaBienal != null ? r.mediaBienal.toFixed(1) : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.rec?.N ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.rec?.P ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.rec?.K ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.rec?.B ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs max-w-[160px] truncate">
                        {produtoSugeridoVivo ? <span className="font-medium">{produtoSugeridoVivo.nome}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{doseProdutoHaVivo != null ? doseProdutoHaVivo : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{custoHa != null ? fmtR(custoHa) : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{custoTotal != null ? fmtR(custoTotal) : '—'}</td>
                      <td className="px-3 py-2.5 text-center"><StatusBadgePlan rec={r.rec} /></td>
                      <td className="px-2 py-2.5">
                        <MenuAcoes onRecalcular={() => {}} onLimpar={() => {}} />
                      </td>
                    </tr>
                    {expandido && (
                      <tr>
                        <td colSpan={14} className="p-0 border-b border-border">
                          <PainelTalhao
                            resultado={r}
                            todos={todosFiltered}
                            todosSemFiltro={todos}
                            precosProd={precos}
                            onPrecoChange={(prodId, val) => handlePrecoChange(prodId, val)}
                            parcelamentosProd={parcelamentos[r.talhao.id] || {}}
                            onParcelamentoChange={(prodId, parc) => handleParcelamentoChange(r.talhao.id, prodId, parc)}
                            onAplicarParcTodos={(prodId, parc) => handleAplicarParcTodos(prodId, parc)}
                            onFechar={() => toggleExpand(r.talhao.id)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/10">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Calculado</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Pendente</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={expandirTodos} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Expandir todos</button>
            <span className="text-muted-foreground">·</span>
            <button type="button" onClick={recolherTodos} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Recolher todos</button>
          </div>
        </div>
      </div>
    </div>
  );
}