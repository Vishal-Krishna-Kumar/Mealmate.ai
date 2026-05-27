/**
 * Client-side PDF generators using jsPDF.
 *
 * Two flagship reports are produced:
 *   - `generateWeekPlanPdf(plan)`  → 1-page weekly meal plan
 *   - `generateGroceryListPdf(items, title)` → categorised grocery list
 *
 * Both download the PDF immediately to the user's browser; no server round-trip.
 */
import { jsPDF } from 'jspdf';
import type { MealPlanResponse } from '@/hooks/useAiPlanner';
import type { GroceryItem } from '@/types';

const PAGE_MARGIN = 14;
const LINE_HEIGHT = 6;

function header(doc: jsPDF, title: string, subtitle?: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, PAGE_MARGIN, 18);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(subtitle, PAGE_MARGIN, 24);
    doc.setTextColor(0);
  }
  doc.setDrawColor(15, 118, 110);
  doc.line(PAGE_MARGIN, 28, 196, 28);
  return 34;
}

function footer(doc: jsPDF): void {
  const pages = doc.getNumberOfPages();
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(140);
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.text(
      `MealMate · generated ${new Date().toLocaleString()} · page ${i}/${pages}`,
      PAGE_MARGIN,
      290
    );
  }
  doc.setTextColor(0);
}

export function generateWeekPlanPdf(plan: MealPlanResponse, weekLabel?: string): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = header(
    doc,
    'Weekly Meal Plan',
    `${weekLabel ?? 'Generated week'} · objective: ${plan.objective ?? plan.strategy}`
  );

  if (plan.sustainability) {
    const s = plan.sustainability;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Sustainability summary', PAGE_MARGIN, y);
    y += LINE_HEIGHT;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(
      `CO₂ ≈ ${s.co2_kg.toFixed(1)} kg · cost ≈ $${s.cost_usd.toFixed(2)} · ` +
        `eco-score ${(s.eco_score * 100).toFixed(0)}% · ${s.meals} meals`,
      PAGE_MARGIN,
      y
    );
    y += LINE_HEIGHT + 2;
  }

  plan.days.forEach((day) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(day.day.toUpperCase(), PAGE_MARGIN, y);
    if (typeof day.co2_kg === 'number' && typeof day.cost_usd === 'number') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(
        `CO₂ ${day.co2_kg.toFixed(1)} kg · $${day.cost_usd.toFixed(2)}`,
        160,
        y,
        { align: 'right' }
      );
      doc.setTextColor(0);
    }
    y += LINE_HEIGHT;
    day.meals.forEach((meal) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const eco =
        typeof meal.eco_score === 'number' ? ` · eco ${(meal.eco_score * 100).toFixed(0)}%` : '';
      doc.text(`  ${meal.slot.padEnd(10, ' ')} ${meal.title}${eco}`, PAGE_MARGIN, y);
      y += LINE_HEIGHT;
    });
    y += 2;
  });

  footer(doc);
  doc.save(`mealmate-plan-${weekLabel ?? 'week'}.pdf`);
}

export function generateGroceryListPdf(items: GroceryItem[], title = 'Grocery List'): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = header(doc, title, `${items.length} items`);

  // group items by category
  const groups = new Map<string, GroceryItem[]>();
  items.forEach((item) => {
    const cat = item.category ?? 'other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)?.push(item);
  });

  Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([category, group]) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(category.toUpperCase(), PAGE_MARGIN, y);
      y += LINE_HEIGHT;
      group.forEach((item) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        const checkbox = item.checked ? '[x]' : '[ ]';
        const qty = item.quantity
          ? ` — ${item.quantity}${item.unit ? ' ' + item.unit : ''}`
          : '';
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`${checkbox} ${item.ingredient}${qty}`, PAGE_MARGIN + 2, y);
        y += LINE_HEIGHT;
      });
      y += 2;
    });

  footer(doc);
  doc.save(`mealmate-grocery-${new Date().toISOString().split('T')[0]}.pdf`);
}
