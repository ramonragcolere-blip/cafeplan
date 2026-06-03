import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const TIPOS_ATIVIDADE = ['Manual', 'Derriçadeira', 'Colhedora', 'Recolhedora', 'Varrição Manual', 'Varrição Mecanizada'];

function newLinha() {
  return {
    _id: Math.random().toString(36).slice(2),
    tipo_colheita: 'Manual',
    tipo_pagamento: 'producao',
    quantidade: '',
    valor: '',
  };
}

function LinhaLancamento({ linha, onChange, onRemove, globalValor, canRemove }) {
  const set = (field, val) => onChange({ ...linha, [field]: val });
  const isProd = linha.tipo_pagamento === 'producao';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end py-2 border-b border-border/20 last:border-0">
      <div>
        <Label className="text-xs mb-1 block">Atividade</Label>
        <Select value={linha.tipo_colheita} onValueChange={v => set('tipo_colheita', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{TIPOS_ATIVIDADE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>
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
      <div>
        <Label className="text-xs mb-1 block">{isProd ? 'Medidas' : 'Dias'}</Label>
        <Input type="number" step="0.01" value={linha.quantidade}
          onChange={e => set('quantidade', e.target.value)}
          className="h-8 text-xs" placeholder="0" />
      </div>
      <div className="flex gap-1 items-end">
        <div className="flex-1">
          <Label className="text-xs mb-1 block">{isProd ? 'R$/Medida' : 'R$/Dia'}</Label>
          {globalValor ? (
            <div className="h-8 flex items-center text-xs px-2 border rounded-md bg-muted/40 text-muted-foreground">
              R$ {globalValor}
            </div>
          ) : (
            <Input type="number" step="0.01" value={linha.valor}
              onChange={e => set('valor', e.target.value)}
              className="h-8 text-xs" placeholder="0,00" />
          )}
        </div>
        {canRemove && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive/60 hover:text-destructive" onClick={onRemove}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function TalhaoBlock({ talhao, safristas, globalData, globalValor, onSalvar, saving }) {
  const [aberto, setAberto] = useState(false);
  // linhas: { [safristaId]: LinhaLancamento[] }
  const [linhas, setLinhas] = useState(() => {
    const init = {};
    safristas.forEach(s => { init[s.id] = [newLinha()]; });
    return init;
  });

  const addLinha = (sid) => setLinhas(prev => ({ ...prev, [sid]: [...prev[sid], newLinha()] }));
  const updateLinha = (sid, idx, val) => setLinhas(prev => {
    const arr = [...prev[sid]]; arr[idx] = val; return { ...prev, [sid]: arr };
  });
  const removeLinha = (sid, idx) => setLinhas(prev => {
    const arr = [...prev[sid]]; arr.splice(idx, 1); return { ...prev, [sid]: arr };
  });

  const totalLinhas = Object.values(linhas).flat().filter(l => l.quantidade).length;

  const handleSalvar = () => {
    const registros = [];
    safristas.forEach(s => {
      (linhas[s.id] || []).forEach(linha => {
        if (!linha.quantidade) return;
        const qtd = Number(linha.quantidade) || 0;
        const val = Number(globalValor || linha.valor) || 0;
        registros.push({
          safrista: s.nome,
          talhao: talhao.nome,
          tipo_colheita: linha.tipo_colheita,
          medidas_colhidas: qtd,
          valor_medida: val,
          valor_total: qtd * val,
          data: globalData || format(new Date(), 'yyyy-MM-dd'),
        });
      });
    });
    onSalvar(registros, () => {
      // reset após salvar
      const init = {};
      safristas.forEach(s => { init[s.id] = [newLinha()]; });
      setLinhas(init);
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
        onClick={() => setAberto(v => !v)}
      >
        <span className="font-semibold text-sm">{talhao.nome}</span>
        {aberto
          ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {aberto && (
        <div className="border-t border-border">
          <div className="p-4 space-y-5">
            {safristas.map(s => (
              <div key={s.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{s.nome}</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => addLinha(s.id)}>
                    <Plus className="w-3 h-3" /> Adicionar linha
                  </Button>
                </div>
                <div className="bg-muted/10 rounded-lg px-3 pt-1 pb-2">
                  {(linhas[s.id] || []).map((linha, idx) => (
                    <LinhaLancamento
                      key={linha._id}
                      linha={linha}
                      onChange={val => updateLinha(s.id, idx, val)}
                      onRemove={() => removeLinha(s.id, idx)}
                      globalValor={globalValor}
                      canRemove={(linhas[s.id] || []).length > 1}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 pb-4 flex justify-end">
            <Button onClick={handleSalvar} disabled={saving || totalLinhas === 0} size="sm" className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar talhão {totalLinhas > 0 ? `(${totalLinhas})` : ''}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LancamentoEmLote({ produtorCodigo, talhoes, safristas, onSalvarRegistros, saving }) {
  const [globalData, setGlobalData] = useState('');
  const [globalValor, setGlobalValor] = useState('');

  const talhoesProdutor = useMemo(() => talhoes.filter(t => t.codigo_produtor === produtorCodigo), [talhoes, produtorCodigo]);
  const safristasProdutor = useMemo(() => safristas.filter(s => s.codigo_produtor === produtorCodigo && s.status !== 'INATIVO'), [safristas, produtorCodigo]);

  if (!produtorCodigo) return null;

  return (
    <div className="space-y-4">
      {/* Opções globais */}
      <div className="bg-muted/30 border border-border rounded-xl p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Aplicar para todos</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1 block">Mesma data para todos</Label>
            <Input type="date" value={globalData} onChange={e => setGlobalData(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Mesmo valor para todos (R$)</Label>
            <Input type="number" step="0.01" value={globalValor} onChange={e => setGlobalValor(e.target.value)}
              className="h-8 text-sm" placeholder="Ex: 35,00" />
          </div>
        </div>
      </div>

      {/* Talhões recolhidos */}
      {talhoesProdutor.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum talhão cadastrado para este produtor.</p>
      ) : (
        <div className="space-y-2">
          {talhoesProdutor.map(talhao => (
            <TalhaoBlock
              key={talhao.id}
              talhao={talhao}
              safristas={safristasProdutor}
              globalData={globalData}
              globalValor={globalValor}
              onSalvar={(registros, onReset) => onSalvarRegistros(registros, onReset)}
              saving={saving}
            />
          ))}
        </div>
      )}
    </div>
  );
}