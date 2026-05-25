import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2, FlaskConical, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// Campos específicos da camada 20-40 cm
const CAMPOS_2040 = [
  { key: 'materia_organica', label: 'M.O. (g/dm³)',       type: 'number', step: '0.01'  },
  { key: 'fosforo',          label: 'P (mg/dm³)',          type: 'number', step: '0.01'  },
  { key: 'potassio',         label: 'K (mmolc/dm³)',       type: 'number', step: '0.01'  },
  { key: 'calcio',           label: 'Ca (mmolc/dm³)',      type: 'number', step: '0.01'  },
  { key: 'magnesio',         label: 'Mg (mmolc/dm³)',      type: 'number', step: '0.01'  },
  { key: 'boro',             label: 'B (mg/dm³)',          type: 'number', step: '0.001' },
  { key: 'zinco',            label: 'Zn (mg/dm³)',         type: 'number', step: '0.01'  },
  { key: 'ferro',            label: 'Fe (mg/dm³)',         type: 'number', step: '0.01'  },
  { key: 'manganes',         label: 'Mn (mg/dm³)',         type: 'number', step: '0.01'  },
  { key: 'cobre',            label: 'Cu (mg/dm³)',         type: 'number', step: '0.01'  },
];

const empty2040 = () => CAMPOS_2040.reduce((acc, c) => ({ ...acc, [c.key]: '' }), { observacoes: '' });

// Converte objeto de dados (números) para estado do form (strings para inputs controlados)
const toFormState = (src) => {
  const base = empty2040();
  Object.keys(base).forEach(k => {
    const v = src[k];
    base[k] = (v !== null && v !== undefined && v !== '') ? String(v) : '';
  });
  return base;
};

