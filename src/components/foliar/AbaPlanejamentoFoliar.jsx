import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sprout, ChevronDown, ChevronUp, Plus, Trash2, Save, Loader2, Info } from 'lucide-react';
import { EPOCAS, GRUPOS_PLANEJAMENTO, ordenarCalda } from './FoliarNutrienteUtils';

const EQUIPAMENTOS = ['Bomba costal', 'Atomizador', 'Drone', 'Canhão'];

const FORMULACAO_LABEL = { WG: 'WG', SC: 'SC', SL: 'SL', EC: 'EC', EW: 'EW', outro: 'Outro' };

function ProdutoRow({ produto, insumo, onRemover }) {
  return (
    <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 text-sm">
      <span className="flex-1 font-medium">{produto.produto_nome}</span>
      {insumo?.tipo_formulacao && (
        <Badge variant="outline" className="text-xs">{FORMULACAO_LABEL[insumo.tipo_formulacao] || insumo.tipo_formulacao}</Badge>
      )}
      {insumo?.grupo && (
        <Badge variant="secondary" className="text-xs">{insumo.grupo}</Badge>
      )}
      <span className="text-xs text-muted-foreground">{produto.dose || ''} {produto.unidade || ''}</span>
      <button type="button" onClick={onRemover} className="text-muted-foreground hover:text-destructive transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function EpocaBlock({ epoca, produtos, insumos, onAddProduto, onRemoverProduto }) {
  const [busca, setBusca] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [produtoSel, setProdutoSel] = useState('');
  const [dose, setDose] = useState('');
  const [unidade, setUnidade] = useState('L/ha');

  const insumosFiltrados = useMemo(() => {
    const base = insumos.filter(p => GRUPOS_PLANEJAMENTO.includes(p.grupo) && p.ativo !== false);
    if (!busca) return base;
    return base.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.grupo || '').toLowerCase().includes(busca.toLowerCase()));
  }, [insumos, busca]);

  const handleAdd = () => {
    const insumo = insumos.find(p => p.id === produtoSel);
    if (!insumo) return;
    onAddProduto({ produto_id: insumo.id, produto_nome: insumo.nome, dose, unidade });
    setProdutoSel(''); setDose(''); setBusca(''); setAddOpen(false);
  };

  // Ordenar por calda
  const insumosPorId = useMemo(() => Object.fromEntries(insumos.map(p => [p.id, p])), [insumos]);
  const produtosOrdenados = useMemo(() => {
    return ordenarCalda(produtos.map(p => ({ ...p, ...(insumosPorId[p.produto_id] || {}) })));
  }, [produtos, insumosPorId]);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
        <span className="font-semibold text-sm">{epoca}</span>
        <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={() => setAddOpen(a => !a)}>
          <Plus className="w-3.5 h-3.5" /> Adicionar produto
        </Button>
      </div>

      {addOpen && (
        <div className="p-3 border-b border-border space-y-2 bg-muted/10">
          <Input placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} className="h-8 text-sm" />
          <Select value={produtoSel} onValueChange={setProdutoSel}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
            <SelectContent className="max-h-60">
              {insumosFiltrados.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <span>{p.nome}</span>
                  {p.tipo_formulacao && <span className="text-xs text-muted-foreground ml-1">({p.tipo_formulacao})</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input placeholder="Dose" value={dose} onChange={e => setDose(e.target.value)} className="h-8 text-sm flex-1" />
            <Input placeholder="Unidade" value={unidade} onChange={e => setUnidade(e.target.value)} className="h-8 text-sm w-24" />
            <Button size="sm" onClick={handleAdd} disabled={!produtoSel} className="h-8">Adicionar</Button>
          </div>
        </div>
      )}

      <div className="p-3 space-y-1.5 min-h-[48px]">
        {produtosOrdenados.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum produto adicionado</p>
        )}
        {produtosOrdenados.map((p, idx) => (
          <ProdutoRow
            key={`${p.produto_id}-${idx}`}
            produto={p}
            insumo={insumosPorId[p.produto_id]}
            onRemover={() => onRemoverProduto(p.produto_id)}
          />
        ))}
        {produtosOrdenados.length > 1 && (
          <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <Info className="w-3 h-3" /> Ordem de preparo: WG → SC → SL → EC/EW → Adjuvantes
          </div>
        )}
      </div>
    </div>
  );
}

function TalhaoPlano({ talhao, plano, insumos, onSave, saving }) {
  const [aberto, setAberto] = useState(false);
  const [equipamento, setEquipamento] = useState(plano?.equipamento || '');
  const [epocas, setEpocas] = useState(() => plano?.epocas || {});
  const [observacoes, setObservacoes] = useState(plano?.observacoes || '');

  useEffect(() => {
    if (plano) { setEquipamento(plano.equipamento || ''); setEpocas(plano.epocas || {}); setObservacoes(plano.observacoes || ''); }
  }, [plano]);

  const handleAddProduto = (epoca, produto) => {
    setEpocas(prev => ({ ...prev, [epoca]: [...(prev[epoca] || []), produto] }));
  };
  const handleRemoverProduto = (epoca, produtoId) => {
    setEpocas(prev => ({ ...prev, [epoca]: (prev[epoca] || []).filter(p => p.produto_id !== produtoId) }));
  };
  const handleSave = () => onSave({ equipamento, epocas, observacoes });
  const totalProdutos = Object.values(epocas).reduce((acc, arr) => acc + (arr?.length || 0), 0);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setAberto(a => !a)}>
        <div className="flex items-center gap-3">
          <Sprout className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold">{talhao.nome}</span>
          {talhao.area_ha && <span className="text-sm text-muted-foreground">{talhao.area_ha} ha</span>}
          {totalProdutos > 0 && <Badge variant="secondary" className="text-xs">{totalProdutos} produto(s)</Badge>}
        </div>
        {aberto ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {aberto && (
        <div className="border-t border-border p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs mb-1 block">Equipamento de aplicação</Label>
              <Select value={equipamento || 'none'} onValueChange={v => setEquipamento(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o equipamento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione…</SelectItem>
                  {EQUIPAMENTOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Observações</Label>
              <Input value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações gerais..." className="h-9" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {EPOCAS.map(epoca => (
              <EpocaBlock
                key={epoca}
                epoca={epoca}
                produtos={epocas[epoca] || []}
                insumos={insumos}
                onAddProduto={(produto) => handleAddProduto(epoca, produto)}
                onRemoverProduto={(produtoId) => handleRemoverProduto(epoca, produtoId)}
              />
            ))}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-border/40">
            <button type="button" onClick={() => setAberto(false)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted/40">
              <ChevronUp className="w-4 h-4" /> Recolher talhão
            </button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar planejamento
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AbaPlanejamentoFoliar({ produtor, safra, talhoes, planos, insumos, onSave, saving }) {
  const talhoesProdutor = talhoes.filter(t => t.codigo_produtor === produtor?.codigo);
  return (
    <div className="space-y-4">
      {talhoesProdutor.length === 0 && (
        <div className="text-center text-muted-foreground py-10 bg-card rounded-2xl border border-border">
          <p>Nenhum talhão cadastrado para este produtor.</p>
        </div>
      )}
      {talhoesProdutor.map(talhao => {
        const plano = planos.find(p => p.talhao_id === talhao.id && p.safra === safra) || null;
        return (
          <TalhaoPlano
            key={talhao.id}
            talhao={talhao}
            plano={plano}
            insumos={insumos}
            onSave={(data) => onSave(talhao, data)}
            saving={saving}
          />
        );
      })}
    </div>
  );
}