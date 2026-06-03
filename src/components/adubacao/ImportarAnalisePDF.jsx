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
  { key: 'materia_organica', label: 'M.O. (g/dm³)'            },
  { key: 'fosforo',          label: 'P (mg/dm³)'              },
  { key: 'potassio',         label: 'K (mmolc/dm³)'           },
  { key: 'calcio',           label: 'Ca (mmolc/dm³)'          },
  { key: 'magnesio',         label: 'Mg (mmolc/dm³)'          },
  { key: 'aluminio',         label: 'Al (cmolc/dm³)'          },
  { key: 'h_al',             label: 'H+Al (cmolc/dm³)'        },
  { key: 'sb',               label: 'SB (cmolc/dm³)'          },
  { key: 'ctc',              label: 'CTC (cmolc/dm³)'         },
  { key: 'saturacao_bases',  label: 'V%'                      },
  { key: 'boro',             label: 'B (mg/dm³)'              },
  { key: 'zinco',            label: 'Zn (mg/dm³)'             },
  { key: 'cobre',            label: 'Cu (mg/dm³)'             },
  { key: 'manganes',         label: 'Mn (mg/dm³)'             },
  { key: 'ferro',            label: 'Fe (mg/dm³)'             },
  { key: 'enxofre',          label: 'S (mg/dm³)'              },
  { key: 'data_analise',     label: 'Data da Análise', date: true },
];

