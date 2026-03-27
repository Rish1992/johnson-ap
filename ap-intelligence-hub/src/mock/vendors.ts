// Mock Vendors Data for InvoiceIQ
// Realistic Australian vendor entries with contracts, cost centers, GL accounts, and configuration data

import type { FreightRateCard, ServiceRateCard, AgreementMaster } from '@/types/masterData';

// ============================================================================
// VENDORS
// ============================================================================

export const mockVendors = [
  // --- UTILITY COMPANIES ---
  {
    id: 'VND-001',
    vendorNumber: 'V100001',
    name: 'AGL Energy Ltd',
    taxId: '74 115 061 375',
    address: 'Level 24, 200 George Street',
    city: 'Sydney',
    country: 'Australia',
    paymentTerms: 'NET30',
    bankAccount: 'SBIN0001234_10234567890',
    email: 'finance@aglenergy.com.au',
    branchCode: '001',
    currency: 'AUD',
    isActive: true,
    contracts: [
      {
        id: 'CON-001-A',
        vendorId: 'VND-001',
        contractNumber: 'TP-UTL-2024-0891',
        category: 'UTILITY' as const,
        startDate: '2024-04-01',
        endDate: '2027-03-31',
        maxAmount: 4500000,
        isActive: true,
      },
      {
        id: 'CON-001-B',
        vendorId: 'VND-001',
        contractNumber: 'TP-UTL-2025-1102',
        category: 'UTILITY' as const,
        startDate: '2025-01-01',
        endDate: '2026-12-31',
        maxAmount: 1200000,
        isActive: true,
      },
    ],
  },
  {
    id: 'VND-002',
    vendorNumber: 'V100002',
    name: 'Origin Energy Ltd',
    taxId: '30 000 051 696',
    address: 'Level 32, Tower 1, 100 Barangaroo Avenue',
    city: 'Sydney',
    country: 'Australia',
    paymentTerms: 'NET30',
    bankAccount: 'HDFC0000123_20345678901',
    email: 'finance@originenergy.com.au',
    branchCode: '002',
    currency: 'AUD',
    isActive: true,
    contracts: [
      {
        id: 'CON-002-A',
        vendorId: 'VND-002',
        contractNumber: 'BSES-UTL-2024-0456',
        category: 'UTILITY' as const,
        startDate: '2024-04-01',
        endDate: '2026-03-31',
        maxAmount: 3200000,
        isActive: true,
      },
    ],
  },
  {
    id: 'VND-003',
    vendorNumber: 'V100003',
    name: 'Sydney Water Corporation',
    taxId: '49 776 225 038',
    address: '1 Smith Street, Parramatta',
    city: 'Sydney',
    country: 'Australia',
    paymentTerms: 'NET15',
    bankAccount: 'PUNB0015600_30456789012',
    email: 'finance@sydneywater.com.au',
    branchCode: '003',
    currency: 'AUD',
    isActive: true,
    contracts: [
      {
        id: 'CON-003-A',
        vendorId: 'VND-003',
        contractNumber: 'DJB-UTL-2024-0223',
        category: 'UTILITY' as const,
        startDate: '2024-07-01',
        endDate: '2027-06-30',
        maxAmount: 1800000,
        isActive: true,
      },
    ],
  },
  {
    id: 'VND-004',
    vendorNumber: 'V100004',
    name: 'Telstra Corporation Ltd',
    taxId: '33 051 775 556',
    address: 'Level 41, 242 Exhibition Street',
    city: 'Melbourne',
    country: 'Australia',
    paymentTerms: 'NET45',
    bankAccount: 'CITI0000004_40567890123',
    email: 'finance@telstra.com.au',
    branchCode: '004',
    currency: 'AUD',
    isActive: true,
    contracts: [
      {
        id: 'CON-004-A',
        vendorId: 'VND-004',
        contractNumber: 'AIR-UTL-2025-0078',
        category: 'UTILITY' as const,
        startDate: '2025-01-01',
        endDate: '2027-12-31',
        maxAmount: 2400000,
        isActive: true,
      },
      {
        id: 'CON-004-B',
        vendorId: 'VND-004',
        contractNumber: 'AIR-INST-2025-0330',
        category: 'INSTALLATION' as const,
        startDate: '2025-04-01',
        endDate: '2026-03-31',
        maxAmount: 850000,
        isActive: true,
      },
    ],
  },
  {
    id: 'VND-005',
    vendorNumber: 'V100005',
    name: 'Optus Pty Ltd',
    taxId: '65 054 578 324',
    address: '1 Lyonpark Road, Macquarie Park',
    city: 'Sydney',
    country: 'Australia',
    paymentTerms: 'NET30',
    bankAccount: 'ICIC0000056_50678901234',
    email: 'finance@optus.com.au',
    branchCode: '005',
    currency: 'AUD',
    isActive: true,
    contracts: [
      {
        id: 'CON-005-A',
        vendorId: 'VND-005',
        contractNumber: 'JIO-UTL-2024-1455',
        category: 'UTILITY' as const,
        startDate: '2024-10-01',
        endDate: '2027-09-30',
        maxAmount: 3600000,
        isActive: true,
      },
    ],
  },

  // --- INSTALLATION CONTRACTORS ---
  {
    id: 'VND-006',
    vendorNumber: 'V100006',
    name: 'Prysmian Group Australia',
    taxId: '81 098 337 498',
    address: 'Level 7, 40 Mount Street',
    city: 'North Sydney',
    country: 'Australia',
    paymentTerms: 'NET60',
    bankAccount: 'AXIS0000789_60789012345',
    email: 'finance@prysmian.com.au',
    branchCode: '006',
    currency: 'AUD',
    isActive: true,
    contracts: [
      {
        id: 'CON-006-A',
        vendorId: 'VND-006',
        contractNumber: 'STL-INST-2024-0612',
        category: 'INSTALLATION' as const,
        startDate: '2024-06-01',
        endDate: '2026-05-31',
        maxAmount: 7500000,
        isActive: true,
      },
      {
        id: 'CON-006-B',
        vendorId: 'VND-006',
        contractNumber: 'STL-WARR-2024-0613',
        category: 'WARRANTY' as const,
        startDate: '2024-06-01',
        endDate: '2027-05-31',
        maxAmount: 1500000,
        isActive: true,
      },
    ],
  },
  {
    id: 'VND-007',
    vendorNumber: 'V100007',
    name: 'Daikin Australia Pty Ltd',
    taxId: '18 092 572 571',
    address: '75 Market Street, Condell Park',
    city: 'Sydney',
    country: 'Australia',
    paymentTerms: 'NET45',
    bankAccount: 'SBIN0005678_70890123456',
    email: 'finance@daikin.com.au',
    branchCode: '007',
    currency: 'AUD',
    isActive: true,
    contracts: [
      {
        id: 'CON-007-A',
        vendorId: 'VND-007',
        contractNumber: 'VLT-INST-2025-0201',
        category: 'INSTALLATION' as const,
        startDate: '2025-02-01',
        endDate: '2026-01-31',
        maxAmount: 5200000,
        isActive: true,
      },
      {
        id: 'CON-007-B',
        vendorId: 'VND-007',
        contractNumber: 'VLT-WARR-2025-0202',
        category: 'WARRANTY' as const,
        startDate: '2025-02-01',
        endDate: '2028-01-31',
        maxAmount: 2100000,
        isActive: true,
      },
    ],
  },
  {
    id: 'VND-008',
    vendorNumber: 'V100008',
    name: 'Olex Australia Pty Ltd',
    taxId: '46 004 235 055',
    address: '207 Greenhill Road, Eastwood',
    city: 'Adelaide',
    country: 'Australia',
    paymentTerms: 'NET30',
    bankAccount: 'HDFC0001234_80901234567',
    email: 'finance@olex.com.au',
    branchCode: '008',
    currency: 'AUD',
    isActive: true,
    contracts: [
      {
        id: 'CON-008-A',
        vendorId: 'VND-008',
        contractNumber: 'PLY-INST-2024-0934',
        category: 'INSTALLATION' as const,
        startDate: '2024-09-15',
        endDate: '2026-09-14',
        maxAmount: 4800000,
        isActive: true,
      },
    ],
  },
  {
    id: 'VND-009',
    vendorNumber: 'V100009',
    name: 'Downer Group Ltd',
    taxId: '97 003 872 848',
    address: 'Level 2, Triniti Business Campus, 39 Delhi Road',
    city: 'North Ryde',
    country: 'Australia',
    paymentTerms: 'NET60',
    bankAccount: 'ICIC0000890_90012345678',
    email: 'finance@downergroup.com.au',
    branchCode: '009',
    currency: 'AUD',
    isActive: true,
    contracts: [
      {
        id: 'CON-009-A',
        vendorId: 'VND-009',
        contractNumber: 'KEC-INST-2025-0115',
        category: 'INSTALLATION' as const,
        startDate: '2025-01-15',
        endDate: '2026-07-14',
        maxAmount: 12000000,
        isActive: true,
      },
      {
        id: 'CON-009-B',
        vendorId: 'VND-009',
        contractNumber: 'KEC-WARR-2025-0116',
        category: 'WARRANTY' as const,
        startDate: '2025-07-15',
        endDate: '2028-07-14',
        maxAmount: 3000000,
        isActive: false,
      },
    ],
  },
  {
    id: 'VND-010',
    vendorNumber: 'V100010',
    name: 'Mitsubishi Electric Australia Pty Ltd',
    taxId: '22 004 514 528',
    address: '348 Victoria Road, Rydalmere',
    city: 'Sydney',
    country: 'Australia',
    paymentTerms: 'NET45',
    bankAccount: 'UTIB0002345_10123456789',
    email: 'finance@mitsubishielectric.com.au',
    branchCode: '010',
    currency: 'AUD',
    isActive: true,
    contracts: [
      {
        id: 'CON-010-A',
        vendorId: 'VND-010',
        contractNumber: 'DKN-INST-2024-0788',
        category: 'INSTALLATION' as const,
        startDate: '2024-08-01',
        endDate: '2025-07-31',
        maxAmount: 6500000,
        isActive: false,
      },
      {
        id: 'CON-010-B',
        vendorId: 'VND-010',
        contractNumber: 'DKN-INST-2025-1001',
        category: 'INSTALLATION' as const,
        startDate: '2025-10-01',
        endDate: '2026-09-30',
        maxAmount: 7200000,
        isActive: true,
      },
    ],
  },

  // --- WARRANTY SERVICE PROVIDERS ---
  {
    id: 'VND-011',
    vendorNumber: 'V100011',
    name: 'Clipsal by Schneider Electric',
    taxId: '88 000 146 597',
    address: '33-37 Port Wakefield Road, Gepps Cross',
    city: 'Adelaide',
    country: 'Australia',
    paymentTerms: 'NET30',
    bankAccount: 'YESB0000567_11234567890',
    email: 'finance@clipsal.com.au',
    branchCode: '011',
    currency: 'AUD',
    isActive: true,
    contracts: [
      {
        id: 'CON-011-A',
        vendorId: 'VND-011',
        contractNumber: 'HVL-WARR-2024-0445',
        category: 'WARRANTY' as const,
        startDate: '2024-04-15',
        endDate: '2027-04-14',
        maxAmount: 3500000,
        isActive: true,
      },
      {
        id: 'CON-011-B',
        vendorId: 'VND-011',
        contractNumber: 'HVL-INST-2025-0890',
        category: 'INSTALLATION' as const,
        startDate: '2025-08-01',
        endDate: '2026-02-28',
        maxAmount: 1800000,
        isActive: true,
      },
    ],
  },
  {
    id: 'VND-012',
    vendorNumber: 'V100012',
    name: 'Carrier Air Conditioning Pty Ltd',
    taxId: '62 000 052 437',
    address: 'Building C, 1 Homebush Bay Drive',
    city: 'Rhodes',
    country: 'Australia',
    paymentTerms: 'NET45',
    bankAccount: 'KKBK0000678_12345678901',
    email: 'finance@carrier.com.au',
    branchCode: '012',
    currency: 'AUD',
    isActive: true,
    contracts: [
      {
        id: 'CON-012-A',
        vendorId: 'VND-012',
        contractNumber: 'BLS-WARR-2025-0155',
        category: 'WARRANTY' as const,
        startDate: '2025-01-15',
        endDate: '2028-01-14',
        maxAmount: 4200000,
        isActive: true,
      },
    ],
  },
  {
    id: 'VND-013',
    vendorNumber: 'V100013',
    name: 'Nexans Australia Pty Ltd',
    taxId: '52 003 592 437',
    address: '207 Maidstone Street, Altona',
    city: 'Melbourne',
    country: 'Australia',
    paymentTerms: 'NET30',
    bankAccount: 'BARB0PIMPRI_13456789012',
    email: 'finance@nexans.com.au',
    branchCode: '013',
    currency: 'AUD',
    isActive: true,
    contracts: [
      {
        id: 'CON-013-A',
        vendorId: 'VND-013',
        contractNumber: 'FNX-WARR-2024-0678',
        category: 'WARRANTY' as const,
        startDate: '2024-06-01',
        endDate: '2026-05-31',
        maxAmount: 2800000,
        isActive: true,
      },
      {
        id: 'CON-013-B',
        vendorId: 'VND-013',
        contractNumber: 'FNX-INST-2025-0320',
        category: 'INSTALLATION' as const,
        startDate: '2025-03-20',
        endDate: '2025-12-31',
        maxAmount: 3200000,
        isActive: true,
      },
    ],
  },
  {
    id: 'VND-014',
    vendorNumber: 'V100014',
    name: 'Reece Group Ltd',
    taxId: '49 004 313 133',
    address: '118 Burwood Highway, Burwood East',
    city: 'Melbourne',
    country: 'Australia',
    paymentTerms: 'NET30',
    bankAccount: 'CNRB0000345_14567890123',
    email: 'finance@reece.com.au',
    branchCode: '014',
    currency: 'AUD',
    isActive: true,
    contracts: [
      {
        id: 'CON-014-A',
        vendorId: 'VND-014',
        contractNumber: 'ASH-WARR-2025-0210',
        category: 'WARRANTY' as const,
        startDate: '2025-02-10',
        endDate: '2028-02-09',
        maxAmount: 2200000,
        isActive: true,
      },
    ],
  },
  {
    id: 'VND-015',
    vendorNumber: 'V100015',
    name: 'Schneider Electric Australia Pty Ltd',
    taxId: '58 004 969 304',
    address: '78 Waterloo Road, Macquarie Park',
    city: 'Sydney',
    country: 'Australia',
    paymentTerms: 'NET60',
    bankAccount: 'HSBC0400002_15678901234',
    email: 'finance@schneider-electric.com.au',
    branchCode: '015',
    currency: 'AUD',
    isActive: false,
    contracts: [
      {
        id: 'CON-015-A',
        vendorId: 'VND-015',
        contractNumber: 'SCH-WARR-2023-0990',
        category: 'WARRANTY' as const,
        startDate: '2023-10-01',
        endDate: '2025-09-30',
        maxAmount: 5500000,
        isActive: false,
      },
      {
        id: 'CON-015-B',
        vendorId: 'VND-015',
        contractNumber: 'SCH-INST-2024-0112',
        category: 'INSTALLATION' as const,
        startDate: '2024-01-15',
        endDate: '2025-01-14',
        maxAmount: 8500000,
        isActive: false,
      },
    ],
  },
];

