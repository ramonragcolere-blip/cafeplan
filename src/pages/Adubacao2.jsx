import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Upload, FileUp, Calculator, CheckCircle2, Link2, Clock, Sprout, Loader2, AlertTriangle } from 'lucide-react';
import ImportarPDFTalhao from '@/components/adubacao2/ImportarPDFTalhao';
import ImportarPDFAgrupado from '@/components/adubacao2/ImportarPDFAgrupado';
import { calcRecomendacaoRamon } from '@/lib/protocoloRamon';
import { sugerirProdutosInteligente } from '@/lib/sugerirProdutos2';

const PROTOCOLOS = [
  'Protocolo Ramon',
  '5ª Aproximação MG',
  'Boletim 100 IAC',
  'Personalizado',
];

const SAFRAS = ['2024/2025', '2025/2026', '2026/2027', '2027/2028'];

const ABAS = [
  { id: 'analises',    label: 'Análises e Importação' },
  { id: 'planejamento', label: 'Planejamento' },
  { id: 'compras',     label: 'Consolidação de Compras' },
];

// ── Status badge ─────────────────────────────────────────────────────────────
function getStatus(talhao, analises, agrupamentos) {
  const ag = agrupamentos.find(g => g.talhaoIds.includes(talhao.id));
  if (ag) return { tipo: 'agrupada', outros: ag.talhaoIds.filter(id => id !== talhao.id) };
  const temAnalise = analises.some(a => a.talhao_id === talhao.id);
  if (temAnalise) return { tipo: 'importada' };
  return { tipo: 'pendente' };
}

function StatusBadge({ status, talhoes }) {
  if (status.tipo === 'importada') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" /> Importada
      </span>
    );
  }
  if (status.tipo === 'agrupada') {
    const nomes = status.outros.map(id => talhoes.find(t => t.id === id)?.nome || id);
    return (
      <span className="flex items-center gap-1 text-xs text-blue-700 font-medium flex-wrap">
        <Link2 className="w-3.5 h-3.5 shrink-0" />
        Agrupada: {nomes.join(', ')}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="w-3.5 h-3.5" /> Pendente
    </span>
  );
}

// ── Modal importação 20-40 cm ─────────────────────────────────────────────────
const CAMPOS_2040 = [
  { key: 'ph', label: 'pH' },
  { key: 'potassio', label: 'K (mg/dm³)' },
  { key: 'calcio', label: 'Ca (cmolc/dm³)' },
  { key: 'magnesio', label: 'Mg (cmolc/dm³)' },
  { key: 'aluminio', label: 'Al (cmolc/dm³)' },
  { key: 'fosforo', label: 'P (mg/dm³)' },
  { key: 'ctc', label: 'CTC' },
  { key: 'saturacao_bases', label: 'V%' },
  { key: 'data_analise', label: 'Data da Análise', date: true },
];

