import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Plus, Trash2, Package, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

// ── Nutrientes rastreados ────────────────────────────────────────────────────
const NUTRIENTES = [
  { key: 'n_pct',    label: 'N' },
  { key: 'p2o5_pct', label: 'P₂O₅' },
  { key: 'k2o_pct',  label: 'K₂O' },
  { key: 'ca_pct',   label: 'Ca' },
  { key: 'mg_pct',   label: 'Mg' },
  { key: 's_pct',    label: 'S' },
  { key: 'b_pct',    label: 'B' },
  { key: 'zn_pct',   label: 'Zn' },
  { key: 'cu_pct',   label: 'Cu' },
  { key: 'mn_pct',   label: 'Mn' },
  { key: 'fe_pct',   label: 'Fe' },
];

const APLICACOES = ['1ª', '2ª', '3ª'];
const STATUS_OPTS = ['Planejado', 'Comprado', 'Executado'];

// ── Helpers ──────────────────────────────────────────────────────────────────
let _nextId = 1;
function novoId() { return _nextId++; }

function linhaVazia() {
  return {
    _id: novoId(),
    produto_id: null,
    produto_tipo: null,
    aplicacao: '1ª',
    status: 'Planejado',
    nutriente_ref: '',
    rec_kgha: '',
    dose_calc_kgha: '',
    dose_ajust_kgha: '',
    qtd_total: '',
    unidade: 'kg',
    data_planejada: '',
    data_executada: '',
    observacoes: '',
    // interno
    _produto: null,
    _aberto: false,
  };
}

function calcDose(linha, talhao) {
  const prod = linha._produto;
  if (!prod || !linha.nutriente_ref || !linha.rec_kgha) return null;
  const pct = prod[linha.nutriente_ref];
  if (!pct || pct <= 0) return { semComposicao: true };

  const recKgHa = parseFloat(linha.rec_kgha) || 0;
  const doseHaSug = recKgHa / (pct / 100);
  const doseHaFinal = parseFloat(linha.dose_ajust_kgha) || doseHaSug;
  const areaHa = talhao?.area_ha || 0;
  const qtdTotal = areaHa > 0 ? Math.round(doseHaFinal * areaHa) : null;

  const numPlantas = talhao?.num_plantas || 0;
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',', '.')));
  const linhaM = partes?.[0] || 0;
  const metros = numPlantas > 0 && linhaM > 0 ? numPlantas * linhaM : 0;
  const gPe = numPlantas > 0 && qtdTotal ? ((qtdTotal * 1000) / numPlantas).toFixed(1) : null;
  const gMt = metros > 0 && qtdTotal ? ((qtdTotal * 1000) / metros).toFixed(1) : null;

  const fornecidos = NUTRIENTES
    .filter(n => prod[n.key] > 0)
    .map(n => ({
      label: n.label,
      pct: prod[n.key],
      kgHa: parseFloat((doseHaFinal * prod[n.key] / 100).toFixed(1)),
      kgTotal: qtdTotal ? parseFloat((qtdTotal * prod[n.key] / 100).toFixed(1)) : null,
    }));

  const fornecidoRef = doseHaFinal * pct / 100;
  const saldo = parseFloat((fornecidoRef - recKgHa).toFixed(1));

  return {
    doseHaSug: Math.round(doseHaSug * 10) / 10,
    doseHaFinal: Math.round(doseHaFinal * 10) / 10,
    qtdTotal,
    sacos: qtdTotal ? (qtdTotal / 50).toFixed(2) : null,
    gPe, gMt, fornecidos, saldo,
  };
}

