import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Inbox } from 'lucide-react';
import type { Case, CaseStatus } from '@/types/case';
import type { EmailRecord } from '@/types/email';

interface TabDef {
  label: string;
  path: string;
  icon?: React.ReactNode;
  statuses: CaseStatus[];
  countSource?: 'cases' | 'emails_unread';
}

const TABS: TabDef[] = [
  { label: 'Email Review', path: '/agent/emails', icon: <Inbox className="h-4 w-4" />, statuses: [], countSource: 'emails_unread' },
  { label: 'Data Validation', path: '/agent/validation', statuses: ['EXTRACTED', 'IN_REVIEW'] as CaseStatus[] },
  { label: 'Query Resolution', path: '/agent/queries', statuses: ['RETURNED'] as CaseStatus[] },
  { label: 'Pending Approvals', path: '/agent/pending-approvals', statuses: ['APPROVAL_PENDING'] as CaseStatus[] },
  { label: 'Case Browser', path: '/agent/cases', statuses: [] as CaseStatus[] },
];

export function AgentLayout() {
  const location = useLocation();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // Fetch all cases and emails directly from handlers (not through the store)
    // to avoid race conditions with child queue pages overwriting store data
    import('@/lib/handlers').then(({ fetchAllCases, fetchEmails }) => {
      Promise.all([fetchAllCases(), fetchEmails()]).then(([allCases, allEmails]: [Case[], EmailRecord[]]) => {
        const newCounts: Record<string, number> = {};
        TABS.forEach((tab) => {
          if (tab.countSource === 'emails_unread') {
            newCounts[tab.path] = allEmails.filter((e) => !e.isRead).length;
          } else if (tab.statuses.length > 0) {
            newCounts[tab.path] = allCases.filter((c) => tab.statuses.includes(c.status)).length;
          } else {
            newCounts[tab.path] = allCases.length;
          }
        });
        setCounts(newCounts);
      });
    });
  }, []);

  return (
    <div>
      <div className="bg-muted/50 rounded-xl p-1 flex items-center gap-1 mb-6">
        {TABS.map((tab) => {
          const isActive =
            location.pathname === tab.path ||
            (tab.path === '/agent/cases' && location.pathname.startsWith('/agent/cases'));
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all',
                isActive
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              {tab.icon}
              {tab.label}
              {counts[tab.path] !== undefined && (
                <Badge
                  variant={isActive ? 'default' : 'secondary'}
                  className="text-[11px] h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full font-semibold"
                >
                  {counts[tab.path]}
                </Badge>
              )}
            </NavLink>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
