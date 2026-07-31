import { test, expect } from '@playwright/test';
import { abrirAdubacao2, selecionarProdutorSafra } from '../helpers/registrarErrosPagina.js';

test('visual: modal de replicacao de recomendacao mostra resumo, conflitos e confirmacoes', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('cafeplan-qa2-base44-memory'));
  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);
  await page.getByRole('button', { name: /Planejamento/i }).click();
  await page.getByRole('button', { name: /Replicar recomendação/i }).first().click();

  const modal = page.getByRole('dialog');
  await modal.getByText('Selecionar todos').click();
  await expect(modal).toContainText('Resumo da recomendação');
  await expect(modal).toContainText('Planejamento');
  await expect(modal).toContainText('Calagem');
  await expect(modal).toContainText('Gessagem');
  await expect(modal).toContainText('A recomendação de gessagem será replicada');
  await expect(modal.getByRole('button', { name: /Replicar para 2 talhão/i })).toBeVisible();
  await modal.screenshot({ path: 'test-results/visual-replicar-recomendacao-modal.png' });
});
