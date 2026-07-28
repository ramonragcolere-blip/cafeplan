import { test, expect } from '@playwright/test';
import { abrirAdubacao2, esperarPaginaVisivel, registrarErrosPagina, selecionarProdutorSafra } from './helpers/registrarErrosPagina.js';

async function irAba(page, nome) {
  await page.getByRole('button', { name: new RegExp(nome, 'i') }).click();
  await esperarPaginaVisivel(page);
}

test('fluxo Planejamento: calcular talhao, editar, remover, salvar e recarregar preserva dados', async ({ page }) => {
  const errosPagina = registrarErrosPagina(page);
  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);

  await page.getByRole('button', { name: /Calcular talhão/i }).first().click();
  await expect(page.getByText(/Recomendação do talhão Talhão A calculada com sucesso/i)).toBeVisible();
  await expect(page.getByText('Talhão B')).toBeVisible();

  await irAba(page, 'Planejamento');
  await expect(page.getByText('Ureia')).toBeVisible();
  const dose = page.locator('input[type="number"]').first();
  await dose.fill('260');
  const preco = page.locator('input[type="number"]').nth(1);
  await preco.fill('6.25');
  await page.getByRole('button', { name: /\+ Adicionar produto/i }).first().click();
  await page.getByRole('button', { name: /Remover do planejamento/i }).first().click();
  await page.getByRole('button', { name: /Salvar planejamento/i }).click();

  await irAba(page, 'Resumo Geral');
  await page.reload();
  await selecionarProdutorSafra(page);
  await irAba(page, 'Planejamento');
  await expect(page.getByText(/Dose ajustada manualmente/i).first()).toBeVisible();
  await errosPagina.verificarSemErros();
});

test('fluxo multinutriente: BR Solo 66 mostra B e Zn sem dupla contagem visivel', async ({ page }) => {
  const errosPagina = registrarErrosPagina(page);
  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);
  await irAba(page, 'Planejamento');

  await expect(page.getByText('BR Solo Zinco e Boro 66')).toBeVisible();
  await expect(page.getByText(/B 6,0 kg\/ha · Zn 6,0 kg\/ha/i)).toBeVisible();
  await expect(page.getByText(/BR Solo Zinco e Boro 66/)).toHaveCount(1);
  await errosPagina.verificarSemErros();
});

test('fluxo Calagem e Gessagem: importar calcario, salvar gessagem e confirmar no Resumo', async ({ page }) => {
  const errosPagina = registrarErrosPagina(page);
  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);

  await irAba(page, 'Calagem');
  await page.getByRole('button', { name: /Talhão A/i }).click();
  await expect(page.getByText('Calcário dolomítico')).toBeVisible();
  await expect(page.getByText(/R\$ 500,00\/t|R\$ 500,00\/t/)).toBeVisible();

  await irAba(page, 'Gessagem');
  await page.getByRole('button', { name: /Talhão A/i }).click();
  await expect(page.getByText('Calcário dolomítico')).toBeVisible();
  await expect(page.getByText('1.500')).toBeVisible();
  await expect(page.getByText('Gesso agrícola')).toBeVisible();
  await page.getByRole('button', { name: /^Salvar$/i }).click();

  await irAba(page, 'Resumo Geral');
  await expect(page.getByText('Gesso agrícola').first()).toBeVisible();
  await expect(page.getByText(/Método utilizado/i).first()).toBeVisible();
  await errosPagina.verificarSemErros();
});

test('fluxo registro legado: planejamento antigo abre sem tela branca e preserva produto valido', async ({ page }) => {
  const errosPagina = registrarErrosPagina(page);
  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);
  await irAba(page, 'Planejamento');

  await expect(page.getByText('Talhão B')).toBeVisible();
  await expect(page.getByText('MAP')).toBeVisible();
  await esperarPaginaVisivel(page);
  await errosPagina.verificarSemErros();
});

test('fluxo produto 0: registro antigo fica ausente do Resumo Geral e da impressao', async ({ page }) => {
  const errosPagina = registrarErrosPagina(page);
  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);
  await irAba(page, 'Resumo Geral');

  await expect(page.locator('#resumo2-print-area')).toBeVisible();
  await expect(page.locator('#resumo2-print-area').getByText(/^0$/)).toHaveCount(0);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#resumo2-detalhe-print-tabela').getByText(/^0$/)).toHaveCount(0);
  await errosPagina.verificarSemErros();
});

test('fluxo Graficos: modos talhao individual e todos os talhoes trocam nutriente sem misturar dados', async ({ page }) => {
  const errosPagina = registrarErrosPagina(page);
  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);
  await irAba(page, 'Gráficos');

  await expect(page.getByText('Modo de visualização')).toBeVisible();
  await expect(page.getByText('Todos os talhões')).toBeVisible();
  await page.getByText('Talhão individual').click();
  await expect(page.getByText('Situação da Safra Atual')).toBeVisible();
  await expect(page.getByText('Comparação entre Safras')).toBeVisible();
  await page.getByText('Todos os talhões').click();
  await expect(page.getByText(/Índice de adequação/i)).toBeVisible();
  await errosPagina.verificarSemErros();
});
