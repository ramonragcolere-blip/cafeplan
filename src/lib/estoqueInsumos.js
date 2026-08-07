// Cálculo do Controle de Estoque de Insumos.
// Entradas vêm de BaseItensNotaFiscal (via BaseNotasFiscais). Saídas vêm de
// MovimentoEstoqueInsumo. Reaproveita a classificação de categorias existente
// em notasFiscaisCategorias (não cria lógica paralela).
import { normalizarNome, classificarProduto } from '@/lib/notasFiscaisCategorias';

const UN_VOL_L = ['L', 'LT', 'LTS', 'LITRO', 'LITROS'];
const UN_VOL_ML = ['ML', 'MLS'];
const UN_MASS_KG = ['KG', 'KGS', 'QUILO', 'QUILOS'];
const UN_MASS_G = ['G', 'GR', 'GRS', 'GRAMA', 'GRAMAS'];
const UN_MASS_T = ['T', 'TON', 'TONS', 'TONELADA', 'TONELADAS'];
const UN_EMBALAGEM = ['FR', 'GL', 'CX', 'CXA', 'SC', 'PC', 'UN', 'UNID', 'UND', 'PCT', 'LAT', 'FCO', 'DISPLAY', 'DSP', 'FD', 'KIT', 'BOLSA', 'BAG', 'PACK', 'PTS', 'PCA', 'PECAS'];

// Regex que localiza volume/massa explícito na descrição (ex.: "5 L", "1L", "500 ML", "20 KG").
const RE_VOLUME = /(\d+(?:[.,]\d+)?)\s?(l|lt|lts|litro|litros|ml|mls|kg|kgs|quilo|quilos|g|gr|gramas?|toneladas?|t)\b/g;

// Unidades de dose suportadas na edição manual.
export const UNIDADES_DOSE = ['L/ha', 'mL/ha', 'kg/ha', 'g/ha'];

