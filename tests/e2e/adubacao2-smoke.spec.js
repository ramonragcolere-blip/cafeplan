import { test, expect } from '@playwright/test';
import { abrirAdubacao2, esperarPaginaVisivel, registrarErrosPagina, selecionarProdutorSafra } from './helpers/registrarErrosPagina.js';

test('smoke: Adubacao 2.0 abre, troca safra e navega por todas as abas sem erro de console', async ({ page }) => {
  const errosPagina = registrarErrosPagina(page);

  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);

  for (const aba of ['Análises e Importação', 'Gráficos', 'Calagem', 'Gessagem', 'Planejamento', 'Consolidação de Compras', 'Resumo Geral']) {
    await page.getByRole('button', { name: new RegExp(aba, 'i') }).click();
    await esperarPaginaVisivel(page);
  }

  await expect(page.getByRole('button', { name: /Calcular talhão/i }).first()).toBeVisible();
  await errosPagina.verificarSemErros();
});
