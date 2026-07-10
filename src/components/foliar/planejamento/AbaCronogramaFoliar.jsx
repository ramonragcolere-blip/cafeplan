import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Leaf, Calendar, MapPin, DollarSign, AlertCircle } from 'lucide-react';
import CardAplicacao from './CardAplicacao';
import LateralReceita from './LateralReceita';
import LateralTalhoes from './LateralTalhoes';
import { limparPayloadCronogramaFoliar } from '@/lib/planejamentoFoliar';

const OBJETIVOS_FILTRO = ['Todos', 'Nutrição', 'Ferrugem', 'Cercosporiose', 'Bicho-mineiro', 'Ácaro', 'Bacteriose', 'Pós-colheita', 'Pré-florada', 'Outro'];
function gerarTituloSugerido(aplicacoes) {
  const prefixos = ['Pós-colheita', 'Proteção', 'Nutrição', 'Controle', 'Pré-florada'];
  const contagens = {};
  aplicacoes.forEach(a => {
    const pref = prefixos.find(p => (a.titulo || '').startsWith(p));
    if (pref) contagens[pref] = (contagens[pref] || 0) + 1;
  });
  const prefixo = prefixos.find(p => !contagens[p]) || 'Aplicação';
  const n = (contagens[prefixo] || 0) + 1;
  return `${prefixo} ${n}`;
}

function fmtR(v) {
  return v != null && !isNaN(v) ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
}

