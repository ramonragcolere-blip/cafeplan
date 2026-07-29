import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { createBase44MemoryClient } from '@/testing/qa2/base44MemoryClient';
import { criarCafePlanQa2Fixtures } from '@/testing/qa2/fixtures/cafeplanQa2Fixtures';

export function criarQueryClientTeste() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function renderWithProviders(ui, options = {}) {
  const queryClient = options.queryClient || criarQueryClientTeste();
  const base44 = options.base44 || createBase44MemoryClient({
    seed: options.seed || criarCafePlanQa2Fixtures(),
  });
  const initialEntries = options.initialEntries || ['/'];

  const result = render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        {ui}
        <Toaster />
      </QueryClientProvider>
    </MemoryRouter>
  );

  return {
    ...result,
    queryClient,
    base44,
  };
}
