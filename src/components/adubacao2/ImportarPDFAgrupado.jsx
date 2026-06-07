import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Upload, Loader2, CheckCircle2, AlertTriangle, Link2 } from 'lucide-react';
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

PASSO 2 — Extraia os valores da camada 0-20 cm.
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

export default function ImportarPDFAgrupado({ talhoes, safra, analises, onImportarAnalise, onClose }) {
  const fileRef = useRef();
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
        setDados(converterUnidades(parsed.dados, parsed.laboratorio || 'OUTRO'));
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
    await onImportarAnalise({ ...dados, laboratorio_origem: laboratorio });
    setSalvo(true);
  };

  const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Link2 className="w-4 h-4 text-blue-600" />
            Importar análise agrupada para {talhoes.length} talhão(ões)
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1 mb-2">
          {talhoes.map(t => (
            <span key={t.id} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
              {t.nome}
            </span>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          A mesma análise será aplicada a todos os talhões selecionados.
        </p>

        {!dados && !loading && (
          <>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
            <Button
              variant="outline"
              className="gap-2 border-dashed border-blue-400 text-blue-700 hover:bg-blue-50 w-full"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              Selecionar PDF para todos os talhões
            </Button>
          </>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
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
              Laborátório detectado: <strong>{laboratorio}</strong>. Confira os valores e aplique a todos os talhões.
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
                Aplicar a todos os {talhoes.length} talhões
              </Button>
            </div>
          </div>
        )}

        {salvo && (
          <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
            <CheckCircle2 className="w-5 h-5" />
            Análise aplicada com sucesso a {talhoes.length} talhão(ões)!
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}