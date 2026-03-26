import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, Bell, LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ROLE_CONFIG } from '@/lib/constants';
import { NotificationPanel } from '@/components/shared/NotificationPanel';

export function Header() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const togglePanel = useNotificationStore((s) => s.togglePanel);
  const closePanel = useNotificationStore((s) => s.closePanel);
  const isPanelOpen = useNotificationStore((s) => s.isOpen);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notification panel on outside click
  useEffect(() => {
    if (!isPanelOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        closePanel();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPanelOpen, closePanel]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`
    : 'U';

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-border bg-white dark:bg-card shadow-sm">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {user?.role ? ROLE_CONFIG[user.role].label : ''}
        </h2>
        {user?.role && (
          <Badge variant="outline" className={`${ROLE_CONFIG[user.role].color} ${ROLE_CONFIG[user.role].bgColor} border-transparent ring-1 ring-inset ring-current/15 text-xs font-medium rounded-full px-2.5 py-0.5 inline-flex items-center gap-1.5`}>
            <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0 bg-current" />
            {ROLE_CONFIG[user.role].label}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'light' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{theme === 'light' ? 'Dark mode' : 'Light mode'}</TooltipContent>
        </Tooltip>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={togglePanel}>
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] animate-pulse bg-red-600 text-white hover:bg-red-700 border-transparent"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>
          {isPanelOpen && <NotificationPanel />}
        </div>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-red-600 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden md:inline">
                {user?.fullName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
