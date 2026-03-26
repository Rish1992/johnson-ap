import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/formatters';
import { Bell, CheckCircle, AlertTriangle, ArrowLeft, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NotificationType } from '@/types/notification';
import { ROLE_CONFIG } from '@/lib/constants';

const NOTIFICATION_ICONS: Record<NotificationType, React.ReactNode> = {
  CASE_ASSIGNED: <FileText className="h-4 w-4 text-blue-500" />,
  CASE_RETURNED: <ArrowLeft className="h-4 w-4 text-orange-500" />,
  APPROVAL_REQUIRED: <Bell className="h-4 w-4 text-purple-500" />,
  CASE_APPROVED: <CheckCircle className="h-4 w-4 text-green-500" />,
  CASE_REJECTED: <X className="h-4 w-4 text-red-500" />,
  SLA_WARNING: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  SLA_BREACH: <AlertTriangle className="h-4 w-4 text-red-500" />,
  EXTRACTION_COMPLETE: <FileText className="h-4 w-4 text-blue-500" />,
  POSTING_SUCCESS: <CheckCircle className="h-4 w-4 text-green-500" />,
  POSTING_FAILED: <X className="h-4 w-4 text-red-500" />,
};

export function NotificationPanel() {
  const navigate = useNavigate();
  const notifications = useNotificationStore((s) => s.notifications);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const closePanel = useNotificationStore((s) => s.closePanel);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationClick = (notificationId: string, caseId: string | null) => {
    markAsRead(notificationId);
    closePanel();
    if (caseId && user) {
      const basePath = ROLE_CONFIG[user.role].homePath.split('/')[1];
      if (basePath === 'agent') {
        navigate(`/agent/cases/${caseId}/overview`);
      } else if (basePath === 'approver') {
        navigate(`/approver/cases/${caseId}`);
      }
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-card border border-border rounded-[10px] shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">
          Notifications{notifications.length > 0 && <span className="text-muted-foreground font-normal ml-1">({notifications.length})</span>}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={markAllAsRead}
          className="text-xs text-muted-foreground"
        >
          Mark all as read
        </Button>
      </div>

      <ScrollArea className="h-80">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Bell className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() =>
                  handleNotificationClick(notification.id, notification.caseId)
                }
                className={cn(
                  'w-full flex items-start gap-3 p-4 text-left hover:bg-accent transition-colors',
                  !notification.isRead && 'bg-accent/50 border-l-4 border-l-red-600'
                )}
              >
                <div className="shrink-0 mt-0.5">
                  {NOTIFICATION_ICONS[notification.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm',
                      !notification.isRead
                        ? 'font-semibold text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
                {!notification.isRead && (
                  <div className="shrink-0 mt-2 h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
