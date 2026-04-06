import type { CaseCategory } from './case';

export interface Vendor {
  id: string;
  vendorNumber: string;
  name: string;
  taxId: string;
  address: string;
  city: string;
  country: string;
  paymentTerms: string;
  bankAccount: string;
  email: string;
  branchCode: string;
  currency: string;
  isActive: boolean;
  contracts: VendorContract[];
}

export interface VendorContract {
  id: string;
  vendorId: string;
  contractNumber: string;
  category: CaseCategory;
  startDate: string;
  endDate: string;
  maxAmount: number;
  isActive: boolean;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  department: string;
  companyCode: string;
  isActive: boolean;
}

export interface GLAccount {
  id: string;
  accountNumber: string;
  name: string;
  type: 'EXPENSE' | 'ASSET' | 'LIABILITY';
  companyCode: string;
  isActive: boolean;
}

export interface TaxCode {
  id: string;
  code: string;
  description: string;
  rate: number;
  country: string;
  isActive: boolean;
}

export interface CompanyCode {
  id: string;
  code: string;
  name: string;
  country: string;
  currency: string;
  isActive: boolean;
}

export interface PlantCode {
  id: string;
  code: string;
  name: string;
  companyCode: string;
  address: string;
  isActive: boolean;
}

export interface ApprovalRule {
  id: string;
  name: string;
  category: CaseCategory;
  minAmount: number;
  maxAmount: number;
  requiredApprovers: number;
  approverIds: string[];
  slaHours: number;
  isActive: boolean;
}

export interface BusinessRuleConfig {
  id: string;
  name: string;
  description: string;
  category: CaseCategory | 'ALL';
  field: string;
  condition: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  isActive: boolean;
}

export interface InboxConfig {
  id: string;
  email: string;
  provider: string;
  pollingFrequency: number;
  defaultAgentId: string;
  region: string;
  isActive: boolean;
}

export interface ExtractionTemplate {
  id: string;
  name: string;
  category: CaseCategory;
  fieldCount: number;
  lastUpdated: string;
  isActive: boolean;
}

export interface NotificationRule {
  id: string;
  trigger: string;
  delay: number;
  channel: 'IN_APP' | 'EMAIL' | 'BOTH';
  recipients: string;
  isActive: boolean;
}

export interface ApprovalSequenceStep {
  stepNumber: number;
  approverRole: string;
  approverName: string;
  approverId: string;
  approverEmail?: string;
}

export interface ApprovalSequenceMaster {
  id: string;
  invoiceType: string;
  name: string;
  description: string;
  steps: ApprovalSequenceStep[];
  isActive: boolean;
}

export interface FreightRateCard {
  id: string;
  origin: string;
  destination: string;
  containerType: string;
  rate: number;
  currency: string;
  vendorId: string;
  isActive: boolean;
}

export interface ServiceRateCard {
  id: string;
  service: string;
  rate: number;
  currency: string;
  vendorId: string;
  isActive: boolean;
}

export interface AgreementMaster {
  id: string;
  vendorId: string;
  vendorName: string;
  agreementNumber: string;
  status: 'Active' | 'Expired' | 'Pending';
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface InvoiceCategoryConfig {
  id: string;
  name: string;
  requiredDocs: string[];
  extractionTemplateId: string;
  authChainId: string;
  glAccount: string;
  isActive: boolean;
}

export interface FieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'select';
  required: boolean;
  validation?: string;
  edgeCaseAction?: 'flag_reviewer' | 'flag_user' | 'send_back';
  sourceHint?: string;
}

export interface ValidationRule {
  ruleId: string;
  ruleName: string;
  condition: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  action: string;
}

export interface CategoryFieldConfig {
  category: string;
  invoiceFields: FieldDefinition[];
  supportingFields: Record<string, FieldDefinition[]>;
  validationRules: ValidationRule[];
}