// ============================================================================
// COST CENTERS
// ============================================================================

export const mockCostCenters = [
  { id: 'CC-001', code: 'CC1001', name: 'Facilities Management', department: 'Operations', companyCode: 'JC01', isActive: true },
  { id: 'CC-002', code: 'CC1002', name: 'IT Infrastructure', department: 'IT', companyCode: 'JC01', isActive: true },
  { id: 'CC-003', code: 'CC1003', name: 'Telecom Operations', department: 'IT', companyCode: 'JC01', isActive: true },
  { id: 'CC-004', code: 'CC1004', name: 'Project Delivery - North', department: 'Projects', companyCode: 'JC01', isActive: true },
  { id: 'CC-005', code: 'CC1005', name: 'Project Delivery - West', department: 'Projects', companyCode: 'JC01', isActive: true },
  { id: 'CC-006', code: 'CC1006', name: 'Procurement & Supply Chain', department: 'Procurement', companyCode: 'JC01', isActive: true },
  { id: 'CC-007', code: 'CC1007', name: 'Maintenance & Repairs', department: 'Operations', companyCode: 'JC01', isActive: true },
  { id: 'CC-008', code: 'CC1008', name: 'Quality Assurance', department: 'Quality', companyCode: 'JC01', isActive: true },
  { id: 'CC-009', code: 'CC1009', name: 'Human Resources', department: 'HR', companyCode: 'JC01', isActive: true },
  { id: 'CC-010', code: 'CC1010', name: 'Finance & Accounts', department: 'Finance', companyCode: 'JC01', isActive: true },
];

