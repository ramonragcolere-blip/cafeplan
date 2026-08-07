import { base44 } from '@/api/base44Client';
import { construirInsumosIndex, matchInsumoExato } from '@/lib/estoqueInsumos';

// Lógica compartilhada entre a importação individual (ImportarNotaFiscal)
// e a importação em lote (ImportarLoteNotasFiscal). Mantém o comportamento
// original da importação individual sem duplicação de código.

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

export function parseXMLNFe(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('XML inválido ou corrompido.');

  const get = (parent, tag) => {
    const el = parent.getElementsByTagNameNS(NFE_NS, tag)[0] || parent.getElementsByTagName(tag)[0];
    return el ? el.textContent.trim() : '';
  };

  const ide = doc.querySelector('ide') || doc.getElementsByTagName('ide')[0];
  const emit = doc.querySelector('emit') || doc.getElementsByTagName('emit')[0];
  const total = doc.querySelector('ICMSTot') || doc.getElementsByTagName('ICMSTot')[0];

  const numero = ide ? get(ide, 'nNF') : '';
  const dataEmissao = ide ? get(ide, 'dhEmi').slice(0, 10) : '';
  const fornecedorNome = emit ? get(emit, 'xNome') : '';
  const fornecedorCnpj = emit ? get(emit, 'CNPJ') : '';
  const valorTotal = total ? parseFloat(get(total, 'vNF')) || 0 : 0;

  const detsNs = doc.getElementsByTagNameNS(NFE_NS, 'det');
  const detsFallback = doc.getElementsByTagName('det');
  const detsList = detsNs.length > 0 ? detsNs : detsFallback;

  const itens = [];
  for (const det of detsList) {
    const prod = det.getElementsByTagNameNS(NFE_NS, 'prod')[0] || det.getElementsByTagName('prod')[0];
    if (!prod) continue;
    itens.push({
      produto_nome: get(prod, 'xProd'),
      quantidade: parseFloat(get(prod, 'qCom')) || 0,
      unidade_medida: get(prod, 'uCom'),
      preco_unitario: parseFloat(get(prod, 'vUnCom')) || 0,
      preco_total: parseFloat(get(prod, 'vProd')) || 0,
    });
  }

  return { numero, fornecedor_nome: fornecedorNome, fornecedor_cnpj: fornecedorCnpj, data_emissao: dataEmissao, valor_total: valorTotal, itens };
}

// Formatos aceitos pela importação de Notas Fiscais.
export const EXTENSOES_SUPORTADAS = ['xml', 'pdf', 'jpg', 'jpeg', 'png', 'webp'];
export const ACCEPT_INPUT = '.xml,.pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
const MIME_IMAGEM = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp'];

// Classifica o arquivo em xml | pdf | imagem | nao_suportado usando extensão
// E tipo MIME. Não diferencia maiúsculas/minúsculas.
export function classificarArquivo(file) {
  const nome = String(file?.name || '').toLowerCase();
  const ext = nome.split('.').pop();
  const mime = String(file?.type || '').toLowerCase();
  if (ext === 'xml' || mime === 'application/xml' || mime === 'text/xml') return { tipo: 'xml', ext };
  if (ext === 'pdf' || mime === 'application/pdf') return { tipo: 'pdf', ext };
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext) || MIME_IMAGEM.includes(mime)) return { tipo: 'imagem', ext };
  return { tipo: 'nao_suportado', ext };
}

const SCHEMA_NF = {
  type: 'object',
  properties: {
    numero: { type: 'string' },
    fornecedor_nome: { type: 'string' },
    fornecedor_cnpj: { type: 'string' },
    data_emissao: { type: 'string' },
    valor_total: { type: 'number' },
    itens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          produto_nome: { type: 'string' },
          quantidade: { type: 'number' },
          unidade_medida: { type: 'string' },
          preco_unitario: { type: 'number' },
          preco_total: { type: 'number' },
        },
      },
    },
    _avisos: { type: 'array', items: { type: 'string' } },
  },
};

