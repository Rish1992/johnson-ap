import { create } from 'zustand';
import type { Case, InvoiceHeaderData, LineItem, BusinessRuleResult } from '@/types/case';
import type { ApprovalComment } from '@/types/case';
import type { FilterState } from '@/types/filters';
import { defaultFilterState } from '@/types/filters';

interface CaseState {
  cases: Case[];
  selectedCase: Case | null;
  isLoadingCases: boolean;
  isLoadingDetail: boolean;
  filters: FilterState;
  draftHeaderData: Partial<InvoiceHeaderData> | null;
  draftLineItems: LineItem[] | null;
  isDirty: boolean;
  businessRuleResults: BusinessRuleResult[];
  comments: ApprovalComment[];

  fetchCases: (filters?: Partial<FilterState>) => Promise<void>;
  fetchCaseById: (id: string) => Promise<void>;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  updateDraftField: (field: string, value: string | number) => void;
  updateDraftLineItem: (lineItemId: string, field: string, value: string | number) => void;
  addLineItem: () => void;
  removeLineItem: (lineItemId: string) => void;
  saveDraft: () => Promise<void>;
  saveAndConfirm: () => Promise<void>;
  rejectCase: (reason: string) => Promise<void>;
  submitForApproval: (approverIds: string[], comment?: string) => Promise<void>;
  approveCase: (comment: string) => Promise<void>;
  sendBackCase: (reason: string) => Promise<void>;
  rejectCaseAsApprover: (reason: string) => Promise<void>;
  resubmitCase: (approverIds: string[], comment?: string) => Promise<void>;
  updateApprovalChain: (newSteps: { approverId: string; approverName: string; approverRole: string }[], reason: string) => Promise<void>;
  fetchComments: (caseId: string) => Promise<void>;
  addComment: (content: string) => Promise<void>;
  clearSelectedCase: () => void;
  clearDraft: () => void;
  initDraft: () => void;
}

