import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Layers, ArrowUp, TrendingDown, CircleSlash } from 'lucide-react';
import { extrairDadosArquivo, verificarDuplicadaBanco, salvarNotaFiscal } from '@/lib/importacaoNotaFiscal';
import { analisarPrecosNovaNota, contarAumentosAvisos } from '@/lib/analisePrecosNotas';
import BadgeComparacaoPreco from '@/components/notas/BadgeComparacaoPreco';
import ImportarLoteNotasFiscal from '@/components/notas/ImportarLoteNotasFiscal';

const LIMITE_LOTE = 20;

export default function ImportarNotaFiscal({ open, onClose, produtores, onImportado,
  notas = [], itens = [], fertilizantes = [], fontes = [], catalogoCategorias = [] }) {
  const [etapa, setEtapa] = useState('upload'); // upload | revisao | salvando | sucesso | lote
  const [produtorId, setProdutorId] = useState('');
  const [arquivo, setArquivo] = useState(null);        // importação individual
  const [arquivosLote, setArquivosLote] = useState([]); // importação em lote
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [processando, setProcessando] = useState(false);

  // Alerta de preço (Parte 2): compara cada item da nova NF contra o histórico
  // já existente no banco (a nova NF ainda não foi salva -> não contamina a
  // média). Mesma regra do Banco de Preços (analisePrecosNotas).
  const analisePrecos = useMemo(() => {
    if (etapa !== 'revisao' || !dados || !produtorId) return [];
    return analisarPrecosNovaNota({
      dadosNovaNota: dados, produtorId,
      historicoItens: itens, notas,
      fertilizantes, fontes, catalogoCategorias,
    });
  }, [etapa, dados, produtorId, itens, notas, fertilizantes, fontes, catalogoCategorias]);

  const resumoAlertas = useMemo(() => contarAumentosAvisos(analisePrecos), [analisePrecos]);

  const resetar = () => {
    setEtapa('upload'); setProdutorId(''); setArquivo(null); setArquivosLote([]);
    setDados(null); setErro(''); setProcessando(false);
  };
  const handleClose = () => { resetar(); onClose(); };

  const onFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    setErro('');
    if (files.length === 0) { setArquivo(null); setArquivosLote([]); return; }
    if (files.length > LIMITE_LOTE) {
      setErro(`É possível importar no máximo ${LIMITE_LOTE} notas fiscais por vez. Selecione até ${LIMITE_LOTE} arquivos.`);
      setArquivo(null); setArquivosLote([]);
      e.target.value = '';
      return;
    }
    if (files.length === 1) { setArquivo(files[0]); setArquivosLote([]); }
    else { setArquivosLote(files); setArquivo(null); }
  };

  // Inicia processamento: 1 arquivo -> fluxo individual (revisão); >1 -> lote.
  const handleProcessar = async () => {
    if (!produtorId) { setErro('Selecione um produtor.'); return; }
    if (arquivosLote.length > LIMITE_LOTE) {
      setErro(`É possível importar no máximo ${LIMITE_LOTE} notas fiscais por vez. Selecione até ${LIMITE_LOTE} arquivos.`);
      return;
    }
    if (arquivosLote.length > 1) { setEtapa('lote'); return; }
    if (!arquivo) { setErro('Selecione um arquivo.'); return; }
    setErro(''); setProcessando(true);
    try {
      const extraido = await extrairDadosArquivo(arquivo);
      setDados(extraido);
      setEtapa('revisao');
    } catch (e) {
      setErro('Erro ao processar arquivo: ' + e.message);
    } finally { setProcessando(false); }
  };

  const handleSalvar = async () => {
    setEtapa('salvando'); setErro('');
    try {
      const numeroNota = String(dados?.numero || '').trim();
      if (!produtorId) throw new Error('Selecione o produtor.');
      if (!numeroNota) throw new Error('O número da nota não foi identificado. Confira o arquivo antes de salvar.');
      const dup = await verificarDuplicadaBanco(produtorId, dados);
      if (dup) throw new Error(`A nota ${numeroNota} já foi importada para este produtor.`);
      await salvarNotaFiscal(produtorId, dados);
      setEtapa('sucesso');
      onImportado?.();
    } catch (e) {
      setErro('Erro ao salvar: ' + (e?.message || String(e)));
      setEtapa('revisao');
    }
  };

  const fmtR = (v) => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const produtorSel = (produtores || []).find(p => p.id === produtorId);
  const nomeProdutor = produtorSel ? (produtorSel.nome || produtorSel.codigo_produtor || '—') : '—';
  const ehLote = arquivosLote.length > 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Importar Nota Fiscal
          </DialogTitle>
        </DialogHeader>

        {/* Etapa: Upload (1 ou vários arquivos) */}
        {etapa === 'upload' && (
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-1">Produtor</label>
              <select value={produtorId} onChange={e => setProdutorId(e.target.value)}
                className="w-full h-9 text-sm border border-input rounded px-3 bg-background">
                <option value="">Selecione um produtor…</option>
                {(produtores || []).map(p => (
                  <option key={p.id} value={p.id}>{p.nome || p.codigo_produtor}</option>
                ))}
              </select>
              {produtorId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Produtor das notas: <strong className="text-foreground">{nomeProdutor}</strong>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Arquivo(s) XML ou PDF da NF-e — até {LIMITE_LOTE} por vez
              </label>
              <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${(arquivo || arquivosLote.length > 0) ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/30'}`}>
                {ehLote ? <Layers className="w-7 h-7 text-primary" /> : <Upload className={`w-7 h-7 ${arquivo ? 'text-primary' : 'text-muted-foreground'}`} />}
                <span className="text-sm font-medium">
                  {arquivo ? arquivo.name
                    : ehLote ? `${arquivosLote.length} arquivos selecionados`
                    : 'Clique para selecionar XML ou PDF (1 ou vários)'}
                </span>
                <span className="text-xs text-muted-foreground">Aceita XML, PDF ou combinação. Até {LIMITE_LOTE} arquivos por vez.</span>
                <input type="file" accept=".xml,.pdf" multiple className="hidden" onChange={onFilesChange} />
              </label>

              {ehLote && (
                <div className="mt-2 border border-border rounded-lg max-h-40 overflow-y-auto">
                  <ul className="divide-y divide-border/50">
                    {arquivosLote.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        <span className="w-6 text-right text-muted-foreground tabular-nums">{i + 1}.</span>
                        <span className="font-mono truncate">{f.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {erro && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />{erro}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleProcessar} disabled={processando || (!arquivo && arquivosLote.length === 0) || !produtorId}>
                {processando ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando…</>
                  : ehLote ? `Processar ${arquivosLote.length} arquivos`
                  : 'Extrair dados'}
              </Button>
            </div>
          </div>
        )}

        {/* Etapa: Lote (vários arquivos) */}
        {etapa === 'lote' && (
          <ImportarLoteNotasFiscal
            produtorId={produtorId}
            arquivos={arquivosLote}
            onConcluido={() => { onImportado?.(); handleClose(); }}
            onCancelar={() => setEtapa('upload')}
            notas={notas}
            itens={itens}
            fertilizantes={fertilizantes}
            fontes={fontes}
            catalogoCategorias={catalogoCategorias}
          />
        )}

        {/* Etapa: Revisão (individual) */}
        {etapa === 'revisao' && dados && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 bg-muted/20 rounded-xl p-4 text-sm">
              <div><span className="text-muted-foreground">Nº da Nota:</span> <strong>{dados.numero || '—'}</strong></div>
              <div><span className="text-muted-foreground">Data:</span> <strong>{dados.data_emissao || '—'}</strong></div>
              <div><span className="text-muted-foreground">Fornecedor:</span> <strong>{dados.fornecedor_nome || '—'}</strong></div>
              <div><span className="text-muted-foreground">CNPJ:</span> <strong>{dados.fornecedor_cnpj || '—'}</strong></div>
              <div className="col-span-2"><span className="text-muted-foreground">Valor Total:</span> <strong className="text-primary">{fmtR(dados.valor_total)}</strong></div>
            </div>

            {/* Resumo de alertas de preço (Parte 2) — não bloqueia a importação */}
            {resumoAlertas.total > 0 && (resumoAlertas.aumentos > 0 || resumoAlertas.quedas > 0 || resumoAlertas.semHistorico > 0) && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
                <span className="font-semibold text-muted-foreground">Comparação de preços:</span>
                {resumoAlertas.aumentos > 0 && (
                  <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                    <ArrowUp className="w-3.5 h-3.5" /> {resumoAlertas.aumentos} {resumoAlertas.aumentos === 1 ? 'item com aumento' : 'itens com aumento'}
                  </span>
                )}
                {resumoAlertas.quedas > 0 && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <TrendingDown className="w-3.5 h-3.5" /> {resumoAlertas.quedas} {resumoAlertas.quedas === 1 ? 'item com queda' : 'itens com queda'}
                  </span>
                )}
                {resumoAlertas.semHistorico > 0 && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                    <CircleSlash className="w-3.5 h-3.5" /> {resumoAlertas.semHistorico} sem histórico
                  </span>
                )}
                <span className="text-muted-foreground">— passe o mouse na coluna "Comparação" para detalhes</span>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold mb-2">Itens da Nota ({(dados.itens || []).length})</p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/20 border-b border-border">
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Produto</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Qtd</th>
                      <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Un</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Preço Unit.</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Total</th>
                      <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Comparação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dados.itens || []).map((it, i) => {
                      const alerta = analisePrecos[i];
                      // economia potencial na qtd desta NF (vs melhor preço histórico)
                      const econ = alerta?.economia;
                      const econTitle = econ && Math.abs(econ.unitaria) > 1e-9
                        ? `Economia potencial vs melhor preço histórico (${econ.melhorFornecedor || '—'}): R$ ${Math.abs(econ.total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nReferência pelo menor preço histórico registrado.`
                        : null;
                      return (
                        <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                          <td className="px-3 py-2 font-medium max-w-[220px] truncate" title={it.produto_nome}>{it.produto_nome}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{it.quantidade}</td>
                          <td className="px-3 py-2 text-center text-muted-foreground">{it.unidade_medida}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtR(it.preco_unitario)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtR(it.preco_total)}</td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <BadgeComparacaoPreco alerta={alerta} />
                              {econTitle && (
                                <span
                                  title={econTitle}
                                  className={`text-[10px] ${econ.unitaria > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}
                                >
                                  {econ.unitaria > 0 ? '−' : '+'}R$ {Math.abs(econ.total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {erro && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />{erro}</p>}

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => setEtapa('upload')}>← Voltar</Button>
              <Button onClick={handleSalvar} className="bg-green-700 hover:bg-green-800 text-white">
                Confirmar e Salvar
              </Button>
            </div>
          </div>
        )}

        {/* Etapa: Salvando (individual) */}
        {etapa === 'salvando' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Salvando nota fiscal e itens…</p>
          </div>
        )}

        {/* Etapa: Sucesso (individual) */}
        {etapa === 'sucesso' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <CheckCircle className="w-12 h-12 text-green-600" />
            <p className="text-base font-semibold">Nota fiscal importada com sucesso!</p>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}