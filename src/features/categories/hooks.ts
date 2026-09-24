import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/shared/api';
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from '@/shared/api';

export const categoriesKey = ['categories'] as const;

export function useCategories() {
  return useQuery({
    queryKey: categoriesKey,
    queryFn: () => api.listCategories(),
    staleTime: 5 * 60_000,
  });
}

/** id → category lookup for list rows; empty while loading. */
export function useCategoryMap(): Map<string, Category> {
  const { data } = useCategories();
  return useMemo(() => new Map((data ?? []).map((c) => [c.id, c])), [data]);
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCategoryRequest | Omit<CreateCategoryRequest, 'keywords'>) => api.createCategory(input),
    onSuccess: (created) => {
      qc.setQueryData<Category[]>(categoriesKey, (old) => [...(old ?? []), created]);
      void qc.invalidateQueries({ queryKey: categoriesKey });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateCategoryRequest }) => api.updateCategory(id, patch),
    onSuccess: (updated) => {
      qc.setQueryData<Category[]>(categoriesKey, (old) => (old ?? []).map((c) => (c.id === updated.id ? updated : c)));
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: (_data, id) => {
      qc.setQueryData<Category[]>(categoriesKey, (old) => (old ?? []).filter((c) => c.id !== id));
      // Tasks that pointed at it now have categoryId: null on the server.
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
