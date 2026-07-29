import { test, expect } from '@playwright/test';
import { abrirAdubacao2, esperarPaginaVisivel, registrarErrosPagina, selecionarProdutorSafra } from '../helpers/registrarErrosPagina.js';

test('visual print: Resumo Geral preserva layout A4, faixa verde, Calagem, Gessagem e graficos', async ({ page }) => {
  const errosPagina = registrarErrosPagina(page);
  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);
  await page.getByRole('button', { name: /Resumo Geral/i }).click();
  await esperarPaginaVisivel(page);

  const printArea = page.locator('#resumo2-print-area');
  await expect(printArea).toBeVisible();
  await page.emulateMedia({ media: 'print' });

  await expect(printArea).toContainText('Consolidado de Produtos');
  await expect(printArea).toContainText('Detalhamento por Talhão');
  await expect(printArea).toContainText('Calcário dolomítico');
  await expect(printArea).toContainText('Gesso agrícola');
  await expect(printArea).toContainText('Comparação Nutricional entre Talhões');

  const detalhePrint = page.locator('#resumo2-detalhe-print-tabela');
  await expect(detalhePrint).toContainText('Custo/ha');
  await expect(detalhePrint.getByText('Custo total')).toHaveCount(0);
  await expect(detalhePrint.getByText('Nutrientes')).toHaveCount(0);
  await expect(page.locator('.resumo2-print-btn').first()).toHaveCSS('display', 'none');
  await expect(page.locator('.resumo2-print-btn').nth(1)).toHaveCSS('display', 'none');

  const faixaTalhao = page.locator('.print-row-talhao').first();
  await expect(faixaTalhao).toHaveCSS('background-color', 'rgb(217, 242, 223)');
  await expect(page.locator('#resumo2-comparacao-print svg')).toHaveCount(2);

  await expect(page).toHaveScreenshot('resumo-geral-print.png', {
    animations: 'disabled',
    caret: 'hide',
  });
  await errosPagina.verificarSemErros();
});