import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Tractor, Thermometer, Droplets, Settings } from 'lucide-react';

const emptyForm = {
  trator_marca: '', trator_modelo: '', trator_potencia_cv: '',
  trator_consumo_sem_implemento: '', trator_consumo_rocada: '',
  trator_consumo_trincha: '', trator_consumo_carreta_pesada: '',
  secador_marca: '', secador_modelo: '', secador_tipo: '',
  secador_capacidade_sacas: '', secador_capacidade_litros: '',
  secador_potencia_kw: '', secador_kwh_saca: '',
  lavador_marca: '', lavador_modelo: '',
  lavador_capacidade_lh: '', lavador_capacidade_sc_h: '',
  lavador_potencia_kw: '', lavador_consumo_agua_mh: '',
  despolpador_marca: '', despolpador_modelo: '',
  despolpador_capacidade_lh: '', despolpador_capacidade_sc_h: '',
  despolpador_potencia_kw: '', despolpador_kwh_hora_real: '', despolpador_consumo_agua_lh: '',
  preco_diesel: '', tarifa_energia_cemig: ''
};

const numFields = [
  'trator_potencia_cv','trator_consumo_sem_implemento','trator_consumo_rocada',
  'trator_consumo_trincha','trator_consumo_carreta_pesada',
  'secador_capacidade_sacas','secador_capacidade_litros','secador_potencia_kw','secador_kwh_saca',
  'lavador_capacidade_lh','lavador_capacidade_sc_h','lavador_potencia_kw','lavador_consumo_agua_mh',
  'despolpador_capacidade_lh','despolpador_capacidade_sc_h','despolpador_potencia_kw',
  'despolpador_kwh_hora_real','despolpador_consumo_agua_lh',
  'preco_diesel','tarifa_energia_cemig'
];

function FieldNum({ label, value, onChange, placeholder }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" step="0.01" min="0" value={value ?? ''} onChange={onChange} placeholder={placeholder || '—'} className="h-8 text-sm" />
    </div>
  );
}

function MarcaModeloSelect({ label, marcas, modelosDaMarca, marca, modelo, onMarcaChange, onModeloChange }) {
  return (
    <>
      <div>
        <Label className="text-xs text-muted-foreground">Marca — {label}</Label>
        {marcas.length > 0 ? (
          <select value={marca} onChange={e => onMarcaChange(e.target.value)}
            className="w-full h-8 text-sm border border-input rounded-md px-2 bg-background">
            <option value="">Selecionar marca...</option>
            {marcas.map(m => <option key={m} value={m}>{m}</option>)}
            <option value="__outra__">Outra</option>
          </select>
        ) : (
          <Input value={marca} onChange={e => onMarcaChange(e.target.value)} placeholder="Marca" className="h-8 text-sm" />
        )}
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Modelo — {label}</Label>
        {modelosDaMarca.length > 0 ? (
          <select value={modelo} onChange={e => onModeloChange(e.target.value)}
            className="w-full h-8 text-sm border border-input rounded-md px-2 bg-background">
            <option value="">Selecionar modelo...</option>
            {modelosDaMarca.map(m => <option key={m} value={m}>{m}</option>)}
            <option value="__outro__">Outro</option>
          </select>
        ) : (
          <Input value={modelo} onChange={e => onModeloChange(e.target.value)} placeholder="Modelo" className="h-8 text-sm" />
        )}
      </div>
    </>
  );
}

