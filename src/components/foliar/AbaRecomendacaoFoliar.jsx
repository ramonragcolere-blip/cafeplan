import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Sprout, ChevronDown, ChevronUp, Leaf } from 'lucide-react';
import { useState } from 'react';
import { FAIXAS, NUTRIENTES_KEYS, classificar, CLASS_BADGE, CLASS_LABEL, GRUPOS_RECOMENDACAO } from './FoliarNutrienteUtils';

// Nutriente → grupo(s) de produto sugerido
const NUTRIENTE_GRUPO = {
  n_pct:  ['Foliar — Nutrição', 'Aminoácido', 'Bioestimulante'],
  p_pct:  ['Fósforo', 'Foliar — Nutrição'],
  k_pct:  ['Foliar — Nutrição'],
  ca_pct: ['Foliar — Nutrição'],
  mg_pct: ['Magnésio', 'Foliar — Nutrição'],
  s_pct:  ['Foliar — Nutrição'],
  zn_ppm: ['Zinco', 'Foliar — Nutrição'],
  b_ppm:  ['Boro', 'Foliar — Nutrição'],
  cu_ppm: ['Cobre', 'Foliar — Nutrição'],
  mn_ppm: ['Manganês', 'Foliar — Nutrição'],
  fe_ppm: ['Foliar — Nutrição'],
};

function getDoseProduto(produto, faseTalhao) {
  if (faseTalhao === 'Recepado/Brotando' && produto.dose_esqueletado) return `${produto.dose_esqueletado} ${produto.unidade_aplicacao || ''}`;
  if (faseTalhao === 'Em formação' && produto.dose_1ano_recepa) return `${produto.dose_1ano_recepa} ${produto.unidade_aplicacao || ''}`;
  if (produto.dose_producao) return `${produto.dose_producao} ${produto.unidade_aplicacao || ''}`;
  return '—';
}

function TalhaoRecomendacao({ talhao, analise, insumos }) {
  const [aberto, setAberto] = useState(false);

  const nutrientesAlerta = NUTRIENTES_KEYS.filter(k => {
    const cls = classificar(k, analise?.[k]);
    return cls === 'deficiente' || cls === 'limiar';
  });

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setAberto(a => !a)}>
        <div className="flex items-center gap-3">
          <Sprout className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold">{talhao.nome}</span>
          {!analise && <Badge variant="outline" className="text-xs text-muted-foreground">Sem análise</Badge>}
          {analise && nutrientesAlerta.length === 0 && <Badge className="text-xs bg-green-100 text-green-700 border border-green-300">Todos adequados</Badge>}
          {analise && nutrientesAlerta.length > 0 && <Badge className="text-xs bg-red-100 text-red-700 border border-red-300">{nutrientesAlerta.length} nutriente(s) em alerta</Badge>}
        </div>
        {aberto ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {aberto && (
        <div className="border-t border-border p-4 space-y-4">
          {!analise && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma análise foliar registrada para este talhão/safra.</p>
          )}

          {analise && nutrientesAlerta.length === 0 && (
            <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
              <Leaf className="w-4 h-4" /> Todos os nutrientes estão em faixa adequada ou excessiva. Nenhuma recomendação necessária.
            </div>
          )}

          {analise && nutrientesAlerta.map(k => {
            const cls = classificar(k, analise[k]);
            const grupos = NUTRIENTE_GRUPO[k] || [];
            const produtosSugeridos = insumos.filter(p => grupos.includes(p.grupo) && p.ativo !== false);
            return (
              <div key={k} className="border border-border rounded-xl overflow-hidden">
                <div className={`px-4 py-2.5 flex items-center gap-2 ${cls === 'deficiente' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CLASS_BADGE[cls]}`}>
                    {FAIXAS[k].label}: {analise[k]} {FAIXAS[k].unidade} — {CLASS_LABEL[cls]}
                  </span>
                </div>
                {produtosSugeridos.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-4 py-3">Nenhum produto cadastrado para este nutriente.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="text-left px-3 py-2">Produto</th>
                          <th className="text-left px-3 py-2">Grupo</th>
                          <th className="text-left px-3 py-2">Dose sugerida</th>
                          <th className="text-left px-3 py-2">Formulação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {produtosSugeridos.map(p => (
                          <tr key={p.id} className="border-t border-border/50">
                            <td className="px-3 py-2 font-medium">{p.nome}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.grupo}</td>
                            <td className="px-3 py-2">{getDoseProduto(p, talhao.fase_atual)}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.tipo_formulacao || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-end pt-2 border-t border-border/40">
            <button type="button" onClick={() => setAberto(false)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted/40">
              <ChevronUp className="w-4 h-4" /> Recolher talhão
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AbaRecomendacaoFoliar({ produtor, safra, talhoes, analises, insumos }) {
  const talhoesProdutor = talhoes.filter(t => t.codigo_produtor === produtor?.codigo);
  return (
    <div className="space-y-4">
      {talhoesProdutor.length === 0 && (
        <div className="text-center text-muted-foreground py-10 bg-card rounded-2xl border border-border">
          <p>Nenhum talhão cadastrado para este produtor.</p>
        </div>
      )}
      {talhoesProdutor.map(talhao => {
        const analise = analises.find(a => a.talhao_id === talhao.id && a.safra === safra) || null;
        return <TalhaoRecomendacao key={talhao.id} talhao={talhao} analise={analise} insumos={insumos} />;
      })}
    </div>
  );
}