// Mock API handler layer
// Imported dynamically by Zustand stores and page components to simulate backend calls.

import type {
  Case,
  InvoiceHeaderData,
  LineItem,
  BusinessRuleResult,
  ApprovalComment,
  ApprovalChain,
  ApprovalStep,
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
} from '@/types/masterData';
import type { User, Session } from '@/types/user';

// ---------------------------------------------------------------------------
// Mock data imports
// ---------------------------------------------------------------------------
import { mockUsers } from './users';
import {
  mockVendors,
  mockCostCenters,
  mockGLAccounts,
  mockTaxCodes,
  mockCompanyCodes,
  mockPlantCodes,
  mockApprovalRules,
  mockBusinessRuleConfigs,
  mockFreightRateCards,
  mockServiceRateCards,
  mockAgreementMasters,
  mockInvoiceCategoryConfigs,
} from './vendors';

// ---------------------------------------------------------------------------
// Simulated latency
// ---------------------------------------------------------------------------
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const randomDelay = () => delay(200 + Math.random() * 300);

// ---------------------------------------------------------------------------
// Deterministic case data for consistent display across all screens
// ---------------------------------------------------------------------------

// Status assignments — more realistic distribution: 6 posted, 4 in-review,
// 3 extracted, 3 approval-pending, 2 approved, 2 validated, 2 returned,
// 2 rejected, 1 discarded
const CASE_STATUS_ASSIGNMENTS: Case['status'][] = [
  'IN_REVIEW',        // CASE-0001
  'POSTED',           // CASE-0002
  'APPROVAL_PENDING', // CASE-0003
  'APPROVED',         // CASE-0004
  'POSTED',           // CASE-0005
  'REJECTED',         // CASE-0006 (SLA breach i%6=0)
  'RETURNED',         // CASE-0007
  'POSTED',           // CASE-0008
  'EXTRACTED',        // CASE-0009
  'IN_REVIEW',        // CASE-0010
  'VALIDATED',        // CASE-0011
  'APPROVAL_PENDING', // CASE-0012 (SLA breach i%6=0)
  'POSTED',           // CASE-0013
  'IN_REVIEW',        // CASE-0014
  'POSTED',           // CASE-0015
  'RETURNED',         // CASE-0016
  'DISCARDED',        // CASE-0017
  'EXTRACTED',        // CASE-0018 (SLA breach i%6=0)
  'VALIDATED',        // CASE-0019
  'APPROVAL_PENDING', // CASE-0020
  'APPROVED',         // CASE-0021
  'POSTED',           // CASE-0022
  'REJECTED',         // CASE-0023
  'IN_REVIEW',        // CASE-0024 (SLA breach i%6=0)
  'EXTRACTED',        // CASE-0025
];

// Fixed invoice amounts (AUD) — realistic spread across 10K-500K
const CASE_AMOUNTS = [
  45200, 128500, 312000, 67800, 245600,
  89300, 176400, 423000, 31500, 157200,
  298700, 52400, 185000, 371600, 94100,
  216300, 443500, 28700, 139800, 267400,
  78500, 354200, 115600, 192800, 408900,
];

// Fixed AI confidence scores (0–1) — mix of HIGH/MEDIUM/LOW
const CASE_CONFIDENCES = [
  0.92, 0.78, 0.95, 0.68, 0.87,
  0.73, 0.91, 0.82, 0.65, 0.96,
  0.84, 0.71, 0.89, 0.76, 0.93,
  0.69, 0.88, 0.97, 0.74, 0.85,
  0.67, 0.94, 0.81, 0.72, 0.90,
];

// Shared approver pool used by case, audit-log, and comment generators
const APPROVER_POOL = [
  { id: 'approver-002', name: 'Emma Thompson', role: 'AP_REVIEWER' as const },
  { id: 'approver-001', name: 'John Williams', role: 'AP_REVIEWER' as const },
  { id: 'approver-003', name: 'David Martinez', role: 'AP_REVIEWER' as const },
  { id: 'approver-005', name: 'Robert Johnson', role: 'AP_REVIEWER' as const },
];

// Agent assignment — distribute work across active agents
function getAssignedAgent(i: number) {
  return i % 3 === 0
    ? { id: 'agent-002', name: 'Mike Ross' }
    : { id: 'agent-001', name: 'Sarah Chen' };
}

// ---------------------------------------------------------------------------
// In-memory "database" — mutable copies of the imported mock arrays
// ---------------------------------------------------------------------------

// Cases, audit logs, comments, and notifications are generated inline since
// the ./cases mock file may not exist yet. We build realistic seed data here.

const CATEGORY_GL: Record<string, string> = {
  SUBCONTRACTOR: '500100', RUST_SUBCONTRACTOR: '500200', DELIVERY_INSTALLATION: '500300',
  FREIGHT_FINISHED_GOODS: '510100', FREIGHT_SPARE_PARTS: '510200', FREIGHT_ADDITIONAL_CHARGES: '510300',
};

