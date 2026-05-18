import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Loader2, ShoppingCart, AlertCircle } from 'lucide-react';

// Agrupa linhas de plano_aplicacoes de múltiplos talhões por produto
function agruparNecessidade(planos, talhoes) {
  const map = {}; // produto_id -> { nome, talhoes: {talhaoId: kg}, total }
  planos.forEach(plano => {
    const talhao = talhoes.find(t => t.id === plano.talhao_id);
    const talhaoNome = talhao?.nome || plano.talhao_nome || '?';
    const linhas = plano.plano_aplicacoes || [];
    linhas.forEach(l => {
      if (!l.produto_id) return;
      const kg = parseFloat(l.qtd_planejado) || 0;
      if (kg <= 0) return;
      if (!map[l.produto_id]) {
        map[l.produto_id] = { produto_id: l.produto_id, nome: l._nome || l.produto_id, talhoes: {}, total: 0 };
      }
      map[l.produto_id].talhoes[talhaoNome] = (map[l.produto_id].talhoes[talhaoNome] || 0) + kg;
      map[l.produto_id].total += kg;
    });
  });
  return Object.values(map);
}

const STATUS_COMPRA = ['Pendente', 'Parcial', 'Comprado'];

function linhaCompraVazia(produto_id, nome) {
  return { produto_id, nome, qtd_comprada: '', data_compra: '', fornecedor: '', preco_unit: '', unidade_preco: 'kg', status: 'Pendente', observacoes: '' };
}