// ============================================================================
// GL ACCOUNTS
// ============================================================================

export const mockGLAccounts = [
  { id: 'GL-001', accountNumber: '400100', name: 'Electricity Expenses', type: 'EXPENSE' as const, companyCode: 'JC01', isActive: true },
  { id: 'GL-002', accountNumber: '400200', name: 'Water & Sewerage Expenses', type: 'EXPENSE' as const, companyCode: 'JC01', isActive: true },
  { id: 'GL-003', accountNumber: '400300', name: 'Telecom & Internet Expenses', type: 'EXPENSE' as const, companyCode: 'JC01', isActive: true },
  { id: 'GL-004', accountNumber: '500100', name: 'Cable Installation - Materials', type: 'EXPENSE' as const, companyCode: 'JC01', isActive: true },
  { id: 'GL-005', accountNumber: '500200', name: 'Cable Installation - Labour', type: 'EXPENSE' as const, companyCode: 'JC01', isActive: true },
  { id: 'GL-006', accountNumber: '500300', name: 'HVAC Installation & Commissioning', type: 'EXPENSE' as const, companyCode: 'JC01', isActive: true },
  { id: 'GL-007', accountNumber: '500400', name: 'Fiber Optic Network Installation', type: 'EXPENSE' as const, companyCode: 'JC01', isActive: true },
  { id: 'GL-008', accountNumber: '600100', name: 'Equipment Warranty Services', type: 'EXPENSE' as const, companyCode: 'JC01', isActive: true },
  { id: 'GL-009', accountNumber: '600200', name: 'Electrical Warranty Claims', type: 'EXPENSE' as const, companyCode: 'JC01', isActive: true },
  { id: 'GL-010', accountNumber: '600300', name: 'Plumbing Warranty Services', type: 'EXPENSE' as const, companyCode: 'JC01', isActive: true },
  { id: 'GL-011', accountNumber: '700100', name: 'Capital Expenditure - Equipment', type: 'ASSET' as const, companyCode: 'JC01', isActive: true },
  { id: 'GL-012', accountNumber: '210100', name: 'Accounts Payable - Trade', type: 'LIABILITY' as const, companyCode: 'JC01', isActive: true },
];

