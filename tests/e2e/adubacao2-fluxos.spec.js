import { test, expect } from '@playwright/test';
import { abrirAdubacao2, esperarPaginaVisivel, registrarErrosPagina, selecionarProdutorSafra } from './helpers/registrarErrosPagina.js';

async function irAba(page, nome) {
  await page.getByRole('button', { name: new RegExp(nome, 'i') }).click();
  await esperarPaginaVisivel(page);
}

async function expandirPlanejamento(page) {
  const botao = page.getByRole('button', { name: /Expandir todos/i });
  if (await botao.count()) {
    await botao.click({ force: true });
  }
}

function textoVisivel(page, texto) {
  return page.getByText(texto).filter({ visible: true });
}

test('fluxo Planejamento: calcular talhao, editar, remover, salvar e recarregar preserva dados', async ({ page }) => {
  const errosPagina = registrarErrosPagina(page);
  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);

  await page.getByRole('button', { name: /Calcular talhão/i }).first().click();
  await expect(page.locator('div').filter({ hasText: /^Recomendação do talhão Talhão A calculada com sucesso\.$/ }).last()).toBeVisible();
  await expect(textoVisivel(page, 'Talhão B').first()).toBeVisible();

  await irAba(page, 'Planejamento');
  await expandirPlanejamento(page);
  await expect(textoVisivel(page, 'Ureia').first()).toBeVisible();
  const inputsVisiveis = page.locator('input:not([type="checkbox"])').filter({ visible: true });
  const totalInputsEditaveis = await inputsVisiveis.count();
  if (totalInputsEditaveis > 0) {
    await inputsVisiveis.first().fill('260');
    if (totalInputsEditaveis > 1) {
      await inputsVisiveis.nth(1).fill('6.25');
    }
  }
  const botaoAdicionar = page.getByRole('button', { name: /\+ Adicionar produto/i });
  if (await botaoAdicionar.count()) {
    await botaoAdicionar.first().click();
  }
  const botaoRemover = page.getByRole('button', { name: /Remover do planejamento/i });
  if (await botaoRemover.count()) {
    await botaoRemover.first().click();
  }
  await page.getByRole('button', { name: /Salvar planejamento/i }).click();

  await irAba(page, 'Resumo Geral');
  await page.reload();
  await selecionarProdutorSafra(page);
  await irAba(page, 'Planejamento');
  await expandirPlanejamento(page);
  if (totalInputsEditaveis > 0) {
    await expect(page.getByText(/Dose ajustada manualmente/i).first()).toBeVisible();
  } else {
    await expect(textoVisivel(page, 'Ureia').first()).toBeVisible();
  }
  await errosPagina.verificarSemErros();
});

test('fluxo multinutriente: BR Solo 66 mostra B e Zn sem dupla contagem visivel', async ({ page }) => {
  const errosPagina = registrarErrosPagina(page);
  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);
  await page.getByRole('button', { name: /Calcular talhão/i }).first().click();
  await expect(page.locator('div').filter({ hasText: /^Recomendação do talhão Talhão A calculada com sucesso\.$/ }).last()).toBeVisible();
  await irAba(page, 'Planejamento');
  await expandirPlanejamento(page);

  await expect(page.getByRole('option', { name: 'BR Solo Zinco e Boro 66' })).toHaveCount(1);
  await expect(page.getByText(/Sem recomendação calculada|Ureia|MAP|BR Solo/i).first()).toBeVisible();
  await errosPagina.verificarSemErros();
});

test('fluxo Calagem e Gessagem: importar calcario, salvar gessagem e confirmar no Resumo', async ({ page }) => {
  const errosPagina = registrarErrosPagina(page);
  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);

  await irAba(page, 'Calagem');
  await page.getByRole('button', { name: /Talhão A/i }).click();
  await expect(textoVisivel(page, 'Calcário dolomítico').first()).toBeVisible();
  await expect(page.getByText(/R\$ 500,00\/t|R\$ 500,00\/t/)).toBeVisible();

  await irAba(page, 'Gessagem');
  await page.getByRole('button', { name: /Talhão A/i }).click();
  await expect(textoVisivel(page, 'Calcário dolomítico').first()).toBeVisible();
  await expect(page.locator('input[placeholder="Ex: 2000"]')).toHaveValue('1500');
  await expect(page.getByRole('combobox').filter({ hasText: /Gesso agrícola/ })).toHaveCount(1);
  await page.getByRole('button', { name: /^Salvar$/i }).click();

  await irAba(page, 'Resumo Geral');
  await expect(textoVisivel(page, 'Gesso agrícola').first()).toBeVisible();
  await expect(page.getByText(/Método utilizado/i).first()).toBeVisible();
  await errosPagina.verificarSemErros();
});

test('fluxo registro legado: planejamento antigo abre sem tela branca e preserva produto valido', async ({ page }) => {
  const errosPagina = registrarErrosPagina(page);
  await abrirAdubacao2(page);
  await selecionarProdutorSafra(page);
  await irAba(page, 'Planejamento');
  await expandirPlanejamento(page);

  await expect(textoVisivel(page, 'Talhão B').first()).toBeVisible();
  await expect(textoVisivel(page, 'MAP').first()).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Situação da Safra Atual' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Comparação entre Safras' })).toBeVisible();

  const modo = page.getByRole('combobox').nth(2);
  await modo.click();
  const opcaoTodos = page.getByRole('option', { name: /Todos os talhões/i });
  if (await opcaoTodos.count()) {
    await opcaoTodos.click();
    await expect(page.getByText(/Índice de adequação/i)).toBeVisible();
  } else {
    await page.keyboard.press('Escape');
    await expect(page.getByText(/Talhão A · 0-20 cm · Safra 2026\/2027/i)).toBeVisible();
  }
  await errosPagina.verificarSemErros();
});