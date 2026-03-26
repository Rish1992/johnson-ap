import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 -m-4 rounded-full bg-muted/60 ring-1 ring-border/50" />
        <div className="relative text-muted-foreground/60">
          {icon || <Inbox className="h-16 w-16" />}
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-base text-muted-foreground/80 max-w-md">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