// Prompt de interpretação visual da NF (uma ou mais fotos da mesma nota).
function promptExtracaoNF(qtdImagens) {
  return [
    `Você é um especialista em ler notas fiscais (NF-e/NF de produto) a partir de ${qtdImagens > 1 ? `${qtdImagens} FOTOS da MESMA nota fiscal` : 'uma FOTO de uma nota fiscal'}.`,
    `As fotos podem estar levemente inclinadas, com perspectiva ou iluminação desigual — leia com cuidado, sem reproduzir dados que não estejam visíveis.`,
    qtdImagens > 1
      ? `As ${qtdImagens} fotos são PARTES da mesma nota (ex.: frente/continuação/outra página/outro ângulo). Interprete TODAS como UMA ÚNICA nota fiscal. Se o MESMO item aparecer em mais de uma foto (sobreposição visual real), consolide como um único item. Mas NÃO elimine produtos legítimos que apareçam em linhas distintas apenas porque têm nome parecido.`
      : '',
    `Extraia EXATAMENTE estes campos do cabeçalho:`,
    `- numero: número da NF (string)`,
    `- fornecedor_nome: razão social do fornecedor (string)`,
    `- fornecedor_cnpj: CNPJ do fornecedor, apenas dígitos (string)`,
    `- data_emissao: data de emissão no formato YYYY-MM-DD (string)`,
    `- valor_total: valor total da nota (number)`,
    `Extraia TODOS os itens. Para CADA linha de produto retorne: produto_nome (string, descrição completa), quantidade (number), unidade_medida (string, ex.: UN, L, KG, GL, FR, SC, CX, M, MIL), preco_unitario (number), preco_total (number).`,
    `NÃO resuma. NÃO junte linhas diferentes. NÃO omita itens. NÃO invente dados.`,
    `Se um campo estiver ilegível, encoberto ou cortado, use null nesse campo (não adivinhe preço, quantidade, unidade, CNPJ ou número).`,
    `Retorne ainda _avisos: array de strings curtas em português sinalizando campos NÃO legíveis (ex.: "Unidade do item 3 não identificada", "CNPJ parcialmente ilegível"). Se tudo estiver legível, retorne [].`,
    `Retorne somente o JSON conforme o schema fornecido.`,
  ].filter(Boolean).join('\n');
}

// Normaliza o resultado (XML/PDF/imagem): garante campos, marca itens
// ilegíveis, confere Qtd × Preço unit. vs Total e Soma dos itens vs valor_total.
// _conferir/_motivo e _avisos são usados SÓ pela revisão (salvarNotaFiscal ignora).
export function normalizarDadosExtraidos(resultado) {
  const dados = { ...(resultado || {}) };
  dados.numero = String(dados.numero ?? '').trim() || null;
  dados.fornecedor_nome = String(dados.fornecedor_nome ?? '').trim() || null;
  dados.fornecedor_cnpj = String(dados.fornecedor_cnpj ?? '').replace(/\D/g, '') || null;
  const dRaw = String(dados.data_emissao ?? '').trim();
  const br = dRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) dados.data_emissao = `${br[3]}-${br[2]}-${br[1]}`;
  else if (/^\d{4}-\d{2}-\d{2}/.test(dRaw)) dados.data_emissao = dRaw.slice(0, 10);
  else dados.data_emissao = dRaw || null;
  dados.valor_total = dados.valor_total == null ? null : Number(dados.valor_total);

  const itens = Array.isArray(dados.itens) ? dados.itens : [];
  const avisos = Array.isArray(dados._avisos) ? [...dados._avisos] : [];

  const quaseIgual = (a, b, tol) => Math.abs(a - b) <= tol;
  const itensNorm = itens.map((it) => {
    const item = { ...(it || {}) };
    item.produto_nome = String(item.produto_nome ?? '').trim() || null;
    item.quantidade = item.quantidade == null ? null : Number(item.quantidade);
    item.unidade_medida = String(item.unidade_medida ?? '').trim().toUpperCase() || null;
    item.preco_unitario = item.preco_unitario == null ? null : Number(item.preco_unitario);
    item.preco_total = item.preco_total == null ? null : Number(item.preco_total);
    const motivos = [];
    if (item.produto_nome == null) motivos.push('Produto não identificado');
    if (item.quantidade == null) motivos.push('Quantidade não identificada');
    if (item.unidade_medida == null) motivos.push('Unidade não identificada');
    if (item.preco_unitario == null) motivos.push('Preço unitário não identificado');
    if (item.preco_total == null) motivos.push('Total do item não identificado');
    if (item.quantidade != null && item.preco_unitario != null && item.preco_total != null) {
      const calc = item.quantidade * item.preco_unitario;
      const tol = Math.max(0.5, Math.abs(item.preco_total) * 0.01);
      if (!quaseIgual(calc, item.preco_total, tol)) {
        motivos.push(`Total do item (R$ ${item.preco_total.toFixed(2)}) difere de Qtd × Preço unit. (R$ ${calc.toFixed(2)})`);
      }
    }
    item._conferir = motivos.length > 0;
    item._motivo = motivos.join(' · ') || '';
    return item;
  });
  dados.itens = itensNorm;

  const somaItens = itensNorm.reduce((s, it) => s + (Number(it.preco_total) > 0 ? Number(it.preco_total) : 0), 0);
  if (dados.valor_total != null && dados.valor_total > 0 && somaItens > 0) {
    const tol = Math.max(1, dados.valor_total * 0.02);
    if (!quaseIgual(somaItens, dados.valor_total, tol)) {
      avisos.push(`Soma dos itens (R$ ${somaItens.toFixed(2)}) difere do valor total da nota (R$ ${Number(dados.valor_total).toFixed(2)}) — pode haver desconto, frete ou impostos. Conferir.`);
    }
  }
  if (!dados.numero) avisos.unshift('Número da NF não identificado.');
  dados._avisos = avisos;
  return dados;
}

