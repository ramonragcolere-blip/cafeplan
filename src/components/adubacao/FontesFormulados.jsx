import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2, Package, Plus, Trash2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

// Mapa: nutriente_alvo → campo % no produto
const NUTRIENTES = [
  { key: 'n_pct',    label: 'N',    display: 'N' },
  { key: 'p2o5_pct', label: 'P₂O₅', display: 'P₂O₅' },
  { key: 'k2o_pct',  label: 'K₂O',  display: 'K₂O' },
  { key: 'ca_pct',   label: 'Ca',   display: 'Ca' },
  { key: 'mg_pct',   label: 'Mg',   display: 'Mg' },
  { key: 's_pct',    label: 'S',    display: 'S' },
  { key: 'b_pct',    label: 'B',    display: 'B' },
  { key: 'zn_pct',   label: 'Zn',   display: 'Zn' },
  { key: 'cu_pct',   label: 'Cu',   display: 'Cu' },
  { key: 'mn_pct',   label: 'Mn',   display: 'Mn' },
  { key: 'fe_pct',   label: 'Fe',   display: 'Fe' },
];

function calcularLinha(linha, talhao) {
  const prod = linha._produto;
  const pctKey = linha.nutriente_ref;
  const recKgHa = parseFloat(linha.rec_kgha) || 0;
  const areaHa = talhao?.area_ha || 0;

  if (!prod || !pctKey || !recKgHa) return null;

  const pct = prod[pctKey];
  if (!pct || pct <= 0) return { semComposicao: true };

  const doseHaSugerida = recKgHa / (pct / 100);
  const doseHaFinal = parseFloat(linha.dose_ajustada_kgha) || doseHaSugerida;
  const doseTotal = areaHa > 0 ? doseHaFinal * areaHa : null;
  const doseSacos = doseTotal ? doseTotal / 50 : null;

  // g/planta e g/metro
  const numPlantas = talhao?.num_plantas || 0;
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',', '.')));
  const linhaM = partes?.[0] || 0;
  const metros = numPlantas > 0 && linhaM > 0 ? numPlantas * linhaM : 0;
  const gPe = numPlantas > 0 && doseTotal ? ((doseTotal * 1000) / numPlantas).toFixed(1) : null;
  const gMt = metros > 0 && doseTotal ? ((doseTotal * 1000) / metros).toFixed(1) : null;

  // Nutrientes fornecidos
  const fornecidos = NUTRIENTES
    .filter(n => prod[n.key] > 0)
    .map(n => ({
      label: n.display,
      pct: prod[n.key],
      kgHa: parseFloat((doseHaFinal * prod[n.key] / 100).toFixed(1)),
      kgTotal: doseTotal ? parseFloat((doseTotal * prod[n.key] / 100).toFixed(1)) : null,
    }));

  // Saldo do nutriente de referência
  const fornecidoRef = doseHaFinal * pct / 100;
  const saldo = parseFloat((fornecidoRef - recKgHa).toFixed(1));

  return {
    doseHaSugerida: Math.round(doseHaSugerida * 10) / 10,
    doseHaFinal: Math.round(doseHaFinal * 10) / 10,
    doseTotal: doseTotal ? Math.round(doseTotal) : null,
    doseSacos: doseSacos ? doseSacos.toFixed(2) : null,
    gPe, gMt, fornecidos, saldo,
  };
}

function linhaVazia(id) {
  return { _id: id, produto_id: null, produto_tipo: null, _produto: null, nutriente_ref: '', rec_kgha: '', dose_ajustada_kgha: '', aberto: false };
}

