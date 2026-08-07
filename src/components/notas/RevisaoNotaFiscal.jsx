import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertTriangle, Plus, Trash2, ArrowUp, TrendingDown, CircleSlash, ExternalLink } from 'lucide-react';
import { analisarPrecosNovaNota, contarAumentosAvisos } from '@/lib/analisePrecosNotas';
import BadgeComparacaoPreco from '@/components/notas/BadgeComparacaoPreco';

// Revisão EDITÁVEL dos dados extraídos (antes de salvar). Mostra cabeçalho
// editável, avisos de conferência (ilegíveis + matemática), preview da imagem
// (com ampliar/abrir original) e comparação de preços. Não salva: só altera os
// dados em memória via setDados. Usada pela importação individual (XML/PDF/imagem).
function LabeledInput({ label, value, onChange, placeholder, mono, invalid }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {label}{invalid && <span className="text-amber-600 dark:text-amber-400"> · conferir</span>}
      </label>
      <Input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-8 text-sm ${mono ? 'font-mono' : ''} ${invalid ? 'border-amber-400' : ''}`}
      />
    </div>
  );
}

export default function RevisaoNotaFiscal({
  dados, setDados, produtorId, historicoItens, notas,
  fertilizantes = [], fontes = [], catalogoCategorias = [],
  ehImagem = false, onVoltar, onSalvar, salvando = false, erro = '',
}) {
  const [lightbox, setLightbox] = useState(null);

  const analisePrecos = useMemo(() => {
    if (!dados || !produtorId) return [];
    return analisarPrecosNovaNota({
      dadosNovaNota: dados, produtorId,
      historicoItens, notas, fertilizantes, fontes, catalogoCategorias,
    });
  }, [dados, produtorId, historicoItens, notas, fertilizantes, fontes, catalogoCategorias]);
  const resumo = useMemo(() => contarAumentosAvisos(analisePrecos), [analisePrecos]);

  const setCampo = (campo, valor) => setDados((d) => ({ ...d, [campo]: valor }));
  const setItem = (i, campo, valor) => setDados((d) => {
    const itens = [...(d.itens || [])];
    itens[i] = { ...itens[i], [campo]: valor, _conferir: false, _motivo: '' };
    return { ...d, itens };
  });
  const addItem = () => setDados((d) => ({
    ...d,
    itens: [...(d.itens || []), { produto_nome: '', quantidade: null, unidade_medida: '', preco_unitario: null, preco_total: null }],
  }));
  const removeItem = (i) => setDados((d) => ({ ...d, itens: (d.itens || []).filter((_, j) => j !== i) }));

  if (!dados) return null;
  const imgs = dados._imagens_urls || (ehImagem && dados.arquivo_url ? [dados.arquivo_url] : []);

  return (
    <div className="space-y-4 py-2">
      {/* Cabeçalho editável */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/20 rounded-xl p-4 text-sm">
        <LabeledInput label="Nº da Nota" value={dados.numero ?? ''} onChange={(v) => setCampo('numero', v)} placeholder="número" mono invalid={!dados.numero} />
        <LabeledInput label="Data (AAAA-MM-DD)" value={dados.data_emissao ?? ''} onChange={(v) => setCampo('data_emissao', v)} placeholder="2026-08-07" invalid={!dados.data_emissao} />
        <LabeledInput label="Fornecedor" value={dados.fornecedor_nome ?? ''} onChange={(v) => setCampo('fornecedor_nome', v)} invalid={!dados.fornecedor_nome} />
        <LabeledInput label="CNPJ (apenas dígitos)" value={dados.fornecedor_cnpj ?? ''} onChange={(v) => setCampo('fornecedor_cnpj', String(v).replace(/\D/g, ''))} mono />
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Valor Total (R$)</label>
          <Input
            type="number" step="0.01"
            value={dados.valor_total ?? ''}
            onChange={(e) => setCampo('valor_total', e.target.value === '' ? null : Number(e.target.value))}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Avisos de conferência (#6, #7, #8) */}
      {dados._avisos?.length > 0 && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <p className="font-semibold flex items-center gap-1 mb-1"><AlertTriangle className="w-3.5 h-3.5" /> Conferência</p>
          <ul className="list-disc ml-5 space-y-0.5">
            {dados._avisos.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      {/* Resumo de alertas de preço (mesma regra do Banco de Preços) */}
      {resumo.total > 0 && (resumo.aumentos > 0 || resumo.quedas > 0 || resumo.semHistorico > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
          <span className="font-semibold text-muted-foreground">Comparação de preços:</span>
          {resumo.aumentos > 0 && (
            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
              <ArrowUp className="w-3.5 h-3.5" /> {resumo.aumentos} {resumo.aumentos === 1 ? 'item com aumento' : 'itens com aumento'}
            </span>
          )}
          {resumo.quedas > 0 && (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <TrendingDown className="w-3.5 h-3.5" /> {resumo.quedas} {resumo.quedas === 1 ? 'item com queda' : 'itens com queda'}
            </span>
          )}
          {resumo.semHistorico > 0 && (
            <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
              <CircleSlash className="w-3.5 h-3.5" /> {resumo.semHistorico} sem histórico
            </span>
          )}
        </div>
      )}

      {/* Preview da imagem (#9) */}
      {ehImagem && imgs.length > 0 && (
        <div className="flex flex-wrap items-start gap-3">
          {imgs.map((u, i) => (
            <div key={i} className="relative">
              <img src={u} alt={`foto ${i + 1}`} className="h-24 w-auto rounded border border-border object-cover cursor-zoom-in" onClick={() => setLightbox(u)} />
              <a href={u} target="_blank" rel="noopener noreferrer" className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-background/95 border border-border rounded-full px-1.5 py-0.5 text-[10px] flex items-center gap-0.5 shadow whitespace-nowrap">
                <ExternalLink className="w-2.5 h-2.5" /> Abrir
              </a>
            </div>
          ))}
          <span className="text-[11px] text-muted-foreground self-center">Clique para ampliar · confira os campos extraídos.</span>
        </div>
      )}

      {/* Itens editáveis (#10) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Itens da Nota ({(dados.itens || []).length})</p>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addItem}><Plus className="w-3.5 h-3.5" /> Adicionar item</Button>
        </div>
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/20 border-b border-border">
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground w-8">#</th>
                <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Produto</th>
                <th className="px-2 py-2 text-right font-semibold text-muted-foreground w-16">Qtd</th>
                <th className="px-2 py-2 text-center font-semibold text-muted-foreground w-16">Un</th>
                <th className="px-2 py-2 text-right font-semibold text-muted-foreground w-24">Preço Unit.</th>
                <th className="px-2 py-2 text-right font-semibold text-muted-foreground w-24">Total</th>
                <th className="px-2 py-2 text-center font-semibold text-muted-foreground w-20">Comparação</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {(dados.itens || []).map((it, i) => {
                const alerta = analisePrecos[i];
                const econ = alerta?.economia;
                const econTitle = econ && Math.abs(econ.unitaria) > 1e-9
                  ? `Economia potencial vs melhor preço histórico (${econ.melhorFornecedor || '—'}): R$ ${Math.abs(econ.total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nReferência pelo menor preço histórico registrado.`
                  : null;
                return (
                  <tr key={i} className="border-b border-border/50 last:border-0 align-top">
                    <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <Input value={it.produto_nome ?? ''} onChange={(e) => setItem(i, 'produto_nome', e.target.value)} className="h-7 text-xs" placeholder="produto" />
                      {it._conferir && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> {it._motivo}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-1.5"><Input type="number" value={it.quantidade ?? ''} onChange={(e) => setItem(i, 'quantidade', e.target.value === '' ? null : Number(e.target.value))} className="h-7 text-xs text-right" /></td>
                    <td className="px-2 py-1.5"><Input value={it.unidade_medida ?? ''} onChange={(e) => setItem(i, 'unidade_medida', e.target.value.toUpperCase())} className="h-7 text-xs text-center" /></td>
                    <td className="px-2 py-1.5"><Input type="number" step="0.01" value={it.preco_unitario ?? ''} onChange={(e) => setItem(i, 'preco_unitario', e.target.value === '' ? null : Number(e.target.value))} className="h-7 text-xs text-right" /></td>
                    <td className="px-2 py-1.5"><Input type="number" step="0.01" value={it.preco_total ?? ''} onChange={(e) => setItem(i, 'preco_total', e.target.value === '' ? null : Number(e.target.value))} className="h-7 text-xs text-right" /></td>
                    <td className="px-2 py-1.5 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <BadgeComparacaoPreco alerta={alerta} />
                        {econTitle && (
                          <span title={econTitle} className={`text-[10px] ${econ.unitaria > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {econ.unitaria > 0 ? '−' : '+'}R$ {Math.abs(econ.total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(i)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {erro && <p className="text-sm text-destructive flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {erro}</p>}

      <div className="flex justify-between gap-2 pt-2">
        <Button variant="outline" onClick={onVoltar} disabled={salvando}>← Voltar</Button>
        <Button onClick={onSalvar} disabled={salvando} className="bg-green-700 hover:bg-green-800 text-white">
          {salvando ? 'Salvando…' : 'Confirmar e Salvar'}
        </Button>
      </div>

      {/* Lightbox: ampliar foto da nota */}
      <Dialog open={!!lightbox} onOpenChange={(o) => { if (!o) setLightbox(null); }}>
        <DialogContent className="max-w-4xl bg-background p-2">
          {lightbox && <img src={lightbox} alt="nota fiscal ampliada" className="w-full h-auto rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}