// ── Seletor de produto ────────────────────────────────────────────────────────
function ProdutoSelector({ value, onChange, todos }) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return todos.filter(p =>
      (p.nome || '').toLowerCase().includes(q) ||
      (p.fornecedor || '').toLowerCase().includes(q)
    );
  }, [todos, busca]);
  const sel = todos.find(p => p.id === value);

  return (
    <div className="relative min-w-[180px]">
      <button
        type="button"
        className="w-full h-7 text-xs border border-input rounded px-2 text-left flex items-center justify-between bg-transparent hover:bg-muted/30"
        onClick={() => setAberto(a => !a)}
      >
        <span className={sel ? 'text-foreground truncate' : 'text-muted-foreground'}>
          {sel ? sel.nome : 'Selecionar...'}
        </span>
        <ChevronDown className="w-3 h-3 text-muted-foreground ml-1 shrink-0" />
      </button>
      {aberto && (
        <div className="absolute z-50 top-full left-0 w-72 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              className="w-full h-7 text-xs border border-input rounded px-2 bg-background"
              placeholder="Buscar produto..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtrados.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum produto</p>
            )}
            {filtrados.map(p => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted/60 text-xs border-b border-border/30 last:border-0"
                onClick={() => { onChange(p); setAberto(false); setBusca(''); }}
              >
                <div className="font-medium">{p.nome}</div>
                <div className="text-muted-foreground">
                  {p._tipo === 'formulado' ? 'Formulado' : 'Fonte Simples'}
                  {p.fornecedor ? ` · ${p.fornecedor}` : ''}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Linha expandida (detalhes) ────────────────────────────────────────────────
function LinhaDetalhe({ linha, talhao, calc, onChange }) {
  const prod = linha._produto;
  const composicao = prod
    ? NUTRIENTES.filter(n => prod[n.key] > 0).map(n => `${prod[n.key]}% ${n.label}`).join(' · ')
    : '';

  return (
    <tr className="bg-blue-50/40">
      <td colSpan={12} className="px-4 pb-3 pt-1">
        {prod && composicao && (
          <p className="text-xs text-blue-700 mb-2">
            <span className="font-semibold">Composição:</span> {composicao}
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
          {/* Nutriente de referência */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Nutriente ref.</p>
            <select
              value={linha.nutriente_ref || ''}
              onChange={e => onChange({ ...linha, nutriente_ref: e.target.value })}
              className="h-7 w-full text-xs border border-input rounded px-2 bg-transparent"
            >
              <option value="">Selecione...</option>
              {NUTRIENTES.map(n => (
                <option key={n.key} value={n.key}>
                  {n.label}{prod?.[n.key] > 0 ? ` (${prod[n.key]}%)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Recomendado */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Recomendado (kg/ha)</p>
            <Input
              type="number"
              value={linha.rec_kgha}
              onChange={e => onChange({ ...linha, rec_kgha: e.target.value })}
              className="h-7 text-xs"
              placeholder="Ex: 200"
            />
          </div>

          {/* Dose sugerida (readonly) */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Dose sugerida (kg/ha)</p>
            <Input
              value={calc && !calc.semComposicao ? calc.doseHaSug : ''}
              readOnly
              className="h-7 text-xs bg-green-50 font-semibold"
              placeholder="—"
            />
          </div>

          {/* Dose ajustada */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Dose ajustada (kg/ha)</p>
            <Input
              type="number"
              value={linha.dose_ajust_kgha}
              onChange={e => onChange({ ...linha, dose_ajust_kgha: e.target.value })}
              className="h-7 text-xs"
              placeholder="Opcional"
            />
          </div>
        </div>

        {calc?.semComposicao && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-xs text-yellow-700 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Produto sem composição para este nutriente. Edite na Base de Fertilizantes.
          </div>
        )}

        {calc && !calc.semComposicao && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            {[
              { l: 'Total no Talhão', v: calc.qtdTotal ? `${calc.qtdTotal} kg` : '—' },
              { l: 'Sacos (50kg)', v: calc.sacos ? `${calc.sacos} sc` : '—' },
              { l: 'g/Planta', v: calc.gPe ? `${calc.gPe} g` : '—' },
              { l: 'g/Metro', v: calc.gMt ? `${calc.gMt} g` : '—' },
            ].map(x => (
              <div key={x.l} className="bg-white border border-border/60 rounded p-2 text-center">
                <p className="text-xs text-muted-foreground">{x.l}</p>
                <p className="font-semibold text-sm">{x.v}</p>
              </div>
            ))}
          </div>
        )}

        {calc && !calc.semComposicao && calc.fornecidos.length > 0 && (
          <div className="overflow-x-auto">
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
                        {isRef ? (calc.saldo >= 0 ? `+${calc.saldo}` : calc.saldo) + ' kg/ha' : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-2">
          <p className="text-xs text-muted-foreground mb-1">Observações</p>
          <Input
            value={linha.observacoes}
            onChange={e => onChange({ ...linha, observacoes: e.target.value })}
            className="h-7 text-xs"
            placeholder="Obs..."
          />
        </div>
      </td>
    </tr>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PlanoAplicacoes({ dados, talhao, onSave, saving }) {
  const [linhas, setLinhas] = useState([]);
  const [filtroApl, setFiltroApl] = useState('Todas');
  const [filtroStatus, setFiltroStatus] = useState('Todos');

  const { data: fertilizantes = [] } = useQuery({
    queryKey: ['fertilizantes'],
    queryFn: () => base44.entities.FertilizanteFormulado.list(),
  });
  const { data: fontesSimples = [] } = useQuery({
    queryKey: ['fontes_simples'],
    queryFn: () => base44.entities.FonteSimples.list(),
  });

  const todos = useMemo(() => [
    ...fertilizantes.map(f => ({ ...f, _tipo: 'formulado' })),
    ...fontesSimples.map(f => ({ ...f, _tipo: 'fonte' })),
  ], [fertilizantes, fontesSimples]);

  // ── Hidratar ao mudar talhão/plano ──────────────────────────────────────────
  const dadosId = dados?.id ?? null;
  useEffect(() => {
    const saved = dados?.plano_aplicacoes;
    if (saved && Array.isArray(saved) && saved.length > 0 && todos.length > 0) {
      setLinhas(saved.map(l => ({
        ...l,
        _id: novoId(),
        _produto: todos.find(p => p.id === l.produto_id) || null,
        _aberto: false,
      })));
    } else {
      setLinhas([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosId, todos.length]);

  // ── Persistência ────────────────────────────────────────────────────────────
  const handleSave = () => {
    const toSave = linhas.map(({ _id, _produto, _aberto, ...rest }) => ({
      ...rest,
      produto_id: rest.produto_id || null,
      produto_tipo: rest.produto_tipo || null,
    }));
    onSave({ plano_aplicacoes: toSave });
  };

  // ── Mutations de linha ───────────────────────────────────────────────────────
  const addLinha = () => setLinhas(ls => [...ls, linhaVazia()]);
  const removeLinha = id => setLinhas(ls => ls.filter(l => l._id !== id));
  const updateLinha = (id, novo) => setLinhas(ls => ls.map(l => l._id === id ? { ...novo, _id: id } : l));
  const toggleAberto = id => setLinhas(ls => ls.map(l => l._id === id ? { ...l, _aberto: !l._aberto } : l));

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const linhasFiltradas = useMemo(() => linhas.filter(l => {
    if (filtroApl !== 'Todas' && l.aplicacao !== filtroApl) return false;
    if (filtroStatus !== 'Todos' && l.status !== filtroStatus) return false;
    return true;
  }), [linhas, filtroApl, filtroStatus]);

  // ── Resumo por nutriente ─────────────────────────────────────────────────────
  const resumo = useMemo(() => {
    const r = {};
    linhas.forEach(l => {
      const calc = calcDose(l, talhao);
      if (!calc || calc.semComposicao) return;
      calc.fornecidos.forEach(f => {
        if (!r[f.label]) r[f.label] = 0;
        r[f.label] += f.kgHa;
      });
    });
    return r;
  }, [linhas, talhao]);

  const statusColor = {
    'Planejado': 'bg-amber-100 text-amber-700',
    'Comprado': 'bg-blue-100 text-blue-700',
    'Executado': 'bg-green-100 text-green-700',
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-blue-50 border-b border-border">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-700" />
          <span className="font-semibold text-sm text-blue-800">Plano de Adubação e Aplicações</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro aplicação */}
          <select
            value={filtroApl}
            onChange={e => setFiltroApl(e.target.value)}
            className="h-7 text-xs border border-input rounded px-2 bg-white"
          >
            <option value="Todas">Todas as aplicações</option>
            {APLICACOES.map(a => <option key={a} value={a}>{a} Aplicação</option>)}
          </select>
          {/* Filtro status */}
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="h-7 text-xs border border-input rounded px-2 bg-white"
          >
            <option value="Todos">Todos os status</option>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
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
              <th className="text-left py-2 pl-4 pr-2 font-medium text-muted-foreground w-8">#</th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground min-w-[180px]">Produto</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-24">Aplicação</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-28">Status</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-28">Qtd Total</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-16">Un.</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-28">Data Plan.</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-28">Data Exec.</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-20">Detalhes</th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-12"></th>
            </tr>
          </thead>
          <tbody>
            {linhasFiltradas.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-10 text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum produto adicionado.</p>
                  <p className="text-xs mt-1">Clique em "Adicionar Produto" para começar.</p>
                </td>
              </tr>
            )}

            {linhasFiltradas.map((linha, idx) => {
              const calc = calcDose(linha, talhao);
              const qtdExibida = linha.qtd_total || (calc && !calc.semComposicao && calc.qtdTotal ? String(calc.qtdTotal) : '');

              return (
                <React.Fragment key={linha._id}>
                  <tr className="border-b border-border/50 hover:bg-muted/20">
                    {/* # */}
                    <td className="py-2 pl-4 pr-2 text-muted-foreground">{idx + 1}</td>

                    {/* Produto */}
                    <td className="py-1.5 px-2">
                      <ProdutoSelector
                        value={linha.produto_id}
                        onChange={p => updateLinha(linha._id, {
                          ...linha,
                          produto_id: p.id,
                          produto_tipo: p._tipo,
                          _produto: p,
                        })}
                        todos={todos}
                      />
                    </td>

                    {/* Aplicação */}
                    <td className="py-1.5 px-2 text-center">
                      <select
                        value={linha.aplicacao}
                        onChange={e => updateLinha(linha._id, { ...linha, aplicacao: e.target.value })}
                        className="h-7 text-xs border border-input rounded px-1 bg-transparent w-full"
                      >
                        {APLICACOES.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </td>

                    {/* Status */}
                    <td className="py-1.5 px-2 text-center">
                      <select
                        value={linha.status}
                        onChange={e => updateLinha(linha._id, { ...linha, status: e.target.value })}
                        className="h-7 text-xs border border-input rounded px-1 bg-transparent w-full"
                      >
                        {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>

                    {/* Qtd Total */}
                    <td className="py-1.5 px-2">
                      <Input
                        type="number"
                        value={linha.qtd_total}
                        onChange={e => updateLinha(linha._id, { ...linha, qtd_total: e.target.value })}
                        placeholder={qtdExibida ? `≈${qtdExibida}` : '—'}
                        className="h-7 text-xs text-center"
                      />
                    </td>

                    {/* Unidade */}
                    <td className="py-1.5 px-2 text-center">
                      <select
                        value={linha.unidade}
                        onChange={e => updateLinha(linha._id, { ...linha, unidade: e.target.value })}
                        className="h-7 text-xs border border-input rounded px-1 bg-transparent w-full"
                      >
                        {['kg', 'sc', 'L', 't', 'un'].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>

                    {/* Data Planejada */}
                    <td className="py-1.5 px-2">
                      <Input
                        type="date"
                        value={linha.data_planejada}
                        onChange={e => updateLinha(linha._id, { ...linha, data_planejada: e.target.value })}
                        className="h-7 text-xs"
                      />
                    </td>

                    {/* Data Executada */}
                    <td className="py-1.5 px-2">
                      <Input
                        type="date"
                        value={linha.data_executada}
                        onChange={e => updateLinha(linha._id, { ...linha, data_executada: e.target.value })}
                        className="h-7 text-xs"
                      />
                    </td>

                    {/* Detalhes toggle */}
                    <td className="py-1.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleAberto(linha._id)}
                        className="p-1 hover:bg-muted rounded text-muted-foreground"
                      >
                        {linha._aberto
                          ? <ChevronUp className="w-4 h-4" />
                          : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>

                    {/* Excluir */}
                    <td className="py-1.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLinha(linha._id)}
                        className="p-1 hover:bg-destructive/10 rounded text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>

                  {/* Linha expandida */}
                  {linha._aberto && (
                    <LinhaDetalhe
                      linha={linha}
                      talhao={talhao}
                      calc={calc}
                      onChange={novo => updateLinha(linha._id, novo)}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Resumo de nutrientes */}
      {Object.keys(resumo).length > 0 && (
        <div className="px-5 py-3 border-t border-border bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Resumo de nutrientes fornecidos (soma de todas as linhas, kg/ha)</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(resumo).map(([nut, val]) => (
              <span key={nut} className="bg-white border border-border rounded px-2 py-1 text-xs font-medium">
                {nut}: <strong>{val.toFixed(1)} kg/ha</strong>
              </span>
            ))}
          </div>
        </div>
      )}

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