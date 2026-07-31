import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  classificarExtracaoAnaliseSolo,
  converterValorAnaliseSolo,
  formatarUnidadeAnaliseSolo,
  getErrorMessageAnaliseSolo,
  interpretarRespostaAnaliseSolo,
  temPayloadAnaliseSolo,
  UNIDADES_INTERNAS_ANALISE_SOLO,
  UNIDADES_ORIGINAIS_ANALISE_SOLO,
  validarCompletudeExtracao,
} from '@/lib/analiseSoloImportacao';

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

const buildPrompt = (textoPDF) => `
Você é especialista em laudos de análise de solo.

=== TEXTO DO PDF ===
${textoPDF}
=== FIM ===

Exija a unidade individual de cada determinação. Use a unidade da própria linha do resultado quando existir.
Se a unidade não aparecer na linha, procure no texto completo do PDF. Não converta valores.
Normalize variações como mmolc/dm³, mmolc/dm3, mmol c/dm3, mmol_c/dm3, cmolc/dm³, cmolc/dm3, mg/dm³, mg/dm3, g/dm³, g/dm3 e %.

Retorne SOMENTE JSON válido:
{
  "laboratorio": "COOXUPE",
  "dados": {
    "ph": null, "materia_organica": null, "fosforo": null, "potassio": null,
    "calcio": null, "magnesio": null, "aluminio": null, "h_al": null,
    "sb": null, "ctc": null, "saturacao_bases": null, "enxofre": null,
    "boro": null, "zinco": null, "cobre": null, "manganes": null,
    "ferro": null, "data_analise": null
  },
  "unidades": {
    "ph": null, "materia_organica": "g/dm3", "fosforo": "mg/dm3", "potassio": "mmolc/dm3",
    "calcio": "mmolc/dm3", "magnesio": "mmolc/dm3", "aluminio": "mmolc/dm3", "h_al": "mmolc/dm3",
    "sb": "mmolc/dm3", "ctc": "mmolc/dm3", "saturacao_bases": "%", "enxofre": "mg/dm3",
    "boro": "mg/dm3", "zinco": "mg/dm3", "cobre": "mg/dm3", "manganes": "mg/dm3", "ferro": "mg/dm3"
  }
}`;

