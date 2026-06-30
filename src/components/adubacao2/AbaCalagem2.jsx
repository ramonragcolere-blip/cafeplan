import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronRight, Save, Loader2, Leaf } from 'lucide-react';

// ── Lógica de cálculo (portada de CalcCalagem.jsx) ────────────────────────────

const NIVEIS = {
  Mínimo:    { ca: 3.0, mg: 1.0, k: 0.33 },
  Bom:       { ca: 3.6, mg: 1.2, k: 0.40 },
  Excelente: { ca: 4.5, mg: 1.5, k: 0.50 },
};

function calcCalagEmElevacao(caAtual, mgAtual, nivel, produto, area) {
  const meta = NIVEIS[nivel] || NIVEIS['Bom'];
  const defCa = Math.max(0, meta.ca - (Number(caAtual) || 0));
  const defMg = Math.max(0, meta.mg - (Number(mgAtual) || 0));
  if (!produto) return { defCa, defMg, meta };

  const pctCa = parseFloat(produto.ca_pct) || 0;
  const pctMg = parseFloat(produto.mg_pct) || 0;

  let dosePeloCa = 0;
  if (pctCa > 0 && defCa > 0) {
    const cmolcPorTonCa = (1000 * (pctCa / 100)) / 560;
    dosePeloCa = (defCa / cmolcPorTonCa) * 1000;
  }
  let dosePeloMg = 0;
  if (pctMg > 0 && defMg > 0) {
    const cmolcPorTonMg = (1000 * (pctMg / 100)) / 400;
    dosePeloMg = (defMg / cmolcPorTonMg) * 1000;
  }

  const doseFinalHa = Math.max(dosePeloCa, dosePeloMg);
  const totalKg = area > 0 ? doseFinalHa * area : null;

  return {
    defCa, defMg, meta,
    dosePeloCa: Math.round(dosePeloCa),
    dosePeloMg: Math.round(dosePeloMg),
    doseFinalHa: Math.round(doseFinalHa),
    totalKg: totalKg != null ? Math.round(totalKg) : null,
    ton:  totalKg != null ? parseFloat((totalKg / 1000).toFixed(3)) : null,
    sc40: totalKg != null ? parseFloat((totalKg / 40).toFixed(1))   : null,
    sc50: totalKg != null ? parseFloat((totalKg / 50).toFixed(1))   : null,
  };
}

function calcCalagemVpct({ ctc, v1, v2, prnt, area }) {
  if (ctc == null || v1 == null || v2 == null || v2 <= v1) return { doseFinalHa: 0, totalKg: 0, ton: 0 };
  let nc = ctc * (v2 - v1) / 100;
  if (prnt > 0) nc = nc * (100 / prnt);
  const doseFinalHa = Math.max(0, Math.round(nc * 1000));
  const totalKg = area > 0 ? Math.round(doseFinalHa * area) : null;
  return {
    doseFinalHa,
    totalKg,
    ton:  totalKg != null ? parseFloat((totalKg / 1000).toFixed(3)) : null,
    sc40: totalKg != null ? parseFloat((totalKg / 40).toFixed(1))   : null,
    sc50: totalKg != null ? parseFloat((totalKg / 50).toFixed(1))   : null,
  };
}

