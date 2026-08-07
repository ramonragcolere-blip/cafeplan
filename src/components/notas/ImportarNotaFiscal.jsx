import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Layers, X, ImageIcon, ImagePlus } from 'lucide-react';
import {
  extrairDadosArquivo, extrairDadosImagens, verificarDuplicadaBanco, salvarNotaFiscal,
  classificarArquivo, ACCEPT_INPUT,
} from '@/lib/importacaoNotaFiscal';
import ImportarLoteNotasFiscal from '@/components/notas/ImportarLoteNotasFiscal';
import RevisaoNotaFiscal from '@/components/notas/RevisaoNotaFiscal';

const LIMITE_LOTE = 20;
const ACCEPT_IMAGEM = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

// Modal de importação individual (XML/PDF/IMAGEM). 1 arquivo -> revisão
// editável; >1 arquivo -> lote. Imagens podem ter fotos adicionais (frente/
// continuação) interpretadas JUNTAS como uma única nota.
export default function ImportarNotaFiscal({ open, onClose, produtores, onImportado,
  notas = [], itens = [], fertilizantes = [], fontes = [], catalogoCategorias = [] }) {
  const [etapa, setEtapa] = useState('upload'); // upload | revisao | salvando | sucesso | lote
  const [produtorId, setProdutorId] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [arquivosLote, setArquivosLote] = useState([]);
  const [fotosExtras, setFotosExtras] = useState([]); // fotos adicionais da mesma nota (individual imagem)
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [processando, setProcessando] = useState(false);
  const [origemImagem, setOrigemImagem] = useState(false);

  const resetar = () => {
    setEtapa('upload'); setProdutorId(''); setArquivo(null); setArquivosLote([]);
    setFotosExtras([]); setDados(null); setErro(''); setProcessando(false); setOrigemImagem(false);
  };
  const handleClose = () => { resetar(); onClose(); };

  const onFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    setErro('');
    if (files.length === 0) { setArquivo(null); setArquivosLote([]); setFotosExtras([]); return; }
    const naoSuportados = files.filter((f) => classificarArquivo(f).tipo === 'nao_suportado');
    if (naoSuportados.length > 0) {
      setErro(`Formato não suportado: ${naoSuportados.map((f) => f.name).join(', ')}. Aceita XML, PDF, JPG, JPEG, PNG ou WEBP.`);
      setArquivo(null); setArquivosLote([]); setFotosExtras([]);
      e.target.value = '';
      return;
    }
    if (files.length > LIMITE_LOTE) {
      setErro(`É possível importar no máximo ${LIMITE_LOTE} notas fiscais por vez. Selecione até ${LIMITE_LOTE} arquivos.`);
      setArquivo(null); setArquivosLote([]); setFotosExtras([]);
      e.target.value = '';
      return;
    }
    if (files.length === 1) { setArquivo(files[0]); setArquivosLote([]); }
    else { setArquivosLote(files); setArquivo(null); setFotosExtras([]); }
  };

  const onAddFotoExtra = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (classificarArquivo(f).tipo !== 'imagem') { setErro('A foto adicional deve ser uma imagem (JPG, PNG ou WEBP).'); return; }
    if (!f.size) { setErro(`Arquivo "${f.name}" está vazio.`); return; }
    setErro('');
    setFotosExtras((prev) => [...prev, f]);
  };
  const removerExtra = (i) => setFotosExtras((prev) => prev.filter((_, j) => j !== i));

  // Inicia processamento: 1 arquivo -> fluxo individual (revisão); >1 -> lote.
  const handleProcessar = async () => {
    if (!produtorId) { setErro('Selecione um produtor.'); return; }
    if (arquivosLote.length > LIMITE_LOTE) { setErro(`Máximo de ${LIMITE_LOTE} notas por vez.`); return; }
    if (arquivosLote.length > 1) { setEtapa('lote'); return; }
    if (!arquivo) { setErro('Selecione um arquivo.'); return; }
    setErro(''); setProcessando(true);
    try {
      const ehImg = classificarArquivo(arquivo).tipo === 'imagem';
      setOrigemImagem(ehImg);
      const extraido = (ehImg && fotosExtras.length > 0)
        ? await extrairDadosImagens([arquivo, ...fotosExtras])
        : await extrairDadosArquivo(arquivo);
      setDados(extraido);
      setEtapa('revisao');
    } catch (e) {
      setErro(humanizarErro(e));
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

  const produtorSel = (produtores || []).find((p) => p.id === produtorId);
  const nomeProdutor = produtorSel ? (produtorSel.nome || produtorSel.codigo_produtor || '—') : '—';
  const ehLote = arquivosLote.length > 1;
  const imgIndividual = !!(arquivo && !ehLote && classificarArquivo(arquivo).tipo === 'imagem');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Importar Nota Fiscal
          </DialogTitle>
        </DialogHeader>

        {/* Etapa: Upload (1 ou vários arquivos) */}
        {etapa === 'upload' && (
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-1">Produtor</label>
              <select value={produtorId} onChange={(e) => setProdutorId(e.target.value)}
                className="w-full h-9 text-sm border border-input rounded px-3 bg-background">
                <option value="">Selecione um produtor…</option>
                {(produtores || []).map((p) => (
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
                XML, PDF ou foto da Nota Fiscal — até {LIMITE_LOTE} por vez
              </label>
              <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${(arquivo || arquivosLote.length > 0) ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/30'}`}>
                {ehLote ? <Layers className="w-7 h-7 text-primary" />
                  : (imgIndividual ? <ImageIcon className="w-7 h-7 text-primary" />
                  : <Upload className={`w-7 h-7 ${arquivo ? 'text-primary' : 'text-muted-foreground'}`} />)}
                <span className="text-sm font-medium text-center">
                  {arquivo ? arquivo.name
                    : ehLote ? `${arquivosLote.length} arquivos selecionados`
                    : 'Clique para selecionar XML, PDF ou foto (1 ou vários)'}
                </span>
                <span className="text-xs text-muted-foreground text-center">Aceita XML, PDF, JPG, PNG e WEBP · até {LIMITE_LOTE} arquivos por vez</span>
                <span className="text-[11px] text-muted-foreground text-center">Para fotos, enquadre a nota inteira e evite reflexos ou cortes.</span>
                <input type="file" accept={ACCEPT_INPUT} multiple className="hidden" onChange={onFilesChange} />
              </label>

              {/* Fotos adicionais da mesma nota (somente individual de imagem) */}
              {imgIndividual && (
                <div className="mt-3 rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">Fotos adicionais desta mesma nota (opcional)</p>
                    <label className="cursor-pointer inline-flex items-center gap-1 h-7 px-3 rounded-md border border-input bg-transparent text-xs hover:bg-accent">
                      <ImagePlus className="w-3.5 h-3.5" /> Adicionar outra foto
                      <input type="file" accept={ACCEPT_IMAGEM} className="hidden" onChange={onAddFotoExtra} />
                    </label>
                  </div>
                  {fotosExtras.length > 0 ? (
                    <ul className="space-y-1">
                      {fotosExtras.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs">
                          <ImageIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="font-mono truncate flex-1">{f.name}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removerExtra(i)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Use quando a nota precisar de mais de uma foto (frente/continuação/outra página). As fotos serão interpretadas juntas como uma única nota.
                    </p>
                  )}
                </div>
              )}

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

        {/* Etapa: Revisão editável (individual) */}
        {etapa === 'revisao' && dados && (
          <RevisaoNotaFiscal
            dados={dados} setDados={setDados} produtorId={produtorId}
            historicoItens={itens} notas={notas}
            fertilizantes={fertilizantes} fontes={fontes} catalogoCategorias={catalogoCategorias}
            ehImagem={origemImagem}
            onVoltar={() => setEtapa('upload')}
            onSalvar={handleSalvar}
            salvando={false}
            erro={erro}
          />
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

// Mensagem amigável para falhas de interpretação visual (#11).
function humanizarErro(e) {
  const msg = e?.message || String(e);
  if (/ileg|não foi possível interpretar|imagem|image/i.test(msg)) {
    return 'Não foi possível interpretar esta imagem com segurança. Tente uma foto mais nítida, com a nota inteira visível e sem reflexos.';
  }
  return 'Erro ao processar arquivo: ' + msg;
}