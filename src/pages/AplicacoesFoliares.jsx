import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Leaf, FlaskConical, Lightbulb, CalendarDays, FileDown } from 'lucide-react';
import AbaAnaliseFoliar from '@/components/foliar/AbaAnaliseFoliar';
import AbaRecomendacaoFoliar from '@/components/foliar/AbaRecomendacaoFoliar';
import AbaPlanejamentoFoliar from '@/components/foliar/AbaPlanejamentoFoliar';
import AbaExportarPDFFoliar from '@/components/foliar/AbaExportarPDFFoliar';

const SAFRAS = ['2024/2025', '2025/2026', '2026/2027', '2027/2028'];

const ABAS = [
  { id: 'analise',      label: 'Análise Foliar',   icon: FlaskConical },
  { id: 'recomendacao', label: 'Recomendação',      icon: Lightbulb },
  { id: 'planejamento', label: 'Planejamento',      icon: CalendarDays },
  { id: 'pdf',          label: 'Exportar PDF',      icon: FileDown },
];

export default function AplicacoesFoliares() {
  const [produtorId, setProdutorId] = useState(null);
  const [safra, setSafra] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('analise');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: produtores = [] } = useQuery({ queryKey: ['produtores'], queryFn: () => base44.entities.Produtor.list() });
  const { data: talhoes = [] } = useQuery({ queryKey: ['talhoes'], queryFn: () => base44.entities.Talhao.list() });
  const { data: analises = [] } = useQuery({ queryKey: ['analises_foliares'], queryFn: () => base44.entities.AnaliseFoliar.list() });
  const { data: planos = [] } = useQuery({ queryKey: ['planos_foliares'], queryFn: () => base44.entities.PlanoFoliar.list() });
  const { data: insumos = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });

  const produtor = useMemo(() => produtores.find(p => p.id === produtorId) || null, [produtores, produtorId]);
  const talhoesProdutor = useMemo(() => produtor ? talhoes.filter(t => t.codigo_produtor === produtor.codigo) : [], [talhoes, produtor]);

  // ── Mutations AnaliseFoliar ──────────────────────────────────────────────────
  const analiseCreate = useMutation({
    mutationFn: data => base44.entities.AnaliseFoliar.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['analises_foliares'] }); toast({ title: 'Análise foliar salva!' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });
  const analiseUpdate = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AnaliseFoliar.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['analises_foliares'] }); toast({ title: 'Análise foliar atualizada!' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });

  // ── Mutations PlanoFoliar ────────────────────────────────────────────────────
  const planoCreate = useMutation({
    mutationFn: data => base44.entities.PlanoFoliar.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['planos_foliares'] }); toast({ title: 'Planejamento foliar salvo!' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });
  const planoUpdate = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PlanoFoliar.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['planos_foliares'] }); toast({ title: 'Planejamento foliar atualizado!' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSaveAnalise = (talhao, data) => {
    const existing = analises.find(a => a.talhao_id === talhao.id && a.safra === safra);
    const payload = { ...data, codigo_produtor: produtor.codigo, talhao_id: talhao.id, talhao_nome: talhao.nome, safra };
    if (existing) analiseUpdate.mutate({ id: existing.id, data: payload });
    else analiseCreate.mutate(payload);
  };

  const handleImportadoFoliar = (talhao, data) => {
    handleSaveAnalise(talhao, data);
  };

  const handleSavePlano = (talhao, data) => {
    const existing = planos.find(p => p.talhao_id === talhao.id && p.safra === safra);
    const payload = { ...data, codigo_produtor: produtor.codigo, talhao_id: talhao.id, talhao_nome: talhao.nome, safra };
    if (existing) planoUpdate.mutate({ id: existing.id, data: payload });
    else planoCreate.mutate(payload);
  };

  const pronto = produtor && safra;
  const isAnaliseSaving = analiseCreate.isPending || analiseUpdate.isPending;
  const isPlanSaving = planoCreate.isPending || planoUpdate.isPending;

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Leaf className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Aplicações Foliares</h1>
          <p className="text-muted-foreground mt-0.5">Análise, recomendação e planejamento foliar por produtor, talhão e safra</p>
        </div>
      </div>

      {/* Seletor de contexto */}
      <div className="bg-card border border-border rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs mb-1 block">Produtor</Label>
          <Select value={produtorId || 'none'} onValueChange={v => { setProdutorId(v === 'none' ? null : v); setSafra(null); }}>
            <SelectTrigger><SelectValue placeholder="Selecione o produtor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Selecione...</SelectItem>
              {produtores.map(p => <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Safra</Label>
          <Select value={safra || 'none'} onValueChange={v => setSafra(v === 'none' ? null : v)} disabled={!produtor}>
            <SelectTrigger><SelectValue placeholder="Selecione a safra" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Selecione...</SelectItem>
              {SAFRAS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {produtor && (
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Fazenda: <strong>{produtor.fazenda}</strong> — {produtor.municipio}/{produtor.uf} — {talhoesProdutor.length} talhão(ões)
          </p>
        )}
      </div>

      {/* Placeholder */}
      {!pronto && (
        <div className="bg-card rounded-2xl border border-border p-16 text-center text-muted-foreground">
          <Leaf className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Selecione produtor e safra para começar</p>
        </div>
      )}

      {pronto && (
        <>
          {/* Abas */}
          <div className="flex flex-wrap gap-1 border-b border-border pb-0">
            {ABAS.map(aba => {
              const Icon = aba.icon;
              return (
                <button
                  key={aba.id}
                  onClick={() => setAbaAtiva(aba.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-colors -mb-px ${
                    abaAtiva === aba.id
                      ? 'bg-card border-border text-foreground'
                      : 'bg-muted/30 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {aba.label}
                </button>
              );
            })}
          </div>

          <div className="mt-0">
            {abaAtiva === 'analise' && (
              <AbaAnaliseFoliar
                produtor={produtor}
                safra={safra}
                talhoes={talhoes}
                analises={analises}
                onSave={handleSaveAnalise}
                onImportado={handleImportadoFoliar}
                saving={isAnaliseSaving}
              />
            )}
            {abaAtiva === 'recomendacao' && (
              <AbaRecomendacaoFoliar
                produtor={produtor}
                safra={safra}
                talhoes={talhoes}
                analises={analises}
                insumos={insumos}
              />
            )}
            {abaAtiva === 'planejamento' && (
              <AbaPlanejamentoFoliar
                produtor={produtor}
                safra={safra}
                talhoes={talhoes}
                planos={planos}
                insumos={insumos}
                onSave={handleSavePlano}
                saving={isPlanSaving}
              />
            )}
            {abaAtiva === 'pdf' && (
              <AbaExportarPDFFoliar
                produtor={produtor}
                safra={safra}
                talhoes={talhoes}
                analises={analises}
                planos={planos}
                insumos={insumos}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}