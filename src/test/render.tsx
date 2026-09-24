import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

/** A fresh client per test: no retries, nothing shared between tests. */
export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: 0 } },
  });
}

interface Options extends Omit<RenderOptions, 'wrapper'> {
  client?: QueryClient;
  route?: string;
}

/** Render inside the providers screens expect: React Query and a router. */
export function renderWithProviders(
  ui: ReactElement,
  { client = testQueryClient(), route = '/', ...options }: Options = {},
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { client, ...render(ui, { wrapper, ...options }) };
}