export default function AbaCronogramaFoliar({ produtor, safra, talhoes, insumos }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filtroObj, setFiltroObj] = useState('Todos');
  const [lateralReceita, setLateralReceita] = useState(null); // id da aplicação
  const [lateralTalhoes, setLateralTalhoes] = useState(null); // id da aplicação

  // Query de cronogramas
  const { data: cronogramas = [] } = useQuery({
    queryKey: ['cronograma_foliar'],
    queryFn: () => base44.entities.CronogramaFoliar.list(undefined, 5000),
  });

  const createMutation = useMutation({
    mutationFn: d => base44.entities.CronogramaFoliar.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cronograma_foliar'] }); },
    onError: err => toast({ title: 'Erro ao salvar', description: String(err?.message || err), variant: 'destructive' }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, d }) => base44.entities.CronogramaFoliar.update(id, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cronograma_foliar'] }); },
    onError: err => toast({ title: 'Erro ao salvar', description: String(err?.message || err), variant: 'destructive' }),
  });
  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.CronogramaFoliar.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cronograma_foliar'] }); toast({ title: 'Aplicação excluída.' }); },
    onError: err => toast({ title: 'Erro ao excluir', description: String(err?.message || err), variant: 'destructive' }),
  });

  const talhoesProdutor = useMemo(() =>
    talhoes.filter(t => t.codigo_produtor === produtor?.codigo),
    [talhoes, produtor]
  );

  const aplicacoesProdutor = useMemo(() =>
    cronogramas.filter(c => c.codigo_produtor === produtor?.codigo && c.safra === safra),
    [cronogramas, produtor, safra]
  );

  const aplicacoesFiltradas = useMemo(() => {
    if (filtroObj === 'Todos') return aplicacoesProdutor;
    return aplicacoesProdutor.filter(a => (a.objetivos || []).includes(filtroObj));
  }, [aplicacoesProdutor, filtroObj]);

  // Métricas de resumo
  const metricas = useMemo(() => {
    const total = aplicacoesProdutor.length;
    const areaSet = new Set();
    let custoTotal = 0;
    let pendencias = 0;
    aplicacoesProdutor.forEach(a => {
      (a.talhao_ids || []).forEach(id => areaSet.add(id));
      const area = talhoesProdutor.filter(t => (a.talhao_ids || []).includes(t.id)).reduce((s, t) => s + (t.area_ha || 0), 0);
      const custoHa = (a.produtos || []).reduce((s, p) => {
        const d = parseFloat(String(p.dose || '').replace(',', '.')) || 0;
        const pr = parseFloat(String(p.preco || '').replace(',', '.')) || 0;
        return s + (d && pr ? d * pr : 0);
      }, 0);
      custoTotal += custoHa * area;
      if (!a.talhao_ids?.length || !a.produtos?.length) pendencias++;
    });
    const areaTotal = talhoesProdutor.filter(t => areaSet.has(t.id)).reduce((s, t) => s + (t.area_ha || 0), 0);
    return { total, areaTotal, custoTotal, pendencias };
  }, [aplicacoesProdutor, talhoesProdutor]);

  const handleNovaAplicacao = useCallback(() => {
    if (!produtor || !safra) return;
    const titulo = gerarTituloSugerido(aplicacoesProdutor);
    createMutation.mutate({
      codigo_produtor: produtor.codigo,
      safra,
      titulo,
      objetivos: [],
      talhao_ids: [],
      produtos: [],
      status: 'planejado',
    }, {
      onSuccess: () => toast({ title: 'Nova aplicação criada!', description: titulo }),
    });
  }, [produtor, safra, aplicacoesProdutor]);

  const handleSalvarReceita = useCallback(async (id, dados) => {
    const existente = aplicacoesProdutor.find(a => a.id === id);
    if (!existente) return;
    await updateMutation.mutateAsync({ id, d: limparPayloadCronogramaFoliar({ ...existente, ...dados }) });
    toast({ title: 'Receita salva!' });
    setLateralReceita(null);
  }, [aplicacoesProdutor]);

  const handleSalvarTalhoes = useCallback(async (id, talhaoIds) => {
    const existente = aplicacoesProdutor.find(a => a.id === id);
    if (!existente) return;
    await updateMutation.mutateAsync({ id, d: limparPayloadCronogramaFoliar({ ...existente, talhao_ids: talhaoIds }) });
    toast({ title: 'Talhões atualizados!' });
    setLateralTalhoes(null);
  }, [aplicacoesProdutor]);

  const handleDuplicar = useCallback((aplic) => {
    const titulo = `${aplic.titulo || gerarTituloSugerido(aplicacoesProdutor)} (cópia)`;
    createMutation.mutate(limparPayloadCronogramaFoliar({
      ...aplic,
      titulo,
      status: 'planejado',
    }), { onSuccess: () => toast({ title: 'Aplicação duplicada!', description: titulo }) });
  }, [aplicacoesProdutor]);

  const aplicacaoLateralReceita = lateralReceita ? aplicacoesProdutor.find(a => a.id === lateralReceita) : null;
  const aplicacaoLateralTalhoes = lateralTalhoes ? aplicacoesProdutor.find(a => a.id === lateralTalhoes) : null;

  const areaLateralReceita = useMemo(() => {
    if (!aplicacaoLateralReceita) return 0;
    return talhoesProdutor.filter(t => (aplicacaoLateralReceita.talhao_ids || []).includes(t.id))
      .reduce((s, t) => s + (t.area_ha || 0), 0);
  }, [aplicacaoLateralReceita, talhoesProdutor]);

  return (
    <div className="space-y-5">
      {/* Cards de resumo gerencial */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Aplicações planejadas', value: metricas.total, icon: Calendar, color: 'text-primary' },
          { label: 'Área programada', value: `${metricas.areaTotal.toFixed(1)} ha`, icon: MapPin, color: 'text-blue-600' },
          { label: 'Custo previsto', value: fmtR(metricas.custoTotal), icon: DollarSign, color: 'text-amber-600' },
          { label: 'Pendências', value: metricas.pendencias, icon: AlertCircle, color: metricas.pendencias > 0 ? 'text-red-600' : 'text-green-600' },
        ].map(card => (
          <div key={card.label} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
            <card.icon className={`w-5 h-5 shrink-0 mt-0.5 ${card.color}`} />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{card.label}</p>
              <p className={`text-lg font-bold tabular-nums truncate ${card.color}`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chips de filtro rápido + botão Nova aplicação */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {OBJETIVOS_FILTRO.map(obj => (
            <button key={obj} type="button" onClick={() => setFiltroObj(obj)}
              className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${filtroObj === obj ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}>
              {obj}
              {obj !== 'Todos' && aplicacoesProdutor.filter(a => (a.objetivos || []).includes(obj)).length > 0 && (
                <span className="ml-1 opacity-60 text-[10px]">
                  {aplicacoesProdutor.filter(a => (a.objetivos || []).includes(obj)).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <Button className="gap-1.5 text-sm" onClick={handleNovaAplicacao} disabled={createMutation.isPending}>
          <Plus className="w-4 h-4" /> Nova aplicação
        </Button>
      </div>

      {/* Lista de aplicações */}
      {aplicacoesFiltradas.length === 0 ? (
        <div className="text-center py-14 bg-card border border-dashed border-border rounded-2xl text-muted-foreground">
          <Leaf className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">
            {aplicacoesProdutor.length === 0
              ? 'Nenhuma aplicação planejada. Clique em "Nova aplicação" para começar.'
              : `Nenhuma aplicação com objetivo "${filtroObj}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {aplicacoesFiltradas.map((aplic, idx) => (
            <CardAplicacao
              key={aplic.id}
              aplicacao={aplic}
              talhoes={talhoesProdutor}
              index={idx}
              onEditarReceita={() => setLateralReceita(aplic.id)}
              onEditarTalhoes={() => setLateralTalhoes(aplic.id)}
              onDuplicar={() => handleDuplicar(aplic)}
              onExcluir={() => {
                if (window.confirm(`Excluir a aplicação "${aplic.titulo || 'sem título'}"? Esta ação não pode ser desfeita.`)) {
                  deleteMutation.mutate(aplic.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Lateral: Editar receita */}
      {lateralReceita && aplicacaoLateralReceita && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setLateralReceita(null)} />
          <LateralReceita
            aplicacao={aplicacaoLateralReceita}
            insumos={insumos}
            areaTotal={areaLateralReceita}
            onSalvar={(dados) => handleSalvarReceita(lateralReceita, dados)}
            onCancelar={() => setLateralReceita(null)}
          />
        </>
      )}

      {/* Lateral: Selecionar talhões */}
      {lateralTalhoes && aplicacaoLateralTalhoes && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setLateralTalhoes(null)} />
          <LateralTalhoes
            talhoes={talhoesProdutor}
            talhaoIdsSelecionados={aplicacaoLateralTalhoes.talhao_ids || []}
            onAplicar={(ids) => handleSalvarTalhoes(lateralTalhoes, ids)}
            onCancelar={() => setLateralTalhoes(null)}
          />
        </>
      )}
    </div>
  );
}