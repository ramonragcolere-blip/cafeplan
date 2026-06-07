import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart2, Save, ChevronRight, ChevronDown, MoreVertical, CheckCircle2, Clock, Filter, X } from 'lucide-react';
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

const SALDO_PARA_KEY = { N: 'n_pct', K: 'k2o_pct', P: 'p2o5_pct', B: 'b_pct' };
const KEY_PARA_LABEL = { n_pct: 'N', k2o_pct: 'K₂O', p2o5_pct: 'P₂O₅', b_pct: 'B' };

/** Monta lista de linhas de produto a partir das sugestões do inteligente */
function montarLinhasProdutos(todos, rec) {
  if (!rec || !todos.length) return [];
  const sugestoes = sugerirProdutosInteligente(todos, { N: rec.N, P: rec.P, K: rec.K, B: rec.B });

  // encontra produto principal (N)
  const principalId = sugestoes['n_pct']?.produtoId || null;

  // agrupa por produto
  const mapa = {};
  for (const [nutKey, sug] of Object.entries(sugestoes)) {
    if (!sug?.produtoId) continue;
    const prod = todos.find(p => p.id === sug.produtoId);
    if (!prod) continue;
    if (!mapa[sug.produtoId]) {
      mapa[sug.produtoId] = { produto: prod, nutrientes: [], ehPrincipal: sug.produtoId === principalId };
    }
    // dose do produto em kg/ha para este nutriente
    const pct = parseFloat(prod[nutKey]) || 0;
    const nutSimbolo = KEY_PARA_LABEL[nutKey] || nutKey;
    const nutRec = rec[nutSimbolo === 'K₂O' ? 'K' : nutSimbolo === 'P₂O₅' ? 'P' : nutSimbolo] || 0;
    if (pct > 0 && nutRec > 0) {
      const doseKgHa = Math.round((nutRec / (pct / 100)) * 10) / 10;
      const fornecido = doseKgHa * (pct / 100);
      mapa[sug.produtoId].nutrientes.push({ label: nutSimbolo, fornecido });
      // dose principal: a do nutriente N (ou o primeiro)
      if (!mapa[sug.produtoId].doseKgHa || nutKey === 'n_pct') {
        mapa[sug.produtoId].doseKgHa = doseKgHa;
      }
    }
  }

  return Object.values(mapa);
}

// ── Editor de Parcelamento ─────────────────────────────────────────────────────

function ResumoParcelamento({ parc }) {
  if (!parc || parc.parcelas.length === 0) return <span className="text-muted-foreground text-xs">Nenhum</span>;
  const partes = parc.parcelas.map((p, i) => {
    const mesesStr = (p.meses || []).join('/');
    return `${p.pct}% ${mesesStr}`;
  });
  return <span className="text-xs font-mono">{parc.parcelas.length}x · {partes.join(' · ')}</span>;
}

