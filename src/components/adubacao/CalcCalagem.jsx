import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Send, ChevronDown } from 'lucide-react';

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

  const caNecKgHa = defCa * 560;
  const mgNecKgHa = defMg * 400;

  if (!produto) return { defCa, defMg, caNecKgHa, mgNecKgHa, meta };

  const pctCa = parseFloat(produto.ca_pct) || 0;
  const pctMg = parseFloat(produto.mg_pct) || 0;

  const dosePeloCa = pctCa > 0 ? caNecKgHa / (pctCa / 100) : 0;
  const dosePeloMg = pctMg > 0 ? mgNecKgHa / (pctMg / 100) : 0;
  const doseFinalHa = Math.max(dosePeloCa, dosePeloMg);

  const totalKg   = area > 0 ? doseFinalHa * area : null;
  const ton       = totalKg != null ? totalKg / 1000 : null;
  const sc40      = totalKg != null ? totalKg / 40 : null;
  const sc50      = totalKg != null ? totalKg / 50 : null;

  // Ca e Mg fornecidos pela dose
  const caFornecidoHa = doseFinalHa * (pctCa / 100);
  const mgFornecidoHa = doseFinalHa * (pctMg / 100);

  return {
    defCa, defMg, caNecKgHa, mgNecKgHa, meta,
    doseFinalHa: Math.round(doseFinalHa * 10) / 10,
    totalKg: totalKg != null ? Math.round(totalKg) : null,
    ton:  ton  != null ? parseFloat(ton.toFixed(3))  : null,
    sc40: sc40 != null ? parseFloat(sc40.toFixed(1)) : null,
    sc50: sc50 != null ? parseFloat(sc50.toFixed(1)) : null,
    caFornecidoHa: parseFloat(caFornecidoHa.toFixed(3)),
    mgFornecidoHa: parseFloat(mgFornecidoHa.toFixed(3)),
  };
}

