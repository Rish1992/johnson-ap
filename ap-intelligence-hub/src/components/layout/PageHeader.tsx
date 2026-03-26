import { Badge } from '@/components/ui/badge';

interface PageHeaderProps {
  title: string;
  count?: number;
  children?: React.ReactNode;
}

export function PageHeader({ title, count, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {count !== undefined && (
          <Badge variant="secondary" className="text-sm font-semibold px-2.5 py-0.5">
            {count}
          </Badge>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