function generateBusinessRules(
  i: number,
  overallConfidence: number,
  totalAmount: number,
  taxAmount: number,
  netAmount: number,
  contract: { contractNumber: string; startDate: string; endDate: string; maxAmount: number; isActive: boolean } | undefined,
  vendor: { name: string; vendorNumber: string; taxId: string; paymentTerms: string; isActive: boolean },
  category: string,
  hoursAgo: number,
  createdDate: Date,
  now: number,
): BusinessRuleResult[] {
  const isLowConf = overallConfidence < 0.7;
  const isMedConf = overallConfidence >= 0.7 && overallConfidence < 0.85;
  const cNum = contract?.contractNumber ?? 'N/A';
  const cMax = contract?.maxAmount ?? 0;

  return [
    {
      ruleId: 'BRC-001',
      ruleName: 'Duplicate Invoice Detection',
      description: 'Check for duplicate invoices by invoice_number + vendor within a 90-day window.',
      status: (i % 11 === 0 || i === 3) ? 'FAIL' : 'PASS',
      message: (i % 11 === 0 || i === 3)
        ? `Potential duplicate: INV-${2025000 + i} matches INV-${2025000 + i - 9} from same vendor.`
        : 'No duplicate invoices found for this vendor within the lookback window.',
      fieldPath: 'headerData.invoiceNumber',
      severity: (i % 11 === 0 || i === 3) ? 'ERROR' : 'INFO',
      expectedValue: 'Unique invoice number per vendor',
      actualValue: (i % 11 === 0 || i === 3) ? `INV-${2025000 + i} (duplicate of INV-${2025000 + i - 9})` : `INV-${2025000 + i}`,
      matchedAgainst: 'Invoice History (90-day window)',
      details: (i % 11 === 0 || i === 3)
        ? `Invoice INV-${2025000 + i} from ${vendor.name} matches a previously processed invoice. Original posted on ${new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}.`
        : `Searched all invoices from ${vendor.name} within the last 90 days. No matching invoice number found.`,
    },
    {
      ruleId: 'BRC-002',
      ruleName: 'Contract Amount Threshold',
      description: 'Check if invoice amount approaches or exceeds the contract spending limit.',
      status: totalAmount > cMax * 0.95 ? (totalAmount > cMax ? 'FAIL' : 'WARNING') : 'PASS',
      message: totalAmount > cMax
        ? `Invoice amount (AUD ${totalAmount.toLocaleString()}) exceeds contract limit of AUD ${cMax.toLocaleString()}.`
        : totalAmount > cMax * 0.95
          ? `Invoice amount (AUD ${totalAmount.toLocaleString()}) is within 5% of contract limit (AUD ${cMax.toLocaleString()}).`
          : `Contract spending within limits. Used AUD ${totalAmount.toLocaleString()} of AUD ${cMax.toLocaleString()}.`,
      fieldPath: 'headerData.totalAmount',
      severity: totalAmount > cMax ? 'ERROR' : totalAmount > cMax * 0.95 ? 'WARNING' : 'INFO',
      expectedValue: `<= AUD ${cMax.toLocaleString()}`,
      actualValue: `AUD ${totalAmount.toLocaleString()}`,
      matchedAgainst: `Contract ${cNum}`,
      details: `Compared invoice total against contract ${cNum} maximum amount. Contract period: ${contract?.startDate ?? 'N/A'} to ${contract?.endDate ?? 'N/A'}.`,
    },
    {
      ruleId: 'BRC-003',
      ruleName: 'Rate Variance Check',
      description: 'Compare extracted unit rates against the contract rate schedule.',
      status: (isLowConf && i % 3 === 0) ? 'FAIL' : (isMedConf && i % 4 === 0) ? 'WARNING' : 'PASS',
      message: (isLowConf && i % 3 === 0)
        ? `Unit rate AUD ${Math.round(netAmount * 1.15).toLocaleString()} deviates >10% from contract rate AUD ${netAmount.toLocaleString()}.`
        : (isMedConf && i % 4 === 0)
          ? 'Unit rate variance of 5.2% detected against contract rate schedule.'
          : 'All extracted rates match the contract rate schedule within tolerance.',
      fieldPath: 'lineItems[0].unitPrice',
      severity: (isLowConf && i % 3 === 0) ? 'ERROR' : (isMedConf && i % 4 === 0) ? 'WARNING' : 'INFO',
      expectedValue: `AUD ${netAmount.toLocaleString()} (per contract schedule)`,
      actualValue: (isLowConf && i % 3 === 0)
        ? `AUD ${Math.round(netAmount * 1.15).toLocaleString()}`
        : (isMedConf && i % 4 === 0)
          ? `AUD ${Math.round(netAmount * 1.052).toLocaleString()}`
          : `AUD ${netAmount.toLocaleString()}`,
      matchedAgainst: `Contract ${cNum} Rate Schedule`,
      details: `Compared line item unit prices against the rate card defined in contract ${cNum}. Tolerance: 5% for WARNING, 10% for FAIL.`,
    },
    {
      ruleId: 'BRC-004',
      ruleName: 'Tax Validation - GST',
      description: 'Validate GST = total tax amount, and correct tax rate (10%) is applied.',
      status: (i % 13 === 0 || i === 3) ? 'FAIL' : 'PASS',
      message: (i % 13 === 0 || i === 3)
        ? `Tax mismatch: GST (AUD ${(taxAmount + 150).toLocaleString()}) != expected AUD ${taxAmount.toLocaleString()}.`
        : `GST validation passed. GST AUD ${taxAmount.toLocaleString()} at 10%.`,
      fieldPath: 'headerData.taxAmount',
      severity: (i % 13 === 0 || i === 3) ? 'ERROR' : 'INFO',
      expectedValue: `GST = AUD ${taxAmount.toLocaleString()} (10% of net)`,
      actualValue: (i % 13 === 0 || i === 3)
        ? `GST AUD ${(taxAmount + 150).toLocaleString()}`
        : `GST AUD ${taxAmount.toLocaleString()}`,
      matchedAgainst: 'GST Tax Rules (Tax Code GST10)',
      details: 'Validated tax amount matches expected GST rate of 10%. Verified GST component equals the total tax amount.',
    },
    {
      ruleId: 'BRC-005',
      ruleName: 'Invoice Date Validation',
      description: 'Invoice date must not be in the future. Backdated invoices (>30 days) are flagged.',
      status: (i % 9 === 0) ? 'WARNING' : 'PASS',
      message: (i % 9 === 0)
        ? `Invoice is ${Math.floor(hoursAgo / 24) + 30} days old. Backdated invoices require additional review.`
        : `Invoice date ${createdDate.toISOString().split('T')[0]} is valid and within acceptable range.`,
      fieldPath: 'headerData.invoiceDate',
      severity: (i % 9 === 0) ? 'WARNING' : 'INFO',
      expectedValue: 'Within last 30 days, not in future',
      actualValue: createdDate.toISOString().split('T')[0],
      matchedAgainst: 'System Date Policy',
      details: (i % 9 === 0)
        ? 'Invoice date is more than 30 days before submission. Backdated invoices are permitted but require agent confirmation.'
        : 'Invoice date falls within the acceptable window. No future-dating detected.',
    },
    {
      ruleId: 'BRC-006',
      ruleName: 'Vendor Status Check',
      description: 'Vendor must be active in the vendor master database.',
      status: vendor.isActive ? 'PASS' : 'FAIL',
      message: vendor.isActive
        ? `Vendor ${vendor.name} (${vendor.vendorNumber}) is active in vendor master.`
        : `Vendor ${vendor.name} (${vendor.vendorNumber}) is INACTIVE. Invoice cannot be processed.`,
      fieldPath: 'vendorId',
      severity: vendor.isActive ? 'INFO' : 'ERROR',
      expectedValue: 'Active',
      actualValue: vendor.isActive ? 'Active' : 'Inactive',
      matchedAgainst: `Vendor Master (${vendor.vendorNumber})`,
      details: `Checked vendor ${vendor.name} in vendor master. Number: ${vendor.vendorNumber}, Tax ID: ${vendor.taxId}, Payment Terms: ${vendor.paymentTerms}.`,
    },
    {
      ruleId: 'BRC-007',
      ruleName: 'Contract Status Check',
      description: 'Contract must be active (not expired) at the time of invoice submission.',
      status: contract?.isActive ? 'PASS' : contract ? 'FAIL' : 'WARNING',
      message: contract?.isActive
        ? `Contract ${cNum} is active. Valid ${contract.startDate} to ${contract.endDate}.`
        : contract
          ? `Contract ${cNum} is EXPIRED (ended ${contract.endDate}).`
          : 'No matching contract found for this vendor and category.',
      fieldPath: 'contractNumber',
      severity: contract?.isActive ? 'INFO' : contract ? 'ERROR' : 'WARNING',
      expectedValue: 'Active contract',
      actualValue: contract?.isActive ? 'Active' : contract ? 'Expired' : 'Not found',
      matchedAgainst: contract ? `Contract ${cNum}` : 'Contract Master',
      details: contract
        ? `Contract ${cNum} for ${category}: ${contract.startDate} to ${contract.endDate}, Max AUD ${contract.maxAmount.toLocaleString()}. Status: ${contract.isActive ? 'Active' : 'Expired'}.`
        : `No contract found for vendor ${vendor.name} and category ${category}.`,
    },
    {
      ruleId: 'BRC-008',
      ruleName: 'Line Item Total Match',
      description: 'Sum of line item amounts must equal invoice net total (within 1% tolerance).',
      status: (isLowConf && i % 5 === 0) ? 'FAIL' : 'PASS',
      message: (isLowConf && i % 5 === 0)
        ? `Line item sum (AUD ${Math.round(netAmount * 0.94).toLocaleString()}) differs from net total (AUD ${netAmount.toLocaleString()}) by 6%.`
        : `Line item total (AUD ${netAmount.toLocaleString()}) matches invoice net amount.`,
      fieldPath: 'lineItems',
      severity: (isLowConf && i % 5 === 0) ? 'ERROR' : 'INFO',
      expectedValue: `AUD ${netAmount.toLocaleString()} (invoice net total)`,
      actualValue: (isLowConf && i % 5 === 0)
        ? `AUD ${Math.round(netAmount * 0.94).toLocaleString()}`
        : `AUD ${netAmount.toLocaleString()}`,
      matchedAgainst: 'Invoice Header vs Line Items',
      details: (isLowConf && i % 5 === 0)
        ? 'Line item sum vs net total mismatch exceeds 1% tolerance. Likely OCR extraction error.'
        : 'All line item amounts sum correctly to the invoice net total within tolerance.',
    },
    {
      ruleId: 'BRC-009',
      ruleName: 'Currency Validation',
      description: 'Invoice currency must match the vendor/contract default currency.',
      status: (i % 17 === 0) ? 'WARNING' : 'PASS',
      message: (i % 17 === 0)
        ? 'Currency mismatch: Invoice currency USD does not match vendor default AUD.'
        : 'Invoice currency AUD matches vendor and contract currency.',
      fieldPath: 'headerData.currency',
      severity: (i % 17 === 0) ? 'WARNING' : 'INFO',
      expectedValue: 'AUD',
      actualValue: (i % 17 === 0) ? 'USD' : 'AUD',
      matchedAgainst: `Vendor Master (${vendor.vendorNumber}) & Contract ${cNum}`,
      details: (i % 17 === 0)
        ? 'Invoice is in USD but vendor default is AUD. May require FX conversion and manager approval.'
        : 'Currency matches vendor default (AUD) and contract currency.',
    },
    {
      ruleId: 'BRC-010',
      ruleName: 'Required Fields Check',
      description: 'All mandatory fields must be present: invoice number, date, amount, vendor name.',
      status: (isLowConf && i % 7 === 0) ? 'FAIL' : 'PASS',
      message: (isLowConf && i % 7 === 0)
        ? 'Missing required field: Purchase Order Number is empty for this invoice.'
        : 'All required fields are present and populated.',
      fieldPath: (isLowConf && i % 7 === 0) ? 'headerData.purchaseOrderNumber' : 'headerData',
      severity: (isLowConf && i % 7 === 0) ? 'ERROR' : 'INFO',
      expectedValue: 'All mandatory fields populated',
      actualValue: (isLowConf && i % 7 === 0) ? 'purchaseOrderNumber: (empty)' : 'All fields present',
      matchedAgainst: 'Field Requirement Rules',
      details: `Checked: invoiceNumber (INV-${2025000 + i}), invoiceDate (${createdDate.toISOString().split('T')[0]}), totalAmount (AUD ${totalAmount.toLocaleString()}), vendorName (${vendor.name}). ${(isLowConf && i % 7 === 0) ? 'PO number required but not extracted.' : 'All mandatory fields present.'}`,
    },
    {
      ruleId: 'BRC-011',
      ruleName: 'Arithmetic Validation',
      description: 'Verify Net + Tax = Total, and Qty x Rate = Line Amount for all line items.',
      status: (i % 15 === 0) ? 'FAIL' : 'PASS',
      message: (i % 15 === 0)
        ? `Arithmetic error: Net + Tax = AUD ${(netAmount + taxAmount).toLocaleString()}, but total shows AUD ${(totalAmount + 500).toLocaleString()}.`
        : `Arithmetic validated: Net + Tax = Total (AUD ${totalAmount.toLocaleString()}). All line items correct.`,
      fieldPath: 'headerData.totalAmount',
      severity: (i % 15 === 0) ? 'ERROR' : 'INFO',
      expectedValue: `Net + Tax = AUD ${totalAmount.toLocaleString()}`,
      actualValue: (i % 15 === 0)
        ? `AUD ${(totalAmount + 500).toLocaleString()} (off by AUD 500)`
        : `AUD ${totalAmount.toLocaleString()}`,
      matchedAgainst: 'Invoice Arithmetic Rules',
      details: (i % 15 === 0)
        ? 'Checks: (1) Net + Tax = Total, (2) Qty x Rate = Line Total, (3) Sum of line taxes = header tax. Discrepancy of AUD 500 found.'
        : 'All arithmetic checks passed: Net + Tax = Total, line item Qty x Rate verified.',
    },
    {
      ruleId: 'BRC-012',
      ruleName: 'GL Account Validation',
      description: 'GL account must exist in the GL master for the given expense category.',
      status: (i % 19 === 0) ? 'FAIL' : 'PASS',
      message: (i % 19 === 0)
        ? 'GL Account 999999 not found in GL master for company code JC01.'
        : `GL Account ${CATEGORY_GL[category] ?? '500100'} is valid for ${category.toLowerCase().replace(/_/g, ' ')} expenses.`,
      fieldPath: 'headerData.glAccount',
      severity: (i % 19 === 0) ? 'ERROR' : 'INFO',
      expectedValue: `Valid GL account for ${category} category`,
      actualValue: (i % 19 === 0) ? '999999 (not found)' : `${CATEGORY_GL[category] ?? '500100'} - ${category.toLowerCase().replace(/_/g, ' ')} expenses`,
      matchedAgainst: 'GL Account Master (Company Code JC01)',
      details: (i % 19 === 0)
        ? `GL 999999 not in chart of accounts for JC01. Expected for ${category}: ${CATEGORY_GL[category] ?? '500100'}-range.`
        : 'GL Account validated. Type: EXPENSE. Active and mapped to correct category.',
    },
    {
      ruleId: 'BRC-013',
      ruleName: 'Cost Center Validation',
      description: 'Cost center must be valid and active in the organizational structure.',
      status: (i % 21 === 0) ? 'FAIL' : 'PASS',
      message: (i % 21 === 0)
        ? 'Cost center CC9999 not found in organizational master data.'
        : 'Cost center CC1001 (Facilities Management) is valid and active.',
      fieldPath: 'headerData.costCenter',
      severity: (i % 21 === 0) ? 'ERROR' : 'INFO',
      expectedValue: 'Valid and active cost center',
      actualValue: (i % 21 === 0) ? 'CC9999 (not found)' : 'CC1001 - Facilities Management',
      matchedAgainst: 'Cost Center Master (Company Code JC01)',
      details: (i % 21 === 0)
        ? 'CC9999 not in org hierarchy for JC01. May be an extraction error or deactivated center.'
        : 'CC1001 is active under Operations. Budget allocation verified for current fiscal period.',
    },
  ];
}