function formatarNumero(valor) {
  if (valor == null || valor === '') return '';
  return Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

export default function ImportarPDFTalhao(props) {
  const { talhao, onImportarAnalise } = props;
  const fileRef = useRef();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [dados, setDados] = useState(null);
  const [laboratorio, setLaboratorio] = useState('OUTRO');
  const [unidades, setUnidades] = useState({});
  const [revisoesUnidade, setRevisoesUnidade] = useState([]);
  const [pendenciasUnidade, setPendenciasUnidade] = useState([]);
  const [salvo, setSalvo] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    setDados(null);
    setUnidades({});
    setRevisoesUnidade([]);
    setPendenciasUnidade([]);
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
      } catch (error) {
        console.warn('Não foi possível extrair texto completo do PDF; tentando leitura pelo LLM.', error);
      }

      const resposta = await base44.integrations.Core.InvokeLLM({
        prompt: buildPrompt(textoPDF || 'Leia os dados diretamente do arquivo PDF anexo.'),
        file_urls: [file_url],
        model: 'claude_sonnet_4_6',
      });

      const interpretado = interpretarRespostaAnaliseSolo(resposta, '0-20');
      if (temPayloadAnaliseSolo(interpretado.dados, '0-20')) {
        setDados(interpretado.dados);
        setLaboratorio(interpretado.laboratorio || 'OUTRO');
        setUnidades(interpretado.unidades || {});
        setRevisoesUnidade(interpretado.revisoesUnidade || []);
        setPendenciasUnidade(interpretado.pendenciasUnidade || []);
        const validacao = validarCompletudeExtracao(interpretado.dados, '0-20');
        if (interpretado.pendenciasUnidade?.length) {
          setErro('Unidade original não identificada. Revise a unidade destacada antes de salvar.');
        } else if (!validacao.completo) {
          setErro(`Extração incompleta. Confira/preencha: ${validacao.camposAusentes.join(', ')}.`);
        }
      } else {
        setDados({});
        setErro('Não foi possível extrair dados automaticamente. Preencha manualmente.');
      }
    } catch (err) {
      setDados({});
      setErro(`Erro ao processar PDF: ${getErrorMessageAnaliseSolo(err)}`);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleSalvar = async () => {
    try {
      if (pendenciasUnidade.length) {
        throw new Error('Revise a unidade original dos campos destacados antes de salvar.');
      }
      const classificacao = classificarExtracaoAnaliseSolo(dados, '0-20');
      if (!classificacao.temDados) throw new Error('Nenhum dado válido foi extraído.');
      await onImportarAnalise(talhao, { ...dados, laboratorio_origem: laboratorio });
      setSalvo(true);
      setTimeout(() => setOpen(false), 1200);
    } catch (error) {
      setErro(`Erro ao salvar: ${getErrorMessageAnaliseSolo(error)}`);
    }
  };

  const toNum = v => (v !== '' && v != null) ? Number(v) : undefined;
  const revisoesPorCampo = new Map(revisoesUnidade.map(item => [item.campo, item]));
  const pendenciasPorCampo = new Map(pendenciasUnidade.map(item => [item.campo, item]));

  const handleChangeCampo = (campo, value) => {
    setDados(prev => ({ ...prev, [campo]: value }));
    setRevisoesUnidade(prev => prev.filter(item => item.campo !== campo));
  };

  const handleSelecionarUnidade = (campo, unidadeOriginal) => {
    const unidadeDestino = UNIDADES_INTERNAS_ANALISE_SOLO[campo];
    const resultado = converterValorAnaliseSolo({ campo, valorOriginal: dados?.[campo], unidadeOriginal, unidadeDestino });
    setDados(prev => ({ ...prev, [campo]: resultado.valor ?? prev[campo] }));
    setUnidades(prev => ({ ...prev, [campo]: resultado.destino || unidadeDestino }));
    setPendenciasUnidade(prev => prev.filter(item => item.campo !== campo));
    setRevisoesUnidade(prev => [
      ...prev.filter(item => item.campo !== campo),
      ...(resultado.convertido ? [{
        campo,
        valorOriginal: dados?.[campo],
        unidadeOriginal: resultado.origem,
        valorConvertido: resultado.valor,
        unidadeDestino: resultado.destino,
      }] : []),
    ]);
    setErro(null);
  };

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
                {CAMPOS_0_20.map(c => {
                  const revisao = revisoesPorCampo.get(c.key);
                  const pendencia = pendenciasPorCampo.get(c.key);
                  return (
                  <div key={c.key}>
                    <Label className="text-xs mb-0.5 block text-muted-foreground">{c.label}</Label>
                    <Input
                      type={c.date ? 'date' : 'number'}
                      step={c.date ? undefined : '0.001'}
                      value={dados[c.key] ?? ''}
                      onChange={e => handleChangeCampo(c.key, c.date ? e.target.value : toNum(e.target.value))}
                      className={`h-7 text-xs ${pendencia ? 'border-amber-500 bg-amber-50' : ''}`}
                    />
                    {unidades[c.key] && !c.date && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Unidade: {formatarUnidadeAnaliseSolo(unidades[c.key])}
                      </p>
                    )}
                    {revisao && (
                      <p className="mt-0.5 text-[10px] text-green-700">
                        Original: {formatarNumero(revisao.valorOriginal)} {formatarUnidadeAnaliseSolo(revisao.unidadeOriginal)} → Convertido: {formatarNumero(revisao.valorConvertido)} {formatarUnidadeAnaliseSolo(revisao.unidadeDestino)}
                      </p>
                    )}
                    {pendencia && (
                      <div className="mt-1">
                        <Select onValueChange={value => handleSelecionarUnidade(c.key, value)}>
                          <SelectTrigger className="h-7 text-xs border-amber-500 bg-amber-50">
                            <SelectValue placeholder="Unidade original" />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIDADES_ORIGINAIS_ANALISE_SOLO.map(unidade => (
                              <SelectItem key={unidade} value={unidade}>{formatarUnidadeAnaliseSolo(unidade)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={handleSalvar} disabled={pendenciasUnidade.length > 0} className="gap-2">
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
