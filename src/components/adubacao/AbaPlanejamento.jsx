import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2, Package, ChevronDown, AlertTriangle, RefreshCw, Plus, Trash2, DollarSign } from 'lucide-react';
import { VoiceInput } from '@/components/ui/VoiceInput';
import ResumoCustosAdubacao from './ResumoCustosAdubacao';
import BalancoNutricional from './BalancoNutricional';
import { calcN, classificarP, calcB, getDosesBase, classificarZn, classificarCu, classificarMn, calcKSomaCamadas } from '@/lib/tabelasNutricionais';
import { useToast } from '@/components/ui/use-toast';

// ── Constantes ─────────────────────────────────────────────────────────────────
const NUTRIENTES_CHAVE = [
  { key: 'n_pct',    label: 'N',     recKey: 'N' },
  { key: 'p2o5_pct', label: 'P₂O₅', recKey: 'P' },
  { key: 'k2o_pct',  label: 'K₂O',  recKey: 'K' },
  { key: 'b_pct',    label: 'B',     recKey: 'B' },
  { key: 'ca_pct',   label: 'Ca',    recKey: 'Ca' },
  { key: 'mg_pct',   label: 'Mg',    recKey: 'Mg' },
  { key: 's_pct',    label: 'S',     recKey: 'S' },
  { key: 'zn_pct',   label: 'Zn',    recKey: 'Zn' },
  { key: 'mn_pct',   label: 'Mn',    recKey: 'Mn' },
  { key: 'cu_pct',   label: 'Cu',    recKey: 'Cu' },
  { key: 'fe_pct',   label: 'Fe',    recKey: 'Fe' },
];

const PCT_DEFAULTS = {
  1: [100], 2: [50,50], 3: [34,33,33], 4: [25,25,25,25], 5: [20,20,20,20,20],
  6: [17,17,17,17,16,16], 7: [15,15,14,14,14,14,14], 8: [13,13,12,12,12,12,13,13],
  9: [12,11,11,11,11,11,11,11,11], 10: [10,10,10,10,10,10,10,10,10,10],
};
const APLIC_LABELS = ['1ª','2ª','3ª','4ª','5ª','6ª','7ª','8ª','9ª','10ª'];
const MESES = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

