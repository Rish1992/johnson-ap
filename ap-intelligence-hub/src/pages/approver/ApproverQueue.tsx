import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { CheckCircle, Clock } from 'lucide-react';
import { formatCurrency, formatRelativeTime } from '@/lib/formatters';
import type { Case } from '@/types/case';

export function ApproverQueue() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      import('@/mock/handlers').then(({ fetchApproverCases }) => {
        fetchApproverCases(user.id).then((data) => {
          setCases(data);
          setIsLoading(false);
        });
      });
    }
  }, [user]);

  const pendingCases = cases.filter(c => c.status === 'APPROVAL_PENDING');

  if (isLoading) {
    return (
      <div>
        <PageHeader title="My Approval Queue" />
        <p className="text-sm text-muted-foreground -mt-4 mb-4">Invoices submitted by AP agents awaiting your review and decision.</p>
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-accent/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My Approval Queue" count={cases.length} />
      <p className="text-sm text-muted-foreground -mt-4 mb-4">Invoices submitted by AP agents awaiting your review and decision.</p>

      {pendingCases.length > 0 && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
            {pendingCases.length} {pendingCases.length === 1 ? 'invoice' : 'invoices'} waiting for your review
          </span>
        </div>
      )}

      {cases.length === 0 ? (
        <EmptyState
          title="No cases pending"
          description="No invoices require your approval at this time."
          icon={<CheckCircle className="h-16 w-16" />}
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Case ID</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Your Step</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingCases.map((c) => {
                const chain = c.approvalChain;

                return (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/approver/cases/${c.id}`)}>
                    <TableCell className="font-mono font-medium">{c.id}</TableCell>
                    <TableCell>{c.vendorName}</TableCell>
                    <TableCell><CategoryBadge category={c.category} /></TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(c.headerData.totalAmount, c.headerData.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        Step {(chain?.currentStepIndex || 0) + 1} of {chain?.steps.length || 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{c.assignedAgentName || 'Agent'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {chain ? formatRelativeTime(chain.createdAt) : formatRelativeTime(c.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">Review</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
