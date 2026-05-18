import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Loader2, Plus, Trash2, Package, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

// ── Constantes ────────────────────────────────────────────────────────────────
const NUTRIENTES = [
  { key: 'n_pct', label: 'N' }, { key: 'p2o5_pct', label: 'P₂O₅' },
  { key: 'k2o_pct', label: 'K₂O' }, { key: 'ca_pct', label: 'Ca' },
  { key: 'mg_pct', label: 'Mg' }, { key: 's_pct', label: 'S' },
  { key: 'b_pct', label: 'B' }, { key: 'zn_pct', label: 'Zn' },
  { key: 'cu_pct', label: 'Cu' }, { key: 'mn_pct', label: 'Mn' },
  { key: 'fe_pct', label: 'Fe' },
];
const APLICACOES = ['1ª', '2ª', '3ª'];

let _nid = 1;
function nid() { return _nid++; }

// ── Helpers de cálculo ────────────────────────────────────────────────────────
function getMetros(talhao) {
  const numPlantas = talhao?.num_plantas || 0;
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',', '.')));
  const linhaM = partes?.[0] || 0;
  if (numPlantas > 0 && linhaM > 0) return numPlantas * linhaM;
  // fallback: area * 10000 / espaçamento
  if (talhao?.area_ha && linhaM > 0) return Math.round((talhao.area_ha * 10000) / linhaM);
  return 0;
}

function converterKg(kg, talhao) {
  if (!kg || kg <= 0) return null;
  const numPlantas = talhao?.num_plantas || 0;
  const metros = getMetros(talhao);
  return {
    kg: Math.round(kg),
    sc60: (kg / 60).toFixed(1),
    ton: (kg / 1000).toFixed(3),
    gPe: numPlantas > 0 ? ((kg * 1000) / numPlantas).toFixed(1) : null,
    gMt: metros > 0 ? ((kg * 1000) / metros).toFixed(1) : null,
  };
}

function calcDoseAuto(linha, talhao) {
  const prod = linha._produto;
  if (!prod || !linha.nutriente_ref || !linha.rec_kgha) return null;
  const pct = prod[linha.nutriente_ref];
  if (!pct || pct <= 0) return { semComposicao: true };
  const recKgHa = parseFloat(linha.rec_kgha) || 0;
  const doseHaSug = recKgHa / (pct / 100);
  const doseHaFinal = parseFloat(linha.dose_ajust_kgha) || doseHaSug;
  const areaHa = talhao?.area_ha || 0;
  const qtdTotal = areaHa > 0 ? doseHaFinal * areaHa : null;
  const fornecidos = NUTRIENTES.filter(n => prod[n.key] > 0).map(n => ({
    label: n.label, pct: prod[n.key],
    kgHa: parseFloat((doseHaFinal * prod[n.key] / 100).toFixed(1)),
    kgTotal: qtdTotal ? parseFloat((qtdTotal * prod[n.key] / 100).toFixed(1)) : null,
  }));
  const saldo = parseFloat(((doseHaFinal * pct / 100) - recKgHa).toFixed(1));
  return { doseHaSug: Math.round(doseHaSug * 10) / 10, doseHaFinal: Math.round(doseHaFinal * 10) / 10, qtdTotal, fornecidos, saldo };
}

function statusDiferenca(planejado, executado, dataExec) {
  const plan = parseFloat(planejado) || 0;
  const exec = parseFloat(executado) || 0;
  if (!plan) return null;
  if (!exec && !dataExec) return { tipo: 'pendente', icon: 'clock', label: 'pendente', cor: 'text-muted-foreground' };
  if (!exec) return { tipo: 'pendente', icon: 'clock', label: 'pendente', cor: 'text-muted-foreground' };
  const diff = exec - plan;
  const pct = Math.abs(diff / plan) * 100;
  if (pct <= 5) return { tipo: 'ok', icon: 'ok', label: '✅', cor: 'text-green-600', diff };
  if (pct <= 20) return { tipo: 'aviso', icon: 'warn', label: '⚠️', cor: 'text-amber-600', diff };
  return { tipo: 'erro', icon: 'err', label: '🔴', cor: 'text-red-600', diff };
}

