import { Card, CardContent } from '@/components/ui/card';
import { RotateCcw } from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';

interface ReturnReasonBannerProps {
  returnedBy?: string;
  returnedAt?: string;
  returnReason: string;
  /** Use 'card' for Card wrapper (CaseDetailsTab) or 'div' for plain div (DataValidationTab) */
  variant?: 'card' | 'div';
}

export function ReturnReasonBanner({
  returnedBy = 'Approver',
  returnedAt,
  returnReason,
  variant = 'card',
}: ReturnReasonBannerProps) {
  const inner = (
    <>
      <RotateCcw className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
            Returned by {returnedBy}
          </p>
          {returnedAt && (
            <span className="text-xs text-orange-600 dark:text-orange-400">
              {formatDateTime(returnedAt)}
            </span>
          )}
        </div>
        <p className="text-sm text-orange-700 dark:text-orange-400">
          {returnReason}
        </p>
      </div>
    </>
  );

  if (variant === 'div') {
    return (
      <div className="mb-4 flex items-start gap-3 p-4 border border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 rounded-lg">
        {inner}
      </div>
    );
  }

  return (
    <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
      <CardContent className="p-4 flex items-start gap-3">
        {inner}
      </CardContent>
    </Card>
  );
}
