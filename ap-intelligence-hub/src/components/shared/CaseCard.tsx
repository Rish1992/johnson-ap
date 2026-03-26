import { Card, CardContent } from '@/components/ui/card';
import { CaseStatusBadge } from './CaseStatusBadge';
import { ConfidenceBadge } from './ConfidenceBadge';
import { CategoryBadge } from './CategoryBadge';
import { ApprovalChainStepper } from './ApprovalChainStepper';
import { formatCurrency, formatRelativeTime } from '@/lib/formatters';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Case, CaseStatus } from '@/types/case';

const STATUS_BORDER_COLOR: Record<CaseStatus, string> = {
  RECEIVED: 'border-l-slate-400',
  CLASSIFIED: 'border-l-slate-400',
  CATEGORIZED: 'border-l-slate-400',
  EXTRACTED: 'border-l-blue-500',
  IN_REVIEW: 'border-l-amber-500',
  VALIDATED: 'border-l-cyan-500',
  APPROVAL_PENDING: 'border-l-purple-500',
  APPROVED: 'border-l-green-500',
  POSTED: 'border-l-green-500',
  CLOSED: 'border-l-green-600',
  REJECTED: 'border-l-red-500',
  DISCARDED: 'border-l-gray-400',
  RETURNED: 'border-l-orange-500',
  FAILED: 'border-l-red-600',
};

interface CaseCardProps {
  caseData: Case;
  variant: 'validation' | 'query' | 'pending' | 'browser' | 'approver';
  onClick: (caseId: string) => void;
}

export function CaseCard({ caseData, variant, onClick }: CaseCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-l-[3px]',
        STATUS_BORDER_COLOR[caseData.status],
        caseData.lockedBy && 'opacity-70'
      )}
      onClick={() => onClick(caseData.id)}
    >
      <CardContent className="p-4">
        {/* Row 1: Case ID + Status */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-mono font-bold text-foreground">
            {caseData.id}
          </span>
          <div className="flex items-center gap-2">
            {caseData.lockedBy && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            <CaseStatusBadge status={caseData.status} size="sm" />
          </div>
        </div>

        {/* Row 2: Vendor + Category */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-foreground font-medium truncate mr-2">
            {caseData.vendorName}
          </span>
          <CategoryBadge category={caseData.category} />
        </div>

        {/* Row 3: Invoice # + Amount */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">
            {caseData.headerData.invoiceNumber || 'No Invoice #'}
          </span>
          <span className="text-base font-bold text-foreground">
            {formatCurrency(caseData.headerData.totalAmount, caseData.headerData.currency)}
          </span>
        </div>

        {/* Row 4: Confidence (for validation/browser/approver) */}
        {caseData.overallConfidence > 0 && (variant === 'validation' || variant === 'browser' || variant === 'approver') && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground">Confidence:</span>
            <ConfidenceBadge
              score={caseData.overallConfidence}
              level={caseData.overallConfidenceLevel}
              deEmphasized={variant === 'approver'}
            />
          </div>
        )}

        {/* Row 5: Approval Steps (for pending variant) */}
        {variant === 'pending' && caseData.approvalChain && (
          <div className="mb-2">
            <ApprovalChainStepper chain={caseData.approvalChain} size="sm" />
          </div>
        )}

        {/* Row 5: Return reason (for query variant) */}
        {variant === 'query' && caseData.returnReason && (
          <div className="mb-2 p-2 bg-orange-50 dark:bg-orange-950/20 rounded text-xs text-orange-700 dark:text-orange-400">
            <span className="font-medium">Returned by {caseData.returnedByName}:</span>{' '}
            {caseData.returnReason.length > 100
              ? caseData.returnReason.slice(0, 100) + '...'
              : caseData.returnReason}
          </div>
        )}

        {/* Row 5: Approver info (for approver variant) */}
        {variant === 'approver' && caseData.approvalChain && (
          <div className="mb-2 text-xs text-muted-foreground">
            Step {caseData.approvalChain.currentStepIndex + 1} of {caseData.approvalChain.steps.length}
            {caseData.assignedAgentName && (
              <span> &middot; Reviewed by {caseData.assignedAgentName}</span>
            )}
          </div>
        )}

        {/* Bottom row: Date */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(caseData.createdAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