function generateMockCases(): Case[] {
  const categories: Case['category'][] = ['SUBCONTRACTOR', 'RUST_SUBCONTRACTOR', 'DELIVERY_INSTALLATION', 'FREIGHT_FINISHED_GOODS', 'FREIGHT_SPARE_PARTS', 'FREIGHT_ADDITIONAL_CHARGES'];

  const vendors = mockVendors.filter((v) => v.isActive);

  const now = Date.now();

  const cases: Case[] = [];

  for (let i = 1; i <= 25; i++) {
    const vendor = vendors[i % vendors.length];
    const category = categories[i % categories.length];
    const status = CASE_STATUS_ASSIGNMENTS[i - 1];
    const contract = vendor.contracts.find((c) => c.category === category) ?? vendor.contracts[0];
    const totalAmount = CASE_AMOUNTS[i - 1];
    const taxAmount = Math.round(totalAmount * 0.10);
    const netAmount = totalAmount - taxAmount;
    const overallConfidence = CASE_CONFIDENCES[i - 1];
    const confidenceLevel: Case['overallConfidenceLevel'] =
      overallConfidence >= 0.85 ? 'HIGH' : overallConfidence >= 0.7 ? 'MEDIUM' : 'LOW';

    // Deterministic timestamps: cases spread across the last 1-5 days
    const hoursAgo = i * 4 + (i % 3) * 2;
    const createdDate = new Date(now - hoursAgo * 60 * 60 * 1000);

    // SLA deadline: most cases get future deadlines.
    // Cases where i % 6 === 0 get past deadlines to represent real breaches.
    const isActualSlaBreach = i % 6 === 0;
    const slaDate = isActualSlaBreach
      ? new Date(now - (3 + (i % 5) * 2) * 60 * 60 * 1000)
      : new Date(now + (24 + (i % 7) * 8) * 60 * 60 * 1000);

    // updatedAt: a few hours after creation
    const updatedDate = new Date(createdDate.getTime() + (1 + (i % 4)) * 60 * 60 * 1000);

    // returnedAt / rejectedAt / postedAt: within the last 1-2 days
    const actionDate = new Date(now - (2 + (i % 5) * 7) * 60 * 60 * 1000);

    // Approvers for this case
    const primaryApprover = APPROVER_POOL[i % APPROVER_POOL.length];
    const secondaryApprover = APPROVER_POOL[(i + 1) % APPROVER_POOL.length];
    const assignedAgent = getAssignedAgent(i);

    const caseItem: Case = {
      id: `CASE-${String(i).padStart(4, '0')}`,
      status,
      category,
      email: {
        from: `invoices@${vendor.name.toLowerCase().replace(/\s+/g, '').slice(0, 12)}.com.au`,
        to: 'ap-invoices@johnsoncontrols.com.au',
        subject: `Invoice #INV-${2025000 + i} from ${vendor.name}`,
        receivedAt: createdDate.toISOString(),
        body: `Please find attached invoice #INV-${2025000 + i} for ${category.toLowerCase()} services rendered as per contract ${contract?.contractNumber ?? 'N/A'}.`,
        attachmentCount: (category === 'SUBCONTRACTOR' || category === 'DELIVERY_INSTALLATION') ? 3 : (category === 'RUST_SUBCONTRACTOR') ? 2 : 1,
      },
      attachments: [
        {
          id: `ATT-${i}-1`,
          fileName: `INV-${2025000 + i}.pdf`,
          fileType: 'PDF',
          fileSize: 120000 + Math.floor(Math.random() * 80000),
          fileUrl: `/mock/invoices/INV-${2025000 + i}.pdf`,
          documentType: 'INVOICE',
          isMainInvoice: true,
          uploadedAt: createdDate.toISOString(),
        },
        // Subcontractor, Rust, and D&I cases always have a job sheet attached
        ...((category === 'SUBCONTRACTOR' || category === 'RUST_SUBCONTRACTOR' || category === 'DELIVERY_INSTALLATION') ? [{
          id: `ATT-${i}-2`,
          fileName: `JobSheet-${2025000 + i}.pdf`,
          fileType: 'PDF' as const,
          fileSize: 85000 + Math.floor(Math.random() * 40000),
          fileUrl: `/mock/jobsheets/JobSheet-${2025000 + i}.pdf`,
          documentType: 'JOB_SHEET' as const,
          isMainInvoice: false,
          uploadedAt: createdDate.toISOString(),
        }] : []),
        // Subcontractor and D&I cases also have a supporting doc
        ...((category === 'SUBCONTRACTOR' || category === 'DELIVERY_INSTALLATION') ? [{
          id: `ATT-${i}-3`,
          fileName: `DeliveryNote-DN-${6000 + i}.pdf`,
          fileType: 'PDF' as const,
          fileSize: 45000 + Math.floor(Math.random() * 20000),
          fileUrl: `/mock/supporting/DN-${6000 + i}.pdf`,
          documentType: 'SUPPORTING' as const,
          isMainInvoice: false,
          uploadedAt: createdDate.toISOString(),
        }] : []),
      ],
      headerData: {
        invoiceNumber: `INV-${2025000 + i}`,
        invoiceDate: createdDate.toISOString().split('T')[0],
        dueDate: new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        invoiceType: (['STANDARD', 'STANDARD', 'STANDARD', 'CREDIT_NOTE', 'RECURRING'] as const)[i % 5],
        currency: 'AUD',
        totalAmount,
        taxAmount,
        netAmount,
        purchaseOrderNumber: (category === 'SUBCONTRACTOR' || category === 'DELIVERY_INSTALLATION') ? `PO-${4000 + i}` : '',
        deliveryNoteNumber: (category === 'DELIVERY_INSTALLATION') ? `DN-${6000 + i}` : '',
        paymentTerms: vendor.paymentTerms,
        companyCode: 'JC01',
        plantCode: 'P1001',
        costCenter: 'CC1001',
        glAccount: CATEGORY_GL[category] ?? '500100',
        taxCode: 'GST10',
        description: `${category.toLowerCase().replace(/_/g, ' ')} invoice from ${vendor.name}`,
      },
      lineItems: (i === 2 || i === 4 || i === 5) ? [
        {
          id: `LI-${i}-1`,
          lineNumber: 1,
          description: `${category.toLowerCase().replace(/_/g, ' ')} service - Period ${createdDate.toISOString().split('T')[0]}`,
          quantity: 1,
          unitPrice: Math.round(netAmount * 0.6),
          unit: 'EA',
          totalAmount: Math.round(netAmount * 0.6),
          taxAmount: Math.round(taxAmount * 0.6),
          glAccount: CATEGORY_GL[category] ?? '500100',
          costCenter: 'CC1001',
        },
        {
          id: `LI-${i}-2`,
          lineNumber: 2,
          description: `Equipment maintenance - ${createdDate.toISOString().split('T')[0]}`,
          quantity: 1,
          unitPrice: netAmount - Math.round(netAmount * 0.6),
          unit: 'EA',
          totalAmount: netAmount - Math.round(netAmount * 0.6),
          taxAmount: taxAmount - Math.round(taxAmount * 0.6),
          glAccount: CATEGORY_GL[category] ?? '500200',
          costCenter: 'CC1002',
        },
      ] : [
        {
          id: `LI-${i}-1`,
          lineNumber: 1,
          description: `${category.toLowerCase().replace(/_/g, ' ')} service - Period ${createdDate.toISOString().split('T')[0]}`,
          quantity: 1,
          unitPrice: netAmount,
          unit: 'EA',
          totalAmount: netAmount,
          taxAmount,
          glAccount: CATEGORY_GL[category] ?? '500100',
          costCenter: 'CC1001',
        },
      ],
      confidenceScores: {
        invoiceNumber: { value: 0.95, level: 'HIGH', extractedValue: `INV-${2025000 + i}` },
        invoiceDate: { value: 0.92, level: 'HIGH', extractedValue: createdDate.toISOString().split('T')[0] },
        totalAmount: { value: overallConfidence, level: confidenceLevel, extractedValue: String(totalAmount) },
        vendorName: { value: 0.88, level: 'HIGH', extractedValue: vendor.name },
      },
      overallConfidence: Math.round(overallConfidence * 100) / 100,
      overallConfidenceLevel: confidenceLevel,
      vendorId: vendor.id,
      vendorName: vendor.name,
      vendorNumber: vendor.vendorNumber,
      contractNumber: contract?.contractNumber ?? null,
      contractStatus: contract ? (contract.isActive ? 'ACTIVE' : 'EXPIRED') : null,
      businessRuleResults: generateBusinessRules(i, overallConfidence, totalAmount, taxAmount, netAmount, contract, vendor, category, hoursAgo, createdDate, now),
      approvalChain: (() => {
        // Generate approval chains for cases that have been through or are in approval
        const chainStatuses = ['APPROVAL_PENDING', 'APPROVED', 'POSTED', 'CLOSED', 'RETURNED', 'REJECTED'];
        if (!chainStatuses.includes(status)) return null;

        // Some cases get multi-step chains
        const isMultiStep = totalAmount > 200000 || i % 4 === 0;

        // decidedAt: a few hours after case creation (recent)
        const step1DecidedAt = new Date(createdDate.getTime() + (2 + (i % 4)) * 60 * 60 * 1000);
        const step2DecidedAt = new Date(step1DecidedAt.getTime() + (1 + (i % 3)) * 60 * 60 * 1000);

        const isComplete = ['APPROVED', 'POSTED', 'CLOSED'].includes(status);
        const isReturned = status === 'RETURNED';
        const isRejected = status === 'REJECTED';

        const returnComments = [
          'Invoice amount does not match the purchase order. Please verify line item totals and resubmit.',
          'Vendor bank details have changed since last payment. Please confirm with the vendor and update accordingly.',
          'Missing supporting documentation — job sheet not attached. Please attach and resubmit.',
          'Cost center allocation appears incorrect. Please check with the project manager.',
          'Tax calculation discrepancy found. GST amount does not match the expected total.',
        ];
        const rejectComments = [
          'This is a duplicate invoice submission. Original was already processed under a different case.',
          'Invoice is from an unapproved vendor. Cannot process until vendor onboarding is complete.',
          'Services were not delivered as per the contract terms. Rejecting based on project team feedback.',
        ];

        const steps: ApprovalStep[] = [];

        // All chains have minimum 2 approvers
        steps.push({
          stepNumber: 1,
          approverId: primaryApprover.id,
          approverName: primaryApprover.name,
          approverRole: primaryApprover.role,
          status: isReturned ? 'RETURNED' : isRejected ? 'REJECTED' : 'APPROVED',
          decision: isReturned ? 'SEND_BACK' : isRejected ? 'REJECT' : 'APPROVE',
          comment: isReturned ? returnComments[i % returnComments.length]
            : isRejected ? rejectComments[i % rejectComments.length]
            : 'Verified invoice data, forwarding to next approver.',
          decidedAt: step1DecidedAt.toISOString(),
        });
        steps.push({
          stepNumber: 2,
          approverId: secondaryApprover.id,
          approverName: secondaryApprover.name,
          approverRole: secondaryApprover.role,
          status: isComplete ? 'APPROVED' : isReturned || isRejected ? 'SKIPPED' : 'PENDING',
          decision: isComplete ? 'APPROVE' : null,
          comment: isComplete ? 'All verified. Approved.' : null,
          decidedAt: isComplete ? step2DecidedAt.toISOString() : null,
        });

        // Some high-value cases get a 3rd approver
        if (isMultiStep && totalAmount > 300000) {
          const tertiaryApprover = APPROVER_POOL[(i + 2) % APPROVER_POOL.length];
          const step3DecidedAt = new Date(step2DecidedAt.getTime() + (1 + (i % 2)) * 60 * 60 * 1000);
          steps.push({
            stepNumber: 3,
            approverId: tertiaryApprover.id,
            approverName: tertiaryApprover.name,
            approverRole: tertiaryApprover.role,
            status: isComplete ? 'APPROVED' : isReturned || isRejected ? 'SKIPPED' : 'PENDING',
            decision: isComplete ? 'APPROVE' : null,
            comment: isComplete ? 'Final approval granted.' : null,
            decidedAt: isComplete ? step3DecidedAt.toISOString() : null,
          });
        }

        const chainStatus = isComplete ? 'APPROVED' as const
          : isReturned ? 'RETURNED' as const
          : isRejected ? 'REJECTED' as const
          : 'PENDING' as const;

        return {
          id: `AC-${i}`,
          caseId: `CASE-${String(i).padStart(4, '0')}`,
          steps,
          currentStepIndex: isComplete ? steps.length : isReturned || isRejected ? 0 : 1,
          status: chainStatus,
          createdAt: createdDate.toISOString(),
          completedAt: isComplete ? step2DecidedAt.toISOString() : null,
        };
      })(),
      assignedAgentId: assignedAgent.id,
      assignedAgentName: assignedAgent.name,
      lockedBy: null,
      lockedAt: null,
      createdAt: createdDate.toISOString(),
      updatedAt: updatedDate.toISOString(),
      slaDeadline: slaDate.toISOString(),
      isSlaBreach: slaDate.getTime() < now,
      sapDocumentNumber: status === 'POSTED' ? `SAP-${9000000 + i}` : null,
      postedAt: status === 'POSTED' ? actionDate.toISOString() : null,
      returnedBy: status === 'RETURNED' ? primaryApprover.id : null,
      returnedByName: status === 'RETURNED' ? primaryApprover.name : null,
      returnReason: status === 'RETURNED' ? 'Invoice amount does not match PO. Please verify.' : null,
      returnedAt: status === 'RETURNED' ? actionDate.toISOString() : null,
      returnedFromStep: status === 'RETURNED' ? 1 : null,
      rejectedBy: status === 'REJECTED' ? primaryApprover.id : null,
      rejectedByName: status === 'REJECTED' ? primaryApprover.name : null,
      rejectionReason: status === 'REJECTED' ? 'Duplicate invoice submission.' : null,
      rejectedAt: status === 'REJECTED' ? actionDate.toISOString() : null,
      poType: i % 5 < 3 ? 'PO' : 'NON_PO',
      entity: i % 7 < 5 ? 'AU' : 'NZ',
      isRead: i % 10 < 7,
    };

    cases.push(caseItem);
  }

  return cases;
}

