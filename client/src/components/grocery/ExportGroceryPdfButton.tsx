import { Button } from '@/components/ui/Button';
import { generateGroceryListPdf } from '@/lib/pdf';
import type { GroceryItem } from '@/types';

interface Props {
  items: GroceryItem[];
  title?: string;
  disabled?: boolean;
}

export function ExportGroceryPdfButton({ items, title, disabled }: Props) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={disabled || items.length === 0}
      onClick={() => generateGroceryListPdf(items, title)}
      aria-label="Download grocery list as PDF"
    >
      Export PDF
    </Button>
  );
}
