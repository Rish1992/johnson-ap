import { useEffect } from 'react';
import { useParams, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useCaseStore } from '@/stores/caseStore';
import { CaseStatusBadge } from '@/components/shared/CaseStatusBadge';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

const TABS = [
  { label: 'Case Overview', path: 'overview' },
  { label: 'Data Validation', path: 'validation' },
  { label: 'Audit Log', path: 'audit' },
  { label: 'Approval Tracking', path: 'approval' },
];

export function CaseDetailLayout() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { selectedCase, isLoadingDetail, fetchCaseById, clearSelectedCase } = useCaseStore();

  useEffect(() => {
    if (caseId) {
      fetchCaseById(caseId);
    }
    return () => {
      clearSelectedCase();
    };
  }, [caseId, fetchCaseById, clearSelectedCase]);

  if (isLoadingDetail || !selectedCase) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" onClick={() => navigate('/agent/validation')}>
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to Dashboard</span>
        </Button>
      </div>

      {/* Case Header Summary Card */}
      <div className="bg-muted/30 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold font-mono">{selectedCase.id}</h1>
          <CaseStatusBadge status={selectedCase.status} />
          <CategoryBadge category={selectedCase.category} />
          {selectedCase.overallConfidence > 0 && (
            <ConfidenceBadge
              score={selectedCase.overallConfidence}
              level={selectedCase.overallConfidenceLevel}
            />
          )}
          <span className="text-lg font-bold text-foreground ml-auto">
            {formatCurrency(selectedCase.headerData.totalAmount, selectedCase.headerData.currency)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={`/agent/cases/${caseId}/${tab.path}`}
            end
            className={({ isActive }) =>
              cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-t-md'
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
