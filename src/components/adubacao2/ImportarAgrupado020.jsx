import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Loader2, CheckCircle2, AlertTriangle, GripVertical, FileText, ArrowRight, XCircle, Layers, Copy, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const CAMPOS_0_20 = [
  { key: 'ph', label: 'pH' },
  { key: 'materia_organica', label: 'M.O.' },
  { key: 'fosforo', label: 'P (mg/dm³)' },
  { key: 'potassio', label: 'K (mg/dm³)' },
  { key: 'calcio', label: 'Ca (cmolc/dm³)' },
  { key: 'magnesio', label: 'Mg (cmolc/dm³)' },
  { key: 'enxofre', label: 'S (mg/dm³)' },
  { key: 'boro', label: 'B (mg/dm³)' },
  { key: 'zinco', label: 'Zn (mg/dm³)' },
  { key: 'cobre', label: 'Cu (mg/dm³)' },
  { key: 'manganes', label: 'Mn (mg/dm³)' },
  { key: 'ferro', label: 'Fe (mg/dm³)' },
  { key: 'ctc', label: 'CTC' },
  { key: 'saturacao_bases', label: 'V%' },
  { key: 'data_analise', label: 'Data da Análise', date: true },
];

function converterUnidades(dados, laboratorio) {
  const d = { ...dados };
  const n = v => (v != null && !isNaN(Number(v))) ? Number(v) : null;
  if (laboratorio === 'COOXUPE') {
    if (n(d.potassio) != null) d.potassio = +(n(d.potassio) * 39.1).toFixed(1);
    ['calcio', 'magnesio', 'aluminio', 'h_al', 'sb', 'ctc'].forEach(k => {
      if (n(d[k]) != null) d[k] = +(n(d[k]) / 10).toFixed(3);
    });
  } else if (laboratorio === 'LAB_VICOSA') {
    if (n(d.potassio) != null && n(d.potassio) < 3) d.potassio = +(n(d.potassio) * 391).toFixed(1);
  }
  return d;
}

function parearPorNome(arquivos, talhoes) {
  return talhoes.map((talhao, idx) => {
    const nomeNorm = talhao.nome.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = arquivos.find(arq => {
      const arquivoNorm = arq.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return arquivoNorm.includes(nomeNorm.slice(0, 4)) || nomeNorm.includes(arquivoNorm.replace('.pdf', '').slice(0, 4));
    });
    return { talhao, arquivo: match || arquivos[idx] || null };
  });
}

// Paleta de cores para agrupar visualmente PDFs compartilhados
const CORES_GRUPO = [
  'bg-blue-100 text-blue-700 border-blue-300',
  'bg-purple-100 text-purple-700 border-purple-300',
  'bg-emerald-100 text-emerald-700 border-emerald-300',
  'bg-rose-100 text-rose-700 border-rose-300',
  'bg-amber-100 text-amber-700 border-amber-300',
  'bg-cyan-100 text-cyan-700 border-cyan-300',
];

function getCorGrupo(nomeArquivo, arquivosUnicos) {
  const idx = arquivosUnicos.indexOf(nomeArquivo);
  return idx >= 0 ? CORES_GRUPO[idx % CORES_GRUPO.length] : '';
}

function getErrorMessage(error) {
  return error?.message || String(error || 'Erro desconhecido');
}

const buildPrompt = (textoPDF) => `
Extraia os dados desta análise de solo e retorne APENAS um objeto JSON válido, sem texto adicional, sem markdown.

Primeiro identifique o laboratório:
- COOXUPE: contém "Cooxupé" ou "Cooperativa Regional de Cafeicultores em Guaxupé"
- LAB_VICOSA: contém "labsolosvicosa" ou "Laboratório de Análise de Solo Viçosa"
- OUTRO: qualquer outro

NÃO converta unidades — retorne os valores EXATAMENTE como aparecem no laudo.

Retorne um objeto com os campos:
- laboratorio, ph, materia_organica, fosforo, potassio, calcio, magnesio, enxofre, boro, zinco, cobre, manganes, ferro, ctc, saturacao_bases, h_al, aluminio, sb, data_analise

Se algum campo não for encontrado, retornar null.

=== TEXTO DO PDF ===
${textoPDF}
=== FIM ===`;