// ── Seletor de produto corretivo com portal ───────────────────────────────────
function SeletorCorretivo({ produto, corretivos, onChange }) {
  const [dropAberto, setDropAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const portalRef = useRef(null);
  const searchRef = useRef(null);

  const visiveis = useMemo(() => {
    const q = busca.toLowerCase();
    return (corretivos || []).filter(p =>
      (p.nome || '').toLowerCase().includes(q) || (p.fornecedor || '').toLowerCase().includes(q)
    );
  }, [corretivos, busca]);

  useEffect(() => {
    if (dropAberto && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: Math.max(rect.width, 320) });
      requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
    }
  }, [dropAberto]);

  useEffect(() => {
    if (!dropAberto) return;
    const handler = (e) => {
      if (!triggerRef.current?.contains(e.target) && !portalRef.current?.contains(e.target)) {
        setDropAberto(false); setBusca('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropAberto]);

  const dropdown = dropAberto ? ReactDOM.createPortal(
    <div ref={portalRef}
      style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="bg-popover border border-border rounded-lg shadow-2xl overflow-hidden">
      <div className="p-2 border-b border-border">
        <input ref={searchRef} className="w-full h-9 text-sm border border-input rounded px-3 bg-background"
          placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} />
      </div>
      <div className="max-h-64 overflow-y-auto">
        <button type="button" className="w-full text-left px-4 py-2.5 hover:bg-muted/60 text-sm border-b border-border/30 text-muted-foreground"
          onMouseDown={e => e.preventDefault()} onClick={() => { onChange(null); setDropAberto(false); setBusca(''); }}>
          — Nenhum produto —
        </button>
        {visiveis.map(p => (
          <button key={p.id} type="button"
            className="w-full text-left px-4 py-3 hover:bg-muted/60 border-b border-border/30 last:border-0"
            onMouseDown={e => e.preventDefault()} onClick={() => { onChange(p.id); setDropAberto(false); setBusca(''); }}>
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-medium leading-snug">{p.nome}</span>
              <span className="text-muted-foreground text-xs whitespace-nowrap shrink-0 mt-0.5">
                {p.ca_pct > 0 ? `Ca: ${p.ca_pct}%` : ''}{p.ca_pct > 0 && p.mg_pct > 0 ? ' · ' : ''}{p.mg_pct > 0 ? `Mg: ${p.mg_pct}%` : ''}
              </span>
            </div>
            {p.fornecedor && <div className="text-xs text-muted-foreground mt-0.5">{p.fornecedor}</div>}
          </button>
        ))}
        {visiveis.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground italic">Nenhum produto encontrado.</p>}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Fonte corretiva</p>
      {corretivos.length === 0 && <p className="text-xs text-amber-600 mb-1">Nenhum corretivo cadastrado na base de fertilizantes.</p>}
      <button ref={triggerRef} type="button"
        className="w-full h-9 text-sm border border-input rounded-md px-3 text-left flex items-center justify-between bg-transparent hover:bg-muted/30"
        onClick={() => setDropAberto(a => !a)}>
        <span className={produto ? 'text-foreground' : 'text-muted-foreground'}>
          {produto ? produto.nome : 'Selecionar produto...'}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground ml-1 shrink-0" />
      </button>
      {dropdown}
      {produto && (
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
          {produto.ca_pct > 0 && <span className="bg-lime-100 text-lime-700 px-2 py-0.5 rounded-full font-medium">Ca: {produto.ca_pct}%</span>}
          {produto.mg_pct > 0 && <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">Mg: {produto.mg_pct}%</span>}
          {produto.prnt != null && produto.prnt > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">PRNT: {produto.prnt}%</span>}
        </div>
      )}
    </div>
  );
}

// ── Cards de resultado ────────────────────────────────────────────────────────
function CardsResultado({ resultado }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
    </div>
  );
}

// ── Card de calagem por talhão ────────────────────────────────────────────────
function CardCalagem({ talhao, analise, safra, codigoProdutor, corretivos }) {
  const [expandido, setExpandido] = useState(false);
  const [protocolo, setProtocolo] = useState('elevacao');
  const [nivel, setNivel] = useState('Bom');
  const [produtoId, setProdutoId] = useState(null);
  const [v2, setV2] = useState('');
  const [prntManual, setPrntManual] = useState('');
  const carregadoRef = useRef(false);
  const queryClient = useQueryClient();

  const area = talhao.area_ha || 0;
  const talhaoId = talhao.id;
  const ctxKey = `${codigoProdutor}|${safra}|${talhaoId}`;

  // Converte valores da análise (mesma lógica do CalcCalagem.jsx)
  const caAtual   = analise?.calcio          != null ? Number(analise.calcio)          / 10 : undefined;
  const mgAtual   = analise?.magnesio        != null ? Number(analise.magnesio)        / 10 : undefined;
  const kAtual    = analise?.potassio        != null ? Number(analise.potassio)        / 10 : undefined;
  const v1        = analise?.saturacao_bases != null ? Number(analise.saturacao_bases) : undefined;
  const ctcAtual  = analise?.ctc             != null ? Number(analise.ctc)             / 10 :
    (caAtual != null && mgAtual != null ? caAtual + mgAtual + (kAtual || 0) : undefined);

  const { data: registrosSalvos = [], isLoading: carregando } = useQuery({
    queryKey: ['recomendacao_calagem', ctxKey],
    queryFn: () => codigoProdutor && safra && talhaoId
      ? base44.entities.BaseRecomendacaoCalagem.filter({ codigo_produtor: codigoProdutor, safra, talhao_id: talhaoId })
      : Promise.resolve([]),
    enabled: !!(codigoProdutor && safra && talhaoId),
  });

  useEffect(() => { carregadoRef.current = false; }, [ctxKey]);

  useEffect(() => {
    if (carregadoRef.current || carregando) return;
    const reg = registrosSalvos[0];
    if (reg) {
      const metaSalva = reg.meta || 'Bom';
      if (metaSalva.startsWith('V%')) {
        setProtocolo('vpct');
        const v2Salvo = metaSalva.split('→')[1];
        if (v2Salvo) setV2(v2Salvo);
      } else if (NIVEIS[metaSalva]) {
        setNivel(metaSalva);
      }
      setProdutoId(reg.produto_id || null);
    }
    carregadoRef.current = true;
  }, [registrosSalvos, carregando]);

  const [registroId, setRegistroId] = useState(null);
  useEffect(() => {
    if (registrosSalvos[0]?.id) setRegistroId(registrosSalvos[0].id);
  }, [registrosSalvos]);

  const { mutate: salvar, isPending: salvando } = useMutation({
    mutationFn: async (dados) => {
      if (registroId) return base44.entities.BaseRecomendacaoCalagem.update(registroId, dados);
      return base44.entities.BaseRecomendacaoCalagem.create(dados);
    },
    onSuccess: (res) => {
      if (!registroId && res?.id) setRegistroId(res.id);
      queryClient.invalidateQueries({ queryKey: ['recomendacao_calagem', ctxKey] });
    },
  });

  const produto = useMemo(() => corretivos.find(p => p.id === produtoId) || null, [corretivos, produtoId]);

  const meta = NIVEIS[nivel] || NIVEIS['Bom'];

  const resultadoElevacao = useMemo(() =>
    calcCalagEmElevacao(caAtual, mgAtual, nivel, produto, area),
    [caAtual, mgAtual, nivel, produto, area]
  );

  const prntEfetivo = produto?.prnt > 0 ? Number(produto.prnt) : prntManual !== '' ? Number(prntManual) : 100;

  const resultadoVpct = useMemo(() => {
    if (v1 == null || v2 === '' || ctcAtual == null) return null;
    const v2Num = Number(v2);
    if (isNaN(v2Num) || v2Num <= 0 || v2Num > 100) return null;
    return calcCalagemVpct({ ctc: ctcAtual, v1, v2: v2Num, prnt: prntEfetivo, area });
  }, [ctcAtual, v1, v2, prntEfetivo, area]);

  const resultado = protocolo === 'elevacao' ? resultadoElevacao : resultadoVpct;

  const handleSalvar = () => {
    salvar({
      codigo_produtor: codigoProdutor, safra,
      talhao_id: talhaoId,
      talhao_nome: talhao.nome,
      meta: protocolo === 'elevacao' ? nivel : `V%→${v2}`,
      produto_id: produtoId || '',
      produto_nome: produto?.nome || '',
      ca_atual: caAtual ?? null,
      mg_atual: mgAtual ?? null,
      k_atual: kAtual ?? null,
      deficit_ca: resultadoElevacao?.defCa ?? null,
      deficit_mg: resultadoElevacao?.defMg ?? null,
      dose_kg_ha: resultado?.doseFinalHa ?? null,
      dose_total_kg: resultado?.totalKg ?? null,
    });
  };

  // Badge de resumo para o header
  const temRegistro = registrosSalvos.length > 0;
  const doseSalva = registrosSalvos[0]?.dose_kg_ha;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${expandido ? 'border-lime-300 shadow-sm' : 'border-border'}`}>
      {/* Header clicável */}
      <button type="button"
        onClick={() => setExpandido(a => !a)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${expandido ? 'bg-lime-50' : 'bg-card hover:bg-muted/30'}`}>
        <div className="flex items-center gap-3">
          {expandido ? <ChevronDown className="w-4 h-4 text-lime-700 shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
          <span className="font-medium text-sm">{talhao.nome}</span>
          {talhao.area_ha && <span className="text-xs text-muted-foreground">{talhao.area_ha} ha</span>}
        </div>
        <div className="flex items-center gap-2">
          {!analise && (
            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">Sem análise</span>
          )}
          {analise && temRegistro && doseSalva != null && (
            <span className="text-[10px] bg-lime-100 text-lime-700 border border-lime-200 rounded-full px-2 py-0.5 font-medium">
              Salvo: {doseSalva} kg/ha
            </span>
          )}
          {analise && !temRegistro && (
            <span className="text-[10px] bg-muted text-muted-foreground border border-border rounded-full px-2 py-0.5">Não calculado</span>
          )}
        </div>
      </button>

      {/* Conteúdo expandido */}
      {expandido && (
        <div className="border-t border-border p-4 space-y-4 bg-background">

          {/* Sem análise */}
          {!analise && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              Importe a análise de solo deste talhão na aba <strong>Análises e Importação</strong> para calcular a calagem.
            </div>
          )}

          {analise && (
            <>
              {/* Seletor de protocolo */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Protocolo:</span>
                {[
                  { id: 'elevacao', label: 'Elevação de Ca e Mg' },
                  { id: 'vpct',     label: 'Saturação por Bases (V%)' },
                ].map(p => (
                  <button key={p.id} type="button" onClick={() => setProtocolo(p.id)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors font-medium ${protocolo === p.id ? 'bg-lime-700 text-white border-lime-700' : 'bg-background text-muted-foreground border-border hover:bg-lime-50'}`}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* ── PROTOCOLO 1: ELEVAÇÃO ── */}
              {protocolo === 'elevacao' && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Nível alvo:</span>
                    {Object.keys(NIVEIS).map(n => (
                      <button key={n} type="button" onClick={() => setNivel(n)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors font-medium ${nivel === n ? 'bg-lime-700 text-white border-lime-700' : 'bg-background text-muted-foreground border-border hover:bg-lime-50'}`}>
                        {n}
                      </button>
                    ))}
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/10">
                          {['Nutriente', 'Atual', `Meta (${nivel})`, 'Déficit', 'Situação'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border/40">
                          <td className="px-3 py-2 font-medium">Ca (cmolc/dm³)</td>
                          <td className="px-3 py-2 tabular-nums">{caAtual != null ? caAtual.toFixed(2) : '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{meta.ca}</td>
                          <td className={`px-3 py-2 font-semibold ${resultadoElevacao?.defCa > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {resultadoElevacao ? (resultadoElevacao.defCa > 0 ? `−${resultadoElevacao.defCa.toFixed(2)}` : '✓') : '—'}
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {resultadoElevacao ? (resultadoElevacao.defCa > 0 ? `déficit: ${resultadoElevacao.defCa.toFixed(2)} cmolc` : 'Sem déficit') : '—'}
                          </td>
                        </tr>
                        <tr className="border-b border-border/40">
                          <td className="px-3 py-2 font-medium">Mg (cmolc/dm³)</td>
                          <td className="px-3 py-2 tabular-nums">{mgAtual != null ? mgAtual.toFixed(2) : '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{meta.mg}</td>
                          <td className={`px-3 py-2 font-semibold ${resultadoElevacao?.defMg > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {resultadoElevacao ? (resultadoElevacao.defMg > 0 ? `−${resultadoElevacao.defMg.toFixed(2)}` : '✓') : '—'}
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {resultadoElevacao ? (resultadoElevacao.defMg > 0 ? `déficit: ${resultadoElevacao.defMg.toFixed(2)} cmolc` : 'Sem déficit') : '—'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 text-muted-foreground">K — equilíbrio (mmolc/dm³)</td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">{analise?.potassio != null ? analise.potassio : '—'}</td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">{(meta.k * 10).toFixed(1)} <span className="text-[10px]">(≈{meta.k} cmolc)</span></td>
                          <td className="px-3 py-2 text-muted-foreground text-[10px] italic">informativo</td>
                          <td className="px-3 py-2 text-muted-foreground text-[10px] italic">não gera dose</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <SeletorCorretivo produto={produto} corretivos={corretivos} onChange={setProdutoId} />

                  {resultadoElevacao && resultadoElevacao.defCa === 0 && resultadoElevacao.defMg === 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700 font-medium">
                      ✓ Ca e Mg estão dentro ou acima da meta "{nivel}". Calagem não necessária.
                    </div>
                  )}

                  {resultadoElevacao && produto && resultadoElevacao.doseFinalHa > 0 && (
                    <div className="bg-lime-50 border border-lime-200 rounded-xl p-3 space-y-3">
                      <p className="text-xs font-semibold text-lime-800 uppercase tracking-wide">Resultado — {produto.nome}</p>
                      <div className="text-xs space-y-0.5 border-b border-lime-200 pb-2">
                        {resultadoElevacao.dosePeloCa > 0
                          ? <div>Dose pelo Ca: <strong>{resultadoElevacao.dosePeloCa} kg/ha</strong></div>
                          : <div className="text-muted-foreground">Dose pelo Ca: sem déficit</div>}
                        {resultadoElevacao.dosePeloMg > 0
                          ? <div>Dose pelo Mg: <strong>{resultadoElevacao.dosePeloMg} kg/ha</strong></div>
                          : <div className="text-muted-foreground">Dose pelo Mg: sem déficit</div>}
                        <div className="font-semibold text-lime-800">
                          Dose recomendada: {resultadoElevacao.doseFinalHa} kg/ha
                          <span className="font-normal text-muted-foreground ml-1">(nutriente mais limitante)</span>
                        </div>
                      </div>
                      <CardsResultado resultado={resultadoElevacao} />
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={handleSalvar} disabled={salvando} className="gap-2">
                      {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Salvar
                    </Button>
                  </div>
                </>
              )}

              {/* ── PROTOCOLO 2: V% ── */}
              {protocolo === 'vpct' && (
                <>
                  <div className="bg-muted/30 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados da análise (0–20 cm)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block">V% atual (V1)</span>
                        <span className="font-semibold">{v1 != null ? `${v1}%` : <span className="text-destructive">não informado</span>}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">CTC (cmolc/dm³)</span>
                        <span className="font-semibold">{ctcAtual != null ? ctcAtual.toFixed(2) : <span className="text-destructive">não informado</span>}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Ca atual (cmolc)</span>
                        <span className="font-semibold">{caAtual != null ? caAtual.toFixed(2) : '—'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Mg atual (cmolc)</span>
                        <span className="font-semibold">{mgAtual != null ? mgAtual.toFixed(2) : '—'}</span>
                      </div>
                    </div>
                  </div>

                  {(v1 == null || ctcAtual == null) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                      ⚠ A análise deve conter <strong>V% (Saturação de Bases)</strong> e <strong>CTC</strong> para usar este protocolo.
                    </div>
                  )}

                  {v1 != null && ctcAtual != null && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs mb-1 block">V% desejado (V2)</Label>
                          <Input type="number" min="0" max="100" step="1" placeholder="Ex: 70"
                            value={v2} onChange={e => setV2(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">
                            PRNT do calcário (%)
                            {produto?.prnt > 0 && <span className="text-muted-foreground ml-1">(do produto: {produto.prnt}%)</span>}
                          </Label>
                          <Input type="number" min="1" max="100" step="1"
                            placeholder={produto?.prnt > 0 ? String(produto.prnt) : 'Ex: 85'}
                            value={prntManual} onChange={e => setPrntManual(e.target.value)}
                            disabled={produto?.prnt > 0} className="h-8 text-xs" />
                        </div>
                      </div>

                      <SeletorCorretivo produto={produto} corretivos={corretivos} onChange={setProdutoId} />

                      {v2 !== '' && (
                        <div className="bg-muted/30 rounded-xl p-2.5 text-xs text-muted-foreground font-mono space-y-0.5">
                          <div>NC = CTC × (V2 − V1) / 100 × (100 / PRNT)</div>
                          <div>NC = {ctcAtual.toFixed(2)} × ({v2} − {v1}) / 100 × (100 / {prntEfetivo})</div>
                        </div>
                      )}

                      {resultadoVpct && resultadoVpct.doseFinalHa === 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700 font-medium">
                          ✓ V% atual ({v1}%) já está igual ou acima do desejado ({v2}%). Calagem não necessária.
                        </div>
                      )}

                      {resultadoVpct && resultadoVpct.doseFinalHa > 0 && (
                        <div className="bg-lime-50 border border-lime-200 rounded-xl p-3 space-y-3">
                          <p className="text-xs font-semibold text-lime-800 uppercase tracking-wide">
                            Resultado — Saturação por Bases (V%){produto ? ` — ${produto.nome}` : ''}
                          </p>
                          <div className="text-xs space-y-0.5 border-b border-lime-200 pb-2">
                            <div>V1 atual: <strong>{v1}%</strong></div>
                            <div>V2 desejado: <strong>{v2}%</strong></div>
                            <div>CTC: <strong>{ctcAtual.toFixed(2)} cmolc/dm³</strong></div>
                            <div>PRNT: <strong>{prntEfetivo}%</strong></div>
                            <div className="font-semibold text-lime-800">Dose recomendada: {resultadoVpct.doseFinalHa} kg/ha</div>
                          </div>
                          <CardsResultado resultado={resultadoVpct} />
                        </div>
                      )}

                      {!resultadoVpct && v2 === '' && (
                        <div className="text-xs text-muted-foreground italic">Informe o V% desejado para calcular.</div>
                      )}

                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" onClick={handleSalvar} disabled={salvando} className="gap-2">
                          {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Salvar
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente principal da aba ───────────────────────────────────────────────
export default function AbaCalagem2({ talhoes, analises, safra, codigoProdutor, fertilizantes, fontesSimples }) {
  const corretivos = useMemo(() => {
    const ferts = (fertilizantes || []).map(f => ({ ...f, _tipo: 'formulado' }));
    const fontes = (fontesSimples || []).map(f => ({ ...f, _tipo: 'fonte' }));
    return [...ferts, ...fontes].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [fertilizantes, fontesSimples]);

  if (!codigoProdutor) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Leaf className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p>Selecione um produtor para calcular a calagem.</p>
      </div>
    );
  }

  if (talhoes.length === 0) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Nenhum talhão cadastrado.</div>;
  }

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Leaf className="w-4 h-4 text-lime-700" />
        <p className="text-sm font-semibold text-foreground">Necessidade de Calagem por Talhão</p>
        <span className="text-xs text-muted-foreground">— Clique em um talhão para expandir</span>
      </div>
      {talhoes.map(talhao => {
        const analise = analises.find(a => a.talhao_id === talhao.id) || null;
        return (
          <CardCalagem
            key={talhao.id}
            talhao={talhao}
            analise={analise}
            safra={safra}
            codigoProdutor={codigoProdutor}
            corretivos={corretivos}
          />
        );
      })}
    </div>
  );
}