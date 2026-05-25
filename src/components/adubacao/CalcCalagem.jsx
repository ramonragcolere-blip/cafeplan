import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Send, ChevronDown, Save, Loader2 } from 'lucide-react';

const NIVEIS = {
  Mínimo:    { ca: 3.0, mg: 1.0, k: 0.33 },
  Bom:       { ca: 3.6, mg: 1.2, k: 0.40 },
  Excelente: { ca: 4.5, mg: 1.5, k: 0.50 },
};

const GRUPOS_CORRETIVO = ['Corretivo', 'Condicionador de Solo', 'Fonte de Cálcio', 'Fonte de Magnésio'];

function calcCalagem(caAtual, mgAtual, nivel, produto, area) {
  const meta = NIVEIS[nivel];
  if (!meta) return null;

  const defCa = Math.max(0, meta.ca - (Number(caAtual) || 0));
  const defMg = Math.max(0, meta.mg - (Number(mgAtual) || 0));

  if (!produto) return { defCa, defMg, meta };

  const pctCa = parseFloat(produto.ca_pct) || 0;
  const pctMg = parseFloat(produto.mg_pct) || 0;

  // Fórmula Ca: cmolc fornecida por tonelada = (1000 × %Ca) / 560
  let dosePeloCa = 0;
  if (pctCa > 0 && defCa > 0) {
    const cmolcPorTonCa = (1000 * (pctCa / 100)) / 560;
    dosePeloCa = (defCa / cmolcPorTonCa) * 1000; // kg/ha
  }

  // Fórmula Mg: cmolc fornecida por tonelada = (1000 × %Mg) / 400
  let dosePeloMg = 0;
  if (pctMg > 0 && defMg > 0) {
    const cmolcPorTonMg = (1000 * (pctMg / 100)) / 400;
    dosePeloMg = (defMg / cmolcPorTonMg) * 1000; // kg/ha
  }

  // Dose final = maior valor (nutriente mais limitante)
  const doseFinalHa = Math.max(dosePeloCa, dosePeloMg);

  const totalKg = area > 0 ? doseFinalHa * area : null;
  const ton     = totalKg != null ? totalKg / 1000 : null;
  const sc40    = totalKg != null ? totalKg / 40 : null;
  const sc50    = totalKg != null ? totalKg / 50 : null;

  return {
    defCa, defMg, meta,
    dosePeloCa: Math.round(dosePeloCa),
    dosePeloMg: Math.round(dosePeloMg),
    doseFinalHa: Math.round(doseFinalHa),
    totalKg: totalKg != null ? Math.round(totalKg) : null,
    ton:  ton  != null ? parseFloat(ton.toFixed(3))  : null,
    sc40: sc40 != null ? parseFloat(sc40.toFixed(1)) : null,
    sc50: sc50 != null ? parseFloat(sc50.toFixed(1)) : null,
  };
}

