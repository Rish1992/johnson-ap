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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LayoutGrid, List, Search } from 'lucide-react';
import { formatCurrency, formatRelativeTime } from '@/lib/formatters';
import type { FilterState } from '@/types/filters';

export function ApproverCaseBrowser() {
  const navigate = useNavigate();
  const { cases, filters, isLoadingCases, fetchCases, setFilters, resetFilters } = useCaseStore();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  useEffect(() => {
    fetchCases({});
  }, [fetchCases]);

  const handleFilterChange = useCallback(
    (newFilters: Partial<FilterState>) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  return (
    <div>
      <PageHeader title="Case Browser" count={cases.length}>
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
      <p className="text-sm text-muted-foreground -mt-4 mb-4">Browse and search all cases across the approval pipeline.</p>

      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={resetFilters}
        showStatusFilter={true}
        showConfidenceFilter={true}
        showCategoryFilter={true}
      />

      {isLoadingCases ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-accent/30 rounded animate-pulse" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <EmptyState
          title="No cases found"
          description="Try adjusting your filters."
          icon={<Search className="h-16 w-16" />}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cases.map((c) => (
            <CaseCard
              key={c.id}
              caseData={c}
              variant="browser"
              onClick={(id) => navigate(`/approver/cases/${id}`)}
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
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => navigate(`/approver/cases/${c.id}`)}
                >
                  <TableCell className="font-mono font-medium">{c.id}</TableCell>
                  <TableCell>{c.vendorName}</TableCell>
                  <TableCell>
                    <CategoryBadge category={c.category} />
                  </TableCell>
                  <TableCell>{c.headerData.invoiceNumber || '-'}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(c.headerData.totalAmount, c.headerData.currency)}
                  </TableCell>
                  <TableCell>
                    <CaseStatusBadge status={c.status} size="sm" />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatRelativeTime(c.createdAt)}
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