export default function EquipamentosFazenda({ codigoProdutor }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [recordId, setRecordId] = useState(null);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['equipamentos_produtor', codigoProdutor],
    queryFn: () => base44.entities.EquipamentosProdutor.filter({ codigo_produtor: codigoProdutor }),
    enabled: !!codigoProdutor,
  });

  const { data: baseTratores = [] } = useQuery({
    queryKey: ['base_tratores'],
    queryFn: () => base44.entities.BaseTratores.list().catch(() => []),
  });
  const { data: baseSecadoresDB = [] } = useQuery({
    queryKey: ['base_secadores_db'],
    queryFn: () => base44.entities.BaseSecadores.list().catch(() => []),
  });
  const { data: baseLavadoresDB = [] } = useQuery({
    queryKey: ['base_lavadores_db'],
    queryFn: () => base44.entities.BaseLavadores.list().catch(() => []),
  });
  const { data: baseDespolpadoresDB = [] } = useQuery({
    queryKey: ['base_despolpadores_db'],
    queryFn: () => base44.entities.BaseDespolpadores.list().catch(() => []),
  });

  useEffect(() => {
    if (data && data.length > 0) {
      const rec = data[0];
      setRecordId(rec.id);
      setForm({
        trator_marca: rec.trator_marca || '',
        trator_modelo: rec.trator_modelo || '',
        trator_potencia_cv: rec.trator_potencia_cv ?? '',
        trator_consumo_sem_implemento: rec.trator_consumo_sem_implemento ?? '',
        trator_consumo_rocada: rec.trator_consumo_rocada ?? '',
        trator_consumo_trincha: rec.trator_consumo_trincha ?? '',
        trator_consumo_carreta_pesada: rec.trator_consumo_carreta_pesada ?? '',
        secador_marca: rec.secador_marca || '',
        secador_modelo: rec.secador_modelo || '',
        secador_tipo: rec.secador_tipo || '',
        secador_capacidade_sacas: rec.secador_capacidade_sacas ?? '',
        secador_capacidade_litros: rec.secador_capacidade_litros ?? '',
        secador_potencia_kw: rec.secador_potencia_kw ?? '',
        secador_kwh_saca: rec.secador_kwh_saca ?? '',
        lavador_marca: rec.lavador_marca || '',
        lavador_modelo: rec.lavador_modelo || '',
        lavador_capacidade_lh: rec.lavador_capacidade_lh ?? '',
        lavador_capacidade_sc_h: rec.lavador_capacidade_sc_h ?? '',
        lavador_potencia_kw: rec.lavador_potencia_kw ?? '',
        lavador_consumo_agua_mh: rec.lavador_consumo_agua_mh ?? '',
        despolpador_marca: rec.despolpador_marca || '',
        despolpador_modelo: rec.despolpador_modelo || '',
        despolpador_capacidade_lh: rec.despolpador_capacidade_lh ?? '',
        despolpador_capacidade_sc_h: rec.despolpador_capacidade_sc_h ?? '',
        despolpador_potencia_kw: rec.despolpador_potencia_kw ?? '',
        despolpador_kwh_hora_real: rec.despolpador_kwh_hora_real ?? '',
        despolpador_consumo_agua_lh: rec.despolpador_consumo_agua_lh ?? '',
        preco_diesel: rec.preco_diesel ?? '',
        tarifa_energia_cemig: rec.tarifa_energia_cemig ?? '',
      });
    }
  }, [data]);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  // Trator
  const tratorMarcas = [...new Set(baseTratores.map(t => t.marca).filter(Boolean))].sort();
  const tratorModelosDaMarca = baseTratores.filter(t => t.marca === form.trator_marca).map(t => t.modelo).sort();
  const handleTratorMarca = (marca) => setForm(prev => ({ ...prev, trator_marca: marca, trator_modelo: '' }));
  const handleTratorModelo = (modelo) => {
    const base = baseTratores.find(t => t.modelo === modelo);
    if (base) {
      setForm(prev => ({
        ...prev, trator_modelo: modelo,
        trator_marca: base.marca || prev.trator_marca,
        trator_potencia_cv: base.cv ?? prev.trator_potencia_cv,
        trator_consumo_sem_implemento: base.consumo_sem_implemento ?? prev.trator_consumo_sem_implemento,
        trator_consumo_rocada: base.consumo_rocada ?? prev.trator_consumo_rocada,
        trator_consumo_trincha: base.consumo_trincha ?? prev.trator_consumo_trincha,
        trator_consumo_carreta_pesada: base.consumo_carreta_pesada ?? prev.trator_consumo_carreta_pesada,
      }));
    } else {
      setForm(prev => ({ ...prev, trator_modelo: modelo }));
    }
  };

  // Secador
  const secadorMarcas = [...new Set(baseSecadoresDB.map(s => s.marca).filter(Boolean))].sort();
  const secadorModelosDaMarca = baseSecadoresDB.filter(s => s.marca === form.secador_marca).map(s => s.modelo).sort();
  const handleSecadorMarca = (marca) => setForm(prev => ({ ...prev, secador_marca: marca, secador_modelo: '' }));
  const handleSecadorModelo = (modelo) => {
    const base = baseSecadoresDB.find(s => s.modelo === modelo);
    if (base) {
      setForm(prev => ({
        ...prev, secador_modelo: modelo,
        secador_marca: base.marca || prev.secador_marca,
        secador_tipo: base.tipo || prev.secador_tipo,
        secador_capacidade_sacas: base.capacidade_sacas ?? prev.secador_capacidade_sacas,
        secador_capacidade_litros: base.capacidade_litros ?? prev.secador_capacidade_litros,
        secador_potencia_kw: base.potencia_total_kw ?? prev.secador_potencia_kw,
        secador_kwh_saca: base.kwh_saca ?? prev.secador_kwh_saca,
      }));
    } else {
      setForm(prev => ({ ...prev, secador_modelo: modelo }));
    }
  };

  // Lavador
  const lavadorMarcas = [...new Set(baseLavadoresDB.map(l => l.marca).filter(Boolean))].sort();
  const lavadorModelosDaMarca = baseLavadoresDB.filter(l => l.marca === form.lavador_marca).map(l => l.modelo).sort();
  const handleLavadorMarca = (marca) => setForm(prev => ({ ...prev, lavador_marca: marca, lavador_modelo: '' }));
  const handleLavadorModelo = (modelo) => {
    const base = baseLavadoresDB.find(l => l.modelo === modelo);
    if (base) {
      setForm(prev => ({
        ...prev, lavador_modelo: modelo,
        lavador_marca: base.marca || prev.lavador_marca,
        lavador_capacidade_lh: base.capacidade_lh ?? prev.lavador_capacidade_lh,
        lavador_capacidade_sc_h: base.capacidade_sc_h ?? prev.lavador_capacidade_sc_h,
        lavador_potencia_kw: base.potencia_total_kw ?? prev.lavador_potencia_kw,
        lavador_consumo_agua_mh: base.consumo_agua_mh ?? prev.lavador_consumo_agua_mh,
      }));
    } else {
      setForm(prev => ({ ...prev, lavador_modelo: modelo }));
    }
  };

  // Despolpador
  const despolpadorMarcas = [...new Set(baseDespolpadoresDB.map(d => d.marca).filter(Boolean))].sort();
  const despolpadorModelosDaMarca = baseDespolpadoresDB.filter(d => d.marca === form.despolpador_marca).map(d => d.modelo).sort();
  const handleDespolpadorMarca = (marca) => setForm(prev => ({ ...prev, despolpador_marca: marca, despolpador_modelo: '' }));
  const handleDespolpadorModelo = (modelo) => {
    const base = baseDespolpadoresDB.find(d => d.modelo === modelo);
    if (base) {
      setForm(prev => ({
        ...prev, despolpador_modelo: modelo,
        despolpador_marca: base.marca || prev.despolpador_marca,
        despolpador_capacidade_lh: base.capacidade_lh ?? prev.despolpador_capacidade_lh,
        despolpador_capacidade_sc_h: base.capacidade_sc_h ?? prev.despolpador_capacidade_sc_h,
        despolpador_potencia_kw: base.potencia_total_kw ?? prev.despolpador_potencia_kw,
        despolpador_kwh_hora_real: base.kwh_hora_real ?? prev.despolpador_kwh_hora_real,
        despolpador_consumo_agua_lh: base.consumo_agua_lh ?? prev.despolpador_consumo_agua_lh,
      }));
    } else {
      setForm(prev => ({ ...prev, despolpador_modelo: modelo }));
    }
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, codigo_produtor: codigoProdutor };
      numFields.forEach(k => {
        if (payload[k] !== '' && payload[k] != null) payload[k] = Number(payload[k]);
        else delete payload[k];
      });
      if (recordId) return base44.entities.EquipamentosProdutor.update(recordId, payload);
      return base44.entities.EquipamentosProdutor.create(payload);
    },
    onSuccess: (res) => {
      if (!recordId && res?.id) setRecordId(res.id);
      queryClient.invalidateQueries({ queryKey: ['equipamentos_produtor', codigoProdutor] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  });

  if (!codigoProdutor) return null;
  if (isLoading) return <div className="py-4 text-xs text-muted-foreground">Carregando equipamentos...</div>;

  return (
    <div className="space-y-5 pt-1">

      {/* TRATOR */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Tractor className="w-4 h-4 text-primary" /> Trator
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MarcaModeloSelect label="Trator"
            marcas={tratorMarcas} modelosDaMarca={tratorModelosDaMarca}
            marca={form.trator_marca} modelo={form.trator_modelo}
            onMarcaChange={handleTratorMarca} onModeloChange={handleTratorModelo} />
          <FieldNum label="Potência (cv)" value={form.trator_potencia_cv} onChange={set('trator_potencia_cv')} placeholder="Ex: 75" />
          <FieldNum label="Consumo sem implemento (L/h)" value={form.trator_consumo_sem_implemento} onChange={set('trator_consumo_sem_implemento')} placeholder="Ex: 4.5" />
          <FieldNum label="Consumo roçada (L/h)" value={form.trator_consumo_rocada} onChange={set('trator_consumo_rocada')} placeholder="Ex: 7.0" />
          <FieldNum label="Consumo trincha (L/h)" value={form.trator_consumo_trincha} onChange={set('trator_consumo_trincha')} placeholder="Ex: 6.0" />
          <FieldNum label="Consumo carreta pesada (L/h)" value={form.trator_consumo_carreta_pesada} onChange={set('trator_consumo_carreta_pesada')} placeholder="Ex: 8.0" />
        </div>
      </div>

      {/* SECADOR */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Thermometer className="w-4 h-4 text-primary" /> Secador
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MarcaModeloSelect label="Secador"
            marcas={secadorMarcas} modelosDaMarca={secadorModelosDaMarca}
            marca={form.secador_marca} modelo={form.secador_modelo}
            onMarcaChange={handleSecadorMarca} onModeloChange={handleSecadorModelo} />
          <div>
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <select value={form.secador_tipo} onChange={set('secador_tipo')}
              className="w-full h-8 text-sm border border-input rounded-md px-2 bg-background">
              <option value="">—</option>
              <option value="Rotativo">Rotativo</option>
              <option value="Estatico">Estático</option>
            </select>
          </div>
          <FieldNum label="Capacidade (sacas)" value={form.secador_capacidade_sacas} onChange={set('secador_capacidade_sacas')} placeholder="Ex: 30" />
          <FieldNum label="Capacidade (litros)" value={form.secador_capacidade_litros} onChange={set('secador_capacidade_litros')} placeholder="Ex: 7500" />
          <FieldNum label="Potência total (kW)" value={form.secador_potencia_kw} onChange={set('secador_potencia_kw')} placeholder="Ex: 15" />
          <FieldNum label="kWh/saca" value={form.secador_kwh_saca} onChange={set('secador_kwh_saca')} placeholder="Ex: 0.8" />
        </div>
      </div>

      {/* LAVADOR */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Droplets className="w-4 h-4 text-primary" /> Lavador
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MarcaModeloSelect label="Lavador"
            marcas={lavadorMarcas} modelosDaMarca={lavadorModelosDaMarca}
            marca={form.lavador_marca} modelo={form.lavador_modelo}
            onMarcaChange={handleLavadorMarca} onModeloChange={handleLavadorModelo} />
          <FieldNum label="Capacidade (L/h)" value={form.lavador_capacidade_lh} onChange={set('lavador_capacidade_lh')} placeholder="Ex: 10000" />
          <FieldNum label="Capacidade (sc/h)" value={form.lavador_capacidade_sc_h} onChange={set('lavador_capacidade_sc_h')} placeholder="Ex: 66.7" />
          <FieldNum label="Potência total (kW)" value={form.lavador_potencia_kw} onChange={set('lavador_potencia_kw')} placeholder="Ex: 3.9" />
          <FieldNum label="Consumo de água (m³/h)" value={form.lavador_consumo_agua_mh} onChange={set('lavador_consumo_agua_mh')} placeholder="Ex: 0.5" />
        </div>
      </div>

      {/* DESPOLPADOR */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Settings className="w-4 h-4 text-primary" /> Despolpador
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MarcaModeloSelect label="Despolpador"
            marcas={despolpadorMarcas} modelosDaMarca={despolpadorModelosDaMarca}
            marca={form.despolpador_marca} modelo={form.despolpador_modelo}
            onMarcaChange={handleDespolpadorMarca} onModeloChange={handleDespolpadorModelo} />
          <FieldNum label="Capacidade (L/h)" value={form.despolpador_capacidade_lh} onChange={set('despolpador_capacidade_lh')} placeholder="Ex: 6000" />
          <FieldNum label="Capacidade (sc/h)" value={form.despolpador_capacidade_sc_h} onChange={set('despolpador_capacidade_sc_h')} placeholder="Ex: 40" />
          <FieldNum label="Potência total (kW)" value={form.despolpador_potencia_kw} onChange={set('despolpador_potencia_kw')} placeholder="Ex: 12.9" />
          <FieldNum label="kWh/hora real" value={form.despolpador_kwh_hora_real} onChange={set('despolpador_kwh_hora_real')} placeholder="Ex: 11.7" />
          <FieldNum label="Consumo de água (L/h)" value={form.despolpador_consumo_agua_lh} onChange={set('despolpador_consumo_agua_lh')} placeholder="Ex: 800" />
        </div>
      </div>

      {/* CUSTOS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          Custos Operacionais
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldNum label="Preço do diesel (R$/L)" value={form.preco_diesel} onChange={set('preco_diesel')} placeholder="Ex: 6.50" />
          <FieldNum label="Tarifa energia CEMIG (R$/kWh)" value={form.tarifa_energia_cemig} onChange={set('tarifa_energia_cemig')} placeholder="Ex: 0.85" />
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button size="sm" className="gap-1.5" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="w-3.5 h-3.5" />
          {saveMutation.isPending ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Equipamentos'}
        </Button>
      </div>
    </div>
  );
}