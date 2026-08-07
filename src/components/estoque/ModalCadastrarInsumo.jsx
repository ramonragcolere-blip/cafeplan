import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { sugerirNomeInsumo, detectarTipoFormulacao, categoriaToGrupo } from '@/lib/estoqueInsumos';

const GRUPOS = [
  'Fungicida', 'Inseticida', 'Herbicida', 'Acaricida', 'Adjuvante', 'Corretivo',
  'Fertilizante Solo', 'Fertilizante Foliar', 'Fosfatado', 'Fonte de Nitrogênio',
  'Fonte de Fósforo', 'Fonte de Potássio', 'Fonte de Magnésio', 'Fonte de Boro',
  'Fonte de Zinco', 'Fonte de Cobre', 'Organomineral', 'Condicionador de Solo',
  'Bioestimulante', 'Aminoácido', 'Ácido Húmico e Fúlvico', 'Liberação Gradual', 'Outro',
];

const FORMULACOES = ['WG', 'SC', 'SL', 'EC', 'EW', 'PM', 'outro'];

// Cria um novo FertilizanteFormulado a partir de um produto da NF ainda não
// vinculado, e vincula os itens agrupados na linha (row.item_ids) ao novo insumo.
// Não inventa dados técnicos que não vieram da NF ou do usuário.
export default function ModalCadastrarInsumo({ row, doseInicial, unidadeInicial, open, onClose, onConcluido }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState('');
  const [grupo, setGrupo] = useState('Outro');
  const [dose, setDose] = useState('');
  const [unidade, setUnidade] = useState('L/ha');
  const [fornecedor, setFornecedor] = useState('');
  const [formulacao, setFormulacao] = useState('outro');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open && row) {
      setNome(sugerirNomeInsumo(row.produto_nome));
      setGrupo(categoriaToGrupo(row.categoria));
      setDose(doseInicial != null ? String(doseInicial) : '');
      setUnidade(unidadeInicial || 'L/ha');
      // ultimo fornecedor conhecido entre as entradas
      const ultima = [...(row.entradas || [])].reverse().find(e => e.fornecedor);
      setFornecedor(ultima?.fornecedor || '');
      setFormulacao(detectarTipoFormulacao(row.produto_nome));
      setErro('');
    }
  }, [open, row?.key]);

  if (!row) return null;

  const handleConfirmar = async () => {
    setErro('');
    const nomeLimpo = String(nome || '').trim();
    if (!nomeLimpo) { setErro('Informe o nome do produto.'); return; }
    if (!grupo) { setErro('Selecione o grupo.'); return; }
    setSalvando(true);
    try {
      const doseVal = parseFloat(String(dose).replace(',', '.'));
      const doseStr = (!isNaN(doseVal) && doseVal > 0) ? `${doseVal} ${unidade}` : '';
      const unidadeAplicacao = (!isNaN(doseVal) && doseVal > 0) ? unidade : '';
      const criado = await base44.entities.FertilizanteFormulado.create({
        nome: nomeLimpo,
        grupo,
        fornecedor: fornecedor || '',
        dose_producao: doseStr,
        unidade_aplicacao: unidadeAplicacao,
        tipo_formulacao: formulacao,
        ativo: true,
      });
      // vincula SOMENTE os itens agrupados nesta linha (compras antigas)
      const ids = Array.isArray(row.item_ids) ? row.item_ids : [];
      if (ids.length) {
        await Promise.all(ids.map(id =>
          base44.entities.BaseItensNotaFiscal.update(id, { insumo_id: criado.id, insumo_tipo: 'formulado' })
        ));
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['fertilizantes_formulados'] }),
        qc.invalidateQueries({ queryKey: ['itens_notas'] }),
      ]);
      onConcluido?.();
      onClose?.();
    } catch (e) {
      setErro('Erro ao cadastrar: ' + (e?.message || String(e)));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" /> Cadastrar na Base de Insumos
          </DialogTitle>
          <DialogDescription>
            Confira os dados antes de confirmar. O produto ficará disponível para os demais módulos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
            Produto não existe na Base de Insumos. Os campos abaixo foram preenchidos a partir da nota fiscal — revise antes de salvar.
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Nome do produto</label>
            <Input value={nome} onChange={e => setNome(e.target.value)} className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Grupo</label>
              <Select value={grupo} onValueChange={setGrupo}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRUPOS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Tipo de formulação</label>
              <Select value={formulacao} onValueChange={setFormulacao}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMULACOES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Fornecedor (se conhecido)</label>
            <Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Dose/ha padrão</label>
              <Input type="number" inputMode="decimal" step="any" min="0" value={dose}
                onChange={e => setDose(e.target.value)} className="h-9" placeholder="Ex.: 0,5" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Unidade</label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['L/ha', 'mL/ha', 'kg/ha', 'g/ha'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {erro && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />{erro}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
            <Button onClick={handleConfirmar} disabled={salvando}>
              {salvando ? <><Loader2 className="w-4 h-4 animate-spin" /> Cadastrando…</> : 'Cadastrar na Base'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}