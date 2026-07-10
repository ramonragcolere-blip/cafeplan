import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VoiceInput } from '@/components/ui/VoiceInput';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EquipamentosFazenda from '@/components/produtores/EquipamentosFazenda';
import { useToast } from '@/components/ui/use-toast';
import { proximoCodigoProdutor } from '@/lib/integracaoPlanejamentos';

const emptyProdutor = {
  codigo: '', nome: '', cpf_cnpj: '', fazenda: '', municipio: '', uf: 'MG',
  area_ha: '', ano_agricola: '2025/2026', eng_responsavel: '', contato: '', email: '',
  ref_medida_litros: 60, pct_colher: 1, num_safristas: 4, medidas_por_safrista_dia: 15,
  preco_por_medida: 30, dias_por_semana: 6, mes_inicio: 5, dia_inicio: 27, status: 'ativo'
};

export default function Produtores() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyProdutor);
  const [editingId, setEditingId] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: produtores = [], isLoading } = useQuery({ queryKey: ['produtores', 'completo'], queryFn: () => base44.entities.Produtor.list(undefined, 5000) });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Produtor.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['produtores'] }); setDialogOpen(false); toast({ title: 'Produtor criado com sucesso!' }); },
    onError: err => toast({ title: 'Erro ao criar produtor', description: String(err?.message || err), variant: 'destructive' })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Produtor.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['produtores'] }); setDialogOpen(false); toast({ title: 'Produtor atualizado com sucesso!' }); },
    onError: err => toast({ title: 'Erro ao atualizar produtor', description: String(err?.message || err), variant: 'destructive' })
  });

  const deleteMutation = useMutation({
    mutationFn: async (produtor) => {
      const codigo = produtor.codigo;
      const dependencias = await Promise.all([
        base44.entities.Talhao.filter({ codigo_produtor: codigo }),
        base44.entities.Safrista.filter({ codigo_produtor: codigo }),
        base44.entities.Lancamento.filter({ codigo_produtor: codigo }),
        base44.entities.EquipamentosProdutor.filter({ codigo_produtor: codigo }),
        base44.entities.BasePlanejamentoAdubacao.filter({ codigo_produtor: codigo }),
        base44.entities.PlanejamentoAdubacao2.filter({ codigo_produtor: codigo }),
        base44.entities.AplicacaoFoliar.filter({ codigo_produtor: codigo }),
        base44.entities.CronogramaFoliar.filter({ codigo_produtor: codigo }),
        base44.entities.PlanejamentoOperacoes.filter({ codigo_produtor: codigo }),
        base44.entities.PlanejamentoPosColheita.filter({ codigo_produtor: codigo }),
      ]);
      const totalVinculos = dependencias.reduce((total, itens) => total + (itens?.length || 0), 0);
      if (totalVinculos > 0) {
        throw new Error(`Este produtor possui ${totalVinculos} registro(s) vinculado(s). Inative-o em vez de excluir.`);
      }
      return base44.entities.Produtor.delete(produtor.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtores'] });
      toast({ title: 'Produtor excluído!' });
    },
    onError: err => toast({ title: 'Exclusão bloqueada', description: String(err?.message || err), variant: 'destructive' }),
  });

  const handleSave = () => {
    const codigo = String(form.codigo || '').trim().toUpperCase();
    const nome = String(form.nome || '').trim();
    const fazenda = String(form.fazenda || '').trim();
    if (!codigo || !nome || !fazenda) {
      toast({ title: 'Preencha código, nome e fazenda', variant: 'destructive' });
      return;
    }
    const codigoDuplicado = produtores.some(p => p.id !== editingId && String(p.codigo || '').trim().toUpperCase() === codigo);
    if (codigoDuplicado) {
      toast({ title: 'Código de produtor já cadastrado', description: `O código ${codigo} já está em uso.`, variant: 'destructive' });
      return;
    }
    const { id, created_date, updated_date, created_by, ...campos } = form;
    void id; void created_date; void updated_date; void created_by;
    const data = {
      ...campos,
      codigo,
      nome,
      fazenda,
      area_ha: form.area_ha !== '' && form.area_ha != null ? Number(form.area_ha) : undefined,
    };
    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate(data);
  };

  const openEdit = (p) => {
    setForm({ ...p });
    setEditingId(p.id);
    setDialogOpen(true);
  };

  const openNew = () => {
    const nextCode = proximoCodigoProdutor(produtores);
    setForm({ ...emptyProdutor, codigo: nextCode });
    setEditingId(null);
    setDialogOpen(true);
  };

  const filtered = produtores.filter(p =>
    (p.nome || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.fazenda || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.codigo || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtores</h1>
          <p className="text-muted-foreground mt-1">Cadastro de produtores e fazendas</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Produtor
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar produtor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cód.</TableHead>
                <TableHead>Produtor</TableHead>
                <TableHead>Fazenda</TableHead>
                <TableHead>Município/UF</TableHead>
                <TableHead>Área (ha)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum produtor encontrado</TableCell></TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>{p.fazenda}</TableCell>
                  <TableCell>{p.municipio}{p.uf ? ` / ${p.uf}` : ''}</TableCell>
                  <TableCell>{p.area_ha || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'ativo' ? 'default' : 'secondary'}>
                      {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`Excluir o produtor ${p.nome}?`)) deleteMutation.mutate(p); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Produtor' : 'Novo Produtor'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Código</Label><VoiceInput value={form.codigo} disabled={!!editingId} onChange={e => setForm({...form, codigo: e.target.value})} /><p className="text-xs text-muted-foreground mt-1">O código não pode ser alterado depois do cadastro.</p></div>
            <div><Label>Nome</Label><VoiceInput value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} /></div>
            <div><Label>CPF/CNPJ</Label><VoiceInput value={form.cpf_cnpj} onChange={e => setForm({...form, cpf_cnpj: e.target.value})} /></div>
            <div><Label>Fazenda</Label><VoiceInput value={form.fazenda} onChange={e => setForm({...form, fazenda: e.target.value})} /></div>
            <div><Label>Município</Label><VoiceInput value={form.municipio} onChange={e => setForm({...form, municipio: e.target.value})} /></div>
            <div><Label>UF</Label><VoiceInput value={form.uf} onChange={e => setForm({...form, uf: e.target.value})} /></div>
            <div><Label>Área (ha)</Label><VoiceInput type="number" value={form.area_ha} onChange={e => setForm({...form, area_ha: e.target.value})} /></div>
            <div><Label>Ano Agrícola</Label><VoiceInput value={form.ano_agricola} onChange={e => setForm({...form, ano_agricola: e.target.value})} /></div>
            <div><Label>Eng. Responsável</Label><VoiceInput value={form.eng_responsavel} onChange={e => setForm({...form, eng_responsavel: e.target.value})} /></div>
            <div><Label>Contato</Label><VoiceInput value={form.contato} onChange={e => setForm({...form, contato: e.target.value})} /></div>
            <div className="sm:col-span-2"><Label>E-mail</Label><VoiceInput value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            
            <div className="sm:col-span-2 border-t pt-4"><p className="font-semibold text-sm text-muted-foreground">Parâmetros de Colheita</p></div>
            <div><Label>Ref. Medida (L)</Label><VoiceInput type="number" value={form.ref_medida_litros} onChange={e => setForm({...form, ref_medida_litros: Number(e.target.value)})} /></div>
            <div><Label>% a Colher</Label><VoiceInput type="number" step="0.1" value={form.pct_colher} onChange={e => setForm({...form, pct_colher: Number(e.target.value)})} /></div>
            <div><Label>Nº Safristas</Label><VoiceInput type="number" value={form.num_safristas} onChange={e => setForm({...form, num_safristas: Number(e.target.value)})} /></div>
            <div><Label>Med./Safrista/Dia</Label><VoiceInput type="number" value={form.medidas_por_safrista_dia} onChange={e => setForm({...form, medidas_por_safrista_dia: Number(e.target.value)})} /></div>
            <div><Label>Preço/Medida (R$)</Label><VoiceInput type="number" value={form.preco_por_medida} onChange={e => setForm({...form, preco_por_medida: Number(e.target.value)})} /></div>
            <div><Label>Dias/Semana</Label><VoiceInput type="number" value={form.dias_por_semana} onChange={e => setForm({...form, dias_por_semana: Number(e.target.value)})} /></div>
            <div><Label>Mês Início</Label><VoiceInput type="number" min="1" max="12" value={form.mes_inicio} onChange={e => setForm({...form, mes_inicio: Number(e.target.value)})} /></div>
            <div><Label>Dia Início</Label><VoiceInput type="number" min="1" max="31" value={form.dia_inicio} onChange={e => setForm({...form, dia_inicio: Number(e.target.value)})} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* SEÇÃO EQUIPAMENTOS — só exibe ao editar (produtor já tem código) */}
          {editingId && form.codigo && (
            <div className="border-t pt-4 space-y-1">
              <p className="font-semibold text-sm text-muted-foreground mb-3">🚜 Equipamentos da Fazenda</p>
              <EquipamentosFazenda codigoProdutor={form.codigo} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}