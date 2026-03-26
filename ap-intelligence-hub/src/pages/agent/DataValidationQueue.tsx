import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaseStore } from '@/stores/caseStore';
import { CaseCard } from '@/components/shared/CaseCard';
import { FilterBar } from '@/components/shared/FilterBar';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ClipboardCheck } from 'lucide-react';
import type { CaseStatus } from '@/types/case';
import type { FilterState } from '@/types/filters';

const QUEUE_STATUSES: CaseStatus[] = ['EXTRACTED', 'IN_REVIEW'];

export function DataValidationQueue() {
  const navigate = useNavigate();
  const { cases, filters, isLoadingCases, fetchCases, setFilters, resetFilters } = useCaseStore();

  useEffect(() => {
    fetchCases({ status: QUEUE_STATUSES });
  }, [fetchCases]);

  const filteredCases = cases.filter((c) => QUEUE_STATUSES.includes(c.status));

  const handleFilterChange = useCallback(
    (newFilters: Partial<FilterState>) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  return (
    <div>
      <PageHeader title="Data Validation" count={filteredCases.length} />
      <p className="text-sm text-muted-foreground -mt-2 mb-4">Review and validate AI-extracted invoice data before submitting for approval.</p>
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
              onClick={(id) => navigate(`/agent/cases/${id}/validation`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
