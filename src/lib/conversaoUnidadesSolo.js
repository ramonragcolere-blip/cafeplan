// Conversão de unidades para teores de solo — Adubação via Solo.
// Padrão agronômico (Massa atômica K=39,1; Ca=40,08; Mg=24,3):
//   K : 1 cmolc/dm³ = 391 mg/dm³ ; 1 mmolc/dm³ = 39,1 mg/dm³
//   Ca: 1 cmolc/dm³ = 200 mg/dm³ ; 1 mmolc/dm³ = 20 mg/dm³
//   Mg: 1 cmolc/dm³ = 121 mg/dm³; 1 mmolc/dm³ = 12,1 mg/dm³
// MO: 1 dag/kg = 1 %.

const UNIDADES_DISPONIVEIS = ['mg/dm³', 'cmolc/dm³', 'mmolc/dm³', '%', 'dag/kg'];

// Fator para converter 1 unidade -> unidade base do nutriente (mg/dm³ ou %).
const FATORES_BASE = {
  potassio:   { 'mg/dm³': 1, 'cmolc/dm³': 391, 'mmolc/dm³': 39.1 },
  calcio:     { 'mg/dm³': 1, 'cmolc/dm³': 200, 'mmolc/dm³': 20 },
  magnesio:   { 'mg/dm³': 1, 'cmolc/dm³': 121, 'mmolc/dm³': 12.1 },
  materia_organica: { '%': 1, 'dag/kg': 1 },
};

const UNIDADE_PADRAO = {
  materia_organica: '%',
  fosforo: 'mg/dm³',
  potassio: 'mg/dm³',
  calcio: 'cmolc/dm³',
  magnesio: 'cmolc/dm³',
  enxofre: 'mg/dm³',
  boro: 'mg/dm³',
  cobre: 'mg/dm³',
  zinco: 'mg/dm³',
  manganes: 'mg/dm³',
};

export function unidadesDoNutriente(key) {
  const map = FATORES_BASE[key];
  if (map) return Object.keys(map);
  return [UNIDADE_PADRAO[key] || 'mg/dm³'];
}

// Converte `valor` (numérico) de `unidadeOrigem` para `unidadeDestino`.
// Retorna null se não conversível.
export function converterValorSolo(key, valor, unidadeOrigem, unidadeDestino) {
  if (valor == null || valor === '' || isNaN(Number(valor))) return null;
  const v = Number(valor);
  const map = FATORES_BASE[key];
  if (!map) {
    // nutriente com unidade única
    if (unidadeOrigem === unidadeDestino) return v;
    return v;
  }
  const fOrigem = map[unidadeOrigem];
  const fDestino = map[unidadeDestino];
  if (fOrigem == null || fDestino == null) return null;
  return (v * fOrigem) / fDestino;
}

export { UNIDADES_DISPONIVEIS, UNIDADE_PADRAO };