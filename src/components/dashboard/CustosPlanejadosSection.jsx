import React, { useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import { calcularCustoAdubacaoHa } from '@/lib/integracaoPlanejamentos';
import { CUSTO_PENDENTE_FOLIAR, calcularCustoProdutoFoliarDetalhado } from '@/lib/unidadesAplicacoesFoliares';

const GRUPOS_DEFENSIVO = ['Fungicida', 'Inseticida', 'Inseticida Biológico', 'Inseticida de Solo', 'Acaricida'];
const GRUPOS_HERBICIDA = ['Herbicida'];

function calcCustosAdubacaoSolo(planos, talhoes) {
  return planos.reduce((total, plano) => {
    const talhao = talhoes.find(t => t.id === plano.talhao_id);
    const areaHa = Number(talhao?.area_ha) || 0;
    return total + calcularCustoAdubacaoHa(plano) * areaHa;
  }, 0);
}

function calcCustosFoliar(aplicacoes, talhoes) {
  let foliar = 0, defensivo = 0, herbicida = 0, pendencias = 0;
  aplicacoes.forEach(aplic => {
    const talhao = talhoes.find(t => t.id === aplic.talhao_id);
    const areaHa = talhao?.area_ha || 0;
    if (!areaHa) return;
    (aplic.produtos || []).forEach(p => {
      const detalhe = calcularCustoProdutoFoliarDetalhado(p, {
        volumeCaldaHa: aplic.volume_calda_ha,
        areaHa,
      });
      if (!detalhe.valido) {
        pendencias += 1;
        return;
      }
      const custo = detalhe.custo_total;
      if (GRUPOS_DEFENSIVO.includes(p.grupo)) defensivo += custo;
      else if (GRUPOS_HERBICIDA.includes(p.grupo)) herbicida += custo;
      else foliar += custo;
    });
  });
  return { foliar, defensivo, herbicida, pendencias };
}

function moeda(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function CustoCard({ label, valor, sub }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      {valor > 0
        ? <p className="text-xl font-bold text-foreground">{moeda(valor)}</p>
        : <p className="text-sm text-muted-foreground italic">Sem custo planejado</p>
      }
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ——— Modo: Todos os produtores ———
function ResumoCustosGeral({ planos, aplicacoes, talhoes, safra }) {
  const { solo, foliar, defensivo, herbicida, pendencias } = useMemo(() => {
    const planosFiltrados = safra ? planos.filter(p => p.safra === safra) : planos;
    const aplicacoesFiltradas = safra ? aplicacoes.filter(a => a.safra === safra) : aplicacoes;
    const solo = calcCustosAdubacaoSolo(planosFiltrados, talhoes);
    const { foliar, defensivo, herbicida, pendencias } = calcCustosFoliar(aplicacoesFiltradas, talhoes);
    return { solo, foliar, defensivo, herbicida, pendencias };
  }, [planos, aplicacoes, talhoes, safra]);

  const total = solo + foliar + defensivo + herbicida;
  const avisoPendencias = pendencias > 0 ? `${pendencias} produto(s): ${CUSTO_PENDENTE_FOLIAR}` : '';

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-primary" />
        Custos Planejados — Visão Geral
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CustoCard label="Adubação via Solo" valor={solo} />
        <CustoCard label="Adubação Foliar" valor={foliar} sub={avisoPendencias} />
        <CustoCard label="Pragas e Doenças" valor={defensivo} sub={avisoPendencias} />
        <CustoCard label="Plantas Daninhas" valor={herbicida} sub={avisoPendencias} />
      </div>
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">Custo Total Geral Planejado</span>
        {total > 0
          ? <span className="text-2xl font-bold text-primary">{moeda(total)}</span>
          : <span className="text-sm text-muted-foreground italic">Sem custo planejado</span>
        }
      </div>
    </div>
  );
}

// ——— Modo: Produtor específico ———
function ResumoCustosProdutor({ produtor, planos, aplicacoes, talhoes, safra }) {
  const { solo, foliar, defensivo, herbicida, areaTotal, pendencias } = useMemo(() => {
    const talhoesProdutor = talhoes.filter(t => t.codigo_produtor === produtor.codigo);
    const areaTotal = talhoesProdutor.reduce((s, t) => s + (t.area_ha || 0), 0);
    const planosFiltrados = planos.filter(p => p.codigo_produtor === produtor.codigo && (!safra || p.safra === safra));
    const aplicacoesFiltradas = aplicacoes.filter(a => a.codigo_produtor === produtor.codigo && (!safra || a.safra === safra));
    const solo = calcCustosAdubacaoSolo(planosFiltrados, talhoes);
    const { foliar, defensivo, herbicida, pendencias } = calcCustosFoliar(aplicacoesFiltradas, talhoes);
    return { solo, foliar, defensivo, herbicida, areaTotal, pendencias };
  }, [produtor, planos, aplicacoes, talhoes, safra]);

  const total = solo + foliar + defensivo + herbicida;

  const avisoPendencias = pendencias > 0 ? `${pendencias} produto(s): ${CUSTO_PENDENTE_FOLIAR}` : '';

  function linhaProdutor(label, valor, sub = '') {
    const porHa = areaTotal > 0 ? valor / areaTotal : 0;
    return (
      <div key={label} className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 border-b border-border/50 last:border-0 gap-1">
        <span className="text-sm text-foreground">{label}</span>
        {valor > 0 ? (
          <div className="flex items-center gap-3 text-sm font-medium">
            {areaTotal > 0 && (
              <span className="text-muted-foreground">{moeda(porHa)}<span className="font-normal text-xs">/ha</span></span>
            )}
            <span className="font-bold text-foreground">{moeda(valor)}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">Sem custo planejado</span>
        )}
        {sub && <span className="text-xs text-amber-700">{sub}</span>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-primary" />
        Custos do Produtor
      </h2>
      <div className="bg-card border border-border rounded-xl p-4 space-y-0">
        {linhaProdutor('Adubação via Solo', solo)}
        {linhaProdutor('Adubação Foliar', foliar, avisoPendencias)}
        {linhaProdutor('Controle de Pragas e Doenças', defensivo, avisoPendencias)}
        {linhaProdutor('Controle de Plantas Daninhas', herbicida, avisoPendencias)}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 mt-1 gap-1">
          <span className="text-sm font-bold text-primary">Total Geral Planejado</span>
          {total > 0 ? (
            <div className="flex items-center gap-3">
              {areaTotal > 0 && (
                <span className="text-sm text-muted-foreground">{moeda(total / areaTotal)}<span className="text-xs">/ha</span></span>
              )}
              <span className="text-xl font-bold text-primary">{moeda(total)}</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground italic">Sem custo planejado</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustosPlanejadosSection({ produtor, planos, aplicacoesFoliares, talhoes, safra }) {
  if (produtor) {
    return (
      <ResumoCustosProdutor
        produtor={produtor}
        planos={planos}
        aplicacoes={aplicacoesFoliares}
        talhoes={talhoes}
        safra={safra}
      />
    );
  }
  return (
    <ResumoCustosGeral
      planos={planos}
      aplicacoes={aplicacoesFoliares}
      talhoes={talhoes}
      safra={safra}
    />
  );
}
