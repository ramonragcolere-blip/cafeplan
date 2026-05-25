import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2, Package, ChevronDown, AlertTriangle, RefreshCw } from 'lucide-react';
import { calcN, classificarP, classificarK, calcB, getDosesBase } from '@/lib/tabelasNutricionais';

// ── Constantes ─────────────────────────────────────────────────────────────────
const NUTRIENTES_CHAVE = [
  { key: 'n_pct',    label: 'N',    recKey: 'N'    },
  { key: 'p2o5_pct', label: 'P₂O₅', recKey: 'P'   },
  { key: 'k2o_pct',  label: 'K₂O',  recKey: 'K'   },
  { key: 'b_pct',    label: 'B',    recKey: 'B'    },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function getMetros(talhao) {
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',', '.')));
  const linhaM = partes?.[0] || 0;
  if (talhao?.num_plantas && linhaM > 0) return talhao.num_plantas * linhaM;
  if (talhao?.area_ha && linhaM > 0) return Math.round((talhao.area_ha * 10000) / linhaM);
  return 0;
}

function calcRecomendacao(analise, plano) {
  if (!analise && !plano) return null;
  const safrAnt = plano?.safra_anterior_sc_ha;
  const safrEst = plano?.safra_estimada_sc_ha;
  const media = safrAnt && safrEst ? (Number(safrAnt) + Number(safrEst)) / 2 : null;
  const nCalc = calcN(safrAnt, safrEst);
  const dosesBase = getDosesBase(media);

  const p = analise?.fosforo;
  const k = analise?.potassio;
  const b = analise?.boro;

  const classP = p != null ? classificarP(p) : null;
  const classK = k != null ? classificarK(k) : null;
  const calcBoro = b != null ? calcB(b) : null;

  const doseP = classP ? (classP.dispensar ? 0 : Math.round(dosesBase.P * classP.fator)) : null;
  const doseK = classK ? (classK.dispensar ? 0 : Math.round(dosesBase.K * classK.fator)) : null;
  const doseB = calcBoro ? (calcBoro.dispensar ? 0 : calcBoro.dose) : null;

  return {
    N: nCalc?.dose ?? null,
    P: doseP,
    K: doseK,
    B: doseB,
  };
}

function melhorProduto(todos, nutrienteKey) {
  // Retorna o produto com maior % do nutriente requisitado
  if (!nutrienteKey || todos.length === 0) return null;
  return todos.reduce((best, prod) => {
    const v = parseFloat(prod[nutrienteKey]) || 0;
    const bestV = parseFloat(best?.[nutrienteKey]) || 0;
    return v > bestV ? prod : best;
  }, null);
}

