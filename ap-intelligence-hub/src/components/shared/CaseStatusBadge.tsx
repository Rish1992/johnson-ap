import { Badge } from '@/components/ui/badge';
import { CASE_STATUS_CONFIG } from '@/lib/constants';
import type { CaseStatus } from '@/types/case';
import { cn } from '@/lib/utils';

interface CaseStatusBadgeProps {
  status: CaseStatus;
  size?: 'sm' | 'md';
}

export function CaseStatusBadge({ status, size = 'md' }: CaseStatusBadgeProps) {
  const config = CASE_STATUS_CONFIG[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        config.bgColor,
        config.color,
        'ring-1 ring-inset ring-current/15 border-transparent font-medium inline-flex items-center gap-1.5 px-2.5 py-0.5',
        size === 'sm' && 'text-[10px] px-1.5 py-0'
      )}
    >
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0 bg-current')} />
      {config.label}
    </Badge>
  );
}
