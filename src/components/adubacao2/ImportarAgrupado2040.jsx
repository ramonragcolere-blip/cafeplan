import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Loader2, CheckCircle2, AlertTriangle, GripVertical, FileText, ArrowRight, XCircle, Mountain, Copy, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const CAMPOS_2040 = [
  { key: 'ph',              label: 'pH' },
  { key: 'potassio',        label: 'K (mg/dm³)' },
  { key: 'calcio',          label: 'Ca (cmolc/dm³)' },
  { key: 'magnesio',        label: 'Mg (cmolc/dm³)' },
  { key: 'aluminio',        label: 'Al (cmolc/dm³)' },
  { key: 'fosforo',         label: 'P (mg/dm³)' },
  { key: 'ctc',             label: 'CTC' },
  { key: 'saturacao_bases', label: 'V%' },
  { key: 'data_analise',    label: 'Data da Análise', date: true },
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

const CORES_GRUPO = [
  'bg-orange-100 text-orange-700 border-orange-300',
  'bg-purple-100 text-purple-700 border-purple-300',
  'bg-teal-100 text-teal-700 border-teal-300',
  'bg-rose-100 text-rose-700 border-rose-300',
  'bg-blue-100 text-blue-700 border-blue-300',
  'bg-amber-100 text-amber-700 border-amber-300',
];

function getCorGrupo(nomeArquivo, arquivosUnicos) {
  const idx = arquivosUnicos.indexOf(nomeArquivo);
  return idx >= 0 ? CORES_GRUPO[idx % CORES_GRUPO.length] : '';
}

const buildPrompt2040 = (textoPDF) => `
Extraia os dados desta análise de solo na profundidade 20-40 cm e retorne APENAS um objeto JSON válido, sem texto adicional, sem markdown.

Primeiro identifique o laboratório:
- COOXUPE: contém "Cooxupé" ou "Cooperativa Regional de Cafeicultores em Guaxupé"
- LAB_VICOSA: contém "labsolosvicosa" ou "Laboratório de Análise de Solo Viçosa"
- OUTRO: qualquer outro

NÃO converta unidades. Procure especificamente a seção 20-40 cm ou segunda profundidade do laudo.

Retorne um objeto com os campos:
- laboratorio, ph, potassio, calcio, magnesio, aluminio, fosforo, ctc, saturacao_bases, h_al, sb, data_analise

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
            <Users className="w-4 h-4 text-orange-500" />
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
function EtapaAssociacao({ talhoes, pares, setPares, onSemPDF, onConfirmar, onClose }) {
  const fileRef = useRef();
  const [arquivos, setArquivos] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [popoverAberto, setPopoverAberto] = useState(null);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setArquivos(files);
    setPares(parearPorNome(files, talhoes));
    e.target.value = '';
  };

  // DnD: COPIA o arquivo para o destino
  const handleDragStart = (e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'copy'; };
  const handleDragOver = (e, idx) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(idx); };
  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOver(null); return; }
    const arqOrigem = pares[dragIdx]?.arquivo;
    if (!arqOrigem) { setDragIdx(null); setDragOver(null); return; }
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
    setPares(prev => prev.map((p) => idsTalhoes.includes(p.talhao.id) ? { ...p, arquivo: arq } : p));
  };

  const arquivosUsados = [...new Set(pares.filter(p => p.arquivo).map(p => p.arquivo.name))];
  const contagemPorArquivo = {};
  pares.forEach(p => { if (p.arquivo) contagemPorArquivo[p.arquivo.name] = (contagemPorArquivo[p.arquivo.name] || 0) + 1; });

  const podeContinuarComPDF = pares.length > 0 && pares.every(p => p.arquivo);

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-800">
        <p className="font-semibold mb-1">Análise 20-40 cm — duas opções:</p>
        <p>• <strong>Com PDF:</strong> selecione arquivos. <strong>Arraste</strong> para compartilhar um PDF com vários talhões, ou use <Users className="inline w-3 h-3" /> para marcar múltiplos.</p>
        <p>• <strong>Sem PDF:</strong> preencha manualmente.</p>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <input ref={fileRef} type="file" accept="application/pdf" multiple className="hidden" onChange={handleFiles} />
          <Button variant="outline" className="gap-2 border-dashed border-orange-400 text-orange-700 hover:bg-orange-50 w-full"
            onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4" />
            {arquivos.length > 0 ? `${arquivos.length} arquivo(s) — clique para trocar` : 'Selecionar PDFs (opcional)'}
          </Button>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs whitespace-nowrap" onClick={onSemPDF}>
          Preencher manualmente
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
                  ${dragOver === idx ? 'bg-orange-50 border-orange-300' : dragIdx === idx ? 'opacity-60' : idx % 2 === 0 ? 'bg-background' : 'bg-muted/5'}`}
              >
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40" />

                <div className="flex items-center gap-1.5 min-w-0">
                  {compartilhado && (
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${corGrupo}`}>
                      ×{contagemPorArquivo[par.arquivo.name]}
                    </span>
                  )}
                  <FileText className="w-3.5 h-3.5 text-orange-500 shrink-0" />
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

                <div className="flex items-center gap-1.5 min-w-0">
                  {compartilhado && (
                    <span className={`shrink-0 inline-block w-2 h-2 rounded-full border-2 ${corGrupo.split(' ')[0]}`} />
                  )}
                  <span className="text-xs font-medium truncate">{par.talhao.nome}</span>
                </div>

                <div className="relative justify-self-end">
                  {par.arquivo && (
                    <button
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-orange-100 text-orange-500 hover:text-orange-700 transition-colors"
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
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" disabled={!podeContinuarComPDF} onClick={() => onConfirmar(pares)}
          className="gap-2 bg-orange-600 hover:bg-orange-700 text-white">
          <CheckCircle2 className="w-4 h-4" />
          Confirmar e Extrair
        </Button>
      </DialogFooter>
    </div>
  );
}

// ── Etapa 2: Processando ──────────────────────────────────────────────────────
function EtapaProcessando({ total, atual }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4 text-muted-foreground">
      <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
      <p className="text-sm font-medium">Extraindo dados 20-40 cm com IA…</p>
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
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-800">
        Confira e edite os dados. Talhões com o mesmo PDF têm os mesmos valores iniciais — edite individualmente se necessário.
      </div>
      {itens.map((item, idx) => (
        <div key={item.talhao.id} className="border border-border rounded-xl overflow-hidden">
          <div className="bg-muted/20 px-4 py-2.5 border-b border-border flex items-center gap-2 flex-wrap">
            <Mountain className="w-3.5 h-3.5 text-orange-600" />
            <span className="text-xs font-semibold">{item.talhao.nome}</span>
            {item.arquivoNome && <span className="text-xs text-muted-foreground">← {item.arquivoNome}</span>}
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CAMPOS_2040.map(c => (
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
          Salvar {itens.length} análise(s) 20-40 cm
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
        {ok} talhão(ões) salvos com sucesso{err > 0 ? `, ${err} com erro` : ''}.
      </div>
      <div className="border border-border rounded-xl overflow-hidden">
        {resultados.map((r, i) => (
          <div key={r.talhao.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/5'}`}>
            {r.status === 'ok' ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
            <span className="text-xs font-medium flex-1">{r.talhao.nome}</span>
            <span className={`text-xs font-medium ${r.status === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
              {r.status === 'ok' ? 'Salvo' : 'Erro'}
            </span>
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
export default function ImportarAgrupado2040({ talhoes, analises2040Existentes, onSalvar2040, onClose }) {
  const [etapa, setEtapa] = useState('associacao');
  const [pares, setPares] = useState([]);
  const [itens, setItens] = useState([]);
  const [progresso, setProgresso] = useState(0);
  const [resultados, setResultados] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const handleSemPDF = useCallback(() => {
    setItens(talhoes.map(talhao => ({
      talhao, arquivoNome: '',
      dados: analises2040Existentes?.[talhao.id] || {},
      laboratorio: 'OUTRO',
    })));
    setEtapa('revisao');
  }, [talhoes, analises2040Existentes]);

  const handleConfirmar = useCallback(async (paresConfirmados) => {
    setEtapa('processando');
    setProgresso(0);

    // Cache: cada PDF único é processado uma única vez
    const cacheExtracao = {};
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
        } catch (_) {}
        const resposta = await base44.integrations.Core.InvokeLLM({
          prompt: buildPrompt2040(textoPDF || 'Leia os dados da profundidade 20-40cm diretamente do PDF.'),
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
      } catch (_) {}
      cacheExtracao[par.arquivo.name] = { dados: dadosExtraidos, laboratorio };
      processados++;
      setProgresso(processados);
    }

    // Cada talhão recebe cópia própria
    const itensPorcessados = paresConfirmados.map(par => ({
      talhao: par.talhao,
      arquivoNome: par.arquivo?.name || '',
      dados: par.arquivo ? { ...(cacheExtracao[par.arquivo.name]?.dados || {}) } : (analises2040Existentes?.[par.talhao.id] || {}),
      laboratorio: par.arquivo ? (cacheExtracao[par.arquivo.name]?.laboratorio || 'OUTRO') : 'OUTRO',
    }));

    setItens(itensPorcessados);
    setEtapa('revisao');
  }, [analises2040Existentes]);

  const handleSalvar = useCallback(async () => {
    setSalvando(true);
    const res = [];
    for (const item of itens) {
      try {
        await onSalvar2040(item.talhao, item.dados);
        res.push({ talhao: item.talhao, status: 'ok' });
      } catch {
        res.push({ talhao: item.talhao, status: 'erro' });
      }
    }
    setResultados(res);
    setSalvando(false);
    setEtapa('resumo');
  }, [itens, onSalvar2040]);

  const titulo = {
    associacao: 'Associar PDFs → Talhões',
    processando: 'Extraindo dados com IA…',
    revisao: 'Revisar / Preencher dados',
    resumo: 'Resumo da importação',
  }[etapa];

  const totalUnicos = [...new Set(pares.filter(p => p.arquivo).map(p => p.arquivo.name))].length;

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1.5 bg-orange-100 text-orange-800 rounded-lg px-2.5 py-1">
              <Mountain className="w-3.5 h-3.5" />
              <span className="font-bold text-xs">Análise 20-40 cm</span>
            </div>
            {titulo} — {talhoes.length} talhão(ões)
          </DialogTitle>
        </DialogHeader>
        {etapa === 'associacao' && <EtapaAssociacao talhoes={talhoes} pares={pares} setPares={setPares} onSemPDF={handleSemPDF} onConfirmar={handleConfirmar} onClose={onClose} />}
        {etapa === 'processando' && <EtapaProcessando total={totalUnicos} atual={progresso} />}
        {etapa === 'revisao' && <EtapaRevisao itens={itens} setItens={setItens} onSalvar={handleSalvar} salvando={salvando} />}
        {etapa === 'resumo' && <EtapaResumo resultados={resultados} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}