// ============================================================================
// TAX CODES
// ============================================================================

export const mockTaxCodes = [
  { id: 'TAX-001', code: 'GST10', description: 'Standard GST rate for most goods and services', rate: 10, country: 'Australia', isActive: true },
  { id: 'TAX-002', code: 'GST0', description: 'GST-free supplies (basic food, medical, education)', rate: 0, country: 'Australia', isActive: true },
  { id: 'TAX-003', code: 'INPUT', description: 'Input taxed supplies (financial, residential rent)', rate: 0, country: 'Australia', isActive: true },
  { id: 'TAX-004', code: 'EXEMPT', description: 'Exempted from GST', rate: 0, country: 'Australia', isActive: true },
  { id: 'TAX-005', code: 'WINE', description: 'Wine equalisation tax plus GST', rate: 29, country: 'Australia', isActive: true },
  { id: 'TAX-006', code: 'RCMGST10', description: 'Reverse Charge Mechanism at 10%', rate: 10, country: 'Australia', isActive: true },
];

// ============================================================================
// COMPANY CODES
// ============================================================================

export const mockCompanyCodes = [
  { id: 'COMP-001', code: 'JC01', name: 'Johnson Controls Australia Pty Ltd', country: 'Australia', currency: 'AUD', isActive: true },
  { id: 'COMP-002', code: 'JC02', name: 'Johnson Controls (NSW) Pty Ltd', country: 'Australia', currency: 'AUD', isActive: true },
  { id: 'COMP-003', code: 'JC03', name: 'Johnson Controls Engineering Services Pty Ltd', country: 'Australia', currency: 'AUD', isActive: true },
];

