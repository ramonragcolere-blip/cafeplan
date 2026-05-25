import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Upload, Loader2, FileText, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const CAMPOS_0_20 = [
  { key: 'ph',               label: 'pH'                      },
  { key: 'materia_organica', label: 'M.O.'                    },
  { key: 'fosforo',          label: 'P (mg/dm³)'              },
  { key: 'potassio',         label: 'K (mg/dm³)'              },
  { key: 'calcio',           label: 'Ca (cmolc/dm³)'          },
  { key: 'magnesio',         label: 'Mg (cmolc/dm³)'          },
  { key: 'enxofre',          label: 'S (mg/dm³)'              },
  { key: 'boro',             label: 'B (mg/dm³)'              },
  { key: 'zinco',            label: 'Zn (mg/dm³)'             },
  { key: 'cobre',            label: 'Cu (mg/dm³)'             },
  { key: 'manganes',         label: 'Mn (mg/dm³)'             },
  { key: 'ferro',            label: 'Fe (mg/dm³)'             },
  { key: 'ctc',              label: 'CTC'                     },
  { key: 'saturacao_bases',  label: 'V%'                      },
  { key: 'data_analise',     label: 'Data da Análise', date: true },
];

const CAMPOS_2040 = [
  { key: 'ph',               label: 'pH'                      },
  { key: 'calcio',           label: 'Ca (cmolc/dm³)'          },
  { key: 'magnesio',         label: 'Mg (cmolc/dm³)'          },
  { key: 'potassio',         label: 'K (mg/dm³)'              },
  { key: 'aluminio',         label: 'Al (cmolc/dm³)'          },
  { key: 'h_al',             label: 'H+Al (cmolc/dm³)'        },
  { key: 'sb',               label: 'SB (cmolc/dm³)'          },
  { key: 'ctc',              label: 'CTC (cmolc/dm³)'         },
  { key: 'saturacao_bases',  label: 'V%'                      },
  { key: 'fosforo',          label: 'P (mg/dm³)'              },
  { key: 'zinco',            label: 'Zn (mg/dm³)'             },
  { key: 'cobre',            label: 'Cu (mg/dm³)'             },
  { key: 'manganes',         label: 'Mn (mg/dm³)'             },
  { key: 'boro',             label: 'B (mg/dm³)'              },
  { key: 'enxofre',          label: 'S (mg/dm³)'              },
  { key: 'materia_organica', label: 'MO (dag/kg)'             },
  { key: 'data_analise',     label: 'Data da Análise', date: true },
];

const PROMPT_EXTRACAO = `
Você é um especialista em análise de solos agrícolas brasileiro. Analise este PDF de análise de solo e extraia os dados.

IDENTIFIQUE O LABORATÓRIO:
- COOXUPÉ: contém "Cooxupé", "Cooperativa Regional de Cafeicultores em Guaxupé". Unidades: K em mmolc/dm³, Ca e Mg em mmolc/dm³. Use valores diretamente SEM conversão.
- LAB VIÇOSA: contém "Laboratório de Análise de Solo Viçosa" ou "labsolosvicosa@gmail.com". Unidades: Ca e Mg em cmolc/dm³, K em mg/dm³. CONVERTER K de cmolc/dm³ para mg/dm³: K_mg = K_cmolc × 391 (se o valor do K parecer estar em cmolc, multiplique por 391).

Para cada camada/talhão encontrado, extraia:

{
  "laboratorio": "COOXUPE" | "LAB_VICOSA" | "OUTRO",
  "identificacao": {
    "cliente": "nome do cliente/proprietário",
    "propriedade": "nome da fazenda/propriedade",
    "referencia_talhao": "referência ou nome do talhão",
    "data_liberacao": "data de liberação no formato YYYY-MM-DD se possível"
  },
  "talhoes": [
    {
      "nome_talhao": "nome do talhão conforme consta no PDF",
      "profundidade": "0-20" ou "20-40",
      "dados": {
        "ph": número ou null,
        "materia_organica": número ou null,
        "fosforo": número ou null,
        "potassio": número ou null (em mg/dm³ — converter se necessário),
        "calcio": número ou null (em cmolc/dm³),
        "magnesio": número ou null (em cmolc/dm³),
        "aluminio": número ou null,
        "h_al": número ou null,
        "sb": número ou null,
        "ctc": número ou null,
        "saturacao_bases": número ou null (V%),
        "enxofre": número ou null,
        "boro": número ou null,
        "zinco": número ou null,
        "cobre": número ou null,
        "manganes": número ou null,
        "ferro": número ou null,
        "data_analise": "YYYY-MM-DD" ou null
      }
    }
  ]
}

Se o PDF tiver múltiplas camadas (0-20 e 20-40) para o mesmo talhão, retorne duas entradas na lista talhoes com profundidades diferentes.
Se tiver múltiplos talhões, retorne uma entrada para cada.
Retorne SOMENTE o JSON, sem markdown.
`;

const LAB_LABEL = {
  COOXUPE: 'COOXUPÉ',
  LAB_VICOSA: 'Lab Solo Viçosa',
  OUTRO: 'Outro',
};

