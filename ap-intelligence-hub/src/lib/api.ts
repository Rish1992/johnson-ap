// Real API client — mirrors every export from mock/handlers.ts
// Swap is controlled by VITE_USE_REAL_API flag via lib/handlers.ts

import type {
  Case,
  InvoiceHeaderData,
  LineItem,
  BusinessRuleResult,
  ApprovalComment,
} from '@/types/case';
import type { FilterState } from '@/types/filters';
import type { Notification } from '@/types/notification';
import type { AuditLogEntry } from '@/types/audit';
import type {
  Vendor,
  CostCenter,
  GLAccount,
  TaxCode,
  CompanyCode,
  PlantCode,
  ApprovalRule,
  BusinessRuleConfig,
  ApprovalSequenceMaster,
  FreightRateCard,
  ServiceRateCard,
  AgreementMaster,
  InvoiceCategoryConfig,
  CategoryFieldConfig,
} from '@/types/masterData';
import type { User, Session } from '@/types/user';

// Re-export EmailRecord type so consumers can import from handlers
export type { EmailRecord } from '@/types/email';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/johnson-api';

// ---------------------------------------------------------------------------
// Token management (localStorage)
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'ap-auth-token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Fetch wrapper
// ---------------------------------------------------------------------------

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Only set Content-Type for JSON bodies (not FormData/multipart)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  // Some endpoints return 204/no content
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return res.json();
}