function ImportarManual2040({ talhao, safra, analise2040Existente, onSalvar, onClose }) {
  const [dados, setDados] = useState(() => analise2040Existente || {});
  const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Análise 20-40 cm — {talhao.nome}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Apenas K é usado no cálculo de K solo. Os demais campos são opcionais para referência.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
          {CAMPOS_2040.map(c => (
            <div key={c.key}>
              <Label className="text-xs mb-0.5 block text-muted-foreground">{c.label}</Label>
              <Input
                type={c.date ? 'date' : 'number'}
                step={c.date ? undefined : '0.001'}
                value={dados[c.key] ?? ''}
                onChange={e => setDados(prev => ({ ...prev, [c.key]: c.date ? e.target.value : toNum(e.target.value) }))}
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => onSalvar(dados)} className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Aba Planejamento ──────────────────────────────────────────────────────────
function AbaPlanejamento2({ resultados, todos }) {
  if (!resultados || resultados.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Clique em "Calcular recomendação para todos" na aba Análises para gerar o planejamento.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/10">
            <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">Talhão</th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">Média (sc/ha)</th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">N (kg/ha)</th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">P₂O₅ (kg/ha)</th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">K₂O (kg/ha)</th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">B (kg/ha)</th>
            <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">Produto Sugerido</th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">Dose Prod. (kg/ha)</th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((r, i) => (
            <tr key={r.talhao.id} className={`border-b border-border/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/5'}`}>
              <td className="px-4 py-3 font-medium">{r.talhao.nome}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.mediaBienal != null ? r.mediaBienal.toFixed(1) : '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.rec?.N ?? '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.rec?.P ?? '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.rec?.K ?? '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.rec?.B ?? '—'}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {r.produtoSugerido ? (
                  <span className="text-foreground font-medium">{r.produtoSugerido.nome}</span>
                ) : '—'}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {r.doseProdutoHa != null ? r.doseProdutoHa : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Aba Consolidação de Compras ────────────────────────────────────────────────
function AbaCompras2({ resultados }) {
  if (!resultados || resultados.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Clique em "Calcular recomendação para todos" na aba Análises para gerar a consolidação.
      </div>
    );
  }

  // Agrupa por produto
  const mapa = {};
  resultados.forEach(r => {
    if (!r.produtoSugerido) return;
    const id = r.produtoSugerido.id;
    const area = r.talhao.area_ha || 0;
    const doseTotal = r.doseProdutoHa != null ? r.doseProdutoHa * area : 0;
    const custoTotal = r.custoProdutoTotal || 0;
    const sacas = r.mediaBienal != null ? r.mediaBienal * area : 0;

    if (!mapa[id]) {
      mapa[id] = {
        produto: r.produtoSugerido,
        talhoes: [],
        qtdTotal: 0,
        custoTotal: 0,
        areaTotal: 0,
        sacasTotal: 0,
      };
    }
    mapa[id].talhoes.push(r.talhao.nome);
    mapa[id].qtdTotal += doseTotal;
    mapa[id].custoTotal += custoTotal;
    mapa[id].areaTotal += area;
    mapa[id].sacasTotal += sacas;
  });

  const linhas = Object.values(mapa);
  if (linhas.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Nenhum produto com preço cadastrado para consolidar. Informe preços nos produtos.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/10">
            <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">Produto</th>
            <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">Talhões que usam</th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">Qtd total (kg)</th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">Custo total (R$)</th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">Custo/ha</th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">Custo/saca</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => {
            const custoHa = l.areaTotal > 0 ? l.custoTotal / l.areaTotal : null;
            const custoSaca = l.sacasTotal > 0 ? l.custoTotal / l.sacasTotal : null;
            return (
              <tr key={l.produto.id} className={`border-b border-border/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/5'}`}>
                <td className="px-4 py-3 font-medium">{l.produto.nome}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{l.talhoes.join(', ')}</td>
                <td className="px-4 py-3 text-right tabular-nums">{l.qtdTotal > 0 ? Math.round(l.qtdTotal).toLocaleString('pt-BR') : '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {l.custoTotal > 0 ? l.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {custoHa != null && l.custoTotal > 0 ? custoHa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {custoSaca != null && l.custoTotal > 0 ? custoSaca.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Adubacao2() {
  const queryClient = useQueryClient();
  const [produtorId, setProdutorId] = useState('');
  const [safra, setSafra] = useState('2025/2026');
  const [protocolo, setProtocolo] = useState(PROTOCOLOS[0]);
  const [selecionados, setSelecionados] = useState([]);
  const [agrupamentos, setAgrupamentos] = useState([]);
  const [modalAgrupado, setModalAgrupado] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('analises');
  const [produtividade, setProdutividade] = useState({});
  // { [talhaoId]: dados } para análise 20-40cm (local por enquanto)
  const [analises2040Local, setAnalises2040Local] = useState({});
  const [modal2040, setModal2040] = useState(null); // talhao ou null
  // Resultados do cálculo para as abas Planejamento e Compras
  const [resultadosCalculo, setResultadosCalculo] = useState(null);
  const [calculando, setCalculando] = useState(false);

  // Queries
  const { data: produtores = [] } = useQuery({ queryKey: ['produtores'], queryFn: () => base44.entities.Produtor.list() });
  const { data: todosTalhoes = [] } = useQuery({ queryKey: ['talhoes'], queryFn: () => base44.entities.Talhao.list() });
  const { data: todasAnalises = [] } = useQuery({ queryKey: ['analises_solo'], queryFn: () => base44.entities.AnaliseSolo.list() });
  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples = [] } = useQuery({ queryKey: ['fontes_simples'], queryFn: () => base44.entities.FonteSimples.list() });

  const produtor = produtores.find(p => p.id === produtorId) || null;

  const talhoes = useMemo(() =>
    todosTalhoes.filter(t => t.codigo_produtor === produtor?.codigo),
    [todosTalhoes, produtor]
  );

  const analises = useMemo(() =>
    todasAnalises.filter(a => a.safra === safra && talhoes.some(t => t.id === a.talhao_id)),
    [todasAnalises, safra, talhoes]
  );

  const todos = useMemo(() => [
    ...fertilizantes.map(f => ({ ...f, _tipo: 'formulado' })),
    ...fontesSimples.map(f => ({ ...f, _tipo: 'fonte' })),
  ], [fertilizantes, fontesSimples]);

  // Mutations para análise de solo
  const createAnalise = useMutation({
    mutationFn: d => base44.entities.AnaliseSolo.create(d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['analises_solo'] }),
  });
  const updateAnalise = useMutation({
    mutationFn: ({ id, d }) => base44.entities.AnaliseSolo.update(id, d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['analises_solo'] }),
  });

  const handleImportarAnalise = async (talhao, dados) => {
    const existente = analises.find(a => a.talhao_id === talhao.id && a.safra === safra);
    const payload = {
      codigo_produtor: produtor.codigo,
      talhao_id: talhao.id,
      talhao_nome: talhao.nome,
      safra,
      ...dados,
    };
    if (existente) {
      await updateAnalise.mutateAsync({ id: existente.id, d: payload });
    } else {
      await createAnalise.mutateAsync(payload);
    }
  };

  const handleImportarAgrupado = async (dados, talhao) => {
    await handleImportarAnalise(talhao, dados);
  };

  const handleFecharModalAgrupado = () => {
    setAgrupamentos(prev => {
      const filtered = prev.filter(g => !g.talhaoIds.some(id => selecionados.includes(id)));
      return selecionados.length > 1 ? [...filtered, { talhaoIds: [...selecionados] }] : filtered;
    });
    setSelecionados([]);
    setModalAgrupado(false);
  };

  const toggleSelecao = (id) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleTodos = () => {
    setSelecionados(prev => prev.length === talhoes.length ? [] : talhoes.map(t => t.id));
  };

  const setProd = useCallback((talhaoId, campo, valor) => {
    setProdutividade(prev => ({
      ...prev,
      [talhaoId]: { ...(prev[talhaoId] || {}), [campo]: valor },
    }));
  }, []);

  // Análise 20-40: salva local
  const handleSalvar2040 = (talhao, dados) => {
    setAnalises2040Local(prev => ({ ...prev, [talhao.id]: dados }));
    setModal2040(null);
  };

  // Cálculo central — Protocolo Ramon
  const handleCalcularTodos = useCallback(() => {
    setCalculando(true);
    setTimeout(() => {
      const resultados = talhoes.map(talhao => {
        const s1 = parseFloat(produtividade[talhao.id]?.safra1);
        const s2 = parseFloat(produtividade[talhao.id]?.safra2);

        let mediaBienal = null;
        if (!isNaN(s1) && !isNaN(s2)) mediaBienal = (s1 + s2) / 2;
        else if (!isNaN(s1)) mediaBienal = s1;
        else if (!isNaN(s2)) mediaBienal = s2;

        const analise = analises.find(a => a.talhao_id === talhao.id) || null;
        const analise2040 = analises2040Local[talhao.id] || null;

        const rec = mediaBienal != null && analise
          ? calcRecomendacaoRamon(mediaBienal, analise, analise2040)
          : null;

        // Sugestão de produto principal (N é o mais importante)
        let produtoSugerido = null;
        let doseProdutoHa = null;
        let custoProdutoTotal = null;

        if (rec && todos.length > 0) {
          // Tenta encontrar produto com N (principal para cálculo de custo)
          const recParaSugestao = { N: rec.N, P: rec.P, K: rec.K, B: rec.B };
          const sugestoes = sugerirProdutosInteligente(todos, recParaSugestao);
          const sugN = sugestoes['n_pct'];
          if (sugN?.produtoId) {
            const prod = todos.find(p => p.id === sugN.produtoId);
            if (prod) {
              produtoSugerido = prod;
              const pctN = parseFloat(prod.n_pct) || 0;
              if (pctN > 0 && rec.N != null) {
                doseProdutoHa = Math.round((rec.N / (pctN / 100)) * 10) / 10;
                const area = talhao.area_ha || 0;
                // preço: tenta pegar do produto (sem preço cadastrado aqui, deixa null)
                custoProdutoTotal = null;
              }
            }
          }
        }

        return { talhao, mediaBienal, analise, analise2040, rec, produtoSugerido, doseProdutoHa, custoProdutoTotal };
      });

      setResultadosCalculo(resultados);
      setCalculando(false);
      setAbaAtiva('planejamento');
    }, 100);
  }, [talhoes, produtividade, analises, analises2040Local, todos]);

  const podeCacularTodos = analises.length > 0 || talhoes.some(t =>
    !isNaN(parseFloat(produtividade[t.id]?.safra1)) || !isNaN(parseFloat(produtividade[t.id]?.safra2))
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Adubação 2.0</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestão integrada de análises de solo e recomendação nutricional</p>
      </div>

      {/* Cabeçalho de seleção */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs mb-1 block">Produtor</Label>
            <Select value={produtorId || 'none'} onValueChange={v => { setProdutorId(v === 'none' ? '' : v); setSelecionados([]); setAgrupamentos([]); setResultadosCalculo(null); }}>
              <SelectTrigger><SelectValue placeholder="Selecione o produtor…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione…</SelectItem>
                {produtores.map(p => <SelectItem key={p.id} value={p.id}>{p.nome} — {p.fazenda}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Safra</Label>
            <Select value={safra} onValueChange={setSafra}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SAFRAS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Protocolo de adubação</Label>
            <Select value={protocolo} onValueChange={setProtocolo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROTOCOLOS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {protocolo && (
          <p className="mt-3 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            Protocolo selecionado: <strong>{protocolo}</strong> — válido para toda a fazenda
          </p>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-0 border-b border-border">
        {ABAS.map(aba => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              abaAtiva === aba.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {aba.label}
            {aba.id !== 'analises' && resultadosCalculo && (
              <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                {resultadosCalculo.filter(r => r.rec).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Aba: Análises e Importação ── */}
      {abaAtiva === 'analises' && !produtor && (
        <div className="text-center py-16 text-muted-foreground">
          <Sprout className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>Selecione um produtor para visualizar os talhões.</p>
        </div>
      )}

      {abaAtiva === 'analises' && produtor && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Barra de ações */}
          <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-border bg-muted/20">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={selecionados.length === 0}
              onClick={() => setModalAgrupado(true)}
            >
              <Upload className="w-3.5 h-3.5" />
              Importar análise para selecionados ({selecionados.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => { setSelecionados(talhoes.map(t => t.id)); setModalAgrupado(true); }}
            >
              <FileUp className="w-3.5 h-3.5" />
              Importar todas de uma vez
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`gap-1.5 text-xs ml-auto ${protocolo !== 'Protocolo Ramon' ? 'opacity-50' : ''}`}
              disabled={!podeCacularTodos || calculando}
              onClick={handleCalcularTodos}
            >
              {calculando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
              Calcular recomendação para todos
            </Button>
          </div>

          {protocolo !== 'Protocolo Ramon' && (
            <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-b border-amber-100 text-amber-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              O cálculo automático está disponível apenas para o Protocolo Ramon. Selecione-o acima.
            </div>
          )}

          {/* Tabela */}
          {talhoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum talhão cadastrado para este produtor.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    <th className="px-3 py-3 text-left w-10">
                      <Checkbox
                        checked={selecionados.length === talhoes.length && talhoes.length > 0}
                        onCheckedChange={toggleTodos}
                      />
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">Talhão</th>
                    <th className="px-3 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">Área (ha)</th>
                    <th className="px-3 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">Nº plantas</th>
                    <th className="px-3 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">Safra 1 (sc/ha)</th>
                    <th className="px-3 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">Safra 2 (sc/ha)</th>
                    <th className="px-3 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">Média biênio</th>
                    <th className="px-3 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">Análise Solo (0-20)</th>
                    <th className="px-3 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">Análise 20-40 cm</th>
                    <th className="px-3 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {talhoes.map((talhao, i) => {
                    const status = getStatus(talhao, analises, agrupamentos);
                    const sel = selecionados.includes(talhao.id);
                    const s1 = parseFloat(produtividade[talhao.id]?.safra1);
                    const s2 = parseFloat(produtividade[talhao.id]?.safra2);
                    let media = null;
                    if (!isNaN(s1) && !isNaN(s2)) media = (s1 + s2) / 2;
                    else if (!isNaN(s1)) media = s1;
                    else if (!isNaN(s2)) media = s2;

                    const tem2040 = !!analises2040Local[talhao.id];

                    return (
                      <tr
                        key={talhao.id}
                        className={`border-b border-border/50 last:border-0 transition-colors ${sel ? 'bg-primary/5' : i % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'}`}
                      >
                        <td className="px-3 py-3">
                          <Checkbox checked={sel} onCheckedChange={() => toggleSelecao(talhao.id)} />
                        </td>
                        <td className="px-3 py-3 font-medium">{talhao.nome}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{talhao.area_ha ?? '—'}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{talhao.num_plantas?.toLocaleString() ?? '—'}</td>
                        <td className="px-3 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={produtividade[talhao.id]?.safra1 ?? ''}
                            onChange={e => setProd(talhao.id, 'safra1', e.target.value)}
                            className="w-20 h-7 text-xs text-right border border-input rounded px-2 bg-background tabular-nums"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={produtividade[talhao.id]?.safra2 ?? ''}
                            onChange={e => setProd(talhao.id, 'safra2', e.target.value)}
                            className="w-20 h-7 text-xs text-right border border-input rounded px-2 bg-background tabular-nums"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold text-sm">
                          {media != null ? media.toFixed(1) : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <ImportarPDFTalhao
                            talhao={talhao}
                            safra={safra}
                            analises={analises}
                            analises2040={[]}
                            onImportarAnalise={handleImportarAnalise}
                            onImportarAnalise2040={() => {}}
                            talhoes={talhoes}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => setModal2040(talhao)}
                            className={`flex items-center gap-1 text-xs rounded px-2 py-1 border transition-colors ${
                              tem2040
                                ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                                : 'border-dashed border-muted-foreground/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {tem2040 ? <CheckCircle2 className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
                            {tem2040 ? 'Importada' : 'Opcional'}
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={status} talhoes={talhoes} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Aba: Planejamento ── */}
      {abaAtiva === 'planejamento' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
            <p className="text-xs text-muted-foreground italic">
              {resultadosCalculo ? `${resultadosCalculo.filter(r => r.rec).length} talhão(ões) com recomendação calculada` : 'Execute o cálculo na aba Análises'}
            </p>
            {produtor && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={!podeCacularTodos || calculando} onClick={handleCalcularTodos}>
                {calculando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
                Recalcular
              </Button>
            )}
          </div>
          <AbaPlanejamento2 resultados={resultadosCalculo} todos={todos} />
        </div>
      )}

      {/* ── Aba: Consolidação de Compras ── */}
      {abaAtiva === 'compras' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
            <p className="text-xs text-muted-foreground italic">
              {resultadosCalculo ? 'Consolidação por produto' : 'Execute o cálculo na aba Análises'}
            </p>
            {produtor && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={!podeCacularTodos || calculando} onClick={handleCalcularTodos}>
                {calculando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
                Recalcular
              </Button>
            )}
          </div>
          <AbaCompras2 resultados={resultadosCalculo} />
        </div>
      )}

      {/* Modal importação agrupada */}
      {modalAgrupado && (
        <ImportarPDFAgrupado
          talhoes={talhoes.filter(t => selecionados.includes(t.id))}
          safra={safra}
          analises={analises}
          analises2040={[]}
          onImportarAnalise={handleImportarAgrupado}
          onClose={handleFecharModalAgrupado}
        />
      )}

      {/* Modal análise 20-40 cm */}
      {modal2040 && (
        <ImportarManual2040
          talhao={modal2040}
          safra={safra}
          analise2040Existente={analises2040Local[modal2040.id] || null}
          onSalvar={(dados) => handleSalvar2040(modal2040, dados)}
          onClose={() => setModal2040(null)}
        />
      )}
    </div>
  );
}