import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { FileText, Plus, TrendingUp, Package, Filter, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ImportarNotaFiscal from '@/components/notas/ImportarNotaFiscal';
import { consolidarPrecosItens } from '@/lib/notasFiscais';

const fmtR = (v) => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

export default function NotasFiscais() {
  const [modalAberto, setModalAberto] = useState(false);
  const [produtorFiltro, setProdutorFiltro] = useState('todos');

  const { data: produtores = [] } = useQuery({
    queryKey: ['produtores', 'completo'],
    queryFn: () => base44.entities.Produtor.list(undefined, 5000),
  });

  const { data: notas = [], refetch: refetchNotas } = useQuery({
    queryKey: ['notas_fiscais'],
    queryFn: () => base44.entities.BaseNotasFiscais.list('-data_emissao', 5000),
  });

  const { data: itens = [], refetch: refetchItens } = useQuery({
    queryKey: ['itens_notas'],
    queryFn: () => base44.entities.BaseItensNotaFiscal.list('-created_date', 10000),
  });

  const handleImportado = () => {
    refetchNotas();
    refetchItens();
  };

  // Filtragem por produtor
  const notasFiltradas = useMemo(() =>
    produtorFiltro === 'todos' ? notas : notas.filter(n => n.produtor_id === produtorFiltro),
    [notas, produtorFiltro]
  );
  const itensFiltrados = useMemo(() =>
    produtorFiltro === 'todos' ? itens : itens.filter(i => i.produtor_id === produtorFiltro),
    [itens, produtorFiltro]
  );

  // Média ponderada pela quantidade comprada; evita distorção entre notas pequenas e grandes.
  const tabelaPrecos = useMemo(() => consolidarPrecosItens(itensFiltrados), [itensFiltrados]);

  const produtorNome = (id) => {
    const p = produtores.find(x => x.id === id);
    return p ? (p.nome || p.codigo_produtor || id) : id;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Notas Fiscais
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Importação de NF-e e banco de preços de insumos</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={produtorFiltro} onValueChange={setProdutorFiltro}>
              <SelectTrigger className="w-52 h-9 text-sm">
                <SelectValue placeholder="Todos os produtores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os produtores</SelectItem>
                {produtores.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nome || p.fazenda || p.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {produtorFiltro !== 'todos' && (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setProdutorFiltro('todos')}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <Button onClick={() => setModalAberto(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Importar XML/PDF de Nota Fiscal
          </Button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total de Notas</p>
          <p className="text-2xl font-bold text-foreground">{notasFiltradas.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total de Itens</p>
          <p className="text-2xl font-bold text-foreground">{itensFiltrados.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Produtos Únicos</p>
          <p className="text-2xl font-bold text-foreground">{tabelaPrecos.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Valor Total (notas)</p>
          <p className="text-lg font-bold text-primary">{fmtR(notasFiltradas.reduce((s, n) => s + (n.valor_total || 0), 0))}</p>
        </div>
      </div>

      {/* Tabela de preços consolidada */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Banco de Preços Consolidado</h2>
          <span className="text-xs text-muted-foreground ml-1">({tabelaPrecos.length} produtos)</span>
        </div>
        {tabelaPrecos.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhum dado disponível ainda. Importe uma nota fiscal para visualizar os preços.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  {['Produto', 'Unidade', 'Menor Preço', 'Maior Preço', 'Preço Médio', 'Nº Notas'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabelaPrecos.map((row, i) => (
                  <tr key={i} className={`border-b border-border/50 last:border-0 hover:bg-muted/10 ${i % 2 === 1 ? 'bg-muted/5' : ''}`}>
                    <td className="px-4 py-2.5 font-medium max-w-[260px] truncate">{row.produto_nome}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded font-mono">{row.unidade_medida || '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-green-700 font-medium">{fmtR(row.menor_preco)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-destructive font-medium">{fmtR(row.maior_preco)}</td>
                    <td className="px-4 py-2.5 tabular-nums font-semibold text-primary">{fmtR(row.preco_medio)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">{row.num_notas}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lista de notas importadas */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Notas Importadas</h2>
          <span className="text-xs text-muted-foreground ml-1">({notasFiltradas.length})</span>
        </div>
        {notasFiltradas.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhuma nota importada ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  {['Nº Nota', 'Fornecedor', 'Produtor', 'Data Emissão', 'Valor Total'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {notasFiltradas.map((n, i) => (
                  <tr key={n.id} className={`border-b border-border/50 last:border-0 hover:bg-muted/10 ${i % 2 === 1 ? 'bg-muted/5' : ''}`}>
                    <td className="px-4 py-2.5 font-mono font-medium">{n.numero_nota || '—'}</td>
                    <td className="px-4 py-2.5">{n.fornecedor_nome || '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{produtorNome(n.produtor_id)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{n.data_emissao || '—'}</td>
                    <td className="px-4 py-2.5 tabular-nums font-semibold text-primary">{fmtR(n.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ImportarNotaFiscal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        produtores={produtores}
        onImportado={handleImportado}
      />
    </div>
  );
}