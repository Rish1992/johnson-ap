export type NotificationType =
  | 'CASE_ASSIGNED'
  | 'CASE_RETURNED'
  | 'APPROVAL_REQUIRED'
  | 'CASE_APPROVED'
  | 'CASE_REJECTED'
  | 'SLA_WARNING'
  | 'SLA_BREACH'
  | 'EXTRACTION_COMPLETE'
  | 'POSTING_SUCCESS'
  | 'POSTING_FAILED';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  caseId: string | null;
  recipientId: string;
  isRead: boolean;
  createdAt: string;
}
