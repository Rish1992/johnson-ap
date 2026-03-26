import { CONFIDENCE_LEVEL_CONFIG } from '@/lib/constants';
import { formatConfidence } from '@/lib/formatters';
import type { ConfidenceLevel } from '@/types/case';
import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
  score: number;
  level: ConfidenceLevel;
  showPercentage?: boolean;
  deEmphasized?: boolean;
}

export function ConfidenceBadge({
  score,
  level,
  showPercentage = true,
  deEmphasized = false,
}: ConfidenceBadgeProps) {
  const config = CONFIDENCE_LEVEL_CONFIG[level];

  return (
    <div className={cn('flex items-center gap-1.5', deEmphasized && 'opacity-50')}>
      <div
        className={cn(
          'rounded-full shrink-0',
          config.dotColor,
          deEmphasized ? 'h-1 w-1' : 'h-2 w-2'
        )}
      />
      {showPercentage && (
        <span
          className={cn(
            deEmphasized ? 'text-[10px] text-muted-foreground/70 font-normal' : 'text-sm font-medium',
            !deEmphasized && config.color
          )}
        >
          {formatConfidence(score)}%
        </span>
      )}
    </div>
  );
}
