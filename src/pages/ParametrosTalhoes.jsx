import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ProdutorSelector from '../components/parametros/ProdutorSelector';
import ProdutorParamsForm from '../components/parametros/ProdutorParamsForm';
import ResumoProdutor from '../components/parametros/ResumoProdutor';
import TalhaoTable from '../components/parametros/TalhaoTable';
import { calcularPlanejamento } from '../lib/calcularPlanejamento';
import { useToast } from '@/components/ui/use-toast';

export default function ParametrosTalhoes() {
  const [produtorSelecionado, setProdutorSelecionado] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: produtores = [] } = useQuery({
    queryKey: ['produtores', 'completo'],
    queryFn: () => base44.entities.Produtor.list(undefined, 5000),
  });

  const { data: talhoes = [], isLoading: loadingTalhoes } = useQuery({
    queryKey: ['talhoes', 'completo'],
    queryFn: () => base44.entities.Talhao.list(undefined, 5000),
  });

  const updateProdutorMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Produtor.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['produtores'] }),
  });

  const updateTalhaoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Talhao.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['talhoes'] }),
  });

  const produtor = useMemo(
    () => produtores.find(p => p.id === produtorSelecionado) || null,
    [produtores, produtorSelecionado]
  );

  const talhoesProdutor = useMemo(
    () => talhoes.filter(t => produtor && t.codigo_produtor === produtor.codigo),
    [talhoes, produtor]
  );

  const planejamento = useMemo(
    () => produtor ? calcularPlanejamento(produtor, talhoesProdutor) : null,
    [produtor, talhoesProdutor]
  );

  const handleSaveParams = useCallback((params) => {
    if (!produtor) return;
    updateProdutorMutation.mutate({ id: produtor.id, data: params });
  }, [produtor, updateProdutorMutation]);

  const handleSaveTalhao = useCallback((talhaoId, data) => {
    if (data.seq_colheita != null) {
      const repetido = talhoesProdutor.some(
        t => t.id !== talhaoId && Number(t.seq_colheita) === Number(data.seq_colheita)
      );
      if (repetido) {
        toast({
          variant: 'destructive',
          title: 'Sequência já utilizada',
          description: `A posição ${data.seq_colheita} já pertence a outro talhão deste produtor.`,
        });
        return;
      }
    }
    updateTalhaoMutation.mutate({ id: talhaoId, data });
  }, [talhoesProdutor, toast, updateTalhaoMutation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Parâmetros e Talhões</h1>
        <p className="text-muted-foreground mt-1">Planejamento de colheita por produtor</p>
      </div>

      {/* Seletor de Produtor */}
      <ProdutorSelector
        produtores={produtores}
        produtorSelecionado={produtorSelecionado}
        onSelect={setProdutorSelecionado}
      />

      {produtor && (
        <>
          {/* Parâmetros do Produtor */}
          <ProdutorParamsForm
            produtor={produtor}
            onSave={handleSaveParams}
            saving={updateProdutorMutation.isPending}
          />

          {/* Resumo */}
          {planejamento && <ResumoProdutor planejamento={planejamento} />}

          {/* Tabela de Talhões */}
          <TalhaoTable
            talhoes={talhoesProdutor}
            planejamento={planejamento}
            produtor={produtor}
            onSaveTalhao={handleSaveTalhao}
            saving={updateTalhaoMutation.isPending}
            loading={loadingTalhoes}
          />
        </>
      )}

      {!produtor && (
        <div className="bg-card rounded-2xl border border-border p-16 text-center text-muted-foreground">
          <p className="text-lg font-medium">Selecione um produtor para iniciar o planejamento</p>
          <p className="text-sm mt-1">Os talhões e cálculos serão carregados automaticamente.</p>
        </div>
      )}
    </div>
  );
}