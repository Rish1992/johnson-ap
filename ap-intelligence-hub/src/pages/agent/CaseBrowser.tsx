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
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

interface StatCard {
  label: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

export function CaseBrowser() {
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

  // Compute summary stats from filtered cases
  const stats = useMemo((): StatCard[] => {
    const total = cases.length;
    const received = cases.filter(c =>
      ['RECEIVED', 'CLASSIFIED', 'CATEGORIZED', 'EXTRACTED'].includes(c.status)
    ).length;
    const inProgress = cases.filter(c =>
      ['IN_REVIEW', 'VALIDATED', 'APPROVAL_PENDING'].includes(c.status)
    ).length;
    const completed = cases.filter(c =>
      ['APPROVED', 'POSTED', 'CLOSED'].includes(c.status)
    ).length;
    const rejected = cases.filter(c => c.status === 'REJECTED').length;
    const returned = cases.filter(c => c.status === 'RETURNED').length;
    const failed = cases.filter(c =>
      ['FAILED', 'DISCARDED'].includes(c.status)
    ).length;

    return [
      {
        label: 'Total Cases',
        count: total,
        icon: <Inbox className="h-4 w-4" />,
        color: 'text-neutral-700 dark:text-neutral-300',
        bgColor: 'bg-neutral-100 dark:bg-neutral-800',
      },
      {
        label: 'Received',
        count: received,
        icon: <Clock className="h-4 w-4" />,
        color: 'text-red-700 dark:text-red-300',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
      },
      {
        label: 'In Progress',
        count: inProgress,
        icon: <AlertTriangle className="h-4 w-4" />,
        color: 'text-amber-700 dark:text-amber-300',
        bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      },
      {
        label: 'Completed',
        count: completed,
        icon: <CheckCircle className="h-4 w-4" />,
        color: 'text-green-700 dark:text-green-300',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
      },
      {
        label: 'Rejected',
        count: rejected,
        icon: <XCircle className="h-4 w-4" />,
        color: 'text-red-700 dark:text-red-300',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
      },
      {
        label: 'Returned',
        count: returned,
        icon: <RotateCcw className="h-4 w-4" />,
        color: 'text-orange-700 dark:text-orange-300',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      },
      {
        label: 'Failed',
        count: failed,
        icon: <AlertTriangle className="h-4 w-4" />,
        color: 'text-red-800 dark:text-red-300',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
      },
    ];
  }, [cases]);

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

      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={resetFilters}
        showStatusFilter={true}
        showConfidenceFilter={true}
        showCategoryFilter={true}
        showDateRange={true}
      />

      {/* Summary Stat Cards */}
      {!isLoadingCases && cases.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="border transition-shadow hover:shadow-md">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 rounded-lg ${stat.bgColor} ring-1 ring-inset ring-black/5 dark:ring-white/5`}>
                    <span className={stat.color}>{stat.icon}</span>
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground tracking-tight">{stat.count}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
              onClick={(id) => navigate(`/agent/cases/${id}/overview`)}
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
              {cases.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/agent/cases/${c.id}/overview`)}
                >
                  <TableCell className="font-mono font-medium py-3">{c.id}</TableCell>
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
