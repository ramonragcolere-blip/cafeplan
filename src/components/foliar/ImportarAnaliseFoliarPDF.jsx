import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Upload, Loader2, FileText, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { FAIXAS } from './FoliarNutrienteUtils';

const CAMPOS_FOLIAR = [
  { key: 'n_pct',  label: 'N (%)' },
  { key: 'p_pct',  label: 'P (%)' },
  { key: 'k_pct',  label: 'K (%)' },
  { key: 'ca_pct', label: 'Ca (%)' },
  { key: 'mg_pct', label: 'Mg (%)' },
  { key: 's_pct',  label: 'S (%)' },
  { key: 'zn_ppm', label: 'Zn (ppm)' },
  { key: 'b_ppm',  label: 'B (ppm)' },
  { key: 'cu_ppm', label: 'Cu (ppm)' },
  { key: 'mn_ppm', label: 'Mn (ppm)' },
  { key: 'fe_ppm', label: 'Fe (ppm)' },
  { key: 'data_analise', label: 'Data', date: true },
];

// COOXUPÉ: macronutrientes N,P,K,Ca,Mg,S em g/kg → ÷10 para %; micro Zn,Cu,Mn,Fe,B em mg/kg → ppm (manter)
function converterFoliar(dados, laboratorio) {
  const d = { ...dados };
  const n = v => (v != null && !isNaN(Number(v))) ? Number(v) : null;
  if (laboratorio === 'COOXUPE') {
    ['n_pct', 'p_pct', 'k_pct', 'ca_pct', 'mg_pct', 's_pct'].forEach(k => {
      if (n(d[k]) != null) d[k] = +(n(d[k]) / 10).toFixed(3);
    });
    // micro: zn_ppm, b_ppm, cu_ppm, mn_ppm, fe_ppm — manter como ppm
  }
  return d;
}

const buildPromptFoliar = (texto) => `
Você é especialista em análise foliar de cafeeiro brasileiro.
Extraia os dados do laudo foliar abaixo com máxima precisão.
NÃO converta unidades — retorne os valores EXATAMENTE como aparecem no laudo.

=== TEXTO DO PDF ===
${texto}
=== FIM ===

PASSO 1 — IDENTIFIQUE O LABORATÓRIO:
- COOXUPE: contém "Cooxupé" ou "Cooperativa Regional de Cafeicultores em Guaxupé"
- LAB_VICOSA: contém "labsolosvicosa" ou "Laboratório de Análise de Solo Viçosa"
- OUTRO: qualquer outro

PASSO 2 — LOCALIZE os campos de ANÁLISE FOLIAR pelos rótulos:
- n_pct: rótulo "N" — nitrogênio foliar (g/kg ou %)
- p_pct: rótulo "P" — fósforo foliar (g/kg ou %)
- k_pct: rótulo "K" — potássio foliar (g/kg ou %)
- ca_pct: rótulo "Ca" — cálcio foliar (g/kg ou %)
- mg_pct: rótulo "Mg" — magnésio foliar (g/kg ou %)
- s_pct: rótulo "S" — enxofre foliar (g/kg ou %)
- zn_ppm: rótulo "Zn" — zinco foliar (mg/kg ou ppm)
- b_ppm: rótulo "B" — boro foliar (mg/kg ou ppm)
- cu_ppm: rótulo "Cu" — cobre foliar (mg/kg ou ppm)
- mn_ppm: rótulo "Mn" — manganês foliar (mg/kg ou ppm)
- fe_ppm: rótulo "Fe" — ferro foliar (mg/kg ou ppm)
- data_analise: data do laudo (formato YYYY-MM-DD)

PASSO 3 — Se houver múltiplos talhões, retorne uma entrada por talhão.
PASSO 4 — Campos não encontrados → null. SEMPRE retorne JSON válido.

Retorne SOMENTE JSON válido neste formato:
{
  "laboratorio": "COOXUPE",
  "identificacao": { "cliente": null, "propriedade": null, "data_liberacao": null },
  "talhoes": [
    {
      "nome_talhao": "nome",
      "dados": {
        "n_pct": null, "p_pct": null, "k_pct": null,
        "ca_pct": null, "mg_pct": null, "s_pct": null,
        "zn_ppm": null, "b_ppm": null, "cu_ppm": null,
        "mn_ppm": null, "fe_ppm": null, "data_analise": null
      }
    }
  ]
}`;

