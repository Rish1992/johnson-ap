import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Stat Cards row skeleton
// ---------------------------------------------------------------------------
export function StatCardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  const gridCols =
    count <= 3 ? 'grid-cols-3' :
    count === 6 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' :
    'grid-cols-2 md:grid-cols-4';
  return (
    <div className={cn('grid gap-3 mb-4', gridCols, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
            <Skeleton className="h-7 w-14 mb-2" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Case card grid skeleton
// ---------------------------------------------------------------------------
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-44" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <div className="flex items-center justify-between pt-1 border-t">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table skeleton
// ---------------------------------------------------------------------------
export function TableSkeleton({ rows = 6, cols = 6, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn('rounded-lg border overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-muted/40 border-b">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn('h-3', i === 0 ? 'w-28' : 'flex-1')} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className={cn(
                'h-4',
                j === 0 ? 'w-28' : 'flex-1',
                j === cols - 1 ? 'max-w-[80px]' : '',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email review split-panel skeleton
// ---------------------------------------------------------------------------
export function EmailReviewSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] border rounded-lg min-h-[600px] overflow-hidden">
      {/* Left: email list */}
      <div className="border-r">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="p-3 border-b space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3 w-48 ml-5" />
            <div className="flex gap-1.5 ml-5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-10 rounded-full" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
          </div>
        ))}
      </div>
      {/* Right: detail */}
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-px w-full bg-border" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-32 rounded-md" />
            </div>
          ))}
        </div>
        <Skeleton className="h-px w-full bg-border" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin dashboard skeleton
// ---------------------------------------------------------------------------
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <StatCardsSkeleton count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <Skeleton className="h-4 w-36 mb-4" />
            <Skeleton className="h-52 w-full rounded-md" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Skeleton className="h-4 w-28 mb-4" />
            <Skeleton className="h-52 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="p-5">
          <Skeleton className="h-4 w-40 mb-5" />
          <div className="flex items-center gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 flex-1">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <TableSkeleton rows={5} cols={6} />
    </div>
  );
}
