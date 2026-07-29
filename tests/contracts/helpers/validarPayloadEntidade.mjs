import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, visit } from 'jsonc-parser';

export const ENTITIES_DIR = fileURLToPath(new URL('../../../base44/entities/', import.meta.url));

export function lerSchemasEntidades() {
  const schemas = new Map();
  for (const arquivo of readdirSync(ENTITIES_DIR).filter(nome => nome.endsWith('.jsonc'))) {
    const caminho = join(ENTITIES_DIR, arquivo);
    const texto = readFileSync(caminho, 'utf8');
    const erros = [];
    const schema = parse(texto, erros, { allowTrailingComma: true, disallowComments: false });
    if (erros.length > 0) {
      const detalhes = erros.map(erro => `${erro.error}@${erro.offset}`).join(', ');
      throw new Error(`${arquivo} possui JSONC invalido: ${detalhes}`);
    }
    schemas.set(schema.name, { arquivo, texto, schema });
  }
  return schemas;
}

export function listarPropriedadesDuplicadasJsonc(texto) {
  const pilha = [];
  const duplicadas = [];
  visit(texto, {
    onObjectBegin: () => pilha.push(new Map()),
    onObjectProperty: (property) => {
      const atual = pilha.at(-1);
      if (!atual) return;
      atual.set(property, (atual.get(property) || 0) + 1);
      if (atual.get(property) === 2) duplicadas.push(property);
    },
    onObjectEnd: () => pilha.pop(),
  });
  return duplicadas;
}

function tipoCompativel(tipo, valor) {
  if (valor == null) return true;
  if (tipo === 'array') return Array.isArray(valor);
  if (tipo === 'number') return typeof valor === 'number' && Number.isFinite(valor);
  if (tipo === 'integer') return Number.isInteger(valor);
  if (tipo === 'object') return typeof valor === 'object' && !Array.isArray(valor);
  if (tipo === 'boolean') return typeof valor === 'boolean';
  if (tipo === 'string') return typeof valor === 'string';
  return true;
}

export function validarPayloadEntidade(nomeEntidade, payload, schemas = lerSchemasEntidades()) {
  const entrada = schemas.get(nomeEntidade);
  if (!entrada) throw new Error(`Schema nao encontrado para entidade ${nomeEntidade}`);
  const propriedades = entrada.schema.properties || {};
  const camposPermitidos = new Set(Object.keys(propriedades));
  const erros = [];

  for (const campo of entrada.schema.required || []) {
    if (!camposPermitidos.has(campo)) erros.push(`Campo obrigatorio inexistente no schema ${nomeEntidade}: ${campo}`);
    if (!(campo in payload)) erros.push(`Payload de ${nomeEntidade} sem campo obrigatorio: ${campo}`);
  }

  for (const [campo, valor] of Object.entries(payload || {})) {
    if (!camposPermitidos.has(campo)) {
      erros.push(`Campo desconhecido em ${nomeEntidade}: ${campo}`);
      continue;
    }
    const tipo = propriedades[campo]?.type;
    if (!tipoCompativel(tipo, valor)) {
      erros.push(`Tipo incompativel em ${nomeEntidade}.${campo}: esperado ${tipo}, recebido ${Array.isArray(valor) ? 'array' : typeof valor}`);
    }
  }

  if (erros.length > 0) throw new Error(erros.join('; '));
  return true;
}
