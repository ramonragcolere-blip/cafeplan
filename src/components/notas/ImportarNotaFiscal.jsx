import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

function parseXMLNFe(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const ns = 'http://www.portalfiscal.inf.br/nfe';

  const get = (parent, tag) => {
    const el = parent.getElementsByTagNameNS(ns, tag)[0] || parent.getElementsByTagName(tag)[0];
    return el ? el.textContent.trim() : '';
  };

  const ide = doc.querySelector('ide') || doc.getElementsByTagName('ide')[0];
  const emit = doc.querySelector('emit') || doc.getElementsByTagName('emit')[0];
  const total = doc.querySelector('ICMSTot') || doc.getElementsByTagName('ICMSTot')[0];

  const numero = ide ? get(ide, 'nNF') : '';
  const dataEmissao = ide ? get(ide, 'dhEmi').slice(0, 10) : '';
  const fornecedorNome = emit ? get(emit, 'xNome') : '';
  const fornecedorCnpj = emit ? get(emit, 'CNPJ') : '';
  const valorTotal = total ? parseFloat(get(total, 'vNF')) || 0 : 0;

  const dets = doc.getElementsByTagNameNS(ns, 'det');
  const detsFallback = doc.getElementsByTagName('det');
  const detsList = dets.length > 0 ? dets : detsFallback;

  const itens = [];
  for (const det of detsList) {
    const prod = det.getElementsByTagNameNS(ns, 'prod')[0] || det.getElementsByTagName('prod')[0];
    if (!prod) continue;
    itens.push({
      produto_nome: get(prod, 'xProd'),
      quantidade: parseFloat(get(prod, 'qCom')) || 0,
      unidade_medida: get(prod, 'uCom'),
      preco_unitario: parseFloat(get(prod, 'vUnCom')) || 0,
      preco_total: parseFloat(get(prod, 'vProd')) || 0,
    });
  }

  return { numero, fornecedor_nome: fornecedorNome, fornecedor_cnpj: fornecedorCnpj, data_emissao: dataEmissao, valor_total: valorTotal, itens };
}

