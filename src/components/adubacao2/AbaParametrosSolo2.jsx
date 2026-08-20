import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Save, RotateCcw, Layers } from 'lucide-react';
import ResumoHistoricoAnalises from './ResumoHistoricoAnalises';
import TabelaParametrizacaoSolo from './TabelaParametrizacaoSolo';
import { montarNutrientesPadrao, validarParametros } from '@/lib/parametrosSoloDefault';

const PROFUNDIDADES = [
  { value: '0-20', label: '0 a 20 cm' },
  { value: '20-40', label: '20 a 40 cm' },
  { value: '0-40', label: '0 a 40 cm (Combinado)' },
];

function toNum(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Aba "Adubação via Solo" — isolada, sem tocar lógica das demais abas.
export default function AbaParametrosSolo2({ talhoes = [], analises020 = [], analises2040 = [], produtor, safra }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [talhaoId, setTalhaoId] = useState('');
  const [profundidade, setProfundidade] = useState('0-20');
  const [nutrientes, setNutrientes] = useState(() => montarNutrientesPadrao('0-20'));

  const codigoProdutor = produtor?.codigo || '';

  const { data: paramsDb = [] } = useQuery({
    queryKey: ['parametros_solo', codigoProdutor],
    queryFn: () => base44.entities.ParametrosSolo.list(undefined, 5000),
    enabled: !!codigoProdutor,
  });

  // Carrega parâmetros salvos ao mudar talhão/profundidade.
  useEffect(() => {
    if (!codigoProdutor) return;
    const registro = (paramsDb || []).find(
      (p) => p.codigo_produtor === codigoProdutor &&
             (p.talhao_id || '') === (talhaoId || '') &&
             p.profundidade === profundidade,
    );
    if (registro?.nutrientes?.length) {
      setNutrientes(registro.nutrientes);
    } else {
      setNutrientes(montarNutrientesPadrao(profundidade));
    }
  }, [paramsDb, codigoProdutor, talhaoId, profundidade]);

  const analisesTalhao = useMemo(() => {
    const analises = (talhaoId ? analises020 : []).filter(a => a.talhao_id === talhaoId);
    const profundidade2040 = profundidade !== '0-20' ? analises2040.filter(a => a.talhao_id === talhaoId) : [];
    return [...analises, ...profundidade2040];
  }, [analises020, analises2040, talhaoId, profundidade]);

  const erros = useMemo(() => validarParametros(nutrientes), [nutrientes]);
  const podeSalvar = erros.length === 0 && !!codigoProdutor;

  const handleChange = useCallback((key, campo, valor) => {
    setNutrientes((prev) => prev.map((n) => {
      if (n.key !== key) return n;
      const next = { ...n };
      if (campo === 'unidade_escolhida') next[campo] = valor;
      else next[campo] = toNum(valor);
      return next;
    }));
  }, []);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const existente = (paramsDb || []).find(
        (p) => p.codigo_produtor === codigoProdutor &&
               (p.talhao_id || '') === (talhaoId || '') &&
               p.profundidade === profundidade,
      );
      const payload = {
        codigo_produtor: codigoProdutor,
        talhao_id: talhaoId || '',
        talhao_nome: talhoes.find((t) => t.id === talhaoId)?.nome || '',
        safra: safra || '',
        profundidade,
        nutrientes,
      };
      if (existente?.id) return base44.entities.ParametrosSolo.update(existente.id, payload);
      return base44.entities.ParametrosSolo.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parametros_solo', codigoProdutor] });
      toast({ title: 'Parâmetros salvos', description: 'Configuração de interpretação do solo persistida.' });
    },
    onError: () => toast({ title: 'Erro ao salvar', variant: 'destructive' }),
  });

  const handleRestaurarPadrao = () => {
    setNutrientes(montarNutrientesPadrao(profundidade));
    toast({ title: 'Padrão restaurado', description: 'Valores agronômicos médios recarregados.' });
  };

  return (
    <div className="space-y-4">
      {/* Seletores */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs mb-1 block">Talhão / Área</Label>
            <Select value={talhaoId || 'all'} onValueChange={(v) => setTalhaoId(v === 'all' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Todos (fazenda)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos (fazenda)</SelectItem>
                {talhoes.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block flex items-center gap-1"><Layers className="w-3 h-3" /> Profundidade</Label>
            <div className="flex flex-wrap gap-4 pt-1.5">
              {PROFUNDIDADES.map((p) => (
                <label key={p.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="profundidade-solo" value={p.value} checked={profundidade === p.value}
                    onChange={() => setProfundidade(p.value)} className="accent-primary" />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Resumo histórico */}
      <ResumoHistoricoAnalises
        talhaoNome={talhoes.find((t) => t.id === talhaoId)?.nome || 'Todos'}
        analisesTalhao={analisesTalhao}
      />

      {/* Tabela de parametrização */}
      <TabelaParametrizacaoSolo nutrientes={nutrientes} erros={erros} onChange={handleChange} />

      {/* Ações */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {erros.length > 0 && (
          <p className="text-xs text-red-600">Corrija {erros.length} inconsistência(s) antes de salvar.</p>
        )}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRestaurarPadrao}>
            <RotateCcw className="w-4 h-4" /> Restaurar Padrão
          </Button>
          <Button size="sm" className="gap-1.5" disabled={!podeSalvar || salvarMutation.isPending}
            onClick={() => salvarMutation.mutate()}>
            <Save className="w-4 h-4" /> {salvarMutation.isPending ? 'Salvando...' : 'Salvar Parâmetros'}
          </Button>
        </div>
      </div>
    </div>
  );
}