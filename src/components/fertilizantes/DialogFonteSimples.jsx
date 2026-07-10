import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { VoiceInput } from '@/components/ui/VoiceInput';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import CamposComposicao, { CAMPOS } from './CamposComposicao';

const NUTRIENTES = ['N', 'P', 'K', 'Ca', 'Mg', 'S', 'B', 'Zn', 'Cu', 'Mn', 'Fe'];

const empty = () => ({
  nome: '', nutriente_principal: '', nutrientes_secundarios: '',
  n_pct: '', p2o5_pct: '', k2o_pct: '', ca_pct: '', mg_pct: '', s_pct: '',
  b_pct: '', zn_pct: '', cu_pct: '', mn_pct: '', fe_pct: '',
  unidade_padrao: 'kg', observacoes: '', ativo: true,
});

export default function DialogFonteSimples({ open, onOpenChange, dados, onSave, saving }) {
  const [form, setForm] = useState(empty());

  useEffect(() => {
    setForm(dados ? { ...empty(), ...dados } : empty());
  }, [dados?.id, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;
    const data = { ...form };
    CAMPOS.forEach(c => { data[c.key] = toNum(form[c.key]); });
    Object.keys(data).forEach(k => { if (data[k] === '' || data[k] === undefined) delete data[k]; });
    data.nome = form.nome;
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dados ? 'Editar Fonte' : 'Nova Fonte Simples'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">Nome da Fonte *</Label>
            <VoiceInput value={form.nome} onChange={e => set('nome', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Nutriente Principal</Label>
            <Select value={form.nutriente_principal || 'none'} onValueChange={v => set('nutriente_principal', v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione...</SelectItem>
                {NUTRIENTES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Unidade Padrão</Label>
            <VoiceInput value={form.unidade_padrao} onChange={e => set('unidade_padrao', e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">Nutrientes Secundários</Label>
            <VoiceInput value={form.nutrientes_secundarios} onChange={e => set('nutrientes_secundarios', e.target.value)} placeholder="Ex: S, Ca" />
          </div>

          <CamposComposicao form={form} set={set} />

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