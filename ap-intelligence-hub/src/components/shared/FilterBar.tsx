import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, RotateCcw, CalendarDays } from 'lucide-react';
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
}: FilterBarProps) {
  const [searchValue, setSearchValue] = useState(filters.search);

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
    filters.search,
    filters.status.length > 0,
    filters.category.length > 0,
    filters.confidenceLevel.length > 0,
    filters.dateRange?.from || filters.dateRange?.to,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 bg-muted/30 rounded-lg p-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search cases..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-9 h-10 rounded-lg"
        />
        {searchValue && (
          <button
            onClick={() => { setSearchValue(''); onFilterChange({ search: '' }); }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Status Filter */}
      {showStatusFilter && (
        <Select
          value={filters.status[0] || 'all'}
          onValueChange={(value) =>
            onFilterChange({ status: value === 'all' ? [] : [value as CaseStatus] })
          }
        >
          <SelectTrigger className="w-[160px] h-10 rounded-lg">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status} value={status}>
                {CASE_STATUS_CONFIG[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Category Filter */}
      {showCategoryFilter && (
        <Select
          value={filters.category[0] || 'all'}
          onValueChange={(value) =>
            onFilterChange({ category: value === 'all' ? [] : [value as CaseCategory] })
          }
        >
          <SelectTrigger className="w-[160px] h-10 rounded-lg">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {(Object.keys(CASE_CATEGORY_CONFIG) as CaseCategory[]).map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CASE_CATEGORY_CONFIG[cat].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Confidence Filter */}
      {showConfidenceFilter && (
        <Select
          value={filters.confidenceLevel[0] || 'all'}
          onValueChange={(value) =>
            onFilterChange({ confidenceLevel: value === 'all' ? [] : [value as ConfidenceLevel] })
          }
        >
          <SelectTrigger className="w-[160px] h-10 rounded-lg">
            <SelectValue placeholder="Confidence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {(Object.keys(CONFIDENCE_LEVEL_CONFIG) as ConfidenceLevel[]).map((level) => (
              <SelectItem key={level} value={level}>
                {CONFIDENCE_LEVEL_CONFIG[level].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Date Range */}
      {showDateRange && (
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            type="date"
            value={filters.dateRange?.from || ''}
            onChange={(e) =>
              onFilterChange({
                dateRange: { ...filters.dateRange, from: e.target.value || null },
              })
            }
            className="w-[140px] h-10 rounded-lg text-sm"
            placeholder="From"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={filters.dateRange?.to || ''}
            onChange={(e) =>
              onFilterChange({
                dateRange: { ...filters.dateRange, to: e.target.value || null },
              })
            }
            className="w-[140px] h-10 rounded-lg text-sm"
            placeholder="To"
          />
        </div>
      )}

      {/* Sort */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground shrink-0">Sort:</span>
        <Select
          value={filters.sortBy}
          onValueChange={(value) => onFilterChange({ sortBy: value })}
        >
          <SelectTrigger className="w-[160px] h-10 rounded-lg">
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
      </div>

      {/* Reset */}
      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onReset} className="gap-1">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
          <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
            {activeFilterCount}
          </Badge>
        </Button>
      )}
    </div>
  );
}
