export const ROUTES = {
  LOGIN: '/login',

  // Agent routes
  AGENT_VALIDATION_QUEUE: '/agent/validation',
  AGENT_QUERY_RESOLUTION: '/agent/queries',
  AGENT_PENDING_APPROVALS: '/agent/pending-approvals',
  AGENT_CASE_BROWSER: '/agent/cases',
  AGENT_CASE_DETAIL: '/agent/cases/:caseId',
  AGENT_CASE_DETAIL_TAB: '/agent/cases/:caseId/:tab',

  // Approver routes
  APPROVER_QUEUE: '/approver/queue',
  APPROVER_CASE_VIEW: '/approver/cases/:caseId',

  // Admin routes
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_MASTERS: '/admin/masters',
  ADMIN_MASTERS_TAB: '/admin/masters/:tab',
  ADMIN_USERS: '/admin/users',
  ADMIN_ANALYTICS: '/admin/analytics',
  ADMIN_PLAYGROUND: '/admin/playground',
  ADMIN_PROMPTS: '/admin/prompts',
} as const;
