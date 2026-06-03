import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const TIPOS_ATIVIDADE = ['Manual', 'Derriçadeira', 'Colhedora', 'Recolhedora', 'Varrição Manual', 'Varrição Mecanizada'];

function newLinha(defaults = {}) {
  return {
    _id: Math.random().toString(36).slice(2),
    tipo_colheita: defaults.tipo_colheita || 'Manual',
    tipo_pagamento: defaults.tipo_pagamento || 'producao',
    quantidade: '',
    valor: '',
    data: defaults.data || format(new Date(), 'yyyy-MM-dd'),
  };
}

function LinhaLancamento({ linha, onChange, onRemove, globalData, globalValor, globalTipo }) {
  const isProd = linha.tipo_pagamento === 'producao';

  const set = (field, val) => onChange({ ...linha, [field]: val });

  const data = globalData || linha.data;
  const tipo = globalTipo || linha.tipo_colheita;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end py-2 border-b border-border/30 last:border-0">
      {/* Tipo atividade */}
      <div>
        <Label className="text-xs mb-1 block">Atividade</Label>
        {globalTipo ? (
          <div className="h-8 flex items-center text-xs text-muted-foreground px-2 border rounded-md bg-muted/30">{globalTipo}</div>
        ) : (
          <Select value={tipo} onValueChange={v => set('tipo_colheita', v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS_ATIVIDADE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      {/* Tipo pagamento */}
      <div>
        <Label className="text-xs mb-1 block">Pagamento</Label>
        <Select value={linha.tipo_pagamento} onValueChange={v => set('tipo_pagamento', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="producao">Por produção</SelectItem>
            <SelectItem value="dia">Por dia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quantidade */}
      <div>
        <Label className="text-xs mb-1 block">{isProd ? 'Medidas' : 'Dias'}</Label>
        <Input type="number" step="0.01" value={linha.quantidade} onChange={e => set('quantidade', e.target.value)}
          className="h-8 text-xs" placeholder={isProd ? 'Qtd medidas' : 'Dias trab.'} />
      </div>

      {/* Valor */}
      <div>
        <Label className="text-xs mb-1 block">{isProd ? 'R$/Medida' : 'R$/Dia'}</Label>
        {globalValor ? (
          <div className="h-8 flex items-center text-xs text-muted-foreground px-2 border rounded-md bg-muted/30">R$ {globalValor}</div>
        ) : (
          <Input type="number" step="0.01" value={linha.valor} onChange={e => set('valor', e.target.value)}
            className="h-8 text-xs" placeholder="0,00" />
        )}
      </div>

      {/* Data */}
      <div className="flex gap-1 items-end">
        <div className="flex-1">
          <Label className="text-xs mb-1 block">Data</Label>
          {globalData ? (
            <div className="h-8 flex items-center text-xs text-muted-foreground px-2 border rounded-md bg-muted/30">{globalData}</div>
          ) : (
            <Input type="date" value={linha.data} onChange={e => set('data', e.target.value)} className="h-8 text-xs" />
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive/70 hover:text-destructive" onClick={onRemove}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function TalhaoBlock({ talhao, safristas, globalData, globalValor, globalTipo, linhas, setLinhas }) {
  const [aberto, setAberto] = useState(true);

  const addLinha = (safristaId) => {
    setLinhas(prev => ({
      ...prev,
      [safristaId]: [...(prev[safristaId] || []), newLinha({ data: globalData, tipo_colheita: globalTipo, valor: globalValor })],
    }));
  };

  const updateLinha = (safristaId, idx, val) => {
    setLinhas(prev => {
      const arr = [...(prev[safristaId] || [])];
      arr[idx] = val;
      return { ...prev, [safristaId]: arr };
    });
  };

  const removeLinha = (safristaId, idx) => {
    setLinhas(prev => {
      const arr = [...(prev[safristaId] || [])];
      arr.splice(idx, 1);
      return { ...prev, [safristaId]: arr };
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setAberto(v => !v)}
      >
        <span className="font-semibold text-sm">{talhao.nome}</span>
        {aberto ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {aberto && (
        <div className="p-4 space-y-4 divide-y divide-border/40">
          {safristas.map(s => {
            const linhasS = linhas[s.id] || [];
            return (
              <div key={s.id} className="pt-3 first:pt-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{s.nome}</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addLinha(s.id)}>
                    <Plus className="w-3 h-3" /> Adicionar linha
                  </Button>
                </div>
                {linhasS.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhuma linha — clique em "+ Adicionar linha"</p>
                ) : (
                  linhasS.map((linha, idx) => (
                    <LinhaLancamento
                      key={linha._id}
                      linha={linha}
                      onChange={val => updateLinha(s.id, idx, val)}
                      onRemove={() => removeLinha(s.id, idx)}
                      globalData={globalData}
                      globalValor={globalValor}
                      globalTipo={globalTipo}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function LancamentoEmLote({ produtorCodigo, talhoes, safristas, onSalvar, saving }) {
  const [globalData, setGlobalData] = useState('');
  const [globalValor, setGlobalValor] = useState('');
  const [globalTipo, setGlobalTipo] = useState('');
  // linhas: { [safristaId]: LinhaLancamento[] } por talhão
  // estrutura: { [talhaoId]: { [safristaId]: LinhaLancamento[] } }
  const [linhasPorTalhao, setLinhasPorTalhao] = useState({});

  const talhoesProdutor = useMemo(() => talhoes.filter(t => t.codigo_produtor === produtorCodigo), [talhoes, produtorCodigo]);
  const safristasProdutor = useMemo(() => safristas.filter(s => s.codigo_produtor === produtorCodigo && s.status !== 'INATIVO'), [safristas, produtorCodigo]);

  const setLinhasTalhao = (talhaoId) => (updater) => {
    setLinhasPorTalhao(prev => ({
      ...prev,
      [talhaoId]: typeof updater === 'function' ? updater(prev[talhaoId] || {}) : updater,
    }));
  };

  const totalLinhas = useMemo(() => {
    let total = 0;
    for (const tLinhas of Object.values(linhasPorTalhao)) {
      for (const sLinhas of Object.values(tLinhas)) {
        total += sLinhas.filter(l => l.quantidade).length;
      }
    }
    return total;
  }, [linhasPorTalhao]);

  const handleSalvar = () => {
    const registros = [];
    for (const talhao of talhoesProdutor) {
      const tLinhas = linhasPorTalhao[talhao.id] || {};
      for (const safrista of safristasProdutor) {
        const sLinhas = tLinhas[safrista.id] || [];
        for (const linha of sLinhas) {
          if (!linha.quantidade) continue;
          const qtd = Number(linha.quantidade) || 0;
          const val = Number(globalValor || linha.valor) || 0;
          const isProd = linha.tipo_pagamento === 'producao';
          const medidas = isProd ? qtd : qtd; // dias também usam campo medidas_colhidas
          const total = qtd * val;
          registros.push({
            codigo_produtor: produtorCodigo,
            data: globalData || linha.data,
            safrista: safrista.nome,
            talhao: talhao.nome,
            tipo_colheita: globalTipo || linha.tipo_colheita,
            medidas_colhidas: medidas,
            valor_medida: val,
            valor_total: total,
          });
        }
      }
    }
    onSalvar(registros);
    setLinhasPorTalhao({});
  };

  if (!produtorCodigo) return null;

  return (
    <div className="space-y-4">
      {/* Opções globais */}
      <div className="bg-muted/30 border border-border rounded-xl p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Aplicar para todos os lançamentos</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs mb-1 block">Mesma data para todos</Label>
            <Input type="date" value={globalData} onChange={e => setGlobalData(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Mesmo valor para todos (R$)</Label>
            <Input type="number" step="0.01" value={globalValor} onChange={e => setGlobalValor(e.target.value)} className="h-8 text-sm" placeholder="Ex: 35,00" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Mesmo tipo de atividade para todos</Label>
            <Select value={globalTipo} onValueChange={setGlobalTipo}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="(individual por linha)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Individual por linha</SelectItem>
                {TIPOS_ATIVIDADE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Blocos por talhão */}
      {talhoesProdutor.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum talhão cadastrado para este produtor.</p>
      ) : (
        <div className="space-y-3">
          {talhoesProdutor.map(talhao => (
            <TalhaoBlock
              key={talhao.id}
              talhao={talhao}
              safristas={safristasProdutor}
              globalData={globalData}
              globalValor={globalValor}
              globalTipo={globalTipo}
              linhas={linhasPorTalhao[talhao.id] || {}}
              setLinhas={setLinhasTalhao(talhao.id)}
            />
          ))}
        </div>
      )}

      {/* Botão salvar */}
      {totalLinhas > 0 && (
        <div className="flex justify-end pt-2">
          <Button onClick={handleSalvar} disabled={saving} className="gap-2 h-10">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar todos ({totalLinhas} lançamento{totalLinhas !== 1 ? 's' : ''})
          </Button>
        </div>
      )}
    </div>
  );
}