// ============================================================================
// PLANT CODES
// ============================================================================

export const mockPlantCodes = [
  { id: 'PLT-001', code: 'P1001', name: 'Sydney Manufacturing Plant', companyCode: 'JC01', address: 'Silverwater, NSW', isActive: true },
  { id: 'PLT-002', code: 'P1002', name: 'Melbourne Assembly Unit', companyCode: 'JC01', address: 'Scoresby, VIC', isActive: true },
  { id: 'PLT-003', code: 'P2001', name: 'North Sydney Operations Facility', companyCode: 'JC02', address: 'North Sydney, NSW', isActive: true },
  { id: 'PLT-004', code: 'P3001', name: 'Brisbane Technology Center', companyCode: 'JC03', address: 'Brisbane, QLD', isActive: true },
  { id: 'PLT-005', code: 'P3002', name: 'Perth Service Hub', companyCode: 'JC03', address: 'Perth, WA', isActive: true },
];

// ============================================================================
// APPROVAL RULES
// ============================================================================

export const mockApprovalRules = [
  {
    id: 'APR-001',
    name: 'Standard Invoice Approval',
    category: 'UTILITY' as const,
    minAmount: 0,
    maxAmount: 500000,
    requiredApprovers: 1,
    approverIds: ['approver-001'],
    slaHours: 48,
    isActive: true,
  },
  {
    id: 'APR-002',
    name: 'High Value Invoice Approval',
    category: 'INSTALLATION' as const,
    minAmount: 0,
    maxAmount: 2000000,
    requiredApprovers: 2,
    approverIds: ['approver-001', 'approver-003'],
    slaHours: 72,
    isActive: true,
  },
  {
    id: 'APR-003',
    name: 'Executive Approval Required',
    category: 'WARRANTY' as const,
    minAmount: 0,
    maxAmount: 5000000,
    requiredApprovers: 1,
    approverIds: ['approver-002'],
    slaHours: 48,
    isActive: true,
  },
  {
    id: 'APR-004',
    name: 'Utility Auto-Approval',
    category: 'UTILITY' as const,
    minAmount: 500001,
    maxAmount: 2000000,
    requiredApprovers: 2,
    approverIds: ['approver-002', 'approver-003'],
    slaHours: 96,
    isActive: true,
  },
  {
    id: 'APR-005',
    name: 'New Vendor First Invoice',
    category: 'INSTALLATION' as const,
    minAmount: 2000001,
    maxAmount: 10000000,
    requiredApprovers: 3,
    approverIds: ['approver-001', 'approver-003', 'approver-005'],
    slaHours: 120,
    isActive: true,
  },
];

// ============================================================================
// BUSINESS RULE CONFIGS
// ============================================================================

export const mockBusinessRuleConfigs = [
  {
    id: 'BRC-001',
    name: 'Duplicate Invoice Detection',
    description: 'Flag invoices with same vendor, amount, and date within 30-day window',
    category: 'ALL' as const,
    field: 'invoiceNumber',
    condition: 'not_duplicate',
    severity: 'ERROR' as const,
    isActive: true,
  },
  {
    id: 'BRC-002',
    name: 'Contract Amount Threshold',
    description: 'Block invoices that would cause contract spending to exceed 95% of max amount',
    category: 'ALL' as const,
    field: 'totalAmount',
    condition: 'within_contract_limit',
    severity: 'ERROR' as const,
    isActive: true,
  },
  {
    id: 'BRC-003',
    name: 'PO Matching - Three-Way',
    description: 'Require three-way match (PO, GRN, Invoice) for installation invoices above AUD 100,000',
    category: 'INSTALLATION' as const,
    field: 'purchaseOrderNumber',
    condition: 'three_way_match',
    severity: 'ERROR' as const,
    isActive: true,
  },
  {
    id: 'BRC-004',
    name: 'Tax Validation - GST',
    description: 'Validate ABN format and cross-check with ABR',
    category: 'ALL' as const,
    field: 'taxId',
    condition: 'valid_abn_format',
    severity: 'WARNING' as const,
    isActive: true,
  },
  {
    id: 'BRC-005',
    name: 'Payment Terms Compliance',
    description: 'Ensure invoice payment terms match vendor master data or contract terms',
    category: 'ALL' as const,
    field: 'paymentTerms',
    condition: 'matches_vendor_terms',
    severity: 'WARNING' as const,
    isActive: true,
  },
  {
    id: 'BRC-006',
    name: 'Budget Check - Cost Center',
    description: 'Validate invoice amount against remaining budget for the assigned cost center',
    category: 'ALL' as const,
    field: 'costCenter',
    condition: 'within_budget',
    severity: 'ERROR' as const,
    isActive: true,
  },
  {
    id: 'BRC-007',
    name: 'Auto GL Account Assignment',
    description: 'Automatically assign GL account based on invoice category and vendor type',
    category: 'ALL' as const,
    field: 'glAccount',
    condition: 'auto_assign_by_category',
    severity: 'INFO' as const,
    isActive: true,
  },
  {
    id: 'BRC-008',
    name: 'Late Payment Penalty Detection',
    description: 'Flag invoices that include late payment penalties or interest charges',
    category: 'ALL' as const,
    field: 'description',
    condition: 'no_late_penalty',
    severity: 'WARNING' as const,
    isActive: true,
  },
];

