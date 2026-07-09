import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { FileText, Plus, TrendingUp, Package, FlaskConical } from 'lucide-react';
import ImportarNotaFiscal from '@/components/notas/ImportarNotaFiscal';
import { useToast } from '@/components/ui/use-toast';

const fmtR = (v) => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const fmtN = (v, d = 2) => v != null ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

export default function NotasFiscais() {
  const [modalAberto, setModalAberto] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: produtores = [] } = useQuery({
    queryKey: ['produtores'],
    queryFn: () => base44.entities.Produtor.list(),
  });

  const { data: notas = [], refetch: refetchNotas } = useQuery({
    queryKey: ['notas_fiscais'],
    queryFn: () => base44.entities.BaseNotasFiscais.list('-data_emissao', 100),
  });

  const { data: itens = [], refetch: refetchItens } = useQuery({
    queryKey: ['itens_notas'],
    queryFn: () => base44.entities.BaseItensNotaFiscal.list('-created_date', 1000),
  });

  const { data: fertilizantes = [] } = useQuery({
    queryKey: ['fertilizantes'],
    queryFn: () => base44.entities.FertilizanteFormulado.list(),
  });

  const handleImportado = () => {
    refetchNotas();
    refetchItens();
  };

  const handleSimularNotas = async () => {
    if (produtores.length === 0) {
      toast({ title: 'Nenhum produtor cadastrado', description: 'Cadastre um produtor primeiro.', variant: 'destructive' });
      return;
    }
    setSimulando(true);
    const produtor = produtores[0];
    // Tenta vincular a produtos reais da base de fertilizantes
    const prodUreia = fertilizantes.find(f => /ureia/i.test(f.nome)) || null;
    const prodKCl = fertilizantes.find(f => /kcl|cloreto.*pot/i.test(f.nome)) || null;
    const prodMAP = fertilizantes.find(f => /map|monoamônio|fosfato.*amôn/i.test(f.nome)) || null;

    const nota = await base44.entities.BaseNotasFiscais.create({
      produtor_id: produtor.id,
      numero_nota: `TESTE-${Date.now()}`,
      fornecedor_nome: 'Fornecedor Simulado (Teste)',
      data_emissao: new Date().toISOString().split('T')[0],
      valor_total: 13200,
    });

    const itensTeste = [
      { produto_nome: 'Ureia', quantidade: 20, unidade_medida: 'SC', preco_unitario: 130, produto_id_sugerido: prodUreia?.id || null },
      { produto_nome: 'KCl', quantidade: 20, unidade_medida: 'SC', preco_unitario: 150, produto_id_sugerido: prodKCl?.id || null },
      { produto_nome: 'MAP', quantidade: 10, unidade_medida: 'SC', preco_unitario: 320, produto_id_sugerido: prodMAP?.id || null },
    ];

    await base44.entities.BaseItensNotaFiscal.bulkCreate(
      itensTeste.map(it => ({
        nota_fiscal_id: nota.id,
        produtor_id: produtor.id,
        produto_nome: it.produto_nome,
        quantidade: it.quantidade,
        unidade_medida: it.unidade_medida,
        preco_unitario: it.preco_unitario,
        preco_total: it.preco_unitario * it.quantidade,
        produto_id_sugerido: it.produto_id_sugerido,
      }))
    );

    queryClient.invalidateQueries({ queryKey: ['notas_fiscais'] });
    queryClient.invalidateQueries({ queryKey: ['itens_notas'] });
    queryClient.invalidateQueries({ queryKey: ['itens_nota_fiscal_produtor', produtor.id] });
    setSimulando(false);
    toast({
      title: 'Notas de teste criadas!',
      description: `Produtor: ${produtor.nome || produtor.codigo}. Ureia R$130/SC · KCl R$150/SC · MAP R$320/SC.`,
    });
  };

  // Agrupa itens por produto_nome + unidade_medida
  const tabelaPrecos = useMemo(() => {
    const mapa = {};
    itens.forEach(it => {
      const chave = `${(it.produto_nome || '').toLowerCase().trim()}||${(it.unidade_medida || '').toUpperCase()}`;
      if (!mapa[chave]) {
        mapa[chave] = {
          produto_nome: it.produto_nome,
          unidade_medida: (it.unidade_medida || '').toUpperCase(),
          precos: [],
          nota_ids: new Set(),
        };
      }
      if (it.preco_unitario > 0) mapa[chave].precos.push(it.preco_unitario);
      if (it.nota_fiscal_id) mapa[chave].nota_ids.add(it.nota_fiscal_id);
    });

    return Object.values(mapa)
      .map(g => ({
        produto_nome: g.produto_nome,
        unidade_medida: g.unidade_medida,
        menor_preco: g.precos.length > 0 ? Math.min(...g.precos) : null,
        maior_preco: g.precos.length > 0 ? Math.max(...g.precos) : null,
        preco_medio: g.precos.length > 0 ? g.precos.reduce((a, b) => a + b, 0) / g.precos.length : null,
        num_notas: g.nota_ids.size,
      }))
      .sort((a, b) => (a.produto_nome || '').localeCompare(b.produto_nome || ''));
  }, [itens]);

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
          <Button variant="outline" onClick={handleSimularNotas} disabled={simulando} className="gap-2 text-muted-foreground">
            <FlaskConical className="w-4 h-4" /> {simulando ? 'Criando…' : 'Simular Notas de Teste'}
          </Button>
          <Button onClick={() => setModalAberto(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Importar XML/PDF de Nota Fiscal
          </Button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total de Notas</p>
          <p className="text-2xl font-bold text-foreground">{notas.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total de Itens</p>
          <p className="text-2xl font-bold text-foreground">{itens.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Produtos Únicos</p>
          <p className="text-2xl font-bold text-foreground">{tabelaPrecos.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Valor Total (notas)</p>
          <p className="text-lg font-bold text-primary">{fmtR(notas.reduce((s, n) => s + (n.valor_total || 0), 0))}</p>
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
          <span className="text-xs text-muted-foreground ml-1">({notas.length})</span>
        </div>
        {notas.length === 0 ? (
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
                {notas.map((n, i) => (
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