import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Tractor, Thermometer, Wrench } from 'lucide-react';

const emptyEquip = {
  trator_marca: '', trator_modelo: '', trator_potencia_cv: '',
  trator_consumo_sem_implemento: '', trator_consumo_rocada: '',
  trator_consumo_trincha: '', trator_consumo_carreta_pesada: '',
  secador_marca_modelo: '', secador_tipo: '', secador_capacidade_sacas: '',
  secador_potencia_kw: '', secador_kwh_saca: '',
  despolpador_marca_modelo: '', lavador_marca_modelo: '',
  preco_diesel: '', tarifa_energia_cemig: ''
};

function FieldNum({ label, value, onChange, placeholder }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" step="0.01" min="0" value={value ?? ''} onChange={onChange} placeholder={placeholder || '—'} className="h-8 text-sm" />
    </div>
  );
}

function FieldText({ label, value, onChange, placeholder }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value ?? ''} onChange={onChange} placeholder={placeholder || '—'} className="h-8 text-sm" />
    </div>
  );
}

export default function EquipamentosFazenda({ codigoProdutor }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyEquip);
  const [recordId, setRecordId] = useState(null);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['equipamentos_produtor', codigoProdutor],
    queryFn: () => base44.entities.EquipamentosProdutor.filter({ codigo_produtor: codigoProdutor }),
    enabled: !!codigoProdutor,
  });

  // Busca bases (opcionais — se não existirem, campos ficam editáveis)
  const { data: baseTratores = [] } = useQuery({
    queryKey: ['base_tratores'],
    queryFn: () => base44.entities.BaseTratores.list().catch(() => []),
  });
  const { data: baseSecadores = [] } = useQuery({
    queryKey: ['base_secadores'],
    queryFn: () => base44.entities.BaseSecadores.list().catch(() => []),
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
        secador_marca_modelo: rec.secador_marca_modelo || '',
        secador_tipo: rec.secador_tipo || '',
        secador_capacidade_sacas: rec.secador_capacidade_sacas ?? '',
        secador_potencia_kw: rec.secador_potencia_kw ?? '',
        secador_kwh_saca: rec.secador_kwh_saca ?? '',
        despolpador_marca_modelo: rec.despolpador_marca_modelo || '',
        lavador_marca_modelo: rec.lavador_marca_modelo || '',
        preco_diesel: rec.preco_diesel ?? '',
        tarifa_energia_cemig: rec.tarifa_energia_cemig ?? '',
      });
    }
  }, [data]);

  // Auto-preenche campos do trator quando modelo é selecionado da base
  const handleTratorModelo = (modelo) => {
    setForm(prev => {
      const base = baseTratores.find(t => t.modelo === modelo);
      if (base) {
        return {
          ...prev,
          trator_modelo: modelo,
          trator_marca: base.marca || prev.trator_marca,
          trator_potencia_cv: base.potencia_cv ?? prev.trator_potencia_cv,
          trator_consumo_sem_implemento: base.consumo_sem_implemento ?? prev.trator_consumo_sem_implemento,
          trator_consumo_rocada: base.consumo_rocada ?? prev.trator_consumo_rocada,
          trator_consumo_trincha: base.consumo_trincha ?? prev.trator_consumo_trincha,
          trator_consumo_carreta_pesada: base.consumo_carreta_pesada ?? prev.trator_consumo_carreta_pesada,
        };
      }
      return { ...prev, trator_modelo: modelo };
    });
  };

  // Auto-preenche campos do secador
  const handleSecador = (marcaModelo) => {
    setForm(prev => {
      const base = baseSecadores.find(s => s.marca_modelo === marcaModelo);
      if (base) {
        return {
          ...prev,
          secador_marca_modelo: marcaModelo,
          secador_tipo: base.tipo || prev.secador_tipo,
          secador_capacidade_sacas: base.capacidade_sacas ?? prev.secador_capacidade_sacas,
          secador_potencia_kw: base.potencia_kw ?? prev.secador_potencia_kw,
          secador_kwh_saca: base.kwh_saca ?? prev.secador_kwh_saca,
        };
      }
      return { ...prev, secador_marca_modelo: marcaModelo };
    });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, codigo_produtor: codigoProdutor };
      // Converte campos numéricos
      ['trator_potencia_cv','trator_consumo_sem_implemento','trator_consumo_rocada',
       'trator_consumo_trincha','trator_consumo_carreta_pesada','secador_capacidade_sacas',
       'secador_potencia_kw','secador_kwh_saca','preco_diesel','tarifa_energia_cemig'].forEach(k => {
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

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  if (!codigoProdutor) return null;
  if (isLoading) return <div className="py-4 text-xs text-muted-foreground">Carregando equipamentos...</div>;

  const marcas = [...new Set(baseTratores.map(t => t.marca).filter(Boolean))].sort();
  const modelosDaMarca = baseTratores.filter(t => t.marca === form.trator_marca).map(t => t.modelo).filter(Boolean).sort();
  const secadorOpcoes = baseSecadores.map(s => s.marca_modelo).filter(Boolean);

  const handleMarca = (marca) => {
    setForm(prev => ({ ...prev, trator_marca: marca, trator_modelo: '' }));
  };

  return (
    <div className="space-y-5 pt-1">
      {/* TRATOR */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Tractor className="w-4 h-4 text-primary" /> Trator
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Marca</Label>
            {marcas.length > 0 ? (
              <select
                value={form.trator_marca}
                onChange={e => handleMarca(e.target.value)}
                className="w-full h-8 text-sm border border-input rounded-md px-2 bg-background"
              >
                <option value="">Selecionar marca...</option>
                {marcas.map(m => <option key={m} value={m}>{m}</option>)}
                <option value="__outra__">Outra</option>
              </select>
            ) : (
              <Input value={form.trator_marca} onChange={set('trator_marca')} placeholder="Ex: John Deere" className="h-8 text-sm" />
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Modelo</Label>
            {modelosDaMarca.length > 0 ? (
              <select
                value={form.trator_modelo}
                onChange={e => handleTratorModelo(e.target.value)}
                className="w-full h-8 text-sm border border-input rounded-md px-2 bg-background"
              >
                <option value="">Selecionar modelo...</option>
                {modelosDaMarca.map(m => <option key={m} value={m}>{m}</option>)}
                <option value="__outro__">Outro (digitar)</option>
              </select>
            ) : (
              <Input value={form.trator_modelo} onChange={set('trator_modelo')} placeholder="Ex: 5075E" className="h-8 text-sm" />
            )}
          </div>
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
          <div className="sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Marca/Modelo</Label>
            {secadorOpcoes.length > 0 ? (
              <select
                value={form.secador_marca_modelo}
                onChange={e => handleSecador(e.target.value)}
                className="w-full h-8 text-sm border border-input rounded-md px-2 bg-background"
              >
                <option value="">Selecionar...</option>
                {secadorOpcoes.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="__outro__">Outro (digitar)</option>
              </select>
            ) : (
              <Input value={form.secador_marca_modelo} onChange={set('secador_marca_modelo')} placeholder="Ex: Pinhalense PL-60" className="h-8 text-sm" />
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <select
              value={form.secador_tipo}
              onChange={set('secador_tipo')}
              className="w-full h-8 text-sm border border-input rounded-md px-2 bg-background"
            >
              <option value="">—</option>
              <option value="Rotativo">Rotativo</option>
              <option value="Estático">Estático</option>
            </select>
          </div>
          <FieldNum label="Capacidade (sacas/batelada)" value={form.secador_capacidade_sacas} onChange={set('secador_capacidade_sacas')} placeholder="Ex: 200" />
          <FieldNum label="Potência total (kW)" value={form.secador_potencia_kw} onChange={set('secador_potencia_kw')} placeholder="Ex: 15" />
          <FieldNum label="kWh/saca" value={form.secador_kwh_saca} onChange={set('secador_kwh_saca')} placeholder="Ex: 0.8" />
        </div>
      </div>

      {/* OUTROS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Wrench className="w-4 h-4 text-primary" /> Outros Equipamentos e Custos
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldText label="Despolpador — Marca/Modelo" value={form.despolpador_marca_modelo} onChange={set('despolpador_marca_modelo')} placeholder="Ex: Pinhalense" />
          <FieldText label="Lavador — Marca/Modelo" value={form.lavador_marca_modelo} onChange={set('lavador_marca_modelo')} placeholder="Ex: Penagos" />
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