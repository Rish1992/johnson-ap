import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaseStore } from '@/stores/caseStore';
import { CaseCard } from '@/components/shared/CaseCard';
import { FilterBar } from '@/components/shared/FilterBar';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { MessageSquareWarning } from 'lucide-react';
import type { CaseStatus } from '@/types/case';
import type { FilterState } from '@/types/filters';

const QUEUE_STATUSES: CaseStatus[] = ['RETURNED'];

export function QueryResolutionQueue() {
  const navigate = useNavigate();
  const { cases, filters, isLoadingCases, fetchCases, setFilters, resetFilters } = useCaseStore();

  useEffect(() => {
    fetchCases({ status: QUEUE_STATUSES });
  }, [fetchCases]);

  const filteredCases = cases.filter((c) => c.status === 'RETURNED');

  const handleFilterChange = useCallback(
    (newFilters: Partial<FilterState>) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  return (
    <div>
      <PageHeader title="Query Resolution" count={filteredCases.length} />
      <p className="text-sm text-muted-foreground -mt-2 mb-4">Cases returned by approvers that need corrections or additional information before resubmission.</p>
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={resetFilters}
        showStatusFilter={false}
        showConfidenceFilter={false}
      />
      {isLoadingCases ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-accent/30 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredCases.length === 0 ? (
        <EmptyState
          title="No queries pending"
          description="No cases have been returned by approvers."
          icon={<MessageSquareWarning className="h-16 w-16" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredCases.map((c) => (
            <CaseCard
              key={c.id}
              caseData={c}
              variant="query"
              onClick={(id) => navigate(`/agent/cases/${id}/validation`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