// ── Mini-importador PDF exclusivo para camada 20-40 cm ──────────────────────
function BotaoImportar2040({ onImportado }) {
  const fileRef = useRef();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [campos, setCampos] = useState({});

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setErro(null);
    setCampos({});
    setOpen(true);
    setLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      let textoPDF = '';
      try {
        const ext = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: { type: 'object', properties: { texto_completo: { type: 'string' } } },
        });
        if (ext?.status === 'success' && ext?.output?.texto_completo) {
          textoPDF = ext.output.texto_completo;
        }
      } catch (_) {}

      const prompt = `Você é especialista em análise de solos brasileiros.
Extraia SOMENTE os dados da camada 20-40 cm do texto abaixo.
Se houver múltiplas camadas, retorne apenas os valores da camada 20-40 cm.

Texto: ${textoPDF || '[não extraído]'}

Retorne SOMENTE o JSON com os valores numéricos (null para campos não encontrados):
{
  "materia_organica": null,
  "fosforo": null,
  "potassio": null,
  "calcio": null,
  "magnesio": null,
  "boro": null,
  "zinco": null,
  "ferro": null,
  "manganes": null,
  "cobre": null
}`;

      const resp = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: textoPDF ? undefined : [file_url],
        model: 'claude_sonnet_4_6',
        response_json_schema: {
          type: 'object',
          properties: {
            materia_organica: { type: 'number' },
            fosforo:          { type: 'number' },
            potassio:         { type: 'number' },
            calcio:           { type: 'number' },
            magnesio:         { type: 'number' },
            boro:             { type: 'number' },
            zinco:            { type: 'number' },
            ferro:            { type: 'number' },
            manganes:         { type: 'number' },
            cobre:            { type: 'number' },
          },
        },
      });

      // Normaliza null → '' para inputs controlados
      const norm = {};
      Object.entries(resp || {}).forEach(([k, v]) => { norm[k] = v != null ? String(v) : ''; });
      setCampos(norm);
    } catch (err) {
      setErro(`Erro ao processar PDF: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = () => {
    // Converte strings dos inputs para números antes de repassar ao form
    const data = {};
    CAMPOS_2040.forEach(({ key }) => {
      const v = campos[key];
      data[key] = (v !== '' && v != null && !isNaN(Number(v))) ? Number(v) : undefined;
    });
    onImportado(data);
    setOpen(false);
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 border-dashed border-blue-400 text-blue-700 hover:bg-blue-50"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="w-4 h-4" />
        Importar PDF 20–40 cm
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-blue-700" />
              Importar Análise — Camada 20–40 cm
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm">Extraindo dados do PDF…</p>
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{erro}</p>
            </div>
          )}

          {!loading && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Confira os valores extraídos e edite se necessário antes de confirmar.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CAMPOS_2040.map(c => (
                  <div key={c.key}>
                    <Label className="text-xs mb-0.5 block text-muted-foreground">{c.label}</Label>
                    <Input
                      type="number"
                      step={c.step}
                      value={campos[c.key] ?? ''}
                      onChange={e => setCampos(prev => ({ ...prev, [c.key]: e.target.value }))}
                      className="h-7 text-xs"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSalvar} className="gap-2 bg-blue-700 hover:bg-blue-800 text-white">
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar e preencher campos
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Formulário principal — Camada 20-40 cm ───────────────────────────────────
export default function AnaliseSolo2040Form({ dados, onSave, saving }) {
  const [form2040, setForm2040] = useState(empty2040());
  const [semAnalise, setSemAnalise] = useState(false);

  // Carrega dados ao trocar de talhão/safra/produtor — mesma lógica do 0-20 cm
  useEffect(() => {
    if (dados) {
      setSemAnalise(dados.sem_analise_2040 === true);
      setForm2040(toFormState(dados));
    } else {
      setSemAnalise(false);
      setForm2040(empty2040());
    }
  }, [dados?.id, dados?.talhao_id, dados?.safra, dados?.codigo_produtor]);

  const set2040 = (k, v) => setForm2040(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (semAnalise) {
      onSave({ sem_analise_2040: true });
      return;
    }
    const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;
    const data = { sem_analise_2040: false };
    CAMPOS_2040.forEach(c => { data[c.key] = toNum(form2040[c.key]); });
    data.observacoes = form2040.observacoes;
    onSave(data);
  };

  // Chamado pelo importador: preenche diretamente o estado form2040
  const handleImportado = (dadosImportados) => {
    setSemAnalise(false);
    setForm2040(toFormState(dadosImportados));
  };

  return (
    <div className="bg-card border-2 border-blue-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-3 bg-blue-50 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-blue-700" />
          <span className="font-semibold text-sm text-blue-800">Análise de Solo — Camada 20–40 cm</span>
        </div>
        <BotaoImportar2040 onImportado={handleImportado} />
      </div>

      <div className="px-5 pt-4 pb-2 flex items-center gap-2">
        <input
          type="checkbox"
          id="sem_analise_2040"
          checked={semAnalise}
          onChange={e => setSemAnalise(e.target.checked)}
          className="w-4 h-4 accent-amber-500 cursor-pointer"
        />
        <label htmlFor="sem_analise_2040" className="text-sm text-muted-foreground cursor-pointer select-none">
          Produtor não possui análise de solo 20–40 cm
        </label>
      </div>

      {!semAnalise && (
        <div className="px-5 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CAMPOS_2040.map(c => (
            <div key={c.key}>
              <Label className="text-xs mb-1 block">{c.label}</Label>
              <Input
                type={c.type}
                step={c.step}
                value={form2040[c.key] ?? ''}
                onChange={e => set2040(c.key, e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          ))}
          <div className="col-span-2 sm:col-span-4">
            <Label className="text-xs mb-1 block">Observações</Label>
            <Textarea
              value={form2040.observacoes || ''}
              onChange={e => set2040('observacoes', e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
        </div>
      )}

      <div className="px-5 pb-4 flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-blue-700 hover:bg-blue-800 text-white"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {semAnalise ? 'Salvar — Sem análise 20–40 cm' : 'Salvar Análise 20–40 cm'}
        </Button>
      </div>
    </div>
  );
}