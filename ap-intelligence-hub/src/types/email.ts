import type { CaseCategory } from './case';

export interface EmailRecord {
  id: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  receivedAt: string;
  body: string;
  attachmentCount: number;
  attachments: { fileName: string; fileType: string; fileSize: number }[];
  classification: 'INVOICE' | 'NON_INVOICE' | 'UNCLASSIFIED';
  invoiceCategory: CaseCategory | null;
  classificationConfidence: number;
  linkedCaseId: string | null;
  isRead: boolean;
  poType: 'PO' | 'NON_PO';
  entity: 'AU' | 'NZ';
  xeroLink?: string;
}
