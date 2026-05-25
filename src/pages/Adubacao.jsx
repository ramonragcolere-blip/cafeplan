import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sprout, ChevronDown, ChevronUp, Search, FlaskConical, Calculator, Package, ShoppingCart, ClipboardCheck, FileDown } from 'lucide-react';
import DadosTalhaoCard from '@/components/adubacao/DadosTalhaoCard';
import AnaliseSoloForm from '@/components/adubacao/AnaliseSoloForm';
import AnaliseSolo2040Form from '@/components/adubacao/AnaliseSolo2040Form';
import RecomendacaoNPK from '@/components/adubacao/RecomendacaoNPK';
import ImportarAnalisePDF from '@/components/adubacao/ImportarAnalisePDF';
import PlanoAplicacoes from '@/components/adubacao/PlanoAplicacoes';
import AbaPlanejamento from '@/components/adubacao/AbaPlanejamento';
import AbaCompra from '@/components/adubacao/AbaCompra';
import AbaExecucao from '@/components/adubacao/AbaExecucao';
import AbaExportarPDF from '@/components/adubacao/AbaExportarPDF';

const SAFRAS = ['2024/2025', '2025/2026', '2026/2027', '2027/2028'];

const ABAS = [
  { id: 'analise', label: 'Análise e Recomendação', icon: FlaskConical },
  { id: 'planejamento', label: 'Planejamento', icon: Package },
  { id: 'compra', label: 'Compra', icon: ShoppingCart },
  { id: 'execucao', label: 'Execução', icon: ClipboardCheck },
  { id: 'pdf', label: 'Exportar PDF', icon: FileDown },
];