function generateMockAuditLogs(): AuditLogEntry[] {
  const entries: AuditLogEntry[] = [];
  let entryIndex = 0;
  const now = Date.now();

  const categories: Case['category'][] = ['SUBCONTRACTOR', 'RUST_SUBCONTRACTOR', 'DELIVERY_INSTALLATION', 'FREIGHT_FINISHED_GOODS', 'FREIGHT_SPARE_PARTS', 'FREIGHT_ADDITIONAL_CHARGES'];
  const activeVendors = mockVendors.filter((v) => v.isActive);

  type StepDef = {
    action: AuditLogEntry['action'];
    category: AuditLogEntry['category'];
    desc: string;
    byName: string;
    byId: string;
    byRole: AuditLogEntry['performedByRole'];
    offsetMin: number;
    metadata?: Record<string, unknown>;
  };

  for (let i = 1; i <= 25; i++) {
    const caseId = `CASE-${String(i).padStart(4, '0')}`;
    const status = CASE_STATUS_ASSIGNMENTS[i - 1];
    const category = categories[i % categories.length];
    const vendor = activeVendors[i % activeVendors.length];
    const contract = vendor.contracts.find((c) => c.category === category) ?? vendor.contracts[0];
    const primaryApprover = APPROVER_POOL[i % APPROVER_POOL.length];
    const secondaryApprover = APPROVER_POOL[(i + 1) % APPROVER_POOL.length];
    const agent = getAssignedAgent(i);

    // Base time aligned with case creation
    const hoursAgo = i * 4 + (i % 3) * 2;
    const baseDate = new Date(now - hoursAgo * 60 * 60 * 1000);

    // Build steps progressively based on case status
    const steps: StepDef[] = [];

    // -- Steps 1-6: Always present (system intake pipeline) --
    steps.push(
      { action: 'EMAIL_RECEIVED', category: 'SYSTEM', desc: `Email received from ${vendor.name}. Subject: "Invoice #INV-${2025000 + i}". ${(category === 'SUBCONTRACTOR' || category === 'DELIVERY_INSTALLATION') ? '3 attachments' : category === 'RUST_SUBCONTRACTOR' ? '2 attachments' : '1 attachment'} detected.`, byName: 'System', byId: 'system', byRole: 'SYSTEM', offsetMin: 0 },
      { action: 'EMAIL_CLASSIFIED', category: 'SYSTEM', desc: 'Email classified as Invoice submission by LLM classifier (confidence: 94.2%). Non-invoice probability: 5.8%.', byName: 'System', byId: 'system', byRole: 'SYSTEM', offsetMin: 1 },
      { action: 'EMAIL_CATEGORIZED', category: 'SYSTEM', desc: `Invoice sub-categorized as ${category} by LLM (confidence: ${(88 + (i % 10)).toFixed(1)}%). Category determined from invoice content and vendor profile.`, byName: 'System', byId: 'system', byRole: 'SYSTEM', offsetMin: 2 },
      { action: 'DATA_EXTRACTED', category: 'SYSTEM', desc: `OCR + AI extraction completed. ${(category === 'SUBCONTRACTOR' || category === 'DELIVERY_INSTALLATION') ? '15' : '12'} fields extracted from invoice PDF. Overall extraction confidence: ${(72 + (i % 25)).toFixed(0)}%.`, byName: 'System', byId: 'system', byRole: 'SYSTEM', offsetMin: 4 },
      { action: 'VENDOR_MATCHED', category: 'SYSTEM', desc: `Vendor identified and matched: ${vendor.name} (${vendor.vendorNumber}). Match confidence: 96.5%. Tax ID verified: ${vendor.taxId}.`, byName: 'System', byId: 'system', byRole: 'SYSTEM', offsetMin: 5 },
      { action: 'CONTRACT_MATCHED', category: 'SYSTEM', desc: `Contract matched: ${contract?.contractNumber ?? 'N/A'} (${category}). ${contract?.isActive ? `Active until ${contract.endDate}. Max amount: AUD ${contract.maxAmount.toLocaleString()}.` : contract ? `EXPIRED on ${contract.endDate}.` : 'No matching contract found.'}`, byName: 'System', byId: 'system', byRole: 'SYSTEM', offsetMin: 6 },
    );

    // -- Step 7: Business Rules Executed --
    if (!['RECEIVED', 'CLASSIFIED', 'CATEGORIZED'].includes(status)) {
      steps.push(
        { action: 'BUSINESS_RULE_RUN', category: 'SYSTEM', desc: `Business rules executed: 13 rules evaluated. Results will vary by case data quality and vendor/contract status.`, byName: 'System', byId: 'system', byRole: 'SYSTEM', offsetMin: 7 },
      );
    }

    // -- Step 8: Agent Assigned --
    if (!['EXTRACTED'].includes(status)) {
      steps.push(
        { action: 'AGENT_ASSIGNED', category: 'SYSTEM', desc: `Case auto-assigned to ${agent.name} (AP Agent) based on workload balancing and category expertise.`, byName: 'System', byId: 'system', byRole: 'SYSTEM', offsetMin: 10 },
      );
    }

    // -- Step 9: Agent Review Started --
    if (['IN_REVIEW', 'VALIDATED', 'APPROVAL_PENDING', 'APPROVED', 'POSTED', 'REJECTED', 'RETURNED', 'DISCARDED'].includes(status)) {
      steps.push(
        { action: 'AGENT_REVIEW_STARTED', category: 'AGENT', desc: 'Agent opened the case and started review of extracted data. Invoice document viewed.', byName: agent.name, byId: agent.id, byRole: 'AP_AGENT', offsetMin: 90 },
      );
    }

    // -- Step 10: Agent Data Validated --
    if (['VALIDATED', 'APPROVAL_PENDING', 'APPROVED', 'POSTED', 'REJECTED', 'RETURNED'].includes(status)) {
      steps.push(
        { action: 'AGENT_DATA_VALIDATED', category: 'AGENT', desc: 'Agent confirmed extracted data accuracy. Header fields verified against invoice document. Line items cross-checked.', byName: agent.name, byId: agent.id, byRole: 'AP_AGENT', offsetMin: 105 },
      );

      // Some cases have field edits
      if (i % 3 === 0) {
        steps.push(
          { action: 'FIELD_EDITED', category: 'AGENT', desc: 'Agent corrected cost center from CC1003 to CC1001 based on department allocation.', byName: agent.name, byId: agent.id, byRole: 'AP_AGENT', offsetMin: 108, metadata: { fieldName: 'costCenter', oldValue: 'CC1003', newValue: 'CC1001' } },
        );
      }
      if (i % 5 === 0) {
        steps.push(
          { action: 'FIELD_EDITED', category: 'AGENT', desc: 'Agent corrected GL account based on invoice category.', byName: agent.name, byId: agent.id, byRole: 'AP_AGENT', offsetMin: 110, metadata: { fieldName: 'glAccount', oldValue: '400300', newValue: '400100' } },
        );
      }
    }

    // -- Step 11: Draft Saved (some cases) --
    if (['VALIDATED', 'APPROVAL_PENDING', 'APPROVED', 'POSTED'].includes(status) && i % 4 === 0) {
      steps.push(
        { action: 'DRAFT_SAVED', category: 'AGENT', desc: 'Agent saved draft with corrected data. Changes include updated line items and cost center allocation.', byName: agent.name, byId: agent.id, byRole: 'AP_AGENT', offsetMin: 115 },
      );
    }

    // -- Step 12: Business Rules Re-run (after agent edits) --
    if (['VALIDATED', 'APPROVAL_PENDING', 'APPROVED', 'POSTED'].includes(status) && i % 3 === 0) {
      steps.push(
        { action: 'BUSINESS_RULE_RERUN', category: 'SYSTEM', desc: 'Business rules re-executed after agent edits. 13 rules re-evaluated with updated data.', byName: 'System', byId: 'system', byRole: 'SYSTEM', offsetMin: 118 },
      );
    }

    // -- Step 13: Submitted for Approval / Data Confirmed --
    if (['APPROVAL_PENDING', 'APPROVED', 'POSTED', 'REJECTED', 'RETURNED'].includes(status)) {
      steps.push(
        { action: 'DATA_CONFIRMED', category: 'AGENT', desc: 'Agent clicked Save & Confirm. All extracted data validated and locked for approval workflow.', byName: agent.name, byId: agent.id, byRole: 'AP_AGENT', offsetMin: 120 },
        { action: 'SUBMITTED_FOR_APPROVAL', category: 'AGENT', desc: `Case submitted for approval. Invoice amount: AUD ${CASE_AMOUNTS[i - 1].toLocaleString()}.`, byName: agent.name, byId: agent.id, byRole: 'AP_AGENT', offsetMin: 121 },
      );
    }

    // -- Step 14: Approval Chain Created --
    if (['APPROVAL_PENDING', 'APPROVED', 'POSTED', 'REJECTED', 'RETURNED'].includes(status)) {
      const isMultiStep = i % 4 === 0 || (10000 + (i * 19000) % 490000) > 200000;
      steps.push(
        { action: 'APPROVAL_CHAIN_CREATED', category: 'SYSTEM', desc: `Approval chain created with ${isMultiStep ? '2-3' : '2'} steps based on invoice amount and category rules.`, byName: 'System', byId: 'system', byRole: 'SYSTEM', offsetMin: 122 },
      );

      // -- Step 15: Sent to Approver 1 --
      steps.push(
        { action: 'SENT_TO_APPROVER', category: 'SYSTEM', desc: `Notification sent to ${primaryApprover.name} (Step 1). Email and in-app notification dispatched.`, byName: 'System', byId: 'system', byRole: 'SYSTEM', offsetMin: 123 },
      );
    }

    // -- Steps 16-17: Approver 1 reviewed and decided --
    if (['APPROVED', 'POSTED', 'REJECTED', 'RETURNED'].includes(status)) {
      steps.push(
        { action: 'AGENT_REVIEW_STARTED', category: 'APPROVER', desc: `${primaryApprover.name} opened the case for review. Invoice and supporting documents viewed.`, byName: primaryApprover.name, byId: primaryApprover.id, byRole: 'AP_REVIEWER', offsetMin: 180 },
      );

      if (status === 'RETURNED') {
        steps.push(
          { action: 'RETURNED', category: 'APPROVER', desc: `${primaryApprover.name} returned the case to agent. Reason: Invoice amount does not match PO. Please verify.`, byName: primaryApprover.name, byId: primaryApprover.id, byRole: 'AP_REVIEWER', offsetMin: 195 },
        );
      } else if (status === 'REJECTED') {
        steps.push(
          { action: 'REJECTED', category: 'APPROVER', desc: `${primaryApprover.name} rejected the case. Reason: Duplicate invoice submission.`, byName: primaryApprover.name, byId: primaryApprover.id, byRole: 'AP_REVIEWER', offsetMin: 195 },
        );
      } else {
        // Approved at step 1
        steps.push(
          { action: 'APPROVED', category: 'APPROVER', desc: `${primaryApprover.name} approved (Step 1). Comment: "Verified invoice data, forwarding to next approver."`, byName: primaryApprover.name, byId: primaryApprover.id, byRole: 'AP_REVIEWER', offsetMin: 195 },
        );

        // -- Step 18: Sent to Approver 2 --
        steps.push(
          { action: 'SENT_TO_APPROVER', category: 'SYSTEM', desc: `Notification sent to ${secondaryApprover.name} (Step 2). Email and in-app notification dispatched.`, byName: 'System', byId: 'system', byRole: 'SYSTEM', offsetMin: 196 },
        );

        // -- Step 19: Approver 2 Decision --
        if (['APPROVED', 'POSTED'].includes(status)) {
          steps.push(
            { action: 'APPROVED', category: 'APPROVER', desc: `${secondaryApprover.name} approved (Step 2). Comment: "All verified. Approved."`, byName: secondaryApprover.name, byId: secondaryApprover.id, byRole: 'AP_REVIEWER', offsetMin: 260 },
          );
        }
      }
    }

    // -- Step 20: Posted to SAP --
    if (status === 'POSTED') {
      steps.push(
        { action: 'POSTED_TO_SAP', category: 'SYSTEM', desc: `Invoice posted to SAP. Document number: SAP-${9000000 + i}. Accounting entry created in company code JC01.`, byName: 'System', byId: 'system', byRole: 'SYSTEM', offsetMin: 270 },
      );
    }

    // -- Step 21: Case Closed --
    if (status === 'POSTED') {
      steps.push(
        { action: 'CASE_CLOSED', category: 'SYSTEM', desc: 'Case automatically closed after successful SAP posting. Payment scheduled per vendor terms.', byName: 'System', byId: 'system', byRole: 'SYSTEM', offsetMin: 271 },
      );
    }

    // -- Discarded case --
    if (status === 'DISCARDED') {
      steps.push(
        { action: 'CASE_DISCARDED', category: 'AGENT', desc: 'Case discarded by agent. Non-invoice email or duplicate submission.', byName: agent.name, byId: agent.id, byRole: 'AP_AGENT', offsetMin: 95 },
      );
    }

    // Push all steps as entries
    for (const step of steps) {
      entryIndex++;
      const entry: AuditLogEntry = {
        id: `AUD-${String(entryIndex).padStart(5, '0')}`,
        caseId,
        action: step.action,
        category: step.category,
        description: step.desc,
        performedBy: step.byId,
        performedByName: step.byName,
        performedByRole: step.byRole,
        timestamp: new Date(baseDate.getTime() + step.offsetMin * 60 * 1000).toISOString(),
      };
      if (step.metadata) {
        entry.metadata = step.metadata;
        if (step.metadata.fieldName) entry.fieldName = step.metadata.fieldName as string;
        if (step.metadata.oldValue) entry.oldValue = step.metadata.oldValue as string;
        if (step.metadata.newValue) entry.newValue = step.metadata.newValue as string;
      }
      entries.push(entry);
    }
  }

  return entries;
}

