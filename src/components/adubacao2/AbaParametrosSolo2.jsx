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

  // Motivo de bloqueio do salvamento — sempre visível, nunca silencioso.
  const motivoBloqueio = useMemo(() => {
    if (!codigoProdutor) return 'Selecione um produtor no cabeçalho do Adubação 2.0 antes de salvar.';
    if (erros.length > 0) return `Corrija ${erros.length} inconsistência(s): ${erros.map(e => e.nome).join(', ')}.`;
    return '';
  }, [codigoProdutor, erros]);
  const podeSalvar = !motivoBloqueio;

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
        nutrientes: nutrientes.map((n) => ({
          key: n.key,
          nome: n.nome,
          unidade_escolhida: n.unidade_escolhida,
          minimo: n.minimo,
          ideal: n.ideal,
          maximo: n.maximo,
        })),
      };

      // Verificação do payload — garante que dados não estão vazios/nulos.
      console.group('[Adubação via Solo] Salvando parâmetros');
      console.log('Payload enviado:', payload);
      if (!payload.codigo_produtor) throw new Error('Código do produtor ausente.');
      if (!payload.profundidade) throw new Error('Profundidade ausente.');
      if (!Array.isArray(payload.nutrientes) || payload.nutrientes.length === 0) {
        throw new Error('Lista de nutrientes vazia.');
      }

      try {
        let resultado;
        if (existente?.id) {
          console.log('Atualizando registro existente:', existente.id);
          resultado = await base44.entities.ParametrosSolo.update(existente.id, payload);
        } else {
          console.log('Criando novo registro...');
          resultado = await base44.entities.ParametrosSolo.create(payload);
        }
        console.log('Resposta da API:', resultado);
        if (!resultado?.id) throw new Error('A API não retornou um id válido.');
        console.log('Salvo com id:', resultado.id);
        return resultado;
      } catch (erro) {
        console.error('Falha ao persistir ParametrosSolo:', erro, payload);
        throw erro;
      } finally {
        console.groupEnd();
      }
    },
    onSuccess: (resultado) => {
      // Atualiza o cache imediatamente para refletir os dados recém-salvos.
      queryClient.setQueryData(['parametros_solo', codigoProdutor], (atuais = []) => {
        const lista = Array.isArray(atuais) ? atuais : [];
        const idx = lista.findIndex((p) => p.id === resultado.id);
        if (idx >= 0) {
          const next = [...lista];
          next[idx] = { ...next[idx], ...resultado };
          return next;
        }
        return [...lista, resultado];
      });
      queryClient.invalidateQueries({ queryKey: ['parametros_solo', codigoProdutor] });
      toast({ title: 'Parâmetros salvos com sucesso!', description: `Registro ${resultado.id.slice(0,8)} persistido.` });
    },
    onError: (err) => {
      console.error('[Adubação via Solo] onError do mutation:', err);
      toast({
        title: 'Erro ao salvar parâmetros',
        description: String(err?.message || err || 'Falha na API.'),
        variant: 'destructive',
      });
    },
  });

  // Clique sempre responde: se bloqueado, mostra o motivo; senão, salva.
  const handleSalvar = () => {
    if (!podeSalvar) {
      toast({
        title: 'Não foi possível salvar',
        description: motivoBloqueio || 'Verifique os campos e tente novamente.',
        variant: 'destructive',
      });
      return;
    }
    salvarMutation.mutate();
  };

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
        {motivoBloqueio && (
          <p className="text-xs text-red-600 font-medium">
            {motivoBloqueio}
          </p>
        )}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRestaurarPadrao}>
            <RotateCcw className="w-4 h-4" /> Restaurar Padrão
          </Button>
          <Button size="sm" className="gap-1.5" disabled={salvarMutation.isPending} onClick={handleSalvar}>
            <Save className="w-4 h-4" /> {salvarMutation.isPending ? 'Salvando...' : 'Salvar Parâmetros'}
          </Button>
        </div>
      </div>
    </div>
  );
}