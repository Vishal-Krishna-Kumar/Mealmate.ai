import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Recipe, Difficulty } from '@/types';

export interface ListRecipesParams {
  q?: string;
  cuisine?: string;
  tag?: string;
  maxPrepTime?: number;
  difficulty?: Difficulty;
  sort?: 'recent' | 'fastest' | 'relevance';
  page?: number;
  limit?: number;
}

export interface ListRecipesResponse {
  success: true;
  page: number;
  limit: number;
  total: number;
  pages: number;
  items: Recipe[];
}

// The server returns lean documents with `_id`; normalize to `id` for the UI.
function normalize<T extends { _id?: string; id?: string }>(doc: T): T & { id: string } {
  const id = doc.id ?? doc._id ?? '';
  return { ...doc, id };
}

export function useRecipes(params: ListRecipesParams) {
  return useQuery({
    queryKey: ['recipes', params],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ListRecipesResponse> => {
      const cleaned: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '' && v !== null) cleaned[k] = v as string | number;
      }
      const { data } = await api.get<ListRecipesResponse>('/recipes', { params: cleaned });
      return { ...data, items: data.items.map(normalize) };
    },
  });
}

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: ['recipe', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Recipe> => {
      const { data } = await api.get<{ recipe: Recipe }>(`/recipes/${id}`);
      return normalize(data.recipe);
    },
  });
}

export interface RecipeInput {
  title: string;
  description?: string;
  ingredients: { name: string; quantity?: number; unit?: string; notes?: string }[];
  instructions: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  cuisine?: string;
  tags?: string[];
  difficulty?: Difficulty;
  nutrition?: Recipe['nutrition'];
  imageUrl?: string;
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecipeInput): Promise<Recipe> => {
      const { data } = await api.post<{ recipe: Recipe }>('/recipes', input);
      return normalize(data.recipe);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useUpdateRecipe(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RecipeInput>): Promise<Recipe> => {
      const { data } = await api.patch<{ recipe: Recipe }>(`/recipes/${id}`, input);
      return normalize(data.recipe);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes'] });
      qc.invalidateQueries({ queryKey: ['recipe', id] });
    },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/recipes/${id}`);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}
