import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { CaseCard } from '@/components/shared/CaseCard';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, Clock, ShieldAlert, Bell, AlertTriangle, LayoutGrid, List } from 'lucide-react';
import { TableSkeleton } from '@/components/shared/PageSkeleton';
import { formatCurrency, formatRelativeTime } from '@/lib/formatters';
import { toast } from 'sonner';
import type { Case } from '@/types/case';

export function ApproverQueue() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkApprove, setShowBulkApprove] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideCaseId, setOverrideCaseId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  useEffect(() => {
    if (user) {
      import('@/lib/handlers').then(({ fetchApproverCases }) => {
        fetchApproverCases(user.id, user.role).then((data) => {
          setCases(data);
          setIsLoading(false);
        });
      });
    }
  }, [user]);

  const pendingCases = cases.filter(c => c.status === 'APPROVAL_PENDING');
  const isL2OrSuper = user?.role === 'L2_APPROVER' || user?.role === 'SUPER_ADMIN';
  const isSuperUser = user?.role === 'SUPER_ADMIN';
  const overdueCases = pendingCases.filter(c => {
    const created = new Date(c.approvalChain?.createdAt || c.createdAt).getTime();
    return Date.now() - created > 48 * 60 * 60 * 1000;
  });
  const pendingTotal = pendingCases.reduce((s, c) => s + (c.headerData?.grandTotal || 0), 0);
  const selectedCases = pendingCases.filter(c => selectedIds.has(c.id));
  const selectedTotal = selectedCases.reduce((s, c) => s + (c.headerData?.grandTotal || 0), 0);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === pendingCases.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pendingCases.map(c => c.id)));
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="My Approval Queue" />
        <p className="text-sm text-muted-foreground -mt-4 mb-4">Invoices submitted by AP agents awaiting your review and decision.</p>
        <TableSkeleton rows={6} cols={7} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageHeader title="My Approval Queue" count={cases.length}>
          <div className="flex items-center gap-1 border rounded-lg p-0.5">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('table')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </PageHeader>
        <Button variant="outline" size="sm" className="gap-2 relative" onClick={() => setShowNotifications(true)}>
          <Bell className="h-4 w-4" />
          Notifications
          {overdueCases.length > 0 && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">{overdueCases.length}</Badge>
          )}
        </Button>
      </div>
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
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pendingCases.map((c) => (
            <CaseCard
              key={c.id}
              caseData={c}
              variant="browser"
              onClick={(id) => navigate(`/approver/cases/${id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                {isL2OrSuper && (
                  <TableHead className="w-10">
                    <Checkbox checked={selectedIds.size === pendingCases.length && pendingCases.length > 0} onCheckedChange={toggleAll} />
                  </TableHead>
                )}
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
                    {isL2OrSuper && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                      </TableCell>
                    )}
                    <TableCell className="font-mono font-medium">{c.id}</TableCell>
                    <TableCell>{c.vendorName}</TableCell>
                    <TableCell><CategoryBadge category={c.category} /></TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(c.headerData.grandTotal, c.headerData.currency)}
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/approver/cases/${c.id}`)}>Review</Button>
                        {isSuperUser && (
                          <Button variant="ghost" size="sm" className="text-amber-600 gap-1" onClick={() => { setOverrideCaseId(c.id); setOverrideReason(''); setShowOverride(true); }}>
                            <ShieldAlert className="h-3.5 w-3.5" />
                            Override
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {/* Bulk Approve Floating Bar */}
      {isL2OrSuper && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-card border shadow-lg rounded-lg px-5 py-3 z-50">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <span className="text-sm text-muted-foreground">{formatCurrency(selectedTotal, 'AUD')}</span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          <Button className="bg-green-600 hover:bg-green-700 gap-1" onClick={() => setShowBulkApprove(true)}>
            <CheckCircle className="h-4 w-4" />
            Bulk Approve
          </Button>
        </div>
      )}

      {/* Bulk Approve AlertDialog */}
      <AlertDialog open={showBulkApprove} onOpenChange={setShowBulkApprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk Approve {selectedIds.size} {selectedIds.size === 1 ? 'Invoice' : 'Invoices'}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>The following invoices will be approved. This action cannot be undone.</p>
                <div className="border rounded-md divide-y max-h-48 overflow-y-auto text-xs">
                  {selectedCases.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-3 py-2">
                      <span className="font-mono font-medium">{c.id}</span>
                      <span className="text-muted-foreground">{c.vendorName}</span>
                      <span className="font-semibold">{formatCurrency(c.headerData.grandTotal, c.headerData.currency)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(selectedTotal, 'AUD')}</span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-green-600 hover:bg-green-700" onClick={() => {
              const count = selectedIds.size;
              setCases(prev => prev.map(c =>
                selectedIds.has(c.id) ? { ...c, status: 'APPROVED' as const } : c
              ));
              setSelectedIds(new Set());
              setShowBulkApprove(false);
              toast.success(`${count} ${count === 1 ? 'invoice' : 'invoices'} approved successfully`);
            }}>
              Approve All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Notifications Dialog (Items 22 + 23) */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Email Notifications Preview</DialogTitle>
            <DialogDescription>Preview of automated emails that will be sent on your behalf.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="daily">
            <TabsList className="mb-3">
              <TabsTrigger value="daily">Daily Summary</TabsTrigger>
              <TabsTrigger value="escalation" className="gap-1">
                Escalation Alerts
                {overdueCases.length > 0 && <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">{overdueCases.length}</Badge>}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="daily">
              <div className="border rounded-lg p-4 bg-muted/20 space-y-3 text-sm font-mono">
                <p className="text-xs text-muted-foreground">Subject: <span className="font-semibold text-foreground">InvoiceIQ Daily Summary — {pendingCases.length} Pending Approvals</span></p>
                <hr />
                <p>Hi {user?.fullName || 'Approver'},</p>
                <p>You have <strong>{pendingCases.length}</strong> invoices pending your approval:</p>
                {pendingCases.length > 0 ? (
                  <table className="w-full text-xs border-collapse">
                    <thead><tr className="border-b"><th className="text-left py-1">Case</th><th className="text-left py-1">Vendor</th><th className="text-right py-1">Amount</th><th className="text-right py-1">Waiting Since</th></tr></thead>
                    <tbody>
                      {pendingCases.slice(0, 10).map(c => (
                        <tr key={c.id} className="border-b border-dashed"><td className="py-1">{c.id}</td><td>{c.vendorName}</td><td className="text-right">{formatCurrency(c.headerData.grandTotal, c.headerData.currency)}</td><td className="text-right">{formatRelativeTime(c.approvalChain?.createdAt || c.createdAt)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="text-muted-foreground italic">No pending approvals.</p>}
                <p>Total pending: <strong>{formatCurrency(pendingTotal, 'AUD')}</strong></p>
                <p className="text-xs text-muted-foreground mt-2">Please review at: https://johnson.demo.fiscalix.com</p>
                <hr />
                <p className="text-[10px] text-muted-foreground italic">This email is sent automatically at 6:00 PM daily.</p>
              </div>
            </TabsContent>
            <TabsContent value="escalation">
              {overdueCases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No overdue cases. All approvals are within the 48-hour SLA.</div>
              ) : (
                <div className="space-y-3">
                  {overdueCases.map(c => {
                    const submitted = c.approvalChain?.createdAt || c.createdAt;
                    const daysAgo = Math.floor((Date.now() - new Date(submitted).getTime()) / (24 * 60 * 60 * 1000));
                    return (
                      <div key={c.id} className="border border-amber-300 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 text-sm space-y-1">
                        <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4" />
                          ESCALATION: Invoice {c.id} has been pending approval for {daysAgo} days
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
                          <div>Approver: <strong>{user?.fullName || 'You'}</strong></div>
                          <div>Vendor: <strong>{c.vendorName}</strong></div>
                          <div>Amount: <strong>{formatCurrency(c.headerData.grandTotal, c.headerData.currency)}</strong></div>
                          <div>Submitted: <strong>{daysAgo} days ago</strong></div>
                        </div>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">This case has exceeded the 48-hour SLA. Please take action immediately.</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Super User Override Dialog (Item 27) */}
      <AlertDialog open={showOverride} onOpenChange={setShowOverride}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Super User Override
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will be recorded in the audit trail. Please provide a reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for override approval..."
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-amber-600 hover:bg-amber-700" onClick={() => {
              if (overrideReason.trim().length < 5) { toast.error('Please provide a reason'); return; }
              toast.success(`Case ${overrideCaseId} approved via super user override`);
              setOverrideCaseId(null);
              setOverrideReason('');
            }}>
              Confirm Override
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