function generateMockComments(): ApprovalComment[] {
  const comments: ApprovalComment[] = [];
  let commentIndex = 0;
  const now = Date.now();

  // Pool of varied agent comments
  const agentComments = [
    'Verified vendor details match PO-4XXX',
    'Tax amount recalculated - matches GST filing',
    'Minor discrepancy in line item 2 quantity - corrected from 5 to 3 units',
    'Vendor bank details verified against master records',
    'Payment terms confirmed: Net 30 as per contract',
    'Three-way match completed - invoice, PO, and GRN aligned',
    'Flagged: Invoice date precedes service delivery date by 3 days',
    'Checked line items against delivery note. All quantities match.',
    'Vendor ABN validated against Australian Business Register.',
    'Duplicate check passed - no matching invoices found in system.',
    'Cost center allocation verified with department head.',
    'HSN codes on invoice match the contracted service categories.',
    'Withholding tax applicability reviewed - TDS at 2% applicable.',
  ];

  // Pool of varied approver comments
  const approverComments = [
    'Verified against contract JC-UTL-001. Approved.',
    'Amount exceeds my approval limit - forwarding to manager',
    'Please verify the cost center allocation before I can approve',
    'Sent back - PO number mismatch',
    'Good to go. Standard utility invoice.',
    'Confirmed with project manager. Work completed satisfactorily.',
    'Budget available under this cost center. Proceeding with approval.',
    'Checked against quarterly budget allocation. Within limits.',
    'Approved - vendor has preferred status with our organization.',
    'Rate matches the contracted rate card. No issues found.',
  ];

  // Pool of return reason comments
  const returnReasonComments = [
    'PO reference missing - please add before resubmitting.',
    'Invoice total does not match the sum of line items. Please correct.',
    'Vendor name on invoice differs from master record. Needs clarification.',
    'Service period overlaps with previously paid invoice INV-2025008.',
    'Cost center CC1003 is closed. Please reallocate to active cost center.',
  ];

  for (let i = 1; i <= 25; i++) {
    const caseId = `CASE-${String(i).padStart(4, '0')}`;
    const status = CASE_STATUS_ASSIGNMENTS[i - 1];
    const agent = getAssignedAgent(i);

    // Base time for this case's comments (aligned with case creation)
    const caseHoursAgo = i * 4 + (i % 3) * 2;
    const caseCreated = now - caseHoursAgo * 60 * 60 * 1000;

    // Every case gets at least 1 agent comment
    commentIndex++;
    const agentComment1 = agentComments[i % agentComments.length];
    comments.push({
      id: `CMT-${String(commentIndex).padStart(4, '0')}`,
      caseId,
      stepNumber: null,
      authorId: agent.id,
      authorName: agent.name,
      authorRole: 'AP_AGENT',
      content: agentComment1,
      createdAt: new Date(caseCreated + (1 + Math.random() * 2) * 60 * 60 * 1000).toISOString(),
    });

    // Most cases get a second agent comment (about 80%)
    if (i % 5 !== 0) {
      commentIndex++;
      const agentComment2 = agentComments[(i + 7) % agentComments.length];
      comments.push({
        id: `CMT-${String(commentIndex).padStart(4, '0')}`,
        caseId,
        stepNumber: null,
        authorId: agent.id,
        authorName: agent.name,
        authorRole: 'AP_AGENT',
        content: agentComment2,
        createdAt: new Date(caseCreated + (2 + Math.random() * 2) * 60 * 60 * 1000).toISOString(),
      });
    }

    // Approver comment for cases that have gone through approval workflow
    if (status === 'APPROVAL_PENDING' || status === 'APPROVED' || status === 'REJECTED' || status === 'RETURNED') {
      commentIndex++;
      const approver = APPROVER_POOL[i % APPROVER_POOL.length];
      const approverComment = approverComments[i % approverComments.length];
      comments.push({
        id: `CMT-${String(commentIndex).padStart(4, '0')}`,
        caseId,
        stepNumber: 1,
        authorId: approver.id,
        authorName: approver.name,
        authorRole: 'AP_REVIEWER',
        content: approverComment,
        createdAt: new Date(caseCreated + (3 + Math.random() * 2) * 60 * 60 * 1000).toISOString(),
      });
    }

    // Return reason comment for returned cases
    if (status === 'RETURNED') {
      commentIndex++;
      const approver = APPROVER_POOL[i % APPROVER_POOL.length];
      const returnComment = returnReasonComments[i % returnReasonComments.length];
      comments.push({
        id: `CMT-${String(commentIndex).padStart(4, '0')}`,
        caseId,
        stepNumber: 1,
        authorId: approver.id,
        authorName: approver.name,
        authorRole: 'AP_REVIEWER',
        content: returnComment,
        createdAt: new Date(caseCreated + (3.5 + Math.random()) * 60 * 60 * 1000).toISOString(),
      });
    }

    // Some cases get a 4th comment (every 3rd case) for extra depth
    if (i % 3 === 0) {
      commentIndex++;
      const extraAgent = agentComments[(i + 3) % agentComments.length];
      comments.push({
        id: `CMT-${String(commentIndex).padStart(4, '0')}`,
        caseId,
        stepNumber: null,
        authorId: agent.id,
        authorName: agent.name,
        authorRole: 'AP_AGENT',
        content: extraAgent,
        createdAt: new Date(caseCreated + (4 + Math.random()) * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  return comments;
}

function generateMockNotifications(): Notification[] {
  const now = Date.now();
  return [
    {
      id: 'NTF-001',
      type: 'CASE_ASSIGNED',
      title: 'New Case Assigned',
      message: 'Case CASE-0001 has been assigned to you for review.',
      caseId: 'CASE-0001',
      recipientId: 'agent-001',
      isRead: false,
      createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    },
    {
      id: 'NTF-002',
      type: 'APPROVAL_REQUIRED',
      title: 'Approval Required',
      message: `Case CASE-0003 requires your approval. Amount: AUD ${CASE_AMOUNTS[2].toLocaleString()}.`,
      caseId: 'CASE-0003',
      recipientId: 'approver-002',
      isRead: false,
      createdAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
    },
    {
      id: 'NTF-003',
      type: 'SLA_WARNING',
      title: 'SLA Warning',
      message: 'Case CASE-0024 is approaching its SLA deadline. Please take action.',
      caseId: 'CASE-0024',
      recipientId: 'agent-001',
      isRead: false,
      createdAt: new Date(now - 14 * 60 * 60 * 1000).toISOString(), // 14 hours ago
    },
    {
      id: 'NTF-004',
      type: 'CASE_APPROVED',
      title: 'Case Approved',
      message: 'Case CASE-0004 has been approved by Emma Thompson.',
      caseId: 'CASE-0004',
      recipientId: 'agent-001',
      isRead: true,
      createdAt: new Date(now - 18 * 60 * 60 * 1000).toISOString(), // 18 hours ago
    },
    {
      id: 'NTF-005',
      type: 'CASE_REJECTED',
      title: 'Case Rejected',
      message: 'Case CASE-0006 has been rejected. Reason: Duplicate invoice submission.',
      caseId: 'CASE-0006',
      recipientId: 'agent-001',
      isRead: true,
      createdAt: new Date(now - 22 * 60 * 60 * 1000).toISOString(), // 22 hours ago
    },
    {
      id: 'NTF-006',
      type: 'CASE_RETURNED',
      title: 'Case Returned',
      message: 'Case CASE-0007 has been returned by Robert Johnson for corrections.',
      caseId: 'CASE-0007',
      recipientId: 'agent-001',
      isRead: false,
      createdAt: new Date(now - 28 * 60 * 60 * 1000).toISOString(), // 28 hours ago
    },
    {
      id: 'NTF-007',
      type: 'EXTRACTION_COMPLETE',
      title: 'Extraction Complete',
      message: 'Data extraction completed for Case CASE-0009. Ready for review.',
      caseId: 'CASE-0009',
      recipientId: 'agent-001',
      isRead: false,
      createdAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    },
    {
      id: 'NTF-008',
      type: 'SLA_BREACH',
      title: 'SLA Breach',
      message: 'Case CASE-0012 has breached its SLA deadline. Immediate attention required.',
      caseId: 'CASE-0012',
      recipientId: 'agent-001',
      isRead: false,
      createdAt: new Date(now - 36 * 60 * 60 * 1000).toISOString(), // 36 hours ago
    },
  ];
}

// ---------------------------------------------------------------------------
// Email Records
// ---------------------------------------------------------------------------

export type { EmailRecord } from '@/types/email';
import type { EmailRecord } from '@/types/email';

function generateMockEmails(): EmailRecord[] {
  const now = Date.now();
  const emails: EmailRecord[] = [];

  const vendors = mockVendors.filter((v) => v.isActive);
  const categories: Case['category'][] = ['SUBCONTRACTOR', 'RUST_SUBCONTRACTOR', 'DELIVERY_INSTALLATION', 'FREIGHT_FINISHED_GOODS', 'FREIGHT_SPARE_PARTS', 'FREIGHT_ADDITIONAL_CHARGES'];

  // ---------------------------------------------------------------------------
  // 1. ~20 invoice emails linked to existing cases
  // ---------------------------------------------------------------------------
  const invoiceSubjectTemplates = [
    (vendor: string, inv: string) => `Invoice #${inv} from ${vendor}`,
    (vendor: string, inv: string) => `[${vendor}] Tax Invoice ${inv} - Please Process`,
    (vendor: string, inv: string) => `Fwd: Invoice ${inv} - ${vendor} Services`,
    (vendor: string, inv: string) => `${vendor} | Invoice Submission ${inv}`,
    (vendor: string, inv: string) => `RE: Invoice #${inv} attached - ${vendor}`,
  ];

  const invoiceBodyTemplates = [
    (vendor: string, inv: string, cat: string, contract: string) =>
      `Dear AP Team,\n\nPlease find attached invoice #${inv} for ${cat.toLowerCase()} services rendered as per contract ${contract}.\n\nKindly process this at the earliest.\n\nRegards,\n${vendor} Accounts Team`,
    (vendor: string, inv: string, cat: string, _contract: string) =>
      `Hi,\n\nWe are submitting invoice ${inv} for ${cat.toLowerCase()} work completed during the current billing cycle. The invoice document and supporting documents are attached.\n\nPlease confirm receipt.\n\nBest regards,\n${vendor}`,
    (vendor: string, inv: string, cat: string, contract: string) =>
      `To Whom It May Concern,\n\nAttached herewith is our tax invoice ${inv} towards ${cat.toLowerCase()} services as per agreement ${contract}. Payment terms are as per contract.\n\nFor any queries, please reach out to our accounts department.\n\nThank you,\n${vendor} Finance Dept.`,
    (vendor: string, inv: string, cat: string, _contract: string) =>
      `Dear Sir/Madam,\n\nThis is a gentle reminder that invoice ${inv} for ${cat.toLowerCase()} services was sent last week. We have re-attached the invoice for your convenience.\n\nLooking forward to timely processing.\n\nWarm regards,\n${vendor}`,
    (vendor: string, inv: string, cat: string, contract: string) =>
      `Hello,\n\nPlease process the attached invoice #${inv}. This pertains to ${cat.toLowerCase()} services under contract ${contract}. All delivery milestones have been met.\n\nThank you for your prompt attention.\n\nBest,\n${vendor} Billing Team`,
  ];

  for (let i = 1; i <= 20; i++) {
    const vendor = vendors[i % vendors.length];
    const category = categories[i % categories.length];
    const contract = vendor.contracts.find((c) => c.category === category) ?? vendor.contracts[0];
    const invNumber = `INV-${2025000 + i}`;
    const caseId = `CASE-${String(i).padStart(4, '0')}`;
    const hoursAgo = i * 4 + (i % 3) * 2;
    const receivedDate = new Date(now - hoursAgo * 60 * 60 * 1000);

    const subjectFn = invoiceSubjectTemplates[i % invoiceSubjectTemplates.length];
    const bodyFn = invoiceBodyTemplates[i % invoiceBodyTemplates.length];

    const attachments: EmailRecord['attachments'] = [
      { fileName: `${invNumber}.pdf`, fileType: 'PDF', fileSize: 120000 + i * 4000 },
    ];
    if (category === 'SUBCONTRACTOR' || category === 'DELIVERY_INSTALLATION') {
      attachments.push(
        { fileName: `JobSheet-${invNumber}.pdf`, fileType: 'PDF', fileSize: 95000 + i * 2000 },
        { fileName: `DeliveryNote-${invNumber}.pdf`, fileType: 'PDF', fileSize: 60000 + i * 1500 },
      );
    }
    if (category === 'RUST_SUBCONTRACTOR') {
      attachments.push(
        { fileName: `WorkSheet-${invNumber}.pdf`, fileType: 'PDF', fileSize: 45000 + i * 1000 },
      );
    }

    emails.push({
      id: `EMAIL-${String(i).padStart(4, '0')}`,
      from: `invoices@${vendor.name.toLowerCase().replace(/\s+/g, '').slice(0, 12)}.com.au`,
      fromName: `${vendor.name} Accounts`,
      to: 'ap-invoices@johnsoncontrols.com.au',
      subject: subjectFn(vendor.name, invNumber),
      receivedAt: receivedDate.toISOString(),
      body: bodyFn(vendor.name, invNumber, category, contract?.contractNumber ?? 'N/A'),
      attachmentCount: attachments.length,
      attachments,
      classification: 'INVOICE',
      invoiceCategory: category,
      classificationConfidence: 0.88 + (i % 12) * 0.01,
      linkedCaseId: caseId,
      isRead: i <= 12,
      poType: i % 5 < 3 ? 'PO' : 'NON_PO',
      entity: i % 7 < 5 ? 'AU' : 'NZ',
      ...(i === 3 ? { xeroLink: 'https://go.xero.com/AccountsPayable/View.aspx?InvoiceID=a1b2c3d4-e5f6-7890' } : {}),
      ...(i === 8 ? { xeroLink: 'https://go.xero.com/AccountsPayable/View.aspx?InvoiceID=f9e8d7c6-b5a4-3210' } : {}),
    });
  }

  // ---------------------------------------------------------------------------
  // 1b. ~15 older invoice emails (not linked to cases - historical)
  // ---------------------------------------------------------------------------
  const olderSubjects = [
    'Monthly electricity bill - Dec 2024',
    'Invoice for HVAC maintenance - Q4 2024',
    'Water supply charges - Nov 2024',
    'Warranty repair completion invoice',
    'Installation services - Building C',
    'Generator fuel charges - Dec 2024',
    'Fire safety inspection invoice',
    'Plumbing repair services - Site D',
    'UPS maintenance contract renewal',
    'Elevator annual service invoice',
    'Solar panel installation - Phase 2',
    'Security system upgrade invoice',
    'Cleaning services - Monthly Dec',
    'Landscaping maintenance Q4',
    'IT infrastructure cabling invoice',
  ];

  const olderSenders = [
    { name: 'AGL Energy', email: 'billing@agl.com.au' },
    { name: 'Carrier HVAC Services', email: 'invoices@carrier.com.au' },
    { name: 'Sydney Water', email: 'billing@sydneywater.com.au' },
    { name: 'Daikin Service Centre', email: 'accounts@daikin.com.au' },
    { name: 'BuildTech Solutions', email: 'finance@buildtech.com.au' },
    { name: 'Cummins Power Gen', email: 'billing@cummins.com.au' },
    { name: 'Wormald Fire Systems', email: 'invoices@wormald.com.au' },
    { name: 'Reece Plumbing', email: 'accounts@reece.com.au' },
    { name: 'Eaton Power Quality', email: 'billing@eaton.com.au' },
    { name: 'Schindler Lifts', email: 'invoices@schindler.com.au' },
    { name: 'SunPower Australia', email: 'accounts@sunpower.com.au' },
    { name: 'Honeywell Security', email: 'billing@honeywell.com.au' },
    { name: 'Spotless Group', email: 'invoices@spotless.com.au' },
    { name: 'Programmed Maintenance', email: 'accounts@programmed.com.au' },
    { name: 'Optus Business', email: 'billing@optus.com.au' },
  ];

  for (let i = 0; i < 15; i++) {
    const daysAgo = 7 + i * 3;
    const receivedDate = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    const cat = categories[i % 3];
    const sender = olderSenders[i];
    const invNum = `INV-2024${String(900 + i).padStart(4, '0')}`;

    emails.push({
      id: `EMAIL-${String(31 + i).padStart(4, '0')}`,
      from: sender.email,
      fromName: `${sender.name} Accounts`,
      to: 'ap-invoices@johnsoncontrols.com.au',
      subject: olderSubjects[i],
      receivedAt: receivedDate.toISOString(),
      body: `Dear AP Team,\n\nPlease find attached invoice #${invNum} for ${cat.toLowerCase()} services.\n\nKindly process this at the earliest.\n\nRegards,\n${sender.name}`,
      attachmentCount: 1 + (i % 2),
      attachments: [
        { fileName: `${invNum}.pdf`, fileType: 'PDF', fileSize: 100000 + i * 8000 },
        ...(i % 2 === 0 ? [{ fileName: `support-doc-${invNum}.pdf`, fileType: 'PDF', fileSize: 55000 + i * 3000 }] : []),
      ],
      classification: 'INVOICE' as const,
      invoiceCategory: cat,
      classificationConfidence: 0.85 + (i % 10) * 0.01,
      linkedCaseId: null,
      isRead: i % 3 !== 0,
      poType: i % 3 < 2 ? 'PO' : 'NON_PO',
      entity: i % 5 < 4 ? 'AU' : 'NZ',
    });
  }

  // ---------------------------------------------------------------------------
  // 2. ~5 non-invoice emails (varied content)
  // ---------------------------------------------------------------------------
  const nonInvoiceEmails: Omit<EmailRecord, 'id'>[] = [
    {
      from: 'procurement@reliance-infra.com.au',
      fromName: 'Reliance Infrastructure Procurement',
      to: 'ap-invoices@johnsoncontrols.com.au',
      subject: 'RE: Payment Status Inquiry - PO-4012',
      receivedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
      body: 'Dear Johnson Controls AP Team,\n\nWe are writing to inquire about the payment status of our invoice INV-2024-8834 submitted on 15th December 2024. Our records show it has been over 45 days since submission and we have not yet received the payment.\n\nCould you please provide an update on the expected payment date?\n\nThank you for your cooperation.\n\nBest regards,\nAmit Sharma\nReliance Infrastructure - Accounts Receivable',
      attachmentCount: 0,
      attachments: [],
      classification: 'NON_INVOICE',
      invoiceCategory: null,
      classificationConfidence: 0.95,
      linkedCaseId: null,
      isRead: false,
      poType: 'NON_PO',
      entity: 'AU',
    },
    {
      from: 'noreply@zoom.us',
      fromName: 'Zoom Meetings',
      to: 'ap-invoices@johnsoncontrols.com.au',
      subject: 'Reminder: Quarterly Vendor Review Meeting - Tomorrow 10:00 AM IST',
      receivedAt: new Date(now - 14 * 60 * 60 * 1000).toISOString(),
      body: 'Hi there,\n\nThis is a reminder that you have an upcoming meeting:\n\nQuarterly Vendor Review Meeting\nDate: Tomorrow at 10:00 AM IST\nDuration: 1 hour\nJoin URL: https://zoom.us/j/98765432100\n\nAgenda:\n1. Review of pending invoices\n2. Vendor performance scorecard\n3. Contract renewal discussions\n4. Q&A\n\nPlease join on time.\n\nBest,\nZoom Meetings',
      attachmentCount: 1,
      attachments: [
        { fileName: 'meeting-agenda.pdf', fileType: 'PDF', fileSize: 32000 },
      ],
      classification: 'NON_INVOICE',
      invoiceCategory: null,
      classificationConfidence: 0.97,
      linkedCaseId: null,
      isRead: true,
      poType: 'NON_PO',
      entity: 'AU',
    },
    {
      from: 'newsletter@procurement-insider.com',
      fromName: 'Procurement Insider',
      to: 'ap-invoices@johnsoncontrols.com.au',
      subject: 'Weekly Digest: Top 5 AP Automation Trends in 2025',
      receivedAt: new Date(now - 52 * 60 * 60 * 1000).toISOString(),
      body: 'PROCUREMENT INSIDER - WEEKLY DIGEST\n\n1. AI-Powered Invoice Matching Reduces Processing Time by 70%\n2. How Leading Companies Are Eliminating Manual Data Entry\n3. New GST E-Invoicing Mandates: What AP Teams Need to Know\n4. Case Study: Johnson Controls Deploys Intelligent AP Automation\n5. The Future of Three-Way Match: Blockchain Meets AP\n\nRead more at procurement-insider.com\n\nTo unsubscribe, click here.\n\nProcurement Insider | Mumbai, India',
      attachmentCount: 0,
      attachments: [],
      classification: 'NON_INVOICE',
      invoiceCategory: null,
      classificationConfidence: 0.99,
      linkedCaseId: null,
      isRead: true,
      poType: 'NON_PO',
      entity: 'AU',
    },
    {
      from: 'mailer-daemon@smtp.johnsoncontrols.com.au',
      fromName: 'Mail Delivery System',
      to: 'ap-invoices@johnsoncontrols.com.au',
      subject: 'Undeliverable: RE: Invoice clarification for VND-003',
      receivedAt: new Date(now - 36 * 60 * 60 * 1000).toISOString(),
      body: "This is an automatically generated Delivery Status Notification.\n\nDelivery to the following recipients failed:\n\n  accounts@larsenentoubro.com.au\n\nReason: The recipient's mailbox is full and cannot accept messages now. Please try resending this message later, or contact the recipient directly.\n\n--- Original Message ---\nFrom: ap-invoices@johnsoncontrols.com.au\nTo: accounts@larsenentoubro.com.au\nSubject: RE: Invoice clarification for VND-003\nSent: 2 days ago",
      attachmentCount: 0,
      attachments: [],
      classification: 'NON_INVOICE',
      invoiceCategory: null,
      classificationConfidence: 0.93,
      linkedCaseId: null,
      isRead: false,
      poType: 'NON_PO',
      entity: 'AU',
    },
    {
      from: 'vendor.onboarding@johnsoncontrols.com.au',
      fromName: 'JCI Vendor Onboarding',
      to: 'ap-invoices@johnsoncontrols.com.au',
      subject: 'FYI: New Vendor Registered - Wipro Infrastructure Engineering',
      receivedAt: new Date(now - 72 * 60 * 60 * 1000).toISOString(),
      body: 'Dear AP Team,\n\nThis is to inform you that a new vendor has been registered in the system:\n\nVendor Name: Wipro Infrastructure Engineering\nVendor Number: V100020\nCategory: Installation Services\nPayment Terms: NET45\nABN: 51 824 753 556\n\nThe vendor is now approved to submit invoices. Please ensure any incoming invoices from this vendor are processed accordingly.\n\nRegards,\nVendor Onboarding Team\nJohnson Controls Australia',
      attachmentCount: 1,
      attachments: [
        { fileName: 'vendor-registration-form.xlsx', fileType: 'XLSX', fileSize: 48000 },
      ],
      classification: 'NON_INVOICE',
      invoiceCategory: null,
      classificationConfidence: 0.91,
      linkedCaseId: null,
      isRead: true,
      poType: 'NON_PO',
      entity: 'AU',
    },
  ];

  nonInvoiceEmails.forEach((email, idx) => {
    emails.push({
      ...email,
      id: `EMAIL-${String(21 + idx).padStart(4, '0')}`,
    });
  });

  // ---------------------------------------------------------------------------
  // 3. ~5 invoice emails that failed classification (UNCLASSIFIED)
  // ---------------------------------------------------------------------------
  const unclassifiedEmails: Omit<EmailRecord, 'id'>[] = [
    {
      from: 'billing@ambujacement.com.au',
      fromName: 'Ambuja Cements Billing',
      to: 'ap-invoices@johnsoncontrols.com.au',
      subject: 'Docs attached - Cement supply 2025-Jan batch',
      receivedAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      body: 'Hi,\n\nPlease see attached docs for cement supply batch delivered to your Pune plant on 12th Jan. The challan and invoice are in the zip file.\n\nLet us know if anything else is needed.\n\nThanks,\nAmbuja Cements',
      attachmentCount: 1,
      attachments: [
        { fileName: 'Jan2025-batch-docs.zip', fileType: 'ZIP', fileSize: 340000 },
      ],
      classification: 'UNCLASSIFIED',
      invoiceCategory: null,
      classificationConfidence: 0.34,
      linkedCaseId: null,
      isRead: false,
      poType: 'PO',
      entity: 'AU',
    },
    {
      from: 'accounts@hvacglobal.in',
      fromName: 'HVAC Global Systems',
      to: 'ap-invoices@johnsoncontrols.com.au',
      subject: 'Scanned documents - Service completion',
      receivedAt: new Date(now - 18 * 60 * 60 * 1000).toISOString(),
      body: 'Dear Team,\n\nPlease find the scanned documents for service completion. The image quality might be low as these were scanned from old carbon copies.\n\nPlease acknowledge receipt.\n\nRegards,\nHVAC Global Systems',
      attachmentCount: 2,
      attachments: [
        { fileName: 'scan_001.jpg', fileType: 'JPG', fileSize: 890000 },
        { fileName: 'scan_002.jpg', fileType: 'JPG', fileSize: 760000 },
      ],
      classification: 'UNCLASSIFIED',
      invoiceCategory: null,
      classificationConfidence: 0.42,
      linkedCaseId: null,
      isRead: false,
      poType: 'NON_PO',
      entity: 'AU',
    },
    {
      from: 'info@securepowersolutions.com.au',
      fromName: 'Secure Power Solutions',
      to: 'ap-invoices@johnsoncontrols.com.au',
      subject: 'Generator maintenance - final settlement',
      receivedAt: new Date(now - 28 * 60 * 60 * 1000).toISOString(),
      body: 'Hello,\n\nWe are sending this email regarding the final settlement for the generator annual maintenance contract. Attached is our billing summary along with the work completion certificate.\n\nPlease process the same at the earliest.\n\nBest,\nSecure Power Solutions',
      attachmentCount: 2,
      attachments: [
        { fileName: 'billing-summary.pdf', fileType: 'PDF', fileSize: 156000 },
        { fileName: 'work-completion-cert.pdf', fileType: 'PDF', fileSize: 89000 },
      ],
      classification: 'UNCLASSIFIED',
      invoiceCategory: null,
      classificationConfidence: 0.51,
      linkedCaseId: null,
      isRead: false,
      poType: 'PO',
      entity: 'AU',
    },
    {
      from: 'do-not-reply@indiapost.gov.in',
      fromName: 'India Post Digital',
      to: 'ap-invoices@johnsoncontrols.com.au',
      subject: 'Registered post delivery confirmation & enclosures',
      receivedAt: new Date(now - 96 * 60 * 60 * 1000).toISOString(),
      body: 'This is a digitized version of a registered post received at your office address.\n\nTracking Number: RR123456789IN\nSender: M/s Bharat Heavy Electricals Ltd\nContents: Invoice and delivery challan (2 pages)\n\nThe scanned enclosures are attached as image files.\n\nThis is an automated notification from India Post Digital Services.',
      attachmentCount: 2,
      attachments: [
        { fileName: 'page1.tiff', fileType: 'TIFF', fileSize: 1200000 },
        { fileName: 'page2.tiff', fileType: 'TIFF', fileSize: 1100000 },
      ],
      classification: 'UNCLASSIFIED',
      invoiceCategory: null,
      classificationConfidence: 0.29,
      linkedCaseId: null,
      isRead: false,
      poType: 'NON_PO',
      entity: 'NZ',
    },
    {
      from: 'finance@thermalcomfort.com.au',
      fromName: 'Thermal Comfort Pvt Ltd',
      to: 'ap-invoices@johnsoncontrols.com.au',
      subject: 'Credit note & revised invoice - Please update',
      receivedAt: new Date(now - 120 * 60 * 60 * 1000).toISOString(),
      body: 'Dear Johnson Controls AP Team,\n\nFollowing our phone conversation, we are sending the credit note for the previously disputed amount along with the revised invoice.\n\nPlease cancel the old invoice and process the revised one.\n\nDocuments attached:\n1. Credit Note CN-2025-0045\n2. Revised Invoice RINV-2025-0045\n\nRegards,\nFinance Department\nThermal Comfort Pvt Ltd',
      attachmentCount: 2,
      attachments: [
        { fileName: 'CN-2025-0045.pdf', fileType: 'PDF', fileSize: 98000 },
        { fileName: 'RINV-2025-0045.pdf', fileType: 'PDF', fileSize: 134000 },
      ],
      classification: 'UNCLASSIFIED',
      invoiceCategory: null,
      classificationConfidence: 0.47,
      linkedCaseId: null,
      isRead: true,
      poType: 'PO',
      entity: 'NZ',
    },
  ];

  unclassifiedEmails.forEach((email, idx) => {
    emails.push({
      ...email,
      id: `EMAIL-${String(26 + idx).padStart(4, '0')}`,
    });
  });

  // Sort by receivedAt descending (most recent first)
  emails.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

  return emails;
}

// ---------------------------------------------------------------------------
// Mock Approval Sequences by Invoice Type
// ---------------------------------------------------------------------------
const mockApprovalSequences: ApprovalSequenceMaster[] = [
  {
    id: 'ASEQ-001',
    invoiceType: 'STANDARD',
    name: 'Standard Invoice Approval',
    description: 'Default approval flow for standard invoices',
    steps: [
      { stepNumber: 1, approverRole: 'AP Reviewer', approverName: 'Emma Thompson', approverId: 'approver-002' },
      { stepNumber: 2, approverRole: 'AP Reviewer', approverName: 'John Williams', approverId: 'approver-001' },
    ],
    isActive: true,
  },
  {
    id: 'ASEQ-002',
    invoiceType: 'CREDIT_NOTE',
    name: 'Credit Note Approval',
    description: 'Approval flow for credit notes requiring finance review',
    steps: [
      { stepNumber: 1, approverRole: 'AP Reviewer', approverName: 'David Martinez', approverId: 'approver-003' },
    ],
    isActive: true,
  },
  {
    id: 'ASEQ-003',
    invoiceType: 'DEBIT_NOTE',
    name: 'Debit Note Approval',
    description: 'Approval flow for debit notes',
    steps: [
      { stepNumber: 1, approverRole: 'AP Reviewer', approverName: 'Emma Thompson', approverId: 'approver-002' },
      { stepNumber: 2, approverRole: 'AP Reviewer', approverName: 'David Martinez', approverId: 'approver-003' },
    ],
    isActive: true,
  },
  {
    id: 'ASEQ-004',
    invoiceType: 'PROFORMA',
    name: 'Proforma Invoice Approval',
    description: 'Lightweight approval for proforma invoices',
    steps: [
      { stepNumber: 1, approverRole: 'AP Reviewer', approverName: 'Robert Johnson', approverId: 'approver-005' },
    ],
    isActive: true,
  },
  {
    id: 'ASEQ-005',
    invoiceType: 'RECURRING',
    name: 'Recurring Invoice Approval',
    description: 'Auto-approval for recurring invoices within threshold',
    steps: [
      { stepNumber: 1, approverRole: 'AP Reviewer', approverName: 'John Williams', approverId: 'approver-001' },
      { stepNumber: 2, approverRole: 'AP Reviewer', approverName: 'Robert Johnson', approverId: 'approver-005' },
    ],
    isActive: true,
  },
];

// ---------------------------------------------------------------------------
// The actual in-memory database
// ---------------------------------------------------------------------------
const db = {
  cases: generateMockCases(),
  auditLogs: generateMockAuditLogs(),
  comments: generateMockComments(),
  notifications: generateMockNotifications(),
  emails: generateMockEmails(),
  vendors: [...mockVendors] as Vendor[],
  costCenters: [...mockCostCenters] as CostCenter[],
  glAccounts: [...mockGLAccounts] as GLAccount[],
  taxCodes: [...mockTaxCodes] as TaxCode[],
  companyCodes: [...mockCompanyCodes] as CompanyCode[],
  plantCodes: [...mockPlantCodes] as PlantCode[],
  approvalRules: [...mockApprovalRules] as ApprovalRule[],
  businessRuleConfigs: [...mockBusinessRuleConfigs] as BusinessRuleConfig[],
  approvalSequences: [...mockApprovalSequences] as ApprovalSequenceMaster[],
  users: [...mockUsers],
};

// ---------------------------------------------------------------------------
// Auth handler (used by authStore)
// ---------------------------------------------------------------------------

const VALID_CREDENTIALS: Record<string, string> = {
  'sarah.chen@company.com': 'password123',
  'mike.ross@company.com': 'password123',
  'john.williams@company.com': 'password123',
  'emma.thompson@company.com': 'password123',
  'david.martinez@company.com': 'password123',
  'anna.schmidt@company.com': 'password123',
  'robert.johnson@company.com': 'password123',
  'alex.kumar@company.com': 'password123',
  'rachel.green@company.com': 'password123',
  'lisa.park@company.com': 'password123',
};

export async function login(email: string, password: string): Promise<Session> {
  await randomDelay();

  if (VALID_CREDENTIALS[email] !== password) {
    throw new Error('Invalid email or password.');
  }

  const user = db.users.find((u) => u.email === email);
  if (!user) throw new Error('User not found.');
  if (!user.isActive) throw new Error('Account is deactivated.');

  return {
    user,
    token: `mock-jwt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  };
}

// ============================================================================
// CASE HANDLERS
// ============================================================================

export async function fetchCases(filters: FilterState): Promise<Case[]> {
  await randomDelay();

  let result = [...db.cases];

  // Search filter — match against id or vendorName
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.vendorName.toLowerCase().includes(q) ||
        c.headerData.invoiceNumber.toLowerCase().includes(q)
    );
  }

  // Status filter
  if (filters.status && filters.status.length > 0) {
    result = result.filter((c) => filters.status.includes(c.status));
  }

  // Category filter
  if (filters.category && filters.category.length > 0) {
    result = result.filter((c) => (filters.category as string[]).includes(c.category));
  }

  // Confidence level filter
  if (filters.confidenceLevel && filters.confidenceLevel.length > 0) {
    result = result.filter((c) => (filters.confidenceLevel as string[]).includes(c.overallConfidenceLevel));
  }

  // Vendor filter
  if (filters.vendorId) {
    result = result.filter((c) => c.vendorId === filters.vendorId);
  }

  // Date range filter
  if (filters.dateRange?.from) {
    result = result.filter((c) => c.createdAt >= filters.dateRange.from!);
  }
  if (filters.dateRange?.to) {
    result = result.filter((c) => c.createdAt <= filters.dateRange.to!);
  }

  // Sorting
  const sortBy = filters.sortBy || 'createdAt';
  const sortOrder = filters.sortOrder || 'desc';

  result.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'createdAt':
      case 'newest':
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'oldest':
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return cmp; // ascending for "oldest"
      case 'amount_high':
        cmp = a.headerData.totalAmount - b.headerData.totalAmount;
        return -cmp; // descending
      case 'amount_low':
        cmp = a.headerData.totalAmount - b.headerData.totalAmount;
        return cmp; // ascending
      case 'sla':
        cmp = new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime();
        break;
      case 'updatedAt':
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      default:
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  // Pagination
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 10;
  const start = (page - 1) * pageSize;
  return result.slice(start, start + pageSize);
}

export async function fetchAllCases(): Promise<Case[]> {
  await randomDelay();
  return [...db.cases];
}

export async function fetchCaseById(id: string): Promise<Case> {
  await randomDelay();
  const found = db.cases.find((c) => c.id === id);
  if (!found) throw new Error(`Case not found: ${id}`);
  return { ...found };
}

export async function saveDraft(
  caseId: string,
  data: { headerData: InvoiceHeaderData; lineItems: LineItem[] }
): Promise<Case> {
  await randomDelay();

  const idx = db.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) throw new Error(`Case not found: ${caseId}`);

  const updated: Case = {
    ...db.cases[idx],
    headerData: { ...data.headerData },
    lineItems: data.lineItems.map((li) => ({ ...li })),
    status: db.cases[idx].status === 'EXTRACTED' ? 'IN_REVIEW' : db.cases[idx].status,
    updatedAt: new Date().toISOString(),
  };

  db.cases[idx] = updated;
  return { ...updated };
}

export async function runBusinessRules(caseId: string): Promise<BusinessRuleResult[]> {
  await randomDelay();

  const found = db.cases.find((c) => c.id === caseId);
  if (!found) throw new Error(`Case not found: ${caseId}`);

  return [...found.businessRuleResults];
}

export async function saveAndConfirm(
  caseId: string,
  data: { headerData: InvoiceHeaderData; lineItems: LineItem[] }
): Promise<Case> {
  await randomDelay();

  const idx = db.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) throw new Error(`Case not found: ${caseId}`);

  const updated: Case = {
    ...db.cases[idx],
    headerData: { ...data.headerData },
    lineItems: data.lineItems.map((li) => ({ ...li })),
    status: 'VALIDATED',
    updatedAt: new Date().toISOString(),
  };

  db.cases[idx] = updated;
  return { ...updated };
}

export async function rejectCase(caseId: string, reason: string): Promise<Case> {
  await randomDelay();

  const idx = db.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) throw new Error(`Case not found: ${caseId}`);

  const updated: Case = {
    ...db.cases[idx],
    status: 'DISCARDED',
    rejectionReason: reason,
    rejectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.cases[idx] = updated;
  return { ...updated };
}

export async function submitForApproval(
  caseId: string,
  approverIds: string[],
  comment?: string
): Promise<Case> {
  await randomDelay();

  const idx = db.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) throw new Error(`Case not found: ${caseId}`);

  const steps: ApprovalStep[] = approverIds.map((approverId, stepIdx) => {
    const user = db.users.find((u) => u.id === approverId);
    return {
      stepNumber: stepIdx + 1,
      approverId,
      approverName: user?.fullName ?? approverId,
      approverRole: user?.role ?? 'AP_REVIEWER',
      status: 'PENDING' as const,
      decision: null,
      comment: null,
      decidedAt: null,
    };
  });

  const approvalChain: ApprovalChain = {
    id: `AC-${caseId}-${Date.now()}`,
    caseId,
    steps,
    currentStepIndex: 0,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  // If the agent provided a submission comment, store it
  if (comment) {
    const { useAuthStore } = await import('@/stores/authStore');
    const authUser = useAuthStore.getState().user;
    const newComment: ApprovalComment = {
      id: `CMT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      caseId,
      stepNumber: null,
      authorId: authUser?.id ?? 'agent-001',
      authorName: authUser?.fullName ?? 'AP Agent',
      authorRole: authUser?.role ?? 'AP_AGENT',
      content: comment,
      createdAt: new Date().toISOString(),
    };
    db.comments.push(newComment);
  }

  const updated: Case = {
    ...db.cases[idx],
    status: 'APPROVAL_PENDING',
    approvalChain,
    updatedAt: new Date().toISOString(),
  };

  db.cases[idx] = updated;
  return { ...updated };
}

export async function approveCaseHandler(
  caseId: string,
  comment: string
): Promise<Case> {
  await randomDelay();

  const idx = db.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) throw new Error(`Case not found: ${caseId}`);

  const caseData = db.cases[idx];
  if (!caseData.approvalChain) throw new Error('No approval chain found.');

  const chain = { ...caseData.approvalChain };
  const steps = chain.steps.map((s) => ({ ...s }));
  const currentIdx = chain.currentStepIndex;

  if (currentIdx >= steps.length) throw new Error('All steps already completed.');

  // Mark the current step as APPROVED
  steps[currentIdx] = {
    ...steps[currentIdx],
    status: 'APPROVED',
    decision: 'APPROVE',
    comment,
    decidedAt: new Date().toISOString(),
  };

  const nextIdx = currentIdx + 1;
  const allDone = nextIdx >= steps.length;

  const updatedChain: ApprovalChain = {
    ...chain,
    steps,
    currentStepIndex: nextIdx,
    status: allDone ? 'APPROVED' : 'PENDING',
    completedAt: allDone ? new Date().toISOString() : null,
  };

  const updated: Case = {
    ...caseData,
    approvalChain: updatedChain,
    status: allDone ? 'APPROVED' : 'APPROVAL_PENDING',
    updatedAt: new Date().toISOString(),
  };

  db.cases[idx] = updated;
  return { ...updated };
}

export async function sendBackCase(caseId: string, reason: string): Promise<Case> {
  await randomDelay();

  const idx = db.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) throw new Error(`Case not found: ${caseId}`);

  const caseData = db.cases[idx];
  const chain = caseData.approvalChain;
  const currentStep = chain ? chain.steps[chain.currentStepIndex] : null;

  const updated: Case = {
    ...caseData,
    status: 'RETURNED',
    returnedBy: currentStep?.approverId ?? null,
    returnedByName: currentStep?.approverName ?? null,
    returnReason: reason,
    returnedAt: new Date().toISOString(),
    returnedFromStep: currentStep?.stepNumber ?? null,
    approvalChain: chain
      ? {
          ...chain,
          status: 'RETURNED',
          steps: chain.steps.map((s, i) =>
            i === chain.currentStepIndex
              ? { ...s, status: 'RETURNED' as const, decision: 'SEND_BACK' as const, comment: reason, decidedAt: new Date().toISOString() }
              : { ...s }
          ),
        }
      : null,
    updatedAt: new Date().toISOString(),
  };

  db.cases[idx] = updated;
  return { ...updated };
}

export async function rejectCaseAsApprover(
  caseId: string,
  reason: string
): Promise<Case> {
  await randomDelay();

  const idx = db.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) throw new Error(`Case not found: ${caseId}`);

  const caseData = db.cases[idx];
  const chain = caseData.approvalChain;
  const currentStep = chain ? chain.steps[chain.currentStepIndex] : null;

  const updated: Case = {
    ...caseData,
    status: 'REJECTED',
    rejectedBy: currentStep?.approverId ?? null,
    rejectedByName: currentStep?.approverName ?? null,
    rejectionReason: reason,
    rejectedAt: new Date().toISOString(),
    approvalChain: chain
      ? {
          ...chain,
          status: 'REJECTED',
          steps: chain.steps.map((s, i) =>
            i === chain.currentStepIndex
              ? { ...s, status: 'REJECTED' as const, decision: 'REJECT' as const, comment: reason, decidedAt: new Date().toISOString() }
              : { ...s }
          ),
        }
      : null,
    updatedAt: new Date().toISOString(),
  };

  db.cases[idx] = updated;
  return { ...updated };
}

// ============================================================================
// RESUBMIT CASE (preserves return steps in approval history)
// ============================================================================

export async function resubmitCase(
  caseId: string,
  approverIds: string[],
  comment?: string
): Promise<Case> {
  await randomDelay();

  const idx = db.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) throw new Error(`Case not found: ${caseId}`);

  const caseData = db.cases[idx];
  const oldChain = caseData.approvalChain;

  // Preserve old steps (including RETURNED step with its comment) by keeping them
  // and appending new resubmission steps with incremented step numbers
  const preservedSteps: ApprovalStep[] = oldChain
    ? oldChain.steps.map((s) => ({ ...s }))
    : [];

  const nextStepNumber = preservedSteps.length > 0
    ? Math.max(...preservedSteps.map((s) => s.stepNumber)) + 1
    : 1;

  const newSteps: ApprovalStep[] = approverIds.map((approverId, stepIdx) => {
    const user = db.users.find((u) => u.id === approverId);
    return {
      stepNumber: nextStepNumber + stepIdx,
      approverId,
      approverName: user?.fullName ?? approverId,
      approverRole: user?.role ?? 'AP_REVIEWER',
      status: 'PENDING' as const,
      decision: null,
      comment: null,
      decidedAt: null,
    };
  });

  const allSteps = [...preservedSteps, ...newSteps];

  // The currentStepIndex should point to the first new (PENDING) step
  const firstNewIndex = preservedSteps.length;

  const approvalChain: ApprovalChain = {
    id: oldChain?.id ?? `AC-${caseId}-${Date.now()}`,
    caseId,
    steps: allSteps,
    currentStepIndex: firstNewIndex,
    status: 'PENDING',
    createdAt: oldChain?.createdAt ?? new Date().toISOString(),
    completedAt: null,
  };

  // Store the resubmission comment if provided
  if (comment) {
    const { useAuthStore } = await import('@/stores/authStore');
    const authUser = useAuthStore.getState().user;
    const newComment: ApprovalComment = {
      id: `CMT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      caseId,
      stepNumber: null,
      authorId: authUser?.id ?? 'agent-001',
      authorName: authUser?.fullName ?? 'AP Agent',
      authorRole: authUser?.role ?? 'AP_AGENT',
      content: comment,
      createdAt: new Date().toISOString(),
    };
    db.comments.push(newComment);
  }

  const updated: Case = {
    ...caseData,
    status: 'APPROVAL_PENDING',
    approvalChain,
    returnedBy: null,
    returnedByName: null,
    returnReason: null,
    returnedAt: null,
    returnedFromStep: null,
    updatedAt: new Date().toISOString(),
  };

  db.cases[idx] = updated;
  return { ...updated };
}

// ============================================================================
// UPDATE APPROVAL CHAIN (edit approval sequence for pending cases)
// ============================================================================

export async function updateApprovalChain(
  caseId: string,
  newSteps: { approverId: string; approverName: string; approverRole: string }[],
  reason: string
): Promise<Case> {
  await randomDelay();

  const idx = db.cases.findIndex((c) => c.id === caseId);
  if (idx === -1) throw new Error(`Case not found: ${caseId}`);

  const caseData = db.cases[idx];
  if (!caseData.approvalChain) throw new Error('No approval chain found.');

  const chain = caseData.approvalChain;

  // Keep completed steps (APPROVED, RETURNED, REJECTED, SKIPPED) - they cannot be changed
  const completedSteps = chain.steps.filter(
    (s) => s.status !== 'PENDING'
  );

  // Build new pending steps from provided data
  const pendingSteps: ApprovalStep[] = newSteps.map((step, stepIdx) => {
    const stepNumber = completedSteps.length + stepIdx + 1;
    return {
      stepNumber,
      approverId: step.approverId,
      approverName: step.approverName,
      approverRole: step.approverRole,
      status: 'PENDING' as const,
      decision: null,
      comment: null,
      decidedAt: null,
    };
  });

  const allSteps = [...completedSteps, ...pendingSteps];

  // currentStepIndex points to the first PENDING step
  const firstPendingIdx = allSteps.findIndex((s) => s.status === 'PENDING');

  const updatedChain: ApprovalChain = {
    ...chain,
    steps: allSteps,
    currentStepIndex: firstPendingIdx >= 0 ? firstPendingIdx : allSteps.length,
  };

  // Log the change as a comment
  const { useAuthStore } = await import('@/stores/authStore');
  const authUser = useAuthStore.getState().user;
  const changeComment: ApprovalComment = {
    id: `CMT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    caseId,
    stepNumber: null,
    authorId: authUser?.id ?? 'agent-001',
    authorName: authUser?.fullName ?? 'AP Agent',
    authorRole: authUser?.role ?? 'AP_AGENT',
    content: `Approval sequence updated. Reason: ${reason}`,
    createdAt: new Date().toISOString(),
  };
  db.comments.push(changeComment);

  const updated: Case = {
    ...caseData,
    approvalChain: updatedChain,
    updatedAt: new Date().toISOString(),
  };

  db.cases[idx] = updated;
  return { ...updated };
}

// ============================================================================
// APPROVER-SPECIFIC HANDLERS
// ============================================================================

export async function fetchApproverCases(approverId: string, role?: string): Promise<Case[]> {
  await randomDelay();
  if (role === 'SUPER_ADMIN') {
    return db.cases.filter((c) => c.status === 'APPROVAL_PENDING');
  }
  return db.cases.filter(
    (c) =>
      c.approvalChain !== null &&
      c.approvalChain.steps.some((s) => s.approverId === approverId) &&
      c.status === 'APPROVAL_PENDING'
  );
}

// ============================================================================
// COMMENT HANDLERS
// ============================================================================

export async function fetchComments(caseId: string): Promise<ApprovalComment[]> {
  await randomDelay();
  return db.comments.filter((c) => c.caseId === caseId);
}

export async function addComment(
  caseId: string,
  content: string
): Promise<ApprovalComment> {
  await randomDelay();

  // Get current auth user from the Zustand store
  const { useAuthStore } = await import('@/stores/authStore');
  const user = useAuthStore.getState().user;

  const comment: ApprovalComment = {
    id: `CMT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    caseId,
    stepNumber: null,
    authorId: user?.id ?? 'unknown',
    authorName: user?.fullName ?? 'Unknown User',
    authorRole: user?.role ?? 'AP_AGENT',
    content,
    createdAt: new Date().toISOString(),
  };

  db.comments.push(comment);
  return { ...comment };
}

// ============================================================================
// NOTIFICATION HANDLERS
// ============================================================================

export async function fetchNotifications(): Promise<Notification[]> {
  await randomDelay();
  return [...db.notifications];
}

export async function markNotificationRead(id: string): Promise<void> {
  await randomDelay();
  const notification = db.notifications.find((n) => n.id === id);
  if (notification) {
    notification.isRead = true;
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  await randomDelay();
  db.notifications.forEach((n) => {
    n.isRead = true;
  });
}

// ============================================================================
// MASTER DATA HANDLERS
// ============================================================================

export async function fetchVendors(): Promise<Vendor[]> {
  await randomDelay();
  return [...db.vendors];
}

export async function fetchCostCenters(): Promise<CostCenter[]> {
  await randomDelay();
  return [...db.costCenters];
}

export async function fetchGLAccounts(): Promise<GLAccount[]> {
  await randomDelay();
  return [...db.glAccounts];
}

export async function fetchTaxCodes(): Promise<TaxCode[]> {
  await randomDelay();
  return [...db.taxCodes];
}

export async function fetchCompanyCodes(): Promise<CompanyCode[]> {
  await randomDelay();
  return [...db.companyCodes];
}

export async function fetchPlantCodes(): Promise<PlantCode[]> {
  await randomDelay();
  return [...db.plantCodes];
}

export async function fetchApprovalRules(): Promise<ApprovalRule[]> {
  await randomDelay();
  return [...db.approvalRules];
}

export async function fetchBusinessRuleConfigs(): Promise<BusinessRuleConfig[]> {
  await randomDelay();
  return [...db.businessRuleConfigs];
}

export async function fetchApprovalSequences(): Promise<ApprovalSequenceMaster[]> {
  await randomDelay();
  return [...db.approvalSequences];
}

export async function addVendor(
  data: Omit<Vendor, 'id' | 'contracts'>
): Promise<Vendor> {
  await randomDelay();

  const newVendor: Vendor = {
    ...data,
    id: `VND-${String(db.vendors.length + 1).padStart(3, '0')}`,
    contracts: [],
  };

  db.vendors.push(newVendor);
  return { ...newVendor };
}

export async function updateVendor(
  id: string,
  data: Partial<Vendor>
): Promise<Vendor> {
  await randomDelay();

  const idx = db.vendors.findIndex((v) => v.id === id);
  if (idx === -1) throw new Error(`Vendor not found: ${id}`);

  const updated = { ...db.vendors[idx], ...data, id } as Vendor;
  db.vendors[idx] = updated;
  return { ...updated };
}

export async function deleteVendor(id: string): Promise<void> {
  await randomDelay();

  const idx = db.vendors.findIndex((v) => v.id === id);
  if (idx === -1) throw new Error(`Vendor not found: ${id}`);

  db.vendors.splice(idx, 1);
}

export async function addUser(data: any): Promise<void> {
  await randomDelay();

  const newUser: User = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    fullName: `${data.firstName} ${data.lastName}`,
    role: data.role,
    department: data.department,
    isActive: true,
    approvalLimit: data.approvalLimit,
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);
}

// ============================================================================
// AUDIT LOG HANDLER
// ============================================================================

export async function fetchAuditLog(caseId: string): Promise<AuditLogEntry[]> {
  await randomDelay();
  return db.auditLogs
    .filter((e) => e.caseId === caseId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// ============================================================================
// USER HANDLERS
// ============================================================================

export async function fetchAllUsers(): Promise<User[]> {
  await randomDelay();
  return [...db.users];
}

// Alias used by UserManagement page (imports as `fetchUsers`)
export { fetchAllUsers as fetchUsers };

export async function updateUser(
  id: string,
  data: Partial<User>
): Promise<User> {
  await randomDelay();

  const idx = db.users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error(`User not found: ${id}`);

  const updated = { ...db.users[idx], ...data, id } as User;
  db.users[idx] = updated;
  return { ...updated };
}

// ============================================================================
// EMAIL HANDLERS
// ============================================================================

export async function fetchEmails(): Promise<EmailRecord[]> {
  await randomDelay();
  return [...db.emails];
}

// ============================================================================
// RATE CARD & AGREEMENT HANDLERS
// ============================================================================

export async function fetchFreightRateCards(): Promise<FreightRateCard[]> {
  await delay(200);
  return [...mockFreightRateCards];
}

export async function fetchServiceRateCards(): Promise<ServiceRateCard[]> {
  await delay(200);
  return [...mockServiceRateCards];
}

export async function fetchAgreementMasters(): Promise<AgreementMaster[]> {
  await delay(200);
  return [...mockAgreementMasters];
}

export async function fetchInvoiceCategoryConfigs(): Promise<typeof mockInvoiceCategoryConfigs> {
  await delay(200);
  return [...mockInvoiceCategoryConfigs];
}

// Prompt stubs (admin-only, real API required)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchPrompts(): Promise<any[]> { return []; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchPromptByStep(_step: string): Promise<any> { return null; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updatePrompt(_id: string, _data: { systemPrompt: string }): Promise<any> { return null; }
