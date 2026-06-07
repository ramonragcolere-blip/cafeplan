import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart2, Save, ChevronRight, ChevronDown, MoreVertical, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { classificarZn, classificarCu, classificarMn } from '@/lib/tabelasNutricionais';

// ── helpers ───────────────────────────────────────────────────────────────────

function calcMicros(analise) {
  if (!analise) return {};
  return {
    Zn: analise.zinco != null ? classificarZn(analise.zinco) : null,
    Cu: analise.cobre != null ? classificarCu(analise.cobre) : null,
    Mn: analise.manganes != null ? classificarMn(analise.manganes) : null,
  };
}

function classBadgeColor(classe) {
  if (classe === 'Baixo')  return 'text-red-600 bg-red-50 border-red-200';
  if (classe === 'Médio')  return 'text-amber-600 bg-amber-50 border-amber-200';
  if (classe === 'Bom')    return 'text-blue-600 bg-blue-50 border-blue-200';
  if (classe === 'Ótimo')  return 'text-green-600 bg-green-50 border-green-200';
  return 'text-muted-foreground bg-muted border-border';
}

function StatusBadgePlan({ rec }) {
  if (!rec) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="w-3 h-3" /> Pendente
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
      <CheckCircle2 className="w-3 h-3" /> Calculado
    </span>
  );
}

// ── Cards de métricas ─────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, subColor }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex-1 min-w-0">
      <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>
      <p className="text-xl font-bold text-foreground tabular-nums truncate">{value}</p>
      <p className={`text-xs mt-0.5 truncate ${subColor || 'text-muted-foreground'}`}>{sub}</p>
    </div>
  );
}

// ── Painel expandido de um talhão ──────────────────────────────────────────────

const NUTRIENTES_GRID = [
  { key: 'N',  label: 'N',    tipo: 'dose',  unit: 'kg/ha' },
  { key: 'P',  label: 'P₂O₅', tipo: 'dose',  unit: 'kg/ha' },
  { key: 'K',  label: 'K₂O',  tipo: 'dose',  unit: 'kg/ha' },
  { key: 'B',  label: 'B',    tipo: 'dose',  unit: 'kg/ha' },
  { key: 'Zn', label: 'Zn',   tipo: 'class' },
  { key: 'Mn', label: 'Mn',   tipo: 'class' },
  { key: 'Cu', label: 'Cu',   tipo: 'class' },
  { key: 'Mg', label: 'Mg',   tipo: 'dose',  unit: 'kg/ha' },
];