export const useCaseStore = create<CaseState>()((set, get) => ({
  cases: [],
  selectedCase: null,
  isLoadingCases: false,
  isLoadingDetail: false,
  filters: defaultFilterState,
  draftHeaderData: null,
  draftLineItems: null,
  isDirty: false,
  businessRuleResults: [],
  comments: [],

  fetchCases: async (filterOverrides) => {
    set({ isLoadingCases: true });
    try {
      const { fetchCases } = await import('@/mock/handlers');
      const filters = { ...get().filters, ...filterOverrides };
      const cases = await fetchCases(filters);
      set({ cases, isLoadingCases: false, filters });
    } catch {
      set({ isLoadingCases: false });
    }
  },

  fetchCaseById: async (id: string) => {
    set({ isLoadingDetail: true });
    try {
      const { fetchCaseById } = await import('@/mock/handlers');
      const selectedCase = await fetchCaseById(id);
      set({ selectedCase, isLoadingDetail: false });
    } catch {
      set({ isLoadingDetail: false });
    }
  },

  setFilters: (newFilters) => {
    const filters = { ...get().filters, ...newFilters };
    set({ filters });
    get().fetchCases(filters);
  },

  resetFilters: () => {
    set({ filters: defaultFilterState });
    get().fetchCases(defaultFilterState);
  },

  initDraft: () => {
    const selectedCase = get().selectedCase;
    if (selectedCase) {
      set({
        draftHeaderData: { ...selectedCase.headerData },
        draftLineItems: selectedCase.lineItems.map(li => ({ ...li })),
        isDirty: false,
        businessRuleResults: selectedCase.businessRuleResults,
      });
    }
  },

  updateDraftField: (field, value) => {
    const draft = get().draftHeaderData || {};
    set({
      draftHeaderData: { ...draft, [field]: value },
      isDirty: true,
    });
  },

  updateDraftLineItem: (lineItemId, field, value) => {
    const items = get().draftLineItems || [];
    set({
      draftLineItems: items.map(item =>
        item.id === lineItemId ? { ...item, [field]: value } : item
      ),
      isDirty: true,
    });
  },

  addLineItem: () => {
    const items = get().draftLineItems || [];
    const newItem: LineItem = {
      id: `li-new-${Date.now()}`,
      lineNumber: items.length + 1,
      description: '',
      quantity: 0,
      unitPrice: 0,
      unit: 'EA',
      totalAmount: 0,
      taxAmount: 0,
      glAccount: '',
      costCenter: '',
    };
    set({ draftLineItems: [...items, newItem], isDirty: true });
  },

  removeLineItem: (lineItemId) => {
    const items = get().draftLineItems || [];
    set({
      draftLineItems: items.filter(item => item.id !== lineItemId),
      isDirty: true,
    });
  },

  saveDraft: async () => {
    const { selectedCase, draftHeaderData, draftLineItems } = get();
    if (!selectedCase) return;

    try {
      const { saveDraft, runBusinessRules } = await import('@/mock/handlers');
      const updated = await saveDraft(selectedCase.id, {
        headerData: { ...selectedCase.headerData, ...draftHeaderData },
        lineItems: draftLineItems || selectedCase.lineItems,
      });
      const ruleResults = await runBusinessRules(selectedCase.id);
      set({
        selectedCase: updated,
        businessRuleResults: ruleResults,
        isDirty: false,
      });
    } catch {
      // handle error
    }
  },

  saveAndConfirm: async () => {
    const { selectedCase, draftHeaderData, draftLineItems } = get();
    if (!selectedCase) return;

    try {
      const { saveAndConfirm } = await import('@/mock/handlers');
      const updated = await saveAndConfirm(selectedCase.id, {
        headerData: { ...selectedCase.headerData, ...draftHeaderData },
        lineItems: draftLineItems || selectedCase.lineItems,
      });
      set({
        selectedCase: updated,
        isDirty: false,
      });
    } catch {
      // handle error
    }
  },

  rejectCase: async (reason: string) => {
    const { selectedCase } = get();
    if (!selectedCase) return;

    try {
      const { rejectCase } = await import('@/mock/handlers');
      const updated = await rejectCase(selectedCase.id, reason);
      set({ selectedCase: updated });
    } catch {
      // handle error
    }
  },

  submitForApproval: async (approverIds: string[], comment?: string) => {
    const { selectedCase } = get();
    if (!selectedCase) return;

    try {
      const { submitForApproval } = await import('@/mock/handlers');
      const updated = await submitForApproval(selectedCase.id, approverIds, comment);
      set({ selectedCase: updated });
    } catch {
      // handle error
    }
  },

  approveCase: async (comment: string) => {
    const { selectedCase } = get();
    if (!selectedCase) return;

    try {
      const { approveCaseHandler } = await import('@/mock/handlers');
      const updated = await approveCaseHandler(selectedCase.id, comment);
      set({ selectedCase: updated });
    } catch {
      // handle error
    }
  },

  sendBackCase: async (reason: string) => {
    const { selectedCase } = get();
    if (!selectedCase) return;

    try {
      const { sendBackCase } = await import('@/mock/handlers');
      const updated = await sendBackCase(selectedCase.id, reason);
      set({ selectedCase: updated });
    } catch {
      // handle error
    }
  },

  rejectCaseAsApprover: async (reason: string) => {
    const { selectedCase } = get();
    if (!selectedCase) return;

    try {
      const { rejectCaseAsApprover } = await import('@/mock/handlers');
      const updated = await rejectCaseAsApprover(selectedCase.id, reason);
      set({ selectedCase: updated });
    } catch {
      // handle error
    }
  },

  resubmitCase: async (approverIds: string[], comment?: string) => {
    const { selectedCase } = get();
    if (!selectedCase) return;

    try {
      const { resubmitCase } = await import('@/mock/handlers');
      const updated = await resubmitCase(selectedCase.id, approverIds, comment);
      set({ selectedCase: updated });
    } catch {
      // handle error
    }
  },

  updateApprovalChain: async (newSteps, reason) => {
    const { selectedCase } = get();
    if (!selectedCase) return;

    try {
      const { updateApprovalChain } = await import('@/mock/handlers');
      const updated = await updateApprovalChain(selectedCase.id, newSteps, reason);
      set({ selectedCase: updated });
    } catch {
      // handle error
    }
  },

  fetchComments: async (caseId: string) => {
    try {
      const { fetchComments } = await import('@/mock/handlers');
      const comments = await fetchComments(caseId);
      set({ comments });
    } catch {
      // handle error
    }
  },

  addComment: async (content: string) => {
    const { selectedCase } = get();
    if (!selectedCase) return;

    try {
      const { addComment } = await import('@/mock/handlers');
      const comment = await addComment(selectedCase.id, content);
      set({ comments: [...get().comments, comment] });
    } catch {
      // handle error
    }
  },

  clearSelectedCase: () => {
    set({
      selectedCase: null,
      draftHeaderData: null,
      draftLineItems: null,
      isDirty: false,
      businessRuleResults: [],
      comments: [],
    });
  },

  clearDraft: () => {
    set({
      draftHeaderData: null,
      draftLineItems: null,
      isDirty: false,
    });
  },
}));