function get<T>(path: string): Promise<T> {
  // Cache-bust all GET requests to prevent CDN/proxy caching stale data
  const sep = path.includes('?') ? '&' : '?';
  return request<T>(`${path}${sep}_t=${Date.now()}`);
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(email: string, password: string): Promise<Session> {
  const session = await post<Session>('/api/auth/login', { email, password });
  setToken(session.token);
  return session;
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export async function fetchCases(filters: FilterState): Promise<Case[]> {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.status?.length) params.set('status', filters.status.join(','));
  if (filters.category?.length) params.set('category', (filters.category as string[]).join(','));
  if (filters.confidenceLevel?.length) params.set('confidence_level', (filters.confidenceLevel as string[]).join(','));
  if (filters.vendorId) params.set('vendorId', filters.vendorId);
  if (filters.dateRange) {
    if (filters.dateRange.start) params.set('dateFrom', filters.dateRange.start);
    if (filters.dateRange.end) params.set('dateTo', filters.dateRange.end);
  }
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('page_size', String(filters.pageSize));
  const qs = params.toString();
  const resp = await get<{ cases: Case[]; total: number }>(`/api/cases${qs ? `?${qs}` : ''}`);
  return resp.cases;
}

export async function fetchAllCases(): Promise<Case[]> {
  return get<Case[]>('/api/cases/all');
}

export async function fetchCaseById(id: string): Promise<Case> {
  return get<Case>(`/api/cases/${id}`);
}

export async function saveDraft(
  caseId: string,
  data: { headerData: InvoiceHeaderData; lineItems: LineItem[] },
): Promise<Case> {
  return put<Case>(`/api/cases/${caseId}/draft`, data);
}

export async function runBusinessRules(caseId: string): Promise<BusinessRuleResult[]> {
  return post<BusinessRuleResult[]>(`/api/cases/${caseId}/business-rules`);
}

export async function saveAndConfirm(
  caseId: string,
  data: { headerData: InvoiceHeaderData; lineItems: LineItem[] },
): Promise<Case> {
  return post<Case>(`/api/cases/${caseId}/confirm`, data);
}

export async function rejectCase(caseId: string, reason: string): Promise<Case> {
  return post<Case>(`/api/cases/${caseId}/reject`, { reason });
}

export async function submitForApproval(
  caseId: string,
  approverIds: string[],
  comment?: string,
): Promise<Case> {
  return post<Case>(`/api/cases/${caseId}/submit-for-approval`, { approverIds, comment });
}

export async function approveCaseHandler(
  caseId: string,
  comment: string,
): Promise<Case> {
  return post<Case>(`/api/cases/${caseId}/approve`, { comment });
}

export async function sendBackCase(caseId: string, reason: string): Promise<Case> {
  return post<Case>(`/api/cases/${caseId}/send-back`, { reason });
}

export async function rejectCaseAsApprover(
  caseId: string,
  reason: string,
): Promise<Case> {
  return post<Case>(`/api/cases/${caseId}/reject-as-approver`, { reason });
}

export async function resubmitCase(
  caseId: string,
  approverIds: string[],
  comment?: string,
): Promise<Case> {
  return post<Case>(`/api/cases/${caseId}/resubmit`, { approverIds, comment });
}

export async function exportSap(caseId: string): Promise<{ downloadUrl: string; sapDocumentNumber: string; sapData: unknown }> {
  return post(`/api/cases/${caseId}/export-sap`);
}

export async function updateApprovalChain(
  caseId: string,
  newSteps: { approverId: string; approverName: string; approverRole: string }[],
  reason: string,
): Promise<Case> {
  return put<Case>(`/api/cases/${caseId}/approval-chain`, { steps: newSteps, reason });
}

export async function fetchApproverCases(approverId: string, _role?: string): Promise<Case[]> {
  return get<Case[]>('/api/approver/cases');
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function fetchComments(caseId: string): Promise<ApprovalComment[]> {
  return get<ApprovalComment[]>(`/api/cases/${caseId}/comments`);
}

export async function addComment(
  caseId: string,
  content: string,
): Promise<ApprovalComment> {
  return post<ApprovalComment>(`/api/cases/${caseId}/comments`, { content });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function fetchNotifications(): Promise<Notification[]> {
  return get<Notification[]>('/api/notifications');
}

export async function markNotificationRead(id: string): Promise<void> {
  await put<void>(`/api/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await put<void>('/api/notifications/read-all');
}

// ---------------------------------------------------------------------------
// Master data
// ---------------------------------------------------------------------------

export async function fetchVendors(): Promise<Vendor[]> {
  return get<Vendor[]>('/api/masters/vendors');
}
export async function fetchCostCenters(): Promise<CostCenter[]> {
  return get<CostCenter[]>('/api/masters/cost-centers');
}
export async function fetchGLAccounts(): Promise<GLAccount[]> {
  return get<GLAccount[]>('/api/masters/gl-accounts');
}
export async function fetchTaxCodes(): Promise<TaxCode[]> {
  return get<TaxCode[]>('/api/masters/tax-codes');
}
export async function fetchCompanyCodes(): Promise<CompanyCode[]> {
  return get<CompanyCode[]>('/api/masters/company-codes');
}
export async function fetchPlantCodes(): Promise<PlantCode[]> {
  return get<PlantCode[]>('/api/masters/plant-codes');
}
export async function fetchApprovalRules(): Promise<ApprovalRule[]> {
  return get<ApprovalRule[]>('/api/masters/approval-rules');
}
export async function fetchBusinessRuleConfigs(): Promise<BusinessRuleConfig[]> {
  return get<BusinessRuleConfig[]>('/api/masters/business-rule-configs');
}
export async function fetchApprovalSequences(): Promise<ApprovalSequenceMaster[]> {
  return get<ApprovalSequenceMaster[]>('/api/masters/approval-sequences');
}
export async function fetchFreightRateCards(): Promise<FreightRateCard[]> {
  return get<FreightRateCard[]>('/api/masters/freight-rate-cards');
}
export async function fetchServiceRateCards(): Promise<ServiceRateCard[]> {
  return get<ServiceRateCard[]>('/api/masters/service-rate-cards');
}
export async function fetchAgreementMasters(): Promise<AgreementMaster[]> {
  return get<AgreementMaster[]>('/api/masters/agreement-masters');
}
export async function fetchInvoiceCategoryConfigs(): Promise<InvoiceCategoryConfig[]> {
  return get<InvoiceCategoryConfig[]>('/api/masters/invoice-category-configs');
}

export async function addVendor(data: Omit<Vendor, 'id' | 'contracts'>): Promise<Vendor> {
  return post<Vendor>('/api/masters/vendors', data);
}
export async function updateVendor(id: string, data: Partial<Vendor>): Promise<Vendor> {
  return put<Vendor>(`/api/masters/vendors/${id}`, data);
}
export async function deleteVendor(id: string): Promise<void> {
  return del<void>(`/api/masters/vendors/${id}`);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function addUser(data: {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  approvalLimit?: number;
}): Promise<void> {
  await post<void>('/api/users', data);
}

export async function fetchAllUsers(): Promise<User[]> {
  return get<User[]>('/api/users');
}

// Alias to match mock/handlers export
export { fetchAllUsers as fetchUsers };

export async function updateUser(id: string, data: Partial<User>): Promise<User> {
  return put<User>(`/api/users/${id}`, data);
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function fetchAuditLog(caseId: string): Promise<AuditLogEntry[]> {
  return get<AuditLogEntry[]>(`/api/cases/${caseId}/audit-log`);
}

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

// EmailRecord type re-exported at top of file from '@/types/email'
import type { EmailRecord } from '@/types/email';

export async function fetchEmails(): Promise<EmailRecord[]> {
  return get<EmailRecord[]>('/api/emails');
}

export async function overrideEmailClassification(
  emailId: string,
  data: { classification?: string; invoiceCategory?: string; entity?: string; poType?: string },
): Promise<EmailRecord> {
  return request<EmailRecord>(`/api/emails/${emailId}/override`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// Prompt Templates
// ---------------------------------------------------------------------------

export async function fetchPrompts(): Promise<unknown[]> {
  return get<unknown[]>('/api/admin/prompts');
}

export async function fetchPromptByStep(step: string): Promise<unknown> {
  return get<unknown>(`/api/admin/prompts/${step}`);
}

export async function updatePrompt(id: string, data: { technicalPrompt?: string; businessRules?: string }): Promise<unknown> {
  return put<unknown>(`/api/admin/prompts/${id}`, data);
}

// ---------------------------------------------------------------------------
// Category Field Configs
// ---------------------------------------------------------------------------

export async function fetchCategoryConfigs(): Promise<CategoryFieldConfig[]> {
  const raw = await get<Record<string, unknown>[]>('/api/admin/category-configs');
  return raw.map(r => ({ category: (r.name as string) || '', invoiceFields: r.invoiceFields, supportingFields: r.supportingFields, validationRules: r.validationRules }) as unknown as CategoryFieldConfig);
}

export async function fetchCategoryFields(category: string): Promise<CategoryFieldConfig> {
  const raw = await get<Record<string, unknown>>(`/api/admin/category-configs/${category}/fields`);
  return { category, ...raw } as unknown as CategoryFieldConfig;
}

export async function updateCategoryFields(category: string, fields: CategoryFieldConfig): Promise<void> {
  return put<void>(`/api/admin/category-configs/${category}/fields`, fields);
}
