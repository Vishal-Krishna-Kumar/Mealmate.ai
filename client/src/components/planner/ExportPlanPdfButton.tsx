import { Button } from '@/components/ui/Button';
import type { MealPlanResponse } from '@/hooks/useAiPlanner';
import { generateWeekPlanPdf } from '@/lib/pdf';

interface Props {
  plan: MealPlanResponse | null | undefined;
  weekLabel?: string;
  disabled?: boolean;
}

export function ExportPlanPdfButton({ plan, weekLabel, disabled }: Props) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={disabled || !plan}
      onClick={() => {
        if (plan) generateWeekPlanPdf(plan, weekLabel);
      }}
      aria-label="Download weekly meal plan as PDF"
    >
      Export PDF
    </Button>
  );
}
