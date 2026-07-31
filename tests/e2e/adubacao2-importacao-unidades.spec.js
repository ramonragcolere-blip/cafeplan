import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { abrirAdubacao2, registrarErrosPagina, selecionarProdutorSafra } from './helpers/registrarErrosPagina.js';

const fixturePdf = join(process.cwd(), 'tests', 'fixtures', 'analise-solo-publicas', 'cooxupe-mmolc-sintetico.pdf');

async function importarAnaliseMmolc(page) {
  await page.locator('input[type="file"][accept="application/pdf"]').first().setInputFiles(fixturePdf);
  await expect(page.getByText(/Original: 4 mmolc\/dm³ .* Convertido: 156,4 mg\/dm³/)).toBeVisible();
  await expect(page.locator('input[value="156.4"]')).toBeVisible();
  await expect(page.locator('input[value="2.8"]')).toBeVisible();
  await expect(page.locator('input[value="1.1"]')).toBeVisible();
  await expect(page.locator('input[value="8.7"]')).toBeVisible();
  await page.getByRole('button', { name: /Confirmar e salvar/i }).click();
  await expect(page.getByText('Análise salva com sucesso!')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const raw = localStorage.getItem('cafeplan-qa2-base44-memory');
    const db = raw ? JSON.parse(raw) : null;
    return db?.tables?.AnaliseSolo?.find(item => item.talhao_id === 'talhao-a' && item.safra === '2026/2027')?.potassio;
  })).toBe(156.4);
  await expect(page.getByRole('heading', { name: /Importar Análise de Solo/i })).toHaveCount(0);
}

async function abrirVerAnalisesPrimeiroTalhao(page) {
  await page.getByRole('button', { name: /Ver análises/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Análises do talhão' })).toBeVisible();
}

async function confirmarValoresConvertidos(page) {
  await expect(page.getByText('Potássio')).toBeVisible();
  await expect(page.getByText('156,4')).toBeVisible();
  await expect(page.getByText('Cálcio')).toBeVisible();
  await expect(page.getByText('2,8')).toBeVisible();
  await expect(page.getByText('Magnésio')).toBeVisible();
  await expect(page.getByText('1,1').first()).toBeVisible();
  await expect(page.getByText('CTC')).toBeVisible();
  await expect(page.getByText('8,7')).toBeVisible();
  await expect(page.getByText('6.115,2')).toHaveCount(0);
}

test('importa analise em mmolc, salva, restaura e nao converte novamente', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('qa2-importacao-unidades-reset')) return;
    localStorage.removeItem('cafeplan-qa2-base44-memory');
    sessionStorage.setItem('qa2-importacao-unidades-reset', '1');
  });
  const errosPagina = registrarErrosPagina(page);

  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);
  await importarAnaliseMmolc(page);

  await abrirVerAnalisesPrimeiroTalhao(page);
  await confirmarValoresConvertidos(page);
  await page.getByRole('button', { name: 'Fechar' }).click();

  await page.reload();
  await selecionarProdutorSafra(page);
  await abrirVerAnalisesPrimeiroTalhao(page);
  await confirmarValoresConvertidos(page);
  await errosPagina.verificarSemErros();
});
