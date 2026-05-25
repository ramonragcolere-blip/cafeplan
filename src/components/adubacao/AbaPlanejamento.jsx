import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2, Package, ChevronDown, AlertTriangle, RefreshCw } from 'lucide-react';
import { calcN, classificarP, classificarK, calcB, getDosesBase, classificarZn, classificarCu, classificarMn } from '@/lib/tabelasNutricionais';
import { useToast } from '@/components/ui/use-toast';

// ── Constantes ─────────────────────────────────────────────────────────────────
const NUTRIENTES_CHAVE = [
  { key: 'n_pct',    label: 'N',     recKey: 'N' },
  { key: 'p2o5_pct', label: 'P₂O₅', recKey: 'P' },
  { key: 'k2o_pct',  label: 'K₂O',  recKey: 'K' },
  { key: 'b_pct',    label: 'B',     recKey: 'B' },
];

const PCT_DEFAULTS = {
  1: [100], 2: [50,50], 3: [34,33,33], 4: [25,25,25,25], 5: [20,20,20,20,20],
  6: [17,17,17,17,16,16], 7: [15,15,14,14,14,14,14], 8: [13,13,12,12,12,12,13,13],
  9: [12,11,11,11,11,11,11,11,11], 10: [10,10,10,10,10,10,10,10,10,10],
};
const APLIC_LABELS = ['1ª','2ª','3ª','4ª','5ª','6ª','7ª','8ª','9ª','10ª'];
const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

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
  const classP  = analise?.fosforo  != null ? classificarP(analise.fosforo)  : null;
  const classK  = analise?.potassio != null ? classificarK(analise.potassio) : null;
  const calcBoro = analise?.boro    != null ? calcB(analise.boro)            : null;
  const classZn  = analise?.zinco   != null ? classificarZn(analise.zinco)   : null;
  const classCu  = analise?.cobre   != null ? classificarCu(analise.cobre)   : null;
  const classMn  = analise?.manganes!= null ? classificarMn(analise.manganes): null;
  return {
    N:  nCalc?.dose ?? null,
    P:  classP  ? (classP.dispensar  ? 0 : Math.round(dosesBase.P * classP.fator)) : null,
    K:  classK  ? (classK.dispensar  ? 0 : Math.round(dosesBase.K * classK.fator)) : null,
    B:  calcBoro ? (calcBoro.dispensar ? 0 : calcBoro.dose) : null,
    // Micronutrientes — ação (Aplicar / Avaliar / Dispensar)
    Zn: classZn ? classZn.acao  : null,
    Cu: classCu ? classCu.acao  : null,
    Mn: classMn ? classMn.acao  : null,
    // Secundários — valor direto da análise
    Ca: analise?.calcio    != null ? analise.calcio    : null,
    Mg: analise?.magnesio  != null ? analise.magnesio  : null,
    S:  analise?.enxofre   != null ? analise.enxofre   : null,
  };
}