// ── Dialog "aplicar a outros talhões" ─────────────────────────────────────────
function PopoverAplicarOutros({ talhoes, pares, idxOrigem, onAplicar, onClose }) {
  const arquivoOrigem = pares[idxOrigem]?.arquivo;
  const [selecionados, setSelecionados] = useState([]);

  const toggle = (id) => setSelecionados(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            Aplicar mesmo PDF a outros talhões
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2 mb-1 break-all">"{arquivoOrigem?.name}"</p>
        <div className="space-y-1 max-h-56 overflow-y-auto border border-border rounded-lg p-2">
          {talhoes.map((t, i) => {
            if (i === idxOrigem) return null;
            const jaTemEste = pares[i]?.arquivo?.name === arquivoOrigem?.name;
            return (
              <label key={t.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 rounded px-2 py-1">
                <Checkbox
                  checked={selecionados.includes(t.id) || jaTemEste}
                  disabled={jaTemEste}
                  onCheckedChange={() => toggle(t.id)}
                />
                <span className="text-sm">{t.nome}</span>
                {jaTemEste && <span className="text-xs text-muted-foreground ml-auto">já associado</span>}
              </label>
            );
          })}
        </div>
        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="gap-1.5" disabled={selecionados.length === 0}
            onClick={() => { onAplicar(selecionados); onClose(); }}>
            <Copy className="w-3.5 h-3.5" /> Aplicar a {selecionados.length > 0 ? selecionados.length : ''} talhão(ões)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Etapa 1: Associação ────────────────────────────────────────────────────────
function EtapaAssociacao({ talhoes, pares, setPares, onConfirmar, onClose, processando }) {
  const fileRef = useRef();
  const [arquivos, setArquivos] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [popoverAberto, setPopoverAberto] = useState(null); // idx da linha

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setArquivos(files);
    setPares(parearPorNome(files, talhoes));
    e.target.value = '';
  };

  // DnD: COPIA o arquivo para o destino (não troca)
  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'copy';
  };
  const handleDragOver = (e, idx) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(idx); };
  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOver(null); return; }
    const arqOrigem = pares[dragIdx]?.arquivo;
    if (!arqOrigem) { setDragIdx(null); setDragOver(null); return; }
    // Copia o arquivo para o destino, mantendo o original
    setPares(prev => prev.map((p, i) => i === idx ? { ...p, arquivo: arqOrigem } : p));
    setDragIdx(null);
    setDragOver(null);
  };

  const trocarArquivo = (talhaoIdx, nomeArquivo) => {
    const arq = arquivos.find(a => a.name === nomeArquivo) || null;
    setPares(prev => prev.map((p, i) => i === talhaoIdx ? { ...p, arquivo: arq } : p));
  };

  const aplicarAOutros = (idxOrigem, idsTalhoes) => {
    const arq = pares[idxOrigem]?.arquivo;
    if (!arq) return;
    setPares(prev => prev.map((p) =>
      idsTalhoes.includes(p.talhao.id) ? { ...p, arquivo: arq } : p
    ));
  };

  // Nomes únicos de arquivos usados para colorir grupos
  const arquivosUsados = [...new Set(pares.filter(p => p.arquivo).map(p => p.arquivo.name))];
  // Arquivos compartilhados por >1 talhão
  const contagemPorArquivo = {};
  pares.forEach(p => { if (p.arquivo) contagemPorArquivo[p.arquivo.name] = (contagemPorArquivo[p.arquivo.name] || 0) + 1; });

  const podeContinuar = pares.length > 0 && pares.every(p => p.arquivo);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
        <p className="font-semibold mb-1">Como funciona:</p>
        <p>1. Selecione os PDFs. A associação é automática pelo nome.</p>
        <p>2. <strong>Arraste</strong> um arquivo sobre outro talhão para compartilhá-lo, ou use o botão <Users className="inline w-3 h-3" /> para selecionar múltiplos talhões.</p>
        <p>3. Talhões com o mesmo PDF ficam marcados com a mesma cor.</p>
      </div>

      <div>
        <input ref={fileRef} type="file" accept="application/pdf" multiple className="hidden" onChange={handleFiles} />
        <Button variant="outline" className="gap-2 border-dashed border-blue-400 text-blue-700 hover:bg-blue-50 w-full"
          onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4" />
          {arquivos.length > 0 ? `${arquivos.length} arquivo(s) — clique para trocar` : 'Selecionar PDFs de análise 0-20 cm'}
        </Button>
      </div>

      {pares.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="bg-muted/20 px-3 py-2 border-b border-border grid grid-cols-[20px_1fr_20px_1fr_28px] gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span></span>
            <span>Arquivo PDF</span>
            <span></span>
            <span>Talhão de destino</span>
            <span></span>
          </div>
          {pares.map((par, idx) => {
            const compartilhado = par.arquivo && contagemPorArquivo[par.arquivo.name] > 1;
            const corGrupo = par.arquivo ? getCorGrupo(par.arquivo.name, arquivosUsados) : '';
            return (
              <div
                key={par.talhao.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={() => { setDragIdx(null); setDragOver(null); }}
                className={`grid grid-cols-[20px_1fr_20px_1fr_28px] gap-2 items-center px-3 py-2.5 border-b border-border/50 last:border-0 transition-colors cursor-grab active:cursor-grabbing
                  ${dragOver === idx ? 'bg-blue-50 border-blue-300' : dragIdx === idx ? 'opacity-60' : idx % 2 === 0 ? 'bg-background' : 'bg-muted/5'}`}
              >
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40" />

                {/* Coluna arquivo */}
                <div className="flex items-center gap-1.5 min-w-0">
                  {compartilhado && (
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${corGrupo}`}>
                      ×{contagemPorArquivo[par.arquivo.name]}
                    </span>
                  )}
                  <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  {arquivos.length > 1 ? (
                    <Select value={par.arquivo?.name || ''} onValueChange={v => trocarArquivo(idx, v)}>
                      <SelectTrigger className="h-7 text-xs border-dashed min-w-0 flex-1">
                        <SelectValue placeholder="— sem arquivo —" />
                      </SelectTrigger>
                      <SelectContent>
                        {arquivos.map(a => (
                          <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs truncate">
                      {par.arquivo?.name || <span className="text-muted-foreground italic">sem arquivo</span>}
                    </span>
                  )}
                </div>

                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 justify-self-center" />

                {/* Coluna talhão */}
                <div className="flex items-center gap-1.5 min-w-0">
                  {compartilhado && (
                    <span className={`shrink-0 inline-block w-2 h-2 rounded-full border-2 ${corGrupo.replace('text-', 'border-').split(' ')[0]} ${corGrupo.split(' ')[0]}`} />
                  )}
                  <span className="text-xs font-medium truncate">{par.talhao.nome}</span>
                </div>

                {/* Botão aplicar a outros */}
                <div className="relative justify-self-end">
                  {par.arquivo && (
                    <button
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-blue-100 text-blue-500 hover:text-blue-700 transition-colors"
                      title="Aplicar este PDF a outros talhões"
                      onClick={(e) => { e.stopPropagation(); setPopoverAberto(popoverAberto === idx ? null : idx); }}
                    >
                      <Users className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {popoverAberto === idx && (
                    <PopoverAplicarOutros
                      talhoes={talhoes}
                      pares={pares}
                      idxOrigem={idx}
                      onAplicar={(ids) => aplicarAOutros(idx, ids)}
                      onClose={() => setPopoverAberto(null)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legenda de grupos */}
      {arquivosUsados.filter(n => contagemPorArquivo[n] > 1).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground">PDFs compartilhados:</span>
          {arquivosUsados.filter(n => contagemPorArquivo[n] > 1).map(nome => (
            <span key={nome} className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getCorGrupo(nome, arquivosUsados)}`}>
              {nome.replace('.pdf', '').slice(0, 20)} → {contagemPorArquivo[nome]} talhões
            </span>
          ))}
        </div>
      )}

      <DialogFooter className="gap-2">
        <Button variant="outline" size="sm" onClick={onClose} disabled={processando}>Cancelar</Button>
        <Button size="sm" disabled={!podeContinuar || processando} onClick={() => onConfirmar(pares)}
          className="gap-2 bg-green-700 hover:bg-green-800 text-white">
          {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Confirmar e Importar
        </Button>
      </DialogFooter>
    </div>
  );
}

// ── Etapa 2: Processamento ─────────────────────────────────────────────────────
function EtapaProcessando({ total, atual }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4 text-muted-foreground">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
      <p className="text-sm font-medium">Extraindo dados com IA…</p>
      <p className="text-xs">{atual} de {total} arquivo(s) únicos processados</p>
    </div>
  );
}

