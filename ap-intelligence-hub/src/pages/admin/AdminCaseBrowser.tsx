import { useEffect, useCallback, useState } from 'react';
import { CaseCard } from '@/components/shared/CaseCard';
import { CaseStatusBadge } from '@/components/shared/CaseStatusBadge';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { FilterBar } from '@/components/shared/FilterBar';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { LayoutGrid, List, Search, Calendar, User, DollarSign, Clock, FileText } from 'lucide-react';
import { formatCurrency, formatRelativeTime, formatDateTime } from '@/lib/formatters';
import type { Case, CaseStatus, CaseCategory, ConfidenceLevel } from '@/types/case';
import type { FilterState } from '@/types/filters';

const defaultFilters: FilterState = {
  search: '',
  status: [] as CaseStatus[],
  category: [] as CaseCategory[],
  confidenceLevel: [] as ConfidenceLevel[],
  vendorId: null,
  dateRange: { from: null, to: null },
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: 1,
  pageSize: 50,
};

export function AdminCaseBrowser() {
  const [allCases, setAllCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [filters, setFiltersState] = useState<FilterState>(defaultFilters);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    import('@/lib/handlers').then(({ fetchAllCases }) => {
      fetchAllCases().then((data) => {
        setAllCases(data);
        setIsLoading(false);
      });
    });
  }, []);

  // Apply client-side filtering
  const filteredCases = allCases.filter((c) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !c.id.toLowerCase().includes(q) &&
        !c.vendorName.toLowerCase().includes(q) &&
        !c.headerData.invoiceNumber.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (filters.status.length > 0 && !filters.status.includes(c.status)) return false;
    if (filters.category.length > 0 && !(filters.category as string[]).includes(c.category)) return false;
    if (filters.confidenceLevel.length > 0 && !(filters.confidenceLevel as string[]).includes(c.overallConfidenceLevel)) return false;
    return true;
  });

  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const handleReset = useCallback(() => {
    setFiltersState(defaultFilters);
  }, []);

  const handleCaseClick = (caseId: string) => {
    const found = allCases.find((c) => c.id === caseId);
    if (found) {
      setSelectedCase(found);
      setDialogOpen(true);
    }
  };

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
      <p className="text-sm text-muted-foreground -mt-4 mb-4">Search, filter, and inspect all cases across the system.</p>

      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        showStatusFilter={true}
        showConfidenceFilter={true}
        showCategoryFilter={true}
      />

      {isLoading ? (
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
              onClick={handleCaseClick}
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
                <TableHead>Assigned Agent</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCases.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => handleCaseClick(c.id)}
                >
                  <TableCell className="font-mono font-medium">{c.id}</TableCell>
                  <TableCell>{c.vendorName}</TableCell>
                  <TableCell>
                    <CategoryBadge category={c.category} />
                  </TableCell>
                  <TableCell>{c.headerData.invoiceNumber || '-'}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(c.headerData.grandTotal, c.headerData.currency)}
                  </TableCell>
                  <TableCell>
                    <CaseStatusBadge status={c.status} size="sm" />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.assignedAgentName || '-'}
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

      {/* Case Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedCase && (
            <>
              <DialogHeader className="pb-3">
                <DialogTitle className="flex items-center gap-3">
                  <span className="font-mono text-lg">{selectedCase.id}</span>
                  <CaseStatusBadge status={selectedCase.status} size="sm" />
                </DialogTitle>
                <DialogDescription>
                  Invoice from {selectedCase.vendorName}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Summary Grid */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Vendor
                    </span>
                    <p className="text-sm font-medium">{selectedCase.vendorName}</p>
                    <p className="text-xs text-muted-foreground">{selectedCase.vendorNumber}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Invoice Amount
                    </span>
                    <p className="text-sm font-bold">
                      {formatCurrency(selectedCase.headerData.grandTotal, selectedCase.headerData.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Net: {formatCurrency(selectedCase.headerData.netAmount, selectedCase.headerData.currency)} | Tax: {formatCurrency(selectedCase.headerData.taxAmount, selectedCase.headerData.currency)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Invoice Details
                    </span>
                    <p className="text-sm">{selectedCase.headerData.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      Date: {selectedCase.headerData.invoiceDate} | Due: {selectedCase.headerData.dueDate}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">Category</span>
                    <div>
                      <CategoryBadge category={selectedCase.category} />
                    </div>
                    {selectedCase.contractNumber && (
                      <p className="text-xs text-muted-foreground">Contract: {selectedCase.contractNumber}</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Assignment & Timing */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <User className="h-3 w-3" /> Assigned Agent
                    </span>
                    <p className="text-sm">{selectedCase.assignedAgentName || 'Unassigned'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Created
                    </span>
                    <p className="text-sm">{formatDateTime(selectedCase.createdAt)}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Last Updated
                    </span>
                    <p className="text-sm">{formatDateTime(selectedCase.updatedAt)}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">SLA Deadline</span>
                    <p className="text-sm">
                      {formatDateTime(selectedCase.slaDeadline)}
                      {selectedCase.isSlaBreach && (
                        <Badge variant="destructive" className="ml-2 text-[10px]">Breached</Badge>
                      )}
                    </p>
                  </div>
                  {selectedCase.sapDocumentNumber && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground font-medium">SAP Document</span>
                      <p className="text-sm font-mono">{selectedCase.sapDocumentNumber}</p>
                    </div>
                  )}
                </div>

                {/* Accounting Info */}
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-3">Accounting Details</h4>
                  <div className="grid grid-cols-3 gap-3 text-sm p-3 rounded-lg bg-muted/20 border">
                    <div>
                      <span className="text-xs text-muted-foreground">Cost Center</span>
                      <p className="font-mono">{selectedCase.headerData.costCenter}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">GL Account</span>
                      <p className="font-mono">{selectedCase.headerData.glAccount}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Company Code</span>
                      <p className="font-mono">{selectedCase.headerData.companyCode}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Plant Code</span>
                      <p className="font-mono">{selectedCase.headerData.plantCode}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Tax Code</span>
                      <p className="font-mono">{selectedCase.headerData.taxCode}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Payment Terms</span>
                      <p>{selectedCase.headerData.paymentTerms}</p>
                    </div>
                  </div>
                </div>

                {/* Rejection / Return info */}
                {selectedCase.status === 'REJECTED' && selectedCase.rejectionReason && (
                  <>
                    <Separator />
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">
                        Rejected by {selectedCase.rejectedByName}
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-300 mt-1">{selectedCase.rejectionReason}</p>
                    </div>
                  </>
                )}
                {selectedCase.status === 'RETURNED' && selectedCase.returnReason && (
                  <>
                    <Separator />
                    <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                        Returned by {selectedCase.returnedByName}
                      </p>
                      <p className="text-sm text-orange-600 dark:text-orange-300 mt-1">{selectedCase.returnReason}</p>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