function linhaVazia() {
  return {
    _id: nid(), produto_id: null, produto_tipo: null, _produto: null, _aberto: false,
    aplicacao: '1ª',
    nutriente_ref: '', rec_kgha: '', dose_ajust_kgha: '',
    qtd_planejado: '', data_planejada: '', epoca_prevista: '',
    qtd_comprado: '', data_comprado: '',
    qtd_executado: '', data_executada: '',
    observacoes: '',
  };
}

// ── Bloco de conversões ───────────────────────────────────────────────────────
function BlocoUnidades({ kg, talhao, label, cor }) {
  const c = converterKg(parseFloat(kg), talhao);
  if (!c) return <span className="text-muted-foreground">—</span>;
  return (
    <div className={`text-xs leading-snug ${cor || ''}`}>
      <span className="font-semibold">{c.kg} kg</span>
      <span className="text-muted-foreground"> · {c.sc60} sc · {c.ton} t</span>
      {c.gPe && <div className="text-muted-foreground">{c.gPe} g/pé · {c.gMt ? `${c.gMt} g/m` : ''}</div>}
    </div>
  );
}

// ── Seletor de produto ────────────────────────────────────────────────────────
function ProdutoSelector({ value, onChange, todos }) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return todos.filter(p => (p.nome || '').toLowerCase().includes(q) || (p.fornecedor || '').toLowerCase().includes(q));
  }, [todos, busca]);
  const sel = todos.find(p => p.id === value);

  return (
    <div className="relative min-w-[160px]">
      <button type="button"
        className="w-full h-7 text-xs border border-input rounded px-2 text-left flex items-center justify-between bg-transparent hover:bg-muted/30"
        onClick={() => setAberto(a => !a)}>
        <span className={sel ? 'text-foreground truncate' : 'text-muted-foreground'}>
          {sel ? sel.nome : 'Selecionar...'}
        </span>
        <ChevronDown className="w-3 h-3 text-muted-foreground ml-1 shrink-0" />
      </button>
      {aberto && (
        <div className="absolute z-50 top-full left-0 w-72 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <input autoFocus className="w-full h-7 text-xs border border-input rounded px-2 bg-background"
              placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtrados.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum produto</p>}
            {filtrados.map(p => (
              <button key={p.id} type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted/60 text-xs border-b border-border/30 last:border-0"
                onClick={() => { onChange(p); setAberto(false); setBusca(''); }}>
                <div className="font-medium">{p.nome}</div>
                <div className="text-muted-foreground">{p._tipo === 'formulado' ? 'Formulado' : 'Fonte Simples'}{p.fornecedor ? ` · ${p.fornecedor}` : ''}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Painel de detalhes expandido ──────────────────────────────────────────────
function LinhaDetalhe({ linha, talhao, calc, onChange }) {
  const prod = linha._produto;
  const composicao = prod ? NUTRIENTES.filter(n => prod[n.key] > 0).map(n => `${prod[n.key]}% ${n.label}`).join(' · ') : '';

  return (
    <tr className="bg-blue-50/30">
      <td colSpan={10} className="px-4 pb-3 pt-1">
        {composicao && <p className="text-xs text-blue-700 mb-2"><span className="font-semibold">Composição:</span> {composicao}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Nutriente ref.</p>
            <select value={linha.nutriente_ref || ''} onChange={e => onChange({ ...linha, nutriente_ref: e.target.value })}
              className="h-7 w-full text-xs border border-input rounded px-2 bg-transparent">
              <option value="">Selecione...</option>
              {NUTRIENTES.map(n => <option key={n.key} value={n.key}>{n.label}{prod?.[n.key] > 0 ? ` (${prod[n.key]}%)` : ''}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Recomendado (kg/ha)</p>
            <Input type="number" value={linha.rec_kgha} onChange={e => onChange({ ...linha, rec_kgha: e.target.value })} className="h-7 text-xs" placeholder="Ex: 200" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Dose sugerida (kg/ha)</p>
            <Input value={calc && !calc.semComposicao ? calc.doseHaSug : ''} readOnly className="h-7 text-xs bg-green-50 font-semibold" placeholder="—" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Dose ajustada (kg/ha)</p>
            <Input type="number" value={linha.dose_ajust_kgha} onChange={e => onChange({ ...linha, dose_ajust_kgha: e.target.value })} className="h-7 text-xs" placeholder="Opcional" />
          </div>
        </div>

        {calc?.semComposicao && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-xs text-yellow-700 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Produto sem composição para este nutriente. Edite na Base de Fertilizantes.
          </div>
        )}

        {calc && !calc.semComposicao && calc.fornecidos.length > 0 && (
          <div className="overflow-x-auto mb-2">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1 pr-3 text-muted-foreground font-medium">Nutriente</th>
                  <th className="text-center py-1 px-2 text-muted-foreground font-medium">% produto</th>
                  <th className="text-center py-1 px-2 text-muted-foreground font-medium">Fornecido kg/ha</th>
                  <th className="text-center py-1 px-2 text-muted-foreground font-medium">Total kg</th>
                  <th className="text-center py-1 px-2 text-muted-foreground font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {calc.fornecidos.map(f => {
                  const isRef = NUTRIENTES.find(n => n.key === linha.nutriente_ref)?.label === f.label;
                  return (
                    <tr key={f.label} className={`border-b border-border/40 ${isRef ? 'bg-green-50' : ''}`}>
                      <td className="py-1 pr-3 font-medium">{f.label}</td>
                      <td className="py-1 px-2 text-center">{f.pct}%</td>
                      <td className="py-1 px-2 text-center font-semibold">{f.kgHa}</td>
                      <td className="py-1 px-2 text-center">{f.kgTotal ?? '—'}</td>
                      <td className={`py-1 px-2 text-center font-semibold ${isRef ? (calc.saldo >= 0 ? 'text-green-600' : 'text-red-600') : 'text-muted-foreground'}`}>
                        {isRef ? `${calc.saldo >= 0 ? '+' : ''}${calc.saldo} kg/ha` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <p className="text-xs text-muted-foreground mb-1">Observações</p>
          <Input value={linha.observacoes} onChange={e => onChange({ ...linha, observacoes: e.target.value })} className="h-7 text-xs" placeholder="Obs..." />
        </div>
      </td>
    </tr>
  );
}

// ── Resumo por produto ────────────────────────────────────────────────────────
function ResumoProdutos({ linhas, talhao, todos }) {
  const por_produto = useMemo(() => {
    const map = {};
    linhas.forEach(l => {
      if (!l.produto_id) return;
      const prod = l._produto || todos.find(p => p.id === l.produto_id);
      const nome = prod?.nome || l.produto_id;
      if (!map[l.produto_id]) map[l.produto_id] = { nome, plan: 0, comp: 0, exec: 0 };
      map[l.produto_id].plan += parseFloat(l.qtd_planejado) || 0;
      map[l.produto_id].comp += parseFloat(l.qtd_comprado) || 0;
      map[l.produto_id].exec += parseFloat(l.qtd_executado) || 0;
    });
    return Object.values(map).filter(p => p.plan > 0 || p.comp > 0 || p.exec > 0);
  }, [linhas, todos]);

  if (por_produto.length === 0) return null;

  return (
    <div className="px-5 py-4 border-t border-border bg-muted/10">
      <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Resumo consolidado por produto</p>
      <div className="space-y-3">
        {por_produto.map(p => {
          const planC = converterKg(p.plan, talhao);
          const execC = converterKg(p.exec, talhao);
          const diff = p.exec - p.plan;
          const pctDiff = p.plan > 0 ? Math.abs(diff / p.plan) * 100 : 0;
          const semExec = p.exec === 0;
          const cor = semExec ? 'text-muted-foreground' : pctDiff <= 5 ? 'text-green-600' : pctDiff <= 20 ? 'text-amber-600' : 'text-red-600';
          const icon = semExec ? '🕐' : pctDiff <= 5 ? '✅' : pctDiff <= 20 ? '⚠️' : '🔴';
          return (
            <div key={p.nome} className="bg-white border border-border/60 rounded-lg p-3 text-xs">
              <p className="font-semibold text-sm mb-2">{p.nome}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <p className="text-muted-foreground font-medium mb-0.5">Planejado</p>
                  {planC ? <p><strong>{planC.kg} kg</strong> · {planC.sc60} sc · {planC.ton} t{planC.gPe ? ` · ${planC.gPe} g/pé` : ''}{planC.gMt ? ` · ${planC.gMt} g/m` : ''}</p> : <p className="text-muted-foreground">—</p>}
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-0.5">Comprado</p>
                  {p.comp > 0 ? <p><strong>{Math.round(p.comp)} kg</strong></p> : <p className="text-muted-foreground">—</p>}
                </div>
                <div>
                  <p className="text-muted-foreground font-medium mb-0.5">Executado {icon}</p>
                  {execC
                    ? <p className={cor}><strong>{execC.kg} kg</strong> · {execC.sc60} sc · {execC.ton} t{execC.gPe ? ` · ${execC.gPe} g/pé` : ''}</p>
                    : <p className="text-muted-foreground">—</p>}
                  {!semExec && pctDiff > 5 && (
                    <p className={cor}>{diff >= 0 ? '+' : ''}{Math.round(diff)} kg ({pctDiff > 20 ? '>' : '≈'}{Math.round(pctDiff)}% {diff < 0 ? 'abaixo' : 'acima'} do planejado)</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PlanoAplicacoes({ dados, talhao, onSave, saving }) {
  const [linhas, setLinhas] = useState([]);
  const [filtroApl, setFiltroApl] = useState('Todas');

  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples = [] } = useQuery({ queryKey: ['fontes_simples'], queryFn: () => base44.entities.FonteSimples.list() });

  const todos = useMemo(() => [
    ...fertilizantes.map(f => ({ ...f, _tipo: 'formulado' })),
    ...fontesSimples.map(f => ({ ...f, _tipo: 'fonte' })),
  ], [fertilizantes, fontesSimples]);

  // ── Hidratar ao mudar talhão/plano ──────────────────────────────────────────
  const dadosId = dados?.id ?? null;
  useEffect(() => {
    const saved = dados?.plano_aplicacoes;
    if (saved && Array.isArray(saved) && saved.length > 0 && todos.length > 0) {
      setLinhas(saved.map(l => ({ ...l, _id: nid(), _produto: todos.find(p => p.id === l.produto_id) || null, _aberto: false })));
    } else {
      setLinhas([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosId, todos.length]);

  const handleSave = () => {
    const toSave = linhas.map(({ _id, _produto, _aberto, ...rest }) => ({ ...rest, produto_id: rest.produto_id || null, produto_tipo: rest.produto_tipo || null }));
    onSave({ plano_aplicacoes: toSave });
  };

  const addLinha = () => setLinhas(ls => [...ls, linhaVazia()]);
  const removeLinha = id => setLinhas(ls => ls.filter(l => l._id !== id));
  const updateLinha = (id, novo) => setLinhas(ls => ls.map(l => l._id === id ? { ...novo, _id: id } : l));
  const toggleAberto = id => setLinhas(ls => ls.map(l => l._id === id ? { ...l, _aberto: !l._aberto } : l));

  const linhasFiltradas = useMemo(() =>
    filtroApl === 'Todas' ? linhas : linhas.filter(l => l.aplicacao === filtroApl),
    [linhas, filtroApl]);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-blue-50 border-b border-border">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-700" />
          <span className="font-semibold text-sm text-blue-800">Plano de Adubação e Aplicações</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filtroApl} onChange={e => setFiltroApl(e.target.value)} className="h-7 text-xs border border-input rounded px-2 bg-white">
            <option value="Todas">Todas as aplicações</option>
            {APLICACOES.map(a => <option key={a} value={a}>{a} Aplicação</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={addLinha} className="h-7 gap-1 text-xs">
            <Plus className="w-3 h-3" /> Adicionar Produto
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-2 pl-4 pr-2 font-medium text-muted-foreground w-6">#</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground min-w-[160px]">Produto</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-20">Aplic.</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-36 bg-amber-50">Planejado (kg)</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-36 bg-blue-50">Comprado (kg)</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-36 bg-green-50">Executado (kg)</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-28">Diferença</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-32">Época prevista</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-28">Data Plan.</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-28">Data Exec.</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-16">Det.</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {linhasFiltradas.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-10 text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum produto adicionado.</p>
                  <p className="text-xs mt-1">Clique em "Adicionar Produto" para começar.</p>
                </td>
              </tr>
            )}

            {linhasFiltradas.map((linha, idx) => {
              const calc = calcDoseAuto(linha, talhao);
              const dif = statusDiferenca(linha.qtd_planejado, linha.qtd_executado, linha.data_executada);

              return (
                <React.Fragment key={linha._id}>
                  <tr className="border-b border-border/50 hover:bg-muted/10">
                    <td className="py-2 pl-4 pr-2 text-muted-foreground">{idx + 1}</td>

                    {/* Produto */}
                    <td className="py-1.5 px-2">
                      <ProdutoSelector value={linha.produto_id}
                        onChange={p => updateLinha(linha._id, { ...linha, produto_id: p.id, produto_tipo: p._tipo, _produto: p })}
                        todos={todos} />
                    </td>

                    {/* Aplicação */}
                    <td className="py-1.5 px-2">
                      <select value={linha.aplicacao} onChange={e => updateLinha(linha._id, { ...linha, aplicacao: e.target.value })}
                        className="h-7 text-xs border border-input rounded px-1 bg-transparent w-full">
                        {APLICACOES.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </td>

                    {/* Planejado */}
                    <td className="py-1.5 px-2 bg-amber-50/30">
                      <Input type="number" value={linha.qtd_planejado}
                        onChange={e => updateLinha(linha._id, { ...linha, qtd_planejado: e.target.value })}
                        className="h-7 text-xs text-center" placeholder="kg" />
                      {linha.qtd_planejado > 0 && (
                        <BlocoUnidades kg={linha.qtd_planejado} talhao={talhao} />
                      )}
                    </td>

                    {/* Comprado */}
                    <td className="py-1.5 px-2 bg-blue-50/30">
                      <Input type="number" value={linha.qtd_comprado}
                        onChange={e => updateLinha(linha._id, { ...linha, qtd_comprado: e.target.value })}
                        className="h-7 text-xs text-center" placeholder="kg" />
                    </td>

                    {/* Executado */}
                    <td className="py-1.5 px-2 bg-green-50/30">
                      <Input type="number" value={linha.qtd_executado}
                        onChange={e => updateLinha(linha._id, { ...linha, qtd_executado: e.target.value })}
                        className="h-7 text-xs text-center" placeholder="kg" />
                      {linha.qtd_executado > 0 && (
                        <BlocoUnidades kg={linha.qtd_executado} talhao={talhao} />
                      )}
                    </td>

                    {/* Diferença */}
                    <td className="py-1.5 px-2 text-center">
                      {dif ? (
                        <div className={`text-xs font-medium ${dif.cor}`}>
                          <div>{dif.label}</div>
                          {dif.diff != null && (
                            <div className="text-muted-foreground font-normal">
                              {dif.diff >= 0 ? '+' : ''}{Math.round(dif.diff)} kg
                            </div>
                          )}
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Época prevista */}
                    <td className="py-1.5 px-2">
                      <Input value={linha.epoca_prevista || ''}
                        onChange={e => updateLinha(linha._id, { ...linha, epoca_prevista: e.target.value })}
                        className="h-7 text-xs" placeholder="Ex: out/nov" />
                    </td>

                    {/* Data Planejada */}
                    <td className="py-1.5 px-2">
                      <Input type="date" value={linha.data_planejada}
                        onChange={e => updateLinha(linha._id, { ...linha, data_planejada: e.target.value })}
                        className="h-7 text-xs" />
                    </td>

                    {/* Data Executada */}
                    <td className="py-1.5 px-2">
                      <Input type="date" value={linha.data_executada}
                        onChange={e => updateLinha(linha._id, { ...linha, data_executada: e.target.value })}
                        className="h-7 text-xs" />
                    </td>

                    {/* Detalhes */}
                    <td className="py-1.5 px-2 text-center">
                      <button type="button" onClick={() => toggleAberto(linha._id)} className="p-1 hover:bg-muted rounded text-muted-foreground">
                        {linha._aberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>

                    {/* Excluir */}
                    <td className="py-1.5 px-1 text-center">
                      <button type="button" onClick={() => removeLinha(linha._id)} className="p-1 hover:bg-destructive/10 rounded text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>

                  {linha._aberto && (
                    <LinhaDetalhe linha={linha} talhao={talhao} calc={calc} onChange={novo => updateLinha(linha._id, novo)} />
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Resumo por produto */}
      <ResumoProdutos linhas={linhas} talhao={talhao} todos={todos} />

      {/* Salvar */}
      <div className="px-5 py-3 border-t border-border flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Plano de Adubação
        </Button>
      </div>
    </div>
  );
}