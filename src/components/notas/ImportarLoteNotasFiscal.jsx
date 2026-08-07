import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, Loader2, CheckCircle, AlertCircle, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { extrairDadosArquivo, verificarDuplicadaBanco, salvarNotaFiscal, chaveDuplicada } from '@/lib/importacaoNotaFiscal';
import { analisarPrecosNovaNota } from '@/lib/analisePrecosNotas';
import BadgeComparacaoPreco, { ResumoAlertasLote } from '@/components/notas/BadgeComparacaoPreco';

const fmtR = (v) => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const fmtData = (d) => { if (!d) return '—'; const [y, m, day] = String(d).split('-'); return y && m && day ? `${day}/${m}/${y}` : d; };

const STATUS_META = {
  aguardando:  { label: 'Aguardando',  Icon: Clock,        cls: 'text-muted-foreground' },
  processando: { label: 'Processando', Icon: Loader2,      cls: 'text-primary',         spin: true },
  pronta:     { label: 'Pronta',      Icon: CheckCircle,  cls: 'text-green-600' },
  duplicada:  { label: 'Duplicada',   Icon: Copy,         cls: 'text-amber-600' },
  erro:       { label: 'Erro',        Icon: AlertCircle,  cls: 'text-destructive' },
  importada:  { label: 'Importada',   Icon: CheckCircle,  cls: 'text-green-700' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.aguardando;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${m.cls}`}>
      <m.Icon className={`w-3.5 h-3.5 ${m.spin ? 'animate-spin' : ''}`} />
      {m.label}
    </span>
  );
}

// Componente de LOTE. Renderizado DENTRO do Dialog do ImportarNotaFiscal.
// Processa os arquivos SEQUENCIALMENTE (1 por vez) para evitar travamento e
// limite de requisições. Não altera filtros da página (só chama refetch ao concluir).
export default function ImportarLoteNotasFiscal({ produtorId, arquivos, onConcluido, onCancelar,
  notas: historicoNotas = [], itens: historicoItens = [],
  fertilizantes = [], fontes = [], catalogoCategorias = [] }) {
  const [etapa, setEtapa] = useState('processando'); // processando | revisao | salvando | sucesso
  const [itens, setItens] = useState(() => arquivos.map(f => ({ arquivo: f.name, status: 'aguardando', erro: '', dados: null })));
  const [idxAberto, setIdxAberto] = useState(null);
  const [salvandoIdx, setSalvandoIdx] = useState(-1);
  const [resumo, setResumo] = useState(null);

  // Processamento sequencial: roda uma vez na montagem.
  useEffect(() => {
    let cancelado = false;
    const chavesVistas = new Set();
    (async () => {
      for (let i = 0; i < arquivos.length; i++) {
        if (cancelado) return;
        setItens(prev => prev.map((it, j) => j === i ? { ...it, status: 'processando' } : it));
        try {
          const dados = await extrairDadosArquivo(arquivos[i]);
          if (cancelado) return;
          const chave = chaveDuplicada(dados);
          if (chavesVistas.has(chave)) {
            setItens(prev => prev.map((it, j) => j === i ? { ...it, status: 'duplicada', erro: 'Arquivo duplicado neste lote', dados } : it));
          } else {
            const dupBanco = await verificarDuplicadaBanco(produtorId, dados);
            if (cancelado) return;
            if (dupBanco) {
              setItens(prev => prev.map((it, j) => j === i ? { ...it, status: 'duplicada', erro: 'Nota já importada anteriormente', dados } : it));
            } else {
              chavesVistas.add(chave);
              setItens(prev => prev.map((it, j) => j === i ? { ...it, status: 'pronta', dados } : it));
            }
          }
        } catch (e) {
          if (cancelado) return;
          setItens(prev => prev.map((it, j) => j === i ? { ...it, status: 'erro', erro: e?.message || String(e) } : it));
        }
      }
      if (!cancelado) setEtapa('revisao');
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validas = useMemo(() => itens.filter(it => it.status === 'pronta' || it.status === 'importada'), [itens]);
  const qtdDuplicadas = useMemo(() => itens.filter(it => it.status === 'duplicada').length, [itens]);
  const qtdErros = useMemo(() => itens.filter(it => it.status === 'erro').length, [itens]);

  const concluidas = useMemo(
    () => itens.filter(it => ['pronta', 'duplicada', 'erro', 'importada'].includes(it.status)).length,
    [itens]
  );

  // Alerta de preço por NF (Parte 2). Cada NF do lote compara contra o MESMO
  // histórico pré-lote (o lote ainda não foi salvo — regra #18). Mesma
  // metodologia do Banco de Preços (analisePrecosNotas).
  const analisePorNF = useMemo(() => {
    if (!produtorId) return {};
    const map = {};
    itens.forEach((it, i) => {
      if (it.dados) {
        map[i] = analisarPrecosNovaNota({
          dadosNovaNota: it.dados, produtorId,
          historicoItens, notas: historicoNotas,
          fertilizantes, fontes, catalogoCategorias,
        });
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, produtorId, historicoItens, historicoNotas, fertilizantes, fontes, catalogoCategorias]);

  const handleImportar = async () => {
    const alvos = itens.map((it, i) => ({ it, i })).filter(x => x.it.status === 'pronta');
    if (alvos.length === 0) return;
    setEtapa('salvando');
    setResumo(null);
    for (const { i } of alvos) {
      setSalvandoIdx(i);
      try {
        await salvarNotaFiscal(produtorId, itens[i].dados);
        setItens(prev => prev.map((x, j) => j === i ? { ...x, status: 'importada' } : x));
      } catch (e) {
        setItens(prev => prev.map((x, j) => j === i ? { ...x, status: 'erro', erro: e?.message || String(e) } : x));
      }
    }
    setSalvandoIdx(-1);
    // Resumo com contagem final
    setItens(curr => {
      const imp = curr.filter(x => x.status === 'importada').length;
      const dup = curr.filter(x => x.status === 'duplicada').length;
      const err = curr.filter(x => x.status === 'erro').length;
      setResumo({ importadas: imp, duplicadas: dup, erros: err });
      return curr;
    });
    setEtapa('sucesso');
  };

  const pct = arquivos.length ? Math.round((concluidas / arquivos.length) * 100) : 0;

  return (
    <div className="space-y-4 py-2">
      {/* PROCESSANDO */}
      {etapa === 'processando' && (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Processando notas fiscais</span>
            <span className="text-muted-foreground tabular-nums">{concluidas} de {arquivos.length} concluídas</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="border border-border rounded-lg max-h-72 overflow-y-auto divide-y divide-border/50">
            {itens.map((it, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="flex-shrink-0 w-6 text-right text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
                <span className="flex-1 truncate font-mono text-xs">{it.arquivo}</span>
                <StatusBadge status={it.status} />
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
          </div>
        </>
      )}

      {/* REVISÃO DO LOTE */}
      {etapa === 'revisao' && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 text-green-700 font-medium"><CheckCircle className="w-4 h-4" /> {validas.length} prontas</span>
            <span className="inline-flex items-center gap-1 text-amber-600 font-medium"><Copy className="w-4 h-4" /> {qtdDuplicadas} duplicadas</span>
            <span className="inline-flex items-center gap-1 text-destructive font-medium"><AlertCircle className="w-4 h-4" /> {qtdErros} com erro</span>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/20">
                  <tr className="border-b border-border">
                    {['Arquivo', 'NF', 'Fornecedor', 'Data', 'Itens', 'Valor', 'Alertas', 'Status'].map(h => (
                      <th key={h} className="px-2.5 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it, i) => (
                    <React.Fragment key={i}>
                      <tr
                        className={`border-b border-border/50 hover:bg-muted/10 ${it.dados ? 'cursor-pointer' : ''}`}
                        onClick={() => it.dados ? setIdxAberto(idxAberto === i ? null : i) : null}
                      >
                        <td className="px-2.5 py-2 font-mono max-w-[160px] truncate flex items-center gap-1">
                          {it.dados && (idxAberto === i ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />)}
                          <span className="truncate">{it.arquivo}</span>
                        </td>
                        <td className="px-2.5 py-2 font-medium">{it.dados?.numero || '—'}</td>
                        <td className="px-2.5 py-2 max-w-[140px] truncate">{it.dados?.fornecedor_nome || (it.erro && <span className="text-destructive truncate">{it.erro}</span>) || '—'}</td>
                        <td className="px-2.5 py-2 tabular-nums whitespace-nowrap">{it.dados ? fmtData(it.dados.data_emissao) : '—'}</td>
                        <td className="px-2.5 py-2 text-center tabular-nums">{it.dados ? (it.dados.itens || []).length : '—'}</td>
                        <td className="px-2.5 py-2 tabular-nums whitespace-nowrap">{it.dados ? fmtR(it.dados.valor_total) : '—'}</td>
                        <td className="px-2.5 py-2 whitespace-nowrap">
                          {it.dados ? <ResumoAlertasLote analise={analisePorNF[i]} /> : '—'}
                        </td>
                        <td className="px-2.5 py-2"><StatusBadge status={it.status} /></td>
                      </tr>
                      {idxAberto === i && it.dados && (
                        <tr className="bg-muted/5">
                          <td colSpan={8} className="px-3 py-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Itens extraídos ({(it.dados.itens || []).length})</p>
                            <div className="rounded border border-border overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-muted/20 border-b border-border">
                                    <th className="px-2 py-1.5 text-left">Produto</th>
                                    <th className="px-2 py-1.5 text-right">Qtd</th>
                                    <th className="px-2 py-1.5 text-center">Un</th>
                                    <th className="px-2 py-1.5 text-right">Preço Unit.</th>
                                    <th className="px-2 py-1.5 text-right">Total</th>
                                    <th className="px-2 py-1.5 text-center">Comparação</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(it.dados.itens || []).map((p, k) => {
                                    const alerta = analisePorNF[i]?.[k];
                                    const econ = alerta?.economia;
                                    const econTitle = econ && Math.abs(econ.unitaria) > 1e-9
                                      ? `Economia potencial vs melhor preço histórico (${econ.melhorFornecedor || '—'}): R$ ${Math.abs(econ.total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nReferência pelo menor preço histórico registrado.`
                                      : null;
                                    return (
                                      <tr key={k} className="border-b border-border/40 last:border-0">
                                        <td className="px-2 py-1.5 font-medium max-w-[180px] truncate" title={p.produto_nome}>{p.produto_nome || '—'}</td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">{p.quantidade}</td>
                                        <td className="px-2 py-1.5 text-center text-muted-foreground">{p.unidade_medida}</td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">{fmtR(p.preco_unitario)}</td>
                                        <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtR(p.preco_total)}</td>
                                        <td className="px-2 py-1.5 text-center">
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
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={onCancelar}>← Voltar</Button>
            <Button
              onClick={handleImportar}
              disabled={validas.length === 0}
              className="bg-green-700 hover:bg-green-800 text-white"
            >
              {validas.length > 0 ? `Importar ${validas.length} ${validas.length === 1 ? 'nota válida' : 'notas válidas'}` : 'Nenhuma nota válida'}
            </Button>
          </div>
        </>
      )}

      {/* SALVANDO */}
      {etapa === 'salvando' && (
        <>
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="w-9 h-9 animate-spin text-primary" />
            <p className="text-sm font-medium">Salvando notas fiscais…</p>
            {salvandoIdx >= 0 && (
              <p className="text-xs text-muted-foreground font-mono">{itens[salvandoIdx]?.arquivo}</p>
            )}
          </div>
          <div className="border border-border rounded-lg max-h-60 overflow-y-auto divide-y divide-border/50">
            {itens.map((it, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="flex-shrink-0 w-6 text-right text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
                <span className="flex-1 truncate font-mono text-xs">{it.arquivo}</span>
                <StatusBadge status={it.status} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* SUCESSO */}
      {etapa === 'sucesso' && resumo && (
        <div className="flex flex-col items-center gap-4 py-8">
          <CheckCircle className="w-12 h-12 text-green-600" />
          <p className="text-base font-semibold">Importação concluída</p>
          <div className="w-full max-w-sm space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="inline-flex items-center gap-1.5 text-green-700"><CheckCircle className="w-4 h-4" /> Importadas</span><strong className="tabular-nums">{resumo.importadas}</strong></div>
            <div className="flex justify-between"><span className="inline-flex items-center gap-1.5 text-amber-600"><Copy className="w-4 h-4" /> Duplicadas</span><strong className="tabular-nums">{resumo.duplicadas}</strong></div>
            <div className="flex justify-between"><span className="inline-flex items-center gap-1.5 text-destructive"><AlertCircle className="w-4 h-4" /> Com erro</span><strong className="tabular-nums">{resumo.erros}</strong></div>
          </div>
          <Button onClick={onConcluido}>Concluir</Button>
        </div>
      )}
    </div>
  );
}