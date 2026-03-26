import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: { direction: 'up' | 'down' | 'flat'; percentage: number };
  icon: React.ReactNode;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const VARIANT_DOT_COLOR: Record<string, string> = {
  default: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

export function StatCard({ title, value, trend, icon, description, variant = 'default' }: StatCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', VARIANT_DOT_COLOR[variant])} />
            <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">{title}</span>
          </div>
          <div
            className={cn(
              'p-2.5 rounded-full',
              variant === 'success' && 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400',
              variant === 'warning' && 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
              variant === 'danger' && 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
              variant === 'default' && 'bg-primary/10 text-primary'
            )}
          >
            {icon}
          </div>
        </div>
        <div className="text-2xl font-bold text-foreground mb-1">{value}</div>
        {(trend || description) && (
          <div className="flex items-center gap-1">
            {trend && (
              <>
                {trend.direction === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                {trend.direction === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                {trend.direction === 'flat' && <Minus className="h-4 w-4 text-gray-500" />}
                <span
                  className={cn(
                    'text-sm font-medium',
                    trend.direction === 'up' && 'text-green-600',
                    trend.direction === 'down' && 'text-red-600',
                    trend.direction === 'flat' && 'text-gray-500'
                  )}
                >
                  {trend.percentage}%
                </span>
              </>
            )}
            {description && (
              <span className="text-xs text-muted-foreground ml-1">{description}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
