import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { LayoutList, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

// ── Helpers (idênticos ao módulo antigo) ─────────────────────────────────────

function getMetros(talhao) {
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',', '.')));
  const linhaM = partes?.[0] || 0;
  if (talhao?.num_plantas && linhaM > 0) return talhao.num_plantas * linhaM;
  if (talhao?.area_ha && linhaM > 0) return Math.round((talhao.area_ha * 10000) / linhaM);
  return 0;
}

function baseKey(nutrienteKey) {
  return nutrienteKey?.split('__')[0] || nutrienteKey;
}

const ORDEM_NUTRIENTE = ['calagem', 'mg_pct', 'n_pct', 'p2o5_pct', 'k2o_pct', 'ca_pct', 's_pct', 'zn_pct', 'b_pct', 'mn_pct', 'cu_pct', 'fe_pct'];

function ordemNutriente(key) {
  const base = baseKey(key);
  const idx = ORDEM_NUTRIENTE.indexOf(base);
  return idx === -1 ? 99 : idx;
}

function formatEpoca(plan) {
  const isCalagem = baseKey(plan.nutriente_key) === 'calagem';
  if (isCalagem) return 'A definir';
  const numAplic = plan.num_aplic || 1;
  const mesesArr = plan.meses || [];
  if (numAplic === 1) {
    const m = mesesArr[0];
    const arr = Array.isArray(m) ? m : (m ? [m] : []);
    return arr.length > 0 ? arr.join(', ') : '—';
  }
  return Array.from({ length: numAplic }, (_, i) => {
    const m = mesesArr[i];
    const arr = Array.isArray(m) ? m : (m ? [m] : []);
    return `${i + 1}ª: ${arr.length > 0 ? arr.join(', ') : '—'}`;
  });
}