// Interpreta uma ou mais imagens (URLs já enviadas) da MESMA nota fiscal.
// Usa InvokeLLM com file_urls (modelo multimodal). Retorna o mesmo formato
// de XML/PDF — campos + arquivo_url + _imagens_urls + _avisos + _conferir.
export async function extrairDadosImagemPorUrls(urls) {
  const resultado = await base44.integrations.Core.InvokeLLM({
    prompt: promptExtracaoNF(urls.length),
    file_urls: urls,
    response_json_schema: SCHEMA_NF,
  });
  return normalizarDadosExtraidos({
    ...(resultado || {}),
    _imagens_urls: urls,
    arquivo_url: urls[0] || '',
  });
}

// Faz upload + extração (XML local, PDF via LLM, ou IMAGEM via LLM multimodal).
// Retorna o mesmo objeto usado pela importação individual, incluindo arquivo_url.
export async function extrairDadosArquivo(file) {
  const { tipo } = classificarArquivo(file);
  if (tipo === 'nao_suportado') throw new Error('Formato não suportado. Aceita XML, PDF, JPG, JPEG, PNG ou WEBP.');
  if (!file.size) throw new Error('Arquivo vazio.');

  const { file_url } = await base44.integrations.Core.UploadFile({ file });

  if (tipo === 'xml') {
    const text = await file.text();
    const extraido = parseXMLNFe(text);
    return normalizarDadosExtraidos({ ...extraido, arquivo_url: file_url });
  }

  if (tipo === 'pdf') {
    const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: { type: 'object', properties: { texto: { type: 'string' } } }
    });
    const textoNota = extracted?.output?.texto || JSON.stringify(extracted?.output || '');
    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt: `Extraia os dados da nota fiscal abaixo e retorne um JSON com os campos: numero (string), fornecedor_nome (string), fornecedor_cnpj (string, apenas dígitos), data_emissao (string YYYY-MM-DD), valor_total (number), itens (array de objetos com: produto_nome, quantidade, unidade_medida, preco_unitario, preco_total). Se não encontrar algum campo, use null. Caso encontre campos ilegíveis, liste em _avisos. Nota fiscal:\n\n${textoNota}`,
      response_json_schema: SCHEMA_NF,
    });
    return normalizarDadosExtraidos({ ...resultado, arquivo_url: file_url });
  }

  // imagem: interpretação visual
  return extrairDadosImagemPorUrls([file_url]);
}

