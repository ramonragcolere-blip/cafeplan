import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

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

const buildPrompt = (textoPDF) => `
Você é um especialista em análise de solos agrícolas brasileiro.
Extraia TODOS os dados do laudo abaixo com máxima precisão.
NÃO converta unidades — retorne os valores EXATAMENTE como aparecem no laudo.

=== TEXTO DO PDF ===
${textoPDF}
=== FIM ===

PASSO 1 — IDENTIFIQUE O LABORATÓRIO:
- COOXUPE: contém "Cooxupé" ou "Cooperativa Regional de Cafeicultores em Guaxupé"
- LAB_VICOSA: contém "labsolosvicosa" ou "Laboratório de Análise de Solo Viçosa"
- OUTRO: qualquer outro

PASSO 2 — LOCALIZE os campos pelos RÓTULOS exatos do laudo:
- pH: rótulo "pH CaCl2" ou "pH"
- materia_organica: rótulo "M.O." em g/dm³
- fosforo: rótulo "P" em mg/dm³
- potassio: rótulo "K"
- calcio: rótulo "Ca"
- magnesio: rótulo "Mg"
- aluminio: rótulo "Al" ou "Al³⁺"
- h_al: rótulo "H+Al" ou "H + Al"
- sb: rótulo "S.B." ou "SB"
- ctc: rótulo "C.T.C." ou "CTC"
- saturacao_bases: rótulo "V%"
- enxofre: rótulo "S" em mg/dm³
- boro: rótulo "B" em mg/dm³
- zinco: rótulo "Zn" em mg/dm³
- cobre: rótulo "Cu" em mg/dm³
- manganes: rótulo "Mn" em mg/dm³
- ferro: rótulo "Fe" em mg/dm³

PASSO 3 — Se houver múltiplas camadas (0-20 e 20-40), retorne apenas a camada 0-20.
PASSO 4 — Campos não encontrados → null. SEMPRE retorne o JSON.

Retorne SOMENTE JSON válido:
{
  "laboratorio": "OUTRO",
  "dados": {
    "ph": null, "materia_organica": null, "fosforo": null, "potassio": null,
    "calcio": null, "magnesio": null, "aluminio": null, "h_al": null,
    "sb": null, "ctc": null, "saturacao_bases": null, "enxofre": null,
    "boro": null, "zinco": null, "cobre": null, "manganes": null,
    "ferro": null, "data_analise": null
  }
}`;

export default function ImportarPDFTalhao({ talhao, safra, analises, analises2040, onImportarAnalise, talhoes }) {
  const fileRef = useRef();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [dados, setDados] = useState(null);
  const [laboratorio, setLaboratorio] = useState('OUTRO');
  const [salvo, setSalvo] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    setDados(null);
    setSalvo(false);
    setOpen(true);
    setLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
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
        const m = resposta.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : null;
      }

      if (parsed?.dados) {
        const convertido = converterUnidades(parsed.dados, parsed.laboratorio || 'OUTRO');
        setDados(convertido);
        setLaboratorio(parsed.laboratorio || 'OUTRO');
      } else {
        setDados({});
        setErro('Não foi possível extrair dados automaticamente. Preencha manualmente.');
      }
    } catch (err) {
      setDados({});
      setErro(`Erro ao processar PDF: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleSalvar = async () => {
    await onImportarAnalise(talhao, { ...dados, laboratorio_origem: laboratorio });
    setSalvo(true);
    setTimeout(() => setOpen(false), 1200);
  };

  const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;

  return (
    <>
      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs border-dashed border-green-400 text-green-700 hover:bg-green-50 h-7"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="w-3 h-3" />
        Importar PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Upload className="w-4 h-4 text-green-700" />
              Importar Análise de Solo — {talhao.nome}
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Lendo PDF e extraindo dados com IA…</p>
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{erro}</p>
            </div>
          )}

          {dados && !loading && !salvo && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Laborátório detectado: <strong>{laboratorio}</strong>. Confira os valores e salve.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CAMPOS_0_20.map(c => (
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
              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={handleSalvar} className="gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar e salvar
                </Button>
              </div>
            </div>
          )}

          {salvo && (
            <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
              <CheckCircle2 className="w-5 h-5" />
              Análise salva com sucesso!
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}