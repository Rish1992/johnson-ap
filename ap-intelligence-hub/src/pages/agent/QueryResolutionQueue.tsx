import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaseStore } from '@/stores/caseStore';
import { CaseCard } from '@/components/shared/CaseCard';
import { CaseStatusBadge } from '@/components/shared/CaseStatusBadge';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { FilterBar } from '@/components/shared/FilterBar';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { MessageSquareWarning, LayoutGrid, List } from 'lucide-react';
import { CardGridSkeleton, TableSkeleton } from '@/components/shared/PageSkeleton';
import { formatCurrency, formatRelativeTime } from '@/lib/formatters';
import type { CaseStatus } from '@/types/case';
import type { FilterState } from '@/types/filters';

const QUEUE_STATUSES: CaseStatus[] = ['RETURNED'];

export function QueryResolutionQueue() {
  const navigate = useNavigate();
  const { cases, filters, isLoadingCases, fetchCases, setFilters, resetFilters } = useCaseStore();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

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
      <PageHeader title="Query Resolution" count={filteredCases.length}>
        <div className="flex items-center gap-1 border rounded-lg p-0.5">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('table')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </PageHeader>
      <p className="text-sm text-muted-foreground -mt-2 mb-4">Cases returned by approvers that need corrections or additional information before resubmission.</p>
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={resetFilters}
        showStatusFilter={false}
        showConfidenceFilter={false}
      />
      {isLoadingCases ? (
        viewMode === 'table' ? <TableSkeleton rows={8} cols={6} /> : <CardGridSkeleton count={6} />
      ) : filteredCases.length === 0 ? (
        <EmptyState
          title="No queries pending"
          description="No cases have been returned by approvers."
          icon={<MessageSquareWarning className="h-16 w-16" />}
        />
      ) : viewMode === 'grid' ? (
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
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Case ID</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Returned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCases.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/agent/cases/${c.id}/validation`)}
                >
                  <TableCell className="font-mono font-medium py-3">{c.id}</TableCell>
                  <TableCell className="py-3">{c.vendorName}</TableCell>
                  <TableCell className="py-3">
                    <CategoryBadge category={c.category} />
                  </TableCell>
                  <TableCell className="py-3">{c.headerData.invoiceNumber || '-'}</TableCell>
                  <TableCell className="text-right font-semibold py-3">
                    {formatCurrency(c.headerData.grandTotal, c.headerData.currency)}
                  </TableCell>
                  <TableCell className="py-3">
                    <CaseStatusBadge status={c.status} size="sm" />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm py-3">
                    {formatRelativeTime(c.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
