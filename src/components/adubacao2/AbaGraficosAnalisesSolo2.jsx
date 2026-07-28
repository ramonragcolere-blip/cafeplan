import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  NUTRIENTES_GRAFICOS_SOLO,
  NUTRIENTES_PADRAO_TODOS_TALHOES,
  PROFUNDIDADES_ANALISE_SOLO,
  gerarSvgAdequacaoSolo,
  gerarSvgComparacaoTalhoesSolo,
  gerarSvgEvolucaoSolo,
  montarAdequacaoSafraAtual,
  montarComparacaoTalhoesSafraAtual,
  montarSerieEvolucaoAnalises,
  montarSeriesTodosElementosEvolucao,
} from '@/lib/graficosAnalisesSoloAdubacao2';

function coletarSafras(analises020 = [], analises2040 = [], talhaoId = null) {
  return [...new Set([...analises020, ...analises2040]
    .filter(analise => !talhaoId || analise?.talhao_id === talhaoId)
    .map(analise => analise?.safra)
    .filter(Boolean))]
    .sort();
}

export default function AbaGraficosAnalisesSolo2({ talhoes = [], analises020 = [], analises2040 = [], safraAtual }) {
  const [talhaoId, setTalhaoId] = useState('');
  const [profundidade, setProfundidade] = useState('0-20');
  const [nutriente, setNutriente] = useState('magnesio');
  const [safrasSelecionadas, setSafrasSelecionadas] = useState([]);
  const [modoVisualizacao, setModoVisualizacao] = useState('talhao_individual');
  const [nutrientesTalhoes, setNutrientesTalhoes] = useState(NUTRIENTES_PADRAO_TODOS_TALHOES);

  useEffect(() => {
    if (talhoes.length === 0) {
      setTalhaoId('');
      return;
    }
    setTalhaoId(prev => talhoes.some(t => t.id === prev) ? prev : talhoes[0].id);
  }, [talhoes]);

  const safrasDisponiveis = useMemo(() => coletarSafras(analises020, analises2040, talhaoId), [analises020, analises2040, talhaoId]);

  useEffect(() => {
    setSafrasSelecionadas(prev => {
      const existentes = prev.filter(safra => safrasDisponiveis.includes(safra));
      if (existentes.length > 0) return existentes;
      if (safraAtual && safrasDisponiveis.includes(safraAtual)) return [safraAtual];
      return safrasDisponiveis.slice(-3);
    });
  }, [safrasDisponiveis, safraAtual]);

  const adequacao = useMemo(() => montarAdequacaoSafraAtual({
    analises020,
    analises2040,
    talhaoId,
    safra: safraAtual,
    profundidade,
  }), [analises020, analises2040, talhaoId, safraAtual, profundidade]);

  const serie = useMemo(() => montarSerieEvolucaoAnalises({
    analises020,
    analises2040,
    talhaoId,
    nutriente,
    profundidade,
    safras: safrasSelecionadas,
  }), [analises020, analises2040, talhaoId, nutriente, profundidade, safrasSelecionadas]);

  const seriesTodosElementos = useMemo(() => montarSeriesTodosElementosEvolucao({
    analises020,
    analises2040,
    talhaoId,
    profundidade,
    safras: safrasSelecionadas,
  }), [analises020, analises2040, talhaoId, profundidade, safrasSelecionadas]);

  const comparacaoTalhoes = useMemo(() => montarComparacaoTalhoesSafraAtual({
    talhoes,
    analises020,
    analises2040,
    safra: safraAtual,
    profundidade,
    nutrientes: nutrientesTalhoes,
  }), [talhoes, analises020, analises2040, safraAtual, profundidade, nutrientesTalhoes]);

  const svgAdequacao = useMemo(() => gerarSvgAdequacaoSolo(adequacao), [adequacao]);
  const svgEvolucao = useMemo(() => gerarSvgEvolucaoSolo(serie), [serie]);
  const svgComparacaoTalhoes = useMemo(() => gerarSvgComparacaoTalhoesSolo(comparacaoTalhoes), [comparacaoTalhoes]);
  const talhao = talhoes.find(t => t.id === talhaoId);

  const alternarSafra = (safra) => {
    setSafrasSelecionadas(prev => prev.includes(safra)
      ? prev.filter(item => item !== safra)
      : [...prev, safra].sort());
  };

  const alternarNutrienteTalhoes = (key) => {
    setNutrientesTalhoes(prev => prev.includes(key)
      ? prev.filter(item => item !== key)
      : [...prev, key]);
  };

  if (talhoes.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p>Selecione um produtor com talhões para visualizar os gráficos.</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Gráficos das Análises de Solo</p>
        <span className="text-xs text-muted-foreground">Safra atual {safraAtual}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Modo de visualização</Label>
          <Select value={modoVisualizacao} onValueChange={setModoVisualizacao}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="talhao_individual">Talhão individual</SelectItem>
              <SelectItem value="todos_talhoes">Todos os talhões</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {modoVisualizacao === 'talhao_individual' && (
        <div>
          <Label className="text-xs mb-1 block">Talhão</Label>
          <Select value={talhaoId} onValueChange={setTalhaoId}>
            <SelectTrigger><SelectValue placeholder="Talhão" /></SelectTrigger>
            <SelectContent>
              {talhoes.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        )}
        <div>
          <Label className="text-xs mb-1 block">Profundidade</Label>
          <Select value={profundidade} onValueChange={setProfundidade}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROFUNDIDADES_ANALISE_SOLO.map(item => <SelectItem key={item} value={item}>{item} cm</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {modoVisualizacao === 'talhao_individual' && (
        <div>
          <Label className="text-xs mb-1 block">Nutriente</Label>
          <Select value={nutriente} onValueChange={setNutriente}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos_elementos">Todos os elementos</SelectItem>
              {NUTRIENTES_GRAFICOS_SOLO.map(item => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        )}
        {modoVisualizacao === 'todos_talhoes' && (
          <div className="sm:col-span-2">
            <Label className="text-xs mb-1 block">Nutrientes</Label>
            <div className="min-h-10 rounded-md border border-input bg-background px-2 py-1.5 flex flex-wrap gap-1">
              {NUTRIENTES_GRAFICOS_SOLO.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => alternarNutrienteTalhoes(item.key)}
                  className={`text-[11px] rounded-full border px-2 py-0.5 ${nutrientesTalhoes.includes(item.key) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {modoVisualizacao === 'talhao_individual' && (
        <div>
          <Label className="text-xs mb-1 block">Safras comparadas</Label>
          <div className="min-h-10 rounded-md border border-input bg-background px-2 py-1.5 flex flex-wrap gap-1">
            {safrasDisponiveis.length === 0 ? (
              <span className="text-xs text-muted-foreground px-1 py-1">Sem safras disponíveis</span>
            ) : safrasDisponiveis.map(safra => (
              <button
                key={safra}
                type="button"
                onClick={() => alternarSafra(safra)}
                className={`text-[11px] rounded-full border px-2 py-0.5 ${safrasSelecionadas.includes(safra) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border'}`}
              >
                {safra}
              </button>
            ))}
          </div>
        </div>
        )}
      </div>

      {modoVisualizacao === 'todos_talhoes' ? (
        <section className="rounded-xl border border-border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20">
            <h3 className="text-sm font-bold">Todos os talhões</h3>
            <p className="text-xs text-muted-foreground">Safra {safraAtual} · {profundidade} cm · Índice de adequação</p>
          </div>
          <div className="overflow-x-auto p-3">
            <div className="min-w-[680px]" dangerouslySetInnerHTML={{ __html: svgComparacaoTalhoes }} />
          </div>
        </section>
      ) : (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="rounded-xl border border-border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20">
            <h3 className="text-sm font-bold">Situação da Safra Atual</h3>
            <p className="text-xs text-muted-foreground">{talhao?.nome || 'Talhão'} · {profundidade} cm · Safra {safraAtual}</p>
          </div>
          <div className="overflow-x-auto p-3">
            <div className="min-w-[680px]" dangerouslySetInnerHTML={{ __html: svgAdequacao }} />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20">
            <h3 className="text-sm font-bold">Comparação entre Safras</h3>
            <p className="text-xs text-muted-foreground">{talhao?.nome || 'Talhão'} · {nutriente === 'todos_elementos' ? 'Todos os elementos' : serie.label} · {profundidade} cm</p>
          </div>
          {nutriente === 'todos_elementos' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
              {seriesTodosElementos.map(item => (
                <div key={item.nutriente} className="overflow-x-auto rounded-lg border border-border">
                  <div className="min-w-[360px]" dangerouslySetInnerHTML={{ __html: gerarSvgEvolucaoSolo(item, { largura: 360, altura: 220 }) }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto p-3">
              <div className="min-w-[680px]" dangerouslySetInnerHTML={{ __html: svgEvolucao }} />
            </div>
          )}
          {nutriente !== 'todos_elementos' && !serie.temHistoricoSuficiente && (
            <p className="px-4 pb-4 text-xs text-amber-700">
              Não há histórico suficiente para comparar esta seleção.
            </p>
          )}
        </section>
      </div>
      )}
    </div>
  );
}