function EditorParcelamento({ parc, onChange, onAplicarTodos }) {
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
      {/* Nº parcelas */}
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
      {/* Por parcela */}
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

// ── Tabela de Produtos do Talhão ───────────────────────────────────────────────

function TabelaProdutos({ linhas, area, precos, onPrecoChange, parcelamentos, onParcelamentoChange, onAplicarParcTodos }) {
  const [expandidoProd, setExpandidoProd] = useState(null);

  if (!linhas || linhas.length === 0) {
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
          {linhas.map(linha => {
            const { produto, nutrientes, ehPrincipal, doseKgHa } = linha;
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
                  <td className="px-3 py-2 font-medium whitespace-nowrap max-w-[180px] truncate">{produto.nome}</td>
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
  );
}

// ── Painel expandido de um talhão ─────────────────────────────────────────────

const NUTRIENTES_GRID_FIXOS = [
  { key: 'N',  label: 'N',    tipo: 'dose',  unit: 'kg/ha' },
  { key: 'P',  label: 'P₂O₅', tipo: 'dose',  unit: 'kg/ha' },
  { key: 'K',  label: 'K₂O',  tipo: 'dose',  unit: 'kg/ha' },
  { key: 'B',  label: 'B',    tipo: 'dose',  unit: 'kg/ha' },
];

// Elementos opcionais (supridos/não-deficientes): o técnico pode adicionar manualmente
const ELEMENTOS_EXTRAS_OPCOES = [
  { key: 'Zn', label: 'Zn', tipo: 'class' },
  { key: 'Mn', label: 'Mn', tipo: 'class' },
  { key: 'Cu', label: 'Cu', tipo: 'class' },
  { key: 'Mg', label: 'Mg', tipo: 'dose', unit: 'kg/ha' },
  { key: 'Fe', label: 'Fe', tipo: 'class' },
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

function PainelTalhao({ resultado, todos, precosProd, onPrecoChange, parcelamentosProd, onParcelamentoChange, onAplicarParcTodos, onFechar }) {
  const { talhao, rec, mediaBienal, analise } = resultado;
  const micros = calcMicros(analise);
  const area = talhao.area_ha || 0;

  // C4: elementos adicionais marcados pelo técnico
  const [elementosExtras, setElementosExtras] = useState([]);
  const [painelExtrasAberto, setPainelExtrasAberto] = useState(false);

  const toggleExtra = (key) => {
    setElementosExtras(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Grid: nutrientes fixos (N,P,K,B) + extras marcados
  const gridNutrientes = useMemo(() => {
    const extras = ELEMENTOS_EXTRAS_OPCOES.filter(e => elementosExtras.includes(e.key));
    return [...NUTRIENTES_GRID_FIXOS, ...extras];
  }, [elementosExtras]);

  // Linhas de produtos: inclui produto manual para extras com dose/classificação
  const linhasProdutos = useMemo(
    () => montarLinhasProdutos(todos, rec),
    [todos, rec]
  );

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

      {/* Grid de nutrientes (fixos + extras) */}
      {rec ? (
        <div className="space-y-2">
          <div className={`grid gap-2 ${gridNutrientes.length <= 4 ? 'grid-cols-4' : 'grid-cols-4 sm:grid-cols-' + Math.min(gridNutrientes.length, 8)}`}
            style={{ gridTemplateColumns: `repeat(${Math.min(gridNutrientes.length, 8)}, minmax(0, 1fr))` }}>
            {gridNutrientes.map(n => {
              if (n.tipo === 'dose') {
                const val = rec[n.key];
                return (
                  <div key={n.key} className="bg-card border border-border rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">{n.label}</p>
                    <p className="text-base font-bold text-foreground tabular-nums">{val != null ? val : '—'}</p>
                    {val != null && <p className="text-[9px] text-muted-foreground">{n.unit}</p>}
                  </div>
                );
              }
              const cls = micros[n.key];
              return (
                <div key={n.key} className="bg-card border border-border rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground font-medium mb-1">{n.label}</p>
                  <p className="text-base font-bold text-muted-foreground">—</p>
                  {cls?.classe && (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${classBadgeColor(cls.classe)}`}>
                      {cls.classe}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* C4: botão + painel de extras */}
          <div>
            <button type="button"
              onClick={() => setPainelExtrasAberto(a => !a)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded px-2.5 py-1 hover:border-primary hover:text-primary transition-colors">
              <span className="text-base leading-none font-bold">+</span> Adicionar elemento
              {elementosExtras.length > 0 && (
                <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-semibold">{elementosExtras.length}</span>
              )}
            </button>
            {painelExtrasAberto && (
              <div className="mt-2 p-3 bg-card border border-border rounded-lg">
                <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Elementos supridos / monitoramento</p>
                <div className="flex flex-wrap gap-3">
                  {ELEMENTOS_EXTRAS_OPCOES.map(el => {
                    const marcado = elementosExtras.includes(el.key);
                    return (
                      <label key={el.key} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="checkbox" checked={marcado} onChange={() => toggleExtra(el.key)}
                          className="w-3.5 h-3.5 rounded accent-primary" />
                        <span className="text-xs font-medium">{el.label}</span>
                        {micros[el.key]?.classe && (
                          <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-full border ${classBadgeColor(micros[el.key].classe)}`}>
                            {micros[el.key].classe}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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

function FiltroProdutosGlobal({ todos, filtro, onChange }) {
  const [dropFornAberto, setDropFornAberto] = useState(false);
  const dropRef = useRef(null);

  // Fornecedores que têm produto com N, P ou K
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

  // Produtos filtrados pelos fornecedores selecionados (com N, P ou K)
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
        <Filter className="w-3.5 h-3.5" /> Filtrar produtos (N/P/K):
      </span>

      {/* Multi-select fornecedores */}
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

      {/* Select produto */}
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

export default function AbaPlanejamento2({ resultados, todos, calculando, podeCacularTodos, onRecalcular, onSalvar, onPrecosChange, onParcelamentosChange, precosIniciais, parcelamentosIniciais }) {
  const [expandidos, setExpandidos] = useState(new Set());
  // precos: { [produtoId]: string }
  const [precos, setPrecos] = useState(() => precosIniciais || {});
  // parcelamentos: { [talhaoId]: { [produtoId]: { parcelas: [{pct, meses[]}] } } }
  const [parcelamentos, setParcelamentos] = useState(() => parcelamentosIniciais || {});
  // filtro global de fornecedor/produto para sugestões N/P/K
  const [filtro, setFiltro] = useState({ fornecedores: [], produtoId: '' });

  const toggleExpand = (id) => setExpandidos(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const expandirTodos = () => setExpandidos(new Set((resultados || []).map(r => r.talhao.id)));
  const recolherTodos = () => setExpandidos(new Set());

  // Produtos filtrados pelo filtro global (N/P/K — fornecedor + produto fixado)
  // REGRA: produtos SEM fornecedor cadastrado são sempre incluídos (fontes simples)
  const todosFiltered = useMemo(() => {
    if (filtro.fornecedores.length === 0 && !filtro.produtoId) return todos;
    return todos.filter(p => {
      if (filtro.produtoId) return p.id === filtro.produtoId;
      if (filtro.fornecedores.length > 0) {
        // sem fornecedor = sempre incluir
        if (!p.fornecedor) return true;
        return filtro.fornecedores.includes(p.fornecedor);
      }
      return true;
    });
  }, [todos, filtro]);

  // Inicializa preços com dados da base de insumos ao montar/atualizar resultados
  // já preenchendo automaticamente quando o produto tiver preço cadastrado
  // (aqui não há campo de preço na entidade — campo editável sempre livre)

  // Sincroniza quando o pai restaura preços/parcelamentos do banco (apenas se estado local estiver vazio)
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

  // Notifica pai quando preços ou parcelamentos mudam (C2 persistência)
  useEffect(() => { onPrecosChange?.(precos); }, [precos]);
  useEffect(() => { onParcelamentosChange?.(parcelamentos); }, [parcelamentos]);

  const handlePrecoChange = useCallback((talhaoId, prodId, val) => {
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

  // Métricas agregadas com custos
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

  // Estado vazio
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
          <MetricCard
            label="Talhões calculados"
            value={`${metricas.calculados}/${metricas.total}`}
            sub={`${metricas.pct}% concluído`}
            subColor="text-green-600 font-medium"
          />
          <MetricCard
            label="Área total"
            value={`${metricas.areaTotal.toFixed(1)} ha`}
            sub="Área planejada"
          />
          <MetricCard
            label="Custo total fazenda"
            value={metricas.custoFazendaTotal != null ? fmtR(metricas.custoFazendaTotal) : '—'}
            sub="Preencha os preços para calcular"
          />
          <MetricCard
            label="Custo/ha médio"
            value={metricas.custoHaMedio != null ? fmtR(metricas.custoHaMedio) : '—'}
            sub="Média ponderada"
          />
          <MetricCard
            label="Custo/saca"
            value={metricas.custoSaca != null ? fmtR(metricas.custoSaca) : '—'}
            sub={metricas.mediaSc != null ? `Base: ${metricas.mediaSc.toFixed(1)} sc/ha` : 'Base: —'}
          />
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
                // custo da linha da tabela: produto principal
                const precoPrinc = r.produtoSugerido ? precos[r.produtoSugerido.id] : null;
                const precoNum = precoPrinc != null && precoPrinc !== '' ? parseFloat(precoPrinc) : null;
                const custoHa = precoNum != null && r.doseProdutoHa != null ? precoNum * r.doseProdutoHa : null;
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
                        {r.produtoSugerido ? <span className="font-medium">{r.produtoSugerido.nome}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.doseProdutoHa != null ? r.doseProdutoHa : '—'}</td>
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
                            precosProd={precos}
                            onPrecoChange={(prodId, val) => handlePrecoChange(r.talhao.id, prodId, val)}
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

        {/* Legenda + controles */}
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