import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sprout, ChevronDown, ChevronUp, Plus, Trash2, Save, Loader2, ArrowUpDown, DollarSign } from 'lucide-react';
import { GRUPOS_PLANEJAMENTO, ordenarCalda } from './FoliarNutrienteUtils';

const EQUIPAMENTOS = ['Bomba costal', 'Atomizador', 'Drone', 'Canhão'];
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const FORMULACAO_LABEL = { WG: 'WG', SC: 'SC', SL: 'SL', EC: 'EC', EW: 'EW', outro: 'Outro' };

const GRUPOS_DEFENSIVO = ['Fungicida', 'Inseticida', 'Inseticida Biológico', 'Acaricida'];
const GRUPOS_HERBICIDA = ['Herbicida'];

function calcCustosFoliar(aplicacoes, areaHa) {
  let foliar = 0, defensivo = 0, herbicida = 0;
  aplicacoes.forEach(aplic => {
    (aplic.produtos || []).forEach(p => {
      const preco = parseFloat(String(p.preco || '').replace(',', '.')) || 0;
      const dose = parseFloat(String(p.dose || '').replace(',', '.')) || 0;
      if (!preco || !dose || !areaHa) return;
      const custo = dose * preco * areaHa;
      if (GRUPOS_DEFENSIVO.includes(p.grupo)) defensivo += custo;
      else if (GRUPOS_HERBICIDA.includes(p.grupo)) herbicida += custo;
      else foliar += custo;
    });
  });
  return { foliar, defensivo, herbicida, total: foliar + defensivo + herbicida };
}

