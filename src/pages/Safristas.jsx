import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';

export default function Safristas() {
  const [search, setSearch] = useState('');
  const [filterProdutor, setFilterProdutor] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ codigo_produtor: '', nome: '', status: 'ATIVO', preco_por_medida: '', observacoes: '' });
  const [editingId, setEditingId] = useState(null);
  const queryClient = useQueryClient();

  const { data: safristas = [], isLoading } = useQuery({ queryKey: ['safristas'], queryFn: () => base44.entities.Safrista.list() });
  const { data: produtores = [] } = useQuery({ queryKey: ['produtores'], queryFn: () => base44.entities.Produtor.list() });
  const { data: lancamentos = [] } = useQuery({ queryKey: ['lancamentos'], queryFn: () => base44.entities.Lancamento.list() });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Safrista.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['safristas'] }); setDialogOpen(false); }
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Safrista.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['safristas'] }); setDialogOpen(false); }
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Safrista.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['safristas'] })
  });

  const handleSave = () => {
    const data = { ...form, preco_por_medida: form.preco_por_medida ? Number(form.preco_por_medida) : undefined };
    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate(data);
  };

  const getSafristaMedidas = (nome, codProd) => {
    return lancamentos.filter(l => l.safrista === nome && l.codigo_produtor === codProd)
      .reduce((sum, l) => sum + (l.medidas_colhidas || 0), 0);
  };

  const filtered = safristas.filter(s => {
    const matchSearch = (s.nome || '').toLowerCase().includes(search.toLowerCase());
    const matchProdutor = filterProdutor === 'all' || s.codigo_produtor === filterProdutor;
    return matchSearch && matchProdutor;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Safristas</h1>
          <p className="text-muted-foreground mt-1">Gestão de trabalhadores da colheita</p>
        </div>
        <Button onClick={() => { setForm({ codigo_produtor: '', nome: '', status: 'ATIVO', preco_por_medida: '', observacoes: '' }); setEditingId(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Safrista
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar safrista..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterProdutor} onValueChange={setFilterProdutor}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar produtor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
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
                <TableHead>Safrista</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Preço/Med.</TableHead>
                <TableHead>Total Medidas</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum safrista encontrado</TableCell></TableRow>
              ) : filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs">{s.codigo_produtor}</TableCell>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  <TableCell><Badge variant={s.status === 'ATIVO' ? 'default' : 'secondary'}>{s.status}</Badge></TableCell>
                  <TableCell>{s.preco_por_medida ? `R$ ${s.preco_por_medida}` : '—'}</TableCell>
                  <TableCell className="font-medium">{getSafristaMedidas(s.nome, s.codigo_produtor).toFixed(1)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setForm({...s}); setEditingId(s.id); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Editar Safrista' : 'Novo Safrista'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Produtor</Label>
              <Select value={form.codigo_produtor} onValueChange={v => setForm({...form, codigo_produtor: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{produtores.map(p => <SelectItem key={p.id} value={p.codigo}>{p.codigo} — {p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="INATIVO">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Preço/Medida (R$)</Label><Input type="number" value={form.preco_por_medida} onChange={e => setForm({...form, preco_por_medida: e.target.value})} /></div>
            <div className="sm:col-span-2"><Label>Observações</Label><Input value={form.observacoes || ''} onChange={e => setForm({...form, observacoes: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}