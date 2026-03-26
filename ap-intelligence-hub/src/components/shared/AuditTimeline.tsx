import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { AuditLogEntry } from '@/types/audit';

// Tinted background + inner dot color for the 36px event icon circle
const ACTION_ICON_STYLES: Record<string, string> = {
  EMAIL_RECEIVED: 'bg-blue-100 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400',
  EMAIL_CLASSIFIED: 'bg-blue-100 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400',
  EMAIL_CATEGORIZED: 'bg-blue-100 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400',
  DATA_EXTRACTED: 'bg-blue-100 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400',
  VENDOR_MATCHED: 'bg-green-100 text-green-500 dark:bg-green-900/30 dark:text-green-400',
  CONTRACT_MATCHED: 'bg-green-100 text-green-500 dark:bg-green-900/30 dark:text-green-400',
  BUSINESS_RULE_RUN: 'bg-green-100 text-green-500 dark:bg-green-900/30 dark:text-green-400',
  AGENT_ASSIGNED: 'bg-purple-100 text-purple-500 dark:bg-purple-900/30 dark:text-purple-400',
  AGENT_REVIEW_STARTED: 'bg-purple-100 text-purple-500 dark:bg-purple-900/30 dark:text-purple-400',
  AGENT_DATA_VALIDATED: 'bg-purple-100 text-purple-500 dark:bg-purple-900/30 dark:text-purple-400',
  FIELD_EDITED: 'bg-purple-100 text-purple-500 dark:bg-purple-900/30 dark:text-purple-400',
  DRAFT_SAVED: 'bg-purple-100 text-purple-500 dark:bg-purple-900/30 dark:text-purple-400',
  BUSINESS_RULE_RERUN: 'bg-green-100 text-green-500 dark:bg-green-900/30 dark:text-green-400',
  DATA_CONFIRMED: 'bg-purple-100 text-purple-500 dark:bg-purple-900/30 dark:text-purple-400',
  SUBMITTED_FOR_APPROVAL: 'bg-purple-100 text-purple-500 dark:bg-purple-900/30 dark:text-purple-400',
  APPROVAL_CHAIN_CREATED: 'bg-indigo-100 text-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-400',
  SENT_TO_APPROVER: 'bg-indigo-100 text-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-400',
  APPROVED: 'bg-green-100 text-green-500 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400',
  RETURNED: 'bg-orange-100 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400',
  RESUBMITTED: 'bg-orange-100 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400',
  POSTED_TO_SAP: 'bg-green-100 text-green-500 dark:bg-green-900/30 dark:text-green-400',
  CASE_CLOSED: 'bg-green-100 text-green-500 dark:bg-green-900/30 dark:text-green-400',
  COMMENT_ADDED: 'bg-purple-100 text-purple-500 dark:bg-purple-900/30 dark:text-purple-400',
  APPROVAL_SEQUENCE_EDITED: 'bg-purple-100 text-purple-500 dark:bg-purple-900/30 dark:text-purple-400',
  EXTRACTION_RETRIGGERED: 'bg-blue-100 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400',
  CASE_DISCARDED: 'bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-400',
  CASE_FAILED: 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400',
};

const DEFAULT_ICON_STYLE = 'bg-gray-100 text-gray-400 dark:bg-gray-900/30 dark:text-gray-400';

interface AuditTimelineProps {
  entries: AuditLogEntry[];
  compact?: boolean;
}

export function AuditTimeline({ entries, compact = false }: AuditTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="relative">
      {/* Vertical line - 2px wide, neutral-100 */}
      <div className="absolute left-[17px] top-0 bottom-0 w-[2px] bg-neutral-100 dark:bg-neutral-800" />

      <div className="space-y-6">
        {entries.map((entry) => {
          const isExpanded = expandedIds.has(entry.id);
          const hasDetail = entry.oldValue || entry.newValue || entry.metadata;
          const iconStyle = ACTION_ICON_STYLES[entry.action] || DEFAULT_ICON_STYLE;

          return (
            <div key={entry.id} className="relative flex gap-4 pl-0">
              {/* Event icon - 36px circle with light tinted bg */}
              <div
                className={cn(
                  'shrink-0 h-9 w-9 rounded-full flex items-center justify-center z-10',
                  iconStyle
                )}
              >
                <div className="h-2 w-2 rounded-full bg-current" />
              </div>

              {/* Content */}
              <div className="flex-1 pb-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Timestamps: body-sm, neutral-400 */}
                  <span className="text-sm text-neutral-400">
                    {formatDateTime(entry.timestamp)}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {entry.performedByRole === 'SYSTEM' ? 'System' : entry.performedByName}
                  </Badge>
                </div>
                <p className={cn('text-sm text-foreground mt-1', compact && 'text-xs')}>
                  {entry.description}
                </p>

                {hasDetail && !compact && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-6 text-xs text-muted-foreground p-0"
                    onClick={() => toggleExpanded(entry.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 mr-1" />
                    ) : (
                      <ChevronRight className="h-3 w-3 mr-1" />
                    )}
                    Details
                  </Button>
                )}

                {isExpanded && hasDetail && (
                  <div className="mt-2 p-3 bg-accent/50 rounded-lg text-xs space-y-1">
                    {entry.fieldName && (
                      <p>
                        <span className="font-medium">Field:</span> {entry.fieldName}
                      </p>
                    )}
                    {entry.oldValue && (
                      <p>
                        <span className="font-medium">Previous:</span>{' '}
                        <span className="line-through text-muted-foreground">
                          {entry.oldValue}
                        </span>
                      </p>
                    )}
                    {entry.newValue && (
                      <p>
                        <span className="font-medium">New:</span> {entry.newValue}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
