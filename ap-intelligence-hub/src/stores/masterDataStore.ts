import { create } from 'zustand';
import type { Vendor, CostCenter, GLAccount, TaxCode, CompanyCode, PlantCode, ApprovalRule, BusinessRuleConfig, ApprovalSequenceMaster, FreightRateCard, ServiceRateCard, AgreementMaster } from '@/types/masterData';

interface MasterDataState {
  vendors: Vendor[];
  costCenters: CostCenter[];
  glAccounts: GLAccount[];
  taxCodes: TaxCode[];
  companyCodes: CompanyCode[];
  plantCodes: PlantCode[];
  approvalRules: ApprovalRule[];
  businessRuleConfigs: BusinessRuleConfig[];
  approvalSequences: ApprovalSequenceMaster[];
  freightRateCards: FreightRateCard[];
  serviceRateCards: ServiceRateCard[];
  agreementMasters: AgreementMaster[];
  invoiceCategoryConfigs: Record<string, unknown>[];
  isLoading: boolean;

  fetchVendors: () => Promise<void>;
  fetchCostCenters: () => Promise<void>;
  fetchGLAccounts: () => Promise<void>;
  fetchTaxCodes: () => Promise<void>;
  fetchCompanyCodes: () => Promise<void>;
  fetchPlantCodes: () => Promise<void>;
  fetchApprovalRules: () => Promise<void>;
  fetchBusinessRuleConfigs: () => Promise<void>;
  fetchApprovalSequences: () => Promise<void>;
  fetchFreightRateCards: () => Promise<void>;
  fetchServiceRateCards: () => Promise<void>;
  fetchAgreementMasters: () => Promise<void>;
  fetchInvoiceCategoryConfigs: () => Promise<void>;
  fetchAll: () => Promise<void>;

  addVendor: (vendor: Omit<Vendor, 'id' | 'contracts'>) => Promise<void>;
  updateVendor: (id: string, data: Partial<Vendor>) => Promise<void>;
  deleteVendor: (id: string) => Promise<void>;

  addUser: (user: { email: string; firstName: string; lastName: string; role: string; department: string; approvalLimit?: number }) => Promise<void>;
}

export const useMasterDataStore = create<MasterDataState>()((set) => ({
  vendors: [],
  costCenters: [],
  glAccounts: [],
  taxCodes: [],
  companyCodes: [],
  plantCodes: [],
  approvalRules: [],
  businessRuleConfigs: [],
  approvalSequences: [],
  freightRateCards: [],
  serviceRateCards: [],
  agreementMasters: [],
  invoiceCategoryConfigs: [],
  isLoading: false,

  fetchVendors: async () => {
    const { fetchVendors } = await import('@/mock/handlers');
    const vendors = await fetchVendors();
    set({ vendors });
  },

  fetchCostCenters: async () => {
    const { fetchCostCenters } = await import('@/mock/handlers');
    const costCenters = await fetchCostCenters();
    set({ costCenters });
  },

  fetchGLAccounts: async () => {
    const { fetchGLAccounts } = await import('@/mock/handlers');
    const glAccounts = await fetchGLAccounts();
    set({ glAccounts });
  },

  fetchTaxCodes: async () => {
    const { fetchTaxCodes } = await import('@/mock/handlers');
    const taxCodes = await fetchTaxCodes();
    set({ taxCodes });
  },

  fetchCompanyCodes: async () => {
    const { fetchCompanyCodes } = await import('@/mock/handlers');
    const companyCodes = await fetchCompanyCodes();
    set({ companyCodes });
  },

  fetchPlantCodes: async () => {
    const { fetchPlantCodes } = await import('@/mock/handlers');
    const plantCodes = await fetchPlantCodes();
    set({ plantCodes });
  },

  fetchApprovalRules: async () => {
    const { fetchApprovalRules } = await import('@/mock/handlers');
    const approvalRules = await fetchApprovalRules();
    set({ approvalRules });
  },

  fetchBusinessRuleConfigs: async () => {
    const { fetchBusinessRuleConfigs } = await import('@/mock/handlers');
    const businessRuleConfigs = await fetchBusinessRuleConfigs();
    set({ businessRuleConfigs });
  },

  fetchApprovalSequences: async () => {
    const { fetchApprovalSequences } = await import('@/mock/handlers');
    const approvalSequences = await fetchApprovalSequences();
    set({ approvalSequences });
  },

  fetchFreightRateCards: async () => {
    const { fetchFreightRateCards } = await import('@/mock/handlers');
    const freightRateCards = await fetchFreightRateCards();
    set({ freightRateCards });
  },

  fetchServiceRateCards: async () => {
    const { fetchServiceRateCards } = await import('@/mock/handlers');
    const serviceRateCards = await fetchServiceRateCards();
    set({ serviceRateCards });
  },

  fetchAgreementMasters: async () => {
    const { fetchAgreementMasters } = await import('@/mock/handlers');
    const agreementMasters = await fetchAgreementMasters();
    set({ agreementMasters });
  },

  fetchInvoiceCategoryConfigs: async () => {
    const { fetchInvoiceCategoryConfigs } = await import('@/mock/handlers');
    const invoiceCategoryConfigs = await fetchInvoiceCategoryConfigs();
    set({ invoiceCategoryConfigs });
  },

  fetchAll: async () => {
    set({ isLoading: true });
    const store = useMasterDataStore.getState();
    await Promise.all([
      store.fetchVendors(),
      store.fetchCostCenters(),
      store.fetchGLAccounts(),
      store.fetchTaxCodes(),
      store.fetchCompanyCodes(),
      store.fetchPlantCodes(),
      store.fetchApprovalRules(),
      store.fetchBusinessRuleConfigs(),
      store.fetchApprovalSequences(),
      store.fetchFreightRateCards(),
      store.fetchServiceRateCards(),
      store.fetchAgreementMasters(),
      store.fetchInvoiceCategoryConfigs(),
    ]);
    set({ isLoading: false });
  },

  addVendor: async (vendorData) => {
    const { addVendor } = await import('@/mock/handlers');
    const vendor = await addVendor(vendorData);
    set(state => ({ vendors: [...state.vendors, vendor] }));
  },

  updateVendor: async (id, data) => {
    const { updateVendor } = await import('@/mock/handlers');
    const vendor = await updateVendor(id, data);
    set(state => ({
      vendors: state.vendors.map(v => v.id === id ? vendor : v),
    }));
  },

  deleteVendor: async (id) => {
    const { deleteVendor } = await import('@/mock/handlers');
    await deleteVendor(id);
    set(state => ({
      vendors: state.vendors.filter(v => v.id !== id),
    }));
  },

  addUser: async (userData) => {
    const { addUser } = await import('@/mock/handlers');
    await addUser(userData);
  },
}));
