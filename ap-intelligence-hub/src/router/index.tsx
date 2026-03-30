import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/auth/LoginPage';

// Agent pages
import { AgentLayout } from '@/pages/agent/AgentLayout';
import { EmailReview } from '@/pages/agent/EmailReview';
import { DataValidationQueue } from '@/pages/agent/DataValidationQueue';
import { QueryResolutionQueue } from '@/pages/agent/QueryResolutionQueue';
import { PendingApprovalsQueue } from '@/pages/agent/PendingApprovalsQueue';
import { CaseBrowser } from '@/pages/agent/CaseBrowser';
import { CaseDetailLayout } from '@/pages/agent/case-detail/CaseDetailLayout';
import { CaseDetailsTab } from '@/pages/agent/case-detail/CaseDetailsTab';
import { DataValidationTab } from '@/pages/agent/case-detail/DataValidationTab';
import { AuditLogTab } from '@/pages/agent/case-detail/AuditLogTab';
import { ApprovalTrackingTab } from '@/pages/agent/case-detail/ApprovalTrackingTab';

// Approver pages
import { ApproverQueue } from '@/pages/approver/ApproverQueue';
import { ApproverCaseBrowser } from '@/pages/approver/ApproverCaseBrowser';
import { ApproverCaseView } from '@/pages/approver/ApproverCaseView';
import { ApproverAnalytics } from '@/pages/approver/ApproverAnalytics';

// Admin pages
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { MastersHub } from '@/pages/admin/MastersHub';
import { UserManagement } from '@/pages/admin/UserManagement';
import { Analytics } from '@/pages/admin/Analytics';
import { AdminCaseBrowser } from '@/pages/admin/AdminCaseBrowser';
import { Playground } from '@/pages/admin/Playground';
import { PromptEditor } from '@/pages/admin/PromptEditor';

const basename = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          // Agent routes
          {
            element: <RoleGuard allowedRoles={['AP_AGENT']} />,
            children: [
              {
                element: <AgentLayout />,
                children: [
                  {
                    path: '/agent/emails',
                    element: <EmailReview />,
                  },
                  {
                    path: '/agent/validation',
                    element: <DataValidationQueue />,
                  },
                  {
                    path: '/agent/queries',
                    element: <QueryResolutionQueue />,
                  },
                  {
                    path: '/agent/pending-approvals',
                    element: <PendingApprovalsQueue />,
                  },
                  {
                    path: '/agent/cases',
                    element: <CaseBrowser />,
                  },
                ],
              },
              {
                path: '/agent/cases/:caseId',
                element: <CaseDetailLayout />,
                children: [
                  {
                    index: true,
                    element: <Navigate to="overview" replace />,
                  },
                  {
                    path: 'overview',
                    element: <CaseDetailsTab />,
                  },
                  {
                    path: 'validation',
                    element: <DataValidationTab />,
                  },
                  {
                    path: 'audit',
                    element: <AuditLogTab />,
                  },
                  {
                    path: 'approval',
                    element: <ApprovalTrackingTab />,
                  },
                ],
              },
            ],
          },

          // Approver routes
          {
            element: <RoleGuard allowedRoles={['AP_REVIEWER', 'SUPER_ADMIN']} />,
            children: [
              {
                path: '/approver/queue',
                element: <ApproverQueue />,
              },
              {
                path: '/approver/cases',
                element: <ApproverCaseBrowser />,
              },
              {
                path: '/approver/cases/:caseId',
                element: <ApproverCaseView />,
              },
              {
                path: '/approver/analytics',
                element: <ApproverAnalytics />,
              },
            ],
          },

          // Admin routes
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN']} />,
            children: [
              {
                path: '/admin/dashboard',
                element: <AdminDashboard />,
              },
              {
                path: '/admin/cases',
                element: <AdminCaseBrowser />,
              },
              {
                path: '/admin/masters',
                element: <Navigate to="/admin/masters/vendors" replace />,
              },
              {
                path: '/admin/masters/:tab',
                element: <MastersHub />,
              },
              {
                path: '/admin/users',
                element: <UserManagement />,
              },
              {
                path: '/admin/analytics',
                element: <Analytics />,
              },
              {
                path: '/admin/playground',
                element: <Playground />,
              },
              {
                path: '/admin/prompts',
                element: <PromptEditor />,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
], { basename });
