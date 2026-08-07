// Banco de Preços Consolidado (evoluído). Substitui a tabela antiga de
// consolidarPrecosItens. Mostra: Produto | Un | Último | Menor | Maior | Médio
// | Melhor Fornecedor | Economia Potencial | Nº Notas. Linha clicável expande
// o detalhe: Comparativo por Fornecedor + Histórico de compras.
import React, { useState } from 'react';
import { TrendingUp, ChevronDown, ChevronUp, Store, History } from 'lucide-react';
import { unidadeDisplay } from '@/lib/analisePrecosNotas';

const fmtR = (v) => (v != null
  ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : '—');
const fmtRU = (v, u) => (v != null ? `${fmtR(v)}/${unidadeDisplay(u)}` : '—');
const fmtData = (d) => { if (!d) return '—'; const [y, m, day] = String(d).split('-'); return y && m && day ? `${day}/${m}/${y}` : d; };

export default function TabelaBancoPrecos({ rows = [] }) {
  const [aberta, setAberta] = useState(null); // chave||unidade da linha expandida

  if (!rows.length) {
    return (
      <div className="px-5 py-10 text-center text-sm text-muted-foreground">
        Nenhum dado disponível ainda. Importe uma nota fiscal para visualizar os preços.
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm">Banco de Preços Consolidado</h2>
        <span className="text-xs text-muted-foreground ml-1">({rows.length} produtos)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              {['', 'Produto', 'Un', 'Último', 'Menor', 'Maior', 'Médio', 'Melhor Fornecedor', 'Economia Potencial', 'Nº Notas'].map((h, i) => (
                <th key={i} className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const key = `${row.chave}||${row.unidade}`;
              const expandida = aberta === key;
              const economiaTitle = row.economia_eh_zero
                ? 'Melhor preço atual (último = menor histórico)'
                : `Último ${fmtRU(row.ultimo_preco, row.unidade)} - Menor ${fmtRU(row.menor_preco, row.unidade)} = ${fmtRU(row.economia_unit, row.unidade)}`;
              return (
                <React.Fragment key={key}>
                  <tr
                    className={`border-b border-border/50 last:border-0 hover:bg-muted/10 cursor-pointer transition-colors ${i % 2 === 1 ? 'bg-muted/5' : ''}`}
                    onClick={() => setAberta(expandida ? null : key)}
                  >
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {expandida ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </td>
                    <td className="px-3 py-2.5 font-medium max-w-[220px] truncate" title={row.produto_nome}>{row.produto_nome}</td>
                    <td className="px-3 py-2.5"><span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded font-mono">{unidadeDisplay(row.unidade)}</span></td>
                    <td className="px-3 py-2.5 tabular-nums" title={`Último: ${fmtRU(row.ultimo_preco, row.unidade)} — ${row.ultimo_fornecedor || '—'} — ${fmtData(row.ultimo_data)} — NF ${row.ultimo_nota || '—'}`}>{fmtR(row.ultimo_preco)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-green-700 font-medium" title={`Menor: ${fmtRU(row.menor_preco, row.unidade)} — ${row.menor_fornecedor || '—'} — ${fmtData(row.menor_data)} — NF ${row.menor_nota || '—'}`}>{fmtR(row.menor_preco)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-destructive font-medium">{fmtR(row.maior_preco)}</td>
                    <td className="px-3 py-2.5 tabular-nums font-semibold text-primary">{fmtR(row.preco_medio)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[150px] truncate" title={`${row.melhor_fornecedor || '—'} — ${fmtData(row.menor_data)} — NF ${row.menor_nota || '—'}`}>{row.melhor_fornecedor || '—'}</td>
                    <td className="px-3 py-2.5 tabular-nums" title={economiaTitle}>
                      {row.economia_eh_zero
                        ? <span className="text-[11px] text-green-700 dark:text-green-400 font-medium">Melhor preço atual</span>
                        : (
                          <span className="text-xs">
                            <span className="text-amber-700 dark:text-amber-400 font-medium">{fmtRU(row.economia_unit, row.unidade)}</span>
                            <span className="text-muted-foreground block text-[10px]">({row.economia_pct.toFixed(1)}% acima)</span>
                          </span>
                        )
                      }
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">{row.num_notas}</span>
                    </td>
                  </tr>
                  {expandida && (
                    <tr className="bg-muted/5">
                      <td colSpan={10} className="px-4 py-3">
                        {/* Comparativo por Fornecedor */}
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5" /> Comparativo por Fornecedor
                            <span className="text-[10px] font-normal">(ordenado do menor preço)</span>
                          </p>
                          <div className="rounded-lg border border-border overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-muted/20 border-b border-border">
                                  {['Fornecedor', 'Última', 'Último', 'Mínimo', 'Máximo', 'Médio', 'Comprado', 'Compras'].map((h) => (
                                    <th key={h} className="px-2.5 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {row.por_fornecedor.map((f, j) => (
                                  <tr key={j} className="border-b border-border/40 last:border-0">
                                    <td className="px-2.5 py-1.5 font-medium max-w-[180px] truncate" title={f.fornecedor}>{f.fornecedor}</td>
                                    <td className="px-2.5 py-1.5 tabular-nums text-muted-foreground">{fmtData(f.ultima_data)}</td>
                                    <td className="px-2.5 py-1.5 tabular-nums">{fmtRU(f.ultimo_preco, row.unidade)}</td>
                                    <td className="px-2.5 py-1.5 tabular-nums text-green-700">{fmtRU(f.menor, row.unidade)}</td>
                                    <td className="px-2.5 py-1.5 tabular-nums text-destructive">{fmtRU(f.maior, row.unidade)}</td>
                                    <td className="px-2.5 py-1.5 tabular-nums font-semibold text-primary">{fmtRU(f.medio, row.unidade)}</td>
                                    <td className="px-2.5 py-1.5 tabular-nums text-muted-foreground">{f.qtd_total.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {unidadeDisplay(row.unidade)}</td>
                                    <td className="px-2.5 py-1.5 text-center tabular-nums">{f.num_compras}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        {/* Histórico */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5" /> Histórico do Produto
                            <span className="text-[10px] font-normal">(mais recente primeiro)</span>
                          </p>
                          <div className="rounded-lg border border-border overflow-hidden max-h-56 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead className="sticky top-0 bg-muted/20">
                                <tr className="border-b border-border">
                                  {['Data', 'Fornecedor', 'NF', 'Qtd', 'Un', 'Preço Unit.'].map((h) => (
                                    <th key={h} className="px-2.5 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {row.historico.map((h, j) => (
                                  <tr key={j} className="border-b border-border/40 last:border-0">
                                    <td className="px-2.5 py-1.5 tabular-nums text-muted-foreground">{fmtData(h.data)}</td>
                                    <td className="px-2.5 py-1.5 max-w-[180px] truncate" title={h.fornecedor}>{h.fornecedor || '—'}</td>
                                    <td className="px-2.5 py-1.5 font-mono">{h.nota_numero || '—'}</td>
                                    <td className="px-2.5 py-1.5 tabular-nums">{h.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                                    <td className="px-2.5 py-1.5 text-muted-foreground">{h.unidade_original || unidadeDisplay(row.unidade)}</td>
                                    <td className="px-2.5 py-1.5 tabular-nums font-medium">{fmtRU(h.preco_unit_comparavel, row.unidade)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}