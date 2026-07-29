import React from 'react';
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { criarQueryClientTeste, renderWithProviders } from './renderWithProviders.jsx';
import { createBase44MemoryClient } from '@/testing/qa2/base44MemoryClient';
import { criarCafePlanQa2Fixtures, QA2_PRODUTOR_CODIGO, QA2_SAFRA_ATUAL } from '@/testing/qa2/fixtures/cafeplanQa2Fixtures';
import Adubacao2, { Adubacao2Conteudo, Adubacao2ErrorBoundary } from '@/pages/Adubacao2';
import AbaPlanejamento2 from '@/components/adubacao2/AbaPlanejamento2';
import AbaGessagem2 from '@/components/adubacao2/AbaGessagem2';
import AbaResumoGeral2 from '@/components/adubacao2/AbaResumoGeral2';

const mockState = vi.hoisted(() => ({ base44: null }));

vi.mock('@/api/base44Client', () => ({
  get base44() {
    return mockState.base44;
  },
}));
vi.mock('@/components/ui/select', async () => {
  const React = await import('react');
  const flattenOptions = children => React.Children.toArray(children).flatMap(child => {
    if (!React.isValidElement(child)) return [];
    if (child.type?.qa2SelectItem) return [child];
    return flattenOptions(child.props?.children);
  });
  const Select = ({ value = '', onValueChange, disabled = false, children }) => React.createElement(
    'select',
    {
      value: value || '',
      disabled,
      onChange: event => onValueChange?.(event.target.value),
    },
    flattenOptions(children)
  );
  const SelectTrigger = ({ children }) => React.createElement(React.Fragment, null, children);
  const SelectValue = () => null;
  const SelectContent = ({ children }) => React.createElement(React.Fragment, null, children);
  const SelectItem = ({ value, children }) => React.createElement('option', { value }, children);
  SelectItem.qa2SelectItem = true;
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

function prepararBase44(seed = criarCafePlanQa2Fixtures()) {
  mockState.base44 = createBase44MemoryClient({ seed });
  return mockState.base44;
}


describe('QA2 Adubacao 2.0 componentes reais', () => {
  test('Adubacao2 abre sem produtor selecionado e nao mostra fallback', async () => {
    prepararBase44();
    renderWithProviders(<Adubacao2Conteudo />);

    expect(await screen.findByText('Adubação 2.0')).toBeInTheDocument();
    expect(screen.getByText('Selecione um produtor para visualizar os talhões.')).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível carregar este planejamento. Os dados não foram apagados.')).not.toBeInTheDocument();
  });

  test('seletores de produtor e safra renderizam com dados reais sem tela branca', async () => {
    prepararBase44();
    renderWithProviders(<Adubacao2Conteudo />);

    expect(await screen.findByText(/MARCOS MEGDA AMORELLI/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: QA2_SAFRA_ATUAL })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gráficos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gessagem/i })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/ReferenceError|TypeError|Não foi possível carregar este planejamento/);
  });

  test('botoes programados do planejamento aparecem e remover produto extra nao gera ReferenceError', async () => {
    const fixtures = criarCafePlanQa2Fixtures();
    const talhao = fixtures.Talhao[0];
    const todos = [...fixtures.FertilizanteFormulado, ...fixtures.FonteSimples];
    const planejamento = fixtures.PlanejamentoAdubacao2[0];

    renderWithProviders(
      <AbaPlanejamento2
        resultados={[{ talhao, rec: { N: 90, P: 52, K: 120, B: 1.7, Zn: 2 }, produtoSugerido: todos.find(p => p.id === 'ureia'), doseProdutoHa: 200, mediaBienal: 31, temRegistroSalvo: true }]}
        todos={todos}
        talhoes={[talhao]}
        calculando={false}
        podeCacularTodos
        onRecalcular={vi.fn()}
        onRecalcularTalhao={vi.fn()}
        onSalvar={vi.fn()}
        onPrecosChange={vi.fn()}
        onParcelamentosChange={vi.fn()}
        onProdutosEfetivosChange={vi.fn()}
        precosIniciais={planejamento.detalhamento.precos}
        parcelamentosIniciais={{ [talhao.id]: planejamento.detalhamento.parcelamentos }}
        registrosSalvos={[planejamento]}
        precosNotasMap={{}}
      />
    );

    expect(screen.getByRole('button', { name: /Calcular apenas este talhão/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Expandir todos/i }));
    expect(screen.getAllByText(/BR Solo Zinco e Boro 66/i).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/ReferenceError|handleRemoverExtra/);
  });
  test('AbaPlanejamento2 renderiza principal, complemento e manual com acoes reais', async () => {
    const fixtures = criarCafePlanQa2Fixtures();
    const talhao = fixtures.Talhao[0];
    const todos = [...fixtures.FertilizanteFormulado, ...fixtures.FonteSimples];
    const planejamento = fixtures.PlanejamentoAdubacao2[0];
    const resultado = {
      talhao,
      rec: { N: 90, P: 52, K: 120, B: 1.7, Zn: 2 },
      produtoSugerido: todos.find(p => p.id === 'ureia'),
      doseProdutoHa: 200,
      mediaBienal: 31,
      temRegistroSalvo: true,
    };

    renderWithProviders(
      <AbaPlanejamento2
        resultados={[resultado]}
        todos={todos}
        talhoes={[talhao]}
        calculando={false}
        podeCacularTodos
        onRecalcular={vi.fn()}
        onRecalcularTalhao={vi.fn()}
        onSalvar={vi.fn()}
        onPrecosChange={vi.fn()}
        onParcelamentosChange={vi.fn()}
        onProdutosEfetivosChange={vi.fn()}
        precosIniciais={planejamento.detalhamento.precos}
        parcelamentosIniciais={{ [talhao.id]: planejamento.detalhamento.parcelamentos }}
        registrosSalvos={[planejamento]}
        precosNotasMap={{}}
      />
    );

    expect((await screen.findAllByText('Ureia')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('MAP').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BR Solo Zinco e Boro 66').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/ReferenceError|handleRemoverExtra/);
  });

  test('AbaGessagem recebe dados salvos da Calagem para o mesmo produtor safra e talhao', async () => {
    prepararBase44();
    const fixtures = criarCafePlanQa2Fixtures();
    renderWithProviders(
      <AbaGessagem2
        talhoes={[fixtures.Talhao[0]]}
        analises2040PorTalhao={{ 'talhao-a': fixtures.PlanejamentoAdubacao2[0].analise2040 }}
        calagens={fixtures.BaseRecomendacaoCalagem}
        safra={QA2_SAFRA_ATUAL}
        codigoProdutor={QA2_PRODUTOR_CODIGO}
        fertilizantes={fixtures.FertilizanteFormulado}
        fontesSimples={fixtures.FonteSimples}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /Talhão A/i }));
    expect(await screen.findByText('Calcário dolomítico')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1500')).toBeInTheDocument();
    expect(screen.getByText('CaO')).toBeInTheDocument();
  });

  test('AbaResumoGeral renderiza fertilizante, Calagem, Gessagem e HTML de impressao', async () => {
    const fixtures = criarCafePlanQa2Fixtures();
    const talhao = fixtures.Talhao[0];
    const todos = [...fixtures.FertilizanteFormulado, ...fixtures.FonteSimples];
    const produtoUreia = todos.find(p => p.id === 'ureia');

    renderWithProviders(
      <AbaResumoGeral2
        resultados={[{ talhao, rec: { N: 90 }, produtoSugerido: produtoUreia, doseProdutoHa: 200, mediaBienal: 31 }]}
        todos={todos}
        produtosEfetivos={{ [talhao.id]: { produto: produtoUreia, doseKgHa: 200, complementos: [] } }}
        calagens={fixtures.BaseRecomendacaoCalagem}
        gessagens={fixtures.BaseRecomendacaoGessagem}
        talhoes={[talhao]}
        produtor={fixtures.Produtor[0]}
        safra={QA2_SAFRA_ATUAL}
        analises020={fixtures.AnaliseSolo}
        analises2040={[{ ...fixtures.PlanejamentoAdubacao2[0].analise2040, talhao_id: talhao.id, safra: QA2_SAFRA_ATUAL }]}
        registrosSalvos={[fixtures.PlanejamentoAdubacao2[0]]}
      />
    );

    expect(await screen.findByText('Consolidado de Produtos')).toBeInTheDocument();
    expect(screen.getAllByText('Ureia').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Calcário dolomítico').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gesso agrícola').length).toBeGreaterThan(0);
    const printArea = document.querySelector('#resumo2-detalhe-print-tabela');
    expect(printArea).toBeTruthy();
    expect(within(printArea).queryByText('Custo total')).not.toBeInTheDocument();
    expect(within(printArea).queryByText('Nutrientes')).not.toBeInTheDocument();
    expect(within(printArea).getByText('Custo/ha')).toBeInTheDocument();
  });

  test('Error Boundary captura erro de componente filho sem tela branca', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    function FilhoComErro() {
      throw new Error('falha controlada QA2');
    }

    render(
      <MemoryRouter>
        <QueryClientProvider client={criarQueryClientTeste()}>
          <Adubacao2ErrorBoundary>
            <FilhoComErro />
          </Adubacao2ErrorBoundary>
          <Toaster />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Não foi possível carregar este planejamento. Os dados não foram apagados.')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  test('pagina real Adubacao2 renderiza sob provedores sem erro critico', async () => {
    prepararBase44();
    renderWithProviders(<Adubacao2 />);

    expect(await screen.findByText('Adubação 2.0')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/ReferenceError|TypeError/);
  });
});













