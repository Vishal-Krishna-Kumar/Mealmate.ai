import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { WeeklyNutrition } from '@/types';

export function useWeeklyNutrition(mealPlanId: string | undefined) {
  return useQuery({
    queryKey: ['nutrition', mealPlanId],
    enabled: Boolean(mealPlanId),
    queryFn: async (): Promise<WeeklyNutrition> => {
      const { data } = await api.get<WeeklyNutrition & { success: true }>(
        `/nutrition/mealplan/${mealPlanId}`
      );
      return { days: data.days, total: data.total, average: data.average };
    },
  });
}
