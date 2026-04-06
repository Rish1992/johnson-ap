// Handler proxy — re-exports from real API or mock based on VITE_USE_REAL_API.
// All consumers: `await import('@/lib/handlers')` instead of '@/mock/handlers'.
//
// Vite replaces `import.meta.env.VITE_USE_REAL_API` at build time, so the
// unused branch gets tree-shaken in production builds. In dev, both are loaded
// but only the active branch's exports are used.

export type { EmailRecord } from '@/types/email';

import * as api from '@/lib/api';
import * as mock from '@/mock/handlers';

const src = import.meta.env.VITE_USE_REAL_API === 'true' ? api : mock;

// Auth
export const login = src.login;

// Cases
export const fetchCases = src.fetchCases;
export const fetchAllCases = src.fetchAllCases;
export const fetchCaseById = src.fetchCaseById;
export const saveDraft = src.saveDraft;
export const runBusinessRules = src.runBusinessRules;
export const saveAndConfirm = src.saveAndConfirm;
export const rejectCase = src.rejectCase;
export const submitForApproval = src.submitForApproval;
export const approveCaseHandler = src.approveCaseHandler;
export const sendBackCase = src.sendBackCase;
export const rejectCaseAsApprover = src.rejectCaseAsApprover;
export const resubmitCase = src.resubmitCase;
export const updateApprovalChain = src.updateApprovalChain;
export const fetchApproverCases = src.fetchApproverCases;

// SAP Export
export const exportSap = src.exportSap;

// Comments
export const fetchComments = src.fetchComments;
export const addComment = src.addComment;

// Notifications
export const fetchNotifications = src.fetchNotifications;
export const markNotificationRead = src.markNotificationRead;
export const markAllNotificationsRead = src.markAllNotificationsRead;

// Master data
export const fetchVendors = src.fetchVendors;
export const fetchCostCenters = src.fetchCostCenters;
export const fetchGLAccounts = src.fetchGLAccounts;
export const fetchTaxCodes = src.fetchTaxCodes;
export const fetchCompanyCodes = src.fetchCompanyCodes;
export const fetchPlantCodes = src.fetchPlantCodes;
export const fetchApprovalRules = src.fetchApprovalRules;
export const fetchBusinessRuleConfigs = src.fetchBusinessRuleConfigs;
export const fetchApprovalSequences = src.fetchApprovalSequences;
export const fetchFreightRateCards = src.fetchFreightRateCards;
export const fetchServiceRateCards = src.fetchServiceRateCards;
export const fetchAgreementMasters = src.fetchAgreementMasters;
export const fetchInvoiceCategoryConfigs = src.fetchInvoiceCategoryConfigs;
export const addVendor = src.addVendor;
export const updateVendor = src.updateVendor;
export const deleteVendor = src.deleteVendor;

// Users
export const addUser = src.addUser;
export const fetchAllUsers = src.fetchAllUsers;
export const fetchUsers = src.fetchAllUsers;
export const updateUser = src.updateUser;

// Audit
export const fetchAuditLog = src.fetchAuditLog;

// Emails
export const fetchEmails = src.fetchEmails;
export const overrideEmailClassification = src.overrideEmailClassification;

// Prompts
export const fetchPrompts = src.fetchPrompts;
export const fetchPromptByStep = src.fetchPromptByStep;
export const updatePrompt = src.updatePrompt;

// Category Field Configs
export const fetchCategoryConfigs = src.fetchCategoryConfigs;
export const fetchCategoryFields = src.fetchCategoryFields;
export const updateCategoryFields = src.updateCategoryFields;
