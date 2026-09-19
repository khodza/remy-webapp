import { cx } from './cx';

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx('block rounded-lg bg-past [animation:remy-shimmer_1.4s_ease-in-out_infinite]', className)} />;
}

/** Grey twins of list rows while data loads. */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="mx-3 overflow-hidden rounded-2xl border border-rule bg-surface" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid min-h-14 grid-cols-[44px_1fr_28px] items-center gap-2.5 border-rule px-3.5 py-2 [&:not(:first-child)]:border-t">
          <Skeleton className="h-3.5 w-9" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      ))}
    </div>
  );
}
