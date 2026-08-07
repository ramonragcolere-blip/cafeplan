// Categorias simplificadas para o filtro do módulo Notas Fiscais.
// Reaproveita o campo `grupo` já existente em FertilizanteFormulado (que
// também contempla defensivos: Fungicida, Inseticida, Herbicida, etc.) e a
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

// Normaliza nomes para comparação: remove maiúsculas, acentos, pontuação,
// hífens/barras e espaços duplicados. Permite reconhecer "PRIORI XTRA 1L"
// como contendo o produto cadastrado "Priori Xtra".
export function normalizarNome(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos/diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')    // pontuação, hífens, barras -> espaço
    .replace(/\s+/g, ' ')
    .trim();
}

// Monta a lista de produtos do catálogo a partir de FertilizanteFormulado e
// FonteSimples. Cada entrada: { nomeNorm, categoria }.
// Ordenada pelo nome normalizado mais longo primeiro, para que a
// correspondência por prefixo pegue sempre o produto mais específico.
export function montarCatalogoCategorias(fertilizantes = [], fontesSimples = []) {
  const lista = [];
  const push = (nome, categoria) => {
    const nomeNorm = normalizarNome(nome);
    if (!nomeNorm || nomeNorm.length < 3) return; // evita nomes genéricos curtos
    lista.push({ nomeNorm, categoria });
  };
  (fertilizantes || []).forEach(f => push(f.nome, mapGrupoToCategoria(f.grupo)));
  (fontesSimples || []).forEach(f => push(f.nome, 'Adubo/Fertilizante'));
  lista.sort((a, b) => b.nomeNorm.length - a.nomeNorm.length);
  return lista;
}

// Classifica um produto pelo nome usando a lista montada do catálogo.
// Correspondência por prefixo com separador de palavra permite reconhecer
// descrições de NF que trazem embalagem/volume após o nome do produto:
//   "PRIORI XTRA 1L" -> "priori xtra"  (Fungicida)
//   "TUTOR 1KG"      -> "tutor"        (...)
//   "VERTIMEC 84 1L" -> "vertimec 84" (ou "vertimec", o mais específico)
// Produtos não encontrados em nenhuma base caem em "Outros".
export function classificarProduto(nome, catalogoLista = []) {
  const desc = normalizarNome(nome);
  if (!desc) return 'Outros';
  for (const c of catalogoLista) {
    const cn = c.nomeNorm;
    if (desc === cn || desc.startsWith(cn + ' ')) return c.categoria;
  }
  return 'Outros';
}