import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import SeletorContexto from '@/components/adubacao/SeletorContexto';
import AnaliseSoloForm from '@/components/adubacao/AnaliseSoloForm';
import PlanoNutricionalForm from '@/components/adubacao/PlanoNutricionalForm';
import FontesFormulados from '@/components/adubacao/FontesFormulados';
import ComprasForm from '@/components/adubacao/ComprasForm';
import AplicacaoBlock from '@/components/adubacao/AplicacaoBlock';
import { Sprout } from 'lucide-react';

export default function Adubacao() {
  const [produtorId, setProdutorId] = useState(null);
  const [talhaoId, setTalhaoId] = useState(null);
  const [safra, setSafra] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: produtores = [] } = useQuery({ queryKey: ['produtores'], queryFn: () => base44.entities.Produtor.list() });
  const { data: talhoes = [] } = useQuery({ queryKey: ['talhoes'], queryFn: () => base44.entities.Talhao.list() });
  const { data: analises = [] } = useQuery({ queryKey: ['analises_solo'], queryFn: () => base44.entities.AnaliseSolo.list() });
  const { data: planos = [] } = useQuery({ queryKey: ['planos_adubacao'], queryFn: () => base44.entities.PlanoAdubacao.list() });

  const produtor = useMemo(() => produtores.find(p => p.id === produtorId) || null, [produtores, produtorId]);
  const talhao = useMemo(() => talhoes.find(t => t.id === talhaoId) || null, [talhoes, talhaoId]);

  const analise = useMemo(() =>
    talhaoId && safra ? analises.find(a => a.talhao_id === talhaoId && a.safra === safra) || null : null,
    [analises, talhaoId, safra]
  );

  const plano = useMemo(() =>
    talhaoId && safra ? planos.find(p => p.talhao_id === talhaoId && p.safra === safra) || null : null,
    [planos, talhaoId, safra]
  );

  const handleProdutorChange = (id) => {
    setProdutorId(id);
    setTalhaoId(null);
    setSafra(null);
  };

  const handleTalhaoChange = (id) => {
    setTalhaoId(id);
    setSafra(null);
  };

  // ---- Mutations Análise ----
  const analiseCreateMutation = useMutation({
    mutationFn: data => base44.entities.AnaliseSolo.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['analises_solo'] }); toast({ title: 'Análise de solo salva!' }); },
    onError: err => toast({ title: 'Erro ao salvar análise', description: String(err?.message || err), variant: 'destructive' }),
  });
  const analiseUpdateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AnaliseSolo.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['analises_solo'] }); toast({ title: 'Análise de solo atualizada!' }); },
    onError: err => toast({ title: 'Erro ao salvar análise', description: String(err?.message || err), variant: 'destructive' }),
  });

  const handleSaveAnalise = (data) => {
    const payload = { ...data, codigo_produtor: produtor.codigo, talhao_id: talhaoId, talhao_nome: talhao?.nome, safra };
    if (analise) analiseUpdateMutation.mutate({ id: analise.id, data: payload });
    else analiseCreateMutation.mutate(payload);
  };

  // ---- Mutations Plano ----
  const planoCreateMutation = useMutation({
    mutationFn: data => base44.entities.PlanoAdubacao.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['planos_adubacao'] }); toast({ title: 'Dados salvos!' }); },
    onError: err => toast({ title: 'Erro ao salvar', description: String(err?.message || err), variant: 'destructive' }),
  });
  const planoUpdateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PlanoAdubacao.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['planos_adubacao'] }); toast({ title: 'Dados salvos!' }); },
    onError: err => toast({ title: 'Erro ao salvar', description: String(err?.message || err), variant: 'destructive' }),
  });

  const handleSavePlano = (partialData) => {
    const base = { codigo_produtor: produtor.codigo, talhao_id: talhaoId, talhao_nome: talhao?.nome, safra };
    if (plano) {
      planoUpdateMutation.mutate({ id: plano.id, data: { ...plano, ...partialData } });
    } else {
      planoCreateMutation.mutate({ ...base, ...partialData });
    }
  };

  const handleSaveAplicacao = (aplicacao) => {
    const aplicacoes = plano?.aplicacoes ? [...plano.aplicacoes] : [];
    const idx = aplicacoes.findIndex(a => a.numero === aplicacao.numero && a.tipo === aplicacao.tipo);
    if (idx >= 0) aplicacoes[idx] = aplicacao;
    else aplicacoes.push(aplicacao);
    handleSavePlano({ aplicacoes });
  };

  const isAnaliseSaving = analiseCreateMutation.isPending || analiseUpdateMutation.isPending;
  const isPlanSaving = planoCreateMutation.isPending || planoUpdateMutation.isPending;

  const pronto = produtor && talhaoId && safra;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sprout className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Adubação do Cafeeiro</h1>
          <p className="text-muted-foreground mt-0.5">Planejamento e execução por produtor, talhão e safra</p>
        </div>
      </div>

      <SeletorContexto
        produtores={produtores}
        talhoes={talhoes}
        produtor={produtor}
        talhaoId={talhaoId}
        safra={safra}
        onProdutor={handleProdutorChange}
        onTalhao={handleTalhaoChange}
        onSafra={setSafra}
      />

      {!pronto && (
        <div className="bg-card rounded-2xl border border-border p-16 text-center text-muted-foreground">
          <Sprout className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Selecione produtor, talhão e safra para começar</p>
          <p className="text-sm mt-1">Os dados serão carregados automaticamente para cada combinação.</p>
        </div>
      )}

      {pronto && (
        <div className="space-y-5">
          {/* Info do contexto */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 text-sm flex flex-wrap gap-4">
            <span><strong>Produtor:</strong> {produtor.nome}</span>
            <span><strong>Fazenda:</strong> {produtor.fazenda}</span>
            <span><strong>Talhão:</strong> {talhao?.nome}</span>
            <span><strong>Safra:</strong> {safra}</span>
            {talhao?.area_ha && <span><strong>Área:</strong> {talhao.area_ha} ha</span>}
            {talhao?.num_plantas && <span><strong>Plantas:</strong> {talhao.num_plantas?.toLocaleString()}</span>}
          </div>

          <AnaliseSoloForm dados={analise} onSave={handleSaveAnalise} saving={isAnaliseSaving} />
          <PlanoNutricionalForm dados={plano} onSave={handleSavePlano} saving={isPlanSaving} />
          <FontesFormulados dados={plano} onSave={handleSavePlano} saving={isPlanSaving} />
          <ComprasForm dados={plano} onSave={handleSavePlano} saving={isPlanSaving} />

          {/* Aplicações */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Aplicações</h2>
            {[1, 2, 3].map(n => (
              <div key={n} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <AplicacaoBlock numero={n} tipo="planejado" dados={plano} talhao={talhao} onSave={handleSaveAplicacao} saving={isPlanSaving} />
                <AplicacaoBlock numero={n} tipo="executado" dados={plano} talhao={talhao} onSave={handleSaveAplicacao} saving={isPlanSaving} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}