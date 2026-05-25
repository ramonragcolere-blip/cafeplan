import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2, FlaskConical, ChevronDown, ChevronRight, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const CAMPOS = [
  { key: 'data_analise',     label: 'Data da Análise',         type: 'date'                   },
  { key: 'ph',               label: 'pH',                      type: 'number', step: '0.01'   },
  { key: 'materia_organica', label: 'M.O. (g/dm³)',            type: 'number', step: '0.01'   },
  { key: 'fosforo',          label: 'P (mg/dm³)',              type: 'number', step: '0.01'   },
  { key: 'potassio',         label: 'K (mmolc/dm³)',           type: 'number', step: '0.01'   },
  { key: 'calcio',           label: 'Ca (mmolc/dm³)',          type: 'number', step: '0.01'   },
  { key: 'magnesio',         label: 'Mg (mmolc/dm³)',          type: 'number', step: '0.01'   },
  { key: 'aluminio',         label: 'Al (cmolc/dm³)',          type: 'number', step: '0.01'   },
  { key: 'h_al',             label: 'H+Al (cmolc/dm³)',        type: 'number', step: '0.01'   },
  { key: 'sb',               label: 'SB (cmolc/dm³)',          type: 'number', step: '0.01'   },
  { key: 'ctc',              label: 'CTC (cmolc/dm³)',         type: 'number', step: '0.01'   },
  { key: 'saturacao_bases',  label: 'V% (Saturação de Bases)', type: 'number', step: '0.1'    },
  { key: 'boro',             label: 'B (mg/dm³)',              type: 'number', step: '0.001'  },
  { key: 'zinco',            label: 'Zn (mg/dm³)',             type: 'number', step: '0.01'   },
  { key: 'cobre',            label: 'Cu (mg/dm³)',             type: 'number', step: '0.01'   },
  { key: 'manganes',         label: 'Mn (mg/dm³)',             type: 'number', step: '0.01'   },
  { key: 'ferro',            label: 'Fe (mg/dm³)',             type: 'number', step: '0.01'   },
  { key: 'enxofre',          label: 'S (mg/dm³)',              type: 'number', step: '0.01'   },
];

const NUM_KEYS = new Set(CAMPOS.filter(c => c.type === 'number').map(c => c.key));
const empty = () => CAMPOS.reduce((acc, c) => ({ ...acc, [c.key]: '' }), { observacoes: '' });

