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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const emptyTalhao = {
  codigo_produtor: null, nome: '', area_ha: '', num_plantas: '', cultivar: '', espacamento: '',
  metodo_colheita: 'Manual', fase_atual: 'Em produção', litros_por_pe: '', pct_colher: 1, preco_por_medida: '',
  seq_colheita: '', medidas_dia_manual: '', horas_dia_maq: '', metros_hora_maq: '', medidas_hora_maq: '',
  status: 'ativo', observacoes: ''
};

const FASE_CONFIG = {
  'Em produção':      { label: 'Em produção',      className: 'bg-green-100 text-green-800 border-green-200' },
  'Em formação':      { label: 'Em formação',       className: 'bg-blue-100 text-blue-800 border-blue-200' },
  'Safra zero':       { label: 'Safra zero',        className: 'bg-gray-100 text-gray-700 border-gray-200' },
  'Recepado/Brotando':{ label: 'Recepado/Brotando', className: 'bg-orange-100 text-orange-800 border-orange-200' },
};

export default function Talhoes() {
  const [search, setSearch] = useState('');
  const [filterProdutor, setFilterProdutor] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyTalhao);
  const [editingId, setEditingId] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: talhoes = [], isLoading } = useQuery({ queryKey: ['talhoes'], queryFn: () => base44.entities.Talhao.list() });
  const { data: produtores = [] } = useQuery({ queryKey: ['produtores'], queryFn: () => base44.entities.Produtor.list() });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Talhao.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talhoes'] });
      setDialogOpen(false);
      toast({ title: 'Talhão criado com sucesso!' });
    },
    onError: (err) => {
      console.error('Erro ao criar talhão:', err);
      toast({ title: 'Erro ao salvar', description: String(err?.message || err), variant: 'destructive' });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Talhao.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talhoes'] });
      setDialogOpen(false);
      toast({ title: 'Talhão atualizado com sucesso!' });
    },
    onError: (err) => {
      console.error('Erro ao atualizar talhão:', err);
      toast({ title: 'Erro ao salvar', description: String(err?.message || err), variant: 'destructive' });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Talhao.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['talhoes'] })
  });

  const handleSave = () => {
    if (!form.codigo_produtor || form.codigo_produtor === 'none') {
      toast({ title: 'Selecione o produtor', variant: 'destructive' });
      return;
    }
    if (!form.nome?.trim()) {
      toast({ title: 'Informe o nome do talhão', variant: 'destructive' });
      return;
    }
    const toNum = (v) => (v !== '' && v !== null && v !== undefined) ? Number(v) : undefined;
    const data = {
      ...form,
      area_ha: toNum(form.area_ha),
      num_plantas: toNum(form.num_plantas),
      litros_por_pe: toNum(form.litros_por_pe),
      pct_colher: toNum(form.pct_colher) ?? 1,
      preco_por_medida: toNum(form.preco_por_medida),
      seq_colheita: toNum(form.seq_colheita),
      medidas_dia_manual: toNum(form.medidas_dia_manual),
      horas_dia_maq: toNum(form.horas_dia_maq),
      metros_hora_maq: toNum(form.metros_hora_maq),
      medidas_hora_maq: toNum(form.medidas_hora_maq),
    };
    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate(data);
  };

  const filtered = talhoes.filter(t => {
    const matchSearch = (t.nome || '').toLowerCase().includes(search.toLowerCase());
    const matchProdutor = filterProdutor === 'all' || t.codigo_produtor === filterProdutor;
    return matchSearch && matchProdutor;
  });

  const getProdutorNome = (cod) => produtores.find(p => p.codigo === cod)?.nome?.split(' ').slice(0, 2).join(' ') || cod;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Talhões</h1>
          <p className="text-muted-foreground mt-1">Gerencie os talhões de cada produtor</p>
        </div>
        <Button onClick={() => { setForm(emptyTalhao); setEditingId(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Talhão
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar talhão..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterProdutor} onValueChange={setFilterProdutor}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar produtor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtores</SelectItem>
            {produtores.map(p => <SelectItem key={p.id} value={p.codigo}>{p.codigo} — {p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produtor</TableHead>
                <TableHead>Talhão</TableHead>
                <TableHead>Plantas</TableHead>
                <TableHead>Cultivar</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>L/Pé</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum talhão encontrado</TableCell></TableRow>
              ) : filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs">{getProdutorNome(t.codigo_produtor)}</TableCell>
                  <TableCell className="font-medium">
                   <div className="flex items-center gap-2 flex-wrap">
                     <span>{t.nome}</span>
                     {t.fase_atual && (
                       <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${FASE_CONFIG[t.fase_atual]?.className || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                         {t.fase_atual}
                       </span>
                     )}
                   </div>
                  </TableCell>
                  <TableCell>{t.num_plantas?.toLocaleString() || '—'}</TableCell>
                  <TableCell>{t.cultivar || '—'}</TableCell>
                  <TableCell><Badge variant="secondary">{t.metodo_colheita || '—'}</Badge></TableCell>
                  <TableCell>{t.litros_por_pe || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setForm({...t}); setEditingId(t.id); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Editar Talhão' : 'Novo Talhão'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Produtor</Label>
              <Select value={form.codigo_produtor || 'none'} onValueChange={v => setForm({...form, codigo_produtor: v === 'none' ? null : v})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione um produtor</SelectItem>
                  {produtores.map(p => <SelectItem key={p.id} value={p.codigo}>{p.codigo} — {p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nome do Talhão</Label><VoiceInput value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} /></div>
            <div>
              <Label>Fase atual do talhão</Label>
              <Select value={form.fase_atual || 'Em produção'} onValueChange={v => setForm({...form, fase_atual: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Em produção">Em produção — lavoura adulta em colheita normal</SelectItem>
                  <SelectItem value="Em formação">Em formação — lavoura jovem, antes da 1ª colheita</SelectItem>
                  <SelectItem value="Safra zero">Safra zero — ano de repouso bienal</SelectItem>
                  <SelectItem value="Recepado/Brotando">Recepado/Brotando — pós esqueletamento, em recuperação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nº Plantas</Label><VoiceInput type="number" value={form.num_plantas} onChange={e => setForm({...form, num_plantas: e.target.value})} /></div>
            <div><Label>Cultivar</Label><VoiceInput value={form.cultivar} onChange={e => setForm({...form, cultivar: e.target.value})} /></div>
            <div><Label>Espaçamento</Label><VoiceInput value={form.espacamento} onChange={e => setForm({...form, espacamento: e.target.value})} /></div>
            <div>
              <Label>Método Colheita</Label>
              <Select value={form.metodo_colheita} onValueChange={v => setForm({...form, metodo_colheita: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Manual', 'Derriçadeira', 'Colhedora', 'Recolhedora', 'Varrição Manual', 'Varrição Mecanizada'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Litros/Pé</Label><VoiceInput type="number" value={form.litros_por_pe} onChange={e => setForm({...form, litros_por_pe: e.target.value})} /></div>
            <div><Label>% a Colher</Label><VoiceInput type="number" step="0.1" value={form.pct_colher} onChange={e => setForm({...form, pct_colher: e.target.value})} /></div>
            <div><Label>Preço/Medida (R$)</Label><VoiceInput type="number" value={form.preco_por_medida} onChange={e => setForm({...form, preco_por_medida: e.target.value})} /></div>
            <div><Label>Área (ha)</Label><VoiceInput type="number" value={form.area_ha} onChange={e => setForm({...form, area_ha: e.target.value})} /></div>
            <div><Label>Sequência de Colheita</Label><VoiceInput type="number" min="1" value={form.seq_colheita} onChange={e => setForm({...form, seq_colheita: e.target.value})} placeholder="Ex: 1, 2, 3..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending)
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvando...</>
                : 'Salvar'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}