// Badge de "Comparação" mostrado na revisão de importação (individual e lote).
// Mostra o nível do alerta de preço (ATENÇÃO/AUMENTO RELEVANTE/AUMENTO FORTE/
// queda/novo menor/sem histórico) e, no tooltip, o detalhe completo:
// novo preço, média histórica, último preço, menor preço e melhor fornecedor.
import React from 'react';
import { ArrowUp, AlertTriangle, CheckCircle2, TrendingDown, CircleSlash } from 'lucide-react';
import { unidadeDisplay } from '@/lib/analisePrecosNotas';

const fmtR = (v) => (v != null
  ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : '—');
const fmtRU = (v, u) => (v != null ? `${fmtR(v)}/${unidadeDisplay(u)}` : '—');
const fmtData = (d) => { if (!d) return '—'; const [y, m, day] = String(d).split('-'); return y && m && day ? `${day}/${m}/${y}` : d; };

const NIVEL_STYLE = {
  semHistorico: { cor: 'text-muted-foreground bg-muted/40 border-border', Icon: CircleSlash, label: 'Sem histórico' },
  novoMenor: { cor: 'text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/40 dark:border-green-900', Icon: CheckCircle2, label: 'Novo menor' },
  melhorPreco: { cor: 'text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/40 dark:border-green-900', Icon: CheckCircle2, label: 'Melhor preço' },
  normal: { cor: 'text-muted-foreground bg-muted/30 border-border', Icon: null, label: null },
  atencao: { cor: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-900', Icon: AlertTriangle, label: 'Atenção' },
  relevante: { cor: 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/40 dark:border-orange-900', Icon: AlertTriangle, label: 'Aumento relevante' },
  forte: { cor: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/40 dark:border-red-900', Icon: ArrowUp, label: 'Aumento forte' },
  queda: { cor: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900', Icon: TrendingDown, label: null },
};

function tooltipText(alerta) {
  const v = alerta?.variacao;
  const e = alerta?.entry;
  const ref = alerta?.referencia;
  const u = e?.unidade_comparavel;
  const linhas = [];
  linhas.push(`Novo preço: ${fmtRU(e?.preco_unit_comparavel, u)}`);
  if (ref) {
    linhas.push(`Média histórica: ${fmtRU(ref.precoMedio, u)}`);
    linhas.push(`Último preço: ${fmtRU(ref.ultimo.preco, u)} — ${ref.ultimo.fornecedor || '—'} (${fmtData(ref.ultimo.data)})`);
    linhas.push(`Menor preço: ${fmtRU(ref.menor.preco, u)} — ${ref.menor.fornecedor || '—'} (${fmtData(ref.menor.data)})`);
    linhas.push(`Melhor fornecedor: ${ref.menor.fornecedor || '—'}`);
  }
  if (alerta?.obsCompras) linhas.push(alerta.obsCompras);
  return linhas.join('\n');
}

export default function BadgeComparacaoPreco({ alerta }) {
  if (!alerta || alerta.skip) return <span className="text-muted-foreground/40">—</span>;
  const v = alerta.variacao;
  if (!v) return null;
  const style = NIVEL_STYLE[v.nivel] || NIVEL_STYLE.normal;
  const { Icon } = style;

  // Sem histórico: discreto
  if (v.nivel === 'semHistorico') {
    return (
      <span
        title={tooltipText(alerta)}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border whitespace-nowrap ${style.cor}`}
      >
        {Icon ? <Icon className="w-3 h-3" /> : null}
        {alerta.obsCompras || 'Primeira compra'}
      </span>
    );
  }

  // Normal/queda: discreto, sem badge forte
  if (v.nivel === 'normal') {
    return (
      <span
        title={tooltipText(alerta)}
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap"
      >
        +{v.variacaoPct?.toFixed(1)}% vs média
      </span>
    );
  }
  if (v.nivel === 'queda') {
    return (
      <span
        title={tooltipText(alerta)}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border whitespace-nowrap ${style.cor}`}
      >
        {Icon ? <Icon className="w-3 h-3" /> : null}
        {Math.abs(v.variacaoPct).toFixed(1)}% abaixo
      </span>
    );
  }

  // novoMenor / melhorPreco / atencao / relevante / forte
  const textoCurto = v.nivel === 'atencao' || v.nivel === 'relevante' || v.nivel === 'forte'
    ? `+${v.variacaoPct?.toFixed(1)}%`
    : style.label;
  return (
    <span
      title={tooltipText(alerta)}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap ${style.cor}`}
    >
      {Icon ? <Icon className="w-3 h-3" /> : null}
      {textoCurto}
    </span>
  );
}

// Resumo de alertas de uma NF (usado no lote). Conta aumentos fortes/fracos.
export function ResumoAlertasLote({ analise }) {
  if (!analise || !analise.length) return null;
  let aumentos = 0;
  let quedas = 0;
  let semHist = 0;
  let normais = 0;
  analise.forEach((a) => {
    if (!a || a.skip) return;
    const n = a.variacao?.nivel;
    if (n === 'atencao' || n === 'relevante' || n === 'forte') aumentos += 1;
    else if (n === 'queda' || n === 'novoMenor' || n === 'melhorPreco') quedas += 1;
    else if (n === 'semHistorico') semHist += 1;
    else if (n === 'normal') normais += 1;
  });
  const parts = [];
  if (aumentos > 0) parts.push(<span key="aum" className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium"><ArrowUp className="w-3 h-3" /> {aumentos} {aumentos === 1 ? 'aumento' : 'aumentos'}</span>);
  if (quedas > 0) parts.push(<span key="q" className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium"><TrendingDown className="w-3 h-3" /> {quedas} {quedas === 1 ? 'queda' : 'quedas'}</span>);
  if (semHist > 0) parts.push(<span key="sh" className="inline-flex items-center gap-1 text-muted-foreground font-medium"><CircleSlash className="w-3 h-3" /> {semHist} sem histórico</span>);
  if (!parts.length && normais > 0) parts.push(<span key="n" className="text-muted-foreground">{normais} normais</span>);
  if (!parts.length) return null;
  return <span className="inline-flex flex-wrap items-center gap-2">{parts}</span>;
}

export { fmtR, fmtRU, fmtData };