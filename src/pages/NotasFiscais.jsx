import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { FileText, Plus, TrendingUp, Package, Filter, X, Eye } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ImportarNotaFiscal from '@/components/notas/ImportarNotaFiscal';
import DetalhesNotaFiscal from '@/components/notas/DetalhesNotaFiscal';
import { consolidarPrecosItens } from '@/lib/notasFiscais';
import { montarCatalogoCategorias, classificarProduto, normalizarNome } from '@/lib/notasFiscaisCategorias';
import PainelFiltrosNotas from '@/components/notas/PainelFiltrosNotas';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AbaEstoque from '@/components/estoque/AbaEstoque';
import AbaAnalises from '@/components/analises/AbaAnalises';

const fmtR = (v) => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

export default function NotasFiscais() {
  const [modalAberto, setModalAberto] = useState(false);
  const [produtorFiltro, setProdutorFiltro] = useState('todos');
  const [buscaProduto, setBuscaProduto] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [notaSelecionada, setNotaSelecionada] = useState(null);

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

  // Catálogos para classificar categoria dos itens pelo nome do produto
  const { data: fertilizantesCatalogo = [] } = useQuery({
    queryKey: ['fertilizantes_formulados', 'catalogo_notas'],
    queryFn: () => base44.entities.FertilizanteFormulado.list(undefined, 5000),
  });
  const { data: fontesSimplesCatalogo = [] } = useQuery({
    queryKey: ['fontes_simples', 'catalogo_notas'],
    queryFn: () => base44.entities.FonteSimples.list(undefined, 5000),
  });

  const handleImportado = () => {
    refetchNotas();
    refetchItens();
  };

  // Catálogo de produtos: FertilizanteFormulado (defensivos + fertilizantes)
  // e FonteSimples (fontes de nutrientes). Lista ordenada por nome mais longo.
  const catalogoCategorias = useMemo(
    () => montarCatalogoCategorias(fertilizantesCatalogo, fontesSimplesCatalogo),
    [fertilizantesCatalogo, fontesSimplesCatalogo]
  );

  // Filtros ativos (cada filtro é independente e opcional).
  const produtorAtivo = produtorFiltro !== 'todos';
  const periodoAtivo = !!(dataInicial || dataFinal);
  const itemFiltroAtivo = buscaProduto.trim() !== '' || categoriaFiltro !== 'todos';

  // Notas candidatas: produtor + período (data de emissão). Usada também para
  // restringir os itens ao período (via nota_fiscal_id) quando há filtro de data.
  const notasCandidatas = useMemo(() => {
    return notas.filter(n => {
      if (produtorAtivo && n.produtor_id !== produtorFiltro) return false;
      const data = n.data_emissao;
      if (dataInicial && (!data || data < dataInicial)) return false;
      if (dataFinal && (!data || data > dataFinal)) return false;
      return true;
    });
  }, [notas, produtorAtivo, produtorFiltro, dataInicial, dataFinal]);

  const notasIdsSet = useMemo(() => new Set(notasCandidatas.map(n => n.id)), [notasCandidatas]);

  // Banco de Preços / Itens: filtrados por produtor, nome, categoria e período
  // (este último via nota_fiscal_id -- única situação onde a nota é exigida).
  // Busca por nome e classificação por categoria são normalizadas
  // (sem acento/maiúscula) e respeitam limites de palavras.
  const itensFiltrados = useMemo(() => {
    const termo = normalizarNome(buscaProduto);
    return itens.filter(i => {
      if (produtorAtivo && i.produtor_id !== produtorFiltro) return false;
      if (periodoAtivo && (!i.nota_fiscal_id || !notasIdsSet.has(i.nota_fiscal_id))) return false;
      if (termo && !normalizarNome(i.produto_nome).includes(termo)) return false;
      if (categoriaFiltro !== 'todos' && classificarProduto(i.produto_nome, catalogoCategorias) !== categoriaFiltro) return false;
      return true;
    });
  }, [itens, produtorAtivo, produtorFiltro, periodoAtivo, notasIdsSet, buscaProduto, categoriaFiltro, catalogoCategorias]);

  // Notas relacionadas aos itens filtrados (item -> nota_fiscal_id).
  const idsNotasComItensFiltrados = useMemo(() => {
    const s = new Set();
    itensFiltrados.forEach(i => { if (i.nota_fiscal_id) s.add(i.nota_fiscal_id); });
    return s;
  }, [itensFiltrados]);

  // Notas exibidas (Notas Importadas): produtor + período; e, quando há filtro
  // de item (nome/categoria), somente as notas que possuem ao menos um item filtrado.
  const notasFiltradas = useMemo(() => {
    if (!itemFiltroAtivo) return notasCandidatas;
    return notasCandidatas.filter(n => idsNotasComItensFiltrados.has(n.id));
  }, [itemFiltroAtivo, notasCandidatas, idsNotasComItensFiltrados]);

  // Média ponderada pela quantidade comprada; evita distorção entre notas pequenas e grandes.
  const tabelaPrecos = useMemo(() => consolidarPrecosItens(itensFiltrados), [itensFiltrados]);

  const temFiltroAtivo = produtorAtivo || buscaProduto.trim() !== '' || categoriaFiltro !== 'todos' || periodoAtivo;

  const limparFiltros = () => {
    setProdutorFiltro('todos');
    setBuscaProduto('');
    setCategoriaFiltro('todos');
    setDataInicial('');
    setDataFinal('');
  };

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

      <Tabs defaultValue="notas" className="w-full">
        <TabsList>
          <TabsTrigger value="notas">Notas e Preços</TabsTrigger>
          <TabsTrigger value="estoque">Controle de Estoque</TabsTrigger>
          <TabsTrigger value="analises">Análises</TabsTrigger>
        </TabsList>

        <TabsContent value="notas" className="space-y-6">
      <PainelFiltrosNotas
        buscaProduto={buscaProduto}
        setBuscaProduto={setBuscaProduto}
        categoriaFiltro={categoriaFiltro}
        setCategoriaFiltro={setCategoriaFiltro}
        dataInicial={dataInicial}
        setDataInicial={setDataInicial}
        dataFinal={dataFinal}
        setDataFinal={setDataFinal}
        onLimpar={limparFiltros}
        temFiltroAtivo={temFiltroAtivo}
      />

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
                  <tr
                    key={n.id}
                    onClick={() => setNotaSelecionada(n)}
                    className={`border-b border-border/50 last:border-0 hover:bg-primary/5 cursor-pointer transition-colors ${i % 2 === 1 ? 'bg-muted/5' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-mono font-medium">{n.numero_nota || '—'}</td>
                    <td className="px-4 py-2.5">{n.fornecedor_nome || '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{produtorNome(n.produtor_id)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{n.data_emissao || '—'}</td>
                    <td className="px-4 py-2.5 tabular-nums font-semibold text-primary">
                      <span className="inline-flex items-center justify-between gap-2 w-full">
                        {fmtR(n.valor_total)}
                        <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </TabsContent>

        <TabsContent value="estoque" className="space-y-4">
          <AbaEstoque
            notas={notas}
            itens={itens}
            produtores={produtores}
            produtorFiltro={produtorFiltro}
          />
        </TabsContent>

        <TabsContent value="analises" className="space-y-4">
          <AbaAnalises
            notas={notas}
            itens={itens}
            produtores={produtores}
            fertilizantes={fertilizantesCatalogo}
            fontes={fontesSimplesCatalogo}
            catalogoCategorias={catalogoCategorias}
          />
        </TabsContent>
      </Tabs>

      <ImportarNotaFiscal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        produtores={produtores}
        onImportado={handleImportado}
      />

      <DetalhesNotaFiscal
        nota={notaSelecionada}
        itens={itens}
        produtorNome={produtorNome}
        onClose={() => setNotaSelecionada(null)}
      />
    </div>
  );
}