export default function ImportarNotaFiscal({ open, onClose, produtores, onImportado }) {
  const [etapa, setEtapa] = useState('upload'); // upload | revisao | salvando | sucesso
  const [produtorId, setProdutorId] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [processando, setProcessando] = useState(false);

  const resetar = () => {
    setEtapa('upload');
    setProdutorId('');
    setArquivo(null);
    setDados(null);
    setErro('');
    setProcessando(false);
  };

  const handleClose = () => { resetar(); onClose(); };

  const handleProcessar = async () => {
    if (!produtorId) { setErro('Selecione um produtor.'); return; }
    if (!arquivo) { setErro('Selecione um arquivo.'); return; }
    setErro('');
    setProcessando(true);

    try {
      const isXML = arquivo.name.toLowerCase().endsWith('.xml');
      const { file_url } = await base44.integrations.Core.UploadFile({ file: arquivo });

      if (isXML) {
        const text = await arquivo.text();
        const extraido = parseXMLNFe(text);
        setDados({ ...extraido, arquivo_url: file_url });
        setEtapa('revisao');
      } else {
        // PDF: extrai texto e usa LLM
        const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: { type: 'object', properties: { texto: { type: 'string' } } }
        });
        const textoNota = extracted?.output?.texto || JSON.stringify(extracted?.output || '');

        const resultado = await base44.integrations.Core.InvokeLLM({
          prompt: `Extraia os dados da nota fiscal abaixo e retorne um JSON com os campos: numero (string), fornecedor_nome (string), fornecedor_cnpj (string, apenas dígitos), data_emissao (string YYYY-MM-DD), valor_total (number), itens (array de objetos com: produto_nome, quantidade, unidade_medida, preco_unitario, preco_total). Se não encontrar algum campo, use null. Nota fiscal:\n\n${textoNota}`,
          response_json_schema: {
            type: 'object',
            properties: {
              numero: { type: 'string' },
              fornecedor_nome: { type: 'string' },
              fornecedor_cnpj: { type: 'string' },
              data_emissao: { type: 'string' },
              valor_total: { type: 'number' },
              itens: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    produto_nome: { type: 'string' },
                    quantidade: { type: 'number' },
                    unidade_medida: { type: 'string' },
                    preco_unitario: { type: 'number' },
                    preco_total: { type: 'number' }
                  }
                }
              }
            }
          }
        });
        setDados({ ...resultado, arquivo_url: file_url });
        setEtapa('revisao');
      }
    } catch (e) {
      setErro('Erro ao processar arquivo: ' + e.message);
    } finally {
      setProcessando(false);
    }
  };

  const handleSalvar = async () => {
    setEtapa('salvando');
    try {
      const nota = await base44.entities.BaseNotasFiscais.create({
        produtor_id: produtorId,
        numero_nota: dados.numero || '',
        fornecedor_nome: dados.fornecedor_nome || '',
        fornecedor_cnpj: dados.fornecedor_cnpj || '',
        data_emissao: dados.data_emissao || null,
        valor_total: dados.valor_total || 0,
        arquivo_url: dados.arquivo_url || '',
      });

      const itensPayload = (dados.itens || []).map(it => ({
        nota_fiscal_id: nota.id,
        produtor_id: produtorId,
        produto_nome: it.produto_nome || '',
        quantidade: it.quantidade || 0,
        unidade_medida: (it.unidade_medida || '').toUpperCase(),
        preco_unitario: it.preco_unitario || 0,
        preco_total: it.preco_total || 0,
      }));

      if (itensPayload.length > 0) {
        await base44.entities.BaseItensNotaFiscal.bulkCreate(itensPayload);
      }

      setEtapa('sucesso');
      onImportado?.();
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message);
      setEtapa('revisao');
    }
  };

  const fmtR = (v) => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Importar Nota Fiscal
          </DialogTitle>
        </DialogHeader>

        {/* Etapa: Upload */}
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
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Arquivo XML ou PDF da NF-e</label>
              <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${arquivo ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/30'}`}>
                <Upload className={`w-8 h-8 ${arquivo ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">{arquivo ? arquivo.name : 'Clique para selecionar XML ou PDF'}</span>
                <span className="text-xs text-muted-foreground">Suporta NF-e em formato XML ou PDF</span>
                <input type="file" accept=".xml,.pdf" className="hidden" onChange={e => { setArquivo(e.target.files[0] || null); setErro(''); }} />
              </label>
            </div>

            {erro && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />{erro}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleProcessar} disabled={processando || !arquivo || !produtorId}>
                {processando ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando…</> : 'Extrair dados'}
              </Button>
            </div>
          </div>
        )}

        {/* Etapa: Revisão */}
        {etapa === 'revisao' && dados && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 bg-muted/20 rounded-xl p-4 text-sm">
              <div><span className="text-muted-foreground">Nº da Nota:</span> <strong>{dados.numero || '—'}</strong></div>
              <div><span className="text-muted-foreground">Data:</span> <strong>{dados.data_emissao || '—'}</strong></div>
              <div><span className="text-muted-foreground">Fornecedor:</span> <strong>{dados.fornecedor_nome || '—'}</strong></div>
              <div><span className="text-muted-foreground">CNPJ:</span> <strong>{dados.fornecedor_cnpj || '—'}</strong></div>
              <div className="col-span-2"><span className="text-muted-foreground">Valor Total:</span> <strong className="text-primary">{fmtR(dados.valor_total)}</strong></div>
            </div>

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
                    </tr>
                  </thead>
                  <tbody>
                    {(dados.itens || []).map((it, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                        <td className="px-3 py-2 font-medium">{it.produto_nome}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{it.quantidade}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{it.unidade_medida}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtR(it.preco_unitario)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtR(it.preco_total)}</td>
                      </tr>
                    ))}
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

        {/* Etapa: Salvando */}
        {etapa === 'salvando' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Salvando nota fiscal e itens…</p>
          </div>
        )}

        {/* Etapa: Sucesso */}
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