import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2 } from 'lucide-react';
import SeletorProduto from '@/components/fertilizantes/SeletorProduto';

const CAMPOS_NUTRIENTES = [
  { key: 'nitrogenio_kg', label: 'N (kg)', nutriente_alvo: 'n_pct' },
  { key: 'fosforo_kg', label: 'P₂O₅ (kg)', nutriente_alvo: 'p2o5_pct' },
  { key: 'potassio_kg', label: 'K₂O (kg)', nutriente_alvo: 'k2o_pct' },
  { key: 'calcio_kg', label: 'Ca (kg)', nutriente_alvo: 'ca_pct' },
  { key: 'magnesio_kg', label: 'Mg (kg)', nutriente_alvo: 'mg_pct' },
  { key: 'enxofre_kg', label: 'S (kg)', nutriente_alvo: 's_pct' },
  { key: 'boro_kg', label: 'B (kg)', nutriente_alvo: 'b_pct' },
  { key: 'zinco_kg', label: 'Zn', nutriente_alvo: 'zn_pct' },
  { key: 'cobre_kg', label: 'Cu', nutriente_alvo: 'cu_pct' },
  { key: 'manganes_kg', label: 'Mn', nutriente_alvo: 'mn_pct' },
];

const empty = () => ({
  produto: '', produto_base_id: null, produto_base_tipo: null,
  data_planejada: '', data_executada: '',
  nitrogenio_kg: '', fosforo_kg: '', potassio_kg: '', calcio_kg: '',
  magnesio_kg: '', enxofre_kg: '', boro_kg: '', zinco_kg: '', cobre_kg: '', manganes_kg: '',
  dose_total_kg: '', dose_total_sacos: '',
  dose_ha_calc: '', gramas_por_pe: '', gramas_por_metro: '',
  observacoes: '',
});

function calcular(form, talhao) {
  const numPlantas = talhao?.num_plantas || 0;
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',', '.')));
  const linhaM = partes?.[0] || 0;
  const metrosLineares = numPlantas > 0 && linhaM > 0 ? numPlantas * linhaM : 0;
  const doseTotalKg = parseFloat(form.dose_total_kg) || 0;
  const gPorPe = numPlantas > 0 && doseTotalKg > 0 ? ((doseTotalKg * 1000) / numPlantas).toFixed(1) : '';
  const gPorMetro = metrosLineares > 0 && doseTotalKg > 0 ? ((doseTotalKg * 1000) / metrosLineares).toFixed(1) : '';
  const sacos = doseTotalKg > 0 ? (doseTotalKg / 50).toFixed(2) : '';
  return { gPorPe, gPorMetro, sacos, metrosLineares };
}

