import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, X, SlidersHorizontal, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CASE_STATUS_CONFIG, CASE_CATEGORY_CONFIG, CONFIDENCE_LEVEL_CONFIG } from '@/lib/constants';
import type { CaseStatus, CaseCategory, ConfidenceLevel } from '@/types/case';
import type { FilterState } from '@/types/filters';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onReset: () => void;
  availableStatuses?: CaseStatus[];
  showCategoryFilter?: boolean;
  showConfidenceFilter?: boolean;
  showStatusFilter?: boolean;
  showDateRange?: boolean;
  /** Extra filter controls rendered inside the expanded panel */
  extraFilters?: React.ReactNode;
}

export function FilterBar({
  filters,
  onFilterChange,
  onReset,
  availableStatuses,
  showCategoryFilter = true,
  showConfidenceFilter = false,
  showStatusFilter = true,
  showDateRange = false,
  extraFilters,
}: FilterBarProps) {
  const [searchValue, setSearchValue] = useState(filters.search);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchValue !== filters.search) {
        onFilterChange({ search: searchValue });
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchValue, filters.search, onFilterChange]);

  const statuses = availableStatuses || (Object.keys(CASE_STATUS_CONFIG) as CaseStatus[]);

  const activeFilterCount = [
    filters.status.length > 0,
    filters.category.length > 0,
    filters.confidenceLevel.length > 0,
    filters.dateRange?.from || filters.dateRange?.to,
    filters.sortBy && filters.sortBy !== 'createdAt',
  ].filter(Boolean).length;

  const handleReset = () => {
    setSearchValue('');
    onReset();
  };

  return (
    <div className="mb-4 space-y-2">
      {/* Row: search + filter toggle + clear */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cases..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9"
          />
          {searchValue && (
            <button
              onClick={() => { setSearchValue(''); onFilterChange({ search: '' }); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Button
          variant={showFilters ? 'default' : 'outline'}
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => setShowFilters(v => !v)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge
              variant={showFilters ? 'secondary' : 'default'}
              className="h-5 min-w-5 px-1.5 text-[11px] rounded-full"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {(activeFilterCount > 0 || searchValue) && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground shrink-0"
            onClick={handleReset}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Animated expandable filter panel */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          showFilters ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        )}
      >
        <div className="flex items-center gap-2 flex-wrap p-3 bg-muted/40 rounded-lg border">

          {/* Status */}
          {showStatusFilter && (
            <Select
              value={filters.status[0] || 'all'}
              onValueChange={(v) => onFilterChange({ status: v === 'all' ? [] : [v as CaseStatus] })}
            >
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>{CASE_STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Category */}
          {showCategoryFilter && (
            <Select
              value={filters.category[0] || 'all'}
              onValueChange={(v) => onFilterChange({ category: v === 'all' ? [] : [v as CaseCategory] })}
            >
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {(Object.keys(CASE_CATEGORY_CONFIG) as CaseCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>{CASE_CATEGORY_CONFIG[c].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Confidence */}
          {showConfidenceFilter && (
            <Select
              value={filters.confidenceLevel[0] || 'all'}
              onValueChange={(v) => onFilterChange({ confidenceLevel: v === 'all' ? [] : [v as ConfidenceLevel] })}
            >
              <SelectTrigger className="w-[145px] h-8 text-xs">
                <SelectValue placeholder="Confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {(Object.keys(CONFIDENCE_LEVEL_CONFIG) as ConfidenceLevel[]).map((l) => (
                  <SelectItem key={l} value={l}>{CONFIDENCE_LEVEL_CONFIG[l].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date Range */}
          {showDateRange && (
            <>
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Input
                  type="date"
                  value={filters.dateRange?.from || ''}
                  onChange={(e) => onFilterChange({ dateRange: { ...filters.dateRange, from: e.target.value || null } })}
                  className="w-[130px] h-8 text-xs"
                />
              </div>
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={filters.dateRange?.to || ''}
                onChange={(e) => onFilterChange({ dateRange: { ...filters.dateRange, to: e.target.value || null } })}
                className="w-[130px] h-8 text-xs"
              />
            </>
          )}

          {/* Sort */}
          <Select
            value={filters.sortBy}
            onValueChange={(v) => onFilterChange({ sortBy: v })}
          >
            <SelectTrigger className="w-[145px] h-8 text-xs">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Date (newest)</SelectItem>
              <SelectItem value="createdAtAsc">Date (oldest)</SelectItem>
              <SelectItem value="totalAmount">Amount (high)</SelectItem>
              <SelectItem value="totalAmountAsc">Amount (low)</SelectItem>
              <SelectItem value="confidence">Confidence (low)</SelectItem>
              <SelectItem value="sla">SLA (urgent)</SelectItem>
            </SelectContent>
          </Select>

          {/* Slot for extra filters (e.g. PO Type in CaseBrowser) */}
          {extraFilters}
        </div>
      </div>
    </div>
  );
}
