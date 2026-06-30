import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2, CheckCircle2, AlertTriangle, GripVertical, FileText, ArrowRight, XCircle, Layers } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// ── Campos 0-20 cm ────────────────────────────────────────────────────────────
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

// Heurística: tenta parear arquivo com talhão pelo nome
function parearPorNome(arquivos, talhoes) {
  const pares = talhoes.map((talhao, idx) => {
    const nomeNorm = talhao.nome.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Tenta achar arquivo cujo nome contém parte do nome do talhão
    const match = arquivos.find(arq => {
      const arquivoNorm = arq.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return arquivoNorm.includes(nomeNorm.slice(0, 4)) || nomeNorm.includes(arquivoNorm.replace('.pdf', '').slice(0, 4));
    });
    return { talhao, arquivo: match || arquivos[idx] || null };
  });
  return pares;
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

// ── Etapa 1: Seleção e prévia de associação ────────────────────────────────────
function EtapaAssociacao({ talhoes, pares, setPares, onConfirmar, onClose }) {
  const fileRef = useRef();
  const [arquivos, setArquivos] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setArquivos(files);
    const novoPares = parearPorNome(files, talhoes);
    setPares(novoPares);
    e.target.value = '';
  };

  // Drag and drop entre linhas
  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOver(idx); };
  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOver(null); return; }
    setPares(prev => {
      const novo = [...prev];
      // Troca os arquivos entre as duas posições
      const tmp = novo[dragIdx].arquivo;
      novo[dragIdx] = { ...novo[dragIdx], arquivo: novo[idx].arquivo };
      novo[idx] = { ...novo[idx], arquivo: tmp };
      return novo;
    });
    setDragIdx(null);
    setDragOver(null);
  };

  const trocarArquivo = (talhaoIdx, nomeArquivo) => {
    const arqSelecionado = arquivos.find(a => a.name === nomeArquivo) || null;
    setPares(prev => prev.map((p, i) => i === talhaoIdx ? { ...p, arquivo: arqSelecionado } : p));
  };

  const podeContinuar = pares.length > 0 && pares.every(p => p.arquivo);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
        <p className="font-semibold mb-1">Como funciona:</p>
        <p>1. Selecione os PDFs de análise (um por talhão). A associação é feita automaticamente pelo nome do arquivo.</p>
        <p>2. Revise a associação abaixo. Arraste as linhas para reordenar ou use o dropdown para trocar o arquivo de cada talhão.</p>
        <p>3. Clique em "Confirmar e Importar" para processar.</p>
      </div>

      <div>
        <input ref={fileRef} type="file" accept="application/pdf" multiple className="hidden" onChange={handleFiles} />
        <Button variant="outline" className="gap-2 border-dashed border-blue-400 text-blue-700 hover:bg-blue-50 w-full"
          onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4" />
          {arquivos.length > 0 ? `${arquivos.length} arquivo(s) selecionado(s) — clique para trocar` : 'Selecionar PDFs de análise 0-20 cm'}
        </Button>
      </div>

      {pares.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="bg-muted/20 px-3 py-2 border-b border-border grid grid-cols-[24px_1fr_24px_1fr] gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span></span>
            <span>Arquivo PDF</span>
            <span></span>
            <span>Talhão de destino</span>
          </div>
          {pares.map((par, idx) => (
            <div
              key={par.talhao.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={() => { setDragIdx(null); setDragOver(null); }}
              className={`grid grid-cols-[24px_1fr_24px_1fr] gap-2 items-center px-3 py-2.5 border-b border-border/50 last:border-0 transition-colors cursor-grab active:cursor-grabbing
                ${dragOver === idx ? 'bg-blue-50 border-blue-300' : idx % 2 === 0 ? 'bg-background' : 'bg-muted/5'}`}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground/40" />
              <div className="flex items-center gap-1.5 min-w-0">
                <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                {arquivos.length > 1 ? (
                  <Select value={par.arquivo?.name || ''} onValueChange={v => trocarArquivo(idx, v)}>
                    <SelectTrigger className="h-7 text-xs border-dashed">
                      <SelectValue placeholder="— sem arquivo —" />
                    </SelectTrigger>
                    <SelectContent>
                      {arquivos.map(a => (
                        <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs truncate">{par.arquivo?.name || <span className="text-muted-foreground italic">sem arquivo</span>}</span>
                )}
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 justify-self-center" />
              <span className="text-xs font-medium text-foreground truncate">{par.talhao.nome}</span>
            </div>
          ))}
        </div>
      )}

      <DialogFooter className="gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" disabled={!podeContinuar} onClick={() => onConfirmar(pares)}
          className="gap-2 bg-green-700 hover:bg-green-800 text-white">
          <CheckCircle2 className="w-4 h-4" />
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
      <p className="text-xs">{atual} de {total} arquivo(s) processados</p>
    </div>
  );
}

// ── Etapa 3: Revisão dos dados extraídos ─────────────────────────────────────
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
        Confira os dados extraídos abaixo. Corrija qualquer campo necessário antes de salvar.
      </div>
      {itens.map((item, idx) => (
        <div key={item.talhao.id} className="border border-border rounded-xl overflow-hidden">
          <div className="bg-muted/20 px-4 py-2.5 border-b border-border flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-foreground">{item.talhao.nome}</span>
            <span className="text-xs text-muted-foreground ml-1">← {item.arquivoNome}</span>
            <span className="ml-auto text-xs text-muted-foreground">Lab: {item.laboratorio}</span>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CAMPOS_0_20.map(c => (
              <div key={c.key}>
                <Label className="text-xs mb-0.5 block text-muted-foreground">{c.label}</Label>
                <Input
                  type={c.date ? 'date' : 'number'}
                  step={c.date ? undefined : '0.001'}
                  value={item.dados[c.key] ?? ''}
                  onChange={e => updateDado(idx, c.key, c.date ? e.target.value : toNum(e.target.value))}
                  className="h-7 text-xs"
                />
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

// ── Etapa 4: Resumo final ─────────────────────────────────────────────────────
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
          <div key={r.talhao.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/5'}`}>
            {r.status === 'ok'
              ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{r.talhao.nome}</p>
              <p className="text-xs text-muted-foreground truncate">{r.arquivoNome}</p>
            </div>
            <span className={`text-xs font-medium ${r.status === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
              {r.status === 'ok' ? 'Sucesso' : 'Erro'}
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
export default function ImportarAgrupado020({ talhoes, onImportarAnalise, onClose }) {
  const [etapa, setEtapa] = useState('associacao'); // associacao | processando | revisao | resumo
  const [pares, setPares] = useState([]);
  const [itens, setItens] = useState([]);
  const [progresso, setProgresso] = useState(0);
  const [resultados, setResultados] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const handleConfirmar = useCallback(async (paresConfirmados) => {
    setEtapa('processando');
    setProgresso(0);
    const itensPorcessados = [];

    for (let i = 0; i < paresConfirmados.length; i++) {
      const par = paresConfirmados[i];
      setProgresso(i);
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
          if (extracao?.status === 'success' && extracao?.output?.texto_completo) {
            textoPDF = extracao.output.texto_completo;
          }
        } catch (_) {}

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
      } catch (_) {}

      itensPorcessados.push({
        talhao: par.talhao,
        arquivo: par.arquivo,
        arquivoNome: par.arquivo?.name || '',
        dados: dadosExtraidos,
        laboratorio,
      });
    }

    setProgresso(paresConfirmados.length);
    setItens(itensPorcessados);
    setEtapa('revisao');
  }, []);

  const handleSalvar = useCallback(async () => {
    setSalvando(true);
    const itensList = itens.map(item => ({
      talhao: item.talhao,
      dados: { ...item.dados, laboratorio_origem: item.laboratorio },
      laboratorio: item.laboratorio,
    }));
    // Chama onImportarAnalise que retorna resultados individuais
    const res = [];
    for (const item of itensList) {
      try {
        await onImportarAnalise([item]);
        res.push({ talhao: item.talhao, arquivoNome: item.talhao.nome, status: 'ok' });
      } catch {
        res.push({ talhao: item.talhao, arquivoNome: item.talhao.nome, status: 'erro' });
      }
    }
    // Reconstrói com nomes reais dos arquivos
    const resComNome = res.map((r, i) => ({ ...r, arquivoNome: itens[i]?.arquivoNome || r.arquivoNome }));
    setResultados(resComNome);
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

        {etapa === 'associacao' && (
          <EtapaAssociacao
            talhoes={talhoes}
            pares={pares}
            setPares={setPares}
            onConfirmar={handleConfirmar}
            onClose={onClose}
          />
        )}
        {etapa === 'processando' && (
          <EtapaProcessando total={pares.length} atual={progresso} />
        )}
        {etapa === 'revisao' && (
          <EtapaRevisao itens={itens} setItens={setItens} onSalvar={handleSalvar} salvando={salvando} />
        )}
        {etapa === 'resumo' && (
          <EtapaResumo resultados={resultados} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}