// Categorias simplificadas para o filtro do módulo Notas Fiscais.
// Reaproveita o campo `grupo` já existente em FertilizanteFormulado e a
// natureza de FonteSimples (fontes de nutrientes) para classificar cada item.
export const CATEGORIAS_NOTAS = [
  'Fungicida',
  'Inseticida',
  'Herbicida',
  'Acaricida',
  'Adubo/Fertilizante',
  'Corretivo',
  'Adjuvante',
  'Nutrição foliar',
  'Outros',
];

// Mapeia cada valor do enum `grupo` de FertilizanteFormulado para uma
// categoria simplificada usada no filtro. Grupos não mapeados caem em "Outros".
const GRUPO_TO_CATEGORIA = {
  'Fungicida': 'Fungicida',
  'Inseticida': 'Inseticida',
  'Inseticida Biológico': 'Inseticida',
  'Inseticida de Solo': 'Inseticida',
  'Acaricida': 'Acaricida',
  'Herbicida': 'Herbicida',
  'Adjuvante': 'Adjuvante',
  'Corretivo': 'Corretivo',
  'Foliar — Nutrição': 'Nutrição foliar',
  'Fertilizante Foliar': 'Nutrição foliar',
  'Bioestimulante': 'Nutrição foliar',
  'Aminoácido': 'Nutrição foliar',
  'Fertilizante Solo': 'Adubo/Fertilizante',
  'Fertilizante Solo + Nematicida Biológico': 'Adubo/Fertilizante',
  'Fosfatado': 'Adubo/Fertilizante',
  'Fonte de Nitrogênio': 'Adubo/Fertilizante',
  'Fonte de Fósforo': 'Adubo/Fertilizante',
  'Fonte de Potássio': 'Adubo/Fertilizante',
  'Fonte de Magnésio': 'Adubo/Fertilizante',
  'Fonte de Boro': 'Adubo/Fertilizante',
  'Fonte de Zinco': 'Adubo/Fertilizante',
  'Fonte de Cobre': 'Adubo/Fertilizante',
  'Condicionador de Solo': 'Adubo/Fertilizante',
  'Organomineral': 'Adubo/Fertilizante',
  'Liberação Gradual': 'Adubo/Fertilizante',
  'Ácido Húmico e Fúlvico': 'Adubo/Fertilizante',
  'Cobre': 'Adubo/Fertilizante',
  'Boro': 'Adubo/Fertilizante',
  'Zinco': 'Adubo/Fertilizante',
  'Manganês': 'Adubo/Fertilizante',
  'Magnésio': 'Adubo/Fertilizante',
  'Fósforo': 'Adubo/Fertilizante',
  'Outro': 'Outros',
};

export function mapGrupoToCategoria(grupo) {
  if (!grupo) return 'Outros';
  return GRUPO_TO_CATEGORIA[grupo] || 'Outros';
}

// Monta um mapa nome->categoria a partir dos catálogos de fertilizantes
// formulados e fontes simples. Usado para classificar itens de nota por nome.
export function montarCatalogoCategorias(fertilizantes = [], fontesSimples = []) {
  const map = new Map();
  const normalizar = (nome) => String(nome || '').trim().toLowerCase();
  (fertilizantes || []).forEach(f => {
    const key = normalizar(f.nome);
    if (key) map.set(key, mapGrupoToCategoria(f.grupo));
  });
  (fontesSimples || []).forEach(f => {
    const key = normalizar(f.nome);
    if (key) map.set(key, 'Adubo/Fertilizante');
  });
  return map;
}

// Classifica um produto pelo nome usando o catálogo montado.
// Produtos não encontrados no catálogo caem em "Outros".
export function classificarProduto(nome, catalogoCategorias = new Map()) {
  const key = String(nome || '').trim().toLowerCase();
  if (!key) return 'Outros';
  return catalogoCategorias.get(key) || 'Outros';
}