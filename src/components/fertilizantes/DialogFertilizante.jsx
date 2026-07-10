import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { VoiceInput } from '@/components/ui/VoiceInput';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import CamposComposicao, { CAMPOS } from './CamposComposicao';

const GRUPOS = [
  'Fertilizante Solo', 'Fertilizante Solo + Nematicida Biológico', 'Fertilizante Foliar',
  'Fosfatado', 'Fonte de Nitrogênio', 'Fonte de Fósforo', 'Fonte de Potássio',
  'Fonte de Magnésio', 'Fonte de Boro', 'Fonte de Zinco', 'Fonte de Cobre',
  'Corretivo', 'Condicionador de Solo', 'Organomineral', 'Liberação Gradual',
  'Fungicida', 'Inseticida', 'Inseticida Biológico', 'Inseticida de Solo',
  'Acaricida', 'Herbicida', 'Adjuvante', 'Bioestimulante', 'Aminoácido',
  'Ácido Húmico e Fúlvico', 'Foliar — Nutrição', 'Cobre', 'Boro', 'Zinco',
  'Manganês', 'Magnésio', 'Fósforo', 'Outro',
];

const FORMULACOES = ['WG', 'SC', 'SL', 'EC', 'EW', 'PM', 'outro'];

const empty = () => ({
  nome: '', fornecedor: '', grupo: '', tipo_produto: '', tipo_formulacao: '', funcao_composicao: '', ingrediente_ativo: '',
  n_pct: '', p2o5_pct: '', k2o_pct: '', ca_pct: '', mg_pct: '', s_pct: '',
  b_pct: '', zn_pct: '', cu_pct: '', mn_pct: '', fe_pct: '',
  outros_nutrientes: '',
  dose_viveiro: '', dose_plantio: '', dose_1ano_recepa: '', dose_producao: '', dose_esqueletado: '',
  unidade_aplicacao: '', instrucoes_uso: '', composicao_texto: '', intervalo_seguranca: '', observacoes: '',
  ativo: true,
});

export default function DialogFertilizante({ open, onOpenChange, dados, onSave, saving }) {
  const [form, setForm] = useState(empty());

  useEffect(() => {
    setForm(dados ? { ...empty(), ...dados } : empty());
  }, [dados?.id, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Extrai valores numéricos do texto de composição/função
  // Suporta padrões como "19 % N", "19% K2O", "5,5% S", "0,5 % B"
  const extrairComposicaoTexto = (texto) => {
    if (!texto) return {};
    const mapa = {
      n_pct:    /(\d+[,.]?\d*)\s*%\s*N\b/i,
      p2o5_pct: /(\d+[,.]?\d*)\s*%\s*P2?O5/i,
      k2o_pct:  /(\d+[,.]?\d*)\s*%\s*K2?O/i,
      ca_pct:   /(\d+[,.]?\d*)\s*%\s*Ca\b/i,
      mg_pct:   /(\d+[,.]?\d*)\s*%\s*Mg\b/i,
      s_pct:    /(\d+[,.]?\d*)\s*%\s*S\b/i,
      b_pct:    /(\d+[,.]?\d*)\s*%\s*B\b/i,
      zn_pct:   /(\d+[,.]?\d*)\s*%\s*Zn\b/i,
      cu_pct:   /(\d+[,.]?\d*)\s*%\s*Cu\b/i,
      mn_pct:   /(\d+[,.]?\d*)\s*%\s*Mn\b/i,
      fe_pct:   /(\d+[,.]?\d*)\s*%\s*Fe\b/i,
    };
    const resultado = {};
    for (const [key, regex] of Object.entries(mapa)) {
      const match = texto.match(regex);
      if (match) resultado[key] = parseFloat(match[1].replace(',', '.'));
    }
    return resultado;
  };

  const handleSave = () => {
    const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;
    const data = { ...form };
    CAMPOS.forEach(c => { data[c.key] = toNum(form[c.key]); });

    // Tenta extrair composição do texto (funcao_composicao ou composicao_texto)
    // e preenche apenas os campos numéricos que estão vazios
    const textoFonte = (form.funcao_composicao || '') + ' ' + (form.composicao_texto || '');
    const extraidos = extrairComposicaoTexto(textoFonte);
    for (const [key, val] of Object.entries(extraidos)) {
      if (data[key] == null || data[key] === '' || data[key] === undefined || isNaN(data[key])) {
        data[key] = val;
      }
    }

    // Remove undefined to keep clean
    Object.keys(data).forEach(k => { if (data[k] === '' || data[k] === undefined) delete data[k]; });
    data.nome = form.nome; // ensure nome always present
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dados ? 'Editar Produto' : 'Novo Fertilizante / Formulado'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">Nome do Produto *</Label>
            <VoiceInput value={form.nome} onChange={e => set('nome', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Fornecedor</Label>
            <VoiceInput value={form.fornecedor} onChange={e => set('fornecedor', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Grupo</Label>
            <Select value={form.grupo || 'none'} onValueChange={v => set('grupo', v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione...</SelectItem>
                {GRUPOS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Tipo de Produto</Label>
            <VoiceInput value={form.tipo_produto} onChange={e => set('tipo_produto', e.target.value)} placeholder="Ex: Formulado NPK" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Tipo de Formulação</Label>
            <Select value={form.tipo_formulacao || 'none'} onValueChange={v => set('tipo_formulacao', v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione...</SelectItem>
                {FORMULACOES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Ingrediente Ativo</Label>
            <VoiceInput value={form.ingrediente_ativo} onChange={e => set('ingrediente_ativo', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Alvo / Função</Label>
            <VoiceInput value={form.funcao_composicao} onChange={e => set('funcao_composicao', e.target.value)} placeholder="Ex: Controle de ferrugem, Fonte de boro" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">Composição (texto original)</Label>
            <VoiceInput value={form.composicao_texto} onChange={e => set('composicao_texto', e.target.value)} placeholder="Ex: 16% N; 24% K₂O; 5,5% S" />
          </div>

          <CamposComposicao form={form} set={set} />

          <div className="col-span-2 sm:col-span-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-1">Doses por Fase do Café</p>
          </div>
          {[
            { key: 'dose_viveiro', label: 'Viveiro' },
            { key: 'dose_plantio', label: 'Plantio' },
            { key: 'dose_1ano_recepa', label: '1 ano / Recepa' },
            { key: 'dose_producao', label: 'Em Produção' },
            { key: 'dose_esqueletado', label: 'Esqueletado/Decotado' },
            { key: 'unidade_aplicacao', label: 'Unidade de Aplicação' },
          ].map(c => (
            <div key={c.key}>
              <Label className="text-xs mb-1 block">{c.label}</Label>
              <VoiceInput value={form[c.key]} onChange={e => set(c.key, e.target.value)} className="h-8 text-sm" />
            </div>
          ))}

          <div className="col-span-2">
            <Label className="text-xs mb-1 block">Instruções de Uso</Label>
            <Textarea value={form.instrucoes_uso} onChange={e => set('instrucoes_uso', e.target.value)} rows={2} className="text-sm" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Intervalo de Segurança</Label>
            <VoiceInput value={form.intervalo_seguranca} onChange={e => set('intervalo_seguranca', e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Outros Nutrientes</Label>
            <VoiceInput value={form.outros_nutrientes} onChange={e => set('outros_nutrientes', e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <Label className="text-xs mb-1 block">Observações</Label>
            <Textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} className="text-sm" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.nome} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}