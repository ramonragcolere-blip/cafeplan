import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const GRUPOS = [
  'Todos', 'Fertilizante Solo', 'Fertilizante Solo + Nematicida Biológico', 'Fertilizante Foliar',
  'Fosfatado', 'Fonte de Nitrogênio', 'Fonte de Fósforo', 'Fonte de Potássio',
  'Fonte de Magnésio', 'Fonte de Boro', 'Fonte de Zinco', 'Fonte de Cobre',
  'Corretivo', 'Condicionador de Solo', 'Organomineral', 'Outro',
];

const NUTRIENTES_PCT = ['n_pct', 'p2o5_pct', 'k2o_pct', 'ca_pct', 'mg_pct', 's_pct', 'b_pct', 'zn_pct', 'cu_pct'];
const LABELS = { n_pct: 'N', p2o5_pct: 'P₂O₅', k2o_pct: 'K₂O', ca_pct: 'Ca', mg_pct: 'Mg', s_pct: 'S', b_pct: 'B', zn_pct: 'Zn', cu_pct: 'Cu' };

function ComposicaoTag({ produto }) {
  const tags = NUTRIENTES_PCT.filter(k => produto[k] > 0)
    .map(k => `${produto[k]}% ${LABELS[k]}`);
  if (!tags.length && produto.composicao_texto) return <span className="text-xs text-muted-foreground">{produto.composicao_texto}</span>;
  return <span className="text-xs text-muted-foreground">{tags.join(' · ') || '—'}</span>;
}

function DetalheRow({ p }) {
  return (
    <tr>
      <td colSpan={6} className="px-4 pb-4 pt-2 bg-muted/20">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {p.dose_viveiro && <div><span className="font-medium">Viveiro: </span>{p.dose_viveiro}</div>}
          {p.dose_plantio && <div><span className="font-medium">Plantio: </span>{p.dose_plantio}</div>}
          {p.dose_1ano_recepa && <div><span className="font-medium">1 ano/Recepa: </span>{p.dose_1ano_recepa}</div>}
          {p.dose_producao && <div><span className="font-medium">Produção: </span>{p.dose_producao}</div>}
          {p.dose_esqueletado && <div><span className="font-medium">Esqueletado: </span>{p.dose_esqueletado}</div>}
          {p.unidade_aplicacao && <div><span className="font-medium">Unidade: </span>{p.unidade_aplicacao}</div>}
          {p.intervalo_seguranca && <div><span className="font-medium">Intervalo: </span>{p.intervalo_seguranca}</div>}
          {p.instrucoes_uso && <div className="col-span-2 sm:col-span-4"><span className="font-medium">Instruções: </span>{p.instrucoes_uso}</div>}
          {p.observacoes && <div className="col-span-2 sm:col-span-4"><span className="font-medium">Obs: </span>{p.observacoes}</div>}
        </div>
      </td>
    </tr>
  );
}

export default function TabelaFertilizantes({ dados, loading, onNovo, onEditar, onDeletar }) {
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('Todos');
  const [expandido, setExpandido] = useState(null);

  const filtrados = dados.filter(p => {
    const matchBusca = (p.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
      (p.fornecedor || '').toLowerCase().includes(busca.toLowerCase());
    const matchGrupo = grupo === 'Todos' || p.grupo === grupo;
    return matchBusca && matchGrupo;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-10 w-64" />
          </div>
          <Select value={grupo} onValueChange={setGrupo}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {GRUPOS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onNovo} className="gap-2"><Plus className="w-4 h-4" />Novo Produto</Button>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Produto</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Fornecedor</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Grupo</th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">Composição</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground w-16">Detalhes</th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Carregando...</td></tr>
              )}
              {!loading && filtrados.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum produto encontrado.</td></tr>
              )}
              {filtrados.map(p => (
                <React.Fragment key={p.id}>
                  <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{p.nome}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.fornecedor || '—'}</td>
                    <td className="px-3 py-2.5">
                      {p.grupo && <Badge variant="secondary" className="text-xs whitespace-nowrap">{p.grupo}</Badge>}
                    </td>
                    <td className="px-3 py-2.5"><ComposicaoTag produto={p} /></td>
                    <td className="px-3 py-2.5 text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandido(expandido === p.id ? null : p.id)}>
                        {expandido === p.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1 justify-center">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditar(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeletar(p)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                  {expandido === p.id && <DetalheRow p={p} />}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
          {filtrados.length} produto(s)
        </div>
      </div>
    </div>
  );
}