function PainelTalhao({ resultado, onFechar }) {
  const { talhao, rec, mediaBienal, analise } = resultado;
  const micros = calcMicros(analise);

  return (
    <div className="bg-muted/20 border-l-4 border-primary mx-0 px-5 py-4 space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-base text-foreground">{talhao.nome}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
            {talhao.area_ha && <span>{talhao.area_ha} ha</span>}
            {talhao.num_plantas && <span>{talhao.num_plantas.toLocaleString()} plantas</span>}
            {mediaBienal != null && <span>Média: <strong className="text-foreground">{mediaBienal.toFixed(1)} sc/ha</strong></span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadgePlan rec={rec} />
          <button
            type="button"
            onClick={onFechar}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 hover:bg-muted/40 transition-colors"
          >
            Fechar detalhes <ChevronDown className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>
      </div>

      {/* Grid de 8 nutrientes */}
      {rec ? (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {NUTRIENTES_GRID.map(n => {
            if (n.tipo === 'dose') {
              const val = rec[n.key];
              return (
                <div key={n.key} className="bg-card border border-border rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground font-medium mb-1">{n.label}</p>
                  <p className="text-base font-bold text-foreground tabular-nums">{val != null ? val : '—'}</p>
                  {val != null && <p className="text-[9px] text-muted-foreground">{n.unit}</p>}
                </div>
              );
            }
            // class
            const cls = micros[n.key];
            return (
              <div key={n.key} className="bg-card border border-border rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">{n.label}</p>
                <p className="text-base font-bold text-muted-foreground">—</p>
                {cls?.classe && (
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${classBadgeColor(cls.classe)}`}>
                    {cls.classe}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
          Sem recomendação calculada. Informe produtividade e análise de solo na aba Análises.
        </div>
      )}

      {/* Placeholder produtos */}
      <div className="bg-muted/40 border border-dashed border-border rounded-lg px-4 py-3 text-xs text-muted-foreground text-center">
        Produtos recomendados — em breve
      </div>
    </div>
  );
}

// ── Menu de ações ─────────────────────────────────────────────────────────────

function MenuAcoes({ onRecalcular, onLimpar }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setAberto(a => !a)}
        className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground transition-colors">
        <MoreVertical className="w-4 h-4" />
      </button>
      {aberto && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg min-w-[140px] overflow-hidden"
          onMouseLeave={() => setAberto(false)}>
          <button type="button" onClick={() => { onRecalcular(); setAberto(false); }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60">Recalcular</button>
          <button type="button" onClick={() => { onLimpar(); setAberto(false); }}
            className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-destructive/10">Limpar</button>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function AbaPlanejamento2({ resultados, todos, calculando, podeCacularTodos, onRecalcular, onSalvar }) {
  const [expandidos, setExpandidos] = useState(new Set());

  const toggleExpand = (id) => setExpandidos(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const expandirTodos = () => setExpandidos(new Set((resultados || []).map(r => r.talhao.id)));
  const recolherTodos = () => setExpandidos(new Set());

  // Métricas agregadas
  const metricas = useMemo(() => {
    if (!resultados || resultados.length === 0) return null;
    const comRec = resultados.filter(r => r.rec);
    const areaTotal = resultados.reduce((s, r) => s + (r.talhao.area_ha || 0), 0);
    // sem preço cadastrado → custo null por enquanto
    return {
      calculados: comRec.length,
      total: resultados.length,
      pct: resultados.length > 0 ? Math.round((comRec.length / resultados.length) * 100) : 0,
      areaTotal,
      mediaSc: comRec.length > 0
        ? comRec.reduce((s, r) => s + (r.mediaBienal || 0), 0) / comRec.length
        : null,
    };
  }, [resultados]);

  // Estado vazio
  if (!resultados || resultados.length === 0) {
    return (
      <div className="p-6 space-y-4">
        {/* Barra de botões mesmo sem dados */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" className="gap-1.5 text-xs" disabled={!podeCacularTodos || calculando} onClick={onRecalcular}>
            {calculando ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Recalcular todos
          </Button>
          <Button variant="secondary" size="sm" className="gap-1.5 text-xs" disabled>
            <BarChart2 className="w-3.5 h-3.5" /> Comparar estratégias
          </Button>
          <Button size="sm" className="gap-1.5 text-xs bg-green-700 hover:bg-green-800 text-white" disabled>
            <Save className="w-3.5 h-3.5" /> Salvar planejamento
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground text-sm">
          Clique em "Calcular recomendação para todos" na aba Análises para gerar o planejamento.
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {/* 1. Barra de botões */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" size="sm" className="gap-1.5 text-xs" disabled={!podeCacularTodos || calculando} onClick={onRecalcular}>
          {calculando ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Recalcular todos
        </Button>
        <Button variant="secondary" size="sm" className="gap-1.5 text-xs" disabled>
          <BarChart2 className="w-3.5 h-3.5" /> Comparar estratégias
        </Button>
        <Button size="sm" className="gap-1.5 text-xs bg-green-700 hover:bg-green-800 text-white" onClick={onSalvar}>
          <Save className="w-3.5 h-3.5" /> Salvar planejamento
        </Button>
      </div>

      {/* 2. Cards de métricas */}
      {metricas && (
        <div className="flex flex-wrap gap-3">
          <MetricCard
            label="Talhões calculados"
            value={`${metricas.calculados}/${metricas.total}`}
            sub={`${metricas.pct}% concluído`}
            subColor="text-green-600 font-medium"
          />
          <MetricCard
            label="Área total"
            value={`${metricas.areaTotal.toFixed(1)} ha`}
            sub="Área planejada"
          />
          <MetricCard
            label="Custo total"
            value="—"
            sub="Custo do planejamento"
          />
          <MetricCard
            label="Custo/ha"
            value="—"
            sub="Custo médio por hectare"
          />
          <MetricCard
            label="Custo/saca"
            value="—"
            sub={metricas.mediaSc != null ? `Base: ${metricas.mediaSc.toFixed(1)} sc/ha` : 'Base: —'}
          />
        </div>
      )}

      {/* 3. Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/10">
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Talhão</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Área (ha)</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Prod. (sc/ha)</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">N kg/ha</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">P₂O₅ kg/ha</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">K₂O kg/ha</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">B kg/ha</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Produto principal</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Dose (kg/ha)</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custo/ha</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Custo total</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-2 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((r, i) => {
                const expandido = expandidos.has(r.talhao.id);
                return (
                  <React.Fragment key={r.talhao.id}>
                    <tr className={`border-b border-border/50 transition-colors ${expandido ? 'bg-primary/5 border-l-4 border-l-primary' : i%2===0?'':'bg-muted/5'} hover:bg-muted/10`}>
                      {/* ▶ seta */}
                      <td className="px-3 py-2.5 text-center">
                        <button type="button" onClick={() => toggleExpand(r.talhao.id)}
                          className="text-muted-foreground hover:text-primary transition-colors">
                          {expandido
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">{r.talhao.nome}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.talhao.area_ha ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">
                        {r.mediaBienal != null ? r.mediaBienal.toFixed(1) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.rec?.N ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.rec?.P ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.rec?.K ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.rec?.B ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs max-w-[160px] truncate">
                        {r.produtoSugerido ? <span className="font-medium">{r.produtoSugerido.nome}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">
                        {r.doseProdutoHa != null ? r.doseProdutoHa : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">—</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">—</td>
                      <td className="px-3 py-2.5 text-center">
                        <StatusBadgePlan rec={r.rec} />
                      </td>
                      <td className="px-2 py-2.5">
                        <MenuAcoes onRecalcular={() => {}} onLimpar={() => {}} />
                      </td>
                    </tr>
                    {/* Painel expandido */}
                    {expandido && (
                      <tr>
                        <td colSpan={14} className="p-0 border-b border-border">
                          <PainelTalhao resultado={r} onFechar={() => toggleExpand(r.talhao.id)} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legenda + controles */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/10">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Calculado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Pendente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Erro
            </span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={expandirTodos}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
              Expandir todos
            </button>
            <span className="text-muted-foreground">·</span>
            <button type="button" onClick={recolherTodos}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
              Recolher todos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}