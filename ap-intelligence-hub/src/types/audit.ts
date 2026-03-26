import type { UserRole } from './user';

export type AuditAction =
  | 'EMAIL_RECEIVED'
  | 'EMAIL_CLASSIFIED'
  | 'EMAIL_CATEGORIZED'
  | 'DATA_EXTRACTED'
  | 'VENDOR_MATCHED'
  | 'CONTRACT_MATCHED'
  | 'BUSINESS_RULE_RUN'
  | 'AGENT_ASSIGNED'
  | 'AGENT_REVIEW_STARTED'
  | 'AGENT_DATA_VALIDATED'
  | 'FIELD_EDITED'
  | 'DRAFT_SAVED'
  | 'BUSINESS_RULE_RERUN'
  | 'DATA_CONFIRMED'
  | 'SUBMITTED_FOR_APPROVAL'
  | 'APPROVAL_CHAIN_CREATED'
  | 'SENT_TO_APPROVER'
  | 'APPROVED'
  | 'REJECTED'
  | 'RETURNED'
  | 'RESUBMITTED'
  | 'POSTED_TO_SAP'
  | 'CASE_CLOSED'
  | 'COMMENT_ADDED'
  | 'APPROVAL_SEQUENCE_EDITED'
  | 'EXTRACTION_RETRIGGERED'
  | 'CASE_DISCARDED'
  | 'CASE_FAILED';

export type AuditCategory = 'SYSTEM' | 'AGENT' | 'APPROVER' | 'ADMIN';

export interface AuditLogEntry {
  id: string;
  caseId: string;
  action: AuditAction;
  category: AuditCategory;
  description: string;
  performedBy: string;
  performedByName: string;
  performedByRole: UserRole | 'SYSTEM';
  timestamp: string;
  oldValue?: string;
  newValue?: string;
  fieldName?: string;
  metadata?: Record<string, unknown>;
}