export default function AplicacaoBlock({ numero, tipo, dados, talhao, onSave, saving }) {
  const [form, setForm] = useState(empty());
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);

  useEffect(() => {
    const ap = dados?.aplicacoes?.find(a => a.numero === numero && a.tipo === tipo);
    setForm(ap ? { ...empty(), ...ap } : empty());
    setProdutoSelecionado(null);
  }, [dados?.id, numero, tipo]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const calc = calcular(form, talhao);

  const cor = tipo === 'planejado'
    ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-emerald-50 border-emerald-200 text-emerald-800';

  // Quando seleciona produto da base: preenche nome e dose calculada
  const handleSeletorProduto = (sel) => {
    setProdutoSelecionado(sel);
    if (!sel) return;
    const { produto, calc: c } = sel;
    setForm(f => ({
      ...f,
      produto: produto.nome,
      produto_base_id: produto.id,
      produto_base_tipo: produto._tipo,
      ...(c?.doseHa ? { dose_ha_calc: String(c.doseHa) } : {}),
      ...(c?.total ? { dose_total_kg: String(c.total) } : {}),
      ...(c?.gPe ? { gramas_por_pe: c.gPe } : {}),
      ...(c?.gMt ? { gramas_por_metro: c.gMt } : {}),
    }));
  };

  const handleSave = () => {
    const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;
    const ap = {
      numero, tipo,
      produto: form.produto,
      produto_base_id: form.produto_base_id || undefined,
      produto_base_tipo: form.produto_base_tipo || undefined,
      data_planejada: form.data_planejada || undefined,
      data_executada: form.data_executada || undefined,
      nitrogenio_kg: toNum(form.nitrogenio_kg),
      fosforo_kg: toNum(form.fosforo_kg),
      potassio_kg: toNum(form.potassio_kg),
      calcio_kg: toNum(form.calcio_kg),
      magnesio_kg: toNum(form.magnesio_kg),
      enxofre_kg: toNum(form.enxofre_kg),
      boro_kg: form.boro_kg || undefined,
      zinco_kg: form.zinco_kg || undefined,
      cobre_kg: form.cobre_kg || undefined,
      manganes_kg: form.manganes_kg || undefined,
      dose_total_kg: toNum(form.dose_total_kg),
      dose_ha_calc: toNum(form.dose_ha_calc),
      dose_total_sacos: toNum(form.dose_total_sacos) || (calc.sacos ? Number(calc.sacos) : undefined),
      gramas_por_pe: form.gramas_por_pe || calc.gPorPe || undefined,
      gramas_por_metro: form.gramas_por_metro || calc.gPorMetro || undefined,
      observacoes: form.observacoes || undefined,
    };
    onSave(ap);
  };

  // Para o seletor, pega o nutriente principal da primeira coluna não zerada ou usa n_pct por padrão
  const nutriente_alvo_principal = 'n_pct';
  const area_ha = talhao?.area_ha;
  const num_plantas = talhao?.num_plantas;

  return (
    <div className={`border rounded-xl overflow-hidden ${cor.split(' ').slice(1).join(' ')}`}>
      <div className={`flex items-center justify-between px-4 py-2 ${cor.split(' ')[0]} border-b`}>
        <span className={`font-semibold text-sm ${cor.split(' ')[2]}`}>
          {tipo === 'planejado' ? '📋 Planejado' : '✅ Executado'} — {numero}ª Aplicação
        </span>
        <Button size="sm" variant="outline" onClick={handleSave} disabled={saving} className="h-7 gap-1 text-xs">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Salvar
        </Button>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card">
        {/* Seletor da base */}
        <div className="col-span-2 sm:col-span-4">
          <Label className="text-xs mb-1 block">Produto / Fonte da Base</Label>
          <SeletorProduto
            value={produtoSelecionado}
            onSelect={handleSeletorProduto}
            nutriente_alvo={nutriente_alvo_principal}
            dose_recomendada_kgha={null}
            area_ha={area_ha}
            num_plantas={num_plantas}
            metros_lineares={calc.metrosLineares}
          />
        </div>

        <div className="col-span-2">
          <Label className="text-xs mb-1 block">Produto / Formulado</Label>
          <Input value={form.produto} onChange={e => set('produto', e.target.value)} className="h-8 text-sm" placeholder="Nome do produto..." />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Data Planejada</Label>
          <Input type="date" value={form.data_planejada} onChange={e => set('data_planejada', e.target.value)} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Data Executada</Label>
          <Input type="date" value={form.data_executada} onChange={e => set('data_executada', e.target.value)} className="h-8 text-sm" />
        </div>

        {CAMPOS_NUTRIENTES.map(c => (
          <div key={c.key}>
            <Label className="text-xs mb-1 block">{c.label}</Label>
            <Input value={form[c.key] || ''} onChange={e => set(c.key, e.target.value)} className="h-8 text-sm" placeholder="—" />
          </div>
        ))}

        <div>
          <Label className="text-xs mb-1 block">Dose Total (kg)</Label>
          <Input type="number" value={form.dose_total_kg} onChange={e => set('dose_total_kg', e.target.value)} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Total em Sacos</Label>
          <Input value={calc.sacos || form.dose_total_sacos || ''} readOnly className="h-8 text-sm bg-muted/50" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">g/Pé (calc.)</Label>
          <Input value={form.gramas_por_pe || calc.gPorPe || ''} readOnly className="h-8 text-sm bg-muted/50" />
        </div>
        <div>
          <Label className="text-xs mb-1 block">g/Metro (calc.)</Label>
          <Input value={form.gramas_por_metro || calc.gPorMetro || ''} readOnly className="h-8 text-sm bg-muted/50" />
        </div>

        <div className="col-span-2 sm:col-span-4">
          <Label className="text-xs mb-1 block">Observações</Label>
          <Textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} className="text-sm" />
        </div>
      </div>
    </div>
  );
}