// ── Etapa 3: Revisão ──────────────────────────────────────────────────────────
function EtapaRevisao({ itens, setItens, onSalvar, salvando }) {
  const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;
  const updateDado = (idx, key, value) => {
    setItens(prev => prev.map((item, i) =>
      i === idx ? { ...item, dados: { ...item.dados, [key]: value } } : item
    ));
  };

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        Confira os dados extraídos. Talhões com o mesmo PDF têm os mesmos valores iniciais — edite individualmente se necessário.
      </div>
      {itens.map((item, idx) => (
        <div key={item.talhao.id} className="border border-border rounded-xl overflow-hidden">
          <div className="bg-muted/20 px-4 py-2.5 border-b border-border flex items-center gap-2 flex-wrap">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold">{item.talhao.nome}</span>
            {item.arquivoNome && <span className="text-xs text-muted-foreground">← {item.arquivoNome}</span>}
            <span className="ml-auto text-xs text-muted-foreground">Lab: {item.laboratorio}</span>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CAMPOS_0_20.map(c => (
              <div key={c.key}>
                <Label className="text-xs mb-0.5 block text-muted-foreground">{c.label}</Label>
                <Input type={c.date ? 'date' : 'number'} step={c.date ? undefined : '0.001'}
                  value={item.dados[c.key] ?? ''}
                  onChange={e => updateDado(idx, c.key, c.date ? e.target.value : toNum(e.target.value))}
                  className="h-7 text-xs" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <DialogFooter>
        <Button size="sm" onClick={onSalvar} disabled={salvando} className="gap-2">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Salvar {itens.length} análise(s)
        </Button>
      </DialogFooter>
    </div>
  );
}

// ── Etapa 4: Resumo ───────────────────────────────────────────────────────────
function EtapaResumo({ resultados, onClose }) {
  const ok = resultados.filter(r => r.status === 'ok').length;
  const err = resultados.filter(r => r.status === 'erro').length;
  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-2 p-4 rounded-xl border text-sm font-medium ${err === 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
        {err === 0 ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        {ok} importado(s) com sucesso{err > 0 ? `, ${err} com erro` : ''}.
      </div>
      <div className="border border-border rounded-xl overflow-hidden">
        {resultados.map((r, i) => (
          <div key={r.talhao.id} className={`flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/5'}`}>
            {r.status === 'ok' ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{r.talhao.nome}</p>
              <p className="text-xs text-muted-foreground truncate">{r.arquivoNome}</p>
            </div>
            <span className={`text-xs font-medium ${r.status === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
              {r.status === 'ok' ? 'Sucesso' : 'Erro'}
            </span>
            {r.status === 'erro' && r.erro && (
              <p className="basis-full pl-7 text-xs text-red-600 break-words">
                {r.erro}
              </p>
            )}
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button size="sm" onClick={onClose}>Fechar</Button>
      </DialogFooter>
    </div>
  );
}

// ── Modal principal ────────────────────────────────────────────────────────────
export default function ImportarAgrupado020({ talhoes, onImportarAnalise, onClose }) {
  const [etapa, setEtapa] = useState('associacao');
  const [pares, setPares] = useState([]);
  const [itens, setItens] = useState([]);
  const [progresso, setProgresso] = useState(0);
  const [resultados, setResultados] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [processandoConfirmacao, setProcessandoConfirmacao] = useState(false);
  const processandoConfirmacaoRef = useRef(false);

  const handleConfirmar = useCallback(async (paresConfirmados) => {
    if (processandoConfirmacaoRef.current) return;
    processandoConfirmacaoRef.current = true;
    setProcessandoConfirmacao(true);
    setEtapa('processando');
    setProgresso(0);

    try {
      // Cache: extrair cada PDF único apenas uma vez
      const cacheExtracao = {}; // nomeArquivo -> { dados, laboratorio }
      const arquivosUnicos = [...new Set(paresConfirmados.filter(p => p.arquivo).map(p => p.arquivo.name))];
      let processados = 0;

      for (const par of paresConfirmados) {
        if (!par.arquivo || cacheExtracao[par.arquivo.name]) continue;
        let dadosExtraidos = {};
        let laboratorio = 'OUTRO';
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: par.arquivo });
          let textoPDF = '';
          try {
            const extracao = await base44.integrations.Core.ExtractDataFromUploadedFile({
              file_url,
              json_schema: { type: 'object', properties: { texto_completo: { type: 'string' } } },
            });
            if (extracao?.status === 'success' && extracao?.output?.texto_completo) textoPDF = extracao.output.texto_completo;
          } catch (error) {
            console.warn('Não foi possível extrair texto completo do PDF; tentando leitura pelo LLM.', error);
          }
          const resposta = await base44.integrations.Core.InvokeLLM({
            prompt: buildPrompt(textoPDF || 'Leia os dados diretamente do arquivo PDF anexo.'),
            file_urls: [file_url],
            model: 'claude_sonnet_4_6',
          });
          let parsed = resposta;
          if (typeof resposta === 'string') {
            const m = resposta.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
            parsed = m ? JSON.parse(m[0]) : null;
          }
          if (parsed) {
            laboratorio = parsed.laboratorio || 'OUTRO';
            const { laboratorio: _l, ...brutos } = parsed;
            dadosExtraidos = converterUnidades(brutos, laboratorio);
          }
        } catch (error) {
          console.error('Erro ao processar PDF de análise de solo 0-20 cm.', error);
        }
        cacheExtracao[par.arquivo.name] = { dados: dadosExtraidos, laboratorio };
        processados++;
        setProgresso(processados);
      }

      // Cada talhão recebe sua própria cópia dos dados
      const itensPorcessados = paresConfirmados.map(par => ({
        talhao: par.talhao,
        arquivo: par.arquivo,
        arquivoNome: par.arquivo?.name || '',
        dados: par.arquivo ? { ...(cacheExtracao[par.arquivo.name]?.dados || {}) } : {},
        laboratorio: par.arquivo ? (cacheExtracao[par.arquivo.name]?.laboratorio || 'OUTRO') : 'OUTRO',
      }));

      setItens(itensPorcessados);
      setEtapa('revisao');
    } finally {
      processandoConfirmacaoRef.current = false;
      setProcessandoConfirmacao(false);
    }
  }, []);

  const handleSalvar = useCallback(async () => {
    setSalvando(true);
    const res = [];
    for (const item of itens) {
      try {
        await onImportarAnalise(item.talhao, item.dados);
        res.push({ talhao: item.talhao, arquivoNome: item.arquivoNome, status: 'ok' });
      } catch (error) {
        res.push({ talhao: item.talhao, arquivoNome: item.arquivoNome, status: 'erro', erro: getErrorMessage(error) });
      }
    }
    setResultados(res);
    setSalvando(false);
    setEtapa('resumo');
  }, [itens, onImportarAnalise]);

  const titulo = {
    associacao: 'Associar PDFs → Talhões',
    processando: 'Extraindo dados com IA…',
    revisao: 'Revisar dados extraídos',
    resumo: 'Resumo da importação',
  }[etapa];

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1.5 bg-green-100 text-green-800 rounded-lg px-2.5 py-1">
              <Layers className="w-3.5 h-3.5" />
              <span className="font-bold text-xs">Análise 0-20 cm</span>
            </div>
            {titulo} — {talhoes.length} talhão(ões)
          </DialogTitle>
        </DialogHeader>
        {etapa === 'associacao' && <EtapaAssociacao talhoes={talhoes} pares={pares} setPares={setPares} onConfirmar={handleConfirmar} onClose={onClose} processando={processandoConfirmacao} />}
        {etapa === 'processando' && <EtapaProcessando total={[...new Set(pares.filter(p=>p.arquivo).map(p=>p.arquivo.name))].length} atual={progresso} />}
        {etapa === 'revisao' && <EtapaRevisao itens={itens} setItens={setItens} onSalvar={handleSalvar} salvando={salvando} />}
        {etapa === 'resumo' && <EtapaResumo resultados={resultados} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
