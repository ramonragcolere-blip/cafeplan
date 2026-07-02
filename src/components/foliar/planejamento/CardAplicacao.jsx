import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Trash2, CalendarDays, MapPin, FlaskConical, Pencil, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const fmtR = (v) => v != null && !isNaN(v) ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

const OBJ_COLORS = {
  'Nutrição': 'bg-green-50 text-green-700 border-green-200',
  'Ferrugem': 'bg-orange-50 text-orange-700 border-orange-200',
  'Cercosporiose': 'bg-amber-50 text-amber-700 border-amber-200',
  'Bicho-mineiro': 'bg-red-50 text-red-700 border-red-200',
  'Ácaro': 'bg-rose-50 text-rose-700 border-rose-200',
  'Bacteriose': 'bg-purple-50 text-purple-700 border-purple-200',
  'Pós-colheita': 'bg-blue-50 text-blue-700 border-blue-200',
  'Pré-florada': 'bg-pink-50 text-pink-700 border-pink-200',
  'Outro': 'bg-muted text-muted-foreground border-border',
};

function StatusBadge({ status }) {
  const map = {
    planejado: 'bg-amber-50 text-amber-700 border-amber-200',
    em_execucao: 'bg-blue-50 text-blue-700 border-blue-200',
    concluido: 'bg-green-50 text-green-700 border-green-200',
    cancelado: 'bg-muted text-muted-foreground border-border',
  };
  const labels = { planejado: 'Planejado', em_execucao: 'Em execução', concluido: 'Concluído', cancelado: 'Cancelado' };
  const cls = map[status] || map.planejado;
  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${cls}`}>{labels[status] || 'Planejado'}</span>
  );
}

export default function CardAplicacao({ aplicacao, talhoes, onEditarReceita, onEditarTalhoes, onDuplicar, onExcluir, index }) {
  const [expandido, setExpandido] = useState(false);

  const talhoesAplic = talhoes.filter(t => (aplicacao.talhao_ids || []).includes(t.id));
  const areaTotal = talhoesAplic.reduce((s, t) => s + (t.area_ha || 0), 0);

  // Custos
  const custoHa = (aplicacao.produtos || []).reduce((s, p) => {
    const d = parseFloat(String(p.dose || '').replace(',', '.')) || 0;
    const pr = parseFloat(String(p.preco || '').replace(',', '.')) || 0;
    return s + (d && pr ? d * pr : 0);
  }, 0);
  const custoTotal = custoHa * areaTotal;

  const volumeTotal = aplicacao.volume_calda_ha && areaTotal ? aplicacao.volume_calda_ha * areaTotal : null;

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-all ${expandido ? 'border-primary/30 shadow-sm' : 'border-border'}`}>
      {/* Linha principal */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpandido(e => !e)}>
        <button type="button" className="text-muted-foreground shrink-0">
          {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Número */}
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>

        {/* Nome */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{aplicacao.titulo || <span className="text-muted-foreground italic">Sem nome</span>}</p>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {(aplicacao.objetivos || []).map(obj => (
              <span key={obj} className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${OBJ_COLORS[obj] || OBJ_COLORS['Outro']}`}>{obj}</span>
            ))}
          </div>
        </div>

        {/* Época */}
        {aplicacao.epoca && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <CalendarDays className="w-3 h-3" />
            <span>{aplicacao.epoca}</span>
          </div>
        )}

        {/* Talhões */}
        <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <MapPin className="w-3 h-3" />
          <span>{talhoesAplic.length > 0 ? `${talhoesAplic.length} talhão(ões)` : <span className="text-amber-600">Nenhum</span>}</span>
        </div>

        {/* Área */}
        {areaTotal > 0 && (
          <span className="hidden md:block text-xs tabular-nums text-muted-foreground shrink-0">{areaTotal.toFixed(1)} ha</span>
        )}

        {/* Receita */}
        <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <FlaskConical className="w-3 h-3" />
          <span>{(aplicacao.produtos || []).length} produto(s)</span>
        </div>

        {/* Custo */}
        {custoTotal > 0 && (
          <span className="text-xs font-semibold text-foreground tabular-nums shrink-0 hidden md:block">{fmtR(custoTotal)}</span>
        )}

        <StatusBadge status={aplicacao.status} />
      </div>

      {/* Bloco expandido */}
      {expandido && (
        <div className="border-t border-border px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Bloco 1: Dados da aplicação */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Dados da aplicação</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Equipamento</span>
                <span className="font-medium">{aplicacao.equipamento || '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Volume de calda</span>
                <span className="font-medium tabular-nums">{aplicacao.volume_calda_ha ? `${aplicacao.volume_calda_ha} L/ha` : '—'}</span>
              </div>
              {volumeTotal != null && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Volume total</span>
                  <span className="font-medium tabular-nums">{volumeTotal.toFixed(0)} L</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Época</span>
                <span className="font-medium">{aplicacao.epoca || '—'}</span>
              </div>
              {aplicacao.data_limite && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Data limite</span>
                  <span className="font-medium">{aplicacao.data_limite}</span>
                </div>
              )}
              {aplicacao.fase_lavoura && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Fase</span>
                  <span className="font-medium">{aplicacao.fase_lavoura}</span>
                </div>
              )}
              {aplicacao.observacoes && (
                <div className="bg-muted/30 rounded p-2 mt-1">
                  <p className="text-muted-foreground leading-relaxed">{aplicacao.observacoes}</p>
                </div>
              )}
            </div>
            <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs h-7 mt-2"
              onClick={(e) => { e.stopPropagation(); onEditarReceita(); }}>
              <Pencil className="w-3 h-3" /> Ver / editar receita
            </Button>
          </div>

          {/* Bloco 2: Talhões incluídos */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Talhões incluídos · {talhoesAplic.length > 0 ? `${areaTotal.toFixed(1)} ha` : 'Nenhum selecionado'}
            </p>
            {talhoesAplic.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Nenhum talhão selecionado para esta aplicação.
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {talhoesAplic.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded border border-border bg-muted/10">
                    <span className="font-medium truncate">{t.nome}</span>
                    <span className="tabular-nums text-muted-foreground shrink-0 ml-2">{t.area_ha ? `${t.area_ha} ha` : '—'}</span>
                  </div>
                ))}
              </div>
            )}
            <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs h-7 mt-1"
              onClick={(e) => { e.stopPropagation(); onEditarTalhoes(); }}>
              <Users className="w-3 h-3" /> Selecionar talhões
            </Button>
          </div>

          {/* Bloco 3: Receita e custos */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Receita e custos</p>
            {(aplicacao.produtos || []).length === 0 ? (
              <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">Nenhum produto na receita.</p>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/20 border-b border-border">
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">Produto</th>
                      <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground whitespace-nowrap">Dose/ha</th>
                      <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground whitespace-nowrap">Custo/ha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(aplicacao.produtos || []).map((p, idx) => {
                      const d = parseFloat(String(p.dose || '').replace(',', '.')) || 0;
                      const pr = parseFloat(String(p.preco || '').replace(',', '.')) || 0;
                      const cHa = d && pr ? d * pr : null;
                      return (
                        <tr key={idx} className="border-b border-border/50 last:border-0">
                          <td className="px-2 py-1.5 max-w-[100px]">
                            <span className="truncate block font-medium">{p.produto_nome}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{p.dose || '—'} {p.unidade || ''}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{cHa != null ? fmtR(cHa) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {custoHa > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Custo/ha</span>
                  <span className="font-semibold tabular-nums">{fmtR(custoHa)}</span>
                </div>
                {areaTotal > 0 && (
                  <div className="flex justify-between font-bold border-t border-primary/10 pt-1">
                    <span>Custo total</span>
                    <span className="text-primary tabular-nums">{fmtR(custoTotal)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ações por aplicação */}
      {expandido && (
        <div className="border-t border-border/50 px-4 py-2 flex items-center gap-2 bg-muted/10">
          <Button size="sm" variant="ghost" className="text-xs gap-1 h-7" onClick={() => onDuplicar()}>
            <Copy className="w-3 h-3" /> Duplicar
          </Button>
          <Button size="sm" variant="ghost" className="text-xs gap-1 h-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onExcluir()}>
            <Trash2 className="w-3 h-3" /> Excluir
          </Button>
        </div>
      )}
    </div>
  );
}