import type { CaseStatus, CaseCategory, ConfidenceLevel } from './case';

export interface FilterState {
  search: string;
  status: CaseStatus[];
  category: CaseCategory[];
  dateRange: { from: string | null; to: string | null };
  confidenceLevel: ConfidenceLevel[];
  vendorId: string | null;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export const defaultFilterState: FilterState = {
  search: '',
  status: [],
  category: [],
  dateRange: { from: null, to: null },
  confidenceLevel: [],
  vendorId: null,
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: 1,
  pageSize: 10,
};
