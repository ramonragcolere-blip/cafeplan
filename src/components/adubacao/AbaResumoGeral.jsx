import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { LayoutList, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PRINT_STYLES = `
@media print {
  body > * { display: none !important; }
  #resumo-geral-print-area { display: block !important; }
  #resumo-geral-print-area * { visibility: visible; }
  #resumo-geral-print-area { position: fixed; top: 0; left: 0; width: 100%; }
  .resumo-print-header { margin-bottom: 16px; }
  .resumo-print-btn { display: none !important; }
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

function baseKey(nutrienteKey) {
  return nutrienteKey?.split('__')[0] || nutrienteKey;
}

// Ordem para ordenação dentro do talhão
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

  // Parcelado: linha por parcela
  return Array.from({ length: numAplic }, (_, i) => {
    const m = mesesArr[i];
    const arr = Array.isArray(m) ? m : (m ? [m] : []);
    const label = `${i + 1}ª`;
    return `${label}: ${arr.length > 0 ? arr.join(', ') : '—'}`;
  });
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function AbaResumoGeral({ produtor, safra, talhoes }) {
  const codigoProdutor = produtor?.codigo;

  const { data: planejamentos = [], isLoading } = useQuery({
    queryKey: ['base_planejamento_resumo', codigoProdutor, safra],
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

  // Constrói linhas agrupadas por talhão
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
          const isCalagem = baseKey(p.nutriente_key) === 'calagem';
          if (!isCalagem) {
            const doseNutri = parseFloat(p.dose_rec_manual) || 0;
            if (doseNutri <= 0) return false;
          } else {
            const dose = parseFloat(p.dose_rec_manual) || 0;
            if (dose <= 0) return false;
          }
          return true;
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

        return {
          produtoNome: plan.produto_nome || produto?.nome || '—',
          totalKg,
          gPlanta,
          gMetro,
          epoca,
          isCalagem,
        };
      });

      return { talhao, linhas };
    }).filter(g => g.linhas.length > 0);
  }, [talhoesProdutor, planejamentos, todosProdutos]);

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

      {/* Botão imprimir — visível apenas na tela */}
      <div className="flex justify-end mb-3 resumo-print-btn">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
          <Printer className="w-4 h-4" />
          Imprimir Resumo
        </Button>
      </div>

      {/* Área de impressão */}
      <div id="resumo-geral-print-area" className="space-y-5">

        {/* Cabeçalho visível apenas na impressão */}
        <div className="resumo-print-header hidden print:block">
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Planejamento de Adubação — Resumo Geral</h2>
          <p style={{ fontSize: 12, color: '#555' }}>{produtor.nome} · Fazenda {produtor.fazenda || '—'} · Safra {safra}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/20 resumo-print-btn">
            <div className="flex items-center gap-2">
              <LayoutList className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-base">Resumo Geral do Planejamento</h3>
              <span className="text-xs text-muted-foreground ml-1">Safra {safra}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Produto</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">Qtd. total (kg)</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">g / planta</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">g / metro</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Época de aplicação</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(({ talhao, linhas }) => (
                  <>
                    <tr key={`hdr-${talhao.id}`} className="bg-primary/10 border-b border-primary/20 print-row-talhao">
                      <td colSpan={5} className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-primary text-sm">{talhao.nome}</span>
                          {talhao.area_ha && <span className="text-xs text-primary/70 font-medium">{talhao.area_ha} ha</span>}
                          {talhao.num_plantas && <span className="text-xs text-primary/70">{talhao.num_plantas.toLocaleString()} plantas</span>}
                          {talhao.espacamento && <span className="text-xs text-primary/70">{talhao.espacamento}</span>}
                        </div>
                      </td>
                    </tr>

                    {linhas.map((linha, li) => {
                      const epocaArr = Array.isArray(linha.epoca) ? linha.epoca : null;
                      const epocaStr = typeof linha.epoca === 'string' ? linha.epoca : null;
                      return (
                        <tr
                          key={`${talhao.id}-${li}`}
                          className={`border-b border-border/50 ${li % 2 === 0 ? 'bg-white' : 'bg-muted/20 print-row-alt'}`}
                        >
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
                                  <div key={ei} className="text-xs text-foreground">
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
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}