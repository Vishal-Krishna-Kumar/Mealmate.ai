import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  RecommendStrategy,
  SignalContribution,
} from './useAiPlanner';

export interface RecommendedRecipe {
  recipe_id: string;
  title: string;
  score: number;
  matched_ingredients: string[];
  reason: string;
  signals?: SignalContribution[];
}

export interface RecommendResponse {
  success: boolean;
  count: number;
  strategy: RecommendStrategy;
  results: RecommendedRecipe[];
}

export interface RecommendParams {
  ingredients?: string[];
  dietary_preferences?: string[];
  top_k?: number;
  usePantry?: boolean;
  strategy?: RecommendStrategy;
  liked_recipe_ids?: string[];
}

/** Fetch ML-powered recipe suggestions based on the user's pantry & preferences. */
export function useRecommendations(params: RecommendParams = {}, enabled = true) {
  const body = {
    top_k: params.top_k ?? 5,
    usePantry: params.usePantry ?? true,
    strategy: params.strategy ?? 'hybrid',
    ...(params.ingredients ? { ingredients: params.ingredients } : {}),
    ...(params.dietary_preferences ? { dietary_preferences: params.dietary_preferences } : {}),
    ...(params.liked_recipe_ids ? { liked_recipe_ids: params.liked_recipe_ids } : {}),
  };

  return useQuery({
    queryKey: ['recommendations', body],
    enabled,
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<RecommendResponse> => {
      const { data } = await api.post<RecommendResponse>('/ai/recipes/recommend', body);
      return data;
    },
  });
}
