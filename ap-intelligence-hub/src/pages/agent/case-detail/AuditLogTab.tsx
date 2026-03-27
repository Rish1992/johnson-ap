import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCaseStore } from '@/stores/caseStore';
import { AuditTimeline } from '@/components/shared/AuditTimeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle,
  AlertTriangle,
  X,
  Shield,
  ChevronDown,
  ChevronRight,
  Info,
  FileText,
  Database,
  ArrowRightLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuditLogEntry } from '@/types/audit';
import type { BusinessRuleResult } from '@/types/case';

function RuleStatusIcon({ status }: { status: BusinessRuleResult['status'] }) {
  switch (status) {
    case 'PASS':
      return <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />;
    case 'FAIL':
      return <X className="h-4 w-4 text-red-600 shrink-0" />;
    case 'WARNING':
      return <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />;
    case 'SKIPPED':
      return <Info className="h-4 w-4 text-gray-400 shrink-0" />;
    default:
      return null;
  }
}

function RuleStatusBadge({ status }: { status: BusinessRuleResult['status'] }) {
  return (
    <Badge
      className={cn(
        'text-[10px] shrink-0 border-0',
        status === 'PASS' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        status === 'FAIL' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        status === 'WARNING' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        status === 'SKIPPED' && 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
      )}
    >
      {status}
    </Badge>
  );
}

export function BusinessRuleCard({ rule }: { rule: BusinessRuleResult }) {
  const [isOpen, setIsOpen] = useState(false);

  const hasDetails = rule.details || rule.expectedValue || rule.actualValue || rule.matchedAgainst || rule.fieldPath;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          'rounded-lg border text-sm transition-colors',
          rule.status === 'PASS' && 'bg-green-50/50 border-green-200 dark:bg-green-950/10 dark:border-green-900/30',
          rule.status === 'FAIL' && 'bg-red-50/50 border-red-200 dark:bg-red-950/10 dark:border-red-900/30',
          rule.status === 'WARNING' && 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/10 dark:border-amber-900/30',
          rule.status === 'SKIPPED' && 'bg-gray-50/50 border-gray-200 dark:bg-gray-800/20 dark:border-gray-700',
        )}
      >
        {/* Collapsed header - always visible */}
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center gap-3 p-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded-lg transition-colors"
            type="button"
          >
            <RuleStatusIcon status={rule.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{rule.ruleName}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{rule.ruleId}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{rule.message}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <RuleStatusBadge status={rule.status} />
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px]',
                  rule.severity === 'ERROR' && 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400',
                  rule.severity === 'WARNING' && 'border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400',
                  rule.severity === 'INFO' && 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400',
                )}
              >
                {rule.severity}
              </Badge>
              {hasDetails && (
                isOpen
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expanded details */}
        <CollapsibleContent>
          {hasDetails && (
            <div className="px-3 pb-3 pt-0">
              <div className="border-t border-dashed border-current/10 pt-3 space-y-3">
                {/* Description */}
                {rule.description && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Rule Description</p>
                      <p className="text-xs text-foreground">{rule.description}</p>
                    </div>
                  </div>
                )}

                {/* Expected vs Actual */}
                {(rule.expectedValue || rule.actualValue) && (
                  <div className="flex items-start gap-2">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Expected vs Actual</p>
                      <div className="grid grid-cols-2 gap-2">
                        {rule.expectedValue && (
                          <div className="bg-background/60 rounded p-2 border border-dashed">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Expected</p>
                            <p className="text-xs font-mono text-foreground">{rule.expectedValue}</p>
                          </div>
                        )}
                        {rule.actualValue && (
                          <div className={cn(
                            'rounded p-2 border border-dashed',
                            rule.status === 'FAIL' && 'bg-red-50/50 border-red-200 dark:bg-red-950/10 dark:border-red-800/30',
                            rule.status === 'WARNING' && 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/10 dark:border-amber-800/30',
                            rule.status === 'PASS' && 'bg-background/60',
                          )}>
                            <p className="text-[10px] text-muted-foreground mb-0.5">Actual</p>
                            <p className="text-xs font-mono text-foreground">{rule.actualValue}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Matched Against */}
                {rule.matchedAgainst && (
                  <div className="flex items-start gap-2">
                    <Database className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Matched Against</p>
                      <p className="text-xs text-foreground">{rule.matchedAgainst}</p>
                    </div>
                  </div>
                )}

                {/* Detailed Explanation */}
                {rule.details && (
                  <div className="flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Details</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{rule.details}</p>
                    </div>
                  </div>
                )}

                {/* Field Path */}
                {rule.fieldPath && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-background/60 rounded px-2 py-1 w-fit font-mono">
                    Field: {rule.fieldPath}
                  </div>
                )}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function AuditLogTab() {
  const { caseId } = useParams<{ caseId: string }>();
  const selectedCase = useCaseStore((s) => s.selectedCase);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (caseId) {
      import('@/mock/handlers').then(({ fetchAuditLog }) => {
        fetchAuditLog(caseId).then((data) => {
          setEntries(data);
          setIsLoading(false);
        });
      });
    }
  }, [caseId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const businessRules = selectedCase?.businessRuleResults || [];
  const passCount = businessRules.filter((r) => r.status === 'PASS').length;
  const warnCount = businessRules.filter((r) => r.status === 'WARNING').length;
  const failCount = businessRules.filter((r) => r.status === 'FAIL').length;
  const skipCount = businessRules.filter((r) => r.status === 'SKIPPED').length;

  return (
    <div className="space-y-6">
      {/* Business Rules Summary - expandable cards */}
      {businessRules.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Business Rules Validation
              <span className="text-xs text-muted-foreground font-normal ml-1">
                ({businessRules.length} rules)
              </span>
              <div className="flex gap-1.5 ml-auto">
                {passCount > 0 && (
                  <Badge className="bg-green-100 text-green-700 border-0 text-xs dark:bg-green-900/30 dark:text-green-400">
                    {passCount} Passed
                  </Badge>
                )}
                {warnCount > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 border-0 text-xs dark:bg-amber-900/30 dark:text-amber-400">
                    {warnCount} Warning
                  </Badge>
                )}
                {failCount > 0 && (
                  <Badge className="bg-red-100 text-red-700 border-0 text-xs dark:bg-red-900/30 dark:text-red-400">
                    {failCount} Failed
                  </Badge>
                )}
                {skipCount > 0 && (
                  <Badge className="bg-gray-100 text-gray-500 border-0 text-xs dark:bg-gray-800 dark:text-gray-400">
                    {skipCount} Skipped
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Show failures and warnings first, then passes */}
            {[...businessRules]
              .sort((a, b) => {
                const order: Record<string, number> = { FAIL: 0, WARNING: 1, SKIPPED: 2, PASS: 3 };
                return (order[a.status] ?? 4) - (order[b.status] ?? 4);
              })
              .map((rule) => (
                <BusinessRuleCard key={rule.ruleId} rule={rule} />
              ))}
          </CardContent>
        </Card>
      )}

      {/* Full Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Activity Timeline
            <span className="text-xs text-muted-foreground font-normal ml-2">
              ({entries.length} events)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AuditTimeline entries={entries} />
        </CardContent>
      </Card>
    </div>
  );
}
