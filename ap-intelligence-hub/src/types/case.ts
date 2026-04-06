export type CaseStatus =
  | 'RECEIVED'
  | 'CLASSIFIED'
  | 'CATEGORIZED'
  | 'EXTRACTED'
  | 'IN_REVIEW'
  | 'VALIDATED'
  | 'APPROVAL_PENDING'
  | 'APPROVED'
  | 'POSTED'
  | 'CLOSED'
  | 'REJECTED'
  | 'DISCARDED'
  | 'RETURNED'
  | 'FAILED';

export type CaseCategory = 'SUBCONTRACTOR' | 'RUST_SUBCONTRACTOR' | 'DELIVERY_INSTALLATION' | 'FREIGHT_FINISHED_GOODS' | 'FREIGHT_SPARE_PARTS' | 'FREIGHT_ADDITIONAL_CHARGES';

export type InvoiceType = 'STANDARD' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'PROFORMA' | 'RECURRING';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Case {
  id: string;
  status: CaseStatus;
  category: CaseCategory;
  email: {
    from: string;
    to: string;
    subject: string;
    receivedAt: string;
    body: string;
    attachmentCount: number;
  };
  attachments: Attachment[];
  headerData: InvoiceHeaderData;
  supportingData?: Record<string, Record<string, unknown>>;
  lineItems: LineItem[];
  confidenceScores: Record<string, ConfidenceScore>;
  overallConfidence: number;
  overallConfidenceLevel: ConfidenceLevel;
  vendorId: string;
  vendorName: string;
  vendorNumber: string;
  contractNumber: string | null;
  contractStatus: string | null;
  businessRuleResults: BusinessRuleResult[];
  approvalChain: ApprovalChain | null;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  lockedBy: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  slaDeadline: string;
  isSlaBreach: boolean;
  sapDocumentNumber: string | null;
  postedAt: string | null;
  returnedBy: string | null;
  returnedByName: string | null;
  returnReason: string | null;
  returnedAt: string | null;
  returnedFromStep: number | null;
  rejectedBy: string | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  rejectedAt: string | null;
  poType?: 'PO' | 'NON_PO';
  entity?: 'AU' | 'NZ';
  isRead?: boolean;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileType: 'PDF' | 'PNG' | 'JPG' | 'TIFF' | 'XLSX';
  fileSize: number;
  fileUrl: string;
  documentType: 'INVOICE' | 'JOB_SHEET' | 'SUPPORTING' | 'OTHER';
  isMainInvoice: boolean;
  uploadedAt: string;
}

export interface InvoiceHeaderData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  invoiceType: InvoiceType;
  currency: string;
  totalAmount: number;
  taxAmount: number;
  netAmount: number;
  purchaseOrderNumber: string;
  deliveryNoteNumber: string;
  paymentTerms: string;
  companyCode: string;
  plantCode: string;
  costCenter: string;
  glAccount: string;
  taxCode: string;
  description: string;
}

export interface LineItem {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  totalAmount: number;
  taxAmount: number;
  glAccount: string;
  costCenter: string;
}

export interface BoundingBox {
  page: number;    // 1-indexed
  x: number;       // 0-1 normalized
  y: number;       // 0-1 normalized
  width: number;   // 0-1 normalized
  height: number;  // 0-1 normalized
}

export interface ConfidenceScore {
  value: number;
  level: ConfidenceLevel;
  extractedValue: string;
  bbox?: BoundingBox;
}

export interface BusinessRuleResult {
  ruleId: string;
  ruleName: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED';
  message: string;
  fieldPath?: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  expectedValue?: string;
  actualValue?: string;
  matchedAgainst?: string;
  details?: string;
}

export interface ApprovalChain {
  id: string;
  caseId: string;
  steps: ApprovalStep[];
  currentStepIndex: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  createdAt: string;
  completedAt: string | null;
}

export interface ApprovalStep {
  stepNumber: number;
  approverId: string;
  approverName: string;
  approverRole: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'SKIPPED';
  decision: 'APPROVE' | 'REJECT' | 'SEND_BACK' | null;
  comment: string | null;
  decidedAt: string | null;
}

export interface ApprovalComment {
  id: string;
  caseId: string;
  stepNumber: number | null;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
}