// ============================================================================
// INBOX CONFIGS
// ============================================================================

export const mockInboxConfigs = [
  {
    id: 'INB-001',
    name: 'Primary AP Inbox',
    emailAddress: 'ap-invoices@johnsoncontrols.com.au',
    description: 'Main accounts payable inbox for all vendor invoices',
    companyCode: 'JC01',
    isActive: true,
    autoProcessing: true,
    allowedFileTypes: ['pdf', 'jpg', 'png', 'tiff'],
    maxFileSizeMB: 25,
    processingSchedule: 'Every 15 minutes',
  },
  {
    id: 'INB-002',
    name: 'North Region AP Inbox',
    emailAddress: 'ap-north@johnsoncontrols.com.au',
    description: 'Accounts payable inbox for Northern region operations',
    companyCode: 'JC02',
    isActive: true,
    autoProcessing: true,
    allowedFileTypes: ['pdf', 'jpg', 'png'],
    maxFileSizeMB: 20,
    processingSchedule: 'Every 30 minutes',
  },
  {
    id: 'INB-003',
    name: 'Engineering Services AP Inbox',
    emailAddress: 'ap-engineering@johnsoncontrols.com.au',
    description: 'Accounts payable inbox for engineering and technology services',
    companyCode: 'JC03',
    isActive: true,
    autoProcessing: false,
    allowedFileTypes: ['pdf'],
    maxFileSizeMB: 15,
    processingSchedule: 'Manual trigger',
  },
];

// ============================================================================
// EXTRACTION TEMPLATES
// ============================================================================

export const mockExtractionTemplates = [
  {
    id: 'EXT-001',
    name: 'Standard Australian Tax Invoice',
    description: 'Template for extracting data from GST-compliant Australian tax invoices',
    category: 'UTILITY',
    fields: [
      { name: 'invoiceNumber', label: 'Invoice Number', type: 'string', required: true, confidence: 0.95 },
      { name: 'invoiceDate', label: 'Invoice Date', type: 'date', required: true, confidence: 0.93 },
      { name: 'vendorName', label: 'Vendor Name', type: 'string', required: true, confidence: 0.90 },
      { name: 'vendorABN', label: 'Vendor ABN', type: 'string', required: true, confidence: 0.92 },
      { name: 'buyerABN', label: 'Buyer ABN', type: 'string', required: true, confidence: 0.91 },
      { name: 'totalAmount', label: 'Total Amount', type: 'number', required: true, confidence: 0.94 },
      { name: 'gstAmount', label: 'GST Amount', type: 'number', required: false, confidence: 0.88 },
    ],
    isActive: true,
    version: '2.1',
  },
  {
    id: 'EXT-002',
    name: 'Installation Work Completion Certificate',
    description: 'Template for extracting data from installation job completion and billing documents',
    category: 'INSTALLATION',
    fields: [
      { name: 'invoiceNumber', label: 'Invoice / Bill Number', type: 'string', required: true, confidence: 0.93 },
      { name: 'invoiceDate', label: 'Bill Date', type: 'date', required: true, confidence: 0.91 },
      { name: 'workOrderNumber', label: 'Work Order / PO Number', type: 'string', required: true, confidence: 0.89 },
      { name: 'vendorName', label: 'Contractor Name', type: 'string', required: true, confidence: 0.92 },
      { name: 'projectSite', label: 'Project Site / Location', type: 'string', required: true, confidence: 0.85 },
      { name: 'materialsAmount', label: 'Materials Cost', type: 'number', required: false, confidence: 0.86 },
      { name: 'labourAmount', label: 'Labour Cost', type: 'number', required: false, confidence: 0.84 },
      { name: 'totalAmount', label: 'Total Bill Amount', type: 'number', required: true, confidence: 0.92 },
      { name: 'completionDate', label: 'Work Completion Date', type: 'date', required: true, confidence: 0.88 },
      { name: 'certifiedBy', label: 'Certified By (Site Engineer)', type: 'string', required: false, confidence: 0.78 },
    ],
    isActive: true,
    version: '1.4',
  },
  {
    id: 'EXT-003',
    name: 'Warranty Claim & Service Invoice',
    description: 'Template for extracting data from warranty service invoices and AMC billing',
    category: 'WARRANTY',
    fields: [
      { name: 'invoiceNumber', label: 'Service Invoice Number', type: 'string', required: true, confidence: 0.94 },
      { name: 'invoiceDate', label: 'Invoice Date', type: 'date', required: true, confidence: 0.93 },
      { name: 'vendorName', label: 'Service Provider Name', type: 'string', required: true, confidence: 0.91 },
      { name: 'contractNumber', label: 'AMC / Warranty Contract Number', type: 'string', required: true, confidence: 0.87 },
      { name: 'equipmentId', label: 'Equipment / Asset ID', type: 'string', required: false, confidence: 0.80 },
      { name: 'serviceType', label: 'Service Type', type: 'string', required: true, confidence: 0.83 },
      { name: 'servicePeriodFrom', label: 'Service Period From', type: 'date', required: false, confidence: 0.85 },
      { name: 'servicePeriodTo', label: 'Service Period To', type: 'date', required: false, confidence: 0.85 },
      { name: 'totalAmount', label: 'Total Amount', type: 'number', required: true, confidence: 0.93 },
      { name: 'warrantyStatus', label: 'Under Warranty (Y/N)', type: 'string', required: false, confidence: 0.76 },
    ],
    isActive: true,
    version: '1.2',
  },
];

