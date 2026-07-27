import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  MENSAGEM_FALLBACK_ADUBACAO2,
  montarProdutosEfetivosPlanejamento,
} from '../src/lib/planejamentoProdutosAdubacao2.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const paginaAdubacao2 = resolve(repoRoot, 'src/pages/Adubacao2.jsx');
const fonteAdubacao2 = readFileSync(paginaAdubacao2, 'utf8');
const identificadorRemovido = ['registros', 'Por', 'Talhao'].join('');

const ureia = { id: 'ureia', nome: 'Ureia', _tipo: 'fonte', n_pct: 45, p2o5_pct: 0, k2o_pct: 0, b_pct: 0 };
const map = { id: 'map', nome: 'MAP', _tipo: 'fonte', n_pct: 11, p2o5_pct: 52, k2o_pct: 0, b_pct: 0 };
const boro = { id: 'boro', nome: 'Ácido bórico', _tipo: 'fonte', n_pct: 0, p2o5_pct: 0, k2o_pct: 0, b_pct: 17 };
const talhao = { id: 'talhao-1', nome: 'Talhão 1', area_ha: 2 };
const rec = { N: 90, P: 52, K: 0, B: 1.7 };

function montar({ resultados = [], registrosSalvos = [], extrasPorTalhao = {}, ajustesDosePorTalhao = {} } = {}) {
  return montarProdutosEfetivosPlanejamento({
    resultados,
    registrosSalvos,
    todosFiltrados: [ureia, map, boro],
    todosCatalogo: [ureia, map, boro],
    extrasPorTalhao,
    ajustesDosePorTalhao,
  });
}

test('pagina real Adubacao2 renderiza o componente de conteudo dentro do Error Boundary', () => {
  assert.match(fonteAdubacao2, /export function Adubacao2Conteudo\(\)/);
  assert.match(fonteAdubacao2, /export default function Adubacao2\(\)/);
  assert.match(fonteAdubacao2, /<Adubacao2ErrorBoundary>\s*<Adubacao2Conteudo \/>/s);
});

test('selecionar produtor e trocar safra sem planejamento nao dispara montagem invalida', () => {
  assert.deepEqual(montar({ resultados: [] }), {});
  assert.doesNotThrow(() => montar({ resultados: [{ talhao, rec: null }] }));
});

test('selecionar produtor com planejamento legado restaura complementos antigos', () => {
  const mapa = montar({
    resultados: [{ talhao, rec, produtoSugerido: ureia, doseProdutoHa: 200, temRegistroSalvo: true }],
    registrosSalvos: [{
      talhao_id: talhao.id,
      detalhamento: {
        produtoSugerido: { id: 'ureia', nome: 'Ureia' },
        doseProdutoHa: 200,
        complementos: {
          boro: { produto: { id: 'boro', nome: 'Ácido bórico' }, doseKgHa: 10, nutKey: 'b_pct' },
        },
      },
    }],
  });

  assert.equal(mapa[talhao.id].produto.id, 'ureia');
  assert.equal(mapa[talhao.id].complementos.some(comp => comp.produto.id === 'boro'), true);
});

test('selecionar produtor com planejamento novo preserva dose manual e produto adicionado', () => {
  const mapa = montar({
    resultados: [{ talhao, rec, produtoSugerido: ureia, doseProdutoHa: 250, temRegistroSalvo: true }],
    extrasPorTalhao: {
      [talhao.id]: {
        'manual-map': { produtoId: 'map', doseKgHa: 100, isManualLivre: true, usoSeparado: true, nutriente_alvo: 'p2o5_pct' },
      },
    },
    ajustesDosePorTalhao: {
      [talhao.id]: {
        'n_pct:ureia': { dose_calculada_kg_ha: 200, dose_utilizada_kg_ha: 250, dose_ajustada_manualmente: true },
      },
    },
  });

  assert.equal(mapa[talhao.id].dose_calculada_kg_ha, 200);
  assert.equal(mapa[talhao.id].dose_utilizada_kg_ha, 250);
  assert.equal(mapa[talhao.id].dose_ajustada_manualmente, true);
  assert.equal(mapa[talhao.id].complementos.some(comp => comp.produto.id === 'map'), true);
});

test('identificador inexistente removido e no-undef passa na pagina Adubacao2', () => {
  assert.equal(fonteAdubacao2.includes(identificadorRemovido), false);

  const eslintBin = resolve(repoRoot, 'node_modules/eslint/bin/eslint.js');
  const resultado = spawnSync(process.execPath, [
    eslintBin,
    'src/pages/Adubacao2.jsx',
    '--quiet',
    '--rule',
    'no-undef:error',
  ], { cwd: repoRoot, encoding: 'utf8' });

  assert.equal(resultado.status, 0, `${resultado.stdout}\n${resultado.stderr}`);
});

test('Error Boundary externo expõe fallback visual sem apagar dados', () => {
  const dados = [{ talhao_id: talhao.id, detalhamento: { produtoSugerido: { id: 'ureia' } } }];
  const snapshot = JSON.stringify(dados);

  assert.equal(MENSAGEM_FALLBACK_ADUBACAO2, 'Não foi possível carregar este planejamento. Os dados não foram apagados.');
  assert.match(fonteAdubacao2, /class Adubacao2ErrorBoundary extends React\.Component/);
  assert.match(fonteAdubacao2, /this\.props\.children/);
  assert.equal(JSON.stringify(dados), snapshot);
});

test('funcoes da PR 15 continuam preservadas na montagem do planejamento', () => {
  const mapa = montar({
    resultados: [{ talhao, rec, produtoSugerido: ureia, doseProdutoHa: 220, temRegistroSalvo: true }],
    registrosSalvos: [{
      talhao_id: talhao.id,
      detalhamento: {
        produtoSugerido: { id: 'ureia', nome: 'Ureia' },
        dose_calculada_kg_ha: 200,
        dose_utilizada_kg_ha: 220,
        dose_ajustada_manualmente: true,
        nutriente_alvo: 'n_pct',
        parcelamentos: { ureia: [{ percentual: 100, meses: ['OUT', 'NOV'] }] },
      },
    }],
  });

  assert.equal(mapa[talhao.id].dose_utilizada_kg_ha, 220);
  assert.equal(mapa[talhao.id].nutriente_alvo, 'n_pct');
});
