import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FlaskConical, Beaker, BookOpen } from 'lucide-react';
import TabelaFertilizantes from '@/components/fertilizantes/TabelaFertilizantes';
import DialogFertilizante from '@/components/fertilizantes/DialogFertilizante';
import TabelaFontesSimples from '@/components/fertilizantes/TabelaFontesSimples';
import DialogFonteSimples from '@/components/fertilizantes/DialogFonteSimples';
import { combinarCatalogoInsumos, contarUsoProdutoPlanejamento } from '@/lib/planejamentoProdutosAdubacao2';

export default function BaseFertilizantes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ---- Fertilizantes/Formulados ----
  const [dialogFertOpen, setDialogFertOpen] = useState(false);
  const [editingFert, setEditingFert] = useState(null);

  const { data: fertilizantes = [], isLoading: loadingFert } = useQuery({
    queryKey: ['fertilizantes', 'catalogo-completo'],
    queryFn: () => base44.entities.FertilizanteFormulado.list(undefined, 5000),
  });

  const fertCreate = useMutation({
    mutationFn: d => base44.entities.FertilizanteFormulado.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fertilizantes'] }); toast({ title: 'Produto criado!' }); setDialogFertOpen(false); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });
  const fertUpdate = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FertilizanteFormulado.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fertilizantes'] }); toast({ title: 'Produto atualizado!' }); setDialogFertOpen(false); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });
  const fertDelete = useMutation({
    mutationFn: id => base44.entities.FertilizanteFormulado.update(id, { ativo: false }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fertilizantes'] }); toast({ title: 'Produto inativado.' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });

  // ---- Fontes Simples ----
  const [dialogFonteOpen, setDialogFonteOpen] = useState(false);
  const [editingFonte, setEditingFonte] = useState(null);

  const { data: fontesSimples = [], isLoading: loadingFontes } = useQuery({
    queryKey: ['fontes_simples', 'catalogo-completo'],
    queryFn: () => base44.entities.FonteSimples.list(undefined, 5000),
  });

  const { data: planejamentos = [] } = useQuery({
    queryKey: ['planejamento_adubacao2'],
    queryFn: () => base44.entities.PlanejamentoAdubacao2.list(undefined, 5000),
  });

  const fonteCreate = useMutation({
    mutationFn: d => base44.entities.FonteSimples.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fontes_simples'] }); toast({ title: 'Fonte criada!' }); setDialogFonteOpen(false); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });
  const fonteUpdate = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FonteSimples.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fontes_simples'] }); toast({ title: 'Fonte atualizada!' }); setDialogFonteOpen(false); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });
  const fonteDelete = useMutation({
    mutationFn: id => base44.entities.FonteSimples.update(id, { ativo: false }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fontes_simples'] }); toast({ title: 'Fonte inativada.' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });

  const catalogoCompleto = combinarCatalogoInsumos(fertilizantes, fontesSimples);

  const confirmarInativacao = (produto, tipo) => {
    const usos = contarUsoProdutoPlanejamento(planejamentos, produto.id);
    const impacto = usos > 0
      ? `Este produto aparece em ${usos} planejamento(s). Ele sera inativado para novas sugestoes, mas continuara preservado nos planejamentos salvos.`
      : 'Este produto sera inativado para novas sugestoes.';
    const ok = window.confirm(`${impacto}\n\nDeseja continuar?`);
    if (!ok) return;
    if (tipo === 'fonte') fonteDelete.mutate(produto.id);
    else fertDelete.mutate(produto.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Base de Insumos</h1>
          <p className="text-muted-foreground mt-0.5">Fertilizantes, defensivos, foliares e demais insumos para o cafeeiro</p>
        </div>
      </div>

      <Tabs defaultValue="todos">
        <TabsList className="mb-4">
          <TabsTrigger value="todos" className="gap-2"><BookOpen className="w-4 h-4" />Todos</TabsTrigger>
          <TabsTrigger value="formulados" className="gap-2"><FlaskConical className="w-4 h-4" />Fertilizantes e Formulados</TabsTrigger>
          <TabsTrigger value="fontes" className="gap-2"><Beaker className="w-4 h-4" />Fontes Simples</TabsTrigger>
          <TabsTrigger value="guia" className="gap-2"><BookOpen className="w-4 h-4" />Guia de Uso</TabsTrigger>
        </TabsList>

        <TabsContent value="todos">
          <TabelaCatalogoCompleto
            dados={catalogoCompleto}
            loading={loadingFert || loadingFontes}
            planejamentos={planejamentos}
            onEditar={produto => {
              if (produto._tipo === 'fonte') { setEditingFonte(produto); setDialogFonteOpen(true); }
              else { setEditingFert(produto); setDialogFertOpen(true); }
            }}
            onDeletar={confirmarInativacao}
          />
        </TabsContent>

        <TabsContent value="formulados">
          <TabelaFertilizantes
            dados={fertilizantes}
            loading={loadingFert}
            onNovo={() => { setEditingFert(null); setDialogFertOpen(true); }}
            onEditar={f => { setEditingFert(f); setDialogFertOpen(true); }}
            onDeletar={f => confirmarInativacao(f, 'formulado')}
            onImportado={() => queryClient.invalidateQueries({ queryKey: ['fertilizantes'] })}
          />
        </TabsContent>

        <TabsContent value="fontes">
          <TabelaFontesSimples
            dados={fontesSimples}
            loading={loadingFontes}
            onNovo={() => { setEditingFonte(null); setDialogFonteOpen(true); }}
            onEditar={f => { setEditingFonte(f); setDialogFonteOpen(true); }}
            onDeletar={f => confirmarInativacao(f, 'fonte')}
          />
        </TabsContent>

        <TabsContent value="guia">
          <GuiaUso />
        </TabsContent>
      </Tabs>

      <DialogFertilizante
        open={dialogFertOpen}
        onOpenChange={setDialogFertOpen}
        dados={editingFert}
        onSave={data => editingFert ? fertUpdate.mutate({ id: editingFert.id, data }) : fertCreate.mutate(data)}
        saving={fertCreate.isPending || fertUpdate.isPending}
      />

      <DialogFonteSimples
        open={dialogFonteOpen}
        onOpenChange={setDialogFonteOpen}
        dados={editingFonte}
        onSave={data => editingFonte ? fonteUpdate.mutate({ id: editingFonte.id, data }) : fonteCreate.mutate(data)}
        saving={fonteCreate.isPending || fonteUpdate.isPending}
      />
    </div>
  );
}

function normalizarBusca(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function TabelaCatalogoCompleto({ dados, loading, planejamentos, onEditar, onDeletar }) {
  const [busca, setBusca] = useState('');
  const termo = normalizarBusca(busca);
  const filtrados = dados.filter(produto => {
    if (!termo) return true;
    return [
      produto.nome,
      produto.fornecedor,
      produto.nutriente_principal,
      produto.grupo,
      produto._origemLabel,
    ].some(valor => normalizarBusca(valor).includes(termo));
  });

  const nutrientes = ['n_pct', 'p2o5_pct', 'k2o_pct', 'b_pct']
    .map(key => ({ key, label: key === 'p2o5_pct' ? 'P2O5' : key === 'k2o_pct' ? 'K2O' : key === 'n_pct' ? 'N' : 'B' }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar insumo, fonte, fornecedor..."
          className="h-9 w-full sm:w-80 border border-input rounded px-3 text-sm bg-background"
        />
        <p className="text-xs text-muted-foreground">{filtrados.length} insumo(s)</p>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Origem</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Fornecedor</th>
                {nutrientes.map(n => <th key={n.key} className="text-center px-2 py-3 font-medium text-muted-foreground">{n.label}</th>)}
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Uso</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Carregando...</td></tr>}
              {!loading && filtrados.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Nenhum insumo encontrado.</td></tr>}
              {filtrados.map(produto => {
                const usos = contarUsoProdutoPlanejamento(planejamentos, produto.id);
                return (
                  <tr key={`${produto._tipo}-${produto.id}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{produto.nome}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{produto._origemLabel}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{produto.fornecedor || '-'}</td>
                    {nutrientes.map(n => (
                      <td key={n.key} className="px-2 py-2.5 text-center text-xs text-muted-foreground">
                        {produto[n.key] > 0 ? `${produto[n.key]}%` : '-'}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center text-xs">{usos > 0 ? `${usos} plano(s)` : '-'}</td>
                    <td className="px-3 py-2.5 text-center text-xs">{produto.ativo === false ? 'Inativo' : 'Ativo'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => onEditar(produto)} className="text-xs underline text-muted-foreground hover:text-foreground">Editar</button>
                        <button type="button" onClick={() => onDeletar(produto, produto._tipo)} className="text-xs underline text-destructive">Excluir</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GuiaUso() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4 text-sm">
      <h2 className="text-base font-semibold">Como usar a Base de Fertilizantes</h2>
      <div className="space-y-3 text-muted-foreground">
        <p><strong className="text-foreground">Fertilizantes e Formulados:</strong> produtos comerciais prontos — formulados NPK, organominerais, produtos como Ciclus, Aspire, Kmag, etc. Cada produto possui composição nutricional em %, que é usada para calcular doses automaticamente.</p>
        <p><strong className="text-foreground">Fontes Simples:</strong> matérias-primas nutricionais puras — ureia, MAP, KCl, sulfato de amônio, ácido bórico, etc. Ideal para quem formula misturas personalizadas.</p>
        <p><strong className="text-foreground">Integração com Adubação:</strong> No módulo <em>Adubação 2.0</em>, ao registrar uma aplicação, você pode selecionar um produto desta base. O sistema calculará automaticamente a dose de produto necessária com base no nutriente recomendado e na composição do produto escolhido.</p>
        <p><strong className="text-foreground">Cálculo automático:</strong> Se a recomendação é 200 kg/ha de K₂O e o produto tem 60% de K₂O, o sistema sugere ~333 kg/ha de produto.</p>
      </div>
    </div>
  );
}
