import React from 'react';
import { TreePine, Sprout, BarChart2, MapPin } from 'lucide-react';

export default function ResumoProdutorSection({ produtor, talhoes, lancamentos }) {
  const pTalhoes = talhoes.filter(t => t.codigo_produtor === produtor.codigo);
  const areaTotal = pTalhoes.reduce((s, t) => s + (t.area_ha || 0), 0);
  const numPlantas = pTalhoes.reduce((s, t) => s + (t.num_plantas || 0), 0);
  const ref = produtor.ref_medida_litros || 60;
  const medidasPrevistas = pTalhoes.reduce((s, t) => {
    if (!t.litros_por_pe || !t.num_plantas) return s;
    return s + (t.litros_por_pe * t.num_plantas * (t.pct_colher || 1)) / ref;
  }, 0);
  const sacasEstimadas = (medidasPrevistas * ref) / 60;

  const stats = [
    { label: 'Área total', value: `${areaTotal.toFixed(1)} ha`, icon: MapPin },
    { label: 'Talhões', value: pTalhoes.length, icon: TreePine },
    { label: 'Plantas', value: numPlantas.toLocaleString('pt-BR'), icon: Sprout },
    { label: 'Sacas estimadas', value: sacasEstimadas.toFixed(0), icon: BarChart2 },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Propriedade</p>
        <h2 className="text-xl font-bold mt-0.5">{produtor.fazenda || produtor.nome}</h2>
        {produtor.municipio && <p className="text-sm text-muted-foreground">{produtor.municipio}{produtor.uf ? `, ${produtor.uf}` : ''}</p>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="text-center">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 mb-2">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <p className="text-lg font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}