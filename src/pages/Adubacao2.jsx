import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Upload, FileUp, Calculator, CheckCircle2, Link2, Clock, Sprout, Loader2, AlertTriangle, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ImportarPDFTalhao from '@/components/adubacao2/ImportarPDFTalhao';
import ImportarAgrupado020 from '@/components/adubacao2/ImportarAgrupado020';
import ImportarAgrupado2040 from '@/components/adubacao2/ImportarAgrupado2040';
import ModalDetalheTalhao from '@/components/adubacao2/ModalDetalheTalhao';
import AbaPlanejamento2 from '@/components/adubacao2/AbaPlanejamento2';
import AbaCalagem2 from '@/components/adubacao2/AbaCalagem2';
import AbaResumoGeral2 from '@/components/adubacao2/AbaResumoGeral2';
import { calcRecomendacaoRamon } from '@/lib/protocoloRamon';
import { sugerirProdutosInteligente } from '@/lib/sugerirProdutos2';


const PROTOCOLOS = ['Protocolo Ramon', '5ª Aproximação MG', 'Boletim 100 IAC', 'Personalizado'];
const SAFRAS = ['2024/2025', '2025/2026', '2026/2027', '2027/2028'];
const ABAS = [
  { id: 'analises',     label: 'Análises e Importação' },
  { id: 'calagem',      label: 'Calagem' },
  { id: 'planejamento', label: 'Planejamento' },
  { id: 'compras',      label: 'Consolidação de Compras' },
  { id: 'resumo',       label: 'Resumo Geral' },
];

// ── Status badge ─────────────────────────────────────────────────────────────
// PROBLEMA 4: "agrupada" só quando o usuário agrupou explicitamente.
function getStatus(talhao, analises, agrupamentosExplicitos) {
  const ag = agrupamentosExplicitos.find(g => g.talhaoIds.includes(talhao.id));
  if (ag) return { tipo: 'agrupada', outros: ag.talhaoIds.filter(id => id !== talhao.id) };
  const temAnalise = analises.some(a => a.talhao_id === talhao.id);
  if (temAnalise) return { tipo: 'importada' };
  return { tipo: 'pendente' };
}

