import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import LancamentoEmLote from '@/components/lancamentos/LancamentoEmLote';

export default function Lancamentos() {
  const [search, setSearch] = useState('');
  const [verTodos, setVerTodos] = useState(false);
  const [produtorSelecionado, setProdutorSelecionado] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    codigo_produtor: '', data: '', safrista: '', talhao: '', tipo_colheita: 'Manual',
    medidas_colhidas: '', valor_medida: '', valor_total: '', observacoes: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [savingLote, setSavingLote] = useState(false);
  const queryClient = useQueryClient();

  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ['lancamentos'],
    queryFn: () => base44.entities.Lancamento.list('-data', 500),
  });
  const { data: produtores = [] } = useQuery({ queryKey: ['produtores'], queryFn: () => base44.entities.Produtor.list() });
  const { data: safristas = [] } = useQuery({ queryKey: ['safristas'], queryFn: () => base44.entities.Safrista.list() });
  const { data: talhoes = [] } = useQuery({ queryKey: ['talhoes'], queryFn: () => base44.entities.Talhao.list() });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lancamento.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lancamentos'] }); setDialogOpen(false); }
  });
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Lancamento.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lancamentos'] }); setDialogOpen(false); }
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lancamento.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lancamentos'] })
  });

  const handleSaveIndividual = () => {
    const med = Number(form.medidas_colhidas) || 0;
    const val = Number(form.valor_medida) || 0;
    const data = { ...form, medidas_colhidas: med, valor_medida: val, valor_total: med * val };
    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate(data);
  };

  const handleSalvarLote = async (registros, onReset) => {
    if (!registros.length) return;
    setSavingLote(true);
    try {
      for (const r of registros) {
        await base44.entities.Lancamento.create({ ...r, codigo_produtor: produtorSelecionado });
      }
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      onReset?.();
    } finally {
      setSavingLote(false);
    }
  };

  const filteredForm = {
    safristas: safristas.filter(s => !form.codigo_produtor || s.codigo_produtor === form.codigo_produtor),
    talhoes: talhoes.filter(t => !form.codigo_produtor || t.codigo_produtor === form.codigo_produtor),
  };

  const filtered = lancamentos.filter(l => {
    const matchSearch = (l.safrista || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.talhao || '').toLowerCase().includes(search.toLowerCase());
    const matchProdutor = verTodos || !produtorSelecionado || l.codigo_produtor === produtorSelecionado;
    return matchSearch && matchProdutor;
  });

  const formatDate = (d) => {
    if (!d) return '—';
    try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return d; }
  };

  const totalMedidas = filtered.reduce((s, l) => s + (l.medidas_colhidas || 0), 0);
  const totalValor = filtered.reduce((s, l) => s + (l.valor_total || 0), 0);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lançamentos</h1>
          <p className="text-muted-foreground mt-1">Registro diário de colheita</p>
        </div>
        <Button onClick={() => {
          setForm({
            codigo_produtor: produtorSelecionado, data: format(new Date(), 'yyyy-MM-dd'),
            safrista: '', talhao: '', tipo_colheita: 'Manual',
            medidas_colhidas: '', valor_medida: '', valor_total: '', observacoes: ''
          });
          setEditingId(null);
          setDialogOpen(true);
        }} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Lançamento
        </Button>
      </div>

      {/* Seletor de produtor — dropdown */}
      <div className="max-w-sm">
        <Label className="text-xs mb-1 block font-medium">Produtor</Label>
        <Select value={produtorSelecionado} onValueChange={setProdutorSelecionado}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o produtor..." />
          </SelectTrigger>
          <SelectContent>
            {produtores.map(p => (
              <SelectItem key={p.id} value={p.codigo}>{p.codigo} — {p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="lote">
        <TabsList>
          <TabsTrigger value="lote">Lançamento em Lote</TabsTrigger>
          <TabsTrigger value="lista">Listagem</TabsTrigger>
        </TabsList>

        {/* Aba lançamento em lote */}
        <TabsContent value="lote" className="mt-4">
          {!produtorSelecionado ? (
            <p className="text-center text-muted-foreground py-10">Selecione um produtor acima para registrar lançamentos.</p>
          ) : (
            <LancamentoEmLote
              produtorCodigo={produtorSelecionado}
              talhoes={talhoes}
              safristas={safristas}
              onSalvarRegistros={handleSalvarLote}
              saving={savingLote}
            />
          )}
        </TabsContent>

        {/* Aba listagem */}
        <TabsContent value="lista" className="mt-4 space-y-4">
          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Registros</p>
              <p className="text-xl font-bold">{filtered.length}</p>
            </div>
            <div className="bg-card rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Medidas Colhidas</p>
              <p className="text-xl font-bold">{totalMedidas.toFixed(1)}</p>
            </div>
            <div className="bg-card rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-xl font-bold">R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar safrista ou talhão..." value={search}
                onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Button variant={verTodos ? 'default' : 'outline'} size="sm" onClick={() => setVerTodos(v => !v)}>
              {verTodos ? 'Filtrar por produtor' : 'Ver todos os produtores'}
            </Button>
          </div>

          {/* Tabela */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Safrista</TableHead>
                    <TableHead>Talhão</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Medidas</TableHead>
                    <TableHead className="text-right">Valor/Med</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum lançamento</TableCell></TableRow>
                  ) : filtered.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="text-sm">{formatDate(l.data)}</TableCell>
                      <TableCell className="font-medium">{l.safrista}</TableCell>
                      <TableCell>{l.talhao}</TableCell>
                      <TableCell className="text-xs">{l.tipo_colheita}</TableCell>
                      <TableCell className="text-right font-medium">{l.medidas_colhidas}</TableCell>
                      <TableCell className="text-right">R$ {(l.valor_medida || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">R$ {(l.valor_total || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setForm({ ...l }); setEditingId(l.id); setDialogOpen(true); }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(l.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog individual */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editingId ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Produtor</Label>
              <Select value={form.codigo_produtor} onValueChange={v => setForm({ ...form, codigo_produtor: v, safrista: '', talhao: '' })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{produtores.map(p => <SelectItem key={p.id} value={p.codigo}>{p.codigo} — {p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} /></div>
            <div>
              <Label>Safrista</Label>
              <Select value={form.safrista} onValueChange={v => setForm({ ...form, safrista: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{filteredForm.safristas.map(s => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Talhão</Label>
              <Select value={form.talhao} onValueChange={v => setForm({ ...form, talhao: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{filteredForm.talhoes.map(t => <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo Colheita</Label>
              <Select value={form.tipo_colheita} onValueChange={v => setForm({ ...form, tipo_colheita: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Manual', 'Derriçadeira', 'Colhedora', 'Recolhedora', 'Varrição Manual', 'Varrição Mecanizada'].map(m =>
                    <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Medidas Colhidas</Label><Input type="number" step="0.01" value={form.medidas_colhidas} onChange={e => setForm({ ...form, medidas_colhidas: e.target.value })} /></div>
            <div><Label>Valor/Medida (R$)</Label><Input type="number" step="0.01" value={form.valor_medida} onChange={e => setForm({ ...form, valor_medida: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Observações</Label><Input value={form.observacoes || ''} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveIndividual}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}