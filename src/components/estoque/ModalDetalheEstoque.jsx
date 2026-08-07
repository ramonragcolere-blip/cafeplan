import React from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fmtQtd, fmtData } from '@/lib/estoqueInsumos';
import { ArrowDownToLine, ArrowUpFromLine, PencilLine, Trash2, ExternalLink, CheckCircle2, Package } from 'lucide-react';

// Detalhes do produto: histórico de entradas (NFs) e saídas registradas.
// Saídas manuais podem ser editadas/excluídas; entradas de NF apenas abrem a nota.
export default function ModalDetalheEstoque({
  row, open, onClose,
  onEditarMovimento, onExcluirMovimento, onAbrirNota, onEditarDose, onCadastrarInsumo,
}) {
  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <span className="truncate">{row.produto_nome}</span>
          </DialogTitle>
          <DialogDescription>
            Categoria: {row.categoria} · Saldo: {fmtQtd(row.saldo)} {row.unidade}
            {' · '}Entradas: {fmtQtd(row.total_entrada)} {row.unidade}
            {' · '}Usado: {fmtQtd(row.total_saida)} {row.unidade}
          </DialogDescription>
        </DialogHeader>

        {/* Status do vínculo + ações */}
        <div className="flex flex-wrap items-center gap-2 py-1 text-sm">
          {row.vinculado ? (
            <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" /> Vinculado à Base de Insumos: {row.insumo_nome}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-xs">
              Produto ainda não vinculado à Base de Insumos
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => onEditarDose?.(row)} className="h-8 gap-1">
            <PencilLine className="w-3.5 h-3.5" /> Editar Dose/ha
          </Button>
          {!row.vinculado && (
            <Button variant="outline" size="sm" onClick={() => onCadastrarInsumo?.(row)} className="h-8 gap-1">
              <ExternalLink className="w-3.5 h-3.5" /> Cadastrar/Vincular na Base de Insumos
            </Button>
          )}
          {row.vinculado && row.produto_id && (
            <Link to="/fertilizantes" className="inline-flex">
              <Button variant="ghost" size="sm" className="h-8 gap-1">
                <ExternalLink className="w-3.5 h-3.5" /> Ver na Base de Insumos
              </Button>
            </Link>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            {row.dose
              ? <>Dose: <strong className="text-foreground">{fmtQtd(row.dose.valor)} {row.dose.unit === 'l' ? 'L' : row.dose.unit === 'kg' ? 'kg' : row.dose.unit}/ha</strong></>
              : 'Dose: —'}
            {row.ha_possiveis != null && <> · Hectares possíveis: <strong className="text-primary">{fmtQtd(row.ha_possiveis)} ha</strong></>}
          </div>
        </div>

        <div className="space-y-5 py-2">
          {/* Entradas */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-green-700">
              <ArrowDownToLine className="w-4 h-4" /> Entradas ({row.entradas.length})
            </h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/10 border-b border-border">
                    {['Data', 'NF', 'Fornecedor', 'Quantidade', 'Unidade', ''].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {row.entradas.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">Nenhuma entrada registrada.</td></tr>
                  ) : row.entradas.map((e, i) => (
                    <tr key={i} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtData(e.data)}</td>
                      <td className="px-3 py-2 font-mono">{e.numero || '—'}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate">{e.fornecedor || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(e.quantidade)}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{e.unidade || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {e.nota_id && (
                          <button
                            type="button"
                            onClick={() => onAbrirNota?.(e.nota_id)}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" /> Abrir Nota Fiscal
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Saídas */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-amber-700">
              <ArrowUpFromLine className="w-4 h-4" /> Saídas ({row.saidas.length})
            </h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/10 border-b border-border">
                    {['Data', 'Quantidade', 'Unidade', 'Tipo', 'Talhões', 'Observação', ''].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {row.saidas.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">Nenhuma saída registrada.</td></tr>
                  ) : row.saidas.map((s, i) => {
                    const manual = !!s.id;
                    return (
                      <tr key={i} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtData(s.data_movimento)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(s.quantidade)}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{s.unidade || row.unidade || '—'}</td>
                        <td className="px-3 py-2"><span className="text-xs bg-secondary px-2 py-0.5 rounded">{s.tipo_movimento}</span></td>
                        <td className="px-3 py-2 max-w-[220px]">
                          {(s.talhoes_aplicacao && s.talhoes_aplicacao.length) ? (
                            <div className="space-y-0.5">
                              {s.talhoes_aplicacao.map((t, j) => (
                                <div key={t.talhao_id || j} className="text-xs text-muted-foreground tabular-nums">
                                  {t.talhao_nome} · {(Number(t.area_ha) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha · {(Number(t.quantidade_rateada) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {s.unidade || row.unidade || ''}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">{s.tipo_movimento === 'saida' ? 'Talhão não informado' : '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 max-w-[200px] truncate text-muted-foreground" title={s.observacao}>{s.observacao || '—'}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {manual ? (
                            <div className="inline-flex items-center gap-1">
                              <button type="button" title="Editar" onClick={() => onEditarMovimento?.(row, s)}
                                className="inline-flex items-center justify-center w-7 h-7 rounded border border-border hover:bg-muted/10">
                                <PencilLine className="w-3.5 h-3.5 text-primary" />
                              </button>
                              <button type="button" title="Excluir" onClick={() => onExcluirMovimento?.(row, s)}
                                className="inline-flex items-center justify-center w-7 h-7 rounded border border-border hover:bg-destructive/10">
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </button>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}