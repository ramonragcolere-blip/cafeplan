import { test, expect } from '@playwright/test';
import { abrirAdubacao2, esperarPaginaVisivel, registrarErrosPagina, selecionarProdutorSafra } from './helpers/registrarErrosPagina.js';

async function resetarMock(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('cafeplan-qa2-base44-memory'));
}

async function abrirPlanejamento(page) {
  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);
  await page.getByRole('button', { name: /Planejamento/i }).click();
  await esperarPaginaVisivel(page);
  await expect(page.getByRole('button', { name: /Replicar recomendação/i }).first()).toBeVisible();
}

test('replica recomendacao completa entre talhoes e persiste sem duplicar', async ({ page }) => {
  await resetarMock(page);
  const errosPagina = registrarErrosPagina(page);
  await abrirPlanejamento(page);

  await page.getByRole('button', { name: /Replicar recomendação/i }).first().click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('Origem: Talhão A');
  await expect(modal.getByLabel('Talhão A')).toHaveCount(0);
  await modal.getByText('Selecionar todos').click();
  await expect(modal).toContainText('2 talhão(ões) serão afetados.');
  await expect(modal.getByRole('checkbox', { name: 'Planejamento de adubação', exact: true })).toBeChecked();
  await expect(modal.getByRole('checkbox', { name: 'Calagem', exact: true })).toBeChecked();
  await expect(modal.getByRole('checkbox', { name: 'Gessagem', exact: true })).toBeChecked();
  await expect(modal).toContainText('Produtos: 3');
  await expect(modal).toContainText('A recomendação de gessagem será replicada');
  await modal.getByRole('combobox').selectOption('substituir');
  await modal.getByLabel(/Confirmo replicar gessagem/i).check();
  await modal.getByLabel(/Confirmo a replicação/i).check();
  await modal.getByRole('button', { name: /Replicar para 2 talhão/i }).click();

  await expect(modal).toContainText('Resultado final da operação');
  await expect(modal).toContainText('Atualizados: 2');
  await modal.getByRole('button', { name: /Cancelar/i }).click();

  await expect(page.getByText(/Recomendação replicada do talhão 'Talhão A'/i).first()).toBeVisible();
  await page.getByRole('button', { name: /Consolidação de Compras/i }).click();
  await expect(page.getByText('Ureia').first()).toBeVisible();
  await expect(page.getByText('Calcário dolomítico').first()).toBeVisible();
  await expect(page.getByText('Gesso agrícola').first()).toBeVisible();

  await page.getByRole('button', { name: /Resumo Geral/i }).click();
  await expect(page.getByText('Consolidado de Produtos')).toBeVisible();
  await expect(page.getByText('Talhão B').first()).toBeVisible();

  await page.reload();
  await selecionarProdutorSafra(page);
  await page.getByRole('button', { name: /Planejamento/i }).click();
  await expect(page.getByText(/Recomendação replicada do talhão 'Talhão A'/i).first()).toBeVisible();
  await page.getByRole('button', { name: /Consolidação de Compras/i }).click();
  await expect(page.getByText('Gesso agrícola')).toHaveCount(1);
  await errosPagina.verificarSemErros();
});