function CamposEditaveis({ campos, values, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {campos.map(c => (
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

// pendente de confirmação de substituição
// { entradaIdx, talhao, numDados, camada, laboratorio }
const NENHUM_PENDENTE = null;

export default function ImportarAnalisePDF({
  talhoes,
  safra,
  analises,       // lista de AnaliseSolo existentes
  analises2040,   // lista de AnaliseSolo2040 existentes
  onImportarAnalise,
  onImportarAnalise2040,
}) {
  const fileRef = useRef();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [edicoes, setEdicoes] = useState([]);
  const [talhaoSelecionado, setTalhaoSelecionado] = useState([]);
  const [expandidos, setExpandidos] = useState([]);
  // { entradaIdx, talhao, numDados, camada, laboratorio }
  const [confirmandoSubst, setConfirmandoSubst] = useState(NENHUM_PENDENTE);
  // índices já confirmados/salvos nesta sessão
  const [salvos, setSalvos] = useState([]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    setResultado(null);
    setSalvos([]);
    setOpen(true);
    setLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const resposta = await base44.integrations.Core.InvokeLLM({
        prompt: PROMPT_EXTRACAO,
        file_urls: [file_url],
        model: 'claude_sonnet_4_6',
        response_json_schema: {
          type: 'object',
          properties: {
            laboratorio: { type: 'string' },
            identificacao: { type: 'object' },
            talhoes: { type: 'array', items: { type: 'object' } },
          },
        },
      });

      let parsed = resposta;
      if (typeof resposta === 'string') {
        const m = resposta.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : null;
      }

      if (!parsed || !parsed.talhoes?.length) throw new Error('Não foi possível extrair dados do PDF.');

      setResultado(parsed);
      setEdicoes(parsed.talhoes.map(t => ({ ...t.dados })));
      setTalhaoSelecionado(parsed.talhoes.map(() => ''));
      setExpandidos(parsed.talhoes.map((_, i) => i === 0));
    } catch (err) {
      setErro(err?.message || String(err));
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleEditCampo = (idx, key, value) => {
    setEdicoes(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  };

  const toNum = v => (v !== '' && v != null && v !== undefined) ? Number(v) : undefined;

  const buildNumDados = (idx) => {
    const numDados = {};
    Object.entries(edicoes[idx] || {}).forEach(([k, v]) => {
      if (k === 'data_analise') { numDados[k] = v || undefined; return; }
      numDados[k] = toNum(v);
    });
    return numDados;
  };

  // Verifica se já existe registro salvo para essa chave
  const jaExiste = (talhao, camada) => {
    if (!safra || !talhao) return null;
    if (camada === '20-40') {
      return (analises2040 || []).find(a => a.talhao_id === talhao.id && a.safra === safra) || null;
    }
    return (analises || []).find(a => a.talhao_id === talhao.id && a.safra === safra) || null;
  };

  const efetivarSalvar = ({ entradaIdx, talhao, numDados, camada, laboratorio }) => {
    const dadosComLab = { ...numDados, laboratorio_origem: laboratorio };
    if (camada === '20-40') {
      onImportarAnalise2040(talhao, dadosComLab);
    } else {
      onImportarAnalise(talhao, dadosComLab);
    }
    setSalvos(prev => [...prev, entradaIdx]);
    setExpandidos(prev => { const n = [...prev]; n[entradaIdx] = false; return n; });
  };

  const handleConfirmar = (entradaIdx) => {
    const entrada = resultado.talhoes[entradaIdx];
    const tId = talhaoSelecionado[entradaIdx];
    const talhao = talhoes.find(t => t.id === tId);
    if (!talhao) return;

    const camada = entrada.profundidade === '20-40' ? '20-40' : '0-20';
    const numDados = buildNumDados(entradaIdx);
    const laboratorio = resultado.laboratorio;

    const existente = jaExiste(talhao, camada);
    if (existente) {
      // Abrir diálogo de confirmação
      setConfirmandoSubst({ entradaIdx, talhao, numDados, camada, laboratorio });
    } else {
      efetivarSalvar({ entradaIdx, talhao, numDados, camada, laboratorio });
    }
  };

  const handleConfirmarTodos = () => {
    resultado.talhoes.forEach((_, i) => {
      if (talhaoSelecionado[i] && !salvos.includes(i)) handleConfirmar(i);
    });
  };

  const toggleExpand = (i) => {
    setExpandidos(prev => { const n = [...prev]; n[i] = !n[i]; return n; });
  };

  const totalSelecionados = talhaoSelecionado.filter(Boolean).length;
  const todosSalvos = resultado && salvos.length === resultado.talhoes.length;

  return (
    <>
      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 border-dashed border-green-400 text-green-700 hover:bg-green-50"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="w-4 h-4" />
        Importar análise de solo (PDF)
      </Button>

      {/* Diálogo de confirmação de substituição */}
      <AlertDialog open={!!confirmandoSubst} onOpenChange={v => { if (!v) setConfirmandoSubst(NENHUM_PENDENTE); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Já existe análise salva
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-1 text-sm">
              <span>
                Já existe uma análise de solo salva para:
              </span>
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-xs space-y-0.5">
                <p><strong>Talhão:</strong> {confirmandoSubst?.talhao?.nome}</p>
                <p><strong>Safra:</strong> {safra}</p>
                <p><strong>Camada:</strong> {confirmandoSubst?.camada === '20-40' ? '20–40 cm' : '0–20 cm'}</p>
                <p><strong>Lab. origem (novo):</strong> {LAB_LABEL[confirmandoSubst?.laboratorio] || confirmandoSubst?.laboratorio}</p>
              </div>
              <p className="mt-2">Deseja substituir os dados existentes pelos valores importados do PDF?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmandoSubst(NENHUM_PENDENTE)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                efetivarSalvar(confirmandoSubst);
                setConfirmandoSubst(NENHUM_PENDENTE);
              }}
            >
              Sim, substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal principal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-700" />
              Importar Análise de Solo — PDF
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Lendo PDF e extraindo dados com IA…</p>
              <p className="text-xs">Isso pode levar alguns segundos</p>
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Erro ao processar PDF</p>
                <p className="text-xs mt-0.5">{erro}</p>
              </div>
            </div>
          )}

          {resultado && !loading && (
            <div className="space-y-4">
              {/* Banner laboratório */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-700" />
                  <span className="font-semibold text-sm text-green-800">
                    Laboratório: {LAB_LABEL[resultado.laboratorio] || resultado.laboratorio || 'Não identificado'}
                  </span>
                </div>
                {resultado.identificacao && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-green-900">
                    {resultado.identificacao.cliente && <span>Cliente: <strong>{resultado.identificacao.cliente}</strong></span>}
                    {resultado.identificacao.propriedade && <span>Propriedade: <strong>{resultado.identificacao.propriedade}</strong></span>}
                    {resultado.identificacao.referencia_talhao && <span>Ref.: <strong>{resultado.identificacao.referencia_talhao}</strong></span>}
                    {resultado.identificacao.data_liberacao && <span>Data liberação: <strong>{resultado.identificacao.data_liberacao}</strong></span>}
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {resultado.talhoes.length} registro(s) encontrado(s). Selecione o talhão, confira os valores e salve.
              </p>

              {resultado.talhoes.map((entrada, i) => {
                const tId = talhaoSelecionado[i];
                const talhao = talhoes.find(t => t.id === tId);
                const camada = entrada.profundidade === '20-40' ? '20-40' : '0-20';
                const existente = talhao ? jaExiste(talhao, camada) : null;
                const foiSalvo = salvos.includes(i);

                return (
                  <div key={i} className={`border rounded-xl overflow-hidden ${foiSalvo ? 'border-green-400 bg-green-50/30' : 'border-border'}`}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => toggleExpand(i)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{entrada.nome_talhao || `Registro ${i + 1}`}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${camada === '20-40' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {camada === '20-40' ? '20–40 cm' : '0–20 cm'}
                        </span>
                        {foiSalvo && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-200 text-green-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Salvo
                          </span>
                        )}
                        {existente && !foiSalvo && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Já existe análise
                          </span>
                        )}
                      </div>
                      {expandidos[i] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>

                    {expandidos[i] && !foiSalvo && (
                      <div className="p-4 space-y-4">
                        {/* Seletor de talhão */}
                        <div>
                          <Label className="text-xs mb-1 block font-semibold">
                            Associar ao talhão do sistema
                            <span className="text-destructive ml-0.5">*</span>
                          </Label>
                          <Select
                            value={tId || 'none'}
                            onValueChange={v => {
                              setTalhaoSelecionado(prev => { const n = [...prev]; n[i] = v === 'none' ? '' : v; return n; });
                            }}
                          >
                            <SelectTrigger className="max-w-xs">
                              <SelectValue placeholder="Selecione o talhão…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Selecione…</SelectItem>
                              {talhoes.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* Aviso de dado existente */}
                          {existente && (
                            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Já existe análise {camada === '20-40' ? '20–40 cm' : '0–20 cm'} salva para este talhão/safra. Confirmar irá substituir.
                            </p>
                          )}
                        </div>

                        {/* Campos editáveis */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            Valores extraídos — edite se necessário
                          </p>
                          <CamposEditaveis
                            campos={camada === '20-40' ? CAMPOS_2040 : CAMPOS_0_20}
                            values={edicoes[i] || {}}
                            onChange={(key, value) => handleEditCampo(i, key, value)}
                          />
                        </div>

                        {/* Botão confirmar e salvar */}
                        <div className="flex justify-end pt-1">
                          <Button
                            size="sm"
                            onClick={() => handleConfirmar(i)}
                            disabled={!tId}
                            className="gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Confirmar e salvar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Confirmar todos */}
              {resultado.talhoes.length > 1 && !todosSalvos && (
                <div className="flex justify-end pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleConfirmarTodos}
                    disabled={totalSelecionados === 0}
                    className="gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar e salvar todos selecionados ({totalSelecionados})
                  </Button>
                </div>
              )}

              {todosSalvos && (
                <div className="flex items-center gap-2 p-3 bg-green-100 border border-green-300 rounded-xl text-green-800 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Todos os registros foram salvos com sucesso!
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