import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, ChevronDown, ChevronUp } from 'lucide-react';

export default function ProdutorParamsForm({ produtor, onSave, saving }) {
  const [form, setForm] = useState({});
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setForm({
      ref_medida_litros: produtor.ref_medida_litros ?? 60,
      num_safristas: produtor.num_safristas ?? 4,
      medidas_por_safrista_dia: produtor.medidas_por_safrista_dia ?? 15,
      preco_por_medida: produtor.preco_por_medida ?? 30,
      dias_por_semana: produtor.dias_por_semana ?? 6,
      mes_inicio: produtor.mes_inicio ?? 5,
      dia_inicio: produtor.dia_inicio ?? 1,
      ano_agricola: produtor.ano_agricola ?? '2025/2026',
    });
  }, [produtor.id]);

  const field = (key, label, type = 'number', extra = {}) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={form[key] ?? ''}
        onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        className="mt-1"
        {...extra}
      />
    </div>
  );

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">⚙️ Parâmetros do Produtor</span>
          <span className="text-xs text-muted-foreground">— {produtor.nome}</span>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {!collapsed && (
        <div className="px-6 pb-6 border-t border-border">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mt-4">
            {field('ref_medida_litros', 'Ref. Medida (L)', 'number')}
            {field('num_safristas', 'Nº Safristas', 'number')}
            {field('medidas_por_safrista_dia', 'Med./Safrista/Dia', 'number')}
            {field('preco_por_medida', 'Preço/Medida (R$)', 'number')}
            {field('dias_por_semana', 'Dias/Semana', 'number', { min: 1, max: 7 })}
            {field('mes_inicio', 'Mês Início', 'number', { min: 1, max: 12 })}
            {field('dia_inicio', 'Dia Início', 'number', { min: 1, max: 31 })}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => onSave(form)} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Parâmetros'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}