function parseNum(str) {
  if (str == null || str === '') return null;
  const n = parseFloat(String(str).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function canonUnidade(u) {
  const s = String(u || '').toUpperCase().trim();
  if (UN_VOL_L.includes(s)) return 'l';
  if (UN_VOL_ML.includes(s)) return 'ml';
  if (UN_MASS_KG.includes(s)) return 'kg';
  if (UN_MASS_G.includes(s)) return 'g';
  if (UN_MASS_T.includes(s)) return 't';
  return s; // embalagem/outra (GL, FR, SC...) ou desconhecida
}

function toBase(qtd, unit) {
  // Converte volume/massa para unidade base (l ou kg). Embalagens/outras permanecem.
  switch (unit) {
    case 'l': return { q: qtd, unit: 'l' };
    case 'ml': return { q: qtd / 1000, unit: 'l' };
    case 'kg': return { q: qtd, unit: 'kg' };
    case 'g': return { q: qtd / 1000, unit: 'kg' };
    case 't': return { q: qtd * 1000, unit: 'kg' };
    default: return { q: qtd, unit };
  }
}

// Extrai volume/massa base (l/kg) da descrição. Retorna null se não houver
// conteúdo de embalagem claramente identificado — NÃO inventa conversão.
function extrairVolumeBase(nome) {
  const desc = normalizarNome(nome);
  if (!desc) return null;
  let ultimo = null;
  let m;
  RE_VOLUME.lastIndex = 0;
  while ((m = RE_VOLUME.exec(desc)) !== null) {
    const valor = parseNum(m[1]);
    const u = m[2].toLowerCase();
    if (valor == null) continue;
    let base;
    if (['l', 'lt', 'lts', 'litro', 'litros'].includes(u)) base = { valor, unit: 'l' };
    else if (['ml', 'mls'].includes(u)) base = { valor: valor / 1000, unit: 'l' };
    else if (['kg', 'kgs', 'quilo', 'quilos'].includes(u)) base = { valor, unit: 'kg' };
    else if (['g', 'gr', 'grama', 'gramas'].includes(u)) base = { valor: valor / 1000, unit: 'kg' };
    else if (['t', 'ton', 'tonelada', 'toneladas'].includes(u)) base = { valor: valor * 1000, unit: 'kg' };
    else continue;
    ultimo = base;
  }
  return ultimo;
}

// Converte um item de NF para a unidade base do estoque.
export function converterItem(item) {
  const qtd = Number(item.quantidade) || 0;
  const cu = canonUnidade(item.unidade_medida);
  if (['l', 'ml', 'kg', 'g', 't'].includes(cu)) {
    return toBase(qtd, cu);
  }
  if (UN_EMBALAGEM.includes(cu)) {
    const vol = extrairVolumeBase(item.produto_nome);
    if (vol) return { q: qtd * vol.valor, unit: vol.unit };
  }
  return { q: qtd, unit: cu };
}

function toBaseDoseToken(numStr, unitTok) {
  const valor = parseNum(numStr);
  if (valor == null) return null;
  const u = unitTok.toLowerCase();
  if (['l', 'lt', 'lts', 'litro', 'litros'].includes(u)) return { valor, unit: 'l' };
  if (['ml', 'mls'].includes(u)) return { valor: valor / 1000, unit: 'l' };
  if (['kg', 'kgs', 'quilo', 'quilos'].includes(u)) return { valor, unit: 'kg' };
  if (['g', 'gr', 'grama', 'gramas'].includes(u)) return { valor: valor / 1000, unit: 'kg' };
  if (['t', 'ton'].includes(u)) return { valor: valor * 1000, unit: 'kg' };
  return null;
}

// Interpreta dose_producao (string) + unidade_aplicacao. Retorna {valor, unit}
// em l/kg, ou null se não for possível interpretar com segurança.
// Aceita: "0,5 L/ha", "0.5 L/ha", "500 mL/ha", "2 kg/ha", "0,5 /ha" + unidade,
// e dose numérica pura combinada com unidade_aplicacao (ex.: "0.5" + "L/ha").
export function parseDose(doseStr, unidadeAplicacao) {
  const s = String(doseStr || '').trim();
  if (!s) return null;
  const sl = s.toLowerCase();
  const m = sl.match(/(\d+(?:[.,]\d+)?)\s*(l|lt|lts|litro|litros|ml|mls|kg|kgs|quilo|quilos|g|gr|gramas?|t|ton)\s*\/\s*ha/);
  if (m) return toBaseDoseToken(m[1], m[2]);
  // "0,5 /ha" + unidade_aplicacao base
  const m2 = sl.match(/(\d+(?:[.,]\d+)?)\s*\/\s*ha/);
  if (m2 && unidadeAplicacao) {
    const cu = canonUnidade(String(unidadeAplicacao).split('/')[0] || unidadeAplicacao);
    if (['l', 'ml', 'kg', 'g'].includes(cu)) {
      const b = toBase(parseNum(m2[1]), cu);
      return { valor: b.q, unit: b.unit };
    }
  }
  // dose numérica pura + unidade_aplicacao (ex.: "0.5" + "L/ha")
  if (/^\d+([.,]\d+)?$/.test(s) && unidadeAplicacao) {
    const cu = canonUnidade(String(unidadeAplicacao).split('/')[0] || unidadeAplicacao);
    if (['l', 'ml', 'kg', 'g'].includes(cu)) {
      const b = toBase(parseFloat(s.replace(',', '.')), cu);
      return { valor: b.q, unit: b.unit };
    }
  }
  return null;
}

// Monta string padronizada de dose a partir de valor + unidade (ex.: "0.5 L/ha").
export function formatDose(valor, unidadeDose) {
  const v = parseNum(valor);
  if (v == null || !unidadeDose) return '';
  return `${v} ${unidadeDose}`.replace('.', ',').replace(' ,', ' ');
}

function contemPalavra(desc, cn) {
  if (!cn) return false;
  if (desc === cn) return true;
  if (desc.startsWith(cn + ' ')) return true;
  if (desc.endsWith(' ' + cn)) return true;
  if (desc.includes(' ' + cn + ' ')) return true;
  return false;
}

// Índice de insumos da Base de Insumos (FertilizanteFormulado + FonteSimples).
export function construirInsumosIndex(fertilizantes = [], fontes = []) {
  const idx = [];
  (fertilizantes || []).forEach(f => {
    const n = normalizarNome(f.nome);
    if (n && n.length >= 3) idx.push({ nomeNorm: n, tipo: 'fert', id: f.id, record: f });
  });
  (fontes || []).forEach(f => {
    const n = normalizarNome(f.nome);
    if (n && n.length >= 3) idx.push({ nomeNorm: n, tipo: 'fonte', id: f.id, record: f });
  });
  idx.sort((a, b) => b.nomeNorm.length - a.nomeNorm.length);
  return idx;
}

// Correspondência por palavra (qualquer posição) — usada para uso/visualização.
export function matchInsumo(nome, insumosIndex = []) {
  const desc = normalizarNome(nome);
  if (!desc) return null;
  for (const ins of insumosIndex) {
    if (contemPalavra(desc, ins.nomeNorm)) return ins;
  }
  return null;
}

// Correspondência EXATA (nome normalizado igual) — usada para gravar vínculo
// automático em importações, evitando associação incorreta por texto parcial.
export function matchInsumoExato(nome, insumosIndex = []) {
  const desc = normalizarNome(nome);
  if (!desc) return null;
  for (const ins of insumosIndex) {
    if (desc === ins.nomeNorm) return ins;
  }
  return null;
}

// Mapeia categoria do filtro para grupo da Base de Insumos (FertilizanteFormulado).
const CATEGORIA_TO_GRUPO = {
  'Fungicida': 'Fungicida',
  'Inseticida': 'Inseticida',
  'Herbicida': 'Herbicida',
  'Acaricida': 'Acaricida',
  'Adjuvante': 'Adjuvante',
  'Corretivo': 'Corretivo',
  'Nutrição foliar': 'Fertilizante Foliar',
  'Adubo/Fertilizante': 'Fertilizante Solo',
  'Outros': 'Outro',
};
export function categoriaToGrupo(categoria) {
  return CATEGORIA_TO_GRUPO[categoria] || 'Outro';
}

// Sugere um nome limpo de insumo a partir da descrição da NF, removendo
// prefixos de categoria e apresentações (tamanhos) APENAS quando identificados
// com segurança. O nome comercial (marca) nunca é cortado arriscadamente.
export function sugerirNomeInsumo(nome) {
  let s = String(nome || '').trim();
  const prefixes = ['Fertilizante Foliar', 'Fungicida', 'Inseticida', 'Herbicida', 'Acaricida', 'Adjuvante', 'Corretivo', 'Fertilizante', 'Adubo'];
  for (const p of prefixes) {
    const re = new RegExp('^' + p + '\\s+', 'i');
    if (re.test(s)) { s = s.replace(re, '').trim(); break; }
  }
  let prev;
  do {
    prev = s;
    s = s.replace(/\s+\d+(?:[.,]\d+)?\s?(l|lt|lts|litro|litros|ml|mls|kg|kgs|quilo|quilos|g|gr|gramas?)$/i, '').trim();
  } while (s !== prev);
  return s || String(nome || '').trim();
}

// Tenta identificar o tipo de formulação pelo nome. Retorna valor do enum
// ou 'outro'. Só usa correspondência com limites de palavra (ex.: "ORKESTRA SC").
export function detectarTipoFormulacao(nome) {
  const m = String(nome || '').match(/\b(SC|EC|WG|SL|EW|PM)\b/i);
  if (!m) return 'outro';
  return m[1].toUpperCase();
}

function chaveProduto(insumo, nome) {
  if (insumo) return `${insumo.tipo}_${insumo.id}`;
  return `nf_${normalizarNome(nome)}`;
}

// Calcula situação do estoque com base no percentual restante.
export function calcularSituacao(saldo, totalEntrada) {
  if (totalEntrada <= 0) return { situacao: 'Normal', pct: 1, alerta: false };
  const pct = saldo / totalEntrada;
  if (saldo <= 0) return { situacao: 'Sem estoque', pct: 0, alerta: true };
  if (pct <= 0.10) return { situacao: 'Estoque baixo', pct, alerta: true };
  if (pct <= 0.25) return { situacao: 'Atenção', pct, alerta: false };
  return { situacao: 'Normal', pct, alerta: false };
}

// Constrói as linhas de estoque a partir das NFs + saídas + configs de dose.
// Prioridade de identificação do produto:
//   1) BaseItensNotaFiscal.insumo_id/insumo_tipo (vínculo direto)
//   2) matchInsumo() por palavra
//   3) não cadastrado
// Prioridade de dose/ha:
//   1) ConfiguracaoEstoqueProduto (override do estoque)
//   2) Base de Insumos (FertilizanteFormulado.dose_producao)
//   3) sem dose
export function construirEstoque({
  itens = [], notas = [], saidas = [], fertilizantes = [], fontes = [],
  catalogoCategorias = [], configs = [], produtorFiltro = 'todos',
} = {}) {
  const notasMap = {};
  (notas || []).forEach(n => { notasMap[n.id] = n; });

  const fertMap = {};
  (fertilizantes || []).forEach(f => { fertMap[f.id] = f; });
  const fonteMap = {};
  (fontes || []).forEach(f => { fonteMap[f.id] = f; });
  const insumosIndex = construirInsumosIndex(fertilizantes, fontes);
  const configsMap = {};
  (configs || []).forEach(c => { configsMap[`${c.produtor_id}||${c.produto_chave}`] = c; });

  const mapa = {};

  const getRow = (produtorId, insumo, nome) => {
    const cp = chaveProduto(insumo, nome);
    const key = `${produtorId}||${cp}`;
    if (!mapa[key]) {
      mapa[key] = {
        key,
        produtor_id: produtorId,
        produto_chave: cp,
        produto_id: insumo?.id || null,
        produto_tipo: insumo ? insumo.tipo : 'nf',
        produto_nome: insumo ? insumo.record.nome : nome,
        insumo: insumo || null,
        insumo_nome: insumo ? insumo.record.nome : null,
        vinculado: !!insumo,
        categoria: 'Outros',
        unidade: '',
        total_entrada: 0,
        total_saida: 0,
        saldo: 0,
        ultima_entrada: '',
        entradas: [],
        saidas: [],
        ids_itens_nf: new Set(),
        item_ids: [],
        config: null,
      };
    }
    return mapa[key];
  };

  const resolverInsumo = (item, nome) => {
    if (item.insumo_id) {
      if (item.insumo_tipo === 'fonte' && fonteMap[item.insumo_id]) {
        return { tipo: 'fonte', id: item.insumo_id, record: fonteMap[item.insumo_id] };
      }
      if (item.insumo_tipo === 'formulado' && fertMap[item.insumo_id]) {
        return { tipo: 'fert', id: item.insumo_id, record: fertMap[item.insumo_id] };
      }
    }
    return matchInsumo(nome, insumosIndex);
  };

  // 1) Entradas a partir dos itens das NFs
  (itens || []).forEach(item => {
    const pid = item.produtor_id;
    if (!pid) return;
    if (produtorFiltro !== 'todos' && pid !== produtorFiltro) return;
    const nome = String(item.produto_nome || '').trim();
    if (!nome) return;
    const nota = item.nota_fiscal_id ? notasMap[item.nota_fiscal_id] : null;
    const insumo = resolverInsumo(item, nome);
    const row = getRow(pid, insumo, nome);
    row.categoria = classificarProduto(nome, catalogoCategorias);
    const conv = converterItem(item);
    row.unidade = conv.unit;
    row.total_entrada += Number(conv.q) || 0;
    if (item.id) { row.ids_itens_nf.add(item.id); row.item_ids.push(item.id); }
    row.entradas.push({
      data: nota?.data_emissao || '',
      numero: nota?.numero_nota || '',
      fornecedor: nota?.fornecedor_nome || '',
      nota_id: item.nota_fiscal_id || '',
      quantidade: Number(item.quantidade) || 0,
      unidade: String(item.unidade_medida || ''),
    });
    if (nota?.data_emissao && (!row.ultima_entrada || nota.data_emissao > row.ultima_entrada)) {
      row.ultima_entrada = nota.data_emissao;
    }
  });

  // 2) Saídas a partir de MovimentoEstoqueInsumo — preserva o objeto completo
  (saidas || []).forEach(s => {
    const pid = s.produtor_id;
    if (!pid) return;
    if (produtorFiltro !== 'todos' && pid !== produtorFiltro) return;
    const cp = s.produto_tipo === 'fert' || s.produto_tipo === 'fonte'
      ? `${s.produto_tipo}_${s.produto_id}`
      : `nf_${normalizarNome(s.produto_nome)}`;
    const key = `${pid}||${cp}`;
    if (!mapa[key]) {
      mapa[key] = {
        key, produtor_id: pid, produto_chave: cp, produto_id: s.produto_id || null,
        produto_tipo: s.produto_tipo || 'nf', produto_nome: s.produto_nome,
        insumo: null, insumo_nome: null, vinculado: false, categoria: 'Outros', unidade: s.unidade || '',
        total_entrada: 0, total_saida: 0, saldo: 0, ultima_entrada: '', entradas: [], saidas: [],
        ids_itens_nf: new Set(), item_ids: [], config: null,
      };
    }
    const row = mapa[key];
    row.total_saida += Number(s.quantidade) || 0;
    row.saidas.push({
      id: s.id || null,
      produtor_id: s.produtor_id,
      produto_id: s.produto_id || null,
      produto_tipo: s.produto_tipo || 'nf',
      produto_nome: s.produto_nome,
      data_movimento: s.data_movimento || '',
      quantidade: Number(s.quantidade) || 0,
      unidade: s.unidade || '',
      tipo_movimento: s.tipo_movimento || 'saida',
      observacao: s.observacao || '',
    });
  });

  // 3) Finaliza linhas: saldo, dose, hectares, situação
  const rows = Object.values(mapa).map(row => {
    const saldo = Math.max(0, row.total_entrada - row.total_saida);
    row.saldo = saldo;
    row.item_ids = Array.from(row.ids_itens_nf);
    row.config = configsMap[`${row.produtor_id}||${row.produto_chave}`] || null;
    const { situacao, pct, alerta } = calcularSituacao(saldo, row.total_entrada);
    row.situacao = situacao;
    row.pct = pct;
    row.alerta = alerta;

    // dose: override do estoque -> Base de Insumos -> sem dose
    const doseBase = row.insumo?.tipo === 'fert'
      ? parseDose(row.insumo.record.dose_producao, row.insumo.record.unidade_aplicacao)
      : null;
    let dose = doseBase;
    if (row.config?.dose_ha != null && row.config.unidade_dose) {
      const dOver = parseDose(`${row.config.dose_ha} ${row.config.unidade_dose}`);
      if (dOver) dose = dOver;
    }
    row.dose = dose;
    row.dose_fonte = row.config?.dose_ha != null && row.config.unidade_dose ? 'estoque' : (doseBase ? 'base' : null);
    if (dose && saldo > 0 && row.unidade === dose.unit) {
      row.ha_possiveis = Math.round((saldo / dose.valor) * 100) / 100;
    } else {
      row.ha_possiveis = null;
    }
    return row;
  });

  rows.sort((a, b) => (a.produto_nome || '').localeCompare(b.produto_nome || '', 'pt-BR'));
  return rows;
}

export function fmtQtd(v) {
  const n = Number(v) || 0;
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export function fmtData(d) {
  if (!d) return '—';
  const [y, m, day] = String(d).split('-');
  return y && m && day ? `${day}/${m}/${y}` : d;
}

// Monta nome da unidade de dose a partir de unidade_aplicacao ou string de dose.
// Ex.: "L/ha" -> "L/ha"; "mL/ha" -> "mL/ha".
export function normalizarUnidadeDose(s) {
  const u = String(s || '').trim();
  const m = u.match(/(l|lt|lts|ml|mls|kg|kgs|g|gr)/i);
  if (!m) return 'L/ha';
  const tok = m[1].toLowerCase();
  let base;
  if (['l', 'lt', 'lts'].includes(tok)) base = 'L';
  else if (['ml', 'mls'].includes(tok)) base = 'mL';
  else if (['kg', 'kgs'].includes(tok)) base = 'kg';
  else if (['g', 'gr'].includes(tok)) base = 'g';
  else base = 'L';
  return `${base}/ha`;
}

export { UN_EMBALAGEM };