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

export default function BaseFertilizantes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ---- Fertilizantes/Formulados ----
  const [dialogFertOpen, setDialogFertOpen] = useState(false);
  const [editingFert, setEditingFert] = useState(null);

  const { data: fertilizantes = [], isLoading: loadingFert } = useQuery({
    queryKey: ['fertilizantes'],
    queryFn: () => base44.entities.FertilizanteFormulado.list(),
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
    mutationFn: id => base44.entities.FertilizanteFormulado.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fertilizantes'] }); toast({ title: 'Produto removido.' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });

  // ---- Fontes Simples ----
  const [dialogFonteOpen, setDialogFonteOpen] = useState(false);
  const [editingFonte, setEditingFonte] = useState(null);

  const { data: fontesSimples = [], isLoading: loadingFontes } = useQuery({
    queryKey: ['fontes_simples'],
    queryFn: () => base44.entities.FonteSimples.list(),
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
    mutationFn: id => base44.entities.FonteSimples.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fontes_simples'] }); toast({ title: 'Fonte removida.' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Base de Fertilizantes</h1>
          <p className="text-muted-foreground mt-0.5">Fertilizantes, formulados e fontes nutricionais para o cafeeiro</p>
        </div>
      </div>

      <Tabs defaultValue="formulados">
        <TabsList className="mb-4">
          <TabsTrigger value="formulados" className="gap-2"><FlaskConical className="w-4 h-4" />Fertilizantes e Formulados</TabsTrigger>
          <TabsTrigger value="fontes" className="gap-2"><Beaker className="w-4 h-4" />Fontes Simples</TabsTrigger>
          <TabsTrigger value="guia" className="gap-2"><BookOpen className="w-4 h-4" />Guia de Uso</TabsTrigger>
        </TabsList>

        <TabsContent value="formulados">
          <TabelaFertilizantes
            dados={fertilizantes}
            loading={loadingFert}
            onNovo={() => { setEditingFert(null); setDialogFertOpen(true); }}
            onEditar={f => { setEditingFert(f); setDialogFertOpen(true); }}
            onDeletar={f => fertDelete.mutate(f.id)}
          />
        </TabsContent>

        <TabsContent value="fontes">
          <TabelaFontesSimples
            dados={fontesSimples}
            loading={loadingFontes}
            onNovo={() => { setEditingFonte(null); setDialogFonteOpen(true); }}
            onEditar={f => { setEditingFonte(f); setDialogFonteOpen(true); }}
            onDeletar={f => fonteDelete.mutate(f.id)}
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

function GuiaUso() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4 text-sm">
      <h2 className="text-base font-semibold">Como usar a Base de Fertilizantes</h2>
      <div className="space-y-3 text-muted-foreground">
        <p><strong className="text-foreground">Fertilizantes e Formulados:</strong> produtos comerciais prontos — formulados NPK, organominerais, produtos como Ciclus, Aspire, Kmag, etc. Cada produto possui composição nutricional em %, que é usada para calcular doses automaticamente.</p>
        <p><strong className="text-foreground">Fontes Simples:</strong> matérias-primas nutricionais puras — ureia, MAP, KCl, sulfato de amônio, ácido bórico, etc. Ideal para quem formula misturas personalizadas.</p>
        <p><strong className="text-foreground">Integração com Adubação:</strong> No módulo <em>Adubação do Cafeeiro</em>, ao registrar uma aplicação, você pode selecionar um produto desta base. O sistema calculará automaticamente a dose de produto necessária com base no nutriente recomendado e na composição do produto escolhido.</p>
        <p><strong className="text-foreground">Cálculo automático:</strong> Se a recomendação é 200 kg/ha de K₂O e o produto tem 60% de K₂O, o sistema sugere ~333 kg/ha de produto.</p>
      </div>
    </div>
  );
}