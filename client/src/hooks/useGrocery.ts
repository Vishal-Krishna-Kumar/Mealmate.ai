import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { GroceryList, GroceryCategory } from '@/types';

export function useGroceryLists() {
  return useQuery({
    queryKey: ['grocery'],
    queryFn: async (): Promise<GroceryList[]> => {
      const { data } = await api.get<{ items: GroceryList[] }>('/grocery');
      return data.items;
    },
  });
}

export function useGroceryList(id: string | undefined) {
  return useQuery({
    queryKey: ['grocery', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<GroceryList> => {
      const { data } = await api.get<{ list: GroceryList }>(`/grocery/${id}`);
      return data.list;
    },
  });
}

export interface UpdateGroceryItemInput {
  listId: string;
  itemId: string;
  patch: { checked?: boolean; quantity?: number; unit?: string; category?: GroceryCategory };
}

export function useUpdateGroceryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, itemId, patch }: UpdateGroceryItemInput): Promise<GroceryList> => {
      const { data } = await api.patch<{ list: GroceryList }>(`/grocery/${listId}/items`, {
        itemId,
        ...patch,
      });
      return data.list;
    },
    // Optimistic update so checking a box feels instant.
    onMutate: async ({ listId, itemId, patch }) => {
      await qc.cancelQueries({ queryKey: ['grocery', listId] });
      const prev = qc.getQueryData<GroceryList>(['grocery', listId]);
      if (prev) {
        qc.setQueryData<GroceryList>(['grocery', listId], {
          ...prev,
          items: prev.items.map((it) =>
            it._id === itemId ? { ...it, ...patch } : it
          ),
        });
      }
      return { prev };
    },
    onError: (_err, vars, context) => {
      if (context?.prev) qc.setQueryData(['grocery', vars.listId], context.prev);
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['grocery', vars.listId] });
    },
  });
}

export function useDeleteGroceryList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/grocery/${id}`);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grocery'] }),
  });
}