// ============================================================================
// NOTIFICATION RULES
// ============================================================================

export const mockNotificationRules = [
  {
    id: 'NTF-001',
    name: 'Invoice Pending Approval Reminder',
    description: 'Send reminder to approver if invoice is pending approval for more than 48 hours',
    event: 'APPROVAL_PENDING',
    channel: 'EMAIL',
    recipients: ['approver'],
    delayHours: 48,
    isActive: true,
    template: 'Invoice {{invoiceNumber}} from {{vendorName}} (AUD {{amount}}) is awaiting your approval since {{submissionDate}}.',
  },
  {
    id: 'NTF-002',
    name: 'Invoice Rejection Notification',
    description: 'Notify AP clerk and vendor contact when an invoice is rejected',
    event: 'INVOICE_REJECTED',
    channel: 'EMAIL',
    recipients: ['ap_clerk', 'vendor_contact'],
    delayHours: 0,
    isActive: true,
    template: 'Invoice {{invoiceNumber}} has been rejected by {{rejectedBy}}. Reason: {{rejectionReason}}.',
  },
  {
    id: 'NTF-003',
    name: 'Payment Due Alert',
    description: 'Alert AP team 3 days before invoice payment due date to avoid late fees',
    event: 'PAYMENT_DUE_APPROACHING',
    channel: 'EMAIL',
    recipients: ['ap_team'],
    delayHours: -72,
    isActive: true,
    template: 'Payment for Invoice {{invoiceNumber}} (AUD {{amount}}) to {{vendorName}} is due on {{dueDate}}. Please ensure timely processing.',
  },
  {
    id: 'NTF-004',
    name: 'Contract Expiry Warning',
    description: 'Notify procurement team 30 days before a vendor contract expires',
    event: 'CONTRACT_EXPIRY',
    channel: 'EMAIL',
    recipients: ['procurement_team', 'contract_owner'],
    delayHours: -720,
    isActive: true,
    template: 'Contract {{contractNumber}} with {{vendorName}} expires on {{expiryDate}}. Please initiate renewal or rebidding process.',
  },
  {
    id: 'NTF-005',
    name: 'Duplicate Invoice Detected',
    description: 'Immediately alert AP supervisor when a potential duplicate invoice is detected',
    event: 'DUPLICATE_DETECTED',
    channel: 'EMAIL',
    recipients: ['ap_supervisor', 'ap_clerk'],
    delayHours: 0,
    isActive: true,
    template: 'Potential duplicate detected: Invoice {{invoiceNumber}} from {{vendorName}} matches existing invoice {{matchedInvoiceNumber}} (Amount: AUD {{amount}}, Date: {{invoiceDate}}).',
  },
];

// ============================================================================
// INVOICE CATEGORY CONFIGS
// ============================================================================

export const mockInvoiceCategoryConfigs = [
  {
    id: 'ICAT-001',
    category: 'UTILITY',
    name: 'Utility Invoices',
    description: 'Electricity, water, telecom, and other recurring utility bills',
    defaultGLAccount: '400100',
    defaultCostCenter: 'CC1001',
    requiresPO: false,
    requiresGRN: false,
    autoMatchEnabled: true,
    tolerancePercent: 10,
    defaultTaxCode: 'GST10',
    approvalWorkflow: 'STANDARD',
    isActive: true,
  },
  {
    id: 'ICAT-002',
    category: 'INSTALLATION',
    name: 'Installation Invoices',
    description: 'Cable installation, fiber optic laying, HVAC setup, and project-based work',
    defaultGLAccount: '500100',
    defaultCostCenter: 'CC1004',
    requiresPO: true,
    requiresGRN: true,
    autoMatchEnabled: false,
    tolerancePercent: 5,
    defaultTaxCode: 'GST10',
    approvalWorkflow: 'THREE_WAY_MATCH',
    isActive: true,
  },
  {
    id: 'ICAT-003',
    category: 'WARRANTY',
    name: 'Warranty & AMC Invoices',
    description: 'Annual maintenance contracts, warranty claims, and equipment servicing',
    defaultGLAccount: '600100',
    defaultCostCenter: 'CC1007',
    requiresPO: false,
    requiresGRN: false,
    autoMatchEnabled: true,
    tolerancePercent: 0,
    defaultTaxCode: 'GST10',
    approvalWorkflow: 'CONTRACT_MATCH',
    isActive: true,
  },
];

