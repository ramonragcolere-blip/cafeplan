import { test, expect } from '@playwright/test';
import { abrirAdubacao2, esperarPaginaVisivel, registrarErrosPagina, selecionarProdutorSafra } from '../helpers/registrarErrosPagina.js';

test('visual print: Resumo Geral preserva layout A4, faixa verde, Calagem, Gessagem e graficos', async ({ page }) => {
  const errosPagina = registrarErrosPagina(page);
  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);
  await page.getByRole('button', { name: /Resumo Geral/i }).click();
  await esperarPaginaVisivel(page);
  await page.emulateMedia({ media: 'print' });

  const printArea = page.locator('#resumo2-print-area');
  await expect(printArea).toBeVisible();
  await expect(printArea.getByText('Consolidado de Produtos')).toBeVisible();
  await expect(printArea.getByText('Detalhamento por Talhão')).toBeVisible();
  await expect(printArea.getByText('Calcário dolomítico').first()).toBeVisible();
  await expect(printArea.getByText('Gesso agrícola').first()).toBeVisible();
  await expect(printArea.getByText('Comparação Nutricional entre Talhões')).toBeVisible();

  const detalhePrint = page.locator('#resumo2-detalhe-print-tabela');
  await expect(detalhePrint.getByText('Custo/ha')).toBeVisible();
  await expect(detalhePrint.getByText('Custo total')).toHaveCount(0);
  await expect(detalhePrint.getByText('Nutrientes')).toHaveCount(0);
  await expect(page.locator('.resumo2-print-btn')).toHaveCSS('display', 'none');

  const faixaTalhao = page.locator('.print-row-talhao').first();
  await expect(faixaTalhao).toHaveCSS('background-color', 'rgb(217, 242, 223)');
  await expect(page.locator('#resumo2-comparacao-print svg')).toBeVisible();

  await expect(printArea).toHaveScreenshot('resumo-geral-print.png', {
    animations: 'disabled',
    caret: 'hide',
  });
  await errosPagina.verificarSemErros();
});
