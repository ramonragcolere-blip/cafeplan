import { expect } from '@playwright/test';

const mensagensIgnoradas = [
  /Download the React DevTools/i,
  /ResizeObserver loop completed/i,
];

export function registrarErrosPagina(page) {
  const erros = [];

  page.on('pageerror', error => {
    erros.push(`pageerror: ${error.message}`);
  });

  page.on('console', message => {
    if (!['error', 'warning'].includes(message.type())) return;
    const texto = message.text();
    if (mensagensIgnoradas.some(regex => regex.test(texto))) return;
    if (/ReferenceError|TypeError|Unhandled|Failed/i.test(texto) || message.type() === 'error') {
      erros.push(`console:${message.type()}: ${texto}`);
    }
  });

  page.on('requestfailed', request => {
    const url = request.url();
    if (/favicon|\.map$/.test(url)) return;
    erros.push(`requestfailed: ${request.method()} ${url} ${request.failure()?.errorText || ''}`);
  });

  return {
    erros,
    async verificarSemErros() {
      expect(erros).toEqual([]);
    },
  };
}

export async function abrirAdubacao2(page) {
  await page.goto('/adubacao2');
  await expect(page.getByRole('heading', { name: 'Adubação 2.0' })).toBeVisible();
  await expect(page.getByText('Selecione um produtor para visualizar os talhões.')).toBeVisible();
}

export async function selecionarProdutorSafra(page, safra = '2026/2027') {
  await page.getByRole('combobox').nth(0).click();
  await page.getByRole('option', { name: /MARCOS MEGDA AMORELLI/i }).click();
  await expect(page.getByText('Talhão A')).toBeVisible();
  await page.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: safra }).click();
  await expect(page.getByText('Talhão A')).toBeVisible();
}

export async function esperarPaginaVisivel(page) {
  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page.getByText('Não foi possível carregar este planejamento. Os dados não foram apagados.')).toHaveCount(0);
}
