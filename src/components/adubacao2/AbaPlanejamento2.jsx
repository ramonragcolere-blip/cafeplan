import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart2, Save, ChevronRight, ChevronDown, MoreVertical, Filter, X } from 'lucide-react';
import { sugerirProdutosInteligente } from '@/lib/sugerirProdutos2';
import {
  ajustarDoseLinha,
  calcularBalancoNutrientes,
  calcularDoseProdutoPorAlvo,
  filtrarProdutosPlanejamento,
  formatarNutrientesFornecidosAdubacao2,
  listarNutrientesNaoAtendidos,
  listaSeguraAdubacao2,
  montarLinhasProdutos,
  montarProdutosEfetivosPlanejamento,
  NUTRIENTES_ALVO_ADUBACAO2,
  normalizarComplementosAdubacao2,
  objetoSeguroAdubacao2,
  origemProdutoCatalogoLabel,
  produtoNuloAdubacao2,
  produtoValidoAdubacao2,
  resolverAcaoProdutoDuplicado,
  restaurarDoseCalculadaLinha,
} from '@/lib/planejamentoProdutosAdubacao2';
import {
  TODOS_ELEMENTOS_GRID, calcMicros, classBadgeColor, fmt, fmtR,
  ResumoParcelamento, EditorParcelamento, DropdownTrocarProduto, StatusBadgePlan,
} from '@/components/adubacao2/PainelTalhaoHelpers';
import {
  calcularPosicaoDropdown,
  criarMarcacoesPadrao,
  listarElementosManuaisMarcados,
} from '@/lib/planejamentoAdubacao2';

// ── Editor de Parcelamento / Dropdown de troca — importados de PainelTalhaoHelpers ──

// ── Linha manual para elementos extras marcados ───────────────────────────────

function opcoesAlvoProduto(produto) {
  const opcoes = NUTRIENTES_ALVO_ADUBACAO2.filter(opcao =>
    opcao.value === 'dose_manual' || (parseFloat(produto?.[opcao.value]) || 0) > 0
  );
  return opcoes.length > 1 ? opcoes : NUTRIENTES_ALVO_ADUBACAO2.filter(opcao => opcao.value === 'dose_manual');
}

function chaveLinhaProduto(linha) {
  return linha?.linhaId || `${linha?.nutKey || 'produto'}:${linha?.produto?.id || linha?.produto?.nome || 'sem-produto'}`;
}

function chaveProdutoOculto(item) {
  if (typeof item === 'string') return item;
  return [
    item?.linhaId || '',
    item?.produtoId || '',
    item?.nutriente_alvo || item?.nutKey || '',
  ].join('|');
}

function chavesProdutoOculto(item) {
  if (typeof item === 'string') return [item];
  if (!item || typeof item !== 'object') return [];
  const alvo = item.nutriente_alvo || item.nutKey || '';
  const chaves = [];
  if (item.linhaId) chaves.push(item.linhaId);
  if (item.linhaId || alvo) chaves.push(chaveProdutoOculto(item));
  if (!item.linhaId && !alvo && item.produtoId) chaves.push(item.produtoId);
  return chaves;
}

function linhaEstaOculta(linha, ocultosSet) {
  const item = {
    linhaId: chaveLinhaProduto(linha),
    produtoId: linha?.produto?.id,
    nutriente_alvo: linha?.nutriente_alvo || linha?.nutKey || '',
  };
  return ocultosSet.has(item.linhaId) || ocultosSet.has(chaveProdutoOculto(item));
}

