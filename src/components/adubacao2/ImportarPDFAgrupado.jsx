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

const buildPromptMultiplo = (textoPDF, numTalhoes) => `
Você é um especialista em análise de solos agrícolas brasileiro.
O PDF contém ${numTalhoes} análise(s) de solo. Extraia TODOS os dados de cada análise.
NÃO converta unidades — retorne os valores EXATAMENTE como aparecem no laudo.

Primeiro identifique o laboratório:
- COOXUPE: contém "Cooxupé" ou "Cooperativa Regional de Cafeicultores em Guaxupé"
- LAB_VICOSA: contém "labsolosvicosa" ou "Laboratório de Análise de Solo Viçosa"
- OUTRO: qualquer outro

Retorne APENAS um array JSON válido, sem texto adicional, sem markdown, sem blocos de código. Cada objeto representa uma análise de solo encontrada no PDF, na ordem em que aparecem no documento, com os campos: pH, MO, P, K, Ca, Mg, S, B, Cu, Fe, Mn, Zn, V, CTC, H_Al

O formato exato deve ser:
[
  {
    "laboratorio": "OUTRO",
    "ph": null, "materia_organica": null, "fosforo": null, "potassio": null,
    "calcio": null, "magnesio": null, "aluminio": null, "h_al": null,
    "sb": null, "ctc": null, "saturacao_bases": null, "enxofre": null,
    "boro": null, "zinco": null, "cobre": null, "manganes": null,
    "ferro": null, "data_analise": null
  }
]

=== TEXTO DO PDF ===
${textoPDF}
=== FIM ===`;

export default function ImportarPDFAgrupado({ talhoes, safra, analises, onImportarAnalise, onClose }) {
  const fileRef = useRef();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  // analisesPorTalhao: array de objetos { talhao, dados, laboratorio }
  const [analisesPorTalhao, setAnalisesPorTalhao] = useState(null);
  const [salvo, setSalvo] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    setAviso(null);
    setAnalisesPorTalhao(null);
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
        prompt: buildPromptMultiplo(textoPDF || 'Leia os dados diretamente do arquivo PDF anexo.', talhoes.length),
        file_urls: [file_url],
        model: 'claude_sonnet_4_6',
      });

      // Limpeza do JSON antes de parsear
      let raw = typeof resposta === 'string' ? resposta : JSON.stringify(resposta);
      const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(clean);
      } catch (_) {
        // Tenta extrair array JSON da string
        const m = clean.match(/\[[\s\S]*\]/);
        if (m) parsed = JSON.parse(m[0]);
        else parsed = null;
      }

      // Normaliza: aceita array ou objeto único
      let listaAnalises = [];
      if (Array.isArray(parsed)) {
        listaAnalises = parsed;
      } else if (parsed?.dados) {
        // formato antigo { laboratorio, dados }
        listaAnalises = [{ ...parsed.dados, laboratorio: parsed.laboratorio || 'OUTRO' }];
      } else if (parsed && typeof parsed === 'object') {
        listaAnalises = [parsed];
      }

      if (listaAnalises.length === 0) {
        setErro('Não foi possível extrair dados automaticamente. Preencha manualmente.');
        setAnalisesPorTalhao(talhoes.map(t => ({ talhao: t, dados: {}, laboratorio: 'OUTRO' })));
        setLoading(false);
        e.target.value = '';
        return;
      }

      // Aviso se contagens divergem
      if (listaAnalises.length !== talhoes.length) {
        setAviso(`PDF contém ${listaAnalises.length} análise(s) mas ${talhoes.length} talhão(ões) foram selecionados. Associando pela ordem.`);
      }

      // Associa pela ordem: 1ª análise → 1º talhão, etc.
      const associadas = talhoes.map((talhao, idx) => {
        const analise = listaAnalises[idx] || {};
        const lab = analise.laboratorio || listaAnalises[0]?.laboratorio || 'OUTRO';
        const { laboratorio: _l, ...dadosBrutos } = analise;
        return {
          talhao,
          dados: converterUnidades(dadosBrutos, lab),
          laboratorio: lab,
        };
      });

      setAnalisesPorTalhao(associadas);
    } catch (err) {
      setErro(`Erro ao processar PDF: ${err?.message || String(err)}`);
      setAnalisesPorTalhao(talhoes.map(t => ({ talhao: t, dados: {}, laboratorio: 'OUTRO' })));
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleSalvar = async () => {
    for (const item of analisesPorTalhao) {
      await onImportarAnalise({ ...item.dados, laboratorio_origem: item.laboratorio }, item.talhao);
    }
    setSalvo(true);
  };

  const updateDado = (talhaoIdx, key, value) => {
    setAnalisesPorTalhao(prev =>
      prev.map((item, i) =>
        i === talhaoIdx ? { ...item, dados: { ...item.dados, [key]: value } } : item
      )
    );
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
          {talhoes.map((t, i) => (
            <span key={t.id} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
              {i + 1}. {t.nome}
            </span>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          Cada análise do PDF será associada ao talhão correspondente pela ordem acima.
        </p>

        {!analisesPorTalhao && !loading && (
          <>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
            <Button
              variant="outline"
              className="gap-2 border-dashed border-blue-400 text-blue-700 hover:bg-blue-50 w-full"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              Selecionar PDF com análises
            </Button>
          </>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">Lendo PDF e extraindo dados com IA…</p>
          </div>
        )}

        {aviso && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{aviso}</p>
          </div>
        )}

        {erro && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{erro}</p>
          </div>
        )}

        {analisesPorTalhao && !loading && !salvo && (
          <div className="space-y-6">
            {analisesPorTalhao.map((item, idx) => (
              <div key={item.talhao.id} className="border border-border rounded-xl p-4">
                <p className="text-xs font-semibold text-primary mb-3">
                  {idx + 1}. {item.talhao.nome}
                  <span className="ml-2 font-normal text-muted-foreground">— Lab: {item.laboratorio}</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CAMPOS_0_20.map(c => (
                    <div key={c.key}>
                      <Label className="text-xs mb-0.5 block text-muted-foreground">{c.label}</Label>
                      <Input
                        type={c.date ? 'date' : 'number'}
                        step={c.date ? undefined : '0.001'}
                        value={item.dados[c.key] ?? ''}
                        onChange={e =>
                          updateDado(idx, c.key, c.date ? e.target.value : toNum(e.target.value))
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={handleSalvar} className="gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Salvar {analisesPorTalhao.length} análise(s)
              </Button>
            </div>
          </div>
        )}

        {salvo && (
          <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
            <CheckCircle2 className="w-5 h-5" />
            Análise(s) aplicada(s) com sucesso a {talhoes.length} talhão(ões)!
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}