// ── Mini importador dedicado à camada 20-40 ────────────────────────────────
function ImportarAnalise2040({ talhoes, safra, analises2040, onImportar }) {
  const fileRef = useRef();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [campos, setCampos] = useState({});
  const [talhaoId, setTalhaoId] = useState('');

  const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    setCampos({});
    setTalhaoId('');
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
        if (ext?.status === 'success' && ext?.output?.texto_completo) textoPDF = ext.output.texto_completo;
      } catch (_) {}

      const prompt = `Você é especialista em análise de solos. Extraia os dados da camada 20-40 cm do texto abaixo.
Se houver múltiplas camadas, retorne SOMENTE os dados da camada 20-40 cm.
Texto: ${textoPDF || '[não extraído]'}
Retorne SOMENTE o JSON com os campos numéricos (null se não encontrado):
{ "ph": null, "materia_organica": null, "fosforo": null, "potassio": null, "calcio": null, "magnesio": null,
  "aluminio": null, "h_al": null, "sb": null, "ctc": null, "saturacao_bases": null,
  "boro": null, "zinco": null, "cobre": null, "manganes": null, "ferro": null, "enxofre": null, "data_analise": null }`;

      const resp = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: textoPDF ? undefined : [file_url],
        model: 'claude_sonnet_4_6',
        response_json_schema: {
          type: 'object',
          properties: {
            ph: { type: 'number' }, materia_organica: { type: 'number' }, fosforo: { type: 'number' },
            potassio: { type: 'number' }, calcio: { type: 'number' }, magnesio: { type: 'number' },
            aluminio: { type: 'number' }, h_al: { type: 'number' }, sb: { type: 'number' },
            ctc: { type: 'number' }, saturacao_bases: { type: 'number' }, boro: { type: 'number' },
            zinco: { type: 'number' }, cobre: { type: 'number' }, manganes: { type: 'number' },
            ferro: { type: 'number' }, enxofre: { type: 'number' }, data_analise: { type: 'string' },
          },
        },
      });
      setCampos(resp || {});
    } catch (err) {
      setErro(`Erro ao processar PDF: ${err?.message || String(err)}`);
      setCampos({});
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleSalvar = () => {
    const talhao = talhoes.find(t => t.id === talhaoId);
    if (!talhao) return;
    const data = {};
    Object.entries(campos).forEach(([k, v]) => {
      if (k === 'data_analise') { data[k] = v || undefined; return; }
      data[k] = toNum(v);
    });
    onImportar(talhao, { ...data, sem_analise_2040: false });
    setOpen(false);
  };

  const jaExiste = talhaoId && safra
    ? (analises2040 || []).find(a => a.talhao_id === talhaoId && a.safra === safra)
    : null;

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
        Importar análise 20-40 cm (PDF)
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-blue-700" />
              Importar Análise de Solo — 20–40 cm
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
              {/* Seletor de talhão */}
              <div>
                <Label className="text-xs mb-1 block font-semibold">
                  Talhão <span className="text-destructive">*</span>
                </Label>
                <Select value={talhaoId || 'none'} onValueChange={v => setTalhaoId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Selecione o talhão…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione…</SelectItem>
                    {talhoes.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                {jaExiste && (
                  <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Já existe análise 20–40 cm para este talhão/safra. Salvar irá substituir.
                  </p>
                )}
              </div>

              {/* Campos editáveis */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Valores extraídos — edite se necessário
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CAMPOS.map(c => (
                    <div key={c.key}>
                      <Label className="text-xs mb-0.5 block text-muted-foreground">{c.label}</Label>
                      <Input
                        type={c.key === 'data_analise' ? 'date' : 'number'}
                        step={c.key === 'data_analise' ? undefined : '0.001'}
                        value={campos[c.key] ?? ''}
                        onChange={e => setCampos(prev => ({ ...prev, [c.key]: e.target.value }))}
                        className="h-7 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={handleSalvar} disabled={!talhaoId} className="gap-2 bg-blue-700 hover:bg-blue-800 text-white">
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar e salvar
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

// ─────────────────────────────────────────────────────────────────────────────

export default function AnaliseSolo2040Form({ dados, onSave, saving, talhoes, safra, analises2040, onImportar }) {
  const [aberto, setAberto] = useState(false);
  const [semAnalise, setSemAnalise] = useState(false);
  const [form, setForm] = useState(empty());

  // Sincroniza quando os dados externos chegarem (carregamento ou troca de talhão/safra)
  useEffect(() => {
    if (dados) {
      setSemAnalise(dados.sem_analise_2040 === true);
      setForm({ ...empty(), ...dados });
    } else {
      setSemAnalise(false);
      setForm(empty());
    }
  }, [dados?.id, dados?.talhao_id, dados?.safra, dados?.codigo_produtor]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (semAnalise) {
      // Salva apenas o flag, sem exigir campos
      onSave({ sem_analise_2040: true });
      return;
    }
    const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;
    const data = { ...form, sem_analise_2040: false };
    NUM_KEYS.forEach(k => { data[k] = toNum(form[k]); });
    onSave(data);
  };

  // Status resumido para o cabeçalho colapsado
  const statusBadge = dados?.sem_analise_2040
    ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Não possui</span>
    : dados
    ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Com dados</span>
    : <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">Não cadastrada</span>;

  return (
    <div className="bg-card border-2 border-blue-200 rounded-2xl overflow-hidden">

      {/* Cabeçalho recolhível */}
      <div className="flex items-center gap-2 px-5 py-3 bg-blue-50 border-b border-blue-200">
        <button
          type="button"
          className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity"
          onClick={() => setAberto(a => !a)}
        >
          <FlaskConical className="w-4 h-4 text-blue-700 shrink-0" />
          <span className="font-semibold text-sm text-blue-800 flex-1">
            Análise de Solo — Camada 20–40 cm
          </span>
          {statusBadge}
          {aberto
            ? <ChevronDown className="w-4 h-4 text-blue-600 shrink-0" />
            : <ChevronRight className="w-4 h-4 text-blue-600 shrink-0" />
          }
        </button>
        {onImportar && (
          <ImportarAnalise2040
            talhoes={talhoes || []}
            safra={safra}
            analises2040={analises2040}
            onImportar={onImportar}
          />
        )}
      </div>

      {/* Corpo expansível */}
      {aberto && (
        <>
          {/* Checkbox "não possui" */}
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

          {/* Campos — ocultos quando "não possui" */}
          {!semAnalise && (
            <div className="px-5 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CAMPOS.map(c => (
                <div key={c.key}>
                  <Label className="text-xs mb-1 block">{c.label}</Label>
                  <Input
                    type={c.type}
                    step={c.step}
                    value={form[c.key] ?? ''}
                    onChange={e => set(c.key, e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
              <div className="col-span-2 sm:col-span-4">
                <Label className="text-xs mb-1 block">Observações</Label>
                <Textarea
                  value={form.observacoes || ''}
                  onChange={e => set('observacoes', e.target.value)}
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
        </>
      )}
    </div>
  );
}