// Todos os campos a mostrar na composição
const TODOS_NUTRIENTES_COMPOSICAO = [
  { key: 'n_pct', label: 'N' }, { key: 'p2o5_pct', label: 'P₂O₅' },
  { key: 'k2o_pct', label: 'K₂O' }, { key: 'ca_pct', label: 'Ca' },
  { key: 'mg_pct', label: 'Mg' }, { key: 's_pct', label: 'S' },
  { key: 'b_pct', label: 'B' }, { key: 'zn_pct', label: 'Zn' },
  { key: 'cu_pct', label: 'Cu' }, { key: 'mn_pct', label: 'Mn' },
  { key: 'fe_pct', label: 'Fe' },
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

function calcRecomendacao(analise, plano, analise2040) {
  if (!analise && !plano) return null;
  const safrAnt = plano?.safra_anterior_sc_ha;
  const safrEst = plano?.safra_estimada_sc_ha;
  const media = safrAnt && safrEst ? (Number(safrAnt) + Number(safrEst)) / 2 : null;
  const nCalc = calcN(safrAnt, safrEst);
  const dosesBase = getDosesBase(media);
  const classP   = analise?.fosforo  != null ? classificarP(analise.fosforo)  : null;
  const calcBoro = analise?.boro     != null ? calcB(analise.boro)            : null;
  const classZn  = analise?.zinco    != null ? classificarZn(analise.zinco)   : null;
  const classCu  = analise?.cobre    != null ? classificarCu(analise.cobre)   : null;
  const classMn  = analise?.manganes != null ? classificarMn(analise.manganes): null;

  const kDecisao = analise?.potassio != null
    ? calcKSomaCamadas(analise.potassio, analise2040?.potassio, media, 'bom')
    : null;
  const doseKBase = kDecisao?.classK && dosesBase.K != null
    ? kDecisao.classK.dispensar ? 0 : Math.round(dosesBase.K * kDecisao.classK.fator)
    : null;
  const doseK = kDecisao?.dispensar ? 0 : doseKBase;

  return {
    N:  nCalc?.dose ?? null,
    P:  classP  ? (classP.dispensar  ? 0 : Math.round(dosesBase.P * classP.fator)) : null,
    K:  doseK,
    B:  calcBoro ? (calcBoro.dispensar ? 0 : calcBoro.dose) : null,
    Zn: classZn ? classZn.acao  : null,
    Cu: classCu ? classCu.acao  : null,
    Mn: classMn ? classMn.acao  : null,
    Ca: analise?.calcio    != null ? analise.calcio    : null,
    Mg: analise?.magnesio  != null ? analise.magnesio  : null,
    S:  analise?.enxofre   != null ? analise.enxofre   : null,
    Fe: null,
  };
}

// Mapeamento: símbolo interno -> chave do produto na base de insumos
const SALDO_PARA_KEY = {
  N:  'n_pct',
  K:  'k2o_pct',
  P:  'p2o5_pct',
  Mg: 'mg_pct',
  B:  'b_pct',
  Zn: 'zn_pct',
  Mn: 'mn_pct',
  Cu: 'cu_pct',
  Ca: 'ca_pct',
  S:  's_pct',
};

// Mapeamento: símbolo interno -> recKey do objeto rec
const SALDO_PARA_RECKEY = {
  N:  'N',
  K:  'K',
  P:  'P',
  Mg: 'Mg',
  B:  'B',
  Zn: 'Zn',
  Mn: 'Mn',
  Cu: 'Cu',
  Ca: 'Ca',
  S:  'S',
};

// Mapeamento: chave do produto -> símbolo interno (inverso)
const KEY_PARA_SALDO = Object.fromEntries(
  Object.entries(SALDO_PARA_KEY).map(([s, k]) => [k, s])
);

// Ordem de prioridade
const ORDEM_SUGESTAO_SIMBOLOS = ['N', 'K', 'P', 'Mg', 'B', 'Zn', 'Mn', 'Cu'];

// Micronutrientes com toxicidade: dose sugerida nunca ultrapassa a recomendação original
const NUTRIENTES_TOXICOS = new Set(['B', 'Zn', 'Mn']);

// Nutrientes que exibem filtro de fornecedor/produto fixado
const NUTRIENTES_COM_FILTRO = new Set(['n_pct', 'p2o5_pct', 'k2o_pct']);

/**
 * Sugestão inteligente com saldo em cascata.
 * Para cada nutriente na ordem de prioridade:
 *   - Se saldo <= 0: campo fica vazio (já coberto por produto anterior)
 *   - Se saldo > 0: escolhe o produto com maior % desse nutriente,
 *     calcula a dose necessária e desconta o que esse produto repõe
 *     nos saldos de todos os outros nutrientes.
 *
 * Retorna: { [nutrienteKey]: { produtoId, doseManual } }
 * doseManual = saldo restante no momento da seleção (kg/ha de nutriente)
 */
function sugerirProdutosInteligente(todos, rec) {
  if (!todos.length || !rec) return {};

  // 1. Saldo inicial vindo da recomendação (apenas valores numéricos > 0)
  const saldo = {};
  for (const [simbolo, recKey] of Object.entries(SALDO_PARA_RECKEY)) {
    const v = rec[recKey];
    saldo[simbolo] = typeof v === 'number' && v > 0 ? v : 0;
  }

  const sugestoes = {}; // nutrienteKey -> { produtoId, doseManual }

  // 2. Percorre na ordem de prioridade
  for (const simbolo of ORDEM_SUGESTAO_SIMBOLOS) {
    const nutKey = SALDO_PARA_KEY[simbolo];

    // Saldo zerado — já coberto por produto anterior
    if (saldo[simbolo] <= 0) {
      sugestoes[nutKey] = { produtoId: null, doseManual: '' };
      continue;
    }

    const saldoAtual = saldo[simbolo];

    // Encontra o produto por pontuação de cobertura múltipla:
    // pontua 1 para cada nutriente (com saldo > 0) que o produto cobre.
    // Desempate: menor dose necessária para cobrir o saldo do nutriente principal
    // (produto mais eficiente/concentrado para este nutriente).
    let melhor = null;
    let melhorScore = -1;
    let melhorDose = Infinity;
    for (const prod of todos) {
      const pctPrincipal = parseFloat(prod[nutKey]) || 0;
      if (pctPrincipal === 0) continue; // produto não cobre o nutriente principal — descarta

      // Pontuação: +1 por cobrir déficit real, -2 por adicionar nutriente já suprido.
      // A penalidade maior que o bônus garante que fontes simples (ex: KCl) vençam
      // formulados que trazem nutrientes cujo saldo já é zero ou negativo.
      let score = 0;
      for (const s of ORDEM_SUGESTAO_SIMBOLOS) {
        const temNutriente = (parseFloat(prod[SALDO_PARA_KEY[s]]) || 0) > 0;
        if (!temNutriente) continue;
        if (saldo[s] > 0) {
          score += 1;  // bônus: cobre um déficit real
        } else {
          score -= 2;  // penalidade: nutriente já suprido, geraria excesso
        }
      }

      const doseNecessaria = saldoAtual / (pctPrincipal / 100);

      // Penalização severa se a dose necessária para o nutriente principal
      // causar fornecimento excessivo de micronutrientes tóxicos (B, Zn, Mn)
      for (const toxico of NUTRIENTES_TOXICOS) {
        const pctToxico = parseFloat(prod[SALDO_PARA_KEY[toxico]]) || 0;
        if (pctToxico === 0) continue;
        const fornecimento = doseNecessaria * (pctToxico / 100);
        const recToxico = rec[SALDO_PARA_RECKEY[toxico]] || 0;
        if (recToxico > 0 && fornecimento > recToxico) {
          score -= 10; // penalização severa: causaria toxicidade
        }
      }

      if (score > melhorScore || (score === melhorScore && doseNecessaria < melhorDose)) {
        melhorScore = score;
        melhorDose = doseNecessaria;
        melhor = prod;
      }
    }

    if (!melhor) {
      sugestoes[nutKey] = { produtoId: null, doseManual: '' };
      continue;
    }

    // Para micronutrientes tóxicos, limita a dose ao valor original da recomendação
    const recOriginal = rec[SALDO_PARA_RECKEY[simbolo]] || 0;
    const doseSugerida = NUTRIENTES_TOXICOS.has(simbolo)
      ? Math.min(saldoAtual, recOriginal)
      : saldoAtual;
    sugestoes[nutKey] = { produtoId: melhor.id, doseManual: String(Math.round(doseSugerida * 10) / 10) };

    // Dose do produto (kg/ha) necessária para cobrir o saldo deste nutriente
    const pctPrincipalEscolhido = parseFloat(melhor[nutKey]) || 0;
    const doseProdutoHa = pctPrincipalEscolhido > 0 ? saldo[simbolo] / (pctPrincipalEscolhido / 100) : 0;

    // Desconta o que este produto repõe nos saldos dos demais nutrientes
    for (const [outroSimbolo, outroKey] of Object.entries(SALDO_PARA_KEY)) {
      if (outroSimbolo === simbolo) continue;
      const pctOutro = parseFloat(melhor[outroKey]) || 0;
      if (pctOutro > 0) {
        const repoe = doseProdutoHa * (pctOutro / 100);
        saldo[outroSimbolo] = Math.max(0, (saldo[outroSimbolo] || 0) - repoe);
      }
    }

    // Zera o saldo do nutriente principal
    saldo[simbolo] = 0;
  }

  return sugestoes;
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
  return { produtoId: undefined, doseRecManual: '', numAplic: 1, pcts: [100], meses: [[]], observacoes: '', preco: '' };
}

function normalizarMeses(mesArr, numAplic) {
  return Array.from({ length: numAplic }, (_, i) => {
    const m = mesArr?.[i];
    if (!m) return [];
    if (Array.isArray(m)) return m;
    return [m];
  });
}

// Retorna texto com valor de solo para o nutriente, ou null se não houver
function getSoloInfo(nutrienteKey, analise, analise2040) {
  if (!analise) return null;
  const fmt = (v, unit) => v != null ? `${v} ${unit}` : null;
  switch (nutrienteKey) {
    case 'k2o_pct': {
      const v0 = analise.potassio != null ? `${analise.potassio} mg/dm³ (0-20)` : null;
      const v1 = analise2040?.potassio != null ? `${analise2040.potassio} mg/dm³ (20-40)` : null;
      if (!v0) return null;
      return v1 ? `K Solo: ${v0} + ${v1}` : `K Solo: ${v0}`;
    }
    case 'p2o5_pct': {
      const v0 = analise.fosforo != null ? `${analise.fosforo} mg/dm³ (0-20)` : null;
      const v1 = analise2040?.fosforo != null ? `${analise2040.fosforo} mg/dm³ (20-40)` : null;
      if (!v0) return null;
      return v1 ? `P Solo: ${v0} + ${v1}` : `P Solo: ${v0}`;
    }
    case 'ca_pct':
      return fmt(analise.calcio, 'cmolc/dm³ (0-20)') ? `Ca Solo: ${analise.calcio} cmolc/dm³ (0-20)` : null;
    case 'mg_pct':
      return fmt(analise.magnesio, 'cmolc/dm³ (0-20)') ? `Mg Solo: ${analise.magnesio} cmolc/dm³ (0-20)` : null;
    case 'zn_pct':
      return analise.zinco != null ? `Zn Solo: ${analise.zinco} mg/dm³ (0-20)` : null;
    case 'b_pct':
      return analise.boro != null ? `B Solo: ${analise.boro} mg/dm³ (0-20)` : null;
    case 'mn_pct':
      return analise.manganes != null ? `Mn Solo: ${analise.manganes} mg/dm³ (0-20)` : null;
    case 'fe_pct':
      return analise.ferro != null ? `Fe Solo: ${analise.ferro} mg/dm³ (0-20)` : null;
    case 'cu_pct':
      return analise.cobre != null ? `Cu Solo: ${analise.cobre} mg/dm³ (0-20)` : null;
    default:
      return null;
  }
}

// ── Fonte individual (seletor + dose + parcelamento) ──────────────────────────
function FonteBloco({ nutriente, recKgHa, talhao, todos, linhaState, onChange, onRemover, isFirst, infoCalagem, rec }) {
  const { produtoId, doseRecManual, numAplic, pcts, meses = [], observacoes, preco = '' } = linhaState;
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
  const dropRef = useRef(null);

  const precoNum = parseFloat(String(preco).replace(',', '.')) || 0;
  const custoHa = dosesCalc && precoNum > 0 ? dosesCalc.doseHa * precoNum : null;
  const custoTotal = custoHa && area > 0 ? custoHa * area : null;

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

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!dropAberto) return;
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) { setDropAberto(false); setBusca(''); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropAberto]);

  return (
    <div className={`p-4 space-y-4 ${!isFirst ? 'border-t border-border/50 pt-4 mt-2' : ''}`}>
      {!isFirst && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Fonte adicional</span>
          <Button variant="ghost" size="sm" onClick={onRemover} className="h-7 text-xs text-destructive hover:text-destructive gap-1">
            <Trash2 className="w-3.5 h-3.5" /> Remover
          </Button>
        </div>
      )}

      {/* Info de calagem para Ca/Mg */}
      {infoCalagem && (
        <div className="bg-lime-50 border border-lime-200 rounded-lg p-3 text-xs space-y-1">
          <p className="font-semibold text-lime-800">Calagem já prevista:</p>
          <p className="text-lime-700">
            Produto: <strong>{infoCalagem.produtoNome}</strong> — Dose: <strong>{infoCalagem.doseHa} kg/ha</strong>
          </p>
          {infoCalagem.repoeKgHa != null && (
            <p className="text-lime-700">
              Repõe {nutriente.label}: <strong>{infoCalagem.repoeKgHa.toFixed(2)} kg/ha</strong>
              {infoCalagem.deficitKgHa != null && infoCalagem.deficitKgHa > 0
                ? <span className="text-amber-700 ml-2">· Déficit restante: <strong>{infoCalagem.deficitKgHa.toFixed(2)} kg/ha</strong></span>
                : <span className="text-green-700 ml-2">· Sem déficit</span>
              }
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div ref={dropRef} className="relative">
          <Label className="text-xs mb-1 block">Produto</Label>
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
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { onChange({...linhaState, produtoId: null}); setDropAberto(false); setBusca(''); }}>
                  — Nenhum produto —
                </button>
                {produtosFiltrados.map(p => {
                  const pctV = parseFloat(p[nutriente.key]) || 0;
                  return (
                    <button key={p.id} type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted/60 text-xs border-b border-border/30 last:border-0"
                      onMouseDown={e => e.preventDefault()}
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
          {produto && pctNutriente === 0 && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Produto não tem {nutriente.label} cadastrado
            </p>
          )}
        </div>

        {produto && (
          <div className="bg-muted/20 rounded-lg p-3 text-xs space-y-1">
            <p className="font-semibold text-muted-foreground mb-1">Composição:</p>
            <div className="flex flex-wrap gap-2">
              {TODOS_NUTRIENTES_COMPOSICAO.map(n => {
                const v = parseFloat(produto[n.key]) || 0;
                if (!v) return null;
                const isPrincipal = n.key === nutriente.key;

                // Para nutrientes secundários: calcular quanto este produto fornece e o saldo
                let saldoEl = null;
                if (!isPrincipal && dosesCalc && dosesCalc.doseHa > 0) {
                  const fornecidoKgHa = dosesCalc.doseHa * (v / 100);
                  // Mapear n.key para a recKey correspondente
                  const nutDef = NUTRIENTES_CHAVE.find(x => x.key === n.key);
                  const recValor = nutDef && rec ? rec[nutDef.recKey] : null;
                  if (recValor != null) {
                    const saldo = recValor - fornecidoKgHa;
                    if (saldo <= 0) {
                      const excesso = Math.abs(saldo);
                      saldoEl = excesso < 0.05
                        ? <span className="text-green-700 font-semibold ml-1">→ suprido</span>
                        : <span className="text-orange-600 font-semibold ml-1">→ excesso de {excesso.toFixed(1)} kg/ha</span>;
                    } else {
                      saldoEl = <span className="text-yellow-700 font-semibold ml-1">→ falta {saldo.toFixed(1)} kg/ha</span>;
                    }
                  }
                }

                return (
                  <span key={n.key} className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${isPrincipal ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {n.label}: {v}%{saldoEl}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs shrink-0">Dose manual (kg/ha):</Label>
          <VoiceInput type="number" value={doseRecManual}
            onChange={e => onChange({...linhaState, doseRecManual: e.target.value})}
            className="h-7 w-28 text-xs" placeholder={recKgHa != null ? `${recKgHa}` : 'kg/ha'} />
          {recKgHa != null && doseRecManual === '' && (
            <span className="text-xs text-muted-foreground">usando recomendação: {recKgHa} kg/ha</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
          <Label className="text-xs shrink-0">Preço (R$/kg ou R$/L):</Label>
          <VoiceInput type="number" value={preco}
            onChange={e => onChange({...linhaState, preco: e.target.value})}
            className="h-7 w-24 text-xs" placeholder="0,00" min="0" step="0.01" />
        </div>
      </div>
      {(custoHa != null || custoTotal != null) && (
        <div className="flex flex-wrap gap-3">
          {custoHa != null && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-center">
              <p className="text-amber-600">Custo/ha</p>
              <p className="font-bold text-amber-800">{custoHa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
          )}
          {custoTotal != null && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-center">
              <p className="text-amber-600">Custo total talhão</p>
              <p className="font-bold text-amber-800">{custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
          )}
        </div>
      )}

      {dosesCalc && (
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
                    <div className="flex items-center gap-1">
                      <VoiceInput type="number" value={pcts[i]} onChange={e=>setPct(i,e.target.value)}
                        className="h-7 w-20 text-xs pr-6" min="0" max="100" />
                      <span className="text-xs text-muted-foreground shrink-0">%</span>
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
      )}

      {produto && pctNutriente > 0 && !dosesCalc && (
        <div className="bg-muted/20 rounded-xl p-4 text-xs text-muted-foreground">
          Informe a dose recomendada (kg/ha) para calcular automaticamente.
        </div>
      )}

      <div>
        <Label className="text-xs mb-1 block">Observações</Label>
        <VoiceInput value={observacoes} onChange={e=>onChange({...linhaState, observacoes: e.target.value})}
          className="h-8 text-sm" placeholder="Obs..." />
      </div>
    </div>
  );
}

// ── Filtro de fornecedor/produto (apenas N, P, K) ─────────────────────────────
function FiltroProduto({ nutriente, todos, onFiltroProdutoId }) {
  const [fornecedor, setFornecedor] = useState('');
  const [produtoFixoId, setProdutoFixoId] = useState('');

  // Fornecedores que têm pelo menos 1 produto com esse nutriente
  const fornecedores = useMemo(() => {
    const set = new Set();
    todos.forEach(p => {
      if ((parseFloat(p[nutriente.key]) || 0) > 0 && p.fornecedor) set.add(p.fornecedor);
    });
    return Array.from(set).sort();
  }, [todos, nutriente.key]);

  // Produtos do fornecedor selecionado com o nutriente
  const produtosFornecedor = useMemo(() => {
    return todos
      .filter(p => (parseFloat(p[nutriente.key]) || 0) > 0 && (!fornecedor || p.fornecedor === fornecedor))
      .sort((a, b) => (parseFloat(b[nutriente.key]) || 0) - (parseFloat(a[nutriente.key]) || 0));
  }, [todos, nutriente.key, fornecedor]);

  const handleFornecedor = (v) => {
    const novo = v === '__todos__' ? '' : v;
    setFornecedor(novo);
    setProdutoFixoId('');
    onFiltroProdutoId('');
  };

  const handleProduto = (v) => {
    const novo = v === '__todos__' ? '' : v;
    setProdutoFixoId(novo);
    onFiltroProdutoId(novo);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-1">
      <span className="text-xs text-muted-foreground shrink-0">Filtrar:</span>
      <select
        value={fornecedor || '__todos__'}
        onChange={e => handleFornecedor(e.target.value)}
        className="h-7 text-xs border border-input rounded px-2 bg-background text-foreground max-w-[160px]"
      >
        <option value="__todos__">Todos fornecedores</option>
        {fornecedores.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <select
        value={produtoFixoId || '__todos__'}
        onChange={e => handleProduto(e.target.value)}
        className="h-7 text-xs border border-input rounded px-2 bg-background text-foreground max-w-[200px]"
      >
        <option value="__todos__">Todos produtos</option>
        {produtosFornecedor.map(p => (
          <option key={p.id} value={p.id}>
            {p.nome} ({parseFloat(p[nutriente.key])}%)
          </option>
        ))}
      </select>
      {produtoFixoId && (
        <button
          type="button"
          onClick={() => { setProdutoFixoId(''); setFornecedor(''); onFiltroProdutoId(''); }}
          className="text-xs text-muted-foreground hover:text-destructive underline"
        >
          Limpar
        </button>
      )}
    </div>
  );
}

// ── Elemento completo por nutriente (cabeçalho + N fontes + botão adicionar) ──
function ElementoNutriente({ nutriente, recKgHa, talhao, todos, fontes, onChange, infoCalagem, linhasState, rec, analise, analise2040, onFiltroProdutoId }) {
  const addFonte = () => onChange([...fontes, linhaVazia()]);
  const removeFonte = (idx) => onChange(fontes.filter((_, i) => i !== idx));
  const updateFonte = (idx, nova) => { const arr = [...fontes]; arr[idx] = nova; onChange(arr); };

  const soloInfo = getSoloInfo(nutriente.key, analise, analise2040);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-muted/30 border-b border-border">
        <span className="font-bold text-sm text-primary w-10">{nutriente.label}</span>
        <span className="text-xs text-muted-foreground">Recomendado:</span>
        <span className="font-semibold text-sm">
          {recKgHa != null ? `${recKgHa} kg/ha` : '—'}
        </span>
        {recKgHa == null && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Sem recomendação calculada
          </span>
        )}
        {soloInfo && (
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 ml-auto">
            {soloInfo}
          </span>
        )}
      </div>
      {linhasState && (
        <div className="px-4 pb-2">
          <BalancoNutricional
            nutriente={nutriente}
            recKgHa={recKgHa}
            linhasState={linhasState}
            todos={todos}
          />
        </div>
      )}

      {NUTRIENTES_COM_FILTRO.has(nutriente.key) && (
        <FiltroProduto
          nutriente={nutriente}
          todos={todos}
          onFiltroProdutoId={onFiltroProdutoId || (() => {})}
        />
      )}

      {fontes.map((fonte, idx) => (
        <FonteBloco
          key={idx}
          nutriente={nutriente}
          recKgHa={recKgHa}
          talhao={talhao}
          todos={todos}
          linhaState={fonte}
          onChange={nova => updateFonte(idx, nova)}
          onRemover={() => removeFonte(idx)}
          isFirst={idx === 0}
          infoCalagem={idx === 0 ? infoCalagem : null}
          rec={rec}
        />
      ))}

      <div className="px-4 pb-4 pt-2 border-t border-border/40">
        <Button variant="outline" size="sm" onClick={addFonte} className="gap-1.5 text-xs h-7">
          <Plus className="w-3.5 h-3.5" /> Adicionar outra fonte
        </Button>
      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────────
export default function AbaPlanejamento({ produtor, safra, talhoes, analises, analises2040, planos, saving, onSavePlano }) {
  const [talhaoId, setTalhaoId] = useState(null);
  // linhasState: { [nutriente_key]: [fonte1, fonte2, ...] }
  const [linhasState, setLinhasState] = useState({});
  // filtrosProduto: { [nutriente_key]: produtoId fixado pelo usuário }
  const [filtrosProduto, setFiltrosProduto] = useState({});
  const ctxKeyCarregado = useRef(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples = [] }  = useQuery({ queryKey: ['fontes_simples'],  queryFn: () => base44.entities.FonteSimples.list() });
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
  const bpDelete = useMutation({
    mutationFn: id => base44.entities.BasePlanejamentoAdubacao.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['base_planejamento'] }),
  });

  const todos = useMemo(() => [
    ...fertilizantes.map(f => ({ ...f, _tipo: 'formulado' })),
    ...fontesSimples.map(f => ({ ...f, _tipo: 'fonte' })),
  ], [fertilizantes, fontesSimples]);

  const talhoesProdutor = useMemo(() =>
    talhoes.filter(t => t.codigo_produtor === produtor?.codigo), [talhoes, produtor]);

  useEffect(() => {
    setTalhaoId(talhoesProdutor[0]?.id || null);
  }, [produtor?.id]);

  const talhao      = useMemo(() => talhoesProdutor.find(t => t.id === talhaoId) || null, [talhoesProdutor, talhaoId]);
  const analise     = useMemo(() => talhao && safra ? analises.find(a => a.talhao_id===talhao.id && a.safra===safra)||null : null, [analises, talhao, safra]);
  const analise2040obj = useMemo(() => talhao && safra && analises2040 ? analises2040.find(a => a.talhao_id===talhao.id && a.safra===safra)||null : null, [analises2040, talhao, safra]);
  const plano       = useMemo(() => talhao && safra ? planos.find(p => p.talhao_id===talhao.id && p.safra===safra)||null : null, [planos, talhao, safra]);
  const rec         = useMemo(() => calcRecomendacao(analise, plano, analise2040obj), [analise, plano, analise2040obj]);
  const metros      = useMemo(() => getMetros(talhao), [talhao]);

  const registrosSalvos = useMemo(() => {
    if (!produtor?.codigo || !safra || !talhaoId) return [];
    return basePlano.filter(r =>
      r.codigo_produtor === produtor.codigo &&
      r.safra === safra &&
      r.talhao_id === talhaoId
    );
  }, [basePlano, produtor?.codigo, safra, talhaoId]);

  const ctxKey = `${produtor?.id}__${talhaoId}__${safra}`;

  // Registro de calagem para info de Ca/Mg
  const regCalagem = useMemo(() => registrosSalvos.find(r => r.nutriente_key === 'calagem') || null, [registrosSalvos]);
  const produtoCalagem = useMemo(() => regCalagem ? todos.find(p => p.id === regCalagem.produto_id) || null : null, [regCalagem, todos]);

  function getInfoCalagem(nutrienteKey) {
    if (!regCalagem || !produtoCalagem) return null;
    const pctKey = nutrienteKey === 'ca_pct' ? 'ca_pct' : 'mg_pct';
    const pct = parseFloat(produtoCalagem[pctKey]) || 0;
    if (pct === 0) return null;
    const doseHa = parseFloat(regCalagem.dose_rec_manual) || 0;
    const repoeKgHa = doseHa * (pct / 100);
    const recKgHa = nutrienteKey === 'ca_pct' ? rec?.Ca : rec?.Mg;
    const deficitKgHa = recKgHa != null ? Math.max(0, recKgHa - repoeKgHa) : null;
    return {
      produtoNome: produtoCalagem.nome,
      doseHa,
      repoeKgHa,
      deficitKgHa,
    };
  }

  // ── Carregar estado das linhas ───────────────────────────────────────────────
  useEffect(() => {
    if (!talhao || !todos.length) return;
    if (ctxKeyCarregado.current === ctxKey) return;
    ctxKeyCarregado.current = ctxKey;

    const novoState = {};
    // Verifica se há algum registro salvo para este contexto
    const temRegistrosSalvos = registrosSalvos.length > 0;
    // Sugestão inteligente usada apenas quando não há dados salvos
    const sugestoes = !temRegistrosSalvos ? sugerirProdutosInteligente(todos, rec) : {};

    NUTRIENTES_CHAVE.forEach(n => {
      // Registros salvos para este nutriente (pode ter múltiplos — fontes adicionais numeradas)
      // Convenção: nutriente_key = "n_pct", "n_pct__1", "n_pct__2" etc.
      const regsDoNutriente = registrosSalvos.filter(r =>
        r.nutriente_key === n.key || r.nutriente_key?.startsWith(n.key + '__')
      ).sort((a, b) => a.nutriente_key.localeCompare(b.nutriente_key));

      if (regsDoNutriente.length > 0) {
        novoState[n.key] = regsDoNutriente.map(reg => {
          const numAplic = reg.num_aplic || 1;
          return {
            _regId: reg.id,
            _regKey: reg.nutriente_key,
            produtoId: 'produto_id' in reg ? reg.produto_id : undefined,
            doseRecManual: reg.dose_rec_manual ?? '',
            numAplic,
            pcts: reg.pcts?.length ? reg.pcts : (PCT_DEFAULTS[numAplic] || [100]),
            meses: normalizarMeses(reg.meses, numAplic),
            observacoes: reg.observacoes ?? '',
            preco: reg.preco ?? '',
          };
        });
      } else {
        // Usa sugestão inteligente se disponível, senão fallback para melhor produto simples
        const sug = sugestoes[n.key];
        const produtoId = sug !== undefined ? sug.produtoId : (melhorProduto(todos, n.key)?.id || null);
        const doseRecManual = sug !== undefined ? (sug.doseManual || '') : '';
        novoState[n.key] = [{
          produtoId,
          doseRecManual,
          numAplic: 1,
          pcts: [100],
          meses: [[]],
          observacoes: '',
        }];
      }
    });
    setLinhasState(novoState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey, registrosSalvos.length, todos.length]);

  useEffect(() => {
    ctxKeyCarregado.current = null;
  }, [ctxKey]);

  // ── Salvar ──────────────────────────────────────────────────────────────────
  const [salvandoBP, setSalvandoBP] = useState(false);

  const handleSave = async () => {
    if (!talhao || !produtor || !safra) return;
    setSalvandoBP(true);

    const promises = NUTRIENTES_CHAVE.flatMap(n => {
      const fontes = linhasState[n.key] || [linhaVazia()];
      return fontes.map(async (linha, idx) => {
        const produto = todos.find(p => p.id === linha.produtoId) || null;
        const doseNutriHa = linha.doseRecManual !== ''
          ? linha.doseRecManual
          : (rec?.[n.recKey] != null ? String(rec[n.recKey]) : '');

        // Chave única para esta fonte: primeira usa n.key, adicionais usam n.key__1, n.key__2...
        const regKey = idx === 0 ? n.key : `${n.key}__${idx}`;

        const payload = {
          codigo_produtor: produtor.codigo,
          safra,
          talhao_id: talhao.id,
          talhao_nome: talhao.nome,
          nutriente_key: regKey,
          nutriente_label: n.label,
          produto_id: linha.produtoId !== undefined ? linha.produtoId : null,
          produto_nome: linha.produtoId === null ? 'Nenhum produto' : (produto?.nome || null),
          dose_rec_manual: doseNutriHa,
          num_aplic: linha.numAplic,
          pcts: linha.pcts,
          meses: linha.meses,
          observacoes: linha.observacoes,
          preco: linha.preco || '',
          status: 'planejado',
        };

        const existente = registrosSalvos.find(r => r.nutriente_key === regKey);
        if (existente) {
          await bpUpdate.mutateAsync({ id: existente.id, d: payload });
        } else {
          await bpCreate.mutateAsync(payload);
        }
      });
    });

    // Deletar registros removidos (fontes que existiam mas foram apagadas)
    const keysAtivas = new Set(NUTRIENTES_CHAVE.flatMap(n =>
      (linhasState[n.key] || [linhaVazia()]).map((_, idx) => idx === 0 ? n.key : `${n.key}__${idx}`)
    ));
    const parasApagar = registrosSalvos.filter(r =>
      NUTRIENTES_CHAVE.some(n => r.nutriente_key === n.key || r.nutriente_key?.startsWith(n.key + '__')) &&
      !keysAtivas.has(r.nutriente_key)
    );
    const deletePromises = parasApagar.map(r => bpDelete.mutateAsync(r.id));

    await Promise.all([...promises, ...deletePromises]);

    const planejamentoNutrientes = {};
    NUTRIENTES_CHAVE.forEach(n => { planejamentoNutrientes[n.key] = (linhasState[n.key] || [linhaVazia()])[0]; });
    onSavePlano(talhao, { planejamento_nutrientes: planejamentoNutrientes });

    setSalvandoBP(false);
    toast({ title: 'Planejamento salvo!', description: `${talhao.nome} — ${safra}` });
  };

  const handleSugerirProdutos = () => {
    const sugestoes = sugerirProdutosInteligente(todos, rec);
    setLinhasState(prev => {
      const novo = { ...prev };
      NUTRIENTES_CHAVE.forEach(n => {
        const sug = sugestoes[n.key];
        // Se o usuário fixou um produto para este nutriente, usa ele
        const produtoFixo = filtrosProduto[n.key] || null;
        const produtoId = produtoFixo
          ? produtoFixo
          : sug !== undefined
            ? sug.produtoId
            : (rec?.[n.recKey] != null ? null : undefined);
        const doseRecManual = sug !== undefined ? (sug.doseManual || '') : (novo[n.key]?.[0]?.doseRecManual || '');
        if (novo[n.key]?.length > 0) {
          novo[n.key] = [{ ...novo[n.key][0], produtoId, doseRecManual }, ...novo[n.key].slice(1)];
        }
      });
      return novo;
    });
  };

  // Calcula custo total de adubação via solo para um talhão + linhasState
  function calcCustoTalhao(talhaoObj, linhas, recObj) {
    if (!talhaoObj) return 0;
    const area = talhaoObj.area_ha || 0;
    let total = 0;
    NUTRIENTES_CHAVE.forEach(n => {
      const fontes = linhas[n.key] || [];
      fontes.forEach(linha => {
        const produto = todos.find(p => p.id === linha.produtoId) || null;
        const precoNum = parseFloat(String(linha.preco || '').replace(',', '.')) || 0;
        if (!produto || !precoNum) return;
        const pctNut = parseFloat(produto[n.key]) || 0;
        if (!pctNut) return;
        const recKgHa = recObj?.[n.recKey] ?? null;
        const doseNut = linha.doseRecManual !== '' ? parseFloat(linha.doseRecManual) : recKgHa;
        if (!doseNut) return;
        const doseHa = doseNut / (pctNut / 100);
        total += doseHa * precoNum * area;
      });
    });
    return total;
  }

  if (!produtor || !safra) return (
    <div className="text-center py-12 text-muted-foreground">
      <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p>Selecione produtor e safra para planejar.</p>
    </div>
  );

  const isSaving = salvandoBP || saving || bpCreate.isPending || bpUpdate.isPending || bpDelete.isPending;

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
                    {t.nome}{registrosSalvos.filter(r=>r.talhao_id===t.id).length > 0 ? ' ✓' : ''}
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
                    <div className="flex flex-wrap gap-2">
                      {NUTRIENTES_CHAVE.slice(0,4).map(n => (
                        <div key={n.key} className="bg-white rounded-lg px-3 py-1.5 border border-orange-100 text-center min-w-[64px]">
                          <p className="text-xs text-muted-foreground">{n.label}</p>
                          <p className="font-bold text-sm">{rec[n.recKey]!=null ? `${rec[n.recKey]} kg/ha` : <span className="text-muted-foreground text-xs">—</span>}</p>
                        </div>
                      ))}
                    </div>
                    {(rec.Zn || rec.Cu || rec.Mn || rec.Ca != null || rec.Mg != null || rec.S != null) && (
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'Zn', val: rec.Zn, tipo: 'acao' },
                          { label: 'Cu', val: rec.Cu, tipo: 'acao' },
                          { label: 'Mn', val: rec.Mn, tipo: 'acao' },
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

          {/* Item de calagem */}
          {regCalagem && (
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
          )}

          {/* Linhas por nutriente */}
          <div className="space-y-4">
            {NUTRIENTES_CHAVE.map(n => {
              const recKgHa = rec?.[n.recKey] ?? null;
              const fontes = linhasState[n.key] || [linhaVazia()];
              const temDados = fontes.some(f => f.produtoId !== undefined || f.doseRecManual || f.observacoes);

              // Para Ca e Mg: info do calcário
              const infoCalagem = (n.key === 'ca_pct' || n.key === 'mg_pct') ? getInfoCalagem(n.key) : null;

              return (
                <ElementoNutriente
                  key={n.key}
                  nutriente={n}
                  recKgHa={recKgHa}
                  talhao={talhao}
                  todos={todos}
                  fontes={fontes}
                  onChange={novasFontes => setLinhasState(prev => ({...prev, [n.key]: novasFontes}))}
                  infoCalagem={infoCalagem}
                  linhasState={linhasState}
                  rec={rec}
                  analise={analise}
                  analise2040={analise2040obj}
                  onFiltroProdutoId={NUTRIENTES_COM_FILTRO.has(n.key)
                    ? (pid) => setFiltrosProduto(prev => ({ ...prev, [n.key]: pid }))
                    : undefined}
                />
              );
            })}
          </div>
        </>
      )}

      {talhao && (
        <>
          {/* Resumo de custo do talhão */}
          {(() => {
            const custo = calcCustoTalhao(talhao, linhasState, rec);
            return custo > 0 ? (
              <ResumoCustosAdubacao label={`Custo total adubação via solo — ${talhao.nome}`} custoTotal={custo} />
            ) : null;
          })()}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Planejamento — {talhao.nome}
            </Button>
          </div>
        </>
      )}

      {/* Custo total do produtor — todos os talhões */}
      {(() => {
        if (talhoesProdutor.length < 2) return null;
        // Para calcular corretamente precisamos dos dados salvos (basePlano)
        let totalProdutor = 0;
        talhoesProdutor.forEach(t => {
          const regs = basePlano.filter(r =>
            r.codigo_produtor === produtor.codigo && r.safra === safra && r.talhao_id === t.id
          );
          const area = t.area_ha || 0;
          NUTRIENTES_CHAVE.forEach(n => {
            const regsNut = regs.filter(r => r.nutriente_key === n.key || r.nutriente_key?.startsWith(n.key + '__'));
            regsNut.forEach(reg => {
              const produto = todos.find(p => p.id === reg.produto_id) || null;
              const precoNum = parseFloat(String(reg.preco || '').replace(',', '.')) || 0;
              if (!produto || !precoNum) return;
              const pctNut = parseFloat(produto[n.key]) || 0;
              if (!pctNut) return;
              const doseNut = reg.dose_rec_manual ? parseFloat(reg.dose_rec_manual) : null;
              if (!doseNut) return;
              const doseHa = doseNut / (pctNut / 100);
              totalProdutor += doseHa * precoNum * area;
            });
          });
        });
        return totalProdutor > 0 ? (
          <ResumoCustosAdubacao label="Custo total adubação via solo — todos os talhões" custoTotal={totalProdutor} className="border-2 border-amber-300" />
        ) : null;
      })()}
    </div>
  );
}