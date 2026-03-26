import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCaseStore } from '@/stores/caseStore';
import { CaseStatusBadge } from '@/components/shared/CaseStatusBadge';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { AuditTimeline } from '@/components/shared/AuditTimeline';
import { CommentThread } from '@/components/shared/CommentThread';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { ArrowLeft, CheckCircle, X, RotateCcw, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AuditLogEntry } from '@/types/audit';

// Import agent tab components for reuse
import { CaseDetailsTab } from '@/pages/agent/case-detail/CaseDetailsTab';
import { DataValidationTab } from '@/pages/agent/case-detail/DataValidationTab';
import { ApprovalTrackingTab } from '@/pages/agent/case-detail/ApprovalTrackingTab';

export function ApproverCaseView() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { selectedCase, isLoadingDetail, fetchCaseById, clearSelectedCase,
    comments, fetchComments, addComment, approveCase, sendBackCase, rejectCaseAsApprover,
  } = useCaseStore();

  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'sendback' | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (caseId) {
      fetchCaseById(caseId);
      fetchComments(caseId);
      import('@/mock/handlers').then(({ fetchAuditLog }) => {
        fetchAuditLog(caseId).then(setAuditEntries);
      });
    }
    return () => clearSelectedCase();
  }, [caseId, fetchCaseById, fetchComments, clearSelectedCase]);

  if (isLoadingDetail || !selectedCase) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const handleAction = async () => {
    if ((actionType === 'reject' || actionType === 'sendback') && actionComment.trim().length < 10) {
      toast.error('Please provide a reason (min 10 characters)');
      return;
    }
    setIsSubmitting(true);
    try {
      if (actionType === 'approve') {
        await approveCase(actionComment);
        toast.success('Case approved');
      } else if (actionType === 'reject') {
        await rejectCaseAsApprover(actionComment);
        toast.success('Case rejected');
      } else if (actionType === 'sendback') {
        await sendBackCase(actionComment);
        toast.success('Case sent back to agent');
      }
      navigate('/approver/queue');
    } catch {
      toast.error('Action failed');
    }
    setIsSubmitting(false);
    setActionType(null);
  };

  return (
    <div>
      {/* Back + Header */}
      <div className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/approver/queue')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold font-mono">{selectedCase.id}</h1>
          <CaseStatusBadge status={selectedCase.status} />
          <CategoryBadge category={selectedCase.category} />
        </div>
      </div>

      {/* Action Bar */}
      {selectedCase.status === 'APPROVAL_PENDING' && (
        <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-5 py-3 mb-6">
          <span className="text-sm font-medium text-muted-foreground">Review Actions</span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/20 gap-2"
              onClick={() => { setActionType('sendback'); setActionComment(''); }}
            >
              <RotateCcw className="h-4 w-4" />
              Send Back
            </Button>
            <Button
              variant="destructive"
              size="lg"
              className="gap-2"
              onClick={() => { setActionType('reject'); setActionComment(''); }}
            >
              <X className="h-4 w-4" />
              Reject
            </Button>
            <Button
              size="lg"
              className="bg-green-600 hover:bg-green-700 gap-2 shadow-sm"
              onClick={() => { setActionType('approve'); setActionComment(''); }}
            >
              <CheckCircle className="h-4 w-4" />
              Approve
            </Button>
          </div>
        </div>
      )}

      {/* Summary Highlight Card */}
      <Card className="mb-6 border-2 border-primary/10 shadow-md bg-gradient-to-br from-background to-muted/30">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendor</p>
              <p className="text-sm font-semibold">{selectedCase.vendorName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invoice #</p>
              <p className="text-sm font-semibold font-mono">{selectedCase.headerData.invoiceNumber}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount</p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(selectedCase.headerData.totalAmount, selectedCase.headerData.currency)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</p>
              <CategoryBadge category={selectedCase.category} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reviewed By</p>
              <p className="text-sm font-semibold">{selectedCase.assignedAgentName || 'Agent'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rule Failures</p>
              <p className="text-sm font-semibold">
                {selectedCase.businessRuleResults.filter(r => r.status === 'FAIL').length} failures
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invoice Date</p>
              <p className="text-sm font-semibold">{selectedCase.headerData.invoiceDate}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="mb-6">
        <TabsList>
          <TabsTrigger value="overview">Case Overview</TabsTrigger>
          <TabsTrigger value="validation">Data Validation</TabsTrigger>
          <TabsTrigger value="approval">Approval Tracking</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="comments">Communication</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <CaseDetailsTab />
        </TabsContent>

        <TabsContent value="validation" className="mt-4">
          <DataValidationTab />
        </TabsContent>

        <TabsContent value="approval" className="mt-4">
          <ApprovalTrackingTab />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <AuditTimeline entries={auditEntries} compact />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <CommentThread
                comments={comments}
                onAddComment={addComment}
                canComment={true}
                placeholder="Add a comment..."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={actionType !== null} onOpenChange={(open) => { if (!open) setActionType(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className={cn(
                'p-2 rounded-full',
                actionType === 'approve' && 'bg-green-100 dark:bg-green-950',
                actionType === 'reject' && 'bg-red-100 dark:bg-red-950',
                actionType === 'sendback' && 'bg-orange-100 dark:bg-orange-950'
              )}>
                {actionType === 'approve' && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />}
                {actionType === 'reject' && <X className="h-5 w-5 text-red-600 dark:text-red-400" />}
                {actionType === 'sendback' && <RotateCcw className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
              </div>
              <DialogTitle className="text-lg">
                {actionType === 'approve' ? 'Approve Invoice' :
                 actionType === 'reject' ? 'Reject Invoice' : 'Send Back to Agent'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm">
              {actionType === 'approve' ? 'Confirm approval of this invoice. You may add an optional comment.' :
               actionType === 'reject' ? 'This action is permanent. The invoice will be rejected and cannot be reopened.' :
               'The case will be returned to the AP Agent for correction.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-2">
            <Label className="text-sm font-medium">{actionType === 'approve' ? 'Comment (optional)' : 'Reason (required, min 10 characters)'}</Label>
            <Textarea
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              placeholder={actionType === 'approve' ? 'Optional comment...' : 'Provide a reason...'}
              rows={4}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setActionType(null)}>Cancel</Button>
            <Button
              onClick={handleAction}
              disabled={isSubmitting}
              size="lg"
              className={cn(
                'gap-2',
                actionType === 'approve' && 'bg-green-600 hover:bg-green-700',
                actionType === 'reject' && 'bg-destructive hover:bg-destructive/90',
                actionType === 'sendback' && 'bg-orange-500 hover:bg-orange-600'
              )}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {actionType === 'approve' ? 'Approve' : actionType === 'reject' ? 'Reject' : 'Send Back'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
