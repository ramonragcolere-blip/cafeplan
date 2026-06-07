import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileUp, Calculator, CheckCircle2, Link2, Clock, Sprout } from 'lucide-react';
import ImportarPDFTalhao from '@/components/adubacao2/ImportarPDFTalhao';
import ImportarPDFAgrupado from '@/components/adubacao2/ImportarPDFAgrupado';

const PROTOCOLOS = [
  'Protocolo Ramon',
  '5ª Aproximação MG',
  'Boletim 100 IAC',
  'Personalizado',
];

const SAFRAS = ['2024/2025', '2025/2026', '2026/2027', '2027/2028'];

function getStatus(talhao, analises, analise2040, agrupamentos) {
  const ag = agrupamentos.find(g => g.talhaoIds.includes(talhao.id));
  if (ag) return { tipo: 'agrupada', outros: ag.talhaoIds.filter(id => id !== talhao.id) };
  const temAnalise = analises.some(a => a.talhao_id === talhao.id);
  if (temAnalise) return { tipo: 'importada' };
  return { tipo: 'pendente' };
}

function StatusBadge({ status, talhoes, agrupamentos }) {
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
        Agrupada com: {nomes.join(', ')}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="w-3.5 h-3.5" /> Pendente
    </span>
  );
}

export default function Adubacao2() {
  const queryClient = useQueryClient();
  const [produtorId, setProdutorId] = useState('');
  const [safra, setSafra] = useState('2025/2026');
  const [protocolo, setProtocolo] = useState(PROTOCOLOS[0]);
  const [selecionados, setSelecionados] = useState([]);
  // agrupamentos locais: [{ talhaoIds: string[] }]
  const [agrupamentos, setAgrupamentos] = useState([]);
  const [modalAgrupado, setModalAgrupado] = useState(false);

  const { data: produtores = [] } = useQuery({ queryKey: ['produtores'], queryFn: () => base44.entities.Produtor.list() });
  const { data: todosTalhoes = [] } = useQuery({ queryKey: ['talhoes'], queryFn: () => base44.entities.Talhao.list() });
  const { data: todasAnalises = [] } = useQuery({ queryKey: ['analises_solo'], queryFn: () => base44.entities.AnaliseSolo.list() });

  const produtor = produtores.find(p => p.id === produtorId) || null;

  const talhoes = useMemo(() =>
    todosTalhoes.filter(t => t.codigo_produtor === produtor?.codigo),
    [todosTalhoes, produtor]
  );

  const analises = useMemo(() =>
    todasAnalises.filter(a => a.safra === safra && talhoes.some(t => t.id === a.talhao_id)),
    [todasAnalises, safra, talhoes]
  );

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

  // Importação agrupada: aplica o mesmo PDF a todos os talhões selecionados
  const handleImportarAgrupado = async (dados) => {
    await Promise.all(selecionados.map(id => {
      const talhao = talhoes.find(t => t.id === id);
      if (!talhao) return Promise.resolve();
      return handleImportarAnalise(talhao, dados);
    }));
    // registra agrupamento para exibir badge
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

  const temAnaliseSelecionados = selecionados.some(id => analises.some(a => a.talhao_id === id));
  const podeCacularTodos = analises.length > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Adubação 2.0</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestão integrada de análises de solo e recomendação nutricional</p>
      </div>

      {/* Cabeçalho de seleção */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs mb-1 block">Produtor</Label>
            <Select value={produtorId || 'none'} onValueChange={v => { setProdutorId(v === 'none' ? '' : v); setSelecionados([]); setAgrupamentos([]); }}>
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

      {/* Lista de talhões */}
      {produtor && (
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
              disabled
              title="Em breve"
            >
              <FileUp className="w-3.5 h-3.5" />
              Importar todas de uma vez
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs ml-auto"
              disabled={!podeCacularTodos}
            >
              <Calculator className="w-3.5 h-3.5" />
              Calcular recomendação para todos
            </Button>
          </div>

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
                    <th className="px-4 py-3 text-left w-10">
                      <Checkbox
                        checked={selecionados.length === talhoes.length && talhoes.length > 0}
                        onCheckedChange={toggleTodos}
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">Talhão</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">Área (ha)</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase tracking-wide">Nº plantas</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">Análise de solo</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {talhoes.map((talhao, i) => {
                    const status = getStatus(talhao, analises, [], agrupamentos);
                    const sel = selecionados.includes(talhao.id);
                    return (
                      <tr
                        key={talhao.id}
                        className={`border-b border-border/50 last:border-0 transition-colors ${sel ? 'bg-primary/5' : i % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'}`}
                      >
                        <td className="px-4 py-3">
                          <Checkbox checked={sel} onCheckedChange={() => toggleSelecao(talhao.id)} />
                        </td>
                        <td className="px-4 py-3 font-medium">{talhao.nome}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{talhao.area_ha ?? '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{talhao.num_plantas?.toLocaleString() ?? '—'}</td>
                        <td className="px-4 py-3">
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
                        <td className="px-4 py-3">
                          <StatusBadge status={status} talhoes={talhoes} agrupamentos={agrupamentos} />
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

      {!produtor && (
        <div className="text-center py-16 text-muted-foreground">
          <Sprout className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>Selecione um produtor para visualizar os talhões.</p>
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
          onClose={() => setModalAgrupado(false)}
        />
      )}
    </div>
  );
}