function ProdutoRow({ produto, areaHa, onRemover, onPrecoChange }) {
  const precoNum = parseFloat(String(produto.preco || '').replace(',', '.')) || 0;
  const doseNum = parseFloat(String(produto.dose || '').replace(',', '.')) || 0;
  const custoHa = precoNum > 0 && doseNum > 0 ? doseNum * precoNum : null;
  const custoTotal = custoHa && areaHa > 0 ? custoHa * areaHa : null;

  return (
    <div className="bg-muted/20 rounded-lg px-3 py-2 space-y-2 text-sm border border-border/40">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-medium">{produto.produto_nome}</span>
        {produto.tipo_formulacao && (
          <Badge variant="outline" className="text-xs shrink-0">{FORMULACAO_LABEL[produto.tipo_formulacao] || produto.tipo_formulacao}</Badge>
        )}
        {produto.grupo && (
          <Badge variant="secondary" className="text-xs shrink-0 hidden sm:inline-flex">{produto.grupo}</Badge>
        )}
        <span className="text-xs text-muted-foreground shrink-0">{produto.dose || ''} {produto.unidade || ''}</span>
        <button type="button" onClick={onRemover} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3 h-3 text-muted-foreground" />
          <Label className="text-xs text-muted-foreground">Preço (R$/kg ou R$/L):</Label>
          <Input
            type="number" value={produto.preco || ''} min="0" step="0.01"
            onChange={e => onPrecoChange(e.target.value)}
            className="h-6 w-20 text-xs" placeholder="0,00"
          />
        </div>
        {custoHa != null && (
          <span className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-0.5">
            Custo/ha: {custoHa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        )}
        {custoTotal != null && (
          <span className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-0.5 font-semibold">
            Total talhão: {custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        )}
      </div>
    </div>
  );
}

function AplicacaoBlock({ aplicacao, insumos, faseTalhao, areaHa, onChange, onRemover, onSave, saving }) {
  const [busca, setBusca] = useState('');
  const [produtoSel, setProdutoSel] = useState('');
  const [dose, setDose] = useState('');
  const [unidade, setUnidade] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const insumosFiltrados = useMemo(() => {
    const base = insumos.filter(p => GRUPOS_PLANEJAMENTO.includes(p.grupo) && p.ativo !== false);
    if (!busca) return base;
    return base.filter(p =>
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.grupo || '').toLowerCase().includes(busca.toLowerCase())
    );
  }, [insumos, busca]);

  // Auto-preenche dose/unidade ao selecionar produto conforme fase do talhão
  const handleSelectProduto = (id) => {
    setProdutoSel(id);
    const ins = insumos.find(p => p.id === id);
    if (ins) {
      let doseAuto = '';
      const fase = faseTalhao || '';
      let campoDose = 'dose_producao';
      if (fase.includes('Em formação')) {
        doseAuto = ins.dose_plantio || '';
        campoDose = 'dose_plantio';
      } else if (fase.includes('Recepado')) {
        doseAuto = ins.dose_1ano_recepa || '';
        campoDose = 'dose_1ano_recepa';
      } else if (fase.includes('Esqueletado')) {
        doseAuto = ins.dose_esqueletado || '';
        campoDose = 'dose_esqueletado';
      } else {
        doseAuto = ins.dose_producao || '';
        campoDose = 'dose_producao';
      }
      console.log('[AbaPlanejamentoFoliar] faseTalhao prop:', JSON.stringify(faseTalhao), '| fase (string):', JSON.stringify(fase), '| Campo dose:', campoDose, '| Valor:', doseAuto, '| dose_producao no produto:', ins.dose_producao, '| Produto:', ins.nome);
      setDose(doseAuto);
      setUnidade(ins.unidade_aplicacao || '');
    }
  };

  const handleAddProduto = () => {
    const ins = insumos.find(p => p.id === produtoSel);
    if (!ins) return;
    const novoProduto = {
      produto_id: ins.id,
      produto_nome: ins.nome,
      dose,
      unidade,
      tipo_formulacao: ins.tipo_formulacao || '',
      grupo: ins.grupo || '',
      preco: '',
    };
    onChange({ ...aplicacao, produtos: [...(aplicacao.produtos || []), novoProduto] });
    setProdutoSel(''); setDose(''); setUnidade(''); setBusca(''); setAddOpen(false);
  };

  const handlePrecoChange = (idx, valor) => {
    const novos = [...(aplicacao.produtos || [])];
    novos[idx] = { ...novos[idx], preco: valor };
    onChange({ ...aplicacao, produtos: novos });
  };

  const handleRemoverProduto = (idx) => {
    onChange({ ...aplicacao, produtos: aplicacao.produtos.filter((_, i) => i !== idx) });
  };

  const handleOrdenarCalda = () => {
    onChange({ ...aplicacao, produtos: ordenarCalda(aplicacao.produtos || []) });
  };

  const toggleMes = (mes) => {
    const atual = aplicacao.meses || [];
    const novo = atual.includes(mes) ? atual.filter(m => m !== mes) : [...atual, mes];
    onChange({ ...aplicacao, meses: novo });
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Header da aplicação */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/20 gap-2">
        <Input
          value={aplicacao.titulo || ''}
          onChange={e => onChange({ ...aplicacao, titulo: e.target.value })}
          placeholder="Nome da aplicação (ex: Pós-colheita, Controle ferrugem...)"
          className="h-8 text-sm font-medium flex-1 bg-transparent border-0 shadow-none focus-visible:ring-1 px-1"
        />
        <button type="button" onClick={onRemover}
          className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-1 rounded"
          title="Remover aplicação">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Meses */}
        <div>
          <Label className="text-xs mb-2 block text-muted-foreground">Meses de aplicação</Label>
          <div className="flex flex-wrap gap-1.5">
            {MESES.map(mes => {
              const sel = (aplicacao.meses || []).includes(mes);
              return (
                <button
                  key={mes}
                  type="button"
                  onClick={() => toggleMes(mes)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                    sel
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                  }`}
                >
                  {mes}
                </button>
              );
            })}
          </div>
        </div>

        {/* Equipamento */}
        <div className="max-w-xs">
          <Label className="text-xs mb-1 block text-muted-foreground">Equipamento</Label>
          <Select value={aplicacao.equipamento || 'none'} onValueChange={v => onChange({ ...aplicacao, equipamento: v === 'none' ? '' : v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Selecione…</SelectItem>
              {EQUIPAMENTOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Produtos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">Produtos</Label>
            <div className="flex gap-2">
              {(aplicacao.produtos || []).length > 1 && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleOrdenarCalda}>
                  <ArrowUpDown className="w-3 h-3" /> Organizar ordem de preparo
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setAddOpen(a => !a)}>
                <Plus className="w-3.5 h-3.5" /> Adicionar produto
              </Button>
            </div>
          </div>

          {addOpen && (
            <div className="border border-border rounded-lg p-3 mb-2 space-y-2 bg-muted/10">
              <Input
                placeholder="Buscar produto por nome ou grupo..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="h-8 text-sm"
              />
              <Select value={produtoSel} onValueChange={handleSelectProduto}>
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
                <div className="flex-1">
                  <Label className="text-xs mb-0.5 block text-muted-foreground">Dose</Label>
                  <Input value={dose} onChange={e => setDose(e.target.value)} placeholder="ex: 2" className="h-8 text-sm" />
                </div>
                <div className="w-28">
                  <Label className="text-xs mb-0.5 block text-muted-foreground">Unidade</Label>
                  <Input value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="ex: L/ha" className="h-8 text-sm" />
                </div>
                <div className="flex items-end">
                  <Button size="sm" onClick={handleAddProduto} disabled={!produtoSel} className="h-8">Adicionar</Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {(!aplicacao.produtos || aplicacao.produtos.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhum produto adicionado</p>
            )}
            {(aplicacao.produtos || []).map((p, idx) => (
              <ProdutoRow
                key={idx}
                produto={p}
                areaHa={areaHa}
                onRemover={() => handleRemoverProduto(idx)}
                onPrecoChange={(val) => handlePrecoChange(idx, val)}
              />
            ))}
          </div>
        </div>

        {/* Salvar */}
        <div className="flex justify-end pt-1 border-t border-border/40">
          <Button size="sm" onClick={onSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar aplicação
          </Button>
        </div>
      </div>
    </div>
  );
}

function TalhaoPlano({ talhao, aplicacoes, insumos, onSaveAplicacao, onRemoverAplicacao, saving }) {
  const [aberto, setAberto] = useState(false);
  console.log('[TalhaoPlano] Talhão:', talhao.nome, '| fase_atual:', talhao.fase_atual, '| objeto completo:', talhao);
  // aplicacoes locais (podem ter id=null se ainda não salvas)
  const [local, setLocal] = useState(aplicacoes);

  useEffect(() => { setLocal(aplicacoes); }, [aplicacoes]);

  const handleNova = () => {
    setAberto(true);
    setLocal(prev => [...prev, { _tmpId: Date.now(), titulo: '', meses: [], equipamento: '', produtos: [], observacoes: '' }]);
  };

  const handleChange = (idx, updated) => {
    setLocal(prev => prev.map((a, i) => i === idx ? updated : a));
  };

  const handleSave = (idx) => {
    onSaveAplicacao(local[idx]);
  };

  const handleRemover = (idx) => {
    const aplic = local[idx];
    if (aplic.id) onRemoverAplicacao(aplic.id);
    setLocal(prev => prev.filter((_, i) => i !== idx));
  };

  const totalProdutos = aplicacoes.reduce((acc, a) => acc + (a.produtos?.length || 0), 0);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setAberto(a => !a)}>
        <div className="flex items-center gap-3">
          <Sprout className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold">{talhao.nome}</span>
          {talhao.area_ha && <span className="text-sm text-muted-foreground">{talhao.area_ha} ha</span>}
          {aplicacoes.length > 0 && <Badge variant="secondary" className="text-xs">{aplicacoes.length} aplicação(ões)</Badge>}
          {totalProdutos > 0 && <Badge variant="outline" className="text-xs hidden sm:inline-flex">{totalProdutos} produto(s)</Badge>}
        </div>
        {aberto ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {aberto && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Botão Nova Aplicação */}
          <Button onClick={handleNova} className="w-full gap-2" variant="outline">
            <Plus className="w-4 h-4" /> Nova Aplicação
          </Button>

          {local.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma aplicação cadastrada. Clique em "+ Nova Aplicação" para começar.</p>
          )}

          {local.map((aplic, idx) => (
            <AplicacaoBlock
              key={aplic.id || aplic._tmpId || idx}
              aplicacao={aplic}
              insumos={insumos}
              faseTalhao={talhao.fase_atual}
              areaHa={talhao.area_ha || 0}
              onChange={(updated) => handleChange(idx, updated)}
              onRemover={() => handleRemover(idx)}
              onSave={() => handleSave(idx)}
              saving={saving}
            />
          ))}

          {/* Resumo de custos do talhão */}
          {(() => {
            const custos = calcCustosFoliar(local, talhao.area_ha || 0);
            if (custos.total === 0) return null;
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Resumo de custos — {talhao.nome}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {custos.foliar > 0 && (
                    <div className="bg-white border border-amber-100 rounded-lg p-2.5 text-center">
                      <p className="text-amber-600">Adubação foliar</p>
                      <p className="font-bold text-amber-900">{custos.foliar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  )}
                  {custos.defensivo > 0 && (
                    <div className="bg-white border border-amber-100 rounded-lg p-2.5 text-center">
                      <p className="text-amber-600">Pragas e doenças</p>
                      <p className="font-bold text-amber-900">{custos.defensivo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  )}
                  {custos.herbicida > 0 && (
                    <div className="bg-white border border-amber-100 rounded-lg p-2.5 text-center">
                      <p className="text-amber-600">Plantas daninhas</p>
                      <p className="font-bold text-amber-900">{custos.herbicida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  )}
                </div>
                {custos.total > 0 && (
                  <p className="text-sm font-bold text-amber-900 text-right border-t border-amber-200 pt-2">
                    Total: {custos.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                )}
              </div>
            );
          })()}

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

export default function AbaPlanejamentoFoliar({ produtor, safra, talhoes, aplicacoes, insumos, onSaveAplicacao, onRemoverAplicacao, saving }) {
  const talhoesProdutor = talhoes.filter(t => t.codigo_produtor === produtor?.codigo);

  // Totais do produtor
  const totaisProdutor = useMemo(() => {
    let foliar = 0, defensivo = 0, herbicida = 0;
    talhoesProdutor.forEach(t => {
      const aplicacoesTalhao = aplicacoes.filter(a => a.talhao_id === t.id && a.safra === safra);
      const c = calcCustosFoliar(aplicacoesTalhao, t.area_ha || 0);
      foliar += c.foliar; defensivo += c.defensivo; herbicida += c.herbicida;
    });
    return { foliar, defensivo, herbicida, total: foliar + defensivo + herbicida };
  }, [talhoesProdutor, aplicacoes, safra]);

  return (
    <div className="space-y-4">
      {talhoesProdutor.length === 0 && (
        <div className="text-center text-muted-foreground py-10 bg-card rounded-2xl border border-border">
          <p>Nenhum talhão cadastrado para este produtor.</p>
        </div>
      )}
      {talhoesProdutor.map(talhao => {
        const aplicacoesTalhao = aplicacoes.filter(a => a.talhao_id === talhao.id && a.safra === safra);
        return (
          <TalhaoPlano
            key={talhao.id}
            talhao={talhao}
            aplicacoes={aplicacoesTalhao}
            insumos={insumos}
            onSaveAplicacao={(data) => onSaveAplicacao(talhao, data)}
            onRemoverAplicacao={onRemoverAplicacao}
            saving={saving}
          />
        );
      })}

      {/* Totais do produtor */}
      {totaisProdutor.total > 0 && talhoesProdutor.length > 1 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 space-y-3">
          <p className="text-sm font-bold text-amber-900 uppercase tracking-wide">Resumo de custos foliares — todos os talhões</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {totaisProdutor.foliar > 0 && (
              <div className="bg-white border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-xs text-amber-600">Adubação foliar</p>
                <p className="font-bold text-amber-900">{totaisProdutor.foliar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            )}
            {totaisProdutor.defensivo > 0 && (
              <div className="bg-white border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-xs text-amber-600">Pragas e doenças</p>
                <p className="font-bold text-amber-900">{totaisProdutor.defensivo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            )}
            {totaisProdutor.herbicida > 0 && (
              <div className="bg-white border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-xs text-amber-600">Plantas daninhas</p>
                <p className="font-bold text-amber-900">{totaisProdutor.herbicida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            )}
          </div>
          <p className="text-base font-bold text-amber-900 text-right border-t border-amber-200 pt-2">
            Total geral: {totaisProdutor.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      )}
    </div>
  );
}