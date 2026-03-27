import { useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaseStore } from '@/stores/caseStore';
import { CaseCard } from '@/components/shared/CaseCard';
import { FilterBar } from '@/components/shared/FilterBar';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { ClipboardCheck, FileText, Clock, CheckCircle, ShieldCheck } from 'lucide-react';
import type { CaseStatus } from '@/types/case';
import type { FilterState } from '@/types/filters';

const QUEUE_STATUSES: CaseStatus[] = ['EXTRACTED', 'IN_REVIEW'];

export function DataValidationQueue() {
  const navigate = useNavigate();
  const { cases, filters, isLoadingCases, fetchCases, setFilters, resetFilters, markAsRead } = useCaseStore();

  useEffect(() => {
    fetchCases({ status: QUEUE_STATUSES });
  }, [fetchCases]);

  const filteredCases = cases.filter((c) => QUEUE_STATUSES.includes(c.status));

  const stats = useMemo(() => {
    const total = cases.length;
    const pending = cases.filter((c) => ['EXTRACTED', 'IN_REVIEW'].includes(c.status)).length;
    const completed = cases.filter((c) => ['POSTED', 'CLOSED'].includes(c.status)).length;
    const approval = cases.filter((c) => c.status === 'APPROVAL_PENDING').length;
    return { total, pending, completed, approval };
  }, [cases]);

  const handleFilterChange = useCallback(
    (newFilters: Partial<FilterState>) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  return (
    <div>
      <PageHeader title="Case Dashboard" count={filteredCases.length} />
      <p className="text-sm text-muted-foreground -mt-2 mb-4">Review and validate AI-extracted invoice data before submitting for approval.</p>
      {!isLoadingCases && cases.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard title="Total Cases" value={stats.total} icon={<FileText className="h-4 w-4" />} />
          <StatCard title="Pending Review" value={stats.pending} icon={<Clock className="h-4 w-4" />} variant="warning" />
          <StatCard title="Completed" value={stats.completed} icon={<CheckCircle className="h-4 w-4" />} variant="success" />
          <StatCard title="Pending Approval" value={stats.approval} icon={<ShieldCheck className="h-4 w-4" />} />
        </div>
      )}
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={resetFilters}
        showStatusFilter={false}
        showConfidenceFilter={true}
        availableStatuses={QUEUE_STATUSES}
      />
      {isLoadingCases ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-accent/30 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredCases.length === 0 ? (
        <EmptyState
          title="All caught up!"
          description="No cases pending validation."
          icon={<ClipboardCheck className="h-16 w-16" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredCases.map((c) => (
            <CaseCard
              key={c.id}
              caseData={c}
              variant="validation"
              onClick={(id) => { markAsRead(id); navigate(`/agent/cases/${id}/validation`); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