// Várias fotos da MESMA nota: envia todas e interpreta JUNTAS como uma NF única.
export async function extrairDadosImagens(files) {
  const validos = (files || []).filter(f => classificarArquivo(f).tipo === 'imagem');
  if (validos.length === 0) throw new Error('Selecione ao menos uma imagem (JPG, PNG ou WEBP).');
  const urls = [];
  for (const f of validos) {
    if (!f.size) throw new Error(`Arquivo "${f.name}" está vazio.`);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
    urls.push(file_url);
  }
  return extrairDadosImagemPorUrls(urls);
}

// Chave de duplicidade: produtor + número + CNPJ (CNPJ normalizado só dígitos).
export function chaveDuplicada(dados) {
  const cnpj = String(dados?.fornecedor_cnpj || '').replace(/\D/g, '');
  const numero = String(dados?.numero || '').trim();
  return `${numero}__${cnpj}`;
}

// Verifica no banco se já existe nota com mesma produtor+numero+cnpj (mesma
// regra da importação individual).
export async function verificarDuplicadaBanco(produtorId, dados) {
  const numeroNota = String(dados?.numero || '').trim();
  if (!produtorId || !numeroNota) return false;
  const existentes = await base44.entities.BaseNotasFiscais.filter({
    produtor_id: produtorId,
    numero_nota: numeroNota,
  });
  const cnpj = String(dados?.fornecedor_cnpj || '').replace(/\D/g, '');
  return (existentes || []).some(nota => {
    const cnpjExistente = String(nota.fornecedor_cnpj || '').replace(/\D/g, '');
    return !cnpj || !cnpjExistente || cnpj === cnpjExistente;
  });
}

// Cria BaseNotasFiscais + BaseItensNotaFiscal; em caso de erro após criar o
// cabeçalho, exclui a nota incompleta (compensação) e relança o erro.
export async function salvarNotaFiscal(produtorId, dados) {
  const numeroNota = String(dados?.numero || '').trim();
  if (!produtorId) throw new Error('Selecione o produtor.');
  if (!numeroNota) throw new Error('O número da nota não foi identificado. Confira o arquivo antes de salvar.');

  let notaCriada = null;
  try {
    notaCriada = await base44.entities.BaseNotasFiscais.create({
      produtor_id: produtorId,
      numero_nota: numeroNota,
      fornecedor_nome: dados.fornecedor_nome || '',
      fornecedor_cnpj: dados.fornecedor_cnpj || '',
      data_emissao: dados.data_emissao || null,
      valor_total: Number(dados.valor_total) || 0,
      arquivo_url: dados.arquivo_url || '',
    });

    // Base de Insumos para vínculo automático (somente correspondência exata),
    // tornando o sistema progressivamente mais inteligente a cada importação.
    let insumosIndex = null;
    try {
      const [ferts, fontes] = await Promise.all([
        base44.entities.FertilizanteFormulado.list(undefined, 5000),
        base44.entities.FonteSimples.list(undefined, 5000),
      ]);
      insumosIndex = construirInsumosIndex(ferts, fontes);
    } catch {
      // vínculo automático é opcional; a importação não é bloqueada.
      insumosIndex = null;
    }

    const itensPayload = (dados.itens || [])
      .filter(it => String(it.produto_nome || '').trim())
      .map(it => {
        const nomeItem = String(it.produto_nome || '').trim();
        const insumo = insumosIndex ? matchInsumoExato(nomeItem, insumosIndex) : null;
        return {
          nota_fiscal_id: notaCriada.id,
          produtor_id: produtorId,
          produto_nome: nomeItem,
          insumo_id: insumo ? insumo.id : null,
          insumo_tipo: insumo ? (insumo.tipo === 'fert' ? 'formulado' : 'fonte') : null,
          quantidade: Number(it.quantidade) || 0,
          unidade_medida: String(it.unidade_medida || '').toUpperCase(),
          preco_unitario: Number(it.preco_unitario) || 0,
          preco_total: Number(it.preco_total) || 0,
        };
      });

    if (itensPayload.length > 0) await base44.entities.BaseItensNotaFiscal.bulkCreate(itensPayload);
    return { nota: notaCriada, itens: itensPayload };
  } catch (e) {
    if (notaCriada?.id) {
      try {
        await base44.entities.BaseNotasFiscais.delete(notaCriada.id);
      } catch {
        // Se a compensação falhar, o erro original continua visível p/ conferência manual.
      }
    }
    throw e;
  }
}