// ── TalhaoRow — expandível, usado nas abas Análise e Planejamento ─────────────
function TalhaoRow({ talhao, produtor, safra, analise, analise2040, plano, onSaveAnalise, onSaveAnalise2040, onSavePlano, isAnaliseSaving, isAnalise2040Saving, isPlanSaving, abaInterna, onEnviarPlanejamento, talhoes, analises, analises2040List, onImportarAnalise, onImportarAnalise2040 }) {
  const [aberto, setAberto] = useState(false);
  const temDados = !!(analise || plano);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setAberto(a => !a)}
      >
        <div className="flex items-center gap-3">
          <Sprout className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold">{talhao.nome}</span>
          {talhao.area_ha && <span className="text-sm text-muted-foreground">{talhao.area_ha} ha</span>}
          {talhao.cultivar && <span className="text-xs text-muted-foreground">• {talhao.cultivar}</span>}
          {talhao.num_plantas && <span className="text-xs text-muted-foreground">• {talhao.num_plantas?.toLocaleString()} plantas</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {temDados && <Badge variant="secondary" className="text-xs">Com dados</Badge>}
          {aberto ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {aberto && (
        <div className="border-t border-border p-4 space-y-4">
          {abaInterna === 'analise' && (
            <>
              <DadosTalhaoCard talhao={talhao} produtor={produtor} />
              <div className="flex justify-end">
                <ImportarAnalisePDF
                  talhoes={talhoes || [talhao]}
                  safra={safra}
                  analises={analises}
                  analises2040={analises2040List}
                  onImportarAnalise={onImportarAnalise}
                  onImportarAnalise2040={onImportarAnalise2040}
                />
              </div>
              <AnaliseSoloForm dados={analise} onSave={onSaveAnalise} saving={isAnaliseSaving} />
              <AnaliseSolo2040Form
                dados={analise2040}
                onSave={onSaveAnalise2040}
                saving={isAnalise2040Saving}
              />
              <RecomendacaoNPK analise={analise} analise2040={analise2040} talhao={talhao} dados={plano} onSave={onSavePlano} saving={isPlanSaving} onEnviarPlanejamento={onEnviarPlanejamento} />
            </>
          )}
          {abaInterna === 'planejamento' && (
            <>
              <DadosTalhaoCard talhao={talhao} produtor={produtor} />
              <PlanoAplicacoes dados={plano} talhao={talhao} onSave={onSavePlano} saving={isPlanSaving} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Adubacao() {
  const [produtorId, setProdutorId] = useState(null);
  const [safra, setSafra] = useState(null);
  const [filtroNome, setFiltroNome] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('analise');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: produtores = [] } = useQuery({ queryKey: ['produtores'], queryFn: () => base44.entities.Produtor.list() });
  const { data: talhoes = [] } = useQuery({ queryKey: ['talhoes'], queryFn: () => base44.entities.Talhao.list() });
  const { data: analises = [] } = useQuery({ queryKey: ['analises_solo'], queryFn: () => base44.entities.AnaliseSolo.list() });
  const { data: analises2040 = [] } = useQuery({ queryKey: ['analises_solo_2040'], queryFn: () => base44.entities.AnaliseSolo2040.list() });
  const { data: planos = [] } = useQuery({ queryKey: ['planos_adubacao'], queryFn: () => base44.entities.PlanoAdubacao.list() });

  const produtor = useMemo(() => produtores.find(p => p.id === produtorId) || null, [produtores, produtorId]);
  const talhoesProdutor = useMemo(() => produtor ? talhoes.filter(t => t.codigo_produtor === produtor.codigo) : [], [talhoes, produtor]);
  const talhoesFiltrados = useMemo(() =>
    filtroNome ? talhoesProdutor.filter(t => t.nome.toLowerCase().includes(filtroNome.toLowerCase())) : talhoesProdutor,
    [talhoesProdutor, filtroNome]);

  // ── Mutations Análise ────────────────────────────────────────────────────────
  const analiseCreate = useMutation({
    mutationFn: data => base44.entities.AnaliseSolo.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['analises_solo'] }); toast({ title: 'Análise de solo salva!' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });
  const analiseUpdate = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AnaliseSolo.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['analises_solo'] }); toast({ title: 'Análise de solo atualizada!' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });

  // ── Mutations Análise 20-40 ──────────────────────────────────────────────────
  const analise2040Create = useMutation({
    mutationFn: data => base44.entities.AnaliseSolo2040.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['analises_solo_2040'] }); toast({ title: 'Análise 20–40 cm salva!' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });
  const analise2040Update = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AnaliseSolo2040.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['analises_solo_2040'] }); toast({ title: 'Análise 20–40 cm atualizada!' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });

  // ── Mutations Plano ──────────────────────────────────────────────────────────
  const planoCreate = useMutation({
    mutationFn: data => base44.entities.PlanoAdubacao.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['planos_adubacao'] }); toast({ title: 'Dados salvos!' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });
  const planoUpdate = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PlanoAdubacao.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['planos_adubacao'] }); toast({ title: 'Dados salvos!' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message || err), variant: 'destructive' }),
  });

  // ── Handlers por talhão ──────────────────────────────────────────────────────
  const getSaveHandlers = (talhao) => {
    const analise     = safra ? analises.find(a => a.talhao_id === talhao.id && a.safra === safra) || null : null;
    const analise2040 = safra ? analises2040.find(a => a.talhao_id === talhao.id && a.safra === safra) || null : null;
    const plano       = safra ? planos.find(p => p.talhao_id === talhao.id && p.safra === safra) || null : null;

    const handleSaveAnalise = (data) => {
      const payload = { ...data, codigo_produtor: produtor.codigo, talhao_id: talhao.id, talhao_nome: talhao.nome, safra };
      if (analise) analiseUpdate.mutate({ id: analise.id, data: payload });
      else analiseCreate.mutate(payload);
    };

    const handleSaveAnalise2040 = (data) => {
      const payload = { ...data, codigo_produtor: produtor.codigo, talhao_id: talhao.id, talhao_nome: talhao.nome, safra };
      if (analise2040) analise2040Update.mutate({ id: analise2040.id, data: payload });
      else analise2040Create.mutate(payload);
    };

    const handleSavePlano = (partialData) => {
      const base = { codigo_produtor: produtor.codigo, talhao_id: talhao.id, talhao_nome: talhao.nome, safra };
      if (plano) planoUpdate.mutate({ id: plano.id, data: { ...plano, ...partialData } });
      else planoCreate.mutate({ ...base, ...partialData });
    };

    return { analise, analise2040, plano, handleSaveAnalise, handleSaveAnalise2040, handleSavePlano };
  };

  // Handler especial para compras (salva em plano específico por id)
  const handleSavePlanoById = (planoObj, partialData) => {
    if (planoObj?.id) planoUpdate.mutate({ id: planoObj.id, data: { ...planoObj, ...partialData } });
  };

  const pronto = produtor && safra;
  const isAnaliseSaving      = analiseCreate.isPending || analiseUpdate.isPending;
  const isAnalise2040Saving  = analise2040Create.isPending || analise2040Update.isPending;
  const isPlanSaving = planoCreate.isPending || planoUpdate.isPending;

  // Para abas de Execução, usa o primeiro talhão filtrado como contexto (ou o selecionado)
  const [talhaoExecId, setTalhaoExecId] = useState(null);
  const talhaoExec = useMemo(() => {
    if (talhaoExecId) return talhoesProdutor.find(t => t.id === talhaoExecId) || talhoesProdutor[0] || null;
    return talhoesProdutor[0] || null;
  }, [talhoesProdutor, talhaoExecId]);
  const planoExec = useMemo(() =>
    talhaoExec && safra ? planos.find(p => p.talhao_id === talhaoExec.id && p.safra === safra) || null : null,
    [planos, talhaoExec, safra]);

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sprout className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Adubação do Cafeeiro</h1>
          <p className="text-muted-foreground mt-0.5">Planejamento nutricional por produtor, talhão e safra</p>
        </div>
      </div>

      {/* Seletor de contexto */}
      <div className="bg-card border border-border rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs mb-1 block">Produtor</Label>
          <Select value={produtorId || 'none'} onValueChange={v => { setProdutorId(v === 'none' ? null : v); setSafra(null); setFiltroNome(''); setTalhaoExecId(null); }}>
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

      {/* Placeholder sem seleção */}
      {!pronto && (
        <div className="bg-card rounded-2xl border border-border p-16 text-center text-muted-foreground">
          <Sprout className="w-10 h-10 mx-auto mb-3 opacity-30" />
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

          {/* Conteúdo das abas */}
          <div className="mt-0">

            {/* ABA 1 — Análise e Recomendação */}
            {abaAtiva === 'analise' && (
              <div className="space-y-4">
                {talhoesProdutor.length > 1 && (
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Filtrar talhão..." value={filtroNome} onChange={e => setFiltroNome(e.target.value)} className="pl-10" />
                  </div>
                )}
                {talhoesFiltrados.length === 0 && (
                  <div className="text-center text-muted-foreground py-10 bg-card rounded-2xl border border-border">
                    <p>Nenhum talhão encontrado.</p>
                  </div>
                )}
                {talhoesFiltrados.map(talhao => {
                  const { analise, analise2040, plano, handleSaveAnalise, handleSaveAnalise2040, handleSavePlano } = getSaveHandlers(talhao);
                  const handleEnviarCalagem = (dados) => {
                    const calagemAtual = plano?.calagem_recomendada || [];
                    handleSavePlano({ calagem_recomendada: [...calagemAtual.filter(c => c.tipo !== 'calagem'), dados] });
                  };
                  // handlers para importação PDF — recebem um talhao explícito (pode ser diferente do atual)
                  const handleImportarAnalise = (talhaoAlvo, dados) => {
                    const { handleSaveAnalise: save } = getSaveHandlers(talhaoAlvo);
                    save(dados);
                  };
                  const handleImportarAnalise2040 = (talhaoAlvo, dados) => {
                    const { handleSaveAnalise2040: save } = getSaveHandlers(talhaoAlvo);
                    save(dados);
                  };
                  return (
                    <TalhaoRow
                      key={talhao.id}
                      talhao={talhao}
                      produtor={produtor}
                      safra={safra}
                      analise={analise}
                      analise2040={analise2040}
                      plano={plano}
                      onSaveAnalise={handleSaveAnalise}
                      onSaveAnalise2040={handleSaveAnalise2040}
                      onSavePlano={handleSavePlano}
                      isAnaliseSaving={isAnaliseSaving}
                      isAnalise2040Saving={isAnalise2040Saving}
                      isPlanSaving={isPlanSaving}
                      abaInterna="analise"
                      onEnviarPlanejamento={handleEnviarCalagem}
                      talhoes={talhoesProdutor}
                      analises={analises}
                      analises2040List={analises2040}
                      onImportarAnalise={handleImportarAnalise}
                      onImportarAnalise2040={handleImportarAnalise2040}
                    />
                  );
                })}
              </div>
            )}

            {/* ABA 2 — Planejamento */}
            {abaAtiva === 'planejamento' && (
              <AbaPlanejamento
                produtor={produtor}
                safra={safra}
                talhoes={talhoes}
                analises={analises}
                analises2040={analises2040}
                planos={planos}
                saving={isPlanSaving}
                onSavePlano={(talhao, partialData) => {
                  const { handleSavePlano } = getSaveHandlers(talhao);
                  handleSavePlano(partialData);
                }}
              />
            )}

            {/* ABA 3 — Compra */}
            {abaAtiva === 'compra' && (
              <AbaCompra
                produtor={produtor}
                safra={safra}
                talhoes={talhoes}
                planos={planos}
                saving={isPlanSaving}
                onSavePlano={handleSavePlanoById}
              />
            )}

            {/* ABA 4 — Execução */}
            {abaAtiva === 'execucao' && (
              <div className="space-y-4">
                {talhoesProdutor.length > 1 && (
                  <div>
                    <Label className="text-xs mb-1 block">Selecionar talhão</Label>
                    <Select
                      value={talhaoExec?.id || 'none'}
                      onValueChange={v => setTalhaoExecId(v === 'none' ? null : v)}
                    >
                      <SelectTrigger className="max-w-sm"><SelectValue placeholder="Talhão..." /></SelectTrigger>
                      <SelectContent>
                        {talhoesProdutor.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <AbaExecucao
                  talhao={talhaoExec}
                  produtor={produtor}
                  safra={safra}
                />
              </div>
            )}

            {/* ABA 5 — Exportar PDF */}
            {abaAtiva === 'pdf' && (
              <AbaExportarPDF
                produtor={produtor}
                safra={safra}
                talhoes={talhoes}
              />
            )}

          </div>
        </>
      )}
    </div>
  );
}