import React, { useMemo } from 'react';
import { LayoutList, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sugerirProdutosInteligente } from '@/lib/sugerirProdutos2';

const PRINT_STYLES = `
@media print {
  body > * { display: none !important; }
  #resumo2-print-area { display: block !important; }
  #resumo2-print-area * { visibility: visible; }
  #resumo2-print-area { position: fixed; top: 0; left: 0; width: 100%; }
  .resumo2-print-btn { display: none !important; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background-color: #e8f5e9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 700; padding: 6px 8px; border-bottom: 1px solid #ccc; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .print-row-alt { background-color: #f5f5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-row-talhao { background-color: #c8e6c9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 700; }
}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMetros(talhao) {
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',', '.')));
  const linhaM = partes?.[0] || 0;
  if (talhao?.num_plantas && linhaM > 0) return talhao.num_plantas * linhaM;
  if (talhao?.area_ha && linhaM > 0) return Math.round((talhao.area_ha * 10000) / linhaM);
  return 0;
}

function ordemConsolidado(nomeProd) {
  const n = (nomeProd || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/calcari/.test(n)) return 1;
  if (/sulfato.de.magnesio|kieserit/.test(n)) return 2;
  if (/\d{1,2}-\d{1,2}-\d{1,2}/.test(n)) return 3;
  if (/sulfato.de.zinco|acido.borico|ulexita|sulfato.de.manganes|borac/.test(n)) return 4;
  return 5;
}

function formatQtd(kg) {
  if (kg == null) return '—';
  if (kg >= 1000) return `${(kg / 1000).toFixed(2).replace('.', ',')} t`;
  return `${kg.toLocaleString('pt-BR')} kg`;
}

// ── Componente ────────────────────────────────────────────────────────────────

/**
 * Props:
 *  - resultados: array igual ao de AbaPlanejamento2 (talhao, rec, mediaBienal, analise, analise2040, produtoSugerido, doseProdutoHa)
 *  - todos: lista de fertilizantes+fontesSimples
 *  - produtosEfetivos: mapa { [talhaoId]: { produto, doseKgHa } } — produto efetivo salvo/escolhido manualmente
 *  - produtor: objeto produtor
 *  - safra: string
 */
export default function AbaResumoGeral2({ resultados, todos, produtosEfetivos = {}, produtor, safra }) {

  // Constrói grupos por talhão usando o produto efetivo (salvo/filtrado) quando disponível
  const grupos = useMemo(() => {
    if (!resultados || resultados.length === 0) return [];
    return resultados
      .filter(r => r.rec)
      .map(r => {
        const { talhao, rec } = r;
        const area = talhao.area_ha || 0;
        const numPlantas = talhao.num_plantas || 0;
        const metros = getMetros(talhao);

        // Produto salvo no banco (restaurado em detalhamento.produtoSugerido)
        const produtoSalvo = r.produtoSugerido || null;
        const doseSalva = r.doseProdutoHa || null;

        // Produto efetivo do filtro atual (se aba Planejamento foi aberta nesta sessão)
        const efetivo = produtosEfetivos[talhao.id];

        // Prioridade: efetivo da sessão > salvo no banco > recalcula
        let produtoPrincipal = efetivo?.produto || produtoSalvo;
        let dosePrincipal = efetivo?.doseKgHa ?? doseSalva;

        // Fallback: recalcula se não há produto persistido
        if (!produtoPrincipal && todos.length > 0) {
          const sugestoes = sugerirProdutosInteligente(todos, { N: rec.N, P: rec.P, K: rec.K, B: rec.B });
          const sugN = sugestoes['n_pct'];
          if (sugN?.produtoId) {
            const prod = todos.find(p => p.id === sugN.produtoId);
            if (prod) {
              produtoPrincipal = prod;
              const pctN = parseFloat(prod.n_pct) || 0;
              dosePrincipal = pctN > 0 && rec.N != null ? Math.round((rec.N / (pctN / 100)) * 10) / 10 : null;
            }
          }
        }

        if (!produtoPrincipal || !dosePrincipal) return null;

        const totalKg = area > 0 ? Math.round(dosePrincipal * area) : null;
        const gPlanta = numPlantas > 0 && totalKg != null ? Math.round((totalKg * 1000) / numPlantas) : null;
        const gMetro  = metros > 0 && totalKg != null ? Math.round((totalKg * 1000) / metros) : null;

        const linhas = [{ produtoNome: produtoPrincipal.nome, doseKgHa: dosePrincipal, totalKg, gPlanta, gMetro, nutLabels: ['N/P/K'], isCalagem: false }];

        return { talhao, linhas };
      })
      .filter(Boolean);
  }, [resultados, todos, produtosEfetivos]);

  // Consolidado por produto (soma todos os talhões)
  const consolidado = useMemo(() => {
    function normKey(nome) {
      return (nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    }
    const map = new Map();
    grupos.forEach(({ linhas }) => {
      linhas.forEach(l => {
        const key = normKey(l.produtoNome);
        if (!map.has(key)) map.set(key, { produtoNome: l.produtoNome, totalKg: 0, preco: null });
        map.get(key).totalKg += l.totalKg || 0;
      });
    });
    return Array.from(map.values()).sort((a, b) => {
      const oa = ordemConsolidado(a.produtoNome);
      const ob = ordemConsolidado(b.produtoNome);
      if (oa !== ob) return oa - ob;
      return a.produtoNome.localeCompare(b.produtoNome, 'pt-BR');
    });
  }, [grupos]);

  if (!produtor || !safra) return (
    <div className="text-center py-16 text-muted-foreground">
      <LayoutList className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-lg font-medium">Selecione produtor e safra para ver o resumo.</p>
    </div>
  );

  if (!resultados || resultados.length === 0 || grupos.length === 0) return (
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
          const detalheHtml = document.getElementById('resumo2-detalhe-tabela')?.innerHTML || '';
          if (!consolidadoHtml && !detalheHtml) return;
          const janela = window.open('', '_blank');
          janela.document.write(`
            <html><head><title>Resumo Geral — ${produtor.nome} · Safra ${safra}</title>
            <style>
              body { font-family: Arial, sans-serif; font-size: 13px; margin: 24px; }
              h2 { font-size: 15px; margin-bottom: 4px; }
              h3 { font-size: 13px; margin: 18px 0 6px; color: #333; }
              p.sub { font-size: 12px; color: #555; margin-bottom: 16px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
              th, td { border: 1px solid #ccc; padding: 6px 8px; }
              th { background: #f0f0f0; font-weight: 700; }
              .row-talhao td { background: #c8e6c9; font-weight: 700; }
              .row-alt td { background: #f5f5f5; }
              .row-total td { background: #fff3cd; font-weight: 700; }
            </style>
            </head><body>
            <h2>Planejamento de Adubação — Resumo Geral</h2>
            <p class="sub">${produtor.nome} · Fazenda ${produtor.fazenda || '—'} · Safra ${safra}</p>
            <h3>Consolidado de Produtos</h3>
            ${consolidadoHtml}
            <h3>Detalhamento por Talhão</h3>
            ${detalheHtml}
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
                  {['Produto', 'Quantidade total', 'Preço unit. (R$/kg)', 'Custo total (R$)'].map(h => (
                    <th key={h} className={`px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap ${h === 'Produto' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {consolidado.map((item, i) => {
                  const custo = item.preco && item.totalKg ? item.totalKg * item.preco : null;
                  return (
                    <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}`}>
                      <td className="px-4 py-2.5 font-medium">{item.produtoNome}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatQtd(item.totalKg)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {item.preco ? item.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {custo != null ? custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {(() => {
                  const totalGeral = consolidado.reduce((acc, item) => acc + (item.preco && item.totalKg ? item.totalKg * item.preco : 0), 0);
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
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto" id="resumo2-detalhe-tabela">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {['Produto', 'Qtd. total (kg)', 'g / planta', 'g / metro', 'Nutrientes'].map(h => (
                    <th key={h} className={`px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap ${h === 'Produto' || h === 'Nutrientes' ? 'text-left' : 'text-right'}`}>{h}</th>
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
                      <tr className="bg-primary/10 border-b border-primary/20 print-row-talhao">
                        <td colSpan={5} className="px-4 py-2.5 font-bold text-primary text-sm">
                          {partes.join(' · ')}
                        </td>
                      </tr>
                      {linhas.map((linha, li) => (
                        <tr key={`${talhao.id}-${li}`}
                          className={`border-b border-border/50 ${li % 2 === 0 ? 'bg-white' : 'bg-muted/20 print-row-alt'}`}>
                          <td className="px-4 py-2.5 font-medium text-foreground">{linha.produtoNome}</td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                            {linha.totalKg != null ? linha.totalKg.toLocaleString('pt-BR') : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                            {linha.gPlanta != null ? `${linha.gPlanta.toLocaleString('pt-BR')} g` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                            {linha.gMetro != null ? `${linha.gMetro.toLocaleString('pt-BR')} g` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {linha.nutLabels?.join(', ') || '—'}
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

      </div>
    </>
  );
}