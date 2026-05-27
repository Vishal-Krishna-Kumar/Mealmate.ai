import { cn } from '@/lib/cn';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-line/70', className)}
      aria-hidden="true"
    />
  );
}

export function RecipeCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="mt-2 h-3 w-1/2" />
      </div>
    </div>
  );
}
