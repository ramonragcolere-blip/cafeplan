import React from 'react';

const ICONES = [
  { key: 'adubacaoSolo',    emoji: '🌱', label: 'Adubação solo' },
  { key: 'foliarAdubacao',  emoji: '🍃', label: 'Foliar' },
  { key: 'foliarDefensivo', emoji: '🐛', label: 'Pragas/Doenças' },
  { key: 'foliarHerbicida', emoji: '🌿', label: 'Plantas daninhas' },
  { key: 'colheita',        emoji: '☕', label: 'Colheita' },
];

export default function MesCard({ dados, selecionado, onClick }) {
  const { mesNome, temAtividade } = dados;

  const ativos = ICONES.filter(i => dados[i.key]?.length > 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        rounded-2xl p-4 text-left transition-all border-2 w-full
        ${selecionado
          ? 'border-primary bg-primary/10 shadow-lg scale-[1.02]'
          : temAtividade
            ? 'border-green-300 bg-green-50 hover:border-green-400 hover:shadow-md'
            : 'border-border bg-card hover:border-muted-foreground/30 hover:shadow-sm'
        }
      `}
    >
      <p className={`text-sm font-bold mb-2 ${temAtividade ? 'text-green-800' : 'text-muted-foreground'}`}>
        {mesNome}
      </p>

      {ativos.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {ativos.map(i => (
            <span
              key={i.key}
              title={i.label}
              className="text-base leading-none"
            >
              {i.emoji}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/60 italic">Sem atividades</p>
      )}

      {temAtividade && (
        <p className="text-xs text-green-600 mt-2 font-medium">
          {ativos.length} {ativos.length === 1 ? 'atividade' : 'atividades'}
        </p>
      )}
    </button>
  );
}