function calcDoses(doseRecKgHa, produtoPct, areaHa, numPlantas, metros) {
  const pct = parseFloat(produtoPct) || 0;
  const rec = parseFloat(doseRecKgHa) || 0;
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

const PCT_DEFAULTS = {
  1: [100],
  2: [50, 50],
  3: [34, 33, 33],
  4: [25, 25, 25, 25],
  5: [20, 20, 20, 20, 20],
  6: [17, 17, 17, 17, 16, 16],
  7: [15, 15, 14, 14, 14, 14, 14],
  8: [13, 13, 12, 12, 12, 12, 13, 13],
  9: [12, 11, 11, 11, 11, 11, 11, 11, 11],
  10: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
};
const APLIC_LABELS = ['1ª','2ª','3ª','4ª','5ª','6ª','7ª','8ª','9ª','10ª'];
const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

// ── Linha de produto por nutriente ─────────────────────────────────────────────
function LinhanutrienteRec({
  nutriente, recKgHa, talhao, todos, linhaState, onChange,
}) {
  const { produtoId, doseRecManual, numAplic, pcts, meses = [], observacoes } = linhaState;

  const produto = useMemo(() => todos.find(p => p.id === produtoId) || null, [todos, produtoId]);
  const area = talhao?.area_ha || 0;
  const numPlantas = talhao?.num_plantas || 0;
  const metros = getMetros(talhao);

  const doseRecAtiva = doseRecManual !== '' ? parseFloat(doseRecManual) : recKgHa;
  const pctNutriente = produto ? parseFloat(produto[nutriente.key]) || 0 : 0;
  const dosesCalc = produto && doseRecAtiva && pctNutriente > 0
    ? calcDoses(doseRecAtiva, pctNutriente, area, numPlantas, metros)
    : null;

  const [busca, setBusca] = useState('');
  const [dropAberto, setDropAberto] = useState(false);

  const produtosFiltrados = useMemo(() => {
    const q = busca.toLowerCase();
    return todos.filter(p =>
      (p.nome || '').toLowerCase().includes(q) ||
      (p.fornecedor || '').toLowerCase().includes(q)
    ).sort((a, b) => {
      // Priorizar os que têm o nutriente
      const av = parseFloat(a[nutriente.key]) || 0;
      const bv = parseFloat(b[nutriente.key]) || 0;
      return bv - av;
    });
  }, [todos, busca, nutriente.key]);

  const setPct = (idx, val) => {
    const novos = [...pcts];
    novos[idx] = val;
    onChange({ ...linhaState, pcts: novos });
  };

  const setMes = (idx, mes) => {
    const mesArray = Array.isArray(meses[idx]) ? meses[idx] : (meses[idx] ? [meses[idx]] : []);
    const jaSelec = mesArray.includes(mes);
    let novosMesIdx;
    if (jaSelec) {
      novosMesIdx = mesArray.filter(m => m !== mes);
    } else if (mesArray.length < 3) {
      novosMesIdx = [...mesArray, mes];
    } else {
      novosMesIdx = mesArray; // já tem 3, não adiciona
    }
    const novos = [...(meses || [])];
    novos[idx] = novosMesIdx;
    onChange({ ...linhaState, meses: novos });
  };

  const setNumAplic = (n) => {
    const num = Number(n);
    onChange({ ...linhaState, numAplic: num, pcts: PCT_DEFAULTS[num] || [100], meses: Array(num).fill([]) });
  };

  if (recKgHa == null && doseRecManual === '') return null;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Cabeçalho do nutriente */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-muted/30 border-b border-border">
        <span className="font-bold text-sm text-primary w-10">{nutriente.label}</span>
        <span className="text-xs text-muted-foreground">
          Recomendado:
        </span>
        <span className="font-semibold text-sm">
          {recKgHa != null ? `${recKgHa} kg/ha` : '—'}
        </span>
        {recKgHa == null && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Sem recomendação calculada (insira na aba Análise)
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Dose manual (kg/ha):</span>
          <Input
            type="number"
            value={doseRecManual}
            onChange={e => onChange({ ...linhaState, doseRecManual: e.target.value })}
            className="h-7 w-24 text-xs"
            placeholder={recKgHa != null ? `${recKgHa}` : 'kg/ha'}
          />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Seletor de produto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs mb-1 block">Produto selecionado</Label>
            <div className="relative">
              <button
                type="button"
                className="w-full h-9 text-sm border border-input rounded-md px-3 text-left flex items-center justify-between bg-transparent hover:bg-muted/30"
                onClick={() => setDropAberto(a => !a)}
              >
                <span className={produto ? 'text-foreground truncate' : 'text-muted-foreground'}>
                  {produto ? produto.nome : 'Selecionar produto...'}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground ml-1 shrink-0" />
              </button>
              {dropAberto && (
                <div className="absolute z-50 top-full left-0 w-80 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <input autoFocus
                      className="w-full h-7 text-xs border border-input rounded px-2 bg-background"
                      placeholder="Buscar produto..."
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <button type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted/60 text-xs border-b border-border/30 text-muted-foreground"
                      onClick={() => { onChange({ ...linhaState, produtoId: null }); setDropAberto(false); setBusca(''); }}>
                      — Nenhum produto —
                    </button>
                    {produtosFiltrados.map(p => {
                      const pctV = parseFloat(p[nutriente.key]) || 0;
                      return (
                        <button key={p.id} type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted/60 text-xs border-b border-border/30 last:border-0"
                          onClick={() => { onChange({ ...linhaState, produtoId: p.id }); setDropAberto(false); setBusca(''); }}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{p.nome}</span>
                            {pctV > 0 && <span className="text-primary text-xs font-semibold">{nutriente.label}: {pctV}%</span>}
                          </div>
                          <div className="text-muted-foreground">{p._tipo === 'formulado' ? 'Formulado' : 'Fonte Simples'}{p.fornecedor ? ` · ${p.fornecedor}` : ''}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {produto && pctNutriente === 0 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Produto não tem {nutriente.label} cadastrado
              </p>
            )}
          </div>

          {/* Composição resumida */}
          {produto && (
            <div className="bg-muted/20 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-muted-foreground mb-1">Composição do produto:</p>
              <div className="flex flex-wrap gap-2">
                {NUTRIENTES_CHAVE.map(n => {
                  const v = parseFloat(produto[n.key]) || 0;
                  if (!v) return null;
                  return (
                    <span key={n.key} className={`px-2 py-0.5 rounded-full font-medium ${n.key === nutriente.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {n.label}: {v}%
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Cálculos automáticos */}
        {dosesCalc ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-green-800 mb-3 uppercase tracking-wide">Cálculo automático</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
              <div className="bg-white rounded-lg p-2.5 border border-green-100 text-center">
                <p className="text-xs text-muted-foreground">Dose produto</p>
                <p className="font-bold text-base">{dosesCalc.doseHa} <span className="text-xs font-normal">kg/ha</span></p>
              </div>
              <div className="bg-white rounded-lg p-2.5 border border-green-100 text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-bold text-base">{dosesCalc.total} <span className="text-xs font-normal">kg</span></p>
              </div>
              <div className="bg-white rounded-lg p-2.5 border border-green-100 text-center">
                <p className="text-xs text-muted-foreground">Sacos 50 kg</p>
                <p className="font-bold text-base">{dosesCalc.sc50} <span className="text-xs font-normal">sc</span></p>
              </div>
              <div className="bg-white rounded-lg p-2.5 border border-green-100 text-center">
                <p className="text-xs text-muted-foreground">Toneladas</p>
                <p className="font-bold text-base">{dosesCalc.ton} <span className="text-xs font-normal">t</span></p>
              </div>
              <div className="bg-white rounded-lg p-2.5 border border-green-100 text-center">
                <p className="text-xs text-muted-foreground">g/planta</p>
                <p className="font-bold text-base">{dosesCalc.gPlanta != null ? dosesCalc.gPlanta : <span className="text-xs font-normal text-muted-foreground">sem plantas</span>}</p>
              </div>
              <div className="bg-white rounded-lg p-2.5 border border-green-100 text-center">
                <p className="text-xs text-muted-foreground">g/metro</p>
                <p className="font-bold text-base">{dosesCalc.gMetro != null ? dosesCalc.gMetro : <span className="text-xs font-normal text-muted-foreground">sem metros</span>}</p>
              </div>
            </div>

            {/* Parcelamento */}
            <div className="border-t border-green-200 pt-3">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-green-800 shrink-0">Parcelamento:</span>
                <div className="flex flex-wrap gap-1">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} type="button"
                      onClick={() => setNumAplic(n)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${numAplic === n ? 'bg-green-700 text-white border-green-700' : 'bg-white text-muted-foreground border-border hover:bg-muted/30'}`}>
                      {n}x
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {Array.from({ length: numAplic }).map((_, i) => {
                  const pct = parseFloat(pcts[i]) || 0;
                  const kgAplic = dosesCalc.total * (pct / 100);
                  const doseHaAplic = area > 0 ? (kgAplic / area) : 0;
                  const sc50Aplic = (kgAplic / 50).toFixed(1);
                  const tonAplic = (kgAplic / 1000).toFixed(3);
                  const gPlantaAplic = numPlantas > 0 ? ((kgAplic * 1000) / numPlantas).toFixed(1) : null;
                  const gMetroAplic = metros > 0 ? ((kgAplic * 1000) / metros).toFixed(1) : null;
                  const mesSel = meses[i] || '';
                  return (
                    <div key={i} className="bg-white rounded-lg border border-green-100 p-3 space-y-2">
                      <p className="text-xs font-semibold text-green-700">{APLIC_LABELS[i]} Aplicação</p>
                      {/* Percentual */}
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={pcts[i]}
                          onChange={e => setPct(i, e.target.value)}
                          className="h-7 w-16 text-xs"
                          min="0" max="100"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                      {/* Cálculos */}
                      <div className="text-xs space-y-0.5 text-muted-foreground">
                        <div><span className="font-semibold text-foreground">{Math.round(kgAplic)} kg</span> · {Math.round(doseHaAplic * 10) / 10} kg/ha</div>
                        <div>{sc50Aplic} sc · {tonAplic} t</div>
                        {gPlantaAplic && <div>{gPlantaAplic} g/planta{gMetroAplic ? ` · ${gMetroAplic} g/metro` : ''}</div>}
                      </div>
                      {/* Meses (até 3) */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Meses (até 3):</p>
                        <div className="flex flex-wrap gap-1">
                          {MESES.map(m => {
                            const mesArray = Array.isArray(meses[i]) ? meses[i] : (meses[i] ? [meses[i]] : []);
                            const selec = mesArray.includes(m);
                            return (
                              <button key={m} type="button"
                                onClick={() => setMes(i, m)}
                                className={`px-1.5 py-0.5 text-xs rounded border transition-colors ${selec ? 'bg-green-700 text-white border-green-700' : 'bg-white text-muted-foreground border-border hover:bg-green-50'}`}>
                                {m}
                              </button>
                            );
                          })}
                        </div>
                        {(() => {
                          const mesArray = Array.isArray(meses[i]) ? meses[i] : (meses[i] ? [meses[i]] : []);
                          return mesArray.length > 0 ? (
                            <p className="text-xs text-green-700 mt-1">{mesArray.join(', ')}</p>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : produto && pctNutriente === 0 ? null : produto ? (
          <div className="bg-muted/20 rounded-xl p-4 text-xs text-muted-foreground">
            Informe a dose recomendada (kg/ha) para calcular automaticamente.
          </div>
        ) : null}

        {/* Observações */}
        <div>
          <Label className="text-xs mb-1 block">Observações</Label>
          <Input
            value={observacoes}
            onChange={e => onChange({ ...linhaState, observacoes: e.target.value })}
            className="h-8 text-sm"
            placeholder="Obs..."
          />
        </div>
      </div>
    </div>
  );
}

// ── Estado inicial de uma linha por nutriente ───────────────────────────────────
function linhaInicial(nutrienteKey, todos) {
  const melhor = melhorProduto(todos, nutrienteKey);
  return {
    produtoId: melhor?.id || null,
    doseRecManual: '',
    numAplic: 1,
    pcts: [100],
    meses: [[]],
    observacoes: '',
  };
}

// Linha vazia sem sugestão de produto
function linhaVazia() {
  return {
    produtoId: null,
    doseRecManual: '',
    numAplic: 1,
    pcts: [100],
    meses: [[]],
    observacoes: '',
  };
}

// ── Componente principal ────────────────────────────────────────────────────────
export default function AbaPlanejamento({
  produtor, safra, talhoes, analises, planos, saving,
  onSavePlano,
}) {
  const [talhaoId, setTalhaoId] = useState(null);
  const [linhasState, setLinhasState] = useState({});

  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples = [] } = useQuery({ queryKey: ['fontes_simples'], queryFn: () => base44.entities.FonteSimples.list() });

  const todos = useMemo(() => [
    ...fertilizantes.map(f => ({ ...f, _tipo: 'formulado' })),
    ...fontesSimples.map(f => ({ ...f, _tipo: 'fonte' })),
  ], [fertilizantes, fontesSimples]);

  const talhoesProdutor = useMemo(() =>
    talhoes.filter(t => t.codigo_produtor === produtor?.codigo),
    [talhoes, produtor]);

  // Auto-selecionar o primeiro talhão quando o produtor mudar
  useEffect(() => {
    const primeiro = talhoesProdutor[0]?.id || null;
    setTalhaoId(primeiro);
  }, [produtor?.id]);

  const talhao = useMemo(() => talhoesProdutor.find(t => t.id === talhaoId) || null, [talhoesProdutor, talhaoId]);

  const analise = useMemo(() =>
    talhao && safra ? analises.find(a => a.talhao_id === talhao.id && a.safra === safra) || null : null,
    [analises, talhao, safra]);

  const plano = useMemo(() =>
    talhao && safra ? planos.find(p => p.talhao_id === talhao.id && p.safra === safra) || null : null,
    [planos, talhao, safra]);

  const rec = useMemo(() => calcRecomendacao(analise, plano), [analise, plano]);

  const metros = useMemo(() => getMetros(talhao), [talhao]);

  // Chave única para o contexto atual
  const ctxKey = `${produtor?.id}__${talhaoId}__${safra}`;

  // Hidratar estado das linhas ao mudar contexto
  useEffect(() => {
    if (!talhao || !todos.length) return;

    const saved = plano?.planejamento_nutrientes;

    // Se há dados salvos, carregá-los exatamente — inclusive produtoId: null (Nenhum produto)
    if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
      const hidratado = {};
      NUTRIENTES_CHAVE.forEach(n => {
        const l = saved[n.key];
        if (l !== undefined) {
          const numAplic = l.numAplic || 1;
          // Normalizar meses: garantir que cada posição seja array (compatibilidade com formato antigo string)
          const mesNorm = Array.from({ length: numAplic }, (_, i) => {
            const m = l.meses?.[i];
            if (!m) return [];
            if (Array.isArray(m)) return m;
            return m ? [m] : [];
          });
          hidratado[n.key] = { ...linhaVazia(), ...l, meses: mesNorm };
        } else {
          hidratado[n.key] = linhaVazia();
        }
      });
      setLinhasState(hidratado);
      return;
    }

    // Sem dados salvos: inicializar com sugestão automática de produto
    const inicial = {};
    NUTRIENTES_CHAVE.forEach(n => {
      inicial[n.key] = linhaInicial(n.key, todos);
    });
    setLinhasState(inicial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey, todos.length, plano?.id]);

  const handleSave = () => {
    onSavePlano(talhao, { planejamento_nutrientes: linhasState });
  };

  const handleSugerirProdutos = () => {
    setLinhasState(prev => {
      const novo = { ...prev };
      NUTRIENTES_CHAVE.forEach(n => {
        const melhor = melhorProduto(todos, n.key);
        if (melhor && novo[n.key]) {
          novo[n.key] = { ...novo[n.key], produtoId: melhor.id };
        }
      });
      return novo;
    });
  };

  if (!produtor || !safra) return (
    <div className="text-center py-12 text-muted-foreground">
      <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p>Selecione produtor e safra para planejar.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Seletor de talhão */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs mb-1 block">Talhão</Label>
            <Select value={talhaoId || 'none'} onValueChange={v => setTalhaoId(v === 'none' ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o talhão" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione...</SelectItem>
                {talhoesProdutor.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {talhao && (
            <>
              <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Área', value: talhao.area_ha ? `${talhao.area_ha} ha` : '—' },
                  { label: 'Nº plantas', value: talhao.num_plantas ? talhao.num_plantas.toLocaleString() : '—' },
                  { label: 'Metros lineares', value: metros > 0 ? metros.toLocaleString() : '—' },
                  { label: 'Espaçamento', value: talhao.espacamento || '—' },
                ].map(c => (
                  <div key={c.label} className="bg-muted/30 rounded-lg p-2.5">
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className="font-semibold text-sm">{c.value}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {talhao && (
        <>
          {/* Banner de recomendação */}
          <div className={`rounded-2xl p-4 border ${rec ? 'bg-orange-50 border-orange-200' : 'bg-muted/30 border-border'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Recomendação nutricional (da aba Análise e Recomendação)
                </p>
                {rec ? (
                  <div className="flex flex-wrap gap-3">
                    {NUTRIENTES_CHAVE.map(n => {
                      const v = rec[n.recKey];
                      return (
                        <div key={n.key} className="bg-white rounded-lg px-3 py-1.5 border border-orange-100 text-center min-w-[70px]">
                          <p className="text-xs text-muted-foreground">{n.label}</p>
                          <p className="font-bold text-sm">{v != null ? `${v} kg/ha` : <span className="text-muted-foreground text-xs">—</span>}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma recomendação calculada para este talhão/safra.{' '}
                    <span className="text-xs">Acesse a aba "Análise e Recomendação" e preencha os dados de produtividade e análise de solo.</span>
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleSugerirProdutos} className="gap-1.5 shrink-0">
                <RefreshCw className="w-3.5 h-3.5" /> Sugerir produtos automaticamente
              </Button>
            </div>
          </div>

          {/* Linhas por nutriente */}
          <div className="space-y-4">
            {NUTRIENTES_CHAVE.map(n => {
              const recKgHa = rec?.[n.recKey] ?? null;
              const linhaS = linhasState[n.key] || linhaVazia();
              // Só mostrar linhas que têm rec ou que o usuário já preencheu alguma coisa
              const temDados = linhaS.produtoId || linhaS.doseRecManual || linhaS.observacoes;
              if (recKgHa == null && !temDados) return (
                <div key={n.key} className="border border-dashed border-border rounded-xl p-3 flex items-center gap-3">
                  <span className="font-bold text-sm text-primary w-10">{n.label}</span>
                  <span className="text-xs text-muted-foreground">Sem recomendação — preencha na aba Análise e Recomendação ou insira a dose manualmente abaixo</span>
                  <div className="ml-auto flex items-center gap-2">
                    <Input
                      type="number"
                      value={linhaS.doseRecManual}
                      onChange={e => setLinhasState(prev => ({ ...prev, [n.key]: { ...linhaS, doseRecManual: e.target.value } }))}
                      className="h-7 w-24 text-xs"
                      placeholder="kg/ha"
                    />
                    <span className="text-xs text-muted-foreground">kg/ha</span>
                  </div>
                </div>
              );

              return (
                <LinhanutrienteRec
                  key={n.key}
                  nutriente={n}
                  recKgHa={recKgHa}
                  talhao={talhao}
                  todos={todos}
                  linhaState={linhaS}
                  onChange={novaLinha => setLinhasState(prev => ({ ...prev, [n.key]: novaLinha }))}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Salvar */}
      {talhao && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Planejamento — {talhao.nome}
          </Button>
        </div>
      )}
    </div>
  );
}