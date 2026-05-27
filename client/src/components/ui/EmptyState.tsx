import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon = '🍽️', title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-card px-6 py-16 text-center',
        className
      )}
    >
      <div className="text-5xl" aria-hidden>
        {icon}
      </div>
      <h3 className="mt-4 font-serif text-xl font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