// ============================================================================
// FREIGHT RATE CARDS
// ============================================================================

export const mockFreightRateCards: FreightRateCard[] = [
  { id: 'FRC-001', origin: 'Taipei, Taiwan', destination: 'Sydney, Australia', containerType: '40ft', rate: 3200, currency: 'AUD', vendorId: 'VND-006', isActive: true },
  { id: 'FRC-002', origin: 'Shanghai, China', destination: 'Melbourne, Australia', containerType: '20ft', rate: 1850, currency: 'AUD', vendorId: 'VND-006', isActive: true },
  { id: 'FRC-003', origin: 'Shanghai, China', destination: 'Sydney, Australia', containerType: '40ft', rate: 3400, currency: 'AUD', vendorId: 'VND-008', isActive: true },
  { id: 'FRC-004', origin: 'Los Angeles, USA', destination: 'Sydney, Australia', containerType: '40ft', rate: 4100, currency: 'AUD', vendorId: 'VND-009', isActive: true },
  { id: 'FRC-005', origin: 'Taipei, Taiwan', destination: 'Auckland, New Zealand', containerType: 'LCL', rate: 950, currency: 'NZD', vendorId: 'VND-006', isActive: true },
  { id: 'FRC-006', origin: 'Shanghai, China', destination: 'Auckland, New Zealand', containerType: '20ft', rate: 2100, currency: 'NZD', vendorId: 'VND-008', isActive: true },
  { id: 'FRC-007', origin: 'Los Angeles, USA', destination: 'Melbourne, Australia', containerType: 'LCL', rate: 1200, currency: 'AUD', vendorId: 'VND-009', isActive: false },
];

// ============================================================================
// SERVICE RATE CARDS
// ============================================================================

export const mockServiceRateCards: ServiceRateCard[] = [
  { id: 'SRC-001', service: 'Installation', rate: 450, currency: 'AUD', vendorId: 'VND-007', isActive: true },
  { id: 'SRC-002', service: 'Repair - Warranty', rate: 0, currency: 'AUD', vendorId: 'VND-011', isActive: true },
  { id: 'SRC-003', service: 'Repair - Non-Warranty', rate: 285, currency: 'AUD', vendorId: 'VND-011', isActive: true },
  { id: 'SRC-004', service: 'Maintenance', rate: 175, currency: 'AUD', vendorId: 'VND-012', isActive: true },
  { id: 'SRC-005', service: 'Delivery', rate: 120, currency: 'AUD', vendorId: 'VND-009', isActive: true },
  { id: 'SRC-006', service: 'Installation', rate: 520, currency: 'NZD', vendorId: 'VND-010', isActive: true },
  { id: 'SRC-007', service: 'Maintenance', rate: 195, currency: 'NZD', vendorId: 'VND-012', isActive: false },
];

// ============================================================================
// AGREEMENT MASTERS
// ============================================================================

export const mockAgreementMasters: AgreementMaster[] = [
  { id: 'AGR-001', vendorId: 'VND-001', vendorName: 'AGL Energy Ltd', agreementNumber: 'AGR-UTL-2024-001', status: 'Active', startDate: '2024-04-01', endDate: '2027-03-31', isActive: true },
  { id: 'AGR-002', vendorId: 'VND-006', vendorName: 'Prysmian Group Australia', agreementNumber: 'AGR-INST-2024-002', status: 'Active', startDate: '2024-06-01', endDate: '2026-05-31', isActive: true },
  { id: 'AGR-003', vendorId: 'VND-011', vendorName: 'Clipsal by Schneider Electric', agreementNumber: 'AGR-WARR-2024-003', status: 'Active', startDate: '2024-04-15', endDate: '2027-04-14', isActive: true },
  { id: 'AGR-004', vendorId: 'VND-015', vendorName: 'Schneider Electric Australia Pty Ltd', agreementNumber: 'AGR-WARR-2023-004', status: 'Expired', startDate: '2023-10-01', endDate: '2025-09-30', isActive: false },
  { id: 'AGR-005', vendorId: 'VND-009', vendorName: 'Downer Group Ltd', agreementNumber: 'AGR-INST-2025-005', status: 'Active', startDate: '2025-01-15', endDate: '2026-07-14', isActive: true },
  { id: 'AGR-006', vendorId: 'VND-004', vendorName: 'Telstra Corporation Ltd', agreementNumber: 'AGR-UTL-2025-006', status: 'Pending', startDate: '2025-07-01', endDate: '2028-06-30', isActive: false },
  { id: 'AGR-007', vendorId: 'VND-007', vendorName: 'Daikin Australia Pty Ltd', agreementNumber: 'AGR-INST-2025-007', status: 'Active', startDate: '2025-02-01', endDate: '2026-01-31', isActive: true },
];