// Converte valores brutos do laudo COOXUPÉ para as unidades padrão do sistema.
// K, Ca, Mg, H+Al, S.B., C.T.C. vêm em mmolc/dm³ no COOXUPÉ → dividir por 10 para cmolc/dm³
// K adicionalmente × 39,1 para mg/dm³ (mmolc × 39,1 mg/mmolc)
// Os demais laboratórios: Ca/Mg já podem vir em cmolc — não converter se já forem pequenos
function converterUnidades(dados, laboratorio) {
  const d = { ...dados };
  const n = v => (v != null && !isNaN(Number(v))) ? Number(v) : null;

  if (laboratorio === 'COOXUPE') {
    // K: mmolc/dm³ → mg/dm³  (× 39,1)
    if (n(d.potassio) != null) d.potassio = +(n(d.potassio) * 39.1).toFixed(1);
    // Ca, Mg, H+Al, SB, CTC: mmolc/dm³ → cmolc/dm³  (÷ 10)
    ['calcio', 'magnesio', 'aluminio', 'h_al', 'sb', 'ctc'].forEach(k => {
      if (n(d[k]) != null) d[k] = +(n(d[k]) / 10).toFixed(3);
    });
  } else if (laboratorio === 'LAB_VICOSA') {
    // K: se valor < 3 provavelmente está em cmolc → × 391
    if (n(d.potassio) != null && n(d.potassio) < 3) d.potassio = +(n(d.potassio) * 391).toFixed(1);
    // Ca, Mg já em cmolc — sem conversão
  }
  // Outros laboratórios: sem conversão automática

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

PASSO 2 — LOCALIZE os campos pelos RÓTULOS exatos do laudo (não por posição):
- pH: rótulo "pH CaCl2" ou "pH"
- materia_organica: rótulo "M.O." em g/dm³
- fosforo: rótulo "P" em mg/dm³
- potassio: rótulo "K" (pode estar em mmol/dm³ ou mg/dm³ — extraia o valor bruto)
- calcio: rótulo "Ca" (pode estar em mmol/dm³ ou cmolc/dm³ — extraia o valor bruto)
- magnesio: rótulo "Mg" (mesmo critério)
- aluminio: rótulo "Al" ou "Al³⁺"
- h_al: rótulo "H+Al" ou "H + Al"
- sb: rótulo "S.B." ou "SB" (Soma de Bases)
- ctc: rótulo "C.T.C." ou "CTC"
- saturacao_bases: rótulo "V%" nos Índices de Saturação
- enxofre: rótulo "S" em mg/dm³
- boro: rótulo "B" em mg/dm³
- zinco: rótulo "Zn" em mg/dm³
- cobre: rótulo "Cu" em mg/dm³
- manganes: rótulo "Mn" em mg/dm³
- ferro: rótulo "Fe" em mg/dm³

PASSO 3 — Se houver múltiplas camadas (0-20 e 20-40), retorne UMA ENTRADA POR CAMADA.
PASSO 4 — Campos não encontrados → null. SEMPRE retorne o JSON.

Retorne SOMENTE JSON válido neste formato exato:
{
  "laboratorio": "OUTRO",
  "identificacao": {
    "cliente": null,
    "propriedade": null,
    "referencia_talhao": null,
    "data_liberacao": null
  },
  "talhoes": [
    {
      "nome_talhao": "nome do talhao",
      "profundidade": "0-20",
      "dados": {
        "ph": null,
        "materia_organica": null,
        "fosforo": null,
        "potassio": null,
        "calcio": null,
        "magnesio": null,
        "aluminio": null,
        "h_al": null,
        "sb": null,
        "ctc": null,
        "saturacao_bases": null,
        "enxofre": null,
        "boro": null,
        "zinco": null,
        "cobre": null,
        "manganes": null,
        "ferro": null,
        "data_analise": null
      }
    }
  ]
}

"laboratorio" deve ser exatamente "COOXUPE", "LAB_VICOSA" ou "OUTRO".
"profundidade" deve ser exatamente "0-20" ou "20-40".
Se houver camadas 0-20 e 20-40, inclua duas entradas no array "talhoes".`;

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
      // 1. Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // 2. Extrair texto bruto do PDF usando a API de extração de dados
      let textoPDF = '';
      try {
        const extracao = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
            type: 'object',
            properties: {
              texto_completo: { type: 'string', description: 'Todo o texto extraído do PDF, incluindo rótulos, valores e identificações' },
            },
          },
        });
        if (extracao?.status === 'success' && extracao?.output?.texto_completo) {
          textoPDF = extracao.output.texto_completo;
        }
      } catch (_) {
        // falha silenciosa — tenta enviar o arquivo direto ao LLM abaixo
      }

      // 3. Chamar o LLM com o texto extraído (ou arquivo direto como fallback)
      const promptFinal = textoPDF
        ? buildPrompt(textoPDF)
        : buildPrompt('[Texto não pôde ser extraído — analise o arquivo diretamente]');

      const resposta = await base44.integrations.Core.InvokeLLM({
        prompt: promptFinal,
        // se não extraiu texto, manda o arquivo para o LLM tentar ler
        file_urls: textoPDF ? undefined : [file_url],
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

      // Fallback: se não encontrou talhões, abre formulário vazio para preenchimento manual
      if (!parsed || !parsed.talhoes?.length) {
        const vazio = {
          laboratorio: 'OUTRO',
          identificacao: {},
          talhoes: [{ nome_talhao: 'Novo registro', profundidade: '0-20', dados: {} }],
        };
        setResultado(vazio);
        setEdicoes([{}]);
        setTalhaoSelecionado(['']);
        setExpandidos([true]);
        setErro('Não foi possível extrair dados automaticamente. Preencha os campos manualmente.');
        return;
      }

      // Normalizar campos null/undefined dos dados e converter unidades no JS
      const talhoes = parsed.talhoes.map(t => ({
        ...t,
        dados: converterUnidades(t.dados || {}, parsed.laboratorio),
      }));

      setResultado({ ...parsed, talhoes });
      setEdicoes(talhoes.map(t => ({ ...t.dados })));
      setTalhaoSelecionado(talhoes.map(() => ''));
      setExpandidos(talhoes.map((_, i) => i === 0));
    } catch (err) {
      // Fallback geral: formulário vazio
      const vazio = {
        laboratorio: 'OUTRO',
        identificacao: {},
        talhoes: [{ nome_talhao: 'Novo registro', profundidade: '0-20', dados: {} }],
      };
      setResultado(vazio);
      setEdicoes([{}]);
      setTalhaoSelecionado(['']);
      setExpandidos([true]);
      setErro(`Erro ao processar PDF: ${err?.message || String(err)}. Preencha os campos manualmente.`);
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

          {erro && !resultado && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Erro ao processar PDF</p>
                <p className="text-xs mt-0.5">{erro}</p>
              </div>
            </div>
          )}
          {erro && resultado && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{erro}</p>
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