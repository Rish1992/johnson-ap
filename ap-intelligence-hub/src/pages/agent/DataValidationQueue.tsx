import { useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaseStore } from '@/stores/caseStore';
import { CaseCard } from '@/components/shared/CaseCard';
import { CaseStatusBadge } from '@/components/shared/CaseStatusBadge';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { FilterBar } from '@/components/shared/FilterBar';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ClipboardCheck, FileText, Clock, CheckCircle, ShieldCheck, LayoutGrid, List } from 'lucide-react';
import { StatCardsSkeleton, CardGridSkeleton, TableSkeleton } from '@/components/shared/PageSkeleton';
import { formatCurrency, formatRelativeTime } from '@/lib/formatters';
import type { CaseStatus } from '@/types/case';
import type { FilterState } from '@/types/filters';

const QUEUE_STATUSES: CaseStatus[] = ['EXTRACTED', 'IN_REVIEW'];

export function DataValidationQueue() {
  const navigate = useNavigate();
  const { cases, filters, isLoadingCases, fetchCases, setFilters, resetFilters, markAsRead } = useCaseStore();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

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
      <PageHeader title="Case Dashboard" count={filteredCases.length}>
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
      <p className="text-sm text-muted-foreground -mt-2 mb-4">Review and validate AI-extracted invoice data before submitting for approval.</p>
      {isLoadingCases ? <StatCardsSkeleton count={4} /> : cases.length > 0 && (
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
        viewMode === 'table' ? <TableSkeleton rows={8} cols={7} /> : <CardGridSkeleton count={6} />
      ) : filteredCases.length === 0 ? (
        <EmptyState
          title="All caught up!"
          description="No cases pending validation."
          icon={<ClipboardCheck className="h-16 w-16" />}
        />
      ) : viewMode === 'grid' ? (
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
                <TableHead>Confidence</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCases.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => { markAsRead(c.id); navigate(`/agent/cases/${c.id}/validation`); }}
                >
                  <TableCell className="font-mono font-medium py-3">
                    {c.isRead === false && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 align-middle" />}
                    <span className={c.isRead === false ? 'font-extrabold' : ''}>{c.id}</span>
                  </TableCell>
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
                  <TableCell className="py-3">
                    {c.overallConfidence > 0 ? (
                      <ConfidenceBadge score={c.overallConfidence} level={c.overallConfidenceLevel} />
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm py-3">
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