function LinhaElementoExtra({ elLabel, nutField, todos, area, precos, onPrecoChange, parcelamentos, onParcelamentoChange, onAplicarParcTodos, value, onChange, onExcluir, onRemoverPlanejamento, isManualLivre = false }) {
  const produtoId = value?.produtoId || '';
  const [doseManual, setDoseManual] = useState(value?.doseKgHa != null ? value.doseKgHa : '');
  const nutrienteAlvo = value?.nutriente_alvo || value?.nutKey || nutField || 'dose_manual';

  // Sincroniza se o valor vier do banco (carga inicial)
  useEffect(() => {
    setDoseManual(value?.doseKgHa != null ? value.doseKgHa : '');
  }, [value?.doseKgHa]);

  const handleProdutoChange = (id) => {
    if (!id || id === '0') {
      onChange({ ...value, produtoId: '', doseKgHa: '', nutriente_alvo: nutrienteAlvo, nutKey: nutrienteAlvo, isManualLivre });
      return;
    }
    onChange({ ...value, produtoId: id, doseKgHa: doseManual, nutriente_alvo: nutrienteAlvo, isManualLivre });
  };
  const handleDoseChange = (dose) => onChange({ ...value, produtoId: produtoId, doseKgHa: dose, nutriente_alvo: nutrienteAlvo, isManualLivre });
  const handleAlvoChange = (alvo) => onChange({ ...value, produtoId, doseKgHa: doseManual, nutriente_alvo: alvo, nutKey: alvo, isManualLivre });

  const [busca, setBusca] = useState('');
  const [dropAberto, setDropAberto] = useState(false);
  const dropRef = useRef(null);
  const btnRef = useRef(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 360 });

  const atualizarPosicaoDrop = useCallback(() => {
    if (!btnRef.current || typeof window === 'undefined') return;
    const rect = btnRef.current.getBoundingClientRect();
    setDropPos(calcularPosicaoDropdown(rect, window.innerWidth, window.innerHeight));
  }, []);

  useEffect(() => {
    if (!dropAberto) return;
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target) && !btnRef.current?.contains(e.target)) setDropAberto(false); };
    document.addEventListener('mousedown', handler);
    window.addEventListener('resize', atualizarPosicaoDrop);
    window.addEventListener('scroll', atualizarPosicaoDrop, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('resize', atualizarPosicaoDrop);
      window.removeEventListener('scroll', atualizarPosicaoDrop, true);
    };
  }, [dropAberto, atualizarPosicaoDrop]);

  const abrirDrop = () => {
    atualizarPosicaoDrop();
    setDropAberto(a => !a);
  };

  // Produtos com o nutriente específico; fallback: todos os produtos se lista vazia
  const produtosDoNutriente = useMemo(() => {
    const sorted = listaSeguraAdubacao2(todos).filter(produtoValidoAdubacao2).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    if (!nutField) return sorted;
    // Produtos com teor ficam no topo; os demais ficam abaixo mas aparecem sempre
    const comNutriente = sorted.filter(p => (parseFloat(p[nutField]) || 0) > 0);
    const semNutriente = sorted.filter(p => (parseFloat(p[nutField]) || 0) === 0);
    return [...comNutriente, ...semNutriente];
  }, [todos, nutField]);

  const semProdutosEspecificos = useMemo(() => {
    if (!nutField) return false;
    return listaSeguraAdubacao2(todos).filter(produtoValidoAdubacao2).filter(p => (parseFloat(p[nutField]) || 0) > 0).length === 0;
  }, [todos, nutField]);

  const produtosFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return produtosDoNutriente;
    return produtosDoNutriente.filter(p => (p.nome || '').toLowerCase().includes(q));
  }, [produtosDoNutriente, busca]);

  const produtoSelecionado = listaSeguraAdubacao2(todos).filter(produtoValidoAdubacao2).find(p => p.id === produtoId) || null;
  const doseNum = doseManual !== '' ? parseFloat(doseManual) : null;
  const preco = produtoId ? precos?.[produtoId] : null;
  const precoNum = preco != null && preco !== '' ? parseFloat(preco) : null;
  const custoHa = precoNum != null && doseNum != null ? precoNum * doseNum : null;
  const totalKg = doseNum != null && area ? Math.round(doseNum * area * 10) / 10 : null;
  const custoTotal = custoHa != null && area ? custoHa * area : null;
  const parc = produtoId ? parcelamentos?.[produtoId] : null;
  const [expandidoParc, setExpandidoParc] = useState(false);

  return (
    <React.Fragment>
      <tr className="border-b border-border/50 last:border-0 hover:bg-muted/10 bg-amber-50/30">
        <td className="px-3 py-2 font-medium whitespace-nowrap max-w-[200px]">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">{elLabel}</span>
            <div className="relative">
              <button ref={btnRef} type="button" onClick={abrirDrop}
                className="h-6 text-xs border border-input rounded px-2 bg-background flex items-center gap-1 w-40 hover:bg-muted/30">
                <span className="truncate flex-1 text-left">
                  {produtoSelecionado ? produtoSelecionado.nome : <span className="text-muted-foreground">Escolher produto…</span>}
                </span>
                <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
              </button>
              {dropAberto && typeof document !== 'undefined' && createPortal(
                <div ref={dropRef}
                  style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999, width: dropPos.width }}
                  className="bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <input autoFocus type="text" placeholder={`Buscar produto${nutField ? ` com ${elLabel}` : ''}…`}
                      value={busca} onChange={e => setBusca(e.target.value)}
                      className="w-full h-7 text-xs border border-input rounded px-2 bg-background" />
                  </div>
                  {semProdutosEspecificos && !busca && (
                    <p className="px-3 py-1.5 text-[10px] text-amber-600 bg-amber-50 border-b border-amber-100 italic">
                      Nenhum produto com {elLabel} cadastrado — exibindo todos
                    </p>
                  )}
                  <div className="max-h-52 overflow-y-auto">
                    <button type="button" onClick={() => { handleProdutoChange(''); setDropAberto(false); setBusca(''); }}
                     className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60">
                      — Nenhum
                    </button>
                    {produtosFiltrados.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => { handleProdutoChange(p.id); setDropAberto(false); setBusca(''); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60">
                        <span className="font-medium">{p.nome}</span>
                        {p.fornecedor && <span className="text-muted-foreground ml-1.5">· {p.fornecedor}</span>}
                        {nutField && (parseFloat(p[nutField]) || 0) > 0 && (
                          <span className="text-muted-foreground ml-1.5">· {elLabel} {parseFloat(p[nutField]).toFixed(1)}%</span>
                        )}
                      </button>
                    ))}
                    {produtosFiltrados.length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum produto encontrado para "{busca}"</p>
                    )}
                  </div>
                </div>,
                document.body,
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-2">
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Manual</span>
        </td>
        <td className="px-3 py-2">
          <select
            value={nutrienteAlvo}
            onChange={e => handleAlvoChange(e.target.value)}
            className="h-7 w-36 text-xs border border-input rounded px-2 bg-background"
          >
            {opcoesAlvoProduto(produtoSelecionado).map(opcao => (
              <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
            ))}
          </select>
        </td>
        <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
          {produtoSelecionado && doseNum != null
            ? formatarNutrientesFornecidosAdubacao2(produtoSelecionado, doseNum)
            : '—'}
        </td>
        <td className="px-3 py-2 text-right">
          <input type="number" min="0" step="0.1" value={doseManual}
            onChange={e => setDoseManual(e.target.value)}
            onBlur={e => handleDoseChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleDoseChange(e.target.value); }}
            placeholder="—"
            className="w-20 h-6 text-xs text-right border border-input rounded px-2 bg-background tabular-nums" />
        </td>
        <td className="px-3 py-2 tabular-nums text-right text-xs">{totalKg != null ? fmt(totalKg, 1) : '—'}</td>
        <td className="px-3 py-2">
          <input type="number" min="0" step="0.01"
            value={produtoId ? (preco ?? '') : ''}
            onChange={e => produtoId && onPrecoChange(produtoId, e.target.value)}
            placeholder="—" disabled={!produtoId}
            className="w-20 h-6 text-xs text-right border border-input rounded px-2 bg-background tabular-nums disabled:opacity-50" />
        </td>
        <td className="px-3 py-2 tabular-nums text-right text-xs">{custoHa != null ? fmtR(custoHa) : '—'}</td>
        <td className="px-3 py-2 tabular-nums text-right text-xs">{custoTotal != null ? fmtR(custoTotal) : '—'}</td>
        <td className="px-3 py-2">
          {produtoId ? (
            <button type="button" onClick={() => setExpandidoParc(a => !a)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ResumoParcelamento parc={parc} />
              <ChevronDown className={`w-3 h-3 transition-transform ${expandidoParc ? 'rotate-180' : ''}`} />
            </button>
          ) : <span className="text-muted-foreground text-xs">—</span>}
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-col gap-1">
            {onExcluir && (
              <button type="button" onClick={onExcluir}
                className="h-7 px-2 text-xs rounded border border-red-200 text-red-700 bg-red-50 hover:bg-red-100">
                Excluir
              </button>
            )}
            {produtoId && (
              <button type="button" onClick={onRemoverPlanejamento}
                className="h-7 px-2 text-xs rounded border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 whitespace-nowrap">
                Remover do planejamento
              </button>
            )}
            {!onExcluir && !produtoId && <span className="text-muted-foreground text-xs">—</span>}
          </div>
        </td>
      </tr>
      {expandidoParc && produtoId && (
        <tr>
          <td colSpan={11} className="px-3 pb-3 bg-amber-50/20">
            <EditorParcelamento
              parc={parc}
              onChange={p => onParcelamentoChange(produtoId, p)}
              onAplicarTodos={p => onAplicarParcTodos(produtoId, p)}
              onRecolher={() => setExpandidoParc(false)}
            />
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

// ── Tabela de Produtos do Talhão ───────────────────────────────────────────────

function TabelaProdutos({ linhas, area, precos, onPrecoChange, parcelamentos, onParcelamentoChange, onAplicarParcTodos, todos, onTrocarProduto, elementosExtras, extrasManuais, onExtraChange, onDoseChange, onRestaurarDose, onAlvoChange, onAdicionarManual, onExcluirManual, onOcultarLinha, onRemoverExtra }) {
  const [expandidoProd, setExpandidoProd] = useState(null);

  const extrasObj = objetoSeguroAdubacao2(extrasManuais);
  const linhasLista = listaSeguraAdubacao2(linhas).filter(linha => linha?.produto);
  const elementosExtrasLista = listaSeguraAdubacao2(elementosExtras);
  const precosObj = objetoSeguroAdubacao2(precos);
  const parcelamentosObj = objetoSeguroAdubacao2(parcelamentos);
  const temManuaisLivres = Object.keys(extrasObj).some(key => String(key).startsWith('manual-'));
  const semLinhas = linhasLista.length === 0 && elementosExtrasLista.length === 0 && !temManuaisLivres;
  if (semLinhas) {
    return (
      <div className="bg-muted/30 border border-dashed border-border rounded-lg px-4 py-3 text-xs text-muted-foreground text-center space-y-3">
        <p>Sem produtos sugeridos (verifique se há produtos cadastrados na Base de Insumos).</p>
        <button type="button" onClick={onAdicionarManual}
          className="h-8 px-3 text-xs rounded border border-border bg-background hover:bg-muted/60 text-foreground">
          + Adicionar produto
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/20">
            {['Produto','','Calcular para atender','Nutrientes fornecidos','Dose (kg/ha)','Total (kg)','Preço (R$/kg)','Custo/ha','Custo total','Parcelamento','Ações'].map(h => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhasLista.map(linha => {
            const { produto, nutrientes, ehPrincipal, doseKgHa, nutKey, origemUso, dose_ajustada_manualmente } = linha;
            const preco = precosObj?.[produto.id];
            const precoNum = preco != null && preco !== '' ? parseFloat(preco) : null;
            const custoHa = precoNum != null && doseKgHa != null ? precoNum * doseKgHa : null;
            const totalKg = doseKgHa != null && area ? Math.round(doseKgHa * area * 10) / 10 : null;
            const custoTotal = custoHa != null && area ? custoHa * area : null;
            const parc = parcelamentosObj?.[produto.id] || null;
            const expandido = expandidoProd === produto.id;
            const nutStr = formatarNutrientesFornecidosAdubacao2(produto, doseKgHa) ||
              listaSeguraAdubacao2(nutrientes).map(n => `${n.label} ${fmt(n.fornecido, 1)} kg/ha`).join(' · ');

            return (
              <React.Fragment key={produto.id}>
                <tr className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                  <td className="px-3 py-2 font-medium whitespace-nowrap max-w-[180px]">
                    <div className="flex flex-col gap-0.5">
                      <span className="truncate max-w-[160px]">{produto.nome}</span>
                      <span className="flex flex-wrap gap-1">
                        <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{origemUso || 'Produto sugerido'}</span>
                        <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded">{origemProdutoCatalogoLabel(produto)}</span>
                      </span>
                      {/* CORREÇÃO 2: botão Trocar */}
                      {onTrocarProduto && nutKey && (
                        <DropdownTrocarProduto todos={todos} onTrocar={p => onTrocarProduto(nutKey, p)} />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {ehPrincipal
                      ? <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Principal</span>
                      : <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">Complemento</span>
                    }
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={linha.nutriente_alvo || nutKey || 'dose_manual'}
                      onChange={e => onAlvoChange?.(linha, e.target.value)}
                      className="h-7 w-36 text-xs border border-input rounded px-2 bg-background"
                    >
                      {opcoesAlvoProduto(produto).map(opcao => (
                        <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground font-mono">{nutStr || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number" min="0" step="0.1"
                      value={doseKgHa ?? ''}
                      onChange={e => onDoseChange?.(linha, e.target.value)}
                      className="w-24 h-7 text-xs text-right border border-input rounded px-2 bg-background tabular-nums"
                    />
                    {dose_ajustada_manualmente && (
                      <div className="mt-1 text-[9px] text-amber-700 whitespace-nowrap">Dose ajustada manualmente</div>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right">{fmt(totalKg, 1)}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min="0" step="0.01"
                      value={preco ?? ''}
                      onChange={e => onPrecoChange(produto.id, e.target.value)}
                      placeholder="—"
                      className="w-20 h-6 text-xs text-right border border-input rounded px-2 bg-background tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right">{custoHa != null ? fmtR(custoHa) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-right">{custoTotal != null ? fmtR(custoTotal) : '—'}</td>
                  <td className="px-3 py-2">
                    <button type="button"
                      onClick={() => setExpandidoProd(expandido ? null : produto.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <ResumoParcelamento parc={parc} />
                      <ChevronDown className={`w-3 h-3 transition-transform ${expandido ? 'rotate-180' : ''}`} />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      {dose_ajustada_manualmente && (
                        <button type="button" onClick={() => onRestaurarDose?.(linha)}
                          className="h-7 px-2 text-xs rounded border border-border hover:bg-muted/60 whitespace-nowrap">
                          Restaurar dose calculada
                        </button>
                      )}
                      <button type="button" onClick={() => onOcultarLinha?.(linha)}
                        className="h-7 px-2 text-xs rounded border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 whitespace-nowrap">
                        Remover do planejamento
                      </button>
                    </div>
                  </td>
                </tr>
                {expandido && (
                  <tr>
                    <td colSpan={11} className="px-3 pb-3">
                      <EditorParcelamento
                        parc={parc}
                        onChange={p => onParcelamentoChange(produto.id, p)}
                        onAplicarTodos={p => onAplicarParcTodos(produto.id, p)}
                        onRecolher={() => setExpandidoProd(null)}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {/* Linhas de elementos extras (Zn, Cu, Mn, Mg, Fe, MO) marcados no grid */}
          {elementosExtrasLista.map(el => {
            const valor = extrasObj?.[el.key];
            const produtoZero = valor?.produtoId === 0 || valor?.produtoId === '0' || valor?.produtoNome === 0 || valor?.produtoNome === '0';
            const valorSeguro = produtoZero
              ? { ...valor, produtoId: '', doseKgHa: '' }
              : valor;
            return (
              <LinhaElementoExtra
                key={`extra-${el.key}`}
                elLabel={el.label}
                nutField={el.nutField}
                todos={todos}
                area={area}
                precos={precos}
                onPrecoChange={onPrecoChange}
                parcelamentos={parcelamentos}
                onParcelamentoChange={onParcelamentoChange}
                onAplicarParcTodos={onAplicarParcTodos}
                value={valorSeguro}
                onChange={(data) => onExtraChange(el.key, data)}
                onRemoverPlanejamento={() => onRemoverExtra?.(el.key, valorSeguro, false)}
              />
            );
          })}
          {Object.entries(extrasObj).filter(([key, data]) =>
            String(key).startsWith('manual-') &&
            !(data?.produtoId === 0 || data?.produtoId === '0' || data?.produtoNome === 0 || data?.produtoNome === '0')
          ).map(([key, data]) => (
            <LinhaElementoExtra
              key={key}
              elLabel="Produto adicionado manualmente"
              nutField={data?.nutriente_alvo === 'dose_manual' ? null : data?.nutriente_alvo}
              todos={todos}
              area={area}
              precos={precos}
              onPrecoChange={onPrecoChange}
              parcelamentos={parcelamentos}
              onParcelamentoChange={onParcelamentoChange}
              onAplicarParcTodos={onAplicarParcTodos}
              value={data}
              onChange={(next) => onExtraChange(key, { ...next, isManualLivre: true, usoSeparado: true })}
              onExcluir={() => onExcluirManual?.(key)}
              onRemoverPlanejamento={() => onRemoverExtra?.(key, data, true)}
              isManualLivre
            />
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 border-t border-border bg-muted/10">
        <button type="button" onClick={onAdicionarManual}
          className="h-8 px-3 text-xs rounded border border-border hover:bg-muted/60">
          + Adicionar produto
        </button>
      </div>
    </div>
  );
}

// ── Painel expandido de um talhão ─────────────────────────────────────────────

function PainelTalhao({ resultado, todos, todosSemFiltro, precosProd, onPrecoChange, parcelamentosProd, onParcelamentoChange, onAplicarParcTodos, onFechar, marcadosIniciais, trocasIniciais, complementosSalvos, ajustesDoseIniciais, produtosOcultosIniciais, onMarcadosChange, onTrocasChange, onExtrasChange, onAjustesDoseChange, onProdutosOcultosChange }) {
  const { talhao, rec, mediaBienal, analise, analise2040 } = resultado;
  const micros = calcMicros(analise);
  const area = talhao.area_ha || 0;

  // Marcados: restaura do banco se disponível, senão padrão (temRec = marcado)
  const [marcados, setMarcados] = useState(() => {
    const marcadosObj = objetoSeguroAdubacao2(marcadosIniciais);
    if (Object.keys(marcadosObj).length > 0) return marcadosObj;
    return criarMarcacoesPadrao(rec, TODOS_ELEMENTOS_GRID);
  });

  // Trocas: restaura do banco se disponível
  const [trocas, setTrocas] = useState(() => objetoSeguroAdubacao2(trocasIniciais));

  // Extras manuais: restaura do banco se disponível
  const [extrasManuais, setExtrasManuais] = useState(() => {
    const init = {};
    normalizarComplementosAdubacao2(complementosSalvos).forEach(c => {
      if (c.isManualExtra && c.produto?.id) {
        init[c.linhaId || c.nutKey] = { produtoId: c.produto.id, doseKgHa: c.doseKgHa, nutriente_alvo: c.nutriente_alvo || c.nutKey || 'dose_manual', nutKey: c.nutKey, isManualLivre: Boolean(c.isManualLivre), usoSeparado: Boolean(c.usoSeparado) };
      }
    });
    return init;
  });
  const [ajustesDose, setAjustesDose] = useState(() => objetoSeguroAdubacao2(ajustesDoseIniciais));
  const [produtosOcultos, setProdutosOcultos] = useState(() => listaSeguraAdubacao2(produtosOcultosIniciais));

  // Garante que checkboxes dos extras salvos fiquem marcados ao carregar
  useEffect(() => {
    const keys = Object.keys(objetoSeguroAdubacao2(extrasManuais));
    if (keys.length === 0) return;
    setMarcados(prev => {
      let changed = false;
      const next = { ...objetoSeguroAdubacao2(prev) };
      keys.forEach(k => { if (!next[k]) { next[k] = true; changed = true; } });
      return changed ? next : prev;
    });
  }, [extrasManuais]);

  const handleExcluirManual = useCallback((key) => {
    setExtrasManuais(prev => {
      const next = { ...objetoSeguroAdubacao2(prev) };
      delete next[key];
      onExtrasChange?.(next);
      return next;
    });
  }, [onExtrasChange]);

  const registrarProdutoOculto = useCallback((item) => {
    if (!item?.linhaId && !item?.produtoId) return;
    setProdutosOcultos(prev => {
      const prevLista = listaSeguraAdubacao2(prev);
      const chave = chaveProdutoOculto(item);
      if (prevLista.some(o => chaveProdutoOculto(o) === chave || o === item.linhaId)) return prevLista;
      const next = [...prevLista, item];
      onProdutosOcultosChange?.(next);
      return next;
    });
  }, [onProdutosOcultosChange]);

  const handleAdicionarManual = useCallback(() => {
    const key = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setExtrasManuais(prev => {
      const next = { ...objetoSeguroAdubacao2(prev), [key]: { produtoId: '', doseKgHa: '', nutriente_alvo: 'dose_manual', nutKey: 'dose_manual', isManualLivre: true, usoSeparado: true } };
      onExtrasChange?.(next);
      return next;
    });
  }, [onExtrasChange]);

  const atualizarAjusteDose = useCallback((linha, ajuste) => {
    const chave = chaveLinhaProduto(linha);
    setAjustesDose(prev => {
      const prevObj = objetoSeguroAdubacao2(prev);
      const next = { ...prevObj, [chave]: { ...(prevObj[chave] || {}), ...ajuste, linhaId: chave } };
      onAjustesDoseChange?.(next);
      return next;
    });
  }, [onAjustesDoseChange]);

  const handleDoseChange = useCallback((linha, valor) => {
    atualizarAjusteDose(linha, { ...ajustarDoseLinha(linha, valor), nutriente_alvo: linha.nutriente_alvo || linha.nutKey });
  }, [atualizarAjusteDose]);

  const handleRestaurarDose = useCallback((linha) => {
    atualizarAjusteDose(linha, { ...restaurarDoseCalculadaLinha(linha), nutriente_alvo: linha.nutriente_alvo || linha.nutKey });
  }, [atualizarAjusteDose]);

  const handleAlvoChange = useCallback((linha, alvo) => {
    const doseCalculada = calcularDoseProdutoPorAlvo(linha.produto, alvo, rec);
    atualizarAjusteDose(linha, {
      nutriente_alvo: alvo,
      dose_calculada_kg_ha: doseCalculada,
      dose_utilizada_kg_ha: doseCalculada ?? linha.dose_utilizada_kg_ha ?? linha.doseKgHa,
      doseKgHa: doseCalculada ?? linha.dose_utilizada_kg_ha ?? linha.doseKgHa,
      dose_ajustada_manualmente: false,
    });
  }, [rec, atualizarAjusteDose]);

  const handleOcultarLinha = useCallback((linha) => {
    const linhaId = chaveLinhaProduto(linha);
    const produtoId = linha?.produto?.id || null;
    const item = { linhaId, produtoId, produtoNome: linha?.produto?.nome || '', nutriente_alvo: linha?.nutriente_alvo || linha?.nutKey || 'dose_manual' };
    registrarProdutoOculto(item);
    if (produtoId) onParcelamentoChange?.(produtoId, null);
    if (produtoId) onPrecoChange?.(produtoId, '');
  }, [onParcelamentoChange, onPrecoChange, registrarProdutoOculto]);

  const handleRemoverExtra = useCallback((key, data, isManualLivre = false) => {
    const produtoId = data?.produtoId || null;
    registrarProdutoOculto({
      linhaId: key,
      produtoId,
      produtoNome: listaSeguraAdubacao2(todosSemFiltro).find(produto => produto.id === produtoId)?.nome || '',
      nutriente_alvo: data?.nutriente_alvo || data?.nutKey || key || 'dose_manual',
    });
    if (produtoId) onParcelamentoChange?.(produtoId, null);
    if (produtoId) onPrecoChange?.(produtoId, '');
    setExtrasManuais(prev => {
      const next = { ...objetoSeguroAdubacao2(prev) };
      if (isManualLivre || String(key).startsWith('manual-')) {
        delete next[key];
      } else {
        next[key] = {
          produtoId: '',
          doseKgHa: '',
          nutriente_alvo: data?.nutriente_alvo || data?.nutKey || key || 'dose_manual',
          nutKey: data?.nutKey || key,
          isManualLivre: false,
          usoSeparado: false,
        };
      }
      onExtrasChange?.(next);
      return next;
    });
  }, [onExtrasChange, onParcelamentoChange, onPrecoChange, registrarProdutoOculto, todosSemFiltro]);

  const handleRestaurarOcultos = useCallback(() => {
    setProdutosOcultos([]);
    onProdutosOcultosChange?.([]);
  }, [onProdutosOcultosChange]);

  const toggleMarcado = (key) => {
    const marcadosObj = objetoSeguroAdubacao2(marcados);
    const vaiAtivar = !marcadosObj[key];
    const next = { ...marcadosObj, [key]: vaiAtivar };
    setMarcados(next);
    onMarcadosChange?.(next);

    if (!vaiAtivar) {
      setExtrasManuais(prev => {
        const prevObj = objetoSeguroAdubacao2(prev);
        if (!(key in prevObj)) return prev;
        const extrasAtualizados = { ...prevObj };
        delete extrasAtualizados[key];
        onExtrasChange?.(extrasAtualizados);
        return extrasAtualizados;
      });
    }
  };

  const handleTrocarProduto = useCallback((nutKey, produto) => {
    setTrocas(prev => {
      const next = { ...objetoSeguroAdubacao2(prev), [nutKey]: produto.id };
      onTrocasChange?.(next);
      return next;
    });
  }, [onTrocasChange]);

  // Linhas de produtos: produto salvo como principal; complementos salvos pulam cascata automática
  const linhasProdutos = useMemo(() => {
    if (!rec) return [];
    const recFiltrado = { ...rec };
    if (!marcados['N']) delete recFiltrado.N;
    if (!marcados['P']) delete recFiltrado.P;
    if (!marcados['K']) delete recFiltrado.K;
    if (!marcados['B']) delete recFiltrado.B;
    const prodSalvo = resultado.substituirSalvo ? null : (resultado.produtoSugerido || null);
    const doseSalva = resultado.substituirSalvo ? null : (resultado.doseProdutoHa ?? null);
    const ocultosSet = new Set(listaSeguraAdubacao2(produtosOcultos).flatMap(chavesProdutoOculto).filter(Boolean));
    return montarLinhasProdutos(todos, recFiltrado, trocas, prodSalvo, doseSalva, resultado.substituirSalvo ? null : normalizarComplementosAdubacao2(complementosSalvos), rec, ajustesDose)
      .filter(linha => !linhaEstaOculta(linha, ocultosSet));
  }, [todos, rec, marcados, trocas, resultado.produtoSugerido, resultado.doseProdutoHa, resultado.substituirSalvo, complementosSalvos, ajustesDose, produtosOcultos]);

  const nutrientesNaoAtendidos = useMemo(() => listarNutrientesNaoAtendidos(rec, linhasProdutos), [rec, linhasProdutos]);
  const balancoNutrientes = useMemo(() => calcularBalancoNutrientes(rec, [
    ...linhasProdutos,
    ...Object.values(objetoSeguroAdubacao2(extrasManuais)).map(extra => ({
      produto: listaSeguraAdubacao2(todosSemFiltro).find(produto => produto.id === extra?.produtoId),
      doseKgHa: extra?.doseKgHa,
    })),
  ]), [rec, linhasProdutos, extrasManuais, todosSemFiltro]);

  const handleExtraChange = useCallback((key, data) => {
    const extrasObj = objetoSeguroAdubacao2(extrasManuais);
    if (!data?.produtoId || produtoNuloAdubacao2({ id: data.produtoId })) {
      setExtrasManuais(prev => {
        const next = { ...objetoSeguroAdubacao2(prev), [key]: { ...data, produtoId: '', doseKgHa: '' } };
        onExtrasChange?.(next);
        return next;
      });
      return;
    }
    if (data?.produtoId) {
      const duplicidade = resolverAcaoProdutoDuplicado({ produtoId: data.produtoId, linhas: linhasProdutos, manuais: extrasObj });
      if (duplicidade.duplicado && String(key).startsWith('manual-') && typeof window !== 'undefined') {
        const usarSeparado = window.confirm('Este produto já existe neste talhão. Clique em OK para adicionar como uso separado ou Cancelar para editar a linha existente.');
        if (!usarSeparado) return;
      }
    }
    setExtrasManuais(prev => {
      const next = { ...objetoSeguroAdubacao2(prev), [key]: data };
      onExtrasChange?.(next);
      return next;
    });
  }, [extrasManuais, linhasProdutos, onExtrasChange]);

  // Elementos manuais: micronutrientes e nutrientes cuja recomendação automática é zero.
  const elementosExtrasMarcados = useMemo(() => {
    return listarElementosManuaisMarcados(TODOS_ELEMENTOS_GRID, marcados, rec);
  }, [marcados, rec]);

  // Rodapé: totais
  const totais = useMemo(() => {
    let doseTotalHa = 0, totalKgAll = 0, custoTotalHa = 0, custoTotalTalhao = 0;
    linhasProdutos.forEach(l => {
      const dose = l.doseKgHa || 0;
      doseTotalHa += dose;
      totalKgAll += area ? dose * area : 0;
      const preco = precosProd?.[l.produto.id];
      const precoNum = preco != null && preco !== '' ? parseFloat(preco) : null;
      if (precoNum != null) {
        custoTotalHa += dose * precoNum;
        custoTotalTalhao += dose * precoNum * (area || 0);
      }
    });
    Object.values(objetoSeguroAdubacao2(extrasManuais)).forEach(extra => {
      const dose = Number(extra?.doseKgHa);
      if (!Number.isFinite(dose) || dose <= 0) return;
      doseTotalHa += dose;
      totalKgAll += area ? dose * area : 0;
      const preco = extra?.produtoId ? precosProd?.[extra.produtoId] : null;
      const precoNum = preco != null && preco !== '' ? Number(preco) : null;
      if (precoNum != null && Number.isFinite(precoNum)) {
        custoTotalHa += dose * precoNum;
        custoTotalTalhao += dose * precoNum * (area || 0);
      }
    });
    return { doseTotalHa, totalKgAll, custoTotalHa, custoTotalTalhao };
  }, [linhasProdutos, extrasManuais, precosProd, area]);

  return (
    <div className="bg-muted/20 border-l-4 border-primary px-5 py-4 space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-base text-foreground">{talhao.nome}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
            {talhao.area_ha && <span>{talhao.area_ha} ha</span>}
            {talhao.num_plantas && <span>{talhao.num_plantas.toLocaleString()} plantas</span>}
            {mediaBienal != null && <span>Média: <strong className="text-foreground">{mediaBienal.toFixed(1)} sc/ha</strong></span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadgePlan rec={rec} />
          <button type="button" onClick={onFechar}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 hover:bg-muted/40 transition-colors">
            Fechar detalhes <ChevronDown className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>
      </div>

      {/* CORREÇÃO 1: Grid de nutrientes — todos sempre visíveis com checkbox */}
      {rec ? (
        <div className="space-y-2">
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
            {TODOS_ELEMENTOS_GRID.map(el => {
              const ativo = marcados[el.key];
              let valor = null;
              let classeBadge = null;

              if (el.tipo === 'dose' && el.temRec) {
                valor = rec[el.key];
              } else if (el.tipo === 'dose' && !el.temRec) {
                // dose manual (Mg) — sem valor automático
              } else if (el.tipo === 'class') {
                const cls = micros[el.key];
                if (cls?.classe) classeBadge = cls.classe;
              } else if (el.tipo === 'valor') {
                valor = analise?.materia_organica ?? null;
              }

              const temDeficit = el.temRec && valor != null && valor > 0;

              // ── Teor do solo para exibição ──────────────────────────────
              let teor = null; // { texto, unidade }
              const fmtT = (v) => v != null ? Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : null;
              if (el.key === 'K') {
                const k0 = analise?.potassio != null ? fmtT(analise.potassio) : null;
                const k1 = analise2040?.potassio != null ? fmtT(analise2040.potassio) : null;
                if (k0 != null && k1 != null) teor = { texto: `${k0} (0-20) | ${k1} (20-40)`, unidade: 'mg/dm³' };
                else if (k0 != null) teor = { texto: k0, unidade: 'mg/dm³' };
              } else if (el.key === 'P') {
                const p0 = analise?.fosforo != null ? fmtT(analise.fosforo) : null;
                const p1 = analise2040?.fosforo != null ? fmtT(analise2040.fosforo) : null;
                if (p0 != null && p1 != null) teor = { texto: `${p0} (0-20) | ${p1} (20-40)`, unidade: 'mg/dm³' };
                else if (p0 != null) teor = { texto: p0, unidade: 'mg/dm³' };
              } else if (el.key === 'Ca') {
                const v = analise?.calcio; if (v != null) teor = { texto: fmtT(v), unidade: 'cmolc/dm³' };
              } else if (el.key === 'Mg') {
                const v = analise?.magnesio; if (v != null) teor = { texto: fmtT(v), unidade: 'cmolc/dm³' };
              } else if (el.key === 'B') {
                const v = analise?.boro; if (v != null) teor = { texto: fmtT(v), unidade: 'mg/dm³' };
              } else if (el.key === 'Zn') {
                const v = analise?.zinco; if (v != null) teor = { texto: fmtT(v), unidade: 'mg/dm³' };
              } else if (el.key === 'Cu') {
                const v = analise?.cobre; if (v != null) teor = { texto: fmtT(v), unidade: 'mg/dm³' };
              } else if (el.key === 'Mn') {
                const v = analise?.manganes; if (v != null) teor = { texto: fmtT(v), unidade: 'mg/dm³' };
              } else if (el.key === 'Fe') {
                const v = analise?.ferro; if (v != null) teor = { texto: fmtT(v), unidade: 'mg/dm³' };
              }

              return (
                <div key={el.key}
                  className={`relative bg-card border rounded-lg p-2.5 text-center transition-all ${ativo ? 'border-primary/40 shadow-sm' : 'border-border opacity-60'}`}>
                  {/* Checkbox no canto superior direito */}
                  <div className="absolute top-1.5 right-1.5">
                    <input type="checkbox" checked={ativo}
                      onChange={() => toggleMarcado(el.key)}
                      className="w-3 h-3 rounded accent-primary cursor-pointer" />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium mb-1">{el.label}</p>
                  {el.tipo === 'dose' && el.temRec && (
                    <>
                      <p className={`text-base font-bold tabular-nums ${ativo ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {valor != null ? valor : '—'}
                      </p>
                      {valor != null && <p className="text-[9px] text-muted-foreground">{el.unit}</p>}
                    </>
                  )}
                  {el.tipo === 'class' && (
                    <>
                      <p className="text-base font-bold text-muted-foreground">—</p>
                      {classeBadge && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${classBadgeColor(classeBadge)}`}>
                          {classeBadge}
                        </span>
                      )}
                    </>
                  )}
                  {el.tipo === 'valor' && (
                    <>
                      <p className={`text-base font-bold tabular-nums ${ativo ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {valor != null ? fmt(valor, 1) : '—'}
                      </p>
                      {valor != null && <p className="text-[9px] text-muted-foreground">dag/kg</p>}
                    </>
                  )}
                  {el.tipo === 'dose' && !el.temRec && (
                    <p className="text-base font-bold text-muted-foreground">—</p>
                  )}
                  {/* Teor do solo */}
                  {teor && (
                    <p className="text-[9px] text-blue-600 mt-1 leading-tight font-medium truncate" title={`Solo: ${teor.texto} ${teor.unidade}`}>
                      Solo: {teor.texto} {teor.unidade}
                    </p>
                  )}
                  {/* Indicador de déficit */}
                  {temDeficit && ativo && (
                    <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-primary"></div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-primary mr-1 align-middle"></span>
            Elementos com déficit (marcados automaticamente). Marque outros para adicionar à tabela de produtos.
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
          Sem recomendação calculada. Informe produtividade e análise de solo na aba Análises.
        </div>
      )}

      {/* Tabela de Produtos */}
      {rec && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Produtos Recomendados</p>
          {produtosOcultos.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2">
              <span className="text-slate-700">{produtosOcultos.length} produto(s) oculto(s) neste talhão.</span>
              <button type="button" onClick={handleRestaurarOcultos}
                className="h-7 px-2 rounded border border-border bg-background hover:bg-muted/60 text-foreground">
                Restaurar produtos ocultos
              </button>
            </div>
          )}
          {nutrientesNaoAtendidos.length > 0 && (
            <div className="mb-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Nutrientes não atendidos pelo filtro atual: {nutrientesNaoAtendidos.join(', ')}.
            </div>
          )}
          <TabelaProdutos
            linhas={linhasProdutos}
            area={area}
            precos={precosProd}
            onPrecoChange={onPrecoChange}
            parcelamentos={parcelamentosProd}
            onParcelamentoChange={onParcelamentoChange}
            onAplicarParcTodos={onAplicarParcTodos}
            todos={todosSemFiltro}
            onTrocarProduto={handleTrocarProduto}
            elementosExtras={elementosExtrasMarcados}
            extrasManuais={extrasManuais}
            onExtraChange={handleExtraChange}
            onDoseChange={handleDoseChange}
            onRestaurarDose={handleRestaurarDose}
            onAlvoChange={handleAlvoChange}
            onAdicionarManual={handleAdicionarManual}
            onExcluirManual={handleExcluirManual}
            onOcultarLinha={handleOcultarLinha}
            onRemoverExtra={handleRemoverExtra}
          />
          {balancoNutrientes.length > 0 && (
            <div className="mt-3 rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/20">
                  <tr>
                    {['Nutriente', 'Necessidade', 'Fornecido', 'Saldo', 'Situação'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {balancoNutrientes.map(item => (
                    <tr key={item.nutriente} className="border-t border-border/50">
                      <td className="px-3 py-2 font-medium">{item.nutriente}</td>
                      <td className="px-3 py-2 tabular-nums">{item.necessidade != null ? fmt(item.necessidade, 1) : '—'}</td>
                      <td className="px-3 py-2 tabular-nums">{fmt(item.fornecido, 1)}</td>
                      <td className="px-3 py-2 tabular-nums">{item.saldo != null ? fmt(item.saldo, 1) : '—'}</td>
                      <td className="px-3 py-2">{item.situacao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rodapé: 4 cards de totais */}
      {rec && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {[
            { label: 'Dose total (kg/ha)', value: fmt(totais.doseTotalHa, 1) },
            { label: 'Total aplicado (kg)', value: fmt(totais.totalKgAll, 0) },
            { label: 'Custo total/ha', value: totais.custoTotalHa > 0 ? fmtR(totais.custoTotalHa) : '—' },
            { label: 'Custo total do talhão', value: totais.custoTotalTalhao > 0 ? fmtR(totais.custoTotalTalhao) : '—', destaque: true },
          ].map(c => (
            <div key={c.label} className={`rounded-lg border px-3 py-2.5 ${c.destaque ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'}`}>
              <p className="text-[10px] text-muted-foreground mb-0.5">{c.label}</p>
              <p className={`text-sm font-bold tabular-nums ${c.destaque ? 'text-primary' : 'text-foreground'}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Filtro global de Fornecedor / Produto ─────────────────────────────────────

function FiltroProdutosGlobal({ todos, filtro, onChange }) {
  const [dropFornAberto, setDropFornAberto] = useState(false);
  const dropRef = useRef(null);

  const fornecedores = useMemo(() => {
    const set = new Set();
    todos.forEach(p => {
      const temNPK = (parseFloat(p.n_pct) || 0) > 0 ||
                     (parseFloat(p.p2o5_pct) || 0) > 0 ||
                     (parseFloat(p.k2o_pct) || 0) > 0;
      if (temNPK && p.fornecedor) set.add(p.fornecedor);
    });
    return Array.from(set).sort();
  }, [todos]);

  const produtosFiltrados = useMemo(() => filtrarProdutosPlanejamento(todos, filtro), [todos, filtro]);

  useEffect(() => {
    if (!dropFornAberto) return;
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropFornAberto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropFornAberto]);

  const toggleFornecedor = (f) => {
    const novosForn = filtro.fornecedores.includes(f)
      ? filtro.fornecedores.filter(x => x !== f)
      : [...filtro.fornecedores, f];
    onChange({ ...filtro, fornecedores: novosForn, produtoId: '' });
  };

  const handleProduto = (v) => {
    onChange({ ...filtro, produtoId: v === '__todos__' ? '' : v });
  };

  const toggleFontesSemFornecedor = () => {
    onChange({ ...filtro, produtoId: '', incluirFontesSemFornecedor: !filtro.incluirFontesSemFornecedor });
  };

  const limpar = () => onChange({ fornecedores: [], produtoId: '', incluirFontesSemFornecedor: false });
  const temFiltro = filtro.fornecedores.length > 0 || filtro.produtoId || filtro.incluirFontesSemFornecedor;
  const semProdutos = produtosFiltrados.length === 0;

  return (
    <div className="space-y-2 px-1 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Filter className="w-3.5 h-3.5" /> Filtrar sugestão automática:
        </span>

        <div ref={dropRef} className="relative">
          <button type="button" onClick={() => setDropFornAberto(a => !a)}
            className="h-7 text-xs border border-input rounded px-2 bg-background flex items-center gap-1 min-w-[140px] max-w-[280px] hover:bg-muted/30">
            {filtro.fornecedores.length === 0 ? (
              <span className="text-muted-foreground truncate">Todos fornecedores</span>
            ) : (
              <span className="flex flex-wrap gap-1 overflow-hidden max-h-5">
                {filtro.fornecedores.map(f => (
                  <span key={f} className="inline-flex items-center gap-0.5 bg-primary/10 text-primary rounded px-1 text-[10px] font-medium shrink-0">
                    {f}
                    <span role="button"
                      onMouseDown={e => { e.stopPropagation(); e.preventDefault(); toggleFornecedor(f); }}
                      className="hover:text-destructive cursor-pointer leading-none">x</span>
                  </span>
                ))}
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />
          </button>
          {dropFornAberto && (
            <div className="absolute z-50 top-full left-0 mt-1 min-w-[200px] bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
              {fornecedores.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum fornecedor cadastrado</p>
              ) : fornecedores.map(f => (
                <button key={f} type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => toggleFornecedor(f)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${filtro.fornecedores.includes(f) ? 'bg-primary border-primary text-white' : 'border-input'}`}>
                    {filtro.fornecedores.includes(f) && <span className="text-[8px] leading-none font-bold">✓</span>}
                  </span>
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        <select value={filtro.produtoId || '__todos__'} onChange={e => handleProduto(e.target.value)}
          className="h-7 text-xs border border-input rounded px-2 bg-background text-foreground max-w-[220px]">
          <option value="__todos__">Todos produtos</option>
          {produtosFiltrados.map(p => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={!!filtro.incluirFontesSemFornecedor} onChange={toggleFontesSemFornecedor}
            className="w-3.5 h-3.5 rounded accent-primary" />
          Incluir fontes simples sem fornecedor
        </label>

        {temFiltro && (
          <button type="button" onClick={limpar}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive underline">
            <X className="w-3 h-3" /> Limpar filtro
          </button>
        )}

        <span className={`text-[10px] font-medium ${semProdutos ? 'text-destructive' : 'text-muted-foreground'}`}>
          {produtosFiltrados.length} produto(s) disponível(is)
        </span>
      </div>

      {semProdutos && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
          Nenhum produto atende ao filtro atual. O recálculo não usará produtos fora do filtro.
        </div>
      )}
    </div>
  );
}

// ── Cards de métricas ─────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, subColor }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex-1 min-w-0">
      <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>
      <p className="text-xl font-bold text-foreground tabular-nums truncate">{value}</p>
      <p className={`text-xs mt-0.5 truncate ${subColor || 'text-muted-foreground'}`}>{sub}</p>
    </div>
  );
}

// ── Menu de ações ─────────────────────────────────────────────────────────────

function MenuAcoes({ onRecalcular, onLimpar }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setAberto(a => !a)}
        className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground transition-colors">
        <MoreVertical className="w-4 h-4" />
      </button>
      {aberto && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg min-w-[140px] overflow-hidden"
          onMouseLeave={() => setAberto(false)}>
          <button type="button" onClick={() => { onRecalcular(); setAberto(false); }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60">Recalcular</button>
          <button type="button" onClick={() => { onLimpar(); setAberto(false); }}
            className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-destructive/10">Limpar</button>
        </div>
      )}
    </div>
  );
}

function seletorPoliticaRecalculo(valor, onChange) {
  return (
    <select value={valor} onChange={e => onChange(e.target.value)}
      className="h-8 text-xs border border-input rounded px-2 bg-background text-foreground">
      <option value="manter">Manter produtos salvos</option>
      <option value="substituir">Substituir salvos pelo filtro atual</option>
    </select>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function AbaPlanejamento2({ resultados, todos, talhoes = [], calculando, calculandoTalhaoId = null, podeCacularTodos, onRecalcular, onRecalcularTalhao, onSalvar, onPrecosChange, onParcelamentosChange, onProdutosEfetivosChange, precosIniciais, parcelamentosIniciais, registrosSalvos, precosNotasMap }) {
  const [expandidos, setExpandidos] = useState(new Set());
  const [precos, setPrecos] = useState(() => precosIniciais || {});
  const [parcelamentos, setParcelamentos] = useState(() => parcelamentosIniciais || {});
  const [filtro, setFiltro] = useState({ fornecedores: [], produtoId: '', incluirFontesSemFornecedor: false });
  const [politicaRecalculo, setPoliticaRecalculo] = useState('manter');
  const [produtosCalculo, setProdutosCalculo] = useState(() => todos || []);
  const [filtroPendente, setFiltroPendente] = useState(false);
  // Estado de trocas, marcados e extras manuais por talhão — persistidos no banco
  const [trocasPorTalhao, setTrocasPorTalhao] = useState({});
  const [marcadosPorTalhao, setMarcadosPorTalhao] = useState({});
  const [extrasPorTalhao, setExtrasPorTalhao] = useState({});
  const [ajustesDosePorTalhao, setAjustesDosePorTalhao] = useState({});
  const [produtosOcultosPorTalhao, setProdutosOcultosPorTalhao] = useState({});

  const handleExtrasChange = useCallback((talhaoId, extras) => {
    setExtrasPorTalhao(prev => ({ ...prev, [talhaoId]: extras }));
  }, []);

  useEffect(() => {
    if (resultados) return;
    setFiltro({ fornecedores: [], produtoId: '', incluirFontesSemFornecedor: false });
    setPoliticaRecalculo('manter');
    setProdutosCalculo(todos || []);
    setFiltroPendente(false);
    setTrocasPorTalhao({});
    setMarcadosPorTalhao({});
    setExtrasPorTalhao({});
    setAjustesDosePorTalhao({});
    setProdutosOcultosPorTalhao({});
  }, [resultados, todos]);

  const todosFiltered = useMemo(() => filtrarProdutosPlanejamento(todos, filtro), [todos, filtro]);
  const resultadosVisiveis = useMemo(() => {
    const listaResultados = listaSeguraAdubacao2(resultados).filter(r => r?.talhao);
    if (listaResultados.length > 0) return listaResultados;
    return listaSeguraAdubacao2(talhoes).filter(t => t?.id).map(talhao => ({
      talhao,
      mediaBienal: null,
      analise: null,
      analise2040: null,
      rec: null,
      produtoSugerido: null,
      doseProdutoHa: null,
      temRegistroSalvo: false,
    }));
  }, [resultados, talhoes]);

  const toggleExpand = (id) => setExpandidos(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const expandirTodos = () => setExpandidos(new Set(resultadosVisiveis.filter(r => r?.talhao?.id).map(r => r.talhao.id)));
  const recolherTodos = () => setExpandidos(new Set());

  const handleFiltroChange = useCallback((next) => {
    setFiltro(next);
    setFiltroPendente(true);
  }, []);

  const handleRecalcularComFiltro = useCallback(() => {
    const substituirSalvos = politicaRecalculo === 'substituir';
    if (todosFiltered.length === 0) return;
    setProdutosCalculo(todosFiltered);
    setFiltroPendente(false);
    onRecalcular(todosFiltered, { substituirSalvos });
  }, [onRecalcular, politicaRecalculo, todosFiltered]);

  const handleRecalcularTalhaoComFiltro = useCallback((talhaoId) => {
    const substituirSalvos = politicaRecalculo === 'substituir';
    if (!talhaoId || todosFiltered.length === 0) return;
    setProdutosCalculo(todosFiltered);
    setFiltroPendente(false);
    onRecalcularTalhao?.(talhaoId, todosFiltered, {
      substituirSalvos,
      estadoPlanejamento: {
        trocasPorTalhao,
        marcadosPorTalhao,
        extrasPorTalhao,
        ajustesDosePorTalhao,
        produtosOcultosPorTalhao,
      },
    });
  }, [onRecalcularTalhao, politicaRecalculo, todosFiltered, trocasPorTalhao, marcadosPorTalhao, extrasPorTalhao, ajustesDosePorTalhao, produtosOcultosPorTalhao]);

  // Sincroniza quando o pai restaura preços/parcelamentos/trocas/marcados do banco
  // Merge por chave: só preenche chaves ainda ausentes no estado local
  useEffect(() => {
    const precosIniciaisObj = objetoSeguroAdubacao2(precosIniciais);
    if (Object.keys(precosIniciaisObj).length === 0) return;
    setPrecos(prev => {
      const merged = { ...precosIniciaisObj };
      Object.keys(objetoSeguroAdubacao2(prev)).forEach(k => { merged[k] = prev[k]; }); // local sobrescreve salvo
      return merged;
    });
  }, [precosIniciais]);
  useEffect(() => {
    const parcelamentosIniciaisObj = objetoSeguroAdubacao2(parcelamentosIniciais);
    if (Object.keys(parcelamentosIniciaisObj).length === 0) return;
    setParcelamentos(prev => {
      const merged = { ...parcelamentosIniciaisObj };
      Object.keys(objetoSeguroAdubacao2(prev)).forEach(k => { merged[k] = prev[k]; }); // local sobrescreve salvo
      return merged;
    });
  }, [parcelamentosIniciais]);
  // Restaura trocas, marcações e produtos manuais dos registros salvos.
  useEffect(() => {
    const registrosLista = listaSeguraAdubacao2(registrosSalvos);
    if (registrosLista.length === 0) return;
    const trocasAgg = {};
    const marcadosAgg = {};
    const extrasAgg = {};
    const ajustesAgg = {};
    const ocultosAgg = {};
    registrosLista.forEach(r => {
      const det = objetoSeguroAdubacao2(r.detalhamento);
      if (Object.keys(objetoSeguroAdubacao2(det.trocas)).length > 0) trocasAgg[r.talhao_id] = objetoSeguroAdubacao2(det.trocas);
      if (Object.keys(objetoSeguroAdubacao2(det.marcados)).length > 0) marcadosAgg[r.talhao_id] = objetoSeguroAdubacao2(det.marcados);
      const ocultos = listaSeguraAdubacao2(det.produtos_ocultos);
      if (ocultos.length > 0) ocultosAgg[r.talhao_id] = ocultos;
      if (det.produtoSugerido?.id) {
        const key = `n_pct:${det.produtoSugerido.id}`;
        ajustesAgg[r.talhao_id] = {
          ...(ajustesAgg[r.talhao_id] || {}),
          [key]: {
            linhaId: key,
            dose_calculada_kg_ha: det.dose_calculada_kg_ha ?? det.doseProdutoHa,
            dose_utilizada_kg_ha: det.dose_utilizada_kg_ha ?? det.doseProdutoHa,
            doseKgHa: det.dose_utilizada_kg_ha ?? det.doseProdutoHa,
            dose_ajustada_manualmente: Boolean(det.dose_ajustada_manualmente),
            nutriente_alvo: det.nutriente_alvo || 'n_pct',
          },
        };
      }
      const extras = {};
      normalizarComplementosAdubacao2(det.complementos).forEach(comp => {
        if (comp?.produto?.id) {
          const key = comp.linhaId || `${comp.nutKey || comp.nutriente_alvo || 'produto'}:${comp.produto.id}`;
          ajustesAgg[r.talhao_id] = {
            ...(ajustesAgg[r.talhao_id] || {}),
            [key]: {
              linhaId: key,
              dose_calculada_kg_ha: comp.dose_calculada_kg_ha ?? comp.doseKgHa,
              dose_utilizada_kg_ha: comp.dose_utilizada_kg_ha ?? comp.doseKgHa,
              doseKgHa: comp.dose_utilizada_kg_ha ?? comp.doseKgHa,
              dose_ajustada_manualmente: Boolean(comp.dose_ajustada_manualmente),
              nutriente_alvo: comp.nutriente_alvo || comp.nutKey || 'dose_manual',
            },
          };
        }
        if (comp?.isManualExtra && comp?.nutKey && comp?.produto?.id) {
          extras[comp.linhaId || comp.nutKey] = {
            produtoId: comp.produto.id,
            doseKgHa: comp.dose_utilizada_kg_ha ?? comp.doseKgHa,
            nutriente_alvo: comp.nutriente_alvo || comp.nutKey || 'dose_manual',
            nutKey: comp.nutKey,
            isManualLivre: Boolean(comp.isManualLivre),
            usoSeparado: Boolean(comp.usoSeparado),
          };
        }
      });
      if (Object.keys(extras).length > 0) extrasAgg[r.talhao_id] = extras;
    });
    if (Object.keys(trocasAgg).length > 0) {
      setTrocasPorTalhao(prev => {
        const merged = { ...trocasAgg };
        Object.keys(objetoSeguroAdubacao2(prev)).forEach(k => { merged[k] = prev[k]; });
        return merged;
      });
    }
    if (Object.keys(marcadosAgg).length > 0) {
      setMarcadosPorTalhao(prev => {
        const merged = { ...marcadosAgg };
        Object.keys(objetoSeguroAdubacao2(prev)).forEach(k => { merged[k] = prev[k]; });
        return merged;
      });
    }
    if (Object.keys(extrasAgg).length > 0) {
      setExtrasPorTalhao(prev => {
        const merged = { ...extrasAgg };
        Object.keys(objetoSeguroAdubacao2(prev)).forEach(k => { merged[k] = prev[k]; });
        return merged;
      });
    }
    if (Object.keys(ajustesAgg).length > 0) {
      setAjustesDosePorTalhao(prev => {
        const merged = { ...ajustesAgg };
        Object.keys(objetoSeguroAdubacao2(prev)).forEach(k => { merged[k] = prev[k]; });
        return merged;
      });
    }
    if (Object.keys(ocultosAgg).length > 0) {
      setProdutosOcultosPorTalhao(prev => {
        const merged = { ...ocultosAgg };
        Object.keys(objetoSeguroAdubacao2(prev)).forEach(k => { merged[k] = prev[k]; });
        return merged;
      });
    }
  }, [registrosSalvos]);

  // Preenche preços das notas fiscais para produtos sem preço manual
  useEffect(() => {
    const precosNotasObj = objetoSeguroAdubacao2(precosNotasMap);
    if (Object.keys(precosNotasObj).length === 0) return;
    setPrecos(prev => {
      const next = { ...prev };
      let changed = false;
      Object.entries(precosNotasObj).forEach(([prodId, media]) => {
        if (!next[prodId] && next[prodId] !== 0) {
          next[prodId] = String(media);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [precosNotasMap]);

  // Notifica pai quando preços ou parcelamentos mudam
  useEffect(() => { onPrecosChange?.(precos); }, [precos]);
  useEffect(() => { onParcelamentosChange?.(parcelamentos); }, [parcelamentos]);



  const handlePrecoChange = useCallback((prodId, val) => {
    setPrecos(prev => ({ ...prev, [prodId]: val }));
  }, []);

  const handleParcelamentoChange = useCallback((talhaoId, prodId, parc) => {
    setParcelamentos(prev => ({
      ...prev,
      [talhaoId]: { ...(prev[talhaoId] || {}), [prodId]: parc },
    }));
  }, []);

  const handleAplicarParcTodos = useCallback((prodId, parc) => {
    setParcelamentos(prev => {
      const next = { ...prev };
      resultadosVisiveis.filter(r => r?.talhao?.id).forEach(r => {
        next[r.talhao.id] = { ...(next[r.talhao.id] || {}), [prodId]: parc };
      });
      return next;
    });
  }, [resultadosVisiveis]);

  const handleTrocasChange = useCallback((talhaoId, trocas) => {
    setTrocasPorTalhao(prev => ({ ...prev, [talhaoId]: trocas }));
  }, []);

  const handleMarcadosChange = useCallback((talhaoId, marcados) => {
    setMarcadosPorTalhao(prev => ({ ...prev, [talhaoId]: marcados }));
  }, []);

  const handleAjustesDoseChange = useCallback((talhaoId, ajustes) => {
    setAjustesDosePorTalhao(prev => ({ ...prev, [talhaoId]: ajustes }));
  }, []);

  const handleProdutosOcultosChange = useCallback((talhaoId, ocultos) => {
    setProdutosOcultosPorTalhao(prev => ({ ...prev, [talhaoId]: listaSeguraAdubacao2(ocultos) }));
  }, []);

  // Expõe trocas, marcados e complementos calculados para o pai usar no handleSalvarTudo
  useEffect(() => {
    if (!onProdutosEfetivosChange || !resultados) return;
    const idsSalvos = new Set((registrosSalvos || []).map(r => r.talhao_id));
    const pendente = resultados.some(r =>
      r.rec && idsSalvos.has(r.talhao.id) && r.temRegistroSalvo && !r.produtoSugerido && r.doseProdutoHa == null
    );
    if (pendente && todos.length === 0) return;

    const mapa = montarProdutosEfetivosPlanejamento({
      resultados,
      registrosSalvos,
      todosFiltrados: produtosCalculo,
      todosCatalogo: todos,
      trocasPorTalhao,
      marcadosPorTalhao,
      extrasPorTalhao,
      ajustesDosePorTalhao,
      produtosOcultosPorTalhao,
      criarMarcacoesPadraoFn: criarMarcacoesPadrao,
      elementos: TODOS_ELEMENTOS_GRID,
    });
    onProdutosEfetivosChange(mapa);
  }, [produtosCalculo, resultados, registrosSalvos, todos, trocasPorTalhao, marcadosPorTalhao, extrasPorTalhao, ajustesDosePorTalhao, produtosOcultosPorTalhao]);

  const metricas = useMemo(() => {
    const resultadosLista = resultadosVisiveis;
    if (resultadosLista.length === 0) return null;
    const comRec = resultadosLista.filter(r => r.rec);
    const areaTotal = resultadosLista.reduce((s, r) => s + (r.talhao.area_ha || 0), 0);

    let custoFazendaTotal = 0;
    let custoFazendaHaSum = 0;
    let custoFazendaHaCount = 0;
    let somaSacasArea = 0;
    const efetivosMetricas = montarProdutosEfetivosPlanejamento({
      resultados: comRec,
      registrosSalvos,
      todosFiltrados: produtosCalculo,
      todosCatalogo: todos,
      trocasPorTalhao,
      marcadosPorTalhao,
      extrasPorTalhao,
      ajustesDosePorTalhao,
      produtosOcultosPorTalhao,
      criarMarcacoesPadraoFn: criarMarcacoesPadrao,
      elementos: TODOS_ELEMENTOS_GRID,
    });

    comRec.forEach(r => {
      const area = r.talhao.area_ha || 0;
      const efetivo = efetivosMetricas[r.talhao.id];
      const linhas = [
        efetivo?.produto ? { produto: efetivo.produto, doseKgHa: efetivo.doseKgHa } : null,
        ...listaSeguraAdubacao2(efetivo?.complementos),
      ].filter(Boolean);
      linhas.forEach(l => {
        if (!l?.produto?.id) return;
        const preco = precos[l.produto.id];
        const precoNum = preco != null && preco !== '' ? parseFloat(preco) : null;
        if (precoNum != null && l.doseKgHa != null) {
          const custo = l.doseKgHa * precoNum;
          custoFazendaHaSum += custo;
          custoFazendaHaCount++;
          custoFazendaTotal += custo * area;
        }
      });
      if (r.mediaBienal != null) somaSacasArea += r.mediaBienal * area;
    });

    const custoSaca = custoFazendaTotal > 0 && somaSacasArea > 0 ? custoFazendaTotal / somaSacasArea : null;

    return {
      calculados: comRec.length,
      total: resultadosLista.length,
      pct: resultadosLista.length > 0 ? Math.round((comRec.length / resultadosLista.length) * 100) : 0,
      areaTotal,
      mediaSc: comRec.length > 0 ? comRec.reduce((s, r) => s + (r.mediaBienal || 0), 0) / comRec.length : null,
      custoFazendaTotal: custoFazendaTotal > 0 ? custoFazendaTotal : null,
      custoHaMedio: custoFazendaHaCount > 0 ? custoFazendaHaSum / custoFazendaHaCount : null,
      custoSaca,
    };
  }, [resultadosVisiveis, produtosCalculo, precos, registrosSalvos, todos, trocasPorTalhao, marcadosPorTalhao, extrasPorTalhao, ajustesDosePorTalhao, produtosOcultosPorTalhao]);

  if (resultadosVisiveis.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="bg-card border border-border rounded-xl px-4 py-2">
          <FiltroProdutosGlobal todos={todos} filtro={filtro} onChange={handleFiltroChange} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {seletorPoliticaRecalculo(politicaRecalculo, setPoliticaRecalculo)}
          <Button variant="secondary" size="sm" className="gap-1.5 text-xs" disabled={!podeCacularTodos || calculando || todosFiltered.length === 0} onClick={handleRecalcularComFiltro}>
            {calculando ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Calcular todos os talhões
          </Button>
          <Button variant="secondary" size="sm" className="gap-1.5 text-xs" disabled>
            <BarChart2 className="w-3.5 h-3.5" /> Comparar estratégias
          </Button>
          <Button size="sm" className="gap-1.5 text-xs bg-green-700 hover:bg-green-800 text-white" disabled>
            <Save className="w-3.5 h-3.5" /> Salvar planejamento
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground text-sm">
          Clique em "Calcular recomendação para todos" na aba Análises para gerar o planejamento.
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {/* 1. Barra de botões */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {seletorPoliticaRecalculo(politicaRecalculo, setPoliticaRecalculo)}
          <Button variant="secondary" size="sm" className="gap-1.5 text-xs" disabled={!podeCacularTodos || calculando || todosFiltered.length === 0} onClick={handleRecalcularComFiltro}>
            {calculando ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Calcular todos os talhões
        </Button>
        <Button variant="secondary" size="sm" className="gap-1.5 text-xs" disabled>
          <BarChart2 className="w-3.5 h-3.5" /> Comparar estratégias
        </Button>
        <Button size="sm" className="gap-1.5 text-xs bg-green-700 hover:bg-green-800 text-white" disabled={!resultados} onClick={onSalvar}>
          <Save className="w-3.5 h-3.5" /> Salvar planejamento
        </Button>
      </div>

      {/* 2. Cards de métricas */}
      {metricas && (
        <div className="flex flex-wrap gap-3">
          <MetricCard label="Talhões calculados" value={`${metricas.calculados}/${metricas.total}`} sub={`${metricas.pct}% concluído`} subColor="text-green-600 font-medium" />
          <MetricCard label="Área total" value={`${metricas.areaTotal.toFixed(1)} ha`} sub="Área planejada" />
          <MetricCard label="Custo total fazenda" value={metricas.custoFazendaTotal != null ? fmtR(metricas.custoFazendaTotal) : '—'} sub="Preencha os preços para calcular" />
          <MetricCard label="Custo/ha médio" value={metricas.custoHaMedio != null ? fmtR(metricas.custoHaMedio) : '—'} sub="Média ponderada" />
          <MetricCard label="Custo/saca" value={metricas.custoSaca != null ? fmtR(metricas.custoSaca) : '—'} sub={metricas.mediaSc != null ? `Base: ${metricas.mediaSc.toFixed(1)} sc/ha` : 'Base: —'} />
        </div>
      )}

      {/* 3. Filtro de fornecedor/produto */}
      <div className="bg-card border border-border rounded-xl px-4 py-2">
        <FiltroProdutosGlobal todos={todos} filtro={filtro} onChange={handleFiltroChange} />
        {filtroPendente && (
          <p className="px-1 pb-2 text-[10px] text-amber-700">
            Filtro alterado. Clique em Calcular todos os talhões ou calcule apenas o talhão desejado.
          </p>
        )}
      </div>

      {/* 4. Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/10">
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Talhão</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Área (ha)</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Prod. (sc/ha)</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">N kg/ha</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">P₂O₅ kg/ha</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">K₂O kg/ha</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">B kg/ha</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Produto principal</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Dose (kg/ha)</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custo/ha</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Custo total</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-2 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {resultadosVisiveis.map((r, i) => {
                const expandido = expandidos.has(r.talhao.id);
                const area = r.talhao.area_ha || 0;

                // CORREÇÃO 2: produto salvo é fonte primária.
                // Fallback automático só ocorre para talhões SEM registro salvo no banco.
                // Se tem registro salvo mas produto ainda null (timing), exibe "..." em vez de sugestão.
                const idsSalvos = new Set((registrosSalvos || []).map(x => x.talhao_id));
                const temRegistroSalvo = r.temRegistroSalvo || idsSalvos.has(r.talhao.id);
                let produtoExibido = r.produtoSugerido || null;
                let doseProdutoHaVivo = r.doseProdutoHa ?? null;
                let produtoCarregando = false;

                if (!produtoExibido && r.rec) {
                  if (temRegistroSalvo) {
                    // Tem registro no banco mas produto ainda não resolveu (timing de query)
                    produtoCarregando = todos.length === 0;
                  } else {
                    // Sem registro salvo: usa sugestão automática livremente
                    if (produtosCalculo.length > 0) {
                      const sugestoes = sugerirProdutosInteligente(produtosCalculo, { N: r.rec.N, P: r.rec.P, K: r.rec.K, B: r.rec.B });
                      const sugN = sugestoes['n_pct'];
                      if (sugN?.produtoId) {
                        const prod = produtosCalculo.find(p => p.id === sugN.produtoId);
                        if (prod) {
                          produtoExibido = prod;
                          const pctN = parseFloat(prod.n_pct) || 0;
                          if (pctN > 0 && r.rec.N != null) doseProdutoHaVivo = Math.round((r.rec.N / (pctN / 100)) * 10) / 10;
                        }
                      }
                    }
                  }
                }

                const precoPrinc = produtoExibido ? precos[produtoExibido.id] : null;
                const precoNum = precoPrinc != null && precoPrinc !== '' ? parseFloat(precoPrinc) : null;
                const custoHa = precoNum != null && doseProdutoHaVivo != null ? precoNum * doseProdutoHaVivo : null;
                const custoTotal = custoHa != null ? custoHa * area : null;
                const carregandoTalhao = calculandoTalhaoId === r.talhao.id;

                return (
                  <React.Fragment key={r.talhao.id}>
                    <tr className={`border-b border-border/50 transition-colors ${expandido ? 'bg-primary/5 border-l-4 border-l-primary' : i%2===0?'':'bg-muted/5'} hover:bg-muted/10`}>
                      <td className="px-3 py-2.5 text-center">
                        <button type="button" onClick={() => toggleExpand(r.talhao.id)}
                          className="text-muted-foreground hover:text-primary transition-colors">
                          {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">{r.talhao.nome}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.talhao.area_ha ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.mediaBienal != null ? r.mediaBienal.toFixed(1) : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.rec?.N ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.rec?.P ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.rec?.K ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{r.rec?.B ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs max-w-[180px]">
                        {produtoCarregando ? (
                          <span className="text-muted-foreground text-xs italic">…</span>
                        ) : produtoExibido ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium truncate max-w-[160px]">{produtoExibido.nome}</span>
                            <span className="flex flex-wrap gap-1">
                              <span className={`text-[9px] rounded-full px-1.5 py-0.5 w-fit border ${temRegistroSalvo && !r.substituirSalvo ? 'font-semibold text-green-700 bg-green-50 border-green-200' : 'text-muted-foreground bg-muted border-border'}`}>
                                {temRegistroSalvo && !r.substituirSalvo ? 'Produto salvo' : 'Produto sugerido'}
                              </span>
                              <span className="text-[9px] rounded-full px-1.5 py-0.5 w-fit border text-blue-700 bg-blue-50 border-blue-100">
                                {origemProdutoCatalogoLabel(produtoExibido)}
                              </span>
                            </span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{doseProdutoHaVivo != null ? doseProdutoHaVivo : (r.rec ? '—' : '—')}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{custoHa != null ? fmtR(custoHa) : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">{custoTotal != null ? fmtR(custoTotal) : '—'}</td>
                      <td className="px-3 py-2.5 text-center"><StatusBadgePlan rec={r.rec} /></td>
                      <td className="px-2 py-2.5">
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px] whitespace-nowrap gap-1.5"
                            disabled={!r.talhao?.id || todosFiltered.length === 0 || calculando || Boolean(calculandoTalhaoId)}
                            onClick={() => handleRecalcularTalhaoComFiltro(r.talhao.id)}
                          >
                            {carregandoTalhao ? (
                              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            Calcular apenas este talhão
                          </Button>
                          <MenuAcoes onRecalcular={() => handleRecalcularTalhaoComFiltro(r.talhao.id)} onLimpar={() => {}} />
                        </div>
                      </td>
                    </tr>
                    {expandido && (
                      <tr>
                        <td colSpan={14} className="p-0 border-b border-border">
                          <PainelTalhao
                            resultado={r}
                            todos={produtosCalculo}
                            todosSemFiltro={todos}
                            precosProd={precos}
                            onPrecoChange={(prodId, val) => handlePrecoChange(prodId, val)}
                            parcelamentosProd={parcelamentos[r.talhao.id] || {}}
                            onParcelamentoChange={(prodId, parc) => handleParcelamentoChange(r.talhao.id, prodId, parc)}
                            onAplicarParcTodos={(prodId, parc) => handleAplicarParcTodos(prodId, parc)}
                            onFechar={() => toggleExpand(r.talhao.id)}
                            marcadosIniciais={marcadosPorTalhao[r.talhao.id] || null}
                            trocasIniciais={trocasPorTalhao[r.talhao.id] || null}
                            complementosSalvos={r.substituirSalvo ? null : ((registrosSalvos || []).find(s => s.talhao_id === r.talhao.id)?.detalhamento?.complementos || null)}
                            ajustesDoseIniciais={ajustesDosePorTalhao[r.talhao.id] || null}
                            produtosOcultosIniciais={produtosOcultosPorTalhao[r.talhao.id] || null}
                            onMarcadosChange={(m) => handleMarcadosChange(r.talhao.id, m)}
                            onTrocasChange={(t) => handleTrocasChange(r.talhao.id, t)}
                            onExtrasChange={(e) => handleExtrasChange(r.talhao.id, e)}
                            onAjustesDoseChange={(a) => handleAjustesDoseChange(r.talhao.id, a)}
                            onProdutosOcultosChange={(o) => handleProdutosOcultosChange(r.talhao.id, o)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/10">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Calculado</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Pendente</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={expandirTodos} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Expandir todos</button>
            <span className="text-muted-foreground">·</span>
            <button type="button" onClick={recolherTodos} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Recolher todos</button>
          </div>
        </div>
      </div>
    </div>
  );
}
