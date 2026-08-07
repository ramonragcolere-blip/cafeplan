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
// - Se a unidade da NF já é volume/massa (L, ML, KG, G, T) → converte para l/kg.
// - Se é embalagem (GL, FR, SC...) e a descrição traz volume explícito → multiplica.
// - Caso contrário mantém a unidade original (ex.: GL sem tamanho conhecido).
export function converterItem(item) {
  const qtd = Number(item.quantidade) || 0;
  const cu = canonUnidade(item.unidade_medida);
  if (['l', 'ml', 'kg', 'g', 't'].includes(cu)) {
    return toBase(qtd, cu);
  }
  // embalagem: tenta extrair conteúdo da descrição
  if (UN_EMBALAGEM.includes(cu)) {
    const vol = extrairVolumeBase(item.produto_nome);
    if (vol) return { q: qtd * vol.valor, unit: vol.unit };
  }
  return { q: qtd, unit: cu };
}

// Interpreta dose_producao (string) + unidade_aplicacao. Retorna {valor, unit}
// em l/kg, ou null se não for possível interpretar com segurança.
export function parseDose(doseStr, unidadeAplicacao) {
  const s = String(doseStr || '').toLowerCase();
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(l|lt|lts|litro|litros|ml|mls|kg|kgs|quilo|quilos|g|gr|gramas?|t|ton)\s*\/\s*ha/);
  if (m) {
    const valor = parseNum(m[1]);
    let unit;
    if (['l', 'lt', 'lts', 'litro', 'litros'].includes(m[2])) unit = 'l';
    else if (['ml', 'mls'].includes(m[2])) return { valor: valor / 1000, unit: 'l' };
    else if (['kg', 'kgs', 'quilo', 'quilos'].includes(m[2])) unit = 'kg';
    else if (['g', 'gr', 'grama', 'gramas'].includes(m[2])) return { valor: valor / 1000, unit: 'kg' };
    else if (['t', 'ton'].includes(m[2])) return { valor: valor * 1000, unit: 'kg' };
    if (valor != null && unit) return { valor, unit };
  }
  // Sem unidade explícita na dose: usa unidade_aplicacao (se for base l/kg).
  const mNum = s.match(/(\d+(?:[.,]\d+)?)\s*\/\s*ha/);
  if (mNum) {
    const valor = parseNum(mNum[1]);
    const cu = canonUnidade(unidadeAplicacao);
    if (valor != null && (cu === 'l' || cu === 'kg' || cu === 'ml' || cu === 'g')) {
      const b = toBase(valor, cu);
      return { valor: b.q, unit: b.unit };
    }
  }
  return null;
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

// Relaciona item da NF à Base de Insumos por palavra inteira no nome,
// priorizando nomes mais específicos (mais longos). Retorna o registro ou null.
export function matchInsumo(nome, insumosIndex = []) {
  const desc = normalizarNome(nome);
  if (!desc) return null;
  for (const ins of insumosIndex) {
    if (contemPalavra(desc, ins.nomeNorm)) return ins;
  }
  return null;
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

// Constrói as linhas de estoque a partir das NFs + saídas.
// Cada linha é por PRODUTOR + PRODUTO. Entradas vêm dos itens das NFs;
// saídas vêm de MovimentoEstoqueInsumo (mesma chave produto).
export function construirEstoque({ itens = [], notas = [], saidas = [], fertilizantes = [], fontes = [], catalogoCategorias = [], produtorFiltro = 'todos' } = {}) {
  const notasMap = {};
  (notas || []).forEach(n => { notasMap[n.id] = n; });

  const insumosIndex = construirInsumosIndex(fertilizantes, fontes);

  // Acumulador: key `${produtor_id}||${chaveProduto}` -> row
  const mapa = {};

  const getRow = (produtorId, insumo, nome) => {
    const cp = chaveProduto(insumo, nome);
    const key = `${produtorId}||${cp}`;
    if (!mapa[key]) {
      mapa[key] = {
        key,
        produtor_id: produtorId,
        produto_id: insumo?.id || null,
        produto_tipo: insumo ? insumo.tipo : 'nf',
        produto_nome: insumo ? insumo.record.nome : nome,
        insumo: insumo || null,
        categoria: 'Outros',
        unidade: '',
        total_entrada: 0,
        total_saida: 0,
        saldo: 0,
        ultima_entrada: '',
        entradas: [],
        saidas: [],
        ids_itens_nf: new Set(),
      };
    }
    return mapa[key];
  };

  // 1) Entradas a partir dos itens das NFs
  (itens || []).forEach(item => {
    const pid = item.produtor_id;
    if (!pid) return;
    if (produtorFiltro !== 'todos' && pid !== produtorFiltro) return;
    const nome = String(item.produto_nome || '').trim();
    if (!nome) return;
    const nota = item.nota_fiscal_id ? notasMap[item.nota_fiscal_id] : null;
    const insumo = matchInsumo(nome, insumosIndex);
    const row = getRow(pid, insumo, nome);
    row.categoria = classificarProduto(nome, catalogoCategorias);
    const conv = converterItem(item);
    row.unidade = conv.unit; // unify unidade pela primeira ocorrência
    row.total_entrada += Number(conv.q) || 0;
    if (item.id) row.ids_itens_nf.add(item.id);
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

  // 2) Saídas a partir de MovimentoEstoqueInsumo (mesma chave: produtor + produto)
  (saidas || []).forEach(s => {
    const pid = s.produtor_id;
    if (!pid) return;
    if (produtorFiltro !== 'todos' && pid !== produtorFiltro) return;
    const cp = s.produto_tipo === 'fert' || s.produto_tipo === 'fonte'
      ? `${s.produto_tipo}_${s.produto_id}`
      : `nf_${normalizarNome(s.produto_nome)}`;
    const key = `${pid}||${cp}`;
    // Pode haver saída sem entrada registrada ainda — cria linha para ela
    if (!mapa[key]) {
      mapa[key] = {
        key, produtor_id: pid, produto_id: s.produto_id || null, produto_tipo: s.produto_tipo || 'nf',
        produto_nome: s.produto_nome, insumo: null, categoria: 'Outros', unidade: s.unidade || '',
        total_entrada: 0, total_saida: 0, saldo: 0, ultima_entrada: '', entradas: [], saidas: [],
        ids_itens_nf: new Set(),
      };
    }
    const row = mapa[key];
    row.total_saida += Number(s.quantidade) || 0;
    row.saidas.push({
      data: s.data_movimento || '',
      quantidade: Number(s.quantidade) || 0,
      observacao: s.observacao || '',
      tipo: s.tipo_movimento || 'saida',
    });
  });

  // 3) Finaliza linhas: saldo, dose, hectares, situação
  const rows = Object.values(mapa).map(row => {
    const saldo = Math.max(0, row.total_entrada - row.total_saida);
    row.saldo = saldo;
    const { situacao, pct, alerta } = calcularSituacao(saldo, row.total_entrada);
    row.situacao = situacao;
    row.pct = pct;
    row.alerta = alerta;
    // dose/ha: FertilizanteFormulado.dose_producao (FonteSimples não tem dose)
    let dose = null;
    if (row.insumo?.tipo === 'fert') {
      dose = parseDose(row.insumo.record.dose_producao, row.insumo.record.unidade_aplicacao);
    }
    row.dose = dose;
    // hectares possíveis: só se unidades compatíveis
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

export { UN_EMBALAGEM };