function melhorProduto(todos, nutrienteKey) {
  if (!nutrienteKey || todos.length === 0) return null;
  return todos.reduce((best, prod) => {
    const v = parseFloat(prod[nutrienteKey]) || 0;
    return v > (parseFloat(best?.[nutrienteKey]) || 0) ? prod : best;
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

function linhaVazia() {
  return { produtoId: undefined, doseRecManual: '', numAplic: 1, pcts: [100], meses: [[]], observacoes: '' };
}

function normalizarMeses(mesArr, numAplic) {
  return Array.from({ length: numAplic }, (_, i) => {
    const m = mesArr?.[i];
    if (!m) return [];
    if (Array.isArray(m)) return m;
    return [m];
  });
}

// ── Linha de nutriente ─────────────────────────────────────────────────────────
function LinhanutRec({ nutriente, recKgHa, talhao, todos, linhaState, onChange }) {
  const { produtoId, doseRecManual, numAplic, pcts, meses = [], observacoes } = linhaState;
  const produto = useMemo(() => todos.find(p => p.id === produtoId) || null, [todos, produtoId]);
  const area = talhao?.area_ha || 0;
  const numPlantas = talhao?.num_plantas || 0;
  const metros = getMetros(talhao);
  const doseRecAtiva = doseRecManual !== '' ? parseFloat(doseRecManual) : recKgHa;
  const pctNutriente = produto ? parseFloat(produto[nutriente.key]) || 0 : 0;
  const dosesCalc = produto && doseRecAtiva && pctNutriente > 0
    ? calcDoses(doseRecAtiva, pctNutriente, area, numPlantas, metros) : null;

  const [busca, setBusca] = useState('');
  const [dropAberto, setDropAberto] = useState(false);

  const produtosFiltrados = useMemo(() => {
    const q = busca.toLowerCase();
    return todos
      .filter(p => (p.nome||'').toLowerCase().includes(q) || (p.fornecedor||'').toLowerCase().includes(q))
      .sort((a, b) => (parseFloat(b[nutriente.key])||0) - (parseFloat(a[nutriente.key])||0));
  }, [todos, busca, nutriente.key]);

  const setPct = (idx, val) => { const n=[...pcts]; n[idx]=val; onChange({...linhaState,pcts:n}); };

  const setMes = (idx, mes) => {
    const arr = Array.isArray(meses[idx]) ? meses[idx] : (meses[idx] ? [meses[idx]] : []);
    const jaSelec = arr.includes(mes);
    const novArr = jaSelec ? arr.filter(m=>m!==mes) : arr.length<3 ? [...arr,mes] : arr;
    const novos = [...(meses||[])];
    novos[idx] = novArr;
    onChange({...linhaState, meses: novos});
  };

  const setNumAplic = (n) => {
    const num = Number(n);
    onChange({...linhaState, numAplic:num, pcts: PCT_DEFAULTS[num]||[100], meses: Array(num).fill([])});
  };

  // Mostrar linha se houver recomendação OU dose manual OU produto já escolhido (inclusive null = Nenhum)
  const temSelecaoProduto = produtoId !== undefined;
  if (recKgHa == null && doseRecManual === '' && !temSelecaoProduto) return null;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-muted/30 border-b border-border">
        <span className="font-bold text-sm text-primary w-10">{nutriente.label}</span>
        <span className="text-xs text-muted-foreground">Recomendado:</span>
        <span className="font-semibold text-sm">{recKgHa != null ? `${recKgHa} kg/ha` : '—'}</span>
        {recKgHa == null && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Sem recomendação calculada (insira na aba Análise)
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Dose manual (kg/ha):</span>
          <Input type="number" value={doseRecManual}
            onChange={e => onChange({...linhaState, doseRecManual: e.target.value})}
            className="h-7 w-24 text-xs" placeholder={recKgHa != null ? `${recKgHa}` : 'kg/ha'} />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs mb-1 block">Produto selecionado</Label>
            <div className="relative">
              <button type="button"
                className="w-full h-9 text-sm border border-input rounded-md px-3 text-left flex items-center justify-between bg-transparent hover:bg-muted/30"
                onClick={() => setDropAberto(a => !a)}>
                <span className={produto ? 'text-foreground truncate' : (produtoId === null ? 'text-muted-foreground italic' : 'text-muted-foreground')}>
                  {produto ? produto.nome : produtoId === null ? '— Nenhum produto —' : 'Selecionar produto...'}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground ml-1 shrink-0" />
              </button>
              {dropAberto && (
                <div className="absolute z-50 top-full left-0 w-80 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <input autoFocus className="w-full h-7 text-xs border border-input rounded px-2 bg-background"
                      placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} />
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <button type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted/60 text-xs border-b border-border/30 text-muted-foreground"
                      onClick={() => { onChange({...linhaState, produtoId: null}); setDropAberto(false); setBusca(''); }}>
                      — Nenhum produto —
                    </button>
                    {produtosFiltrados.map(p => {
                      const pctV = parseFloat(p[nutriente.key]) || 0;
                      return (
                        <button key={p.id} type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted/60 text-xs border-b border-border/30 last:border-0"
                          onClick={() => { onChange({...linhaState, produtoId: p.id}); setDropAberto(false); setBusca(''); }}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{p.nome}</span>
                            {pctV > 0 && <span className="text-primary text-xs font-semibold">{nutriente.label}: {pctV}%</span>}
                          </div>
                          <div className="text-muted-foreground">{p._tipo==='formulado'?'Formulado':'Fonte Simples'}{p.fornecedor?` · ${p.fornecedor}`:''}</div>
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
          {produto && (
            <div className="bg-muted/20 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-muted-foreground mb-1">Composição do produto:</p>
              <div className="flex flex-wrap gap-2">
                {NUTRIENTES_CHAVE.map(n => {
                  const v = parseFloat(produto[n.key]) || 0;
                  if (!v) return null;
                  return (
                    <span key={n.key} className={`px-2 py-0.5 rounded-full font-medium ${n.key===nutriente.key?'bg-primary/10 text-primary':'bg-muted text-muted-foreground'}`}>
                      {n.label}: {v}%
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {dosesCalc ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-green-800 mb-3 uppercase tracking-wide">Cálculo automático</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
              {[
                { l:'Dose produto', v:`${dosesCalc.doseHa} kg/ha` },
                { l:'Total', v:`${dosesCalc.total} kg` },
                { l:'Sacos 50 kg', v:`${dosesCalc.sc50} sc` },
                { l:'Toneladas', v:`${dosesCalc.ton} t` },
                dosesCalc.gPlanta && { l:'g/planta', v:`${dosesCalc.gPlanta} g` },
                dosesCalc.gMetro  && { l:'g/metro',  v:`${dosesCalc.gMetro} g` },
              ].filter(Boolean).map(x => (
                <div key={x.l} className="bg-white rounded-lg p-2.5 border border-green-100 text-center">
                  <p className="text-xs text-muted-foreground">{x.l}</p>
                  <p className="font-bold text-sm">{x.v}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-green-200 pt-3">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-green-800 shrink-0">Parcelamento:</span>
                <div className="flex flex-wrap gap-1">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} type="button" onClick={() => setNumAplic(n)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${numAplic===n?'bg-green-700 text-white border-green-700':'bg-white text-muted-foreground border-border hover:bg-muted/30'}`}>
                      {n}x
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {Array.from({length:numAplic}).map((_,i) => {
                  const pct = parseFloat(pcts[i]) || 0;
                  const kgAplic = dosesCalc.total * (pct/100);
                  const gPlantaAplic = numPlantas>0 ? ((kgAplic*1000)/numPlantas).toFixed(1) : null;
                  const gMetroAplic  = metros>0 ? ((kgAplic*1000)/metros).toFixed(1) : null;
                  return (
                    <div key={i} className="bg-white rounded-lg border border-green-100 p-3 space-y-2">
                      <p className="text-xs font-semibold text-green-700">{APLIC_LABELS[i]} Aplicação</p>
                      <div className="flex items-center gap-2">
                        <Input type="number" value={pcts[i]} onChange={e=>setPct(i,e.target.value)}
                          className="h-7 w-16 text-xs" min="0" max="100" />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                      <div className="text-xs space-y-0.5 text-muted-foreground">
                        <div><span className="font-semibold text-foreground">{Math.round(kgAplic)} kg</span> · {(area>0?(kgAplic/area):0).toFixed(1)} kg/ha</div>
                        <div>{(kgAplic/50).toFixed(1)} sc · {(kgAplic/1000).toFixed(3)} t</div>
                        {gPlantaAplic && <div>{gPlantaAplic} g/planta{gMetroAplic?` · ${gMetroAplic} g/metro`:''}</div>}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Meses (até 3):</p>
                        <div className="flex flex-wrap gap-1">
                          {MESES.map(m => {
                            const mesArray = Array.isArray(meses[i]) ? meses[i] : (meses[i]?[meses[i]]:[]);
                            return (
                              <button key={m} type="button" onClick={()=>setMes(i,m)}
                                className={`px-1.5 py-0.5 text-xs rounded border transition-colors ${mesArray.includes(m)?'bg-green-700 text-white border-green-700':'bg-white text-muted-foreground border-border hover:bg-green-50'}`}>
                                {m}
                              </button>
                            );
                          })}
                        </div>
                        {(() => { const a=Array.isArray(meses[i])?meses[i]:(meses[i]?[meses[i]]:[]);
                          return a.length>0 ? <p className="text-xs text-green-700 mt-1">{a.join(', ')}</p> : null; })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : produto && pctNutriente===0 ? null : produto ? (
          <div className="bg-muted/20 rounded-xl p-4 text-xs text-muted-foreground">
            Informe a dose recomendada (kg/ha) para calcular automaticamente.
          </div>
        ) : null}

        <div>
          <Label className="text-xs mb-1 block">Observações</Label>
          <Input value={observacoes} onChange={e=>onChange({...linhaState,observacoes:e.target.value})}
            className="h-8 text-sm" placeholder="Obs..." />
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────────
export default function AbaPlanejamento({ produtor, safra, talhoes, analises, planos, saving, onSavePlano }) {
  const [talhaoId, setTalhaoId] = useState(null);
  const [linhasState, setLinhasState] = useState({});
  // Rastreia qual ctxKey está atualmente carregado para evitar sobrescrita
  const ctxKeyCarregado = useRef(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples = [] }  = useQuery({ queryKey: ['fontes_simples'],  queryFn: () => base44.entities.FonteSimples.list() });
  // ── Fonte de verdade: BasePlanejamentoAdubacao ──────────────────────────────
  const { data: basePlano = [] } = useQuery({
    queryKey: ['base_planejamento'],
    queryFn: () => base44.entities.BasePlanejamentoAdubacao.list(),
  });

  const bpCreate = useMutation({
    mutationFn: d => base44.entities.BasePlanejamentoAdubacao.create(d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['base_planejamento'] }),
  });
  const bpUpdate = useMutation({
    mutationFn: ({ id, d }) => base44.entities.BasePlanejamentoAdubacao.update(id, d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['base_planejamento'] }),
  });

  const todos = useMemo(() => [
    ...fertilizantes.map(f => ({ ...f, _tipo: 'formulado' })),
    ...fontesSimples.map(f => ({ ...f, _tipo: 'fonte' })),
  ], [fertilizantes, fontesSimples]);

  const talhoesProdutor = useMemo(() =>
    talhoes.filter(t => t.codigo_produtor === produtor?.codigo), [talhoes, produtor]);

  // Auto-selecionar o primeiro talhão quando o produtor mudar
  useEffect(() => {
    setTalhaoId(talhoesProdutor[0]?.id || null);
  }, [produtor?.id]);

  const talhao  = useMemo(() => talhoesProdutor.find(t => t.id === talhaoId) || null, [talhoesProdutor, talhaoId]);
  const analise = useMemo(() => talhao && safra ? analises.find(a => a.talhao_id===talhao.id && a.safra===safra)||null : null, [analises, talhao, safra]);
  const plano   = useMemo(() => talhao && safra ? planos.find(p => p.talhao_id===talhao.id && p.safra===safra)||null : null, [planos, talhao, safra]);
  const rec     = useMemo(() => calcRecomendacao(analise, plano), [analise, plano]);
  const metros  = useMemo(() => getMetros(talhao), [talhao]);

  // Registros da BasePlanejamentoAdubacao para o contexto atual
  const registrosSalvos = useMemo(() => {
    if (!produtor?.codigo || !safra || !talhaoId) return [];
    return basePlano.filter(r =>
      r.codigo_produtor === produtor.codigo &&
      r.safra === safra &&
      r.talhao_id === talhaoId
    );
  }, [basePlano, produtor?.codigo, safra, talhaoId]);

  // Chave do contexto atual
  const ctxKey = `${produtor?.id}__${talhaoId}__${safra}`;

  // ── Carregar estado das linhas ao mudar contexto ────────────────────────────
  // REGRA: dado salvo na BasePlanejamentoAdubacao SEMPRE tem prioridade.
  // Sugestão automática só é usada quando NÃO há nenhum registro salvo.
  useEffect(() => {
    if (!talhao || !todos.length) return;
    // Evitar re-carregar o mesmo contexto (troca de aba e volta)
    if (ctxKeyCarregado.current === ctxKey) return;
    ctxKeyCarregado.current = ctxKey;

    const novoState = {};

    NUTRIENTES_CHAVE.forEach(n => {
      // Procura registro salvo para este nutriente
      const reg = registrosSalvos.find(r => r.nutriente_key === n.key);

      if (reg) {
        // ── Dado salvo existe: carregar exatamente o que foi salvo ──
        const numAplic = reg.num_aplic || 1;
        novoState[n.key] = {
          produtoId: 'produto_id' in reg ? reg.produto_id : undefined,
          doseRecManual: reg.dose_rec_manual ?? '',
          numAplic,
          pcts: reg.pcts?.length ? reg.pcts : (PCT_DEFAULTS[numAplic] || [100]),
          meses: normalizarMeses(reg.meses, numAplic),
          observacoes: reg.observacoes ?? '',
        };
      } else {
        // ── Sem dado salvo: inicializar com sugestão automática ──
        const melhor = melhorProduto(todos, n.key);
        novoState[n.key] = {
          produtoId: melhor?.id || null,
          doseRecManual: '',
          numAplic: 1,
          pcts: [100],
          meses: [[]],
          observacoes: '',
        };
      }
    });

    setLinhasState(novoState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey, registrosSalvos.length, todos.length]);

  // Resetar ctxKeyCarregado quando contexto muda, para forçar re-leitura
  useEffect(() => {
    ctxKeyCarregado.current = null;
  }, [ctxKey]);

  // ── Salvar ──────────────────────────────────────────────────────────────────
  const [salvandoBP, setSalvandoBP] = useState(false);

  const handleSave = async () => {
    if (!talhao || !produtor || !safra) return;
    setSalvandoBP(true);

    const promises = NUTRIENTES_CHAVE.map(async n => {
      const linha = linhasState[n.key];
      if (!linha) return;

      const produto = todos.find(p => p.id === linha.produtoId) || null;
      const payload = {
        codigo_produtor: produtor.codigo,
        safra,
        talhao_id: talhao.id,
        talhao_nome: talhao.nome,
        nutriente_key: n.key,
        nutriente_label: n.label,
        // produto_id: null = "Nenhum produto" explícito; undefined = não selecionado
        produto_id: linha.produtoId !== undefined ? linha.produtoId : null,
        produto_nome: linha.produtoId === null ? 'Nenhum produto' : (produto?.nome || null),
        dose_rec_manual: linha.doseRecManual,
        num_aplic: linha.numAplic,
        pcts: linha.pcts,
        meses: linha.meses,
        observacoes: linha.observacoes,
        status: 'planejado',
      };

      const existente = registrosSalvos.find(r => r.nutriente_key === n.key);
      if (existente) {
        await bpUpdate.mutateAsync({ id: existente.id, d: payload });
      } else {
        await bpCreate.mutateAsync(payload);
      }
    });

    await Promise.all(promises);

    // Também salvar no PlanoAdubacao (para compatibilidade com Execução/PDF)
    const planejamentoNutrientes = {};
    NUTRIENTES_CHAVE.forEach(n => { planejamentoNutrientes[n.key] = linhasState[n.key] || linhaVazia(); });
    onSavePlano(talhao, { planejamento_nutrientes: planejamentoNutrientes });

    setSalvandoBP(false);
    toast({ title: 'Planejamento salvo!', description: `${talhao.nome} — ${safra}` });
  };

  const handleSugerirProdutos = () => {
    setLinhasState(prev => {
      const novo = { ...prev };
      NUTRIENTES_CHAVE.forEach(n => {
        const melhor = melhorProduto(todos, n.key);
        if (melhor && novo[n.key]) novo[n.key] = { ...novo[n.key], produtoId: melhor.id };
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

  const isSaving = salvandoBP || saving || bpCreate.isPending || bpUpdate.isPending;

  return (
    <div className="space-y-5">
      {/* Seletor de talhão */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs mb-1 block">Talhão</Label>
            <Select value={talhaoId || 'none'} onValueChange={v => setTalhaoId(v==='none'?null:v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o talhão" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione...</SelectItem>
                {talhoesProdutor.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                    {registrosSalvos.filter(r=>r.talhao_id===t.id).length > 0 && ' ✓'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {talhao && (
            <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Área',           value: talhao.area_ha ? `${talhao.area_ha} ha` : '—' },
                { label: 'Nº plantas',     value: talhao.num_plantas ? talhao.num_plantas.toLocaleString() : '—' },
                { label: 'Metros lineares',value: metros>0 ? metros.toLocaleString() : '—' },
                { label: 'Espaçamento',    value: talhao.espacamento || '—' },
              ].map(c => (
                <div key={c.label} className="bg-muted/30 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="font-semibold text-sm">{c.value}</p>
                </div>
              ))}
            </div>
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
                  <div className="space-y-2">
                    {/* NPK + B */}
                    <div className="flex flex-wrap gap-2">
                      {NUTRIENTES_CHAVE.map(n => (
                        <div key={n.key} className="bg-white rounded-lg px-3 py-1.5 border border-orange-100 text-center min-w-[64px]">
                          <p className="text-xs text-muted-foreground">{n.label}</p>
                          <p className="font-bold text-sm">{rec[n.recKey]!=null ? `${rec[n.recKey]} kg/ha` : <span className="text-muted-foreground text-xs">—</span>}</p>
                        </div>
                      ))}
                    </div>
                    {/* Micronutrientes Zn, Cu, Mn */}
                    {(rec.Zn || rec.Cu || rec.Mn) && (
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'Zn', val: rec.Zn },
                          { label: 'Cu', val: rec.Cu },
                          { label: 'Mn', val: rec.Mn },
                        ].filter(x => x.val).map(x => {
                          const cor = x.val === 'Aplicar' ? 'bg-red-50 border-red-200 text-red-700'
                            : x.val === 'Avaliar' ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                            : 'bg-green-50 border-green-200 text-green-700';
                          return (
                            <div key={x.label} className={`rounded-lg px-3 py-1.5 border text-center min-w-[64px] ${cor}`}>
                              <p className="text-xs opacity-70">{x.label}</p>
                              <p className="font-semibold text-xs">{x.val}</p>
                            </div>
                          );
                        })}
                        {/* Ca, Mg, S — valores da análise */}
                        {[
                          { label: 'Ca', val: rec.Ca, unit: 'cmolc' },
                          { label: 'Mg', val: rec.Mg, unit: 'cmolc' },
                          { label: 'S',  val: rec.S,  unit: 'mg/dm³' },
                        ].filter(x => x.val != null).map(x => (
                          <div key={x.label} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 text-center min-w-[64px]">
                            <p className="text-xs text-blue-500">{x.label}</p>
                            <p className="font-semibold text-xs text-blue-700">{x.val} <span className="font-normal opacity-70">{x.unit}</span></p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma recomendação calculada.{' '}
                    <span className="text-xs">Acesse a aba "Análise e Recomendação" e preencha os dados de produtividade e análise de solo.</span>
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleSugerirProdutos} className="gap-1.5 shrink-0">
                <RefreshCw className="w-3.5 h-3.5" /> Sugerir produtos automaticamente
              </Button>
            </div>
          </div>

          {/* Item de calagem — exibido se foi enviado do CalcCalagem */}
          {(() => {
            const regCalagem = registrosSalvos.find(r => r.nutriente_key === 'calagem');
            if (!regCalagem) return null;
            return (
              <div className="bg-lime-50 border border-lime-200 rounded-xl p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-lime-800 uppercase tracking-wide">Calagem / Correção</p>
                  <span className="text-xs text-lime-600 bg-lime-100 px-2 py-0.5 rounded-full">{regCalagem.nutriente_label}</span>
                </div>
                <p className="text-sm font-medium">{regCalagem.produto_nome}</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <span>Dose: <strong>{regCalagem.dose_rec_manual} kg/ha</strong></span>
                  {talhao?.area_ha && <span>Total: <strong>{Math.round(Number(regCalagem.dose_rec_manual) * talhao.area_ha).toLocaleString()} kg</strong></span>}
                </div>
                {regCalagem.observacoes && <p className="text-xs text-muted-foreground">{regCalagem.observacoes}</p>}
              </div>
            );
          })()}

          {/* Linhas por nutriente */}
          <div className="space-y-4">
            {NUTRIENTES_CHAVE.map(n => {
              const recKgHa = rec?.[n.recKey] ?? null;
              const linhaS = linhasState[n.key] || linhaVazia();
              const temSelecao = linhaS.produtoId !== undefined;
              const temDados = temSelecao || linhaS.doseRecManual || linhaS.observacoes;

              if (recKgHa == null && !temDados) return (
                <div key={n.key} className="border border-dashed border-border rounded-xl p-3 flex flex-wrap items-center gap-3">
                  <span className="font-bold text-sm text-primary w-10">{n.label}</span>
                  <span className="text-xs text-muted-foreground">Sem recomendação — insira a dose manualmente ou acesse a aba Análise</span>
                  <div className="ml-auto flex items-center gap-2">
                    <Input type="number" value={linhaS.doseRecManual}
                      onChange={e => setLinhasState(prev => ({...prev, [n.key]: {...linhaS, doseRecManual: e.target.value}}))}
                      className="h-7 w-24 text-xs" placeholder="kg/ha" />
                    <span className="text-xs text-muted-foreground">kg/ha</span>
                  </div>
                </div>
              );

              return (
                <LinhanutRec key={n.key} nutriente={n} recKgHa={recKgHa}
                  talhao={talhao} todos={todos} linhaState={linhaS}
                  onChange={novaLinha => setLinhasState(prev => ({...prev, [n.key]: novaLinha}))} />
              );
            })}
          </div>
        </>
      )}

      {talhao && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Planejamento — {talhao.nome}
          </Button>
        </div>
      )}
    </div>
  );
}