const LAB_LABEL = { COOXUPE: 'COOXUPÉ', LAB_VICOSA: 'Lab Solo Viçosa', OUTRO: 'Outro' };

function CamposEditaveis({ values, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {CAMPOS_FOLIAR.map(c => (
        <div key={c.key}>
          <Label className="text-xs mb-0.5 block text-muted-foreground">{c.label}</Label>
          <Input
            type={c.date ? 'date' : 'number'}
            step={c.date ? undefined : '0.001'}
            value={values[c.key] ?? ''}
            onChange={e => onChange(c.key, e.target.value)}
            className="h-7 text-xs"
          />
        </div>
      ))}
    </div>
  );
}

export default function ImportarAnaliseFoliarPDF({ talhoes, safra, analises, onImportado }) {
  const fileRef = useRef();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [edicoes, setEdicoes] = useState([]);
  const [talhaoSelecionado, setTalhaoSelecionado] = useState([]);
  const [expandidos, setExpandidos] = useState([]);
  const [confirmandoSubst, setConfirmandoSubst] = useState(null);
  const [salvos, setSalvos] = useState([]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null); setResultado(null); setSalvos([]);
    setOpen(true); setLoading(true);
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
      } catch {}

      const resposta = await base44.integrations.Core.InvokeLLM({
        prompt: buildPromptFoliar(textoPDF || 'Leia os dados diretamente do arquivo PDF anexo.'),
        file_urls: [file_url],
        model: 'claude_sonnet_4_6',
      });

      let parsed = resposta;
      if (typeof resposta === 'string') {
        const m = resposta.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : null;
      }

      if (!parsed || !parsed.talhoes?.length) {
        const vazio = { laboratorio: 'OUTRO', identificacao: {}, talhoes: [{ nome_talhao: 'Novo registro', dados: {} }] };
        setResultado(vazio); setEdicoes([{}]); setTalhaoSelecionado(['']); setExpandidos([true]);
        setErro('Não foi possível extrair dados automaticamente. Preencha manualmente.');
        return;
      }

      const talhoesParsed = parsed.talhoes.map(t => ({
        ...t, dados: converterFoliar(t.dados || {}, parsed.laboratorio),
      }));
      setResultado({ ...parsed, talhoes: talhoesParsed });
      setEdicoes(talhoesParsed.map(t => ({ ...t.dados })));
      setTalhaoSelecionado(talhoesParsed.map(() => ''));
      setExpandidos(talhoesParsed.map((_, i) => i === 0));
    } catch (err) {
      const vazio = { laboratorio: 'OUTRO', identificacao: {}, talhoes: [{ nome_talhao: 'Novo registro', dados: {} }] };
      setResultado(vazio); setEdicoes([{}]); setTalhaoSelecionado(['']); setExpandidos([true]);
      setErro(`Erro ao processar PDF: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleEditCampo = (idx, key, value) => {
    setEdicoes(prev => { const n = [...prev]; n[idx] = { ...n[idx], [key]: value }; return n; });
  };

  const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;

  const buildNumDados = (idx) => {
    const nd = {};
    Object.entries(edicoes[idx] || {}).forEach(([k, v]) => {
      if (k === 'data_analise') { nd[k] = v || undefined; return; }
      nd[k] = toNum(v);
    });
    return nd;
  };

  const jaExiste = (talhao) => {
    if (!safra || !talhao) return null;
    return (analises || []).find(a => a.talhao_id === talhao.id && a.safra === safra) || null;
  };

  const efetivarSalvar = ({ entradaIdx, talhao, numDados }) => {
    onImportado(talhao, numDados);
    setSalvos(prev => [...prev, entradaIdx]);
    setExpandidos(prev => { const n = [...prev]; n[entradaIdx] = false; return n; });
  };

  const handleConfirmar = (entradaIdx) => {
    const tId = talhaoSelecionado[entradaIdx];
    const talhao = talhoes.find(t => t.id === tId);
    if (!talhao) return;
    const numDados = buildNumDados(entradaIdx);
    const existente = jaExiste(talhao);
    if (existente) {
      setConfirmandoSubst({ entradaIdx, talhao, numDados });
    } else {
      efetivarSalvar({ entradaIdx, talhao, numDados });
    }
  };

  const toggleExpand = (i) => setExpandidos(prev => { const n = [...prev]; n[i] = !n[i]; return n; });
  const todosSalvos = resultado && salvos.length === resultado.talhoes.length;

  return (
    <>
      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
      <Button type="button" variant="outline" size="sm"
        className="gap-2 border-dashed border-green-400 text-green-700 hover:bg-green-50"
        onClick={() => fileRef.current?.click()}>
        <Upload className="w-4 h-4" />
        Importar análise foliar (PDF)
      </Button>

      <AlertDialog open={!!confirmandoSubst} onOpenChange={v => { if (!v) setConfirmandoSubst(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Já existe análise foliar salva
            </AlertDialogTitle>
            <AlertDialogDescription>
              Já existe análise foliar para o talhão <strong>{confirmandoSubst?.talhao?.nome}</strong> na safra <strong>{safra}</strong>. Deseja substituir?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmandoSubst(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => { efetivarSalvar(confirmandoSubst); setConfirmandoSubst(null); }}>
              Sim, substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-700" />
              Importar Análise Foliar — PDF
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Lendo PDF e extraindo dados com IA…</p>
            </div>
          )}

          {erro && resultado && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><p>{erro}</p>
            </div>
          )}

          {resultado && !loading && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-700" />
                  <span className="font-semibold text-sm text-green-800">
                    Laboratório: {LAB_LABEL[resultado.laboratorio] || resultado.laboratorio || 'Não identificado'}
                  </span>
                </div>
              </div>

              {resultado.talhoes.map((entrada, i) => {
                const tId = talhaoSelecionado[i];
                const talhao = talhoes.find(t => t.id === tId);
                const existente = talhao ? jaExiste(talhao) : null;
                const foiSalvo = salvos.includes(i);
                return (
                  <div key={i} className={`border rounded-xl overflow-hidden ${foiSalvo ? 'border-green-400 bg-green-50/30' : 'border-border'}`}>
                    <button type="button"
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => toggleExpand(i)}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{entrada.nome_talhao || `Registro ${i + 1}`}</span>
                        {foiSalvo && <span className="text-xs px-2 py-0.5 rounded-full bg-green-200 text-green-800 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Salvo</span>}
                        {existente && !foiSalvo && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><AlertTriangle className="w-3 h-3 inline mr-1" />Já existe</span>}
                      </div>
                      {expandidos[i] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>

                    {expandidos[i] && !foiSalvo && (
                      <div className="p-4 space-y-4">
                        <div>
                          <Label className="text-xs mb-1 block font-semibold">Associar ao talhão <span className="text-destructive">*</span></Label>
                          <Select value={tId || 'none'} onValueChange={v => setTalhaoSelecionado(prev => { const n = [...prev]; n[i] = v === 'none' ? '' : v; return n; })}>
                            <SelectTrigger className="max-w-xs"><SelectValue placeholder="Selecione o talhão…" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Selecione…</SelectItem>
                              {talhoes.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Valores extraídos — edite se necessário</p>
                          <CamposEditaveis values={edicoes[i] || {}} onChange={(key, value) => handleEditCampo(i, key, value)} />
                        </div>
                        <div className="flex justify-end pt-1">
                          <Button size="sm" onClick={() => handleConfirmar(i)} disabled={!tId} className="gap-2">
                            <CheckCircle2 className="w-4 h-4" />Confirmar e salvar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {todosSalvos && (
                <div className="flex items-center gap-2 p-3 bg-green-100 border border-green-300 rounded-xl text-green-800 text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Todos os registros foram salvos!
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}