export default function AbaCompra({ produtor, safra, talhoes, saving, onSavePlano, planos }) {
  const [compras, setCompras] = useState({});

  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples = [] } = useQuery({ queryKey: ['fontes_simples'], queryFn: () => base44.entities.FonteSimples.list() });

  const todosProdutos = useMemo(() => [
    ...fertilizantes.map(f => ({ ...f, _tipo: 'formulado' })),
    ...fontesSimples.map(f => ({ ...f, _tipo: 'fonte' })),
  ], [fertilizantes, fontesSimples]);

  const talhoesProdutor = useMemo(() =>
    talhoes.filter(t => t.codigo_produtor === produtor?.codigo),
    [talhoes, produtor]);

  const planosProdutor = useMemo(() =>
    planos.filter(p => p.codigo_produtor === produtor?.codigo && p.safra === safra),
    [planos, produtor, safra]);

  const necessidade = useMemo(() =>
    agruparNecessidade(planosProdutor, talhoesProdutor),
    [planosProdutor, talhoesProdutor]);

  // Enriquecer com nome real do produto
  const necessidadeComNome = useMemo(() => necessidade.map(n => ({
    ...n,
    nome: todosProdutos.find(p => p.id === n.produto_id)?.nome || n.nome,
  })), [necessidade, todosProdutos]);

  // Hidratar compras salvas — usa o primeiro plano do produtor como "container" de compras
  const planoContainer = planosProdutor[0];
  useEffect(() => {
    if (!planoContainer) { setCompras({}); return; }
    const saved = planoContainer.compras || {};
    setCompras(saved);
  }, [planoContainer?.id, safra]);

  const getCompra = (produto_id) => compras[produto_id] || linhaCompraVazia(produto_id, '');
  const setCompra = (produto_id, campo, valor) => {
    setCompras(prev => ({
      ...prev,
      [produto_id]: { ...getCompra(produto_id), [campo]: valor },
    }));
  };

  const handleSave = () => {
    if (!planoContainer) return;
    onSavePlano(planoContainer, { compras });
  };

  const talhaoNomes = useMemo(() => {
    const nomes = new Set();
    necessidadeComNome.forEach(n => Object.keys(n.talhoes).forEach(t => nomes.add(t)));
    return Array.from(nomes).sort();
  }, [necessidadeComNome]);

  if (!produtor || !safra) return (
    <div className="text-center py-12 text-muted-foreground">Selecione produtor e safra para ver o plano de compras.</div>
  );

  if (necessidadeComNome.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p>Nenhum produto planejado ainda. Acesse a aba <strong>Planejamento</strong> primeiro.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Tabela de necessidade */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 border-b border-border">
          <ShoppingCart className="w-4 h-4 text-amber-700" />
          <span className="font-semibold text-sm text-amber-800">Necessidade Total por Produto (do Planejamento)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2 pl-4 pr-2 font-medium text-muted-foreground">Produto</th>
                {talhaoNomes.map(t => (
                  <th key={t} className="text-center py-2 px-2 font-medium text-muted-foreground">{t}</th>
                ))}
                <th className="text-center py-2 px-2 font-medium text-muted-foreground">Total (kg)</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground">Total (sc 60kg)</th>
              </tr>
            </thead>
            <tbody>
              {necessidadeComNome.map(n => (
                <tr key={n.produto_id} className="border-b border-border/40 hover:bg-muted/10">
                  <td className="py-2 pl-4 pr-2 font-medium">{n.nome}</td>
                  {talhaoNomes.map(t => (
                    <td key={t} className="py-2 px-2 text-center">{n.talhoes[t] ? `${Math.round(n.talhoes[t])} kg` : '—'}</td>
                  ))}
                  <td className="py-2 px-2 text-center font-bold">{Math.round(n.total)} kg</td>
                  <td className="py-2 px-2 text-center text-muted-foreground">{(n.total / 60).toFixed(1)} sc</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registro de compra */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 bg-blue-50 border-b border-border">
          <span className="font-semibold text-sm text-blue-800">Registro de Compras</span>
        </div>
        <div className="space-y-3 p-4">
          {necessidadeComNome.map(n => {
            const c = getCompra(n.produto_id);
            const comprada = parseFloat(c.qtd_comprada) || 0;
            const pendente = Math.round(n.total) - comprada;
            const valorTotal = comprada > 0 && c.preco_unit ? (comprada * parseFloat(c.preco_unit)).toFixed(2) : null;

            return (
              <div key={n.produto_id} className="border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-sm">{n.nome}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Necessário: <strong>{Math.round(n.total)} kg</strong></span>
                    {pendente > 0 && (
                      <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                        <AlertCircle className="w-3 h-3" /> Pendente: {pendente} kg
                      </span>
                    )}
                    {pendente <= 0 && comprada > 0 && (
                      <span className="text-xs text-green-600 font-medium">✅ Comprado</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Qtd comprada (kg)</p>
                    <Input type="number" value={c.qtd_comprada} onChange={e => setCompra(n.produto_id, 'qtd_comprada', e.target.value)} className="h-7 text-xs" placeholder="0" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Data da compra</p>
                    <Input type="date" value={c.data_compra} onChange={e => setCompra(n.produto_id, 'data_compra', e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Fornecedor</p>
                    <Input value={c.fornecedor} onChange={e => setCompra(n.produto_id, 'fornecedor', e.target.value)} className="h-7 text-xs" placeholder="Nome do fornecedor" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Preço (R$/kg ou sc)</p>
                    <div className="flex gap-1">
                      <Input type="number" value={c.preco_unit} onChange={e => setCompra(n.produto_id, 'preco_unit', e.target.value)} className="h-7 text-xs" placeholder="0,00" />
                      <select value={c.unidade_preco} onChange={e => setCompra(n.produto_id, 'unidade_preco', e.target.value)} className="h-7 text-xs border border-input rounded px-1 bg-transparent w-16">
                        <option value="kg">/kg</option>
                        <option value="sc">/sc</option>
                        <option value="t">/t</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Valor total</p>
                    <Input value={valorTotal ? `R$ ${Number(valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''} readOnly className="h-7 text-xs bg-muted/20" placeholder="Calculado auto." />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <select value={c.status} onChange={e => setCompra(n.produto_id, 'status', e.target.value)} className="h-7 w-full text-xs border border-input rounded px-2 bg-transparent">
                      {STATUS_COMPRA.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Observações</p>
                    <Input value={c.observacoes} onChange={e => setCompra(n.produto_id, 'observacoes', e.target.value)} className="h-7 text-xs" placeholder="Obs..." />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving || !planoContainer} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Compras
          </Button>
        </div>
      </div>
    </div>
  );
}