function ordemConsolidado(nomeProd, isCalagem) {
  if (isCalagem) return 1;
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

export default function AbaResumoGeral2({ produtor, safra, talhoes }) {
  const codigoProdutor = produtor?.codigo;

  const { data: planejamentos = [], isLoading } = useQuery({
    queryKey: ['base_planejamento_resumo2', codigoProdutor, safra],
    queryFn: () => codigoProdutor && safra
      ? base44.entities.BasePlanejamentoAdubacao.filter({ codigo_produtor: codigoProdutor, safra })
      : Promise.resolve([]),
    enabled: !!(codigoProdutor && safra),
  });

  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples  = [] } = useQuery({ queryKey: ['fontes_simples'],  queryFn: () => base44.entities.FonteSimples.list() });

  const todosProdutos = useMemo(() => [...fertilizantes, ...fontesSimples], [fertilizantes, fontesSimples]);

  const talhoesProdutor = useMemo(() =>
    talhoes.filter(t => t.codigo_produtor === codigoProdutor),
    [talhoes, codigoProdutor]);

  // Grupos por talhão
  const grupos = useMemo(() => {
    return talhoesProdutor.map(talhao => {
      const area = talhao.area_ha || 0;
      const numPlantas = talhao.num_plantas || 0;
      const metros = getMetros(talhao);

      const plansTalhao = planejamentos
        .filter(p => p.talhao_id === talhao.id)
        .filter(p => {
          if (!p.produto_id) return false;
          const nome = (p.produto_nome || '').trim().toLowerCase();
          if (nome === 'nenhum produto' || nome === '') return false;
          const dose = parseFloat(p.dose_rec_manual) || 0;
          return dose > 0;
        })
        .sort((a, b) => ordemNutriente(a.nutriente_key) - ordemNutriente(b.nutriente_key));

      const linhas = plansTalhao.map(plan => {
        const produto = todosProdutos.find(p => p.id === plan.produto_id) || null;
        const isCalagem = baseKey(plan.nutriente_key) === 'calagem';
        let doseProdHa = 0;
        if (isCalagem) {
          doseProdHa = parseFloat(plan.dose_rec_manual) || 0;
        } else {
          const doseNutri = parseFloat(plan.dose_rec_manual) || 0;
          const pctNutri = produto ? (parseFloat(produto[baseKey(plan.nutriente_key)]) || 0) : 0;
          doseProdHa = pctNutri > 0
            ? Math.round((doseNutri / (pctNutri / 100)) * 10) / 10
            : doseNutri;
        }
        const totalKg = area > 0 && doseProdHa > 0 ? Math.round(doseProdHa * area) : null;
        const gPlanta = numPlantas > 0 && totalKg != null ? Math.round((totalKg * 1000) / numPlantas) : null;
        const gMetro  = metros > 0 && totalKg != null ? Math.round((totalKg * 1000) / metros) : null;
        const epoca   = formatEpoca(plan);
        return { produtoNome: plan.produto_nome || produto?.nome || '—', totalKg, gPlanta, gMetro, epoca, isCalagem };
      });

      return { talhao, linhas };
    }).filter(g => g.linhas.length > 0);
  }, [talhoesProdutor, planejamentos, todosProdutos]);

  // Consolidado por produto
  const consolidado = useMemo(() => {
    function normKey(nome) {
      return (nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    }
    const map = new Map();
    planejamentos.forEach(plan => {
      if (!plan.produto_id) return;
      const nome = (plan.produto_nome || '').trim();
      if (!nome || nome.toLowerCase() === 'nenhum produto') return;
      const talhao = talhoesProdutor.find(t => t.id === plan.talhao_id);
      const area = talhao?.area_ha || 0;
      const isCalagem = baseKey(plan.nutriente_key) === 'calagem';
      const dose = parseFloat(plan.dose_rec_manual) || 0;
      if (dose <= 0) return;
      let doseProdHa = 0;
      if (isCalagem) {
        doseProdHa = dose;
      } else {
        const produto = todosProdutos.find(p => p.id === plan.produto_id);
        const pctNutri = produto ? (parseFloat(produto[baseKey(plan.nutriente_key)]) || 0) : 0;
        doseProdHa = pctNutri > 0 ? Math.round((dose / (pctNutri / 100)) * 10) / 10 : dose;
      }
      const totalKg = area > 0 && doseProdHa > 0 ? Math.round(doseProdHa * area) : 0;
      const preco = parseFloat(String(plan.preco || '').replace(',', '.')) || null;
      const key = normKey(nome);
      if (!map.has(key)) map.set(key, { produtoNome: nome, totalKg: 0, preco: null, isCalagem });
      const entry = map.get(key);
      entry.totalKg += totalKg;
      if (nome.length > entry.produtoNome.length) entry.produtoNome = nome;
      if (entry.preco == null && preco) entry.preco = preco;
    });
    return Array.from(map.values()).sort((a, b) => {
      const oa = ordemConsolidado(a.produtoNome, a.isCalagem);
      const ob = ordemConsolidado(b.produtoNome, b.isCalagem);
      if (oa !== ob) return oa - ob;
      return a.produtoNome.localeCompare(b.produtoNome, 'pt-BR');
    });
  }, [planejamentos, talhoesProdutor, todosProdutos]);

  if (!produtor || !safra) return (
    <div className="text-center py-16 text-muted-foreground">
      <LayoutList className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-lg font-medium">Selecione produtor e safra para ver o resumo.</p>
    </div>
  );

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>Carregando planejamentos...</span>
    </div>
  );

  if (grupos.length === 0) return (
    <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-2xl">
      <LayoutList className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-lg font-medium">Nenhum planejamento encontrado.</p>
      <p className="text-sm mt-1">Salve o planejamento na aba "Planejamento" antes de visualizar o resumo.</p>
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
                  const totalGeral = consolidado.reduce((acc, item) => {
                    return acc + (item.preco && item.totalKg ? item.totalKg * item.preco : 0);
                  }, 0);
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
                  {['Produto', 'Qtd. total (kg)', 'g / planta', 'g / metro', 'Época de aplicação'].map(h => (
                    <th key={h} className={`px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap ${h === 'Produto' || h === 'Época de aplicação' ? 'text-left' : 'text-right'}`}>{h}</th>
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
                      {linhas.map((linha, li) => {
                        const epocaArr = Array.isArray(linha.epoca) ? linha.epoca : null;
                        const epocaStr = typeof linha.epoca === 'string' ? linha.epoca : null;
                        return (
                          <tr key={`${talhao.id}-${li}`}
                            className={`border-b border-border/50 ${li % 2 === 0 ? 'bg-white' : 'bg-muted/20 print-row-alt'}`}>
                            <td className="px-4 py-2.5">
                              <span className="font-medium text-foreground">{linha.produtoNome}</span>
                              {linha.isCalagem && (
                                <span className="ml-2 text-xs bg-lime-100 text-lime-700 border border-lime-200 px-1.5 py-0.5 rounded-full">Calagem</span>
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
                            <td className="px-4 py-2.5">
                              {epocaArr ? (
                                <div className="space-y-0.5">
                                  {epocaArr.map((e, ei) => (
                                    <div key={ei} className="text-xs">
                                      <span className="font-semibold text-primary">{e.split(':')[0]}:</span>
                                      <span className="ml-1">{e.split(':').slice(1).join(':')}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className={`text-sm ${epocaStr === 'A definir' ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                                  {epocaStr || '—'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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