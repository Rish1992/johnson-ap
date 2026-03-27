import { useEffect, useCallback, useState, useMemo } from 'react';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LayoutGrid, List, Search,
  Inbox, CheckCircle, XCircle, Clock, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { formatCurrency, formatRelativeTime } from '@/lib/formatters';
import type { FilterState } from '@/types/filters';

interface StatDef {
  label: string;
  count: number;
  icon: React.ReactNode;
  iconClassName: string;
  secondary?: boolean;
}

export function CaseBrowser() {
  const navigate = useNavigate();
  const { cases, filters, isLoadingCases, fetchCases, setFilters, resetFilters, markAsRead } = useCaseStore();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [poTypeFilter, setPoTypeFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchCases({});
  }, [fetchCases]);

  // Apply PO type filter
  const filteredCases = useMemo(() => {
    if (poTypeFilter === 'ALL') return cases;
    return cases.filter(c => c.poType === poTypeFilter);
  }, [cases, poTypeFilter]);

  const handleFilterChange = useCallback(
    (newFilters: Partial<FilterState>) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  // Compute summary stats from filtered cases
  const stats = useMemo((): StatDef[] => {
    const total = filteredCases.length;
    const pendingReview = filteredCases.filter(c =>
      ['RECEIVED', 'CLASSIFIED', 'CATEGORIZED', 'EXTRACTED', 'IN_REVIEW'].includes(c.status)
    ).length;
    const pendingApproval = filteredCases.filter(c =>
      ['VALIDATED', 'APPROVAL_PENDING'].includes(c.status)
    ).length;
    const completed = filteredCases.filter(c =>
      ['APPROVED', 'POSTED', 'CLOSED'].includes(c.status)
    ).length;
    const rejected = filteredCases.filter(c => c.status === 'REJECTED').length;
    const returned = filteredCases.filter(c => c.status === 'RETURNED').length;

    return [
      { label: 'Total Cases', count: total, icon: <Inbox className="h-4 w-4" />, iconClassName: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' },
      { label: 'Pending Review', count: pendingReview, icon: <Clock className="h-4 w-4" />, iconClassName: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' },
      { label: 'Pending Approval', count: pendingApproval, icon: <AlertTriangle className="h-4 w-4" />, iconClassName: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' },
      { label: 'Completed', count: completed, icon: <CheckCircle className="h-4 w-4" />, iconClassName: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' },
      { label: 'Rejected', count: rejected, icon: <XCircle className="h-4 w-4" />, iconClassName: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300', secondary: true },
      { label: 'Returned', count: returned, icon: <RotateCcw className="h-4 w-4" />, iconClassName: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300', secondary: true },
    ];
  }, [filteredCases]);

  return (
    <div>
      <PageHeader title="Case Browser" count={filteredCases.length}>
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

      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={resetFilters}
        showStatusFilter={true}
        showConfidenceFilter={true}
        showCategoryFilter={true}
        showDateRange={true}
      />

      {/* Inline PO Type filter */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-muted-foreground">PO Type:</span>
        <Select value={poTypeFilter} onValueChange={setPoTypeFilter}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="PO">PO</SelectItem>
            <SelectItem value="NON_PO">Non-PO</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stat Cards */}
      {!isLoadingCases && filteredCases.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {stats.map((stat) => (
            <StatCard
              key={stat.label}
              title={stat.label}
              value={stat.count}
              icon={stat.icon}
              secondary={stat.secondary}
              iconClassName={stat.iconClassName}
            />
          ))}
        </div>
      )}

      {isLoadingCases ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-accent/30 rounded animate-pulse" />
          ))}
        </div>
      ) : filteredCases.length === 0 ? (
        <EmptyState
          title="No cases found"
          description="Try adjusting your filters."
          icon={<Search className="h-16 w-16" />}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCases.map((c) => (
            <CaseCard
              key={c.id}
              caseData={c}
              variant="browser"
              onClick={(id) => { markAsRead(id); navigate(`/agent/cases/${id}/overview`); }}
            />
          ))}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
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
                  onClick={() => { markAsRead(c.id); navigate(`/agent/cases/${c.id}/overview`); }}
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
                    {formatCurrency(c.headerData.totalAmount, c.headerData.currency)}
                  </TableCell>
                  <TableCell className="py-3">
                    <CaseStatusBadge status={c.status} size="sm" />
                  </TableCell>
                  <TableCell className="py-3">
                    {c.overallConfidence > 0 ? (
                      <ConfidenceBadge score={c.overallConfidence} level={c.overallConfidenceLevel} />
                    ) : (
                      '-'
                    )}
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