export default function CalcCalagem({ analise, talhao, onEnviarPlanejamento }) {
  const [nivel, setNivel] = useState('Bom');
  const [produtoId, setProdutoId] = useState(null);
  const [dropAberto, setDropAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const caAtual  = analise?.calcio;
  const mgAtual  = analise?.magnesio;
  const kAtual   = analise?.potassio;
  const area     = talhao?.area_ha || 0;

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

  const semAnalise = caAtual == null && mgAtual == null;
  if (semAnalise) return null;

  const handleEnviar = () => {
    if (!resultado || !produto || !onEnviarPlanejamento) return;
    onEnviarPlanejamento({
      produtoId: produto.id,
      produtoNome: produto.nome,
      doseHa: resultado.doseFinalHa,
      totalKg: resultado.totalKg,
      ton: resultado.ton,
      sc40: resultado.sc40,
      sc50: resultado.sc50,
      nivel,
      tipo: 'calagem',
    });
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
                <th className="text-right py-1.5 pl-3 text-xs font-semibold text-muted-foreground uppercase">Necessidade (kg/ha)</th>
              </tr>
            </thead>
            <tbody>
              {/* Ca */}
              <tr className="border-b border-border/40">
                <td className="py-2 pr-4 font-medium">Ca (cmolc/dm³)</td>
                <td className="text-right px-3">{caAtual != null ? caAtual : '—'}</td>
                <td className="text-right px-3">{meta.ca}</td>
                <td className={`text-right px-3 font-semibold ${resultado?.defCa > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {resultado ? (resultado.defCa > 0 ? `−${resultado.defCa.toFixed(2)}` : '✓') : '—'}
                </td>
                <td className="text-right pl-3 font-semibold">
                  {resultado ? (resultado.caNecKgHa > 0 ? `${Math.round(resultado.caNecKgHa)} kg/ha` : '—') : '—'}
                </td>
              </tr>
              {/* Mg */}
              <tr className="border-b border-border/40">
                <td className="py-2 pr-4 font-medium">Mg (cmolc/dm³)</td>
                <td className="text-right px-3">{mgAtual != null ? mgAtual : '—'}</td>
                <td className="text-right px-3">{meta.mg}</td>
                <td className={`text-right px-3 font-semibold ${resultado?.defMg > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {resultado ? (resultado.defMg > 0 ? `−${resultado.defMg.toFixed(2)}` : '✓') : '—'}
                </td>
                <td className="text-right pl-3 font-semibold">
                  {resultado ? (resultado.mgNecKgHa > 0 ? `${Math.round(resultado.mgNecKgHa)} kg/ha` : '—') : '—'}
                </td>
              </tr>
              {/* K — apenas informativo */}
              <tr>
                <td className="py-2 pr-4 font-medium text-muted-foreground">K — equilíbrio (mg/dm³)</td>
                <td className="text-right px-3 text-muted-foreground">{kAtual != null ? kAtual : '—'}</td>
                <td className="text-right px-3 text-muted-foreground">{meta.k * 391} <span className="text-xs">(≈{meta.k} cmolc)</span></td>
                <td className="text-right px-3 text-muted-foreground text-xs italic">informativo</td>
                <td className="text-right pl-3 text-muted-foreground text-xs italic">não gera dose</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Seletor de fonte corretiva */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fonte corretiva</p>
          <div className="relative max-w-sm">
            <button type="button"
              className="w-full h-9 text-sm border border-input rounded-md px-3 text-left flex items-center justify-between bg-transparent hover:bg-muted/30"
              onClick={() => setDropAberto(a => !a)}>
              <span className={produto ? 'text-foreground truncate' : 'text-muted-foreground'}>
                {produto ? produto.nome : 'Selecionar produto...'}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground ml-1 shrink-0" />
            </button>
            {dropAberto && (
              <div className="absolute z-50 top-full left-0 w-96 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                <div className="p-2 border-b border-border">
                  <input autoFocus
                    className="w-full h-7 text-xs border border-input rounded px-2 bg-background"
                    placeholder="Buscar corretivo..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                  />
                </div>
                <div className="max-h-56 overflow-y-auto">
                  <button type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted/60 text-xs border-b border-border/30 text-muted-foreground"
                    onClick={() => { setProdutoId(null); setDropAberto(false); setBusca(''); }}>
                    — Nenhum produto —
                  </button>
                  {corretivosVisiveis.map(p => (
                    <button key={p.id} type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted/60 text-xs border-b border-border/30 last:border-0"
                      onClick={() => { setProdutoId(p.id); setDropAberto(false); setBusca(''); }}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{p.nome}</span>
                        <span className="text-muted-foreground text-xs">
                          {p.ca_pct > 0 ? `Ca: ${p.ca_pct}%` : ''}{p.ca_pct > 0 && p.mg_pct > 0 ? ' · ' : ''}{p.mg_pct > 0 ? `Mg: ${p.mg_pct}%` : ''}
                        </span>
                      </div>
                      {p.fornecedor && <div className="text-muted-foreground">{p.fornecedor}</div>}
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

        {/* Resultado */}
        {resultado && produto && resultado.doseFinalHa > 0 && (
          <div className="bg-lime-50 border border-lime-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-lime-800 uppercase tracking-wide">Resultado — {produto.nome}</p>

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

            {/* Ca e Mg fornecidos */}
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>Ca fornecido: <strong>{resultado.caFornecidoHa} cmolc/dm³·ha</strong> (via {produto.nome})</div>
              <div>Mg fornecido: <strong>{resultado.mgFornecidoHa} cmolc/dm³·ha</strong> (via {produto.nome})</div>
            </div>

            {onEnviarPlanejamento && (
              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={handleEnviar} className="gap-2 bg-lime-700 hover:bg-lime-800">
                  <Send className="w-4 h-4" />
                  Enviar para Planejamento
                </Button>
              </div>
            )}
          </div>
        )}

        {resultado && (!produto || resultado.doseFinalHa === 0) && (resultado.defCa === 0 && resultado.defMg === 0) && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 font-medium">
            ✓ Ca e Mg estão dentro ou acima da meta "{nivel}". Calagem não necessária.
          </div>
        )}
      </div>
    </div>
  );
}