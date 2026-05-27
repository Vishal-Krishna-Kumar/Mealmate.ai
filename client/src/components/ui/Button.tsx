import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-ink text-canvas hover:bg-brand-700 focus-visible:ring-brand-500 disabled:bg-ink/60 shadow-soft',
  secondary:
    'bg-card text-ink border border-line-strong hover:border-ink-soft hover:bg-canvas-soft focus-visible:ring-ink-soft',
  ghost: 'bg-transparent text-ink-soft hover:bg-canvas-soft hover:text-ink focus-visible:ring-ink-soft',
  danger: 'bg-red-700 text-canvas hover:bg-red-800 focus-visible:ring-red-500 shadow-soft',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-sm',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, disabled, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed disabled:opacity-70',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});
