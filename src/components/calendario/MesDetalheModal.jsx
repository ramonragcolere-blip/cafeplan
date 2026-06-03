import React from 'react';
import { X, Sprout, Leaf, Bug, Flower2, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';

function SecaoDetalhe({ icone: Icone, titulo, cor, itens }) {
  if (!itens || itens.length === 0) return null;
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${cor}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icone className="w-4 h-4" />
        <p className="text-sm font-semibold">{titulo}</p>
        <span className="ml-auto text-xs bg-white/60 px-2 py-0.5 rounded-full font-medium">{itens.length}</span>
      </div>
      <div className="space-y-1.5">
        {itens.map((item, idx) => (
          <div key={idx} className="bg-white/70 rounded-lg px-3 py-2 text-xs space-y-0.5">
            {item.linhas.map((linha, i) => (
              <p key={i} className={i === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}>{linha}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MesDetalheModal({ dados, talhoes, onFechar }) {
  const { mesNome, adubacaoSolo, foliarAdubacao, foliarDefensivo, foliarHerbicida, colheita } = dados;

  // Formatar adubação via solo
  const itensAdubacao = adubacaoSolo.map(p => ({
    linhas: [
      p.produto_nome || 'Produto não definido',
      [p.talhao_nome && `Talhão: ${p.talhao_nome}`, p.dose_rec_manual && `Dose: ${p.dose_rec_manual} kg/ha`].filter(Boolean).join(' · '),
    ].filter(Boolean),
  }));

  // Formatar foliares
  function formatarFoliares(lista) {
    const resultado = [];
    lista.forEach(aplic => {
      (aplic.produtos || []).forEach(p => {
        resultado.push({
          linhas: [
            p.produto_nome || 'Produto',
            [aplic.talhao_nome && `Talhão: ${aplic.talhao_nome}`, p.dose && `${p.dose} ${p.unidade || ''}`].filter(Boolean).join(' · '),
            aplic.titulo && `Aplicação: ${aplic.titulo}`,
          ].filter(Boolean),
        });
      });
    });
    return resultado;
  }

  // Formatar colheita
  const itensColheita = colheita.map(t => ({
    linhas: [
      t.nome,
      [
        t.area_ha && `${t.area_ha} ha`,
        t.dataInicio && `Início: ${new Date(t.dataInicio).toLocaleDateString('pt-BR')}`,
        t.dataFim && `Fim: ${new Date(t.dataFim).toLocaleDateString('pt-BR')}`,
      ].filter(Boolean).join(' · '),
    ].filter(Boolean),
  }));

  const temAlgo = itensAdubacao.length > 0 || foliarAdubacao.length > 0 ||
    foliarDefensivo.length > 0 || foliarHerbicida.length > 0 || colheita.length > 0;

  return (
    <div className="bg-card border-2 border-primary/20 rounded-2xl shadow-xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-primary flex items-center gap-2">
          📅 {mesNome}
        </h2>
        <Button variant="ghost" size="icon" onClick={onFechar} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {!temAlgo && (
        <p className="text-muted-foreground text-sm text-center py-6 italic">Nenhuma atividade planejada para este mês.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SecaoDetalhe
          icone={Sprout}
          titulo="Adubação via Solo"
          cor="bg-lime-50 border-lime-200 text-lime-800"
          itens={itensAdubacao}
        />
        <SecaoDetalhe
          icone={Leaf}
          titulo="Adubação Foliar"
          cor="bg-green-50 border-green-200 text-green-800"
          itens={formatarFoliares(foliarAdubacao)}
        />
        <SecaoDetalhe
          icone={Bug}
          titulo="Controle de Pragas e Doenças"
          cor="bg-orange-50 border-orange-200 text-orange-800"
          itens={formatarFoliares(foliarDefensivo)}
        />
        <SecaoDetalhe
          icone={Flower2}
          titulo="Controle de Plantas Daninhas"
          cor="bg-yellow-50 border-yellow-200 text-yellow-800"
          itens={formatarFoliares(foliarHerbicida)}
        />
        <SecaoDetalhe
          icone={Coffee}
          titulo="Colheita Prevista"
          cor="bg-amber-50 border-amber-200 text-amber-800"
          itens={itensColheita}
        />
      </div>
    </div>
  );
}