import React, { useEffect, useMemo, useState } from 'react';
import { LayoutList, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sugerirProdutosInteligente } from '@/lib/sugerirProdutos2';
import { formatarPrecoUnitarioCalagem, montarGruposResumoAdubacao2 } from '@/lib/calagemAdubacao2';
import { formatarPrecoUnitarioGessagem } from '@/lib/gessagemAdubacao2';
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
} from '@/lib/graficosAnalisesSoloAdubacao2';

const PRINT_STYLES = `
@media print {
  body > * { display: none !important; }
  #resumo2-print-area { display: block !important; }
  #resumo2-print-area * { visibility: visible; }
  #resumo2-print-area { position: fixed; top: 0; left: 0; width: 100%; }
  .resumo2-print-btn { display: none !important; }
  .resumo2-screen-detail { display: none !important; }
  .resumo2-print-only { display: block !important; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10.5px; }
  th { background-color: #e8f5e9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 700; padding: 6px 8px; border-bottom: 1px solid #ccc; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; overflow-wrap: anywhere; }
  .print-row-alt { background-color: #f5f5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-row-talhao { background-color: #d9f2df !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 700; }
  .print-row-talhao + tr { break-before: avoid; page-break-before: avoid; }
  .resumo2-comparacao-print, .resumo2-evolucao-print { break-inside: avoid; page-break-inside: avoid; }
  .resumo2-comparacao-print svg, .resumo2-evolucao-print svg { max-width: 100%; height: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .col-produto { width: 26%; }
  .col-qtd { width: 12%; }
  .col-g { width: 10%; }
  .col-preco { width: 13%; }
  .col-custo { width: 12%; }
  .col-periodo { width: 17%; }
}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ordemConsolidado(nomeProd) {
  const n = (nomeProd || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/calcari/.test(n)) return 1;
  if (/gesso/.test(n)) return 2;
  if (/sulfato.de.magnesio|kieserit/.test(n)) return 3;
  if (/\d{1,2}-\d{1,2}-\d{1,2}/.test(n)) return 4;
  if (/sulfato.de.zinco|acido.borico|ulexita|sulfato.de.manganes|borac/.test(n)) return 5;
  return 6;
}

function formatQtd(kg) {
  if (kg == null) return '—';
  if (kg >= 1000) return `${(kg / 1000).toFixed(2).replace('.', ',')} t`;
  return `${kg.toLocaleString('pt-BR')} kg`;
}

function formatarPrecoResumo(item) {
  if (item?.isCalagem) return formatarPrecoUnitarioCalagem(item.preco, item.unidadePreco);
  if (item?.isGessagem) return formatarPrecoUnitarioGessagem(item.preco, item.unidadePreco);
  if (item?.preco == null) return '—';
  return `${item.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/kg`;
}

function custoItemConsolidado(item) {
  if (item?.isCalagem || item?.isGessagem) return item.custoTotal != null ? item.custoTotal : null;
  return item.preco && item.totalKg ? item.totalKg * item.preco : null;
}

function formatarMoeda(valor) {
  return valor != null ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
}

function precoLinhaResumo(linha, precosMap) {
  if (linha?.isCalagem) return formatarPrecoUnitarioCalagem(linha.precoUnitario, linha.unidadePreco);
  if (linha?.isGessagem) return formatarPrecoUnitarioGessagem(linha.precoUnitario, linha.unidadePreco);
  const preco = linha?.precoUnitario != null ? linha.precoUnitario : (linha?.produtoId ? Number(precosMap[linha.produtoId]) : null);
  return Number.isFinite(preco) ? `${preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/kg` : '—';
}

function custoHaLinhaResumo(linha, precosMap) {
  if (linha?.custoHa != null) return linha.custoHa;
  if (linha?.isCalagem) return null;
  const preco = linha?.produtoId ? Number(precosMap[linha.produtoId]) : null;
  return Number.isFinite(preco) && linha?.doseKgHa != null ? linha.doseKgHa * preco : null;
}

function custoTotalLinhaResumo(linha, precosMap) {
  if (linha?.custoTotal != null) return linha.custoTotal;
  if (linha?.isCalagem) return null;
  const preco = linha?.produtoId ? Number(precosMap[linha.produtoId]) : null;
  return Number.isFinite(preco) && linha?.totalKg != null ? linha.totalKg * preco : null;
}

function coletarSafrasAnalisesResumo(analises020 = [], analises2040 = [], talhaoId = null) {
  return [...new Set([...analises020, ...analises2040]
    .filter(analise => !talhaoId || analise?.talhao_id === talhaoId)
    .map(analise => analise?.safra)
    .filter(Boolean))]
    .sort();
}

// ── Componente ────────────────────────────────────────────────────────────────

/**
 * Props:
 *  - resultados: array igual ao de AbaPlanejamento2
 *  - todos: lista de fertilizantes+fontesSimples
 *  - produtosEfetivos: mapa { [talhaoId]: { produto, doseKgHa, complementos, precos? } }
 *  - calagens: array de registros BaseRecomendacaoCalagem do produtor/safra
 *  - gessagens: array de registros BaseRecomendacaoGessagem do produtor/safra
 *  - talhoes: lista de talhoes
 *  - produtor: objeto produtor
 *  - safra: string
 *  - analises020: análises 0-20 do produtor
 *  - analises2040: análises 20-40 do produtor
 *  - registrosSalvos: array de PlanejamentoAdubacao2 (contém detalhamento.precos)
 */
export default function AbaResumoGeral2({ resultados, todos, produtosEfetivos = {}, calagens = [], gessagens = [], talhoes = [], produtor, safra, analises020 = [], analises2040 = [], registrosSalvos = [], precosAtuais = {} }) {
  const [graficoTalhaoId, setGraficoTalhaoId] = useState('');
  const [graficoProfundidade, setGraficoProfundidade] = useState('0-20');
  const [graficoNutriente, setGraficoNutriente] = useState('magnesio');
  const [graficoSafras, setGraficoSafras] = useState([]);
  const [modoGraficoResumo, setModoGraficoResumo] = useState('todos_talhoes');

  // Mapa de preços salvos por produto (de todos os registros)
  const precosMap = useMemo(() => {
    const m = {};
    registrosSalvos.forEach(r => {
      const precos = r.detalhamento?.precos || {};
      Object.assign(m, precos);
    });
    Object.assign(m, precosAtuais || {});
    return m;
  }, [registrosSalvos, precosAtuais]);

  // Constrói grupos por talhão (adubação principal + complementares + calagem)
  const grupos = useMemo(() => montarGruposResumoAdubacao2({
    resultados,
    todos,
    produtosEfetivos,
    calagens,
    gessagens,
    talhoes,
    codigoProdutor: produtor?.codigo,
    safra,
    sugerirProdutos: sugerirProdutosInteligente,
    registrosSalvos,
    precosAtuais,
  }), [resultados, todos, produtosEfetivos, calagens, gessagens, talhoes, produtor, safra, registrosSalvos, precosAtuais]);

  useEffect(() => {
    const primeiroTalhao = grupos[0]?.talhao?.id || talhoes[0]?.id || '';
    setGraficoTalhaoId(prev => talhoes.some(t => t.id === prev) ? prev : primeiroTalhao);
  }, [grupos, talhoes]);

  const safrasGraficosDisponiveis = useMemo(() => coletarSafrasAnalisesResumo(analises020, analises2040, graficoTalhaoId), [analises020, analises2040, graficoTalhaoId]);

  useEffect(() => {
    setGraficoSafras(prev => {
      const validas = prev.filter(item => safrasGraficosDisponiveis.includes(item));
      if (validas.length > 0) return validas;
      if (safra && safrasGraficosDisponiveis.includes(safra)) return [safra];
      return safrasGraficosDisponiveis.slice(-3);
    });
  }, [safrasGraficosDisponiveis, safra]);

  const adequacaoGrafico = useMemo(() => montarAdequacaoSafraAtual({
    analises020,
    analises2040,
    talhaoId: graficoTalhaoId,
    safra,
    profundidade: graficoProfundidade,
  }), [analises020, analises2040, graficoTalhaoId, safra, graficoProfundidade]);

  const serieGrafico = useMemo(() => montarSerieEvolucaoAnalises({
    analises020,
    analises2040,
    talhaoId: graficoTalhaoId,
    nutriente: graficoNutriente,
    profundidade: graficoProfundidade,
    safras: graficoSafras,
  }), [analises020, analises2040, graficoTalhaoId, graficoNutriente, graficoProfundidade, graficoSafras]);

  const svgAdequacao = useMemo(() => gerarSvgAdequacaoSolo(adequacaoGrafico, { largura: 680 }), [adequacaoGrafico]);
  const svgEvolucao = useMemo(() => gerarSvgEvolucaoSolo(serieGrafico, { largura: 680, altura: 240 }), [serieGrafico]);
  const comparacaoTalhoesGrafico = useMemo(() => montarComparacaoTalhoesSafraAtual({
    talhoes,
    analises020,
    analises2040,
    safra,
    profundidade: graficoProfundidade,
    nutrientes: NUTRIENTES_PADRAO_TODOS_TALHOES,
  }), [talhoes, analises020, analises2040, safra, graficoProfundidade]);
  const svgComparacaoTalhoes = useMemo(() => gerarSvgComparacaoTalhoesSolo(comparacaoTalhoesGrafico, { largura: 680, altura: 300 }), [comparacaoTalhoesGrafico]);
  const talhaoGrafico = talhoes.find(t => t.id === graficoTalhaoId) || null;

  const alternarSafraGrafico = (safraItem) => {
    setGraficoSafras(prev => prev.includes(safraItem)
      ? prev.filter(item => item !== safraItem)
      : [...prev, safraItem].sort());
  };

  // Consolidado por produto (soma todos os talhões)
  const consolidado = useMemo(() => {
    function normKey(nome) {
      return (nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    }
    const map = new Map();
    grupos.forEach(({ linhas }) => {
      linhas.forEach(l => {
        const key = normKey(l.produtoNome);
        if (!map.has(key)) {
          const precoSalvo = l.produtoId ? parseFloat(precosMap[l.produtoId]) || null : null;
          map.set(key, {
            produtoNome: l.produtoNome,
            totalKg: 0,
            preco: l.isCalagem ? l.precoUnitario : precoSalvo,
            unidadePreco: l.unidadePreco || 'kg',
            custoTotal: 0,
            isCalagem: Boolean(l.isCalagem),
            isGessagem: Boolean(l.isGessagem),
          });
        }
        const item = map.get(key);
        item.totalKg += l.totalKg || 0;
        if (l.isCalagem) {
          item.custoTotal += l.custoTotal || 0;
          if (item.preco == null && l.precoUnitario != null) item.preco = l.precoUnitario;
          item.unidadePreco = l.unidadePreco || item.unidadePreco;
        }
        if (l.isGessagem) {
          item.custoTotal += l.custoTotal || 0;
          if (item.preco == null && l.precoUnitario != null) item.preco = l.precoUnitario;
          item.unidadePreco = l.unidadePreco || item.unidadePreco;
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => {
      const oa = ordemConsolidado(a.produtoNome);
      const ob = ordemConsolidado(b.produtoNome);
      if (oa !== ob) return oa - ob;
      return a.produtoNome.localeCompare(b.produtoNome, 'pt-BR');
    });
  }, [grupos, precosMap]);

  if (!produtor || !safra) return (
    <div className="text-center py-16 text-muted-foreground">
      <LayoutList className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-lg font-medium">Selecione produtor e safra para ver o resumo.</p>
    </div>
  );

  if (grupos.length === 0) return (
    <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-2xl">
      <LayoutList className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-lg font-medium">Nenhum planejamento encontrado.</p>
      <p className="text-sm mt-1">Calcule a recomendação na aba "Análises e Importação" para gerar o resumo.</p>
    </div>
  );

  return (
    <>
      <style>{PRINT_STYLES}</style>

      {/* Botão imprimir */}
      <div className="flex justify-end mb-3 resumo2-print-btn">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => {
          const consolidadoHtml = document.getElementById('resumo2-consolidado-tabela')?.innerHTML || '';
          const detalheHtml = document.getElementById('resumo2-detalhe-print-tabela')?.innerHTML || '';
          const comparacaoHtml = document.getElementById('resumo2-comparacao-print-svg')?.innerHTML ||
            document.getElementById('resumo2-comparacao-print')?.innerHTML || '';
          if (!consolidadoHtml && !detalheHtml && !comparacaoHtml) return;
          const janela = window.open('', '_blank');
          janela.document.write(`
            <html><head><title>Resumo Geral — ${produtor.nome} · Safra ${safra}</title>
            <style>
              body { font-family: Arial, sans-serif; font-size: 13px; margin: 24px; }
              h2 { font-size: 15px; margin-bottom: 4px; }
              h3 { font-size: 13px; margin: 18px 0 6px; color: #333; }
              p.sub { font-size: 12px; color: #555; margin-bottom: 16px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 8px; table-layout: fixed; }
              th, td { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; overflow-wrap: anywhere; }
              th { background: #f0f0f0; font-weight: 700; }
              th, .row-talhao td, .row-alt td, .row-total td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .row-talhao td { background: #d9f2df !important; font-weight: 700; }
              .row-talhao + tr { break-before: avoid; page-break-before: avoid; }
              .row-alt td { background: #f5f5f5; }
              .row-total td { background: #fff3cd; font-weight: 700; }
              .resumo2-print-btn { display: none !important; }
              .resumo2-comparacao-print { page-break-inside: avoid; break-inside: avoid; }
              .resumo2-comparacao-print svg { max-width: 100%; height: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .col-produto { width: 26%; }
              .col-qtd { width: 12%; }
              .col-g { width: 10%; }
              .col-preco { width: 13%; }
              .col-custo { width: 12%; }
              .col-periodo { width: 17%; }
            </style>
            </head><body>
            <h2>Planejamento de Adubação — Resumo Geral</h2>
            <p class="sub">${produtor.nome} · Fazenda ${produtor.fazenda || '—'} · Safra ${safra}</p>
            <h3>Consolidado de Produtos</h3>
            ${consolidadoHtml}
            <h3>Detalhamento por Talhão</h3>
            ${detalheHtml}
            <h3>Comparação Nutricional entre Talhões</h3>
            <div class="resumo2-comparacao-print">${comparacaoHtml}</div>
            </body></html>
          `);
          janela.document.close();
          janela.print();
        }}>
          <Printer className="w-4 h-4" />
          Imprimir Resumo
        </Button>
      </div>

      <div id="resumo2-print-area" className="space-y-5">

        {/* Consolidado de Produtos */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/20">
            <h3 className="font-bold text-sm">Consolidado de Produtos</h3>
          </div>
          <div className="overflow-x-auto" id="resumo2-consolidado-tabela">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {['Produto', 'Quantidade total', 'Preço unitário', 'Custo total (R$)'].map(h => (
                    <th key={h} className={`px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap ${h === 'Produto' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {consolidado.map((item, i) => {
                  const custo = custoItemConsolidado(item);
                  return (
                    <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}`}>
                      <td className="px-4 py-2.5 font-medium">{item.produtoNome}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatQtd(item.totalKg)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatarPrecoResumo(item)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {custo != null ? custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {(() => {
                  const totalGeral = consolidado.reduce((acc, item) => acc + (custoItemConsolidado(item) || 0), 0);
                  return totalGeral > 0 ? (
                    <tr className="bg-amber-50 border-t-2 border-amber-200">
                      <td colSpan={3} className="px-4 py-2.5 font-bold text-amber-800 uppercase tracking-wide text-xs">Total Geral</td>
                      <td className="px-4 py-2.5 text-right font-bold text-amber-800 tabular-nums">
                        {totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                    </tr>
                  ) : null;
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Separador */}
        <div className="flex items-center gap-2 pt-2">
          <LayoutList className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-base">Detalhamento por Talhão</h3>
          <span className="text-xs text-muted-foreground">Safra {safra}</span>
        </div>

        {/* Detalhamento por Talhão */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden resumo2-screen-detail">
          <div className="overflow-x-auto" id="resumo2-detalhe-tabela">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {['Produto', 'Qtd. total (kg)', 'g / planta', 'g / metro', 'Preço unitário', 'Custo/ha', 'Custo total', 'Período de aplicação', 'Nutrientes'].map(h => (
                    <th key={h} className={`px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap ${h === 'Produto' || h === 'Período de aplicação' || h === 'Nutrientes' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grupos.map(({ talhao, linhas }) => {
                  const partes = [talhao.nome];
                  if (talhao.area_ha) partes.push(`${talhao.area_ha} ha`);
                  if (talhao.num_plantas) partes.push(`${talhao.num_plantas.toLocaleString()} plantas`);
                  if (talhao.espacamento) partes.push(talhao.espacamento);
                  return (
                    <React.Fragment key={talhao.id}>
                      <tr className="row-talhao bg-primary/10 border-b border-primary/20 print-row-talhao">
                        <td colSpan={9} className="px-4 py-2.5 font-bold text-foreground text-sm">
                          {partes.join(' · ')}
                        </td>
                      </tr>
                      {linhas.map((linha, li) => (
                       <tr key={`${talhao.id}-${li}`}
                         className={`border-b border-border/50 ${linha.isCalagem ? 'bg-amber-50/60' : li % 2 === 0 ? 'bg-white' : 'bg-muted/20 print-row-alt'}`}>
                         <td className="px-4 py-2.5 font-medium text-foreground">
                           {linha.produtoNome}
                           {linha.pendenteProduto && (
                             <span className="block text-[10px] font-semibold text-amber-700 mt-0.5">Selecione o corretivo para salvar e enviar às compras</span>
                           )}
                         </td>
                         <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                           {linha.totalKg != null ? linha.totalKg.toLocaleString('pt-BR') : '—'}
                         </td>
                         <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                           {linha.gPlanta != null ? `${linha.gPlanta.toLocaleString('pt-BR')} g` : '—'}
                         </td>
                         <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                           {linha.gMetro != null ? `${linha.gMetro.toLocaleString('pt-BR')} g` : '—'}
                         </td>
                         <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                           {linha.isCalagem ? formatarPrecoUnitarioCalagem(linha.precoUnitario, linha.unidadePreco) : (linha.produtoId && precosMap[linha.produtoId] ? `${Number(precosMap[linha.produtoId]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/kg` : '—')}
                         </td>
                         <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                           {formatarMoeda(custoHaLinhaResumo(linha, precosMap))}
                         </td>
                         <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                           {formatarMoeda(custoTotalLinhaResumo(linha, precosMap))}
                         </td>
                         <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-pre-line min-w-[150px]">
                           {(linha.periodoAplicacao || 'A definir').split('\n').map((parte, idx) => (
                             <div key={idx}>{parte}</div>
                           ))}
                         </td>
                         <td className="px-4 py-2.5 text-xs">
                           {linha.isCalagem ? (
                             <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">Calagem</span>
                           ) : linha.isGessagem ? (
                             <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 border border-sky-300">Gessagem</span>
                           ) : (
                             <span className="text-muted-foreground">{linha.nutLabels?.join(', ') || '—'}</span>
                           )}
                         </td>
                       </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="hidden resumo2-print-only" id="resumo2-detalhe-print-tabela">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                {['Produto', 'Qtd. total', 'g/planta', 'g/metro', 'Preço unitário', 'Custo/ha', 'Período de aplicação'].map(h => (
                  <th key={h} className={`px-3 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide ${h === 'Produto' || h === 'Período de aplicação' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map(({ talhao, linhas }) => {
                const partes = [talhao.nome];
                if (talhao.area_ha) partes.push(`${talhao.area_ha} ha`);
                if (talhao.num_plantas) partes.push(`${talhao.num_plantas.toLocaleString()} plantas`);
                if (talhao.espacamento) partes.push(talhao.espacamento);
                return (
                  <React.Fragment key={`print-${talhao.id}`}>
                    <tr className="row-talhao print-row-talhao">
                      <td colSpan={7} className="px-3 py-2 font-bold text-foreground text-sm">
                        {partes.join(' · ')}
                      </td>
                    </tr>
                    {linhas.map((linha, li) => (
                     <tr key={`print-${talhao.id}-${li}`}
                       className={`border-b border-border/50 ${li % 2 === 0 ? 'bg-white' : 'bg-muted/20 print-row-alt'}`}>
                       <td className="px-3 py-2 font-medium text-foreground col-produto">{linha.produtoNome}</td>
                       <td className="px-3 py-2 text-right font-semibold tabular-nums col-qtd">{linha.totalKg != null ? formatQtd(linha.totalKg) : '—'}</td>
                       <td className="px-3 py-2 text-right tabular-nums text-muted-foreground col-g">{linha.gPlanta != null ? `${linha.gPlanta.toLocaleString('pt-BR')} g` : '—'}</td>
                       <td className="px-3 py-2 text-right tabular-nums text-muted-foreground col-g">{linha.gMetro != null ? `${linha.gMetro.toLocaleString('pt-BR')} g` : '—'}</td>
                       <td className="px-3 py-2 text-right tabular-nums text-muted-foreground col-preco">{precoLinhaResumo(linha, precosMap)}</td>
                       <td className="px-3 py-2 text-right tabular-nums text-muted-foreground col-custo">{formatarMoeda(custoHaLinhaResumo(linha, precosMap))}</td>
                       <td className="px-3 py-2 text-xs text-muted-foreground whitespace-pre-line col-periodo">
                         {(linha.periodoAplicacao || 'A definir').split('\n').map((parte, idx) => (
                           <div key={idx}>{parte}</div>
                         ))}
                       </td>
                     </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden resumo2-comparacao-print" id="resumo2-comparacao-print">
          <div className="px-5 py-3 border-b border-border bg-muted/20">
            <h3 className="font-bold text-sm">Comparação Nutricional entre Talhões</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Safra {safra} · Profundidade {graficoProfundidade} cm · Índice de adequação (%)
            </p>
          </div>
          <div className="resumo2-print-btn flex flex-wrap items-center gap-2 p-4 border-b border-border/50">
            <button
              type="button"
              onClick={() => setModoGraficoResumo('todos_talhoes')}
              className={`text-xs rounded-full border px-3 py-1 ${modoGraficoResumo === 'todos_talhoes' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border'}`}
            >
              Todos os talhões
            </button>
            <button
              type="button"
              onClick={() => setModoGraficoResumo('evolucao_talhao')}
              className={`text-xs rounded-full border px-3 py-1 ${modoGraficoResumo === 'evolucao_talhao' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border'}`}
            >
              Ver evolução de um talhão
            </button>
            <div className="ml-auto w-full sm:w-auto">
              <label className="text-xs text-muted-foreground block mb-1">Profundidade</label>
              <select value={graficoProfundidade} onChange={e => setGraficoProfundidade(e.target.value)} className="h-8 w-full sm:w-40 text-xs border border-input rounded px-2 bg-background">
                {PROFUNDIDADES_ANALISE_SOLO.map(item => <option key={item} value={item}>{item} cm</option>)}
              </select>
            </div>
          </div>

          {modoGraficoResumo === 'evolucao_talhao' && (
          <div className="resumo2-print-btn grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 border-b border-border/50">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Talhão</label>
              <select value={graficoTalhaoId} onChange={e => setGraficoTalhaoId(e.target.value)} className="h-8 w-full text-xs border border-input rounded px-2 bg-background">
                {talhoes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nutriente</label>
              <select value={graficoNutriente} onChange={e => setGraficoNutriente(e.target.value)} className="h-8 w-full text-xs border border-input rounded px-2 bg-background">
                {NUTRIENTES_GRAFICOS_SOLO.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Safras comparadas</label>
              <div className="min-h-8 rounded-md border border-input bg-background px-2 py-1 flex flex-wrap gap-1">
                {safrasGraficosDisponiveis.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground py-0.5">Sem safras disponíveis</span>
                ) : safrasGraficosDisponiveis.map(safraItem => (
                  <button
                    key={safraItem}
                    type="button"
                    onClick={() => alternarSafraGrafico(safraItem)}
                    className={`text-[11px] rounded-full border px-2 py-0.5 ${graficoSafras.includes(safraItem) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border'}`}
                  >
                    {safraItem}
                  </button>
                ))}
              </div>
            </div>
          </div>
          )}
          <div className="p-4 space-y-4">
            {modoGraficoResumo === 'todos_talhoes' && (
              <>
                <div className="text-xs text-muted-foreground">
                  Safra: <strong>{safra}</strong> · Profundidade: <strong>{graficoProfundidade} cm</strong> · Legenda por nutriente no SVG
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-[640px]" dangerouslySetInnerHTML={{ __html: svgComparacaoTalhoes }} />
                </div>
              </>
            )}
            <div className="hidden resumo2-print-only" id="resumo2-comparacao-print-svg">
              <div className="text-xs text-muted-foreground">
                Safra: <strong>{safra}</strong> · Profundidade: <strong>{graficoProfundidade} cm</strong>
              </div>
              <div dangerouslySetInnerHTML={{ __html: svgComparacaoTalhoes }} />
            </div>
            {modoGraficoResumo === 'evolucao_talhao' && (
            <>
            <div className="text-xs text-muted-foreground">
              Nutriente: <strong>{serieGrafico.label}</strong>{serieGrafico.unidade ? ` (${serieGrafico.unidade})` : ''} · Profundidade: <strong>{graficoProfundidade} cm</strong>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="overflow-x-auto">
                <div className="min-w-[640px]" dangerouslySetInnerHTML={{ __html: svgAdequacao }} />
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[640px]" dangerouslySetInnerHTML={{ __html: svgEvolucao }} />
              </div>
            </div>
            {!serieGrafico.temHistoricoSuficiente && (
              <p className="text-xs text-amber-700">
                Não há histórico suficiente para comparar esta seleção.
              </p>
            )}
            </>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
