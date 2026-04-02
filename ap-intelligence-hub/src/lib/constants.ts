import type { CaseStatus, CaseCategory, ConfidenceLevel } from '@/types/case';
import type { UserRole } from '@/types/user';

export const APP_NAME = 'InvoiceIQ';
export const APP_VERSION = '1.0.0';

export const CASE_STATUS_CONFIG: Record<CaseStatus, { label: string; color: string; bgColor: string }> = {
  RECEIVED: { label: 'Received', color: 'text-slate-700', bgColor: 'bg-slate-100' },
  CLASSIFIED: { label: 'Classified', color: 'text-slate-700', bgColor: 'bg-slate-100' },
  CATEGORIZED: { label: 'Categorized', color: 'text-slate-700', bgColor: 'bg-slate-100' },
  EXTRACTED: { label: 'Extracted', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  IN_REVIEW: { label: 'In Review', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  VALIDATED: { label: 'Validated', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  APPROVAL_PENDING: { label: 'Approval Pending', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  APPROVED: { label: 'Approved', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  POSTED: { label: 'Posted', color: 'text-green-700', bgColor: 'bg-green-100' },
  CLOSED: { label: 'Closed', color: 'text-green-800', bgColor: 'bg-green-200' },
  REJECTED: { label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-100' },
  DISCARDED: { label: 'Discarded', color: 'text-gray-500', bgColor: 'bg-gray-100' },
  RETURNED: { label: 'Returned', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  FAILED: { label: 'Failed', color: 'text-red-800', bgColor: 'bg-red-200' },
};

export const CASE_CATEGORY_CONFIG: Record<CaseCategory, { label: string; color: string; bgColor: string }> = {
  SUBCONTRACTOR: { label: 'Subcontractor', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  RUST_SUBCONTRACTOR: { label: 'Rust \u2013 Subcontractor', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  DELIVERY_INSTALLATION: { label: 'D&I', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  FREIGHT_FINISHED_GOODS: { label: 'Freight \u2013 Finished Goods', color: 'text-teal-700', bgColor: 'bg-teal-100' },
  FREIGHT_SPARE_PARTS: { label: 'Freight \u2013 Spare Parts', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  FREIGHT_ADDITIONAL_CHARGES: { label: 'Freight \u2013 Add. Charges', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
};

export const CONFIDENCE_LEVEL_CONFIG: Record<ConfidenceLevel, { label: string; color: string; bgColor: string; dotColor: string }> = {
  HIGH: { label: 'High', color: 'text-green-700', bgColor: 'bg-green-100', dotColor: 'bg-green-500' },
  MEDIUM: { label: 'Medium', color: 'text-amber-700', bgColor: 'bg-amber-100', dotColor: 'bg-amber-500' },
  LOW: { label: 'Low', color: 'text-red-700', bgColor: 'bg-red-100', dotColor: 'bg-red-500' },
};

export const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bgColor: string; homePath: string }> = {
  AP_AGENT: { label: 'AP Agent', color: 'text-blue-700', bgColor: 'bg-blue-100', homePath: '/agent/validation' },
  AP_REVIEWER: { label: 'AP Reviewer', color: 'text-purple-700', bgColor: 'bg-purple-100', homePath: '/approver/queue' },
  L2_APPROVER: { label: 'L2 Approver', color: 'text-amber-700', bgColor: 'bg-amber-100', homePath: '/approver/queue' },
  SUPER_ADMIN: { label: 'Super Admin', color: 'text-emerald-700', bgColor: 'bg-emerald-100', homePath: '/admin/dashboard' },
};

export const AUDIT_CATEGORY_COLORS: Record<string, string> = {
  SYSTEM: 'text-blue-600',
  AGENT: 'text-purple-600',
  APPROVER: 'text-amber-600',
  ADMIN: 'text-emerald-600',
};

export const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP'] as const;
export const UNITS = ['EA', 'M', 'KG', 'L', 'HR', 'SET', 'LOT'] as const;
export const INVOICE_TYPES = ['STANDARD', 'CREDIT_NOTE', 'DEBIT_NOTE', 'PROFORMA', 'RECURRING'] as const;

export const INVOICE_TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  STANDARD: { label: 'Standard Invoice', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  CREDIT_NOTE: { label: 'Credit Note', color: 'text-red-700', bgColor: 'bg-red-100' },
  DEBIT_NOTE: { label: 'Debit Note', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  PROFORMA: { label: 'Proforma', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  RECURRING: { label: 'Recurring', color: 'text-teal-700', bgColor: 'bg-teal-100' },
};
