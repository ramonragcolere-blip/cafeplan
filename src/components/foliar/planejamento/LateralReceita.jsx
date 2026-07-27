import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, Trash2, Save, Pencil } from 'lucide-react';
import { filtrarInsumosPlanejamentoFoliar } from '@/lib/planejamentoFoliar';
import {
  CUSTO_PENDENTE_FOLIAR,
  atualizarProdutoReceitaFoliar,
  calcularCustoProdutoFoliarDetalhado,
  formatarDoseNormalizadaFoliar,
  normalizarProdutosAplicacaoFoliar,
  produtoReceitaFoliarDeInsumo,
  removerProdutoReceitaFoliar,
} from '@/lib/unidadesAplicacoesFoliares';

const OBJETIVOS = ['Nutrição', 'Ferrugem', 'Cercosporiose', 'Bicho-mineiro', 'Ácaro', 'Bacteriose', 'Pós-colheita', 'Pré-florada', 'Outro'];
const EQUIPAMENTOS = ['Bomba costal', 'Atomizador', 'Drone', 'Canhão'];

const fmtR = (v) => v != null && !isNaN(v) ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

export default function LateralReceita({ aplicacao, insumos, areaTotal, onSalvar, onCancelar }) {
  const [local, setLocal] = useState(() => ({
    titulo: aplicacao.titulo || '',
    objetivos: aplicacao.objetivos || [],
    data_prevista: aplicacao.data_prevista || '',
    data_limite: aplicacao.data_limite || '',
    epoca: aplicacao.epoca || '',
    periodo_aplicacao: aplicacao.periodo_aplicacao || '',
    meses: aplicacao.meses || [],
    equipamento: aplicacao.equipamento || '',
    volume_calda_ha: aplicacao.volume_calda_ha || '',
    produtos: aplicacao.produtos || [],
    observacoes: aplicacao.observacoes || '',
  }));

  const [busca, setBusca] = useState('');
  const [produtoSel, setProdutoSel] = useState('');
  const [dose, setDose] = useState('');
  const [unidade, setUnidade] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editandoProduto, setEditandoProduto] = useState(null);

  const insumosFiltrados = useMemo(() => {
    return filtrarInsumosPlanejamentoFoliar(insumos, busca);
  }, [insumos, busca]);

  const toggleObjetivo = (obj) => {
    setLocal(prev => {
      const cur = prev.objetivos || [];
      return { ...prev, objetivos: cur.includes(obj) ? cur.filter(o => o !== obj) : [...cur, obj] };
    });
  };

  const handleSelectProduto = (id) => {
    setProdutoSel(id);
    const ins = insumos.find(p => p.id === id);
    if (ins) {
      setDose(ins.dose_producao || '');
      setUnidade(ins.unidade_aplicacao || '');
    }
  };

  const handleAddProduto = () => {
    const ins = insumos.find(p => p.id === produtoSel);
    if (!ins) return;
    setLocal(prev => ({
      ...prev,
      produtos: [
        ...prev.produtos,
        produtoReceitaFoliarDeInsumo(ins, { dose, unidade, preco: '' }, { volumeCaldaHa: prev.volume_calda_ha }),
      ],
    }));
    setProdutoSel(''); setDose(''); setUnidade(''); setBusca(''); setAddOpen(false);
  };

  const handleProdutoChange = (idx, campo, val) => {
    setLocal(prev => {
      const atualizacao = { [campo]: val };
      if (campo === 'produto_id') {
        const ins = insumos.find(item => item.id === val);
        atualizacao.produto_nome = ins?.nome || '';
        atualizacao.dose = ins?.dose_producao || '';
        atualizacao.unidade = ins?.unidade_aplicacao || ins?.unidade_padrao || '';
        atualizacao.tipo_formulacao = ins?.tipo_formulacao || '';
        atualizacao.grupo = ins?.grupo || '';
      }
      return {
        ...prev,
        produtos: atualizarProdutoReceitaFoliar(prev.produtos, idx, atualizacao, {
          volumeCaldaHa: prev.volume_calda_ha,
          insumos,
        }),
      };
    });
  };

  const handleRemoverProduto = (idx) => {
    setLocal(prev => ({ ...prev, produtos: removerProdutoReceitaFoliar(prev.produtos, idx) }));
    setEditandoProduto(null);
  };

  // Resumo de custos
  const custos = useMemo(() => {
    let custoHaTotal = 0;
    let pendencias = 0;
    local.produtos.forEach(p => {
      const custo = calcularCustoProdutoFoliarDetalhado(p, {
        volumeCaldaHa: local.volume_calda_ha,
        areaHa: areaTotal,
      });
      if (custo.valido) custoHaTotal += custo.custo_ha;
      else pendencias += 1;
    });
    return { custoHa: custoHaTotal, total: custoHaTotal * (areaTotal || 0), pendencias };
  }, [local.produtos, local.volume_calda_ha, areaTotal]);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[480px] max-w-full bg-card border-l border-border shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20 shrink-0">
        <div>
          <p className="font-bold text-sm">Editar Receita</p>
          <p className="text-xs text-muted-foreground mt-0.5">{areaTotal > 0 ? `${areaTotal.toFixed(1)} ha selecionados` : 'Nenhum talhão selecionado'}</p>
        </div>
        <button type="button" onClick={onCancelar} className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Corpo */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Nome */}
        <div>
          <Label className="text-xs mb-1 block">Nome da aplicação</Label>
          <Input value={local.titulo} onChange={e => setLocal(p => ({ ...p, titulo: e.target.value }))}
            placeholder="Ex: Pós-colheita 1, Proteção ferrugem..." className="h-8 text-sm" />
        </div>

        {/* Objetivos */}
        <div>
          <Label className="text-xs mb-2 block">Objetivos</Label>
          <div className="flex flex-wrap gap-1.5">
            {OBJETIVOS.map(obj => {
              const ativo = (local.objetivos || []).includes(obj);
              return (
                <button key={obj} type="button" onClick={() => toggleObjetivo(obj)}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${ativo ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}>
                  {obj}
                </button>
              );
            })}
          </div>
        </div>

        {/* Data ou periodo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1 block">Data prevista</Label>
            <Input type="date" value={local.data_prevista}
              onChange={e => setLocal(p => ({ ...p, data_prevista: e.target.value }))}
              className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Data-limite</Label>
            <Input type="date" value={local.data_limite}
              onChange={e => setLocal(p => ({ ...p, data_limite: e.target.value }))}
              className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Mes</Label>
            <Select value={local.meses?.[0] || 'none'} onValueChange={v => setLocal(p => ({ ...p, meses: v === 'none' ? [] : [v] }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione…</SelectItem>
                {['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'].map(mes => (
                  <SelectItem key={mes} value={mes}>{mes}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Periodo de aplicacao</Label>
            <Input value={local.periodo_aplicacao || local.epoca}
              onChange={e => setLocal(p => ({ ...p, periodo_aplicacao: e.target.value, epoca: e.target.value }))}
              placeholder="Ex: OUT/NOV" className="h-8 text-sm" />
          </div>
        </div>

        {/* Equipamento + Volume calda */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1 block">Equipamento</Label>
            <Select value={local.equipamento || 'none'} onValueChange={v => setLocal(p => ({ ...p, equipamento: v === 'none' ? '' : v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione…</SelectItem>
                {EQUIPAMENTOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Volume de calda (L/ha)</Label>
            <Input type="number" min="0" step="1" value={local.volume_calda_ha}
              onChange={e => setLocal(p => ({
                ...p,
                volume_calda_ha: e.target.value,
                produtos: normalizarProdutosAplicacaoFoliar(p.produtos, { volumeCaldaHa: e.target.value }),
              }))}
              placeholder="Ex: 200" className="h-8 text-sm" />
          </div>
        </div>

        {/* Produtos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs">Produtos da receita</Label>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setAddOpen(a => !a)}>
              <Plus className="w-3.5 h-3.5" /> Adicionar produto
            </Button>
          </div>

          {addOpen && (
            <div className="border border-border rounded-lg p-3 mb-3 space-y-2 bg-muted/10">
              <Input placeholder="Buscar produto…" value={busca} onChange={e => setBusca(e.target.value)} className="h-7 text-xs" />
              <Select value={produtoSel} onValueChange={handleSelectProduto}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent className="max-h-56">
                  {insumosFiltrados.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum produto encontrado.</div>
                  )}
                  {insumosFiltrados.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                      {p.grupo ? ` — ${p.grupo}` : ''}
                      {p.tipo_formulacao ? ` (${p.tipo_formulacao})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {insumosFiltrados.length} produto(s) ativo(s) disponível(is). A busca considera nome, grupo, fornecedor e ingrediente ativo.
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground mb-0.5 block">Dose</Label>
                  <Input value={dose} onChange={e => setDose(e.target.value)} placeholder="ex: 2" className="h-7 text-xs" />
                </div>
                <div className="w-24">
                  <Label className="text-[10px] text-muted-foreground mb-0.5 block">Unidade</Label>
                  <Input value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="L/ha" className="h-7 text-xs" />
                </div>
                <div className="flex items-end">
                  <Button size="sm" onClick={handleAddProduto} disabled={!produtoSel} className="h-7 text-xs">Adicionar</Button>
                </div>
              </div>
            </div>
          )}

          {local.produtos.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
              Nenhum produto adicionado
            </p>
          ) : (
            <div className="space-y-2">
              {local.produtos.map((p, idx) => {
                const custo = calcularCustoProdutoFoliarDetalhado(p, {
                  volumeCaldaHa: local.volume_calda_ha,
                  areaHa: areaTotal,
                });
                const editando = editandoProduto === idx;
                return (
                  <div key={`${p.produto_id || p.produto_nome || 'produto'}-${idx}`} className="border border-border rounded-lg p-3 space-y-3 bg-background">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{p.produto_nome || 'Produto sem nome'}</p>
                        {p.grupo && <p className="text-[11px] text-muted-foreground">{p.grupo}</p>}
                        {custo.pendente && <p className="text-[11px] text-amber-700">{CUSTO_PENDENTE_FOLIAR}</p>}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button type="button" size="sm" variant={editando ? 'secondary' : 'outline'} className="h-7 px-2 text-xs gap-1"
                          onClick={() => setEditandoProduto(editando ? null : idx)}>
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive"
                          onClick={() => handleRemoverProduto(idx)}>
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </Button>
                      </div>
                    </div>

                    {editando && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="sm:col-span-2">
                          <Label className="text-[10px] text-muted-foreground mb-0.5 block">Produto</Label>
                          <Select value={p.produto_id || 'none'} onValueChange={v => handleProdutoChange(idx, 'produto_id', v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                            <SelectContent className="max-h-56">
                              <SelectItem value="none" disabled>Selecione o produto</SelectItem>
                              {insumos.map(ins => (
                                <SelectItem key={ins.id} value={ins.id}>
                                  {ins.nome}{ins.grupo ? ` — ${ins.grupo}` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground mb-0.5 block">Dose</Label>
                          <Input value={p.dose ?? ''} onChange={e => handleProdutoChange(idx, 'dose', e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground mb-0.5 block">Unidade</Label>
                          <Input value={p.unidade ?? ''} onChange={e => handleProdutoChange(idx, 'unidade', e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground mb-0.5 block">Preço (R$)</Label>
                          <Input type="number" min="0" step="0.01" value={p.preco ?? ''}
                            onChange={e => handleProdutoChange(idx, 'preco', e.target.value)}
                            className="h-8 text-sm tabular-nums" />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Dose original</p>
                        <p className="font-medium tabular-nums">{p.dose || '—'} {p.unidade || ''}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Dose cálculo</p>
                        <p className="font-medium tabular-nums">{formatarDoseNormalizadaFoliar(p, { volumeCaldaHa: local.volume_calda_ha })}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Quantidade total</p>
                        <p className="font-medium tabular-nums">{custo.quantidade_total != null ? custo.quantidade_total.toFixed(2) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Custo/ha</p>
                        <p className="font-medium tabular-nums">{custo.custo_ha != null ? fmtR(custo.custo_ha) : '—'}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Observações */}
        <div>
          <Label className="text-xs mb-1 block">Observações técnicas</Label>
          <textarea value={local.observacoes} onChange={e => setLocal(p => ({ ...p, observacoes: e.target.value }))}
            rows={2} placeholder="Notas sobre condições, intervalo de segurança…"
            className="w-full text-xs border border-input rounded-md px-3 py-2 bg-background resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>

        {/* Resumo de custos */}
        {(custos.custoHa > 0 || custos.pendencias > 0) && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-primary">Resumo de custos</p>
            {custos.pendencias > 0 && (
              <p className="text-xs text-amber-700">{CUSTO_PENDENTE_FOLIAR}</p>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Custo/ha</span>
              <span className="font-semibold tabular-nums">{fmtR(custos.custoHa)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold border-t border-primary/10 pt-1">
              <span>Custo total ({areaTotal.toFixed(1)} ha)</span>
              <span className="text-primary tabular-nums">{fmtR(custos.total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border bg-muted/10 flex gap-2 shrink-0">
        <Button variant="outline" className="flex-1 text-sm" onClick={onCancelar}>Cancelar</Button>
        <Button className="flex-1 text-sm gap-1.5 bg-primary" onClick={() => onSalvar({
          ...local,
          produtos: normalizarProdutosAplicacaoFoliar(local.produtos, { volumeCaldaHa: local.volume_calda_ha }),
        })}>
          <Save className="w-4 h-4" /> Salvar receita
        </Button>
      </div>
    </div>
  );
}