export default function CalcCalagem({ analise, talhao, safraCtx, onEnviarPlanejamento }) {
  const [nivel, setNivel] = useState('Bom');
  const [produtoId, setProdutoId] = useState(null);
  const [dropAberto, setDropAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [registroId, setRegistroId] = useState(null); // ID do registro salvo
  const carregadoRef = useRef(false); // evita sobrescrever após carga inicial

  const queryClient = useQueryClient();

  // Valores armazenados em mmolc/dm³ → converter para cmolc/dm³ para os cálculos (÷10)
  const caAtual = analise?.calcio   != null ? analise.calcio   / 10 : undefined;
  const mgAtual = analise?.magnesio != null ? analise.magnesio / 10 : undefined;
  const kAtual  = analise?.potassio; // mmolc/dm³ — apenas informativo neste componente
  const area    = talhao?.area_ha || 0;

  // analise pode ser null se ainda não foi salva — usar talhao/safraCtx como fallback
  const codigoProdutor = analise?.codigo_produtor || talhao?.codigo_produtor;
  const safra          = analise?.safra || safraCtx;
  const talhaoId       = analise?.talhao_id || talhao?.id;

  // Chave de contexto para detectar mudança de Produtor+Safra+Talhão
  const ctxKey = `${codigoProdutor}|${safra}|${talhaoId}`;

  // Busca registro salvo
  const { data: registrosSalvos = [], isLoading: carregando } = useQuery({
    queryKey: ['recomendacao_calagem', ctxKey],
    queryFn: () => codigoProdutor && safra && talhaoId
      ? base44.entities.BaseRecomendacaoCalagem.filter({ codigo_produtor: codigoProdutor, safra, talhao_id: talhaoId })
      : Promise.resolve([]),
    enabled: !!(codigoProdutor && safra && talhaoId),
  });

  // Carrega estado salvo apenas uma vez por contexto
  useEffect(() => {
    carregadoRef.current = false;
  }, [ctxKey]);

  useEffect(() => {
    if (carregadoRef.current) return;
    if (carregando) return;
    const reg = registrosSalvos[0];
    if (reg) {
      setNivel(reg.meta || 'Bom');
      setProdutoId(reg.produto_id || null);
      setObservacoes(reg.observacoes || '');
      setRegistroId(reg.id);
    }
    carregadoRef.current = true;
  }, [registrosSalvos, carregando]);

  const { mutate: salvar, isPending: salvando } = useMutation({
    mutationFn: async (dados) => {
      if (registroId) {
        return base44.entities.BaseRecomendacaoCalagem.update(registroId, dados);
      } else {
        return base44.entities.BaseRecomendacaoCalagem.create(dados);
      }
    },
    onSuccess: (res) => {
      if (!registroId && res?.id) setRegistroId(res.id);
      queryClient.invalidateQueries({ queryKey: ['recomendacao_calagem', ctxKey] });
    },
  });

  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples = [] }  = useQuery({ queryKey: ['fontes_simples'],  queryFn: () => base44.entities.FonteSimples.list() });

  const corretivos = useMemo(() => {
    const ferts = fertilizantes
      .filter(f => GRUPOS_CORRETIVO.some(g => (f.grupo || '').includes(g)) || (f.ca_pct > 0 || f.mg_pct > 0))
      .map(f => ({ ...f, _tipo: 'formulado' }));
    const fontes = fontesSimples
      .filter(f => f.ca_pct > 0 || f.mg_pct > 0)
      .map(f => ({ ...f, _tipo: 'fonte' }));
    return [...ferts, ...fontes];
  }, [fertilizantes, fontesSimples]);

  const corretivosVisiveis = useMemo(() => {
    const q = busca.toLowerCase();
    return corretivos.filter(p =>
      (p.nome || '').toLowerCase().includes(q) || (p.fornecedor || '').toLowerCase().includes(q)
    );
  }, [corretivos, busca]);

  const produto = useMemo(() => corretivos.find(p => p.id === produtoId) || null, [corretivos, produtoId]);
  const resultado = useMemo(() => calcCalagem(caAtual, mgAtual, nivel, produto, area), [caAtual, mgAtual, nivel, produto, area]);
  const meta = NIVEIS[nivel];

  const { mutate: enviarPlanejamento, isPending: enviando } = useMutation({
    mutationFn: async () => {
      if (!resultado || !produto) return;
      const temCa = (produto.ca_pct || 0) > 0;
      const temMg = (produto.mg_pct || 0) > 0;
      const nutriLabel = temCa && temMg ? 'Ca+Mg' : temCa ? 'Ca' : 'Mg';

      const payload = {
        codigo_produtor: codigoProdutor,
        safra,
        talhao_id: talhaoId,
        talhao_nome: talhao?.nome || '',
        nutriente_key: 'calagem',
        nutriente_label: `Calagem (${nutriLabel})`,
        produto_id: produto.id,
        produto_nome: produto.nome,
        dose_rec_manual: String(resultado.doseFinalHa),
        num_aplic: 1,
        pcts: [100],
        meses: [[]],
        observacoes: `Meta: ${nivel} | Dose Ca: ${resultado.dosePeloCa ?? 0} kg/ha | Dose Mg: ${resultado.dosePeloMg ?? 0} kg/ha | Total: ${resultado.totalKg ?? '—'} kg`,
        status: 'planejado',
      };

      const existentes = await base44.entities.BasePlanejamentoAdubacao.filter({
        codigo_produtor: codigoProdutor,
        safra,
        talhao_id: talhaoId,
        nutriente_key: 'calagem',
      });

      if (existentes?.length > 0) {
        return base44.entities.BasePlanejamentoAdubacao.update(existentes[0].id, payload);
      } else {
        return base44.entities.BasePlanejamentoAdubacao.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['base_planejamento'] });
      handleSalvar();
      if (onEnviarPlanejamento) onEnviarPlanejamento({ tipo: 'calagem' });
    },
  });

  const semAnalise = caAtual == null && mgAtual == null;
  if (semAnalise) return null;

  const handleSalvar = () => {
    salvar({
      codigo_produtor: codigoProdutor,
      safra,
      talhao_id: talhaoId,
      talhao_nome: talhao?.nome || analise?.talhao_nome || '',
      meta: nivel,
      produto_id: produtoId || '',
      produto_nome: produto?.nome || '',
      ca_atual: caAtual ?? null,
      mg_atual: mgAtual ?? null,
      k_atual: kAtual ?? null,
      deficit_ca: resultado?.defCa ?? null,
      deficit_mg: resultado?.defMg ?? null,
      dose_kg_ha: resultado?.doseFinalHa ?? null,
      dose_total_kg: resultado?.totalKg ?? null,
      observacoes,
    });
  };

  const handleEnviar = () => {
    if (!resultado || !produto || !codigoProdutor || !safra || !talhaoId) return;
    enviarPlanejamento();
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-lime-50 border-b border-border">
        <span className="font-semibold text-sm text-lime-800">Calagem — Elevação de Bases (Ca e Mg)</span>
      </div>

      <div className="p-5 space-y-5">
        {/* Nível alvo */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Nível alvo:</span>
          {Object.keys(NIVEIS).map(n => (
            <button key={n} type="button"
              onClick={() => setNivel(n)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors font-medium ${nivel === n ? 'bg-lime-700 text-white border-lime-700' : 'bg-white text-muted-foreground border-border hover:bg-lime-50'}`}>
              {n}
            </button>
          ))}
        </div>

        {/* Tabela de situação atual vs meta */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 pr-4 text-xs font-semibold text-muted-foreground uppercase">Nutriente</th>
                <th className="text-right py-1.5 px-3 text-xs font-semibold text-muted-foreground uppercase">Atual</th>
                <th className="text-right py-1.5 px-3 text-xs font-semibold text-muted-foreground uppercase">Meta ({nivel})</th>
                <th className="text-right py-1.5 px-3 text-xs font-semibold text-muted-foreground uppercase">Déficit</th>
                <th className="text-right py-1.5 pl-3 text-xs font-semibold text-muted-foreground uppercase">Situação</th>
              </tr>
            </thead>
            <tbody>
              {/* Ca */}
              <tr className="border-b border-border/40">
                <td className="py-2 pr-4 font-medium">Ca (cmolc/dm³)</td>
                <td className="text-right px-3">{caAtual != null ? caAtual.toFixed(2) : '—'}</td>
                <td className="text-right px-3">{meta.ca}</td>
                <td className={`text-right px-3 font-semibold ${resultado?.defCa > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {resultado ? (resultado.defCa > 0 ? `−${resultado.defCa.toFixed(2)}` : '✓') : '—'}
                </td>
                <td className="text-right pl-3 font-semibold">
                  {resultado ? (resultado.defCa > 0 ? `déficit: ${resultado.defCa.toFixed(2)} cmolc` : 'Sem déficit') : '—'}
                </td>
              </tr>
              {/* Mg */}
              <tr className="border-b border-border/40">
                <td className="py-2 pr-4 font-medium">Mg (cmolc/dm³)</td>
                <td className="text-right px-3">{mgAtual != null ? mgAtual.toFixed(2) : '—'}</td>
                <td className="text-right px-3">{meta.mg}</td>
                <td className={`text-right px-3 font-semibold ${resultado?.defMg > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {resultado ? (resultado.defMg > 0 ? `−${resultado.defMg.toFixed(2)}` : '✓') : '—'}
                </td>
                <td className="text-right pl-3 font-semibold">
                  {resultado ? (resultado.defMg > 0 ? `déficit: ${resultado.defMg.toFixed(2)} cmolc` : 'Sem déficit') : '—'}
                </td>
              </tr>
              {/* K — apenas informativo */}
              <tr>
                <td className="py-2 pr-4 font-medium text-muted-foreground">K — equilíbrio (mmolc/dm³)</td>
                <td className="text-right px-3 text-muted-foreground">{kAtual != null ? kAtual : '—'}</td>
                <td className="text-right px-3 text-muted-foreground">{(meta.k * 10).toFixed(1)} <span className="text-xs">(≈{meta.k} cmolc)</span></td>
                <td className="text-right px-3 text-muted-foreground text-xs italic">informativo</td>
                <td className="text-right pl-3 text-muted-foreground text-xs italic">não gera dose</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Seletor de fonte corretiva — sempre visível */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fonte corretiva</p>
          <div className="relative w-full">
            <button type="button"
              className="w-full h-10 text-sm border border-input rounded-md px-3 text-left flex items-center justify-between bg-transparent hover:bg-muted/30"
              onClick={() => setDropAberto(a => !a)}>
              <span className={produto ? 'text-foreground' : 'text-muted-foreground'}>
                {produto ? produto.nome : 'Selecionar produto...'}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground ml-1 shrink-0" />
            </button>
            {dropAberto && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl overflow-hidden min-w-[320px]">
                <div className="p-2 border-b border-border">
                  <input autoFocus
                    className="w-full h-9 text-sm border border-input rounded px-3 bg-background"
                    placeholder="Buscar corretivo..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                  />
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <button type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/60 text-sm border-b border-border/30 text-muted-foreground"
                    onClick={() => { setProdutoId(null); setDropAberto(false); setBusca(''); }}>
                    — Nenhum produto —
                  </button>
                  {corretivosVisiveis.map(p => (
                    <button key={p.id} type="button"
                      className="w-full text-left px-4 py-3 hover:bg-muted/60 border-b border-border/30 last:border-0"
                      onClick={() => { setProdutoId(p.id); setDropAberto(false); setBusca(''); }}>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-medium leading-snug">{p.nome}</span>
                        <span className="text-muted-foreground text-xs whitespace-nowrap shrink-0 mt-0.5">
                          {p.ca_pct > 0 ? `Ca: ${p.ca_pct}%` : ''}{p.ca_pct > 0 && p.mg_pct > 0 ? ' · ' : ''}{p.mg_pct > 0 ? `Mg: ${p.mg_pct}%` : ''}
                        </span>
                      </div>
                      {p.fornecedor && <div className="text-xs text-muted-foreground mt-0.5">{p.fornecedor}</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {produto && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {produto.ca_pct > 0 && <span className="bg-lime-100 text-lime-700 px-2 py-0.5 rounded-full font-medium">Ca: {produto.ca_pct}%</span>}
              {produto.mg_pct > 0 && <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">Mg: {produto.mg_pct}%</span>}
            </div>
          )}
        </div>

        {/* Sem déficit */}
        {resultado && resultado.defCa === 0 && resultado.defMg === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 font-medium">
            ✓ Ca e Mg estão dentro ou acima da meta "{nivel}". Sem déficit — calagem não necessária.
          </div>
        )}

        {/* Resultado com produto */}
        {resultado && produto && resultado.doseFinalHa > 0 && (
          <div className="bg-lime-50 border border-lime-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-lime-800 uppercase tracking-wide">Resultado — {produto.nome}</p>

            {/* Decomposição por nutriente */}
            <div className="text-sm space-y-1 border-b border-lime-200 pb-3">
              {resultado.dosePeloCa > 0
                ? <div>Dose pelo Ca: <strong>{resultado.dosePeloCa} kg/ha</strong></div>
                : <div className="text-muted-foreground">Dose pelo Ca: sem déficit</div>
              }
              {resultado.dosePeloMg > 0
                ? <div>Dose pelo Mg: <strong>{resultado.dosePeloMg} kg/ha</strong></div>
                : <div className="text-muted-foreground">Dose pelo Mg: sem déficit</div>
              }
              <div className="font-semibold text-lime-800">
                Dose recomendada: {resultado.doseFinalHa} kg/ha
                <span className="font-normal text-xs text-muted-foreground ml-1">(limitada pelo nutriente mais deficitário)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg p-2.5 text-center border border-lime-100">
                <p className="text-xs text-muted-foreground">Dose produto</p>
                <p className="font-bold text-base">{resultado.doseFinalHa} <span className="text-xs font-normal">kg/ha</span></p>
              </div>
              {resultado.totalKg != null && (
                <div className="bg-white rounded-lg p-2.5 text-center border border-lime-100">
                  <p className="text-xs text-muted-foreground">Total talhão</p>
                  <p className="font-bold text-base">{resultado.totalKg.toLocaleString()} <span className="text-xs font-normal">kg</span></p>
                </div>
              )}
              {resultado.ton != null && (
                <div className="bg-white rounded-lg p-2.5 text-center border border-lime-100">
                  <p className="text-xs text-muted-foreground">Toneladas</p>
                  <p className="font-bold text-base">{resultado.ton} <span className="text-xs font-normal">t</span></p>
                </div>
              )}
              {resultado.sc40 != null && (
                <div className="bg-white rounded-lg p-2.5 text-center border border-lime-100">
                  <p className="text-xs text-muted-foreground">Sacos 40 kg</p>
                  <p className="font-bold text-base">{resultado.sc40} <span className="text-xs font-normal">sc</span></p>
                </div>
              )}
              {resultado.sc50 != null && (
                <div className="bg-white rounded-lg p-2.5 text-center border border-lime-100">
                  <p className="text-xs text-muted-foreground">Sacos 50 kg</p>
                  <p className="font-bold text-base">{resultado.sc50} <span className="text-xs font-normal">sc</span></p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={handleSalvar} disabled={salvando} className="gap-2">
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar recomendação
              </Button>
              <Button size="sm" onClick={handleEnviar} disabled={enviando || !codigoProdutor || !safra || !talhaoId} className="gap-2 bg-lime-700 hover:bg-lime-800">
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar para Planejamento
              </Button>
            </div>
          </div>
        )}

        {/* Botão salvar mesmo sem produto selecionado (persiste meta e observações) */}
        {resultado && (!produto || resultado.doseFinalHa === 0) && codigoProdutor && safra && talhaoId && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={handleSalvar} disabled={salvando} className="gap-2">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}