import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronRight, Loader2, Mountain, Save } from 'lucide-react';
import { produtoValidoAdubacao2 } from '@/lib/planejamentoProdutosAdubacao2';
import {
  ALERTA_LIXIVIACAO_GESSAGEM,
  ORIENTACAO_APLICACAO_GESSAGEM,
  atualizarListaGessagens,
  calcularCustoGessagem,
  calcularFornecimentoGesso,
  calcularRecomendacaoGessagem,
  formatarPrecoUnitarioGessagem,
  montarPayloadGessagem,
  normalizarCalagemParaGessagem,
  normalizarNumeroGessagem,
  selecionarDoseMetodoGessagem,
  selecionarRegistroGessagem,
} from '@/lib/gessagemAdubacao2';

const fmt = (valor, dec = 1) => valor != null ? Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—';
const fmtKg = valor => valor != null ? `${fmt(valor, 0)} kg/ha` : '—';
const fmtT = valor => valor != null ? `${fmt(valor, 1)} t/ha` : '—';
const fmtR = valor => valor != null ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

function produtoPareceGesso(produto) {
  const texto = `${produto?.nome || ''} ${produto?.grupo || ''} ${produto?.nutriente_principal || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /gesso|condicionador|sulfato de calcio|fonte de enxofre/.test(texto) ||
    (normalizarNumeroGessagem(produto?.ca_pct) > 0 && normalizarNumeroGessagem(produto?.s_pct) > 0);
}

function selecionarProdutoInicial(produtos, produtoId) {
  return produtos.find(p => p.id === produtoId) || null;
}

function CardGessagem({ talhao, analise2040, calagem, safra, codigoProdutor, produtos, todosProdutos }) {
  const [expandido, setExpandido] = useState(false);
  const [produtoId, setProdutoId] = useState('');
  const [argilaManual, setArgilaManual] = useState('');
  const [doseCalcario, setDoseCalcario] = useState('');
  const [caoCalcario, setCaoCalcario] = useState('');
  const [caoGesso, setCaoGesso] = useState('25');
  const [metodoCalculo, setMetodoCalculo] = useState('combinado_conservador');
  const [faixa5aPosicao, setFaixa5aPosicao] = useState('media');
  const [aplicarSemIndicacao, setAplicarSemIndicacao] = useState(false);
  const [edicaoManualCalagem, setEdicaoManualCalagem] = useState(false);
  const [doseFinal, setDoseFinal] = useState('');
  const [precoUnitario, setPrecoUnitario] = useState('');
  const [unidadePreco, setUnidadePreco] = useState('t');
  const [observacoes, setObservacoes] = useState('');
  const carregadoRef = useRef(false);
  const registroIdRef = useRef(null);
  const filaSalvamentoRef = useRef(Promise.resolve());
  const queryClient = useQueryClient();
  const ctxKey = `${codigoProdutor}|${safra}|${talhao.id}`;

  const { data: registrosSalvos = [], isLoading: carregando } = useQuery({
    queryKey: ['recomendacao_gessagem', ctxKey],
    queryFn: () => codigoProdutor && safra && talhao.id
      ? base44.entities.BaseRecomendacaoGessagem.filter({ codigo_produtor: codigoProdutor, safra, talhao_id: talhao.id })
      : Promise.resolve([]),
    enabled: !!(codigoProdutor && safra && talhao.id),
  });

  const { data: calagensDiretas = [], isLoading: carregandoCalagem } = useQuery({
    queryKey: ['recomendacao_calagem', ctxKey],
    queryFn: () => codigoProdutor && safra && talhao.id
      ? base44.entities.BaseRecomendacaoCalagem.filter({ codigo_produtor: codigoProdutor, safra, talhao_id: talhao.id })
      : Promise.resolve([]),
    enabled: !!(codigoProdutor && safra && talhao.id),
  });

  const calagemImportada = useMemo(() => normalizarCalagemParaGessagem({
    calagens: [...(calagensDiretas || []), ...(calagem ? [calagem] : [])],
    produtos: todosProdutos,
    codigoProdutor,
    safra,
    talhaoId: talhao.id,
  }), [calagensDiretas, calagem, todosProdutos, codigoProdutor, safra, talhao.id]);

  useEffect(() => {
    carregadoRef.current = false;
    registroIdRef.current = null;
    setProdutoId('');
    setArgilaManual('');
    setDoseCalcario('');
    setCaoCalcario('');
    setCaoGesso('25');
    setMetodoCalculo('combinado_conservador');
    setFaixa5aPosicao('media');
    setAplicarSemIndicacao(false);
    setEdicaoManualCalagem(false);
    setDoseFinal('');
    setPrecoUnitario('');
    setUnidadePreco('t');
    setObservacoes('');
  }, [ctxKey]);

  useEffect(() => {
    if (edicaoManualCalagem || carregandoCalagem) return;
    if (!calagemImportada) return;
    setDoseCalcario(calagemImportada.doseCalcarioKgHa != null ? String(calagemImportada.doseCalcarioKgHa) : '');
    setCaoCalcario(calagemImportada.caoCalcarioPct != null ? String(calagemImportada.caoCalcarioPct) : '');
  }, [calagemImportada, edicaoManualCalagem, carregandoCalagem]);

  useEffect(() => {
    if (carregadoRef.current || carregando) return;
    const reg = selecionarRegistroGessagem(registrosSalvos);
    if (reg) {
      registroIdRef.current = reg.id;
      setProdutoId(reg.produto_id || '');
      setArgilaManual(reg.argila_pct != null ? String(reg.argila_pct) : '');
      if (!calagemImportada) {
        setDoseCalcario(reg.dose_calcario_kg_ha != null ? String(reg.dose_calcario_kg_ha) : '');
        setCaoCalcario(reg.cao_calcario_pct != null ? String(reg.cao_calcario_pct) : '');
      }
      setCaoGesso(reg.cao_gesso_pct != null ? String(reg.cao_gesso_pct) : '25');
      setMetodoCalculo(reg.metodo_calculo || 'combinado_conservador');
      setFaixa5aPosicao(reg.faixa_5a_posicao || 'media');
      setAplicarSemIndicacao(Boolean(reg.aplicar_sem_indicacao_tecnica));
      setDoseFinal(reg.dose_final_kg_ha != null ? String(reg.dose_final_kg_ha) : '');
      setPrecoUnitario(reg.preco_unitario != null ? String(reg.preco_unitario) : '');
      setUnidadePreco(reg.unidade_preco === 'kg' ? 'kg' : 't');
      setObservacoes(reg.observacoes || '');
    }
    carregadoRef.current = true;
  }, [registrosSalvos, carregando, calagemImportada]);

  const produto = useMemo(() => selecionarProdutoInicial(produtos, produtoId), [produtos, produtoId]);
  const recomendacao = useMemo(() => calcularRecomendacaoGessagem({
    talhao,
    analise2040,
    argilaManual,
    doseCalcarioKgHa: doseCalcario,
    caoCalcarioPct: caoCalcario,
    caoGessoPct: caoGesso,
  }), [talhao, analise2040, argilaManual, doseCalcario, caoCalcario, caoGesso]);

  const escolhaDose = useMemo(() => selecionarDoseMetodoGessagem({
    recomendacao,
    metodoCalculo,
    faixa5aPosicao,
    doseManualKgHa: doseFinal,
    aplicarSemIndicacao,
  }), [recomendacao, metodoCalculo, faixa5aPosicao, doseFinal, aplicarSemIndicacao]);

  useEffect(() => {
    if (metodoCalculo === 'dose_manual') return;
    if (escolhaDose.doseFinalKgHa == null) {
      if (!recomendacao.indicada) setDoseFinal('');
      return;
    }
    setDoseFinal(String(escolhaDose.doseFinalKgHa));
  }, [metodoCalculo, escolhaDose.doseFinalKgHa, recomendacao.indicada]);

  const doseFinalNum = normalizarNumeroGessagem(doseFinal) ?? escolhaDose.doseFinalKgHa;
  const custo = useMemo(() => calcularCustoGessagem({
    doseKgHa: doseFinalNum,
    areaHa: talhao.area_ha,
    precoUnitario,
    unidadePreco,
  }), [doseFinalNum, talhao.area_ha, precoUnitario, unidadePreco]);
  const fornecimento = useMemo(() => calcularFornecimentoGesso({ produto, doseKgHa: doseFinalNum }), [produto, doseFinalNum]);
  const precoInvalido = precoUnitario !== '' && (normalizarNumeroGessagem(precoUnitario) == null || normalizarNumeroGessagem(precoUnitario) < 0);
  const podeSalvar = !!codigoProdutor && !!safra && (doseFinalNum == null || doseFinalNum >= 0) && !precoInvalido;

  const { mutate: salvar, isPending: salvando } = useMutation({
    mutationFn: async (payload) => {
      const tarefa = filaSalvamentoRef.current.catch(() => undefined).then(async () => {
        if (registroIdRef.current) return base44.entities.BaseRecomendacaoGessagem.update(registroIdRef.current, payload);
        const existentes = await base44.entities.BaseRecomendacaoGessagem.filter({
          codigo_produtor: payload.codigo_produtor,
          safra: payload.safra,
          talhao_id: payload.talhao_id,
        });
        const existente = selecionarRegistroGessagem(existentes);
        if (existente?.id) {
          registroIdRef.current = existente.id;
          return base44.entities.BaseRecomendacaoGessagem.update(existente.id, payload);
        }
        const criado = await base44.entities.BaseRecomendacaoGessagem.create(payload);
        if (criado?.id) registroIdRef.current = criado.id;
        return criado;
      });
      filaSalvamentoRef.current = tarefa;
      return tarefa;
    },
    onSuccess: (res, payload) => {
      const atualizado = { ...payload, ...(res || {}), id: res?.id || registroIdRef.current };
      queryClient.setQueryData(['gessagem_recomendacoes'], anteriores => atualizarListaGessagens(anteriores, atualizado));
      queryClient.setQueryData(['recomendacao_gessagem', ctxKey], anteriores => atualizarListaGessagens(anteriores, atualizado));
      queryClient.invalidateQueries({ queryKey: ['gessagem_recomendacoes'] });
      queryClient.invalidateQueries({ queryKey: ['recomendacao_gessagem', ctxKey] });
    },
  });

  const handleSalvar = () => {
    if (!podeSalvar) return;
    salvar(montarPayloadGessagem({
      codigoProdutor,
      safra,
      talhao,
      analise2040,
      produto,
      doseCalcarioKgHa: doseCalcario,
      caoCalcarioPct: caoCalcario,
      caoGessoPct: caoGesso,
      argilaManual,
      doseFinalKgHa: doseFinalNum,
      metodoCalculo,
      faixa5aPosicao,
      doseMatematicaKgHa: escolhaDose.doseMatematicaKgHa,
      doseTecnicaKgHa: escolhaDose.doseTecnicaKgHa,
      aplicarSemIndicacao,
      calagemImportada,
      precoUnitario,
      unidadePreco,
      observacoes,
    }));
  };

  const registroAtual = selecionarRegistroGessagem(registrosSalvos);

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${expandido ? 'border-sky-300 shadow-sm' : 'border-border'}`}>
      <button
        type="button"
        onClick={() => setExpandido(v => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${expandido ? 'bg-sky-50' : 'bg-card hover:bg-muted/30'}`}
      >
        <div className="flex items-center gap-3">
          {expandido ? <ChevronDown className="w-4 h-4 text-sky-700 shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
          <span className="font-medium text-sm">{talhao.nome}</span>
          {talhao.area_ha && <span className="text-xs text-muted-foreground">{talhao.area_ha} ha</span>}
        </div>
        <div className="flex items-center gap-2">
          {!analise2040 && (
            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">Sem 20-40 cm</span>
          )}
          {analise2040 && recomendacao.indicada && (
            <span className="text-[10px] bg-sky-100 text-sky-700 border border-sky-200 rounded-full px-2 py-0.5 font-medium">Gessagem indicada</span>
          )}
          {analise2040 && !recomendacao.indicada && (
            <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">Não indicada</span>
          )}
          {registroAtual?.dose_final_kg_ha != null && (
            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 font-medium">
              Salvo: {registroAtual.dose_final_kg_ha} kg/ha
            </span>
          )}
        </div>
      </button>

      {expandido && (
        <div className="border-t border-border p-4 space-y-4 bg-background">
          {!analise2040 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              Análise de subsuperfície necessária para recomendar gessagem.
            </div>
          )}

          {analise2040 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[10px] text-muted-foreground">Ca 20-40 cm</p>
                  <p className="font-bold">{fmt(recomendacao.ca2040, 2)} <span className="text-xs font-normal">cmolc/dm³</span></p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[10px] text-muted-foreground">Al 20-40 cm</p>
                  <p className="font-bold">{fmt(recomendacao.al2040, 2)} <span className="text-xs font-normal">cmolc/dm³</span></p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[10px] text-muted-foreground">m%</p>
                  <p className="font-bold">{recomendacao.mPercentual != null ? `${fmt(recomendacao.mPercentual, 1)}%` : '—'}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[10px] text-muted-foreground">Mg 20-40 cm</p>
                  <p className="font-bold">{fmt(recomendacao.mg2040, 2)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[10px] text-muted-foreground">K 20-40 cm</p>
                  <p className="font-bold">{fmt(recomendacao.k2040, 0)} <span className="text-xs font-normal">mg/dm³</span></p>
                </div>
              </div>

              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-800 space-y-1">
                <p className="font-semibold">{recomendacao.indicada ? 'Critérios atendidos para gessagem' : 'Gessagem não indicada pela análise 20-40 cm'}</p>
                {recomendacao.indicada && <p>{recomendacao.motivos.join(' · ')}</p>}
                <p>{ORIENTACAO_APLICACAO_GESSAGEM}</p>
                <p className="text-amber-800">{ALERTA_LIXIVIACAO_GESSAGEM}</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Dados importados da Calagem</p>
                    <p className="text-[11px] text-muted-foreground">Busca pelo produtor, safra e talhão selecionados.</p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEdicaoManualCalagem(v => !v)}>
                    {edicaoManualCalagem ? 'Usar Calagem salva' : 'Editar manualmente'}
                  </Button>
                </div>
                {calagemImportada ? (
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Corretivo</span><p className="font-semibold">{calagemImportada.produtoNome || '—'}</p></div>
                    <div><span className="text-muted-foreground">Preço calcário</span><p className="font-semibold">{formatarPrecoUnitarioGessagem(calagemImportada.precoUnitario, calagemImportada.unidadePreco)}</p></div>
                    <div><span className="text-muted-foreground">PRNT</span><p className="font-semibold">{calagemImportada.prnt != null ? `${fmt(calagemImportada.prnt, 1)}%` : '—'}</p></div>
                    <div><span className="text-muted-foreground">CaO</span><p className="font-semibold">{calagemImportada.caoCalcarioPct != null ? `${fmt(calagemImportada.caoCalcarioPct, 1)}%` : '—'}</p></div>
                    <div><span className="text-muted-foreground">Ca</span><p className="font-semibold">{calagemImportada.caPct != null ? `${fmt(calagemImportada.caPct, 1)}%` : '—'}</p></div>
                    <div><span className="text-muted-foreground">Mg</span><p className="font-semibold">{calagemImportada.mgPct != null ? `${fmt(calagemImportada.mgPct, 1)}%` : '—'}</p></div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhuma Calagem salva encontrada para este produtor, safra e talhão.</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Teor de argila (%)</Label>
                  <Input type="number" min="0" max="100" step="0.1" value={argilaManual} onChange={e => setArgilaManual(e.target.value)} placeholder="Ex: 40" className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Dose de calcário (kg/ha)</Label>
                  <Input type="number" min="0" step="1" value={doseCalcario} onChange={e => setDoseCalcario(e.target.value)} disabled={!edicaoManualCalagem && !!calagemImportada} placeholder="Ex: 2000" className="h-8 text-xs disabled:opacity-75" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">CaO do calcário (%)</Label>
                  <Input type="number" min="0" step="0.1" value={caoCalcario} onChange={e => setCaoCalcario(e.target.value)} disabled={!edicaoManualCalagem && !!calagemImportada} placeholder="Ex: 40" className="h-8 text-xs disabled:opacity-75" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">CaO do gesso (%)</Label>
                  <Input type="number" min="0" step="0.1" value={caoGesso} onChange={e => setCaoGesso(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <Label className="text-xs mb-1 block">Método de cálculo</Label>
                  <select value={metodoCalculo} onChange={e => setMetodoCalculo(e.target.value)} className="h-8 w-full text-xs border border-input rounded px-2 bg-background">
                    <option value="combinado_conservador">Combinado conservador</option>
                    <option value="5a_aproximacao">5ª Aproximação</option>
                    <option value="lopes">Lopes</option>
                    <option value="dose_manual">Dose manual</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Faixa 5ª Aproximação</Label>
                  <select value={faixa5aPosicao} onChange={e => setFaixa5aPosicao(e.target.value)} className="h-8 w-full text-xs border border-input rounded px-2 bg-background">
                    <option value="minima">Dose mínima</option>
                    <option value="media">Dose média</option>
                    <option value="maxima">Dose máxima</option>
                  </select>
                </div>
                {!recomendacao.indicada && (
                  <label className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <input type="checkbox" checked={aplicarSemIndicacao} onChange={e => setAplicarSemIndicacao(e.target.checked)} />
                    Aplicar mesmo sem indicação técnica
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[10px] text-muted-foreground">Resultado matemático da 5ª Aproximação</p>
                  <p className="font-bold">{recomendacao.faixa5a ? `${fmtT(recomendacao.faixa5a.minT)} a ${fmtT(recomendacao.faixa5a.maxT)}` : '—'}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[10px] text-muted-foreground">Resultado matemático de Lopes</p>
                  <p className="font-bold">{fmtKg(recomendacao.lopes?.gessoKgHa)}</p>
                  {recomendacao.lopes?.calcarioAjustadoKgHa != null && <p className="text-[10px] text-muted-foreground">Calcário ajustado: {fmtKg(recomendacao.lopes.calcarioAjustadoKgHa)}</p>}
                </div>
                <div className="rounded-lg border border-sky-100 bg-sky-50 p-3">
                  <p className="text-[10px] text-sky-800">Dose técnica sugerida</p>
                  <p className="font-bold text-sky-900">{fmtKg(escolhaDose.doseTecnicaKgHa)}</p>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Dose final escolhida (kg/ha)</Label>
                  <Input type="number" min="0" step="1" value={doseFinal} onChange={e => setDoseFinal(e.target.value)} disabled={metodoCalculo !== 'dose_manual' || (!recomendacao.indicada && !aplicarSemIndicacao)} placeholder="Dose final" className="h-8 text-xs disabled:opacity-75" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                <div className="sm:col-span-2">
                  <Label className="text-xs mb-1 block">Produto/fonte de gesso</Label>
                  <select value={produtoId} onChange={e => setProdutoId(e.target.value)} className="h-8 w-full text-xs border border-input rounded px-2 bg-background">
                    <option value="">Selecionar fonte...</option>
                    {produtos.map(prod => <option key={prod.id} value={prod.id}>{prod.nome}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Preço unitário</Label>
                  <Input type="number" min="0" step="0.01" value={precoUnitario} onChange={e => setPrecoUnitario(e.target.value)} placeholder="Ex: 500" className="h-8 text-xs" />
                  {precoInvalido && <p className="mt-1 text-[10px] font-medium text-destructive">Informe preço positivo ou deixe vazio.</p>}
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Unidade</Label>
                  <select value={unidadePreco} onChange={e => setUnidadePreco(e.target.value)} className="h-8 w-full text-xs border border-input rounded px-2 bg-background">
                    <option value="t">R$/tonelada</option>
                    <option value="kg">R$/kg</option>
                  </select>
                </div>
                <div className="rounded-lg border border-sky-100 bg-white px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Preço</p>
                  <p className="text-sm font-bold tabular-nums">{formatarPrecoUnitarioGessagem(custo.precoUnitario, custo.unidadePreco)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[10px] text-muted-foreground">Quantidade total</p>
                  <p className="font-bold">{custo.quantidadeTotalKg != null ? `${fmt(custo.quantidadeTotalKg, 0)} kg` : '—'}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[10px] text-muted-foreground">Custo/ha</p>
                  <p className="font-bold">{fmtR(custo.custoHa)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[10px] text-muted-foreground">Custo total</p>
                  <p className="font-bold">{fmtR(custo.custoTotal)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-[10px] text-muted-foreground">Ca e S fornecidos</p>
                  <p className="font-bold text-xs">{fornecimento.caKgHa != null ? `Ca ${fmt(fornecimento.caKgHa, 1)} kg/ha` : 'Ca —'} · {fornecimento.sKgHa != null ? `S ${fmt(fornecimento.sKgHa, 1)} kg/ha` : 'S —'}</p>
                </div>
              </div>

              <div>
                <Label className="text-xs mb-1 block">Observações</Label>
                <textarea
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  rows={2}
                  className="w-full text-xs border border-input rounded px-3 py-2 bg-background"
                  placeholder="Observações técnicas da gessagem"
                />
              </div>

              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={handleSalvar} disabled={salvando || !podeSalvar} className="gap-2">
                  {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AbaGessagem2({ talhoes, analises2040PorTalhao = {}, calagens = [], safra, codigoProdutor, fertilizantes, fontesSimples }) {
  const todosProdutos = useMemo(() => {
    const ferts = (fertilizantes || []).map(f => ({ ...f, _tipo: 'formulado' }));
    const fontes = (fontesSimples || []).map(f => ({ ...f, _tipo: 'fonte' }));
    return [...ferts, ...fontes].filter(produtoValidoAdubacao2);
  }, [fertilizantes, fontesSimples]);

  const produtosGesso = useMemo(() => {
    return todosProdutos
      .filter(produtoPareceGesso)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [todosProdutos]);

  if (!codigoProdutor) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Mountain className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p>Selecione um produtor para avaliar a gessagem.</p>
      </div>
    );
  }

  if (talhoes.length === 0) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Nenhum talhão cadastrado.</div>;
  }

  const calagemPorTalhao = new Map((calagens || []).map(calagem => [calagem.talhao_id, calagem]));

  return (
    <div className="p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <Mountain className="w-4 h-4 text-sky-700" />
        <p className="text-sm font-semibold text-foreground">Necessidade de Gessagem por Talhão</p>
        <span className="text-xs text-muted-foreground">— baseada na análise 20-40 cm</span>
      </div>
      {produtosGesso.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          Nenhuma fonte de gesso identificada na Base de Insumos. Cadastre ou ative um produto com Ca e S para usar no cálculo de fornecimento.
        </div>
      )}
      {talhoes.map(talhao => (
        <CardGessagem
          key={talhao.id}
          talhao={talhao}
          analise2040={analises2040PorTalhao[talhao.id] || null}
          calagem={calagemPorTalhao.get(talhao.id) || null}
          safra={safra}
          codigoProdutor={codigoProdutor}
          produtos={produtosGesso}
          todosProdutos={todosProdutos}
        />
      ))}
    </div>
  );
}