function ProdutoSelector({ value, onChange, todos }) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return todos.filter(p => (p.nome || '').toLowerCase().includes(q) || (p.fornecedor || '').toLowerCase().includes(q));
  }, [todos, busca]);

  const selecionado = todos.find(p => p.id === value);

  return (
    <div className="relative">
      <button
        type="button"
        className="w-full h-8 text-sm border border-input rounded-md px-3 text-left flex items-center justify-between bg-transparent hover:bg-muted/30 transition-colors"
        onClick={() => setAberto(a => !a)}
      >
        <span className={selecionado ? 'text-foreground' : 'text-muted-foreground'}>
          {selecionado ? selecionado.nome : 'Selecionar produto...'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {aberto && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              className="w-full h-7 text-xs border border-input rounded px-2 bg-background"
              placeholder="Buscar..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtrados.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum produto</p>}
            {filtrados.map(p => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted/60 text-sm border-b border-border/30 last:border-0"
                onClick={() => { onChange(p); setAberto(false); setBusca(''); }}
              >
                <div className="font-medium">{p.nome}</div>
                <div className="text-xs text-muted-foreground flex gap-2">
                  <span>{p._tipo === 'formulado' ? 'Formulado' : 'Fonte Simples'}</span>
                  {p.fornecedor && <span>· {p.fornecedor}</span>}
                  {p.grupo && <span>· {p.grupo}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LinhaFonte({ linha, idx, talhao, todos, onChange, onRemove }) {
  const calc = useMemo(() => calcularLinha(linha, talhao), [linha, talhao]);
  const prod = linha._produto;

  const composicaoTexto = prod ? NUTRIENTES.filter(n => prod[n.key] > 0).map(n => `${prod[n.key]}% ${n.display}`).join(' · ') : '';

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Cabeçalho da linha */}
      <div className="flex items-center gap-2 p-3 bg-muted/20">
        <span className="text-xs font-semibold text-muted-foreground w-5">{idx + 1}.</span>
        <div className="flex-1 min-w-0">
          <ProdutoSelector
            value={linha.produto_id}
            onChange={p => onChange({ ...linha, produto_id: p.id, produto_tipo: p._tipo, _produto: p })}
            todos={todos}
          />
        </div>
        <button type="button" onClick={() => onChange({ ...linha, aberto: !linha.aberto })} className="p-1 hover:bg-muted rounded text-muted-foreground">
          {linha.aberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button type="button" onClick={onRemove} className="p-1 hover:bg-destructive/10 rounded text-destructive">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Composição do produto (sempre visível se produto selecionado) */}
      {prod && (
        <div className="px-3 py-1.5 bg-blue-50/50 border-t border-border/40 text-xs text-blue-700">
          {composicaoTexto || prod.composicao_texto || <span className="text-muted-foreground">Sem composição cadastrada</span>}
          {prod.grupo && <span className="ml-2 text-muted-foreground">· {prod.grupo}</span>}
        </div>
      )}

      {/* Formulário de cálculo */}
      {linha.aberto && (
        <div className="p-3 border-t border-border/40 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Nutriente de referência */}
            <div>
              <Label className="text-xs mb-1 block">Nutriente de referência</Label>
              <Select value={linha.nutriente_ref || 'none'} onValueChange={v => onChange({ ...linha, nutriente_ref: v === 'none' ? '' : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {NUTRIENTES.map(n => (
                    <SelectItem key={n.key} value={n.key}>
                      {n.display} {prod?.[n.key] > 0 ? `(${prod[n.key]}%)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recomendação */}
            <div>
              <Label className="text-xs mb-1 block">Recomendado (kg/ha)</Label>
              <Input
                type="number"
                value={linha.rec_kgha}
                onChange={e => onChange({ ...linha, rec_kgha: e.target.value })}
                className="h-8 text-sm"
                placeholder="Ex: 200"
              />
            </div>

            {/* Dose sugerida (readonly) */}
            <div>
              <Label className="text-xs mb-1 block">Dose sugerida (kg/ha)</Label>
              <Input
                value={calc && !calc.semComposicao ? calc.doseHaSugerida : ''}
                readOnly
                className="h-8 text-sm bg-green-50 font-semibold"
                placeholder="—"
              />
            </div>

            {/* Dose ajustada */}
            <div>
              <Label className="text-xs mb-1 block">Dose ajustada (kg/ha)</Label>
              <Input
                type="number"
                value={linha.dose_ajustada_kgha}
                onChange={e => onChange({ ...linha, dose_ajustada_kgha: e.target.value })}
                className="h-8 text-sm"
                placeholder="Opcional"
              />
            </div>
          </div>

          {/* Alerta sem composição */}
          {calc?.semComposicao && (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Este produto não possui composição cadastrada para o nutriente selecionado. Edite o produto na Base de Fertilizantes.
            </div>
          )}

          {/* Resultados do cálculo */}
          {calc && !calc.semComposicao && (
            <div className="space-y-2">
              {/* Totais por talhão */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Total no Talhão', v: calc.doseTotal ? `${calc.doseTotal} kg` : '—' },
                  { label: 'Em Sacos (50kg)', v: calc.doseSacos ? `${calc.doseSacos} sc` : '—' },
                  { label: 'g / Planta', v: calc.gPe ? `${calc.gPe} g` : '—' },
                  { label: 'g / Metro', v: calc.gMt ? `${calc.gMt} g` : '—' },
                ].map(x => (
                  <div key={x.label} className="bg-muted/30 rounded-lg p-2 text-center">
                    <p className="text-xs text-muted-foreground">{x.label}</p>
                    <p className="font-semibold text-sm">{x.v}</p>
                  </div>
                ))}
              </div>

              {/* Nutrientes fornecidos */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Nutrientes fornecidos pela dose aplicada</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Nutriente</th>
                        <th className="text-center py-1.5 px-2 font-medium text-muted-foreground">% no produto</th>
                        <th className="text-center py-1.5 px-2 font-medium text-muted-foreground">Fornecido (kg/ha)</th>
                        <th className="text-center py-1.5 px-2 font-medium text-muted-foreground">Total (kg)</th>
                        {linha.nutriente_ref && <th className="text-center py-1.5 px-2 font-medium text-muted-foreground">Saldo vs Rec.</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {calc.fornecidos.map(f => {
                        const isRef = prod && NUTRIENTES.find(n => n.key === linha.nutriente_ref)?.display === f.label;
                        return (
                          <tr key={f.label} className={`border-b border-border/40 ${isRef ? 'bg-green-50' : ''}`}>
                            <td className="py-1.5 pr-3 font-medium">{f.label}</td>
                            <td className="py-1.5 px-2 text-center">{f.pct}%</td>
                            <td className="py-1.5 px-2 text-center font-semibold">{f.kgHa}</td>
                            <td className="py-1.5 px-2 text-center">{f.kgTotal ?? '—'}</td>
                            {linha.nutriente_ref && isRef && (
                              <td className={`py-1.5 px-2 text-center font-semibold ${calc.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {calc.saldo >= 0 ? `+${calc.saldo}` : calc.saldo} kg/ha
                              </td>
                            )}
                            {linha.nutriente_ref && !isRef && <td className="py-1.5 px-2" />}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

let nextId = 1;

export default function FontesFormulados({ dados, talhao, onSave, saving }) {
  const [linhas, setLinhas] = useState([]);

  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples = [] } = useQuery({ queryKey: ['fontes_simples'], queryFn: () => base44.entities.FonteSimples.list() });

  const todos = useMemo(() => [
    ...fertilizantes.map(f => ({ ...f, _tipo: 'formulado' })),
    ...fontesSimples.map(f => ({ ...f, _tipo: 'fonte' })),
  ], [fertilizantes, fontesSimples]);

  // Carrega dados salvos
  useEffect(() => {
    const saved = dados?.fontes_formulados_v2;
    if (saved && Array.isArray(saved) && saved.length > 0) {
      setLinhas(saved.map(l => {
        const prod = todos.find(p => p.id === l.produto_id) || null;
        return { ...l, _id: nextId++, _produto: prod, aberto: false };
      }));
    } else {
      setLinhas([]);
    }
  }, [dados?.id, todos.length]);

  const handleSave = () => {
    const toSave = linhas.map(({ _id, _produto, aberto, ...rest }) => rest);
    onSave({ fontes_formulados_v2: toSave });
  };

  const addLinha = () => setLinhas(ls => [...ls, linhaVazia(nextId++)]);
  const removeLinha = (id) => setLinhas(ls => ls.filter(l => l._id !== id));
  const updateLinha = (id, novo) => setLinhas(ls => ls.map(l => l._id === id ? { ...novo, _id: id } : l));

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-blue-50 border-b border-border">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-700" />
          <span className="font-semibold text-sm text-blue-800">Fontes e Formulados</span>
          <span className="text-xs text-blue-600">— seleção da Base de Fertilizantes com cálculo automático</span>
        </div>
        <Button size="sm" variant="outline" onClick={addLinha} className="h-7 gap-1 text-xs">
          <Plus className="w-3 h-3" /> Adicionar Produto
        </Button>
      </div>

      <div className="p-4 space-y-3">
        {linhas.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Nenhum produto adicionado ainda.</p>
            <p className="text-xs mt-1">Clique em "Adicionar Produto" para selecionar da Base de Fertilizantes.</p>
          </div>
        )}

        {linhas.map((linha, idx) => (
          <LinhaFonte
            key={linha._id}
            linha={linha}
            idx={idx}
            talhao={talhao}
            todos={todos}
            onChange={novo => updateLinha(linha._id, novo)}
            onRemove={() => removeLinha(linha._id)}
          />
        ))}
      </div>

      <div className="px-5 pb-4 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Fontes e Formulados
        </Button>
      </div>
    </div>
  );
}