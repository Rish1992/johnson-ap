import { NavLink } from 'react-router-dom';
import {
  Inbox,
  ClipboardCheck,
  MessageSquareWarning,
  Clock,
  Search,
  CheckCircle,
  LayoutDashboard,
  Database,
  Users,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types/user';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  AP_AGENT: [
    { label: 'Email Review', path: '/agent/emails', icon: <Inbox className="h-5 w-5" /> },
    { label: 'Data Validation', path: '/agent/validation', icon: <ClipboardCheck className="h-5 w-5" /> },
    { label: 'Query Resolution', path: '/agent/queries', icon: <MessageSquareWarning className="h-5 w-5" /> },
    { label: 'Pending Approvals', path: '/agent/pending-approvals', icon: <Clock className="h-5 w-5" /> },
    { label: 'Case Browser', path: '/agent/cases', icon: <Search className="h-5 w-5" /> },
  ],
  AP_REVIEWER: [
    { label: 'My Approvals', path: '/approver/queue', icon: <CheckCircle className="h-5 w-5" /> },
    { label: 'Case Browser', path: '/approver/cases', icon: <Search className="h-5 w-5" /> },
    { label: 'Analytics', path: '/approver/analytics', icon: <BarChart3 className="h-5 w-5" /> },
  ],
  SUPER_ADMIN: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: 'Case Browser', path: '/admin/cases', icon: <Search className="h-5 w-5" /> },
    { label: 'Master Data', path: '/admin/masters/vendors', icon: <Database className="h-5 w-5" /> },
    { label: 'Users', path: '/admin/users', icon: <Users className="h-5 w-5" /> },
    { label: 'Analytics', path: '/admin/analytics', icon: <BarChart3 className="h-5 w-5" /> },
  ],
};

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const items = user ? NAV_ITEMS[user.role] : [];

  return (
    <aside
      className={cn(
        'flex flex-col h-screen transition-all duration-300 relative',
        collapsed ? 'w-16' : 'w-60'
      )}
      style={{ background: 'linear-gradient(180deg, #242424 0%, #1A1A1A 100%)' }}
    >
      {/* Red accent strip at top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-red-600" />

      {/* Logo */}
      <div
        className={cn(
          'flex items-center h-16',
          collapsed ? 'justify-center px-2' : 'px-4'
        )}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <svg className="h-7 w-7 shrink-0" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="2" width="20" height="28" rx="3" stroke="white" strokeWidth="2" fill="none" />
          <rect x="8" y="8" width="12" height="2" rx="1" fill="white" opacity="0.5" />
          <rect x="8" y="13" width="12" height="2" rx="1" fill="white" opacity="0.5" />
          <rect x="8" y="18" width="8" height="2" rx="1" fill="white" opacity="0.5" />
          <path d="M18 16 L22 20 L30 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        {!collapsed && (
          <span className="ml-3 font-bold text-xl text-white truncate">
            InvoiceIQ
          </span>
        )}
      </div>

      {/* Nav Group Label */}
      {!collapsed && (
        <div
          className="px-5 pt-5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Navigation
        </div>
      )}

      {/* Nav Items */}
      <nav className={cn('flex-1 py-2 space-y-0.5 px-2', collapsed && 'pt-4')}>
        {items.map((item) => {
          const link = (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center text-sm font-medium transition-colors h-10',
                  collapsed
                    ? 'justify-center p-2.5 rounded-lg'
                    : 'gap-3 px-3 rounded-lg',
                  isActive
                    ? 'bg-red-600 text-white font-semibold'
                    : 'hover:bg-white/[0.08]'
                )
              }
              style={({ isActive }) =>
                isActive
                  ? undefined
                  : { color: 'rgba(255,255,255,0.65)' }
              }
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          className={cn(
            'flex items-center justify-center w-full h-9 rounded-lg transition-colors hover:bg-white/[0.08]'
          )}
          style={{ color: 'rgba(255,255,255,0.65)' }}
          onClick={toggleSidebar}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>
    </aside>
  );
}
