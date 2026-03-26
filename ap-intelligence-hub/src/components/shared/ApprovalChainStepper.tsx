import { Check, X, RotateCcw, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApprovalChain } from '@/types/case';

interface ApprovalChainStepperProps {
  chain: ApprovalChain;
  size?: 'sm' | 'md';
}

export function ApprovalChainStepper({ chain, size = 'md' }: ApprovalChainStepperProps) {
  if (size === 'sm') {
    // Compact inline view for CaseCard
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {chain.steps.map((step, index) => (
          <div key={step.stepNumber} className="flex items-center gap-1">
            <div
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                step.status === 'APPROVED' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                step.status === 'REJECTED' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                step.status === 'RETURNED' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                step.status === 'PENDING' && index === chain.currentStepIndex && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ring-1 ring-blue-300',
                step.status === 'PENDING' && index !== chain.currentStepIndex && 'bg-muted text-muted-foreground',
                step.status === 'SKIPPED' && 'bg-muted text-muted-foreground/50'
              )}
            >
              {step.status === 'APPROVED' && <Check className="h-2.5 w-2.5" />}
              {step.status === 'REJECTED' && <X className="h-2.5 w-2.5" />}
              {step.status === 'RETURNED' && <RotateCcw className="h-2.5 w-2.5" />}
              {step.status === 'PENDING' && index === chain.currentStepIndex && <Clock className="h-2.5 w-2.5" />}
              <span className="truncate max-w-[60px]">{step.approverName.split(' ')[0]}</span>
            </div>
            {index < chain.steps.length - 1 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Full-size stepper view
  return (
    <div className="flex items-start gap-0">
      {chain.steps.map((step, index) => (
        <div key={step.stepNumber} className="flex items-start">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'flex items-center justify-center rounded-full border-2 transition-colors h-8 w-8',
                step.status === 'APPROVED' && 'bg-green-500 border-green-500 text-white',
                step.status === 'REJECTED' && 'bg-red-500 border-red-500 text-white',
                step.status === 'RETURNED' && 'bg-orange-500 border-orange-500 text-white',
                step.status === 'PENDING' && index === chain.currentStepIndex && 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
                step.status === 'PENDING' && index !== chain.currentStepIndex && 'border-muted-foreground/30 bg-muted text-muted-foreground',
                step.status === 'SKIPPED' && 'border-muted bg-muted text-muted-foreground/30'
              )}
            >
              {step.status === 'APPROVED' && <Check className="h-4 w-4" />}
              {step.status === 'REJECTED' && <X className="h-4 w-4" />}
              {step.status === 'RETURNED' && <RotateCcw className="h-4 w-4" />}
              {step.status === 'PENDING' && <Clock className="h-4 w-4" />}
              {step.status === 'SKIPPED' && <span className="text-xs">-</span>}
            </div>
            <span className={cn(
              'text-[10px] mt-1 max-w-20 text-center truncate',
              step.status === 'PENDING' && index === chain.currentStepIndex
                ? 'font-medium text-blue-600 dark:text-blue-400'
                : 'text-muted-foreground'
            )}>
              {step.approverName.split(' ')[0]}
            </span>
            <span className={cn(
              'text-[9px] text-muted-foreground/70',
              step.status === 'APPROVED' && 'text-green-600 dark:text-green-400',
              step.status === 'REJECTED' && 'text-red-600 dark:text-red-400',
              step.status === 'RETURNED' && 'text-orange-600 dark:text-orange-400',
            )}>
              {step.status === 'APPROVED' && 'Approved'}
              {step.status === 'REJECTED' && 'Rejected'}
              {step.status === 'RETURNED' && 'Returned'}
              {step.status === 'PENDING' && index === chain.currentStepIndex && 'Pending'}
              {step.status === 'PENDING' && index !== chain.currentStepIndex && 'Waiting'}
            </span>
          </div>

          {/* Connector line */}
          {index < chain.steps.length - 1 && (
            <div className="flex items-center mt-3.5">
              <div
                className={cn(
                  'w-10 h-0.5 mx-1',
                  index < chain.currentStepIndex
                    ? 'bg-green-500'
                    : 'bg-muted-foreground/20'
                )}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
