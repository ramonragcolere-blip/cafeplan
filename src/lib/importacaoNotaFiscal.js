import { base44 } from '@/api/base44Client';

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

// Faz upload + extração (XML local ou PDF via LLM). Retorna o mesmo objeto
// usado pela importação individual, incluindo arquivo_url.
export async function extrairDadosArquivo(file) {
  const isXML = file.name.toLowerCase().endsWith('.xml');
  const { file_url } = await base44.integrations.Core.UploadFile({ file });

  if (isXML) {
    const text = await file.text();
    const extraido = parseXMLNFe(text);
    return { ...extraido, arquivo_url: file_url };
  }

  // PDF: extrai texto e usa LLM
  const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
    file_url,
    json_schema: { type: 'object', properties: { texto: { type: 'string' } } }
  });
  const textoNota = extracted?.output?.texto || JSON.stringify(extracted?.output || '');

  const resultado = await base44.integrations.Core.InvokeLLM({
    prompt: `Extraia os dados da nota fiscal abaixo e retorne um JSON com os campos: numero (string), fornecedor_nome (string), fornecedor_cnpj (string, apenas dígitos), data_emissao (string YYYY-MM-DD), valor_total (number), itens (array de objetos com: produto_nome, quantidade, unidade_medida, preco_unitario, preco_total). Se não encontrar algum campo, use null. Nota fiscal:\n\n${textoNota}`,
    response_json_schema: {
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
              preco_total: { type: 'number' }
            }
          }
        }
      }
    }
  });
  return { ...resultado, arquivo_url: file_url };
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

    const itensPayload = (dados.itens || [])
      .filter(it => String(it.produto_nome || '').trim())
      .map(it => ({
        nota_fiscal_id: notaCriada.id,
        produtor_id: produtorId,
        produto_nome: String(it.produto_nome || '').trim(),
        quantidade: Number(it.quantidade) || 0,
        unidade_medida: String(it.unidade_medida || '').toUpperCase(),
        preco_unitario: Number(it.preco_unitario) || 0,
        preco_total: Number(it.preco_total) || 0,
      }));

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