import React from 'react';
import { MapPin } from 'lucide-react';

export default function DadosTalhaoCard({ talhao, produtor }) {
  if (!talhao) return null;

  // Calcular metros lineares e plantas/ha se não existirem
  const esp = talhao.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',', '.')));
  const linhaM = partes?.[0] || 0;
  const metrosLineares = talhao.num_plantas && linhaM > 0
    ? Math.round(talhao.num_plantas * linhaM)
    : null;
  const plantasHa = talhao.area_ha && talhao.num_plantas
    ? Math.round(talhao.num_plantas / talhao.area_ha)
    : null;

  const campos = [
    { label: 'Fazenda', value: produtor?.fazenda },
    { label: 'Área', value: talhao.area_ha ? `${talhao.area_ha} ha` : null },
    { label: 'Nº Plantas', value: talhao.num_plantas?.toLocaleString() },
    { label: 'Plantas/ha', value: plantasHa?.toLocaleString() },
    { label: 'Metros Lineares', value: metrosLineares?.toLocaleString() },
    { label: 'Espaçamento', value: talhao.espacamento },
    { label: 'Cultivar', value: talhao.cultivar },
    { label: 'Método Colheita', value: talhao.metodo_colheita },
  ].filter(c => c.value);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-border">
        <MapPin className="w-4 h-4 text-slate-600" />
        <span className="font-semibold text-sm text-slate-700">Dados do Talhão — {talhao.nome}</span>
        <span className="ml-auto text-xs text-muted-foreground">Puxado do cadastro (somente leitura)</span>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {campos.map(c => (
          <div key={c.label}>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="font-medium text-sm">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}