function StatusBadge({ status, talhoes }) {
  if (status.tipo === 'importada') return (
    <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
      <CheckCircle2 className="w-3.5 h-3.5" /> Importada
    </span>
  );
  if (status.tipo === 'agrupada') {
    const nomes = status.outros.map(id => talhoes.find(t => t.id === id)?.nome || id);
    return (
      <span className="flex items-center gap-1 text-xs text-blue-700 font-medium flex-wrap">
        <Link2 className="w-3.5 h-3.5 shrink-0" /> Agrupada: {nomes.join(', ')}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="w-3.5 h-3.5" /> Pendente
    </span>
  );
}

// ── Modal análise 20-40 cm ────────────────────────────────────────────────────
const CAMPOS_2040 = [
  { key: 'ph',             label: 'pH' },
  { key: 'potassio',       label: 'K (mg/dm³)' },
  { key: 'calcio',         label: 'Ca (cmolc/dm³)' },
  { key: 'magnesio',       label: 'Mg (cmolc/dm³)' },
  { key: 'aluminio',       label: 'Al (cmolc/dm³)' },
  { key: 'fosforo',        label: 'P (mg/dm³)' },
  { key: 'ctc',            label: 'CTC' },
  { key: 'saturacao_bases',label: 'V%' },
  { key: 'data_analise',   label: 'Data da Análise', date: true },
];

function ImportarManual2040({ talhao, analise2040Existente, onSalvar, onClose }) {
  const [dados, setDados] = useState(() => analise2040Existente || {});
  const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;
  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Análise 20-40 cm — {talhao.nome}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">K é usado no cálculo. Os demais campos são opcionais.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
          {CAMPOS_2040.map(c => (
            <div key={c.key}>
              <Label className="text-xs mb-0.5 block text-muted-foreground">{c.label}</Label>
              <Input type={c.date ? 'date' : 'number'} step={c.date ? undefined : '0.001'}
                value={dados[c.key] ?? ''}
                onChange={e => setDados(prev => ({ ...prev, [c.key]: c.date ? e.target.value : toNum(e.target.value) }))}
                className="h-7 text-xs" />
            </div>
          ))}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => onSalvar(dados)} className="gap-2">
            <CheckCircle2 className="w-4 h-4" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Aba Consolidação de Compras ────────────────────────────────────────────────
function AbaCompras2({ resultados, dosesEditadas, produtosEfetivos = {} }) {
  if (!resultados || resultados.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Clique em "Calcular recomendação para todos" na aba Análises para gerar a consolidação.
      </div>
    );
  }

  // Agrega por produto (principal + complementares)
  const mapa = {};
  resultados.forEach(r => {
    const efetivo = produtosEfetivos[r.talhao.id];
    const area = r.talhao.area_ha || 0;
    const sacas = r.mediaBienal != null ? r.mediaBienal * area : 0;

    // Produto principal
    const produto = efetivo?.produto || r.produtoSugerido;
    const dose = efetivo?.doseKgHa ?? r.doseProdutoHa;
    if (produto) {
      const id = produto.id;
      const doseTotal = dose != null ? dose * area : 0;
      if (!mapa[id]) mapa[id] = { produto, talhoes: [], qtdTotal: 0, areaTotal: 0, sacasTotal: 0 };
      mapa[id].talhoes.push(r.talhao.nome);
      mapa[id].qtdTotal += doseTotal;
      mapa[id].areaTotal += area;
      mapa[id].sacasTotal += sacas;
    }

    // Complementares salvos
    const complementos = efetivo?.complementos || [];
    for (const comp of complementos) {
      if (!comp.produto?.id || !comp.doseKgHa) continue;
      const id = comp.produto.id;
      const doseTotal = comp.doseKgHa * area;
      if (!mapa[id]) mapa[id] = { produto: comp.produto, talhoes: [], qtdTotal: 0, areaTotal: 0, sacasTotal: 0 };
      if (!mapa[id].talhoes.includes(r.talhao.nome)) mapa[id].talhoes.push(r.talhao.nome);
      mapa[id].qtdTotal += doseTotal;
      mapa[id].areaTotal += area;
    }
  });

  const linhas = Object.values(mapa);
  if (linhas.length === 0) return (
    <div className="text-center py-12 text-muted-foreground text-sm">
      Nenhum produto sugerido para consolidar.
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/10">
            <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">Produto</th>
            <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">Talhões</th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">Qtd total (kg)</th>
            <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">Área total (ha)</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={l.produto.id} className={`border-b border-border/50 last:border-0 ${i%2===0?'':'bg-muted/5'}`}>
              <td className="px-4 py-3 font-medium">{l.produto.nome}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{l.talhoes.join(', ')}</td>
              <td className="px-4 py-3 text-right tabular-nums">{l.qtdTotal > 0 ? Math.round(l.qtdTotal).toLocaleString('pt-BR') : '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums">{l.areaTotal > 0 ? l.areaTotal.toFixed(1) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Adubacao2() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [produtorId, setProdutorId] = useState('');
  const [safra, setSafra] = useState('2025/2026');
  const [protocolo, setProtocolo] = useState(PROTOCOLOS[0]);
  const [selecionados, setSelecionados] = useState([]);
  // PROBLEMA 4: agrupamentos só quando explícito
  const [agrupamentosExplicitos, setAgrupamentosExplicitos] = useState([]);
  const [modalAgrupado020, setModalAgrupado020] = useState(false);
  const [modalAgrupado2040, setModalAgrupado2040] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('analises');
  const [resultadosCalculo, setResultadosCalculo] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [modal2040, setModal2040] = useState(null);
  // PROBLEMA 2: doses editadas na tabela
  const [dosesEditadas, setDosesEditadas] = useState({});
  // PROBLEMA 3: modal detalhe
  const [modalDetalhe, setModalDetalhe] = useState(null); // resultado do talhão
  // mensagem de sucesso do cálculo
  const [msgCalculo, setMsgCalculo] = useState('');

  // Queries
  const { data: produtores = [] } = useQuery({ queryKey: ['produtores'], queryFn: () => base44.entities.Produtor.list() });
  const { data: todosTalhoes = [] } = useQuery({ queryKey: ['talhoes'], queryFn: () => base44.entities.Talhao.list() });
  const { data: todasAnalises = [] } = useQuery({ queryKey: ['analises_solo'], queryFn: () => base44.entities.AnaliseSolo.list() });
  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples = [] } = useQuery({ queryKey: ['fontes_simples'], queryFn: () => base44.entities.FonteSimples.list() });
  // PROBLEMA 1: dados persistidos
  const { data: planejamentosDb = [] } = useQuery({
    queryKey: ['planejamento_adubacao2'],
    queryFn: () => base44.entities.PlanejamentoAdubacao2.list(),
  });

  const produtor = produtores.find(p => p.id === produtorId) || null;
  const talhoes = useMemo(() => todosTalhoes.filter(t => t.codigo_produtor === produtor?.codigo), [todosTalhoes, produtor]);
  const analises = useMemo(() => todasAnalises.filter(a => a.safra === safra && talhoes.some(t => t.id === a.talhao_id)), [todasAnalises, safra, talhoes]);
  const GRUPOS_DEFENSIVO = /herbicida|inseticida|fungicida|acaricida|nematicida|adjuvante|bactericida|glifosato|glufosinato|mancozebe|limpador|detector/i;

  const todos = useMemo(() => [
    ...fertilizantes
      .filter(f => !f.grupo || !GRUPOS_DEFENSIVO.test(f.grupo))
      .map(f => ({ ...f, _tipo: 'formulado' })),
    ...fontesSimples.map(f => ({ ...f, _tipo: 'fonte' })),
  ], [fertilizantes, fontesSimples]);

  // Query de calagem
  const { data: calagensDb = [] } = useQuery({
    queryKey: ['calagem_recomendacoes'],
    queryFn: () => base44.entities.BaseRecomendacaoCalagem.list(),
  });

  // Query itens de notas fiscais do produtor (para pré-preencher preços)
  const { data: itensNotas = [] } = useQuery({
    queryKey: ['itens_nota_fiscal_produtor', produtorId],
    queryFn: () => base44.entities.BaseItensNotaFiscal.filter({ produtor_id: produtorId }),
    enabled: !!produtorId,
  });

  // Mapa de preço médio por produto_id_sugerido vindo das notas fiscais
  const precosNotasMap = useMemo(() => {
    const mapa = {}; // { [produto_id]: { soma: number, count: number } }
    itensNotas.forEach(item => {
      if (!item.produto_id_sugerido || item.preco_unitario == null) return;
      const preco = parseFloat(item.preco_unitario);
      if (isNaN(preco) || preco <= 0) return;
      // Converte SC (saco 60kg) para R$/kg; KG/L usa direto
      const un = (item.unidade_medida || '').toUpperCase().trim();
      let precoKg = preco;
      if (un === 'SC' || un === 'SAC' || un === 'SACO') precoKg = preco / 60;
      if (!mapa[item.produto_id_sugerido]) mapa[item.produto_id_sugerido] = { soma: 0, count: 0 };
      mapa[item.produto_id_sugerido].soma += precoKg;
      mapa[item.produto_id_sugerido].count += 1;
    });
    const resultado = {};
    Object.entries(mapa).forEach(([id, { soma, count }]) => {
      resultado[id] = Math.round((soma / count) * 100) / 100;
    });
    return resultado;
  }, [itensNotas]);

  // Registros de calagem para produtor+safra
  const calagensProdutor = useMemo(() =>
    calagensDb.filter(c => c.codigo_produtor === produtor?.codigo && c.safra === safra),
    [calagensDb, produtor, safra]
  );

  // Registros salvos para produtor+safra
  const registrosSalvos = useMemo(() =>
    planejamentosDb.filter(r => r.codigo_produtor === produtor?.codigo && r.safra === safra),
    [planejamentosDb, produtor, safra]
  );

  // Mutations de PlanejamentoAdubacao2
  const createPlan = useMutation({ mutationFn: d => base44.entities.PlanejamentoAdubacao2.create(d), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planejamento_adubacao2'] }) });
  const updatePlan = useMutation({ mutationFn: ({ id, d }) => base44.entities.PlanejamentoAdubacao2.update(id, d), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planejamento_adubacao2'] }) });

  // Mutations análise de solo
  const createAnalise = useMutation({ mutationFn: d => base44.entities.AnaliseSolo.create(d), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['analises_solo'] }) });
  const updateAnalise = useMutation({ mutationFn: ({ id, d }) => base44.entities.AnaliseSolo.update(id, d), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['analises_solo'] }) });

  // PROBLEMA 1: produtividade lida do banco
  // { [talhaoId]: { safra1, safra2 } }
  const produtividade = useMemo(() => {
    const map = {};
    registrosSalvos.forEach(r => {
      map[r.talhao_id] = { safra1: r.safra1_sc_ha != null ? String(r.safra1_sc_ha) : '', safra2: r.safra2_sc_ha != null ? String(r.safra2_sc_ha) : '' };
    });
    return map;
  }, [registrosSalvos]);

  // Análises 20-40 lidas do banco
  const analises2040 = useMemo(() => {
    const map = {};
    registrosSalvos.forEach(r => { if (r.analise2040) map[r.talhao_id] = r.analise2040; });
    return map;
  }, [registrosSalvos]);

  // Estado local para edição (antes de salvar)
  const [produtividadeLocal, setProdutividadeLocal] = useState({});
  const [analises2040Local, setAnalises2040Local] = useState({});

  // Ref para garantir que a restauração completa roda apenas uma vez por produtor+safra
  const restauradoRef = useRef('');

  // Sincroniza estado local quando dados do banco chegam
  useEffect(() => {
    if (registrosSalvos.length === 0 || talhoes.length === 0) return;

    const chave = `${produtor?.id}|${safra}`;
    const jáRestaurou = restauradoRef.current === chave;

    const prodMap = {};
    const a2040Map = {};
    let precosAgg = {};
    let parcelamentosAgg = {};

    registrosSalvos.forEach(r => {
      prodMap[r.talhao_id] = {
        safra1: r.safra1_sc_ha != null ? String(r.safra1_sc_ha) : '',
        safra2: r.safra2_sc_ha != null ? String(r.safra2_sc_ha) : '',
      };
      if (r.analise2040) a2040Map[r.talhao_id] = r.analise2040;
      if (r.detalhamento?.precos) precosAgg = { ...precosAgg, ...r.detalhamento.precos };
      if (r.detalhamento?.parcelamentos && Object.keys(r.detalhamento.parcelamentos).length > 0) {
        parcelamentosAgg[r.talhao_id] = r.detalhamento.parcelamentos;
      }
    });

    setAnalises2040Local(prev => {
      const merged = { ...prev };
      Object.entries(a2040Map).forEach(([k, v]) => { if (!(k in merged)) merged[k] = v; });
      return merged;
    });

    if (!jáRestaurou) {
      // Primeira restauração: sobrescreve produtividade somente se o usuário não digitou nada ainda
      setProdutividadeLocal(prev => {
        const merged = { ...prev };
        Object.entries(prodMap).forEach(([k, v]) => { if (!(k in merged)) merged[k] = v; });
        return merged;
      });

      if (Object.keys(precosAgg).length > 0) {
        setPrecosExterno(precosAgg);
        precosRef.current = precosAgg;
      }
      if (Object.keys(parcelamentosAgg).length > 0) {
        setParcelamentosExterno(parcelamentosAgg);
        parcelamentosRef.current = parcelamentosAgg;
      }

      // Reconstrói resultadosCalculo a partir dos dados salvos
      const resultadosRestaurados = talhoes.map(talhao => {
        const registro = registrosSalvos.find(r => r.talhao_id === talhao.id);
        if (!registro?.detalhamento?.rec) {
          const locProd = prodMap[talhao.id] || {};
          const s1 = parseFloat(locProd.safra1);
          const s2 = parseFloat(locProd.safra2);
          let mediaBienal = null;
          if (!isNaN(s1) && !isNaN(s2)) mediaBienal = (s1 + s2) / 2;
          else if (!isNaN(s1)) mediaBienal = s1;
          else if (!isNaN(s2)) mediaBienal = s2;
          const analise = todasAnalises.find(a => a.talhao_id === talhao.id && a.safra === safra) || null;
          return { talhao, mediaBienal, analise, analise2040: a2040Map[talhao.id] || null, rec: null, produtoSugerido: null, doseProdutoHa: null, temRegistroSalvo: !!registro };
        }
        const det = registro.detalhamento;
        const locProd = prodMap[talhao.id] || {};
        const s1 = parseFloat(locProd.safra1);
        const s2 = parseFloat(locProd.safra2);
        let mediaBienal = det.mediaBienal ?? null;
        if (mediaBienal == null) {
          if (!isNaN(s1) && !isNaN(s2)) mediaBienal = (s1 + s2) / 2;
          else if (!isNaN(s1)) mediaBienal = s1;
          else if (!isNaN(s2)) mediaBienal = s2;
        }
        let produtoSugerido = det.produtoSugerido ? { ...det.produtoSugerido } : null;
        if (produtoSugerido && todos.length > 0) {
          const prodCatalogo = todos.find(p => p.id === produtoSugerido.id);
          if (prodCatalogo) produtoSugerido = prodCatalogo;
        }
        const analise = todasAnalises.find(a => a.talhao_id === talhao.id && a.safra === safra) || null;
        return {
          talhao,
          mediaBienal,
          analise,
          analise2040: a2040Map[talhao.id] || null,
          rec: det.rec || null,
          produtoSugerido,
          doseProdutoHa: det.doseProdutoHa ?? null,
          temRegistroSalvo: true,
        };
      });

      if (resultadosRestaurados.some(r => r.rec != null)) {
        setResultadosCalculo(resultadosRestaurados);

        const prodEfetivosMap = {};
        resultadosRestaurados.forEach(r => {
          if (r.produtoSugerido && r.doseProdutoHa != null) {
            prodEfetivosMap[r.talhao.id] = { produto: r.produtoSugerido, doseKgHa: r.doseProdutoHa };
          }
        });
        if (Object.keys(prodEfetivosMap).length > 0) {
          produtosEfetivosRef.current = prodEfetivosMap;
          setProdutosEfetivosExterno(prodEfetivosMap);
        }
      }

      restauradoRef.current = chave;
    } else {
      // Re-execuções posteriores: só enriquece produtoSugerido com dados do catálogo, sem resetar estado
      if (todos.length > 0) {
        setResultadosCalculo(prev => {
          if (!prev) return prev;
          return prev.map(r => {
            if (!r.produtoSugerido) return r;
            const prodCatalogo = todos.find(p => p.id === r.produtoSugerido.id);
            return prodCatalogo ? { ...r, produtoSugerido: prodCatalogo } : r;
          });
        });
      }
    }
  }, [registrosSalvos.length, talhoes.length, todasAnalises.length, produtor?.id, safra]);

  const setProd = useCallback((talhaoId, campo, valor) => {
    setProdutividadeLocal(prev => ({ ...prev, [talhaoId]: { ...(prev[talhaoId] || {}), [campo]: valor } }));
  }, []);

  // Salvar produtividade+analise2040 para um talhão
  const salvarDadosTalhao = useCallback(async (talhaoObj, overrideData = {}) => {
    if (!produtor) return;
    const locProd = produtividadeLocal[talhaoObj.id] || {};
    const loc2040 = analises2040Local[talhaoObj.id] || null;
    const existente = registrosSalvos.find(r => r.talhao_id === talhaoObj.id);
    const payload = {
      codigo_produtor: produtor.codigo,
      safra,
      talhao_id: talhaoObj.id,
      talhao_nome: talhaoObj.nome,
      safra1_sc_ha: locProd.safra1 ? parseFloat(locProd.safra1) : null,
      safra2_sc_ha: locProd.safra2 ? parseFloat(locProd.safra2) : null,
      analise2040: loc2040 || null,
      ...overrideData,
    };
    if (existente) await updatePlan.mutateAsync({ id: existente.id, d: payload });
    else await createPlan.mutateAsync(payload);
  }, [produtor, safra, produtividadeLocal, analises2040Local, registrosSalvos]);

  const handleImportarAnalise = async (talhao, dados) => {
    const existente = analises.find(a => a.talhao_id === talhao.id && a.safra === safra);
    const payload = { codigo_produtor: produtor.codigo, talhao_id: talhao.id, talhao_nome: talhao.nome, safra, ...dados };
    if (existente) await updateAnalise.mutateAsync({ id: existente.id, d: payload });
    else await createAnalise.mutateAsync(payload);
  };

  const handleImportarAgrupado = async (itensList) => {
    // itensList: [{ talhao, dados, laboratorio }]
    let sucesso = 0;
    let falha = 0;
    for (const item of itensList) {
      try {
        await handleImportarAnalise(item.talhao, item.dados);
        sucesso++;
      } catch {
        falha++;
      }
    }
    // Invalida queries para atualizar status
    queryClient.invalidateQueries({ queryKey: ['analises_solo'] });
    toast({
      title: falha === 0 ? 'Importação concluída!' : 'Importação parcial',
      description: `${sucesso} talhão(ões) importado(s) com sucesso${falha > 0 ? `, ${falha} com erro` : ''}.`,
      variant: falha > 0 && sucesso === 0 ? 'destructive' : 'default',
    });
  };

  const handleFecharModalAgrupado020 = () => {
    if (selecionados.length > 1) {
      setAgrupamentosExplicitos(prev => {
        const filtered = prev.filter(g => !g.talhaoIds.some(id => selecionados.includes(id)));
        return [...filtered, { talhaoIds: [...selecionados] }];
      });
    }
    setSelecionados([]);
    setModalAgrupado020(false);
  };

  const handleFecharModalAgrupado2040 = () => {
    setSelecionados([]);
    setModalAgrupado2040(false);
  };

  const handleSalvar2040 = async (talhao, dados) => {
    setAnalises2040Local(prev => ({ ...prev, [talhao.id]: dados }));
    // Persiste imediatamente
    const existente = registrosSalvos.find(r => r.talhao_id === talhao.id);
    const locProd = produtividadeLocal[talhao.id] || {};
    const payload = {
      codigo_produtor: produtor.codigo,
      safra,
      talhao_id: talhao.id,
      talhao_nome: talhao.nome,
      safra1_sc_ha: locProd.safra1 ? parseFloat(locProd.safra1) : null,
      safra2_sc_ha: locProd.safra2 ? parseFloat(locProd.safra2) : null,
      analise2040: dados,
    };
    if (existente) await updatePlan.mutateAsync({ id: existente.id, d: payload });
    else await createPlan.mutateAsync(payload);
    setModal2040(null);
  };

  // Salva produtividade ao sair do campo (onBlur)
  const handleBlurProd = useCallback(async (talhao) => {
    if (!produtor) return;
    const locProd = produtividadeLocal[talhao.id] || {};
    const existente = registrosSalvos.find(r => r.talhao_id === talhao.id);
    const loc2040 = analises2040Local[talhao.id] || null;
    const payload = {
      codigo_produtor: produtor.codigo,
      safra,
      talhao_id: talhao.id,
      talhao_nome: talhao.nome,
      safra1_sc_ha: locProd.safra1 ? parseFloat(locProd.safra1) : null,
      safra2_sc_ha: locProd.safra2 ? parseFloat(locProd.safra2) : null,
      analise2040: loc2040 || null,
    };
    if (existente) await updatePlan.mutateAsync({ id: existente.id, d: payload });
    else await createPlan.mutateAsync(payload);
  }, [produtor, safra, produtividadeLocal, analises2040Local, registrosSalvos]);

  // Cálculo central — aceita lista filtrada opcional (C3)
  const handleCalcularTodos = useCallback((todosParaCalculo) => {
    const listaCalculo = todosParaCalculo || todos;
    setCalculando(true);
    setTimeout(() => {
      const resultados = talhoes.map(talhao => {
        const locProd = produtividadeLocal[talhao.id] || {};
        const s1 = parseFloat(locProd.safra1);
        const s2 = parseFloat(locProd.safra2);
        let mediaBienal = null;
        if (!isNaN(s1) && !isNaN(s2)) mediaBienal = (s1 + s2) / 2;
        else if (!isNaN(s1)) mediaBienal = s1;
        else if (!isNaN(s2)) mediaBienal = s2;

        const analise = analises.find(a => a.talhao_id === talhao.id) || null;
        const analise2040 = analises2040Local[talhao.id] || null;
        const rec = mediaBienal != null && analise ? calcRecomendacaoRamon(mediaBienal, analise, analise2040) : null;

        let produtoSugerido = null;
        let doseProdutoHa = null;
        if (rec && listaCalculo.length > 0) {
          const sugestoes = sugerirProdutosInteligente(listaCalculo, { N: rec.N, P: rec.P, K: rec.K, B: rec.B });
          const sugN = sugestoes['n_pct'];
          if (sugN?.produtoId) {
            const prod = listaCalculo.find(p => p.id === sugN.produtoId);
            if (prod) {
              produtoSugerido = prod;
              const pctN = parseFloat(prod.n_pct) || 0;
              if (pctN > 0 && rec.N != null) doseProdutoHa = Math.round((rec.N / (pctN / 100)) * 10) / 10;
            }
          }
        }
        return { talhao, mediaBienal, analise, analise2040, rec, produtoSugerido, doseProdutoHa };
      });

      setResultadosCalculo(resultados);
      setCalculando(false);
      // C1: não muda aba, mostra mensagem
      setMsgCalculo('Recomendação calculada com sucesso!');
      setTimeout(() => setMsgCalculo(''), 4000);
    }, 100);
  }, [talhoes, produtividadeLocal, analises, analises2040Local, todos]);

  // C2: estado de preços e parcelamentos sincronizado do filho
  // Usamos refs para evitar stale closure no handleSalvarTudo
  const [precosExterno, setPrecosExterno] = useState({});
  const [parcelamentosExterno, setParcelamentosExterno] = useState({});
  const precosRef = useRef({});
  const parcelamentosRef = useRef({});
  // Mapa de produto efetivo por talhão (reflete filtro/troca manual da aba Planejamento)
  const produtosEfetivosRef = useRef({});
  const [produtosEfetivosExterno, setProdutosEfetivosExterno] = useState({});

  const handlePrecosChange = useCallback((p) => {
    setPrecosExterno(p);
    precosRef.current = p;
  }, []);

  const handleParcelamentosChange = useCallback((p) => {
    setParcelamentosExterno(p);
    parcelamentosRef.current = p;
  }, []);

  const handleProdutosEfetivosChange = useCallback((m) => {
    produtosEfetivosRef.current = m;
    setProdutosEfetivosExterno(m);
  }, []);

  // C2: Salvar tudo (planejamento completo) — usa refs para pegar valores mais recentes
  const handleSalvarTudo = useCallback(async () => {
    if (!produtor || !resultadosCalculo) return;
    const precos = precosRef.current;
    const parcelamentos = parcelamentosRef.current;
    try {
    for (const r of resultadosCalculo) {
      const talhao = r.talhao;
      const existente = registrosSalvos.find(x => x.talhao_id === talhao.id);
      const locProd = produtividadeLocal[talhao.id] || {};
      const loc2040 = analises2040Local[talhao.id] || null;
      const payload = {
        codigo_produtor: produtor.codigo,
        safra,
        talhao_id: talhao.id,
        talhao_nome: talhao.nome,
        safra1_sc_ha: locProd.safra1 ? parseFloat(locProd.safra1) : null,
        safra2_sc_ha: locProd.safra2 ? parseFloat(locProd.safra2) : null,
        analise2040: loc2040 || null,
        doses_editadas: dosesEditadas[talhao.id] || {},
        detalhamento: {
          rec: r.rec,
          mediaBienal: r.mediaBienal,
          produtoSugerido: (() => {
            const efetivo = produtosEfetivosRef.current[talhao.id];
            if (efetivo?.produto) return { id: efetivo.produto.id, nome: efetivo.produto.nome };
            if (r.produtoSugerido) return { id: r.produtoSugerido.id, nome: r.produtoSugerido.nome };
            return null;
          })(),
          doseProdutoHa: produtosEfetivosRef.current[talhao.id]?.doseKgHa ?? r.doseProdutoHa,
          // Complementos, trocas e marcados — persistência completa do planejamento
          complementos: produtosEfetivosRef.current[talhao.id]?.complementos || [],
          trocas: produtosEfetivosRef.current[talhao.id]?.trocas || {},
          marcados: produtosEfetivosRef.current[talhao.id]?.marcados || null,
          precos,
          parcelamentos: parcelamentos[talhao.id] || {},
        },
      };
      if (existente) await updatePlan.mutateAsync({ id: existente.id, d: payload });
      else await createPlan.mutateAsync(payload);
    }
    toast({ title: 'Planejamento salvo!', description: 'Dados salvos com sucesso.' });
    } catch {
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' });
    }
  }, [produtor, safra, resultadosCalculo, produtividadeLocal, analises2040Local, dosesEditadas, registrosSalvos]);

  // PROBLEMA 2: editar dose na tabela
  const handleEditDose = useCallback((talhaoId, nutKey, valor) => {
    setDosesEditadas(prev => ({
      ...prev,
      [talhaoId]: { ...(prev[talhaoId] || {}), [nutKey]: valor },
    }));
  }, []);

  // PROBLEMA 3: salvar detalhamento
  const handleSaveDetalhe = useCallback(async (resultadoTalhao, estadoDetalhe) => {
    const talhao = resultadoTalhao.talhao;
    const existente = registrosSalvos.find(r => r.talhao_id === talhao.id);
    const locProd = produtividadeLocal[talhao.id] || {};
    const loc2040 = analises2040Local[talhao.id] || null;
    const payload = {
      codigo_produtor: produtor.codigo,
      safra,
      talhao_id: talhao.id,
      talhao_nome: talhao.nome,
      safra1_sc_ha: locProd.safra1 ? parseFloat(locProd.safra1) : null,
      safra2_sc_ha: locProd.safra2 ? parseFloat(locProd.safra2) : null,
      analise2040: loc2040 || null,
      doses_editadas: dosesEditadas[talhao.id] || {},
      detalhamento: estadoDetalhe,
    };
    if (existente) await updatePlan.mutateAsync({ id: existente.id, d: payload });
    else await createPlan.mutateAsync(payload);
  }, [produtor, safra, produtividadeLocal, analises2040Local, dosesEditadas, registrosSalvos]);

  const podeCacularTodos = analises.length > 0 || talhoes.some(t =>
    !isNaN(parseFloat(produtividadeLocal[t.id]?.safra1)) || !isNaN(parseFloat(produtividadeLocal[t.id]?.safra2))
  );

  // Ao trocar produtor/safra, limpa resultados
  const handleChangeProdutorSafra = useCallback((field, value) => {
    restauradoRef.current = '';
    precosRef.current = {};
    parcelamentosRef.current = {};
    produtosEfetivosRef.current = {};
    if (field === 'produtor') {
      setProdutorId(value === 'none' ? '' : value);
      setSelecionados([]);
      setAgrupamentosExplicitos([]);
      setResultadosCalculo(null);
      setDosesEditadas({});
      setProdutividadeLocal({});
      setAnalises2040Local({});
      setPrecosExterno({});
      setParcelamentosExterno({});
      setProdutosEfetivosExterno({});
    } else {
      setSafra(value);
      setResultadosCalculo(null);
      setDosesEditadas({});
      setProdutividadeLocal({});
      setAnalises2040Local({});
      setPrecosExterno({});
      setParcelamentosExterno({});
      setProdutosEfetivosExterno({});
    }
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Adubação 2.0</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestão integrada de análises de solo e recomendação nutricional</p>
      </div>

      {/* Cabeçalho */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs mb-1 block">Produtor</Label>
            <Select value={produtorId || 'none'} onValueChange={v => handleChangeProdutorSafra('produtor', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o produtor…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione…</SelectItem>
                {produtores.map(p => <SelectItem key={p.id} value={p.id}>{p.nome} — {p.fazenda}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Safra</Label>
            <Select value={safra} onValueChange={v => handleChangeProdutorSafra('safra', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SAFRAS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Protocolo</Label>
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
            Protocolo: <strong>{protocolo}</strong> — válido para toda a fazenda
          </p>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-0 border-b border-border">
        {ABAS.map(aba => (
          <button key={aba.id} onClick={() => setAbaAtiva(aba.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${abaAtiva===aba.id?'border-primary text-primary':'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {aba.label}
            {aba.id !== 'analises' && resultadosCalculo && (
              <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                {resultadosCalculo.filter(r => r.rec).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Aba: Análises ── */}
      {abaAtiva === 'analises' && !produtor && (
        <div className="text-center py-16 text-muted-foreground">
          <Sprout className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>Selecione um produtor para visualizar os talhões.</p>
        </div>
      )}

      {abaAtiva === 'analises' && produtor && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-border bg-muted/20">
            {/* 0-20 cm */}
            <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
              <span className="text-xs font-semibold text-green-800">0-20 cm</span>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs border-green-300 text-green-800 hover:bg-green-50"
              disabled={selecionados.length === 0} onClick={() => setModalAgrupado020(true)}>
              <Upload className="w-3.5 h-3.5" /> Selecionados ({selecionados.length})
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs border-green-300 text-green-800 hover:bg-green-50"
              onClick={() => { setSelecionados(talhoes.map(t => t.id)); setModalAgrupado020(true); }}>
              <FileUp className="w-3.5 h-3.5" /> Todos de uma vez
            </Button>
            {/* 20-40 cm */}
            <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 ml-2">
              <span className="text-xs font-semibold text-orange-800">20-40 cm</span>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs border-orange-300 text-orange-800 hover:bg-orange-50"
              disabled={selecionados.length === 0} onClick={() => setModalAgrupado2040(true)}>
              <Upload className="w-3.5 h-3.5" /> Selecionados ({selecionados.length})
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs border-orange-300 text-orange-800 hover:bg-orange-50"
              onClick={() => { setSelecionados(talhoes.map(t => t.id)); setModalAgrupado2040(true); }}>
              <FileUp className="w-3.5 h-3.5" /> Todos de uma vez
            </Button>
            <div className="ml-auto flex items-center gap-2">
              {msgCalculo && (
                <span className="flex items-center gap-1 text-xs text-green-700 font-medium bg-green-50 border border-green-200 rounded px-2 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {msgCalculo}
                </span>
              )}
              <Button variant="outline" size="sm"
                className={`gap-1.5 text-xs ${protocolo !== 'Protocolo Ramon' ? 'opacity-50' : ''}`}
                disabled={!podeCacularTodos || calculando} onClick={() => handleCalcularTodos()}>
                {calculando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
                Calcular recomendação para todos
              </Button>
              <Button size="sm" className="gap-1.5 text-xs bg-green-700 hover:bg-green-800 text-white"
                disabled={!resultadosCalculo || !produtor} onClick={handleSalvarTudo}>
                <Save className="w-3.5 h-3.5" /> Salvar
              </Button>
            </div>
          </div>
          {protocolo !== 'Protocolo Ramon' && (
            <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-b border-amber-100 text-amber-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              O cálculo automático está disponível apenas para o Protocolo Ramon.
            </div>
          )}

          {talhoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum talhão cadastrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    <th className="px-3 py-3 w-10">
                      <Checkbox checked={selecionados.length === talhoes.length && talhoes.length > 0}
                        onCheckedChange={() => setSelecionados(prev => prev.length === talhoes.length ? [] : talhoes.map(t => t.id))} />
                    </th>
                    {['Talhão','Área (ha)','Nº plantas','Safra 1 (sc/ha)','Safra 2 (sc/ha)','Média','Análise 0-20','Análise 20-40','Status'].map(h => (
                      <th key={h} className="px-3 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {talhoes.map((talhao, i) => {
                    const status = getStatus(talhao, analises, agrupamentosExplicitos);
                    const sel = selecionados.includes(talhao.id);
                    const locProd = produtividadeLocal[talhao.id] || {};
                    const s1 = parseFloat(locProd.safra1);
                    const s2 = parseFloat(locProd.safra2);
                    let media = null;
                    if (!isNaN(s1) && !isNaN(s2)) media = (s1 + s2) / 2;
                    else if (!isNaN(s1)) media = s1;
                    else if (!isNaN(s2)) media = s2;
                    const tem2040 = !!analises2040Local[talhao.id];

                    return (
                      <tr key={talhao.id} className={`border-b border-border/50 last:border-0 transition-colors ${sel ? 'bg-primary/5' : i%2===0?'':'bg-muted/10'}`}>
                        <td className="px-3 py-2">
                          <Checkbox checked={sel} onCheckedChange={() => setSelecionados(prev => prev.includes(talhao.id) ? prev.filter(x=>x!==talhao.id) : [...prev, talhao.id])} />
                        </td>
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{talhao.nome}</td>
                        <td className="px-3 py-2 tabular-nums">{talhao.area_ha ?? '—'}</td>
                        <td className="px-3 py-2 tabular-nums">{talhao.num_plantas?.toLocaleString() ?? '—'}</td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="0.1"
                            value={locProd.safra1 ?? ''}
                            onChange={e => setProd(talhao.id, 'safra1', e.target.value)}
                            onBlur={() => handleBlurProd(talhao)}
                            className="w-20 h-7 text-xs text-right border border-input rounded px-2 bg-background tabular-nums"
                            placeholder="—" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="0.1"
                            value={locProd.safra2 ?? ''}
                            onChange={e => setProd(talhao.id, 'safra2', e.target.value)}
                            onBlur={() => handleBlurProd(talhao)}
                            className="w-20 h-7 text-xs text-right border border-input rounded px-2 bg-background tabular-nums"
                            placeholder="—" />
                        </td>
                        <td className="px-3 py-2 tabular-nums font-bold text-sm">{media != null ? media.toFixed(1) : '—'}</td>
                        <td className="px-3 py-2">
                          <ImportarPDFTalhao talhao={talhao} safra={safra} analises={analises} analises2040={[]}
                            onImportarAnalise={handleImportarAnalise} onImportarAnalise2040={() => {}} talhoes={talhoes} />
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => setModal2040(talhao)}
                            className={`flex items-center gap-1 text-xs rounded px-2 py-1 border transition-colors ${tem2040?'border-green-300 bg-green-50 text-green-700 hover:bg-green-100':'border-dashed border-muted-foreground/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground'}`}>
                            {tem2040 ? <CheckCircle2 className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
                            {tem2040 ? 'Importada' : 'Opcional'}
                          </button>
                        </td>
                        <td className="px-3 py-2">
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

      {/* ── Aba: Calagem ── */}
      {abaAtiva === 'calagem' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <AbaCalagem2
            talhoes={talhoes}
            analises={analises}
            safra={safra}
            codigoProdutor={produtor?.codigo}
            fertilizantes={fertilizantes}
            fontesSimples={fontesSimples}
          />
        </div>
      )}

      {/* ── Aba: Planejamento ── */}
      {abaAtiva === 'planejamento' && (
        <AbaPlanejamento2
          resultados={resultadosCalculo}
          todos={todos}
          calculando={calculando}
          podeCacularTodos={podeCacularTodos}
          onRecalcular={handleCalcularTodos}
          onSalvar={handleSalvarTudo}
          onPrecosChange={handlePrecosChange}
          onParcelamentosChange={handleParcelamentosChange}
          onProdutosEfetivosChange={handleProdutosEfetivosChange}
          precosIniciais={precosExterno}
          parcelamentosIniciais={parcelamentosExterno}
          registrosSalvos={registrosSalvos}
          precosNotasMap={precosNotasMap}
        />
      )}

      {/* ── Aba: Compras ── */}
      {abaAtiva === 'compras' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground italic">
              {resultadosCalculo ? 'Consolidação por produto' : 'Execute o cálculo na aba Análises'}
            </p>
            {produtor && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={!podeCacularTodos||calculando} onClick={handleCalcularTodos}>
                {calculando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
                Recalcular
              </Button>
            )}
          </div>
          <AbaCompras2 resultados={resultadosCalculo} dosesEditadas={dosesEditadas} produtosEfetivos={produtosEfetivosExterno} />
        </div>
      )}

      {/* ── Aba: Resumo Geral ── */}
      {abaAtiva === 'resumo' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden p-5">
          <AbaResumoGeral2
            resultados={resultadosCalculo}
            todos={todos}
            produtosEfetivos={produtosEfetivosExterno}
            calagens={calagensProdutor}
            talhoes={talhoes}
            produtor={produtor}
            safra={safra}
            registrosSalvos={registrosSalvos}
          />
        </div>
      )}

      {/* Modal agrupado 0-20 cm */}
      {modalAgrupado020 && (
        <ImportarAgrupado020
          talhoes={talhoes.filter(t => selecionados.includes(t.id))}
          onImportarAnalise={handleImportarAgrupado}
          onClose={handleFecharModalAgrupado020}
        />
      )}

      {/* Modal agrupado 20-40 cm */}
      {modalAgrupado2040 && (
        <ImportarAgrupado2040
          talhoes={talhoes.filter(t => selecionados.includes(t.id))}
          analises2040Existentes={analises2040Local}
          onSalvar2040={handleSalvar2040}
          onClose={handleFecharModalAgrupado2040}
        />
      )}

      {/* Modal 20-40 cm */}
      {modal2040 && (
        <ImportarManual2040
          talhao={modal2040} analise2040Existente={analises2040Local[modal2040.id] || null}
          onSalvar={(dados) => handleSalvar2040(modal2040, dados)}
          onClose={() => setModal2040(null)}
        />
      )}

      {/* PROBLEMA 3: Modal detalhe talhão */}
      {modalDetalhe && (
        <ModalDetalheTalhao
          resultado={modalDetalhe}
          todos={todos}
          detalhamento={registrosSalvos.find(r => r.talhao_id === modalDetalhe.talhao.id)?.detalhamento || null}
          onSave={(estadoDetalhe) => handleSaveDetalhe(modalDetalhe, estadoDetalhe)}
          onClose={() => setModalDetalhe(null)}
        />
      )}
    </div>
  );
}