import { useEffect, useMemo, useState } from 'react';
import { useCaseStore } from '@/stores/caseStore';
import { ApprovalChainStepper } from '@/components/shared/ApprovalChainStepper';
import { CommentThread } from '@/components/shared/CommentThread';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/stores/authStore';
import { formatDateTime, formatRelativeTime } from '@/lib/formatters';
import {
  ArrowRight, MessageSquare, CheckCircle, XCircle,
  RotateCcw, Clock, User, CalendarDays, Settings2,
  ChevronUp, ChevronDown, Trash2, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApprovalStep } from '@/types/case';

// ---------------------------------------------------------------------------
// Types for the Edit Approval Chain modal
// ---------------------------------------------------------------------------
interface EditableStep {
  approverId: string;
  approverName: string;
  approverRole: string;
}

interface AvailableApprover {
  id: string;
  name: string;
  department: string;
  limit: number;
}

export function ApprovalTrackingTab() {
  const selectedCase = useCaseStore((s) => s.selectedCase);
  const comments = useCaseStore((s) => s.comments);
  const fetchComments = useCaseStore((s) => s.fetchComments);
  const addComment = useCaseStore((s) => s.addComment);
  const updateApprovalChain = useCaseStore((s) => s.updateApprovalChain);
  const user = useAuthStore((s) => s.user);

  // Edit Approval Chain modal state
  const [showEditChainDialog, setShowEditChainDialog] = useState(false);
  const [editableSteps, setEditableSteps] = useState<EditableStep[]>([]);
  const [editReason, setEditReason] = useState('');
  const [availableApprovers, setAvailableApprovers] = useState<AvailableApprover[]>([]);
  const [selectedNewApprover, setSelectedNewApprover] = useState('');
  const [isSavingChain, setIsSavingChain] = useState(false);

  useEffect(() => {
    if (selectedCase) {
      fetchComments(selectedCase.id);
    }
  }, [selectedCase, fetchComments]);

  if (!selectedCase) return null;

  const { approvalChain: fullApprovalChain } = selectedCase;

  // For AP_REVIEWER (L1), only show steps up to and including their own step
  const approvalChain = useMemo(() => {
    if (!fullApprovalChain) return null;
    if (user?.role !== 'AP_REVIEWER') return fullApprovalChain;
    const myStepIdx = fullApprovalChain.steps.findIndex(s => s.approverId === user.id);
    if (myStepIdx === -1) return fullApprovalChain; // fallback: show all if not found
    const filteredSteps = fullApprovalChain.steps.slice(0, myStepIdx + 1);
    return {
      ...fullApprovalChain,
      steps: filteredSteps,
      currentStepIndex: Math.min(fullApprovalChain.currentStepIndex, myStepIdx),
    };
  }, [fullApprovalChain, user]);

  // Determine if the current user can edit the approval chain
  const canEditChain =
    (user?.role === 'AP_AGENT' || user?.role === 'AP_REVIEWER' || user?.role === 'SUPER_ADMIN') &&
    selectedCase.status === 'APPROVAL_PENDING' &&
    approvalChain !== null;

  if (!approvalChain) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No approval chain</p>
        <p className="text-sm mt-1">This case has not been submitted for approval yet.</p>
      </div>
    );
  }

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'REJECTED': return <XCircle className="h-5 w-5 text-red-600" />;
      case 'RETURNED': return <RotateCcw className="h-5 w-5 text-orange-600" />;
      default: return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
      case 'REJECTED': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
      case 'RETURNED': return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  // Build timeline events
  const timelineEvents: { time: string; label: string; detail: string; comment?: string; icon: React.ReactNode; color: string }[] = [
    {
      time: approvalChain.createdAt,
      label: 'Submitted for Approval',
      detail: `Case submitted by ${selectedCase.assignedAgentName || 'AP Agent'}`,
      icon: <ArrowRight className="h-4 w-4 text-red-600" />,
      color: 'bg-red-100 dark:bg-red-900/30',
    },
  ];

  approvalChain.steps.filter(s => s.decidedAt).forEach((step) => {
    const action = step.decision === 'APPROVE' ? 'Approved' : step.decision === 'REJECT' ? 'Rejected' : 'Returned for revision';
    timelineEvents.push({
      time: step.decidedAt!,
      label: `Step ${step.stepNumber}: ${action}`,
      detail: `${step.approverName} (${step.approverRole})`,
      comment: step.comment || undefined,
      icon: getStepIcon(step.status),
      color: step.status === 'APPROVED' ? 'bg-green-100 dark:bg-green-900/30'
        : step.status === 'REJECTED' ? 'bg-red-100 dark:bg-red-900/30'
        : 'bg-orange-100 dark:bg-orange-900/30',
    });
  });

  // ---------------------------------------------------------------------------
  // Edit Approval Chain handlers
  // ---------------------------------------------------------------------------
  const handleOpenEditChain = async () => {
    // Load available approvers from real API
    const { fetchUsers } = await import('@/lib/api');
    const users = await fetchUsers();
    const reviewers = users
      .filter((u: any) => u.role === 'AP_REVIEWER' && u.isActive)
      .map((u: any) => ({
        id: u.id,
        name: u.fullName,
        department: u.department || '',
        limit: u.approvalLimit || 0,
      }));
    setAvailableApprovers(reviewers);

    // Only include PENDING steps as editable, completed steps are locked
    const pendingSteps = approvalChain.steps
      .filter((s) => s.status === 'PENDING')
      .map((s) => ({
        approverId: s.approverId,
        approverName: s.approverName,
        approverRole: s.approverRole,
      }));
    setEditableSteps(pendingSteps);
    setEditReason('');
    setSelectedNewApprover('');
    setShowEditChainDialog(true);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    setEditableSteps(prev => {
      const newSteps = [...prev];
      const swapIdx = direction === 'up' ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= newSteps.length) return prev;
      [newSteps[index], newSteps[swapIdx]] = [newSteps[swapIdx], newSteps[index]];
      return newSteps;
    });
  };

  const handleRemoveStep = (index: number) => {
    setEditableSteps(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddApprover = () => {
    if (!selectedNewApprover) return;
    if (editableSteps.length >= 3) {
      toast.error('Maximum 3 approval steps allowed');
      return;
    }
    const approver = availableApprovers.find(a => a.id === selectedNewApprover);
    if (!approver) return;
    // Check if already in the editable steps
    if (editableSteps.some(s => s.approverId === approver.id)) {
      toast.error('This approver is already in the chain');
      return;
    }
    // Also check if already in a completed step
    const completedApproverIds = approvalChain.steps
      .filter(s => s.status !== 'PENDING')
      .map(s => s.approverId);
    if (completedApproverIds.includes(approver.id)) {
      toast.error('This approver already has a completed step in the chain');
      return;
    }

    setEditableSteps(prev => [
      ...prev,
      { approverId: approver.id, approverName: approver.name, approverRole: 'AP_REVIEWER' },
    ]);
    setSelectedNewApprover('');
  };

  const handleSaveChain = async () => {
    if (editableSteps.length === 0) {
      toast.error('At least one approver is required');
      return;
    }
    if (!editReason.trim()) {
      toast.error('Please provide a reason for the change');
      return;
    }
    setIsSavingChain(true);
    await updateApprovalChain(editableSteps, editReason.trim());
    setIsSavingChain(false);
    setShowEditChainDialog(false);
    toast.success('Approval sequence updated');
  };

  // Completed steps in the chain (cannot be edited)
  const completedSteps = approvalChain.steps.filter((s) => s.status !== 'PENDING');

  // Approvers already used (in completed steps or pending editable steps)
  const usedApproverIds = new Set([
    ...completedSteps.map(s => s.approverId),
    ...editableSteps.map(s => s.approverId),
  ]);

  // Available approvers not yet in the chain
  const unusedApprovers = availableApprovers.filter(a => !usedApproverIds.has(a.id));

  // Total steps count (completed + editable) for max check
  const totalEditableStepCount = completedSteps.length + editableSteps.length;

  return (
    <div className="space-y-6">
      {/* Chain Visualization */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Approval Chain</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Step {Math.min(approvalChain.currentStepIndex + 1, approvalChain.steps.length)} of {approvalChain.steps.length}
              </Badge>
              {canEditChain && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenEditChain}
                  className="gap-1 text-xs"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Edit Approval Sequence
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <ApprovalChainStepper chain={approvalChain} size="md" />
        </CardContent>
      </Card>

      {/* Step Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {approvalChain.steps.map((step: ApprovalStep, index: number) => {
            const isCurrent = index === approvalChain.currentStepIndex && step.status === 'PENDING';
            return (
              <div
                key={`${step.stepNumber}-${step.approverId}`}
                className={cn(
                  'rounded-lg border p-4 transition-colors',
                  isCurrent && 'border-red-300 bg-red-50/50 dark:border-red-700 dark:bg-red-900/10',
                  step.status === 'APPROVED' && 'border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-900/10',
                  step.status === 'REJECTED' && 'border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-900/10',
                  step.status === 'RETURNED' && 'border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-900/10',
                  step.status === 'PENDING' && !isCurrent && 'border-border bg-muted/20',
                  step.status === 'SKIPPED' && 'border-border bg-muted/10 opacity-60',
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getStepIcon(step.status)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">Step {step.stepNumber}: {step.approverName}</p>
                        {isCurrent && (
                          <Badge variant="default" className="text-[10px] h-4 px-1.5 animate-pulse">Current</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {step.approverRole}
                        </span>
                        {step.decidedAt && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3 w-3" />
                            {formatDateTime(step.decidedAt)} ({formatRelativeTime(step.decidedAt)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('shrink-0', getStatusColor(step.status))}>
                    {step.status}
                  </Badge>
                </div>

                {/* Show comment for returned/rejected/approved steps */}
                {step.comment && (
                  <div className={cn(
                    'mt-3 ml-8 p-3 rounded-md border text-sm',
                    step.status === 'RETURNED' && 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300',
                    step.status === 'REJECTED' && 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300',
                    step.status === 'APPROVED' && 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300',
                  )}>
                    <div className="flex items-center gap-1 mb-1">
                      <MessageSquare className="h-3 w-3" />
                      <span className="text-xs font-medium">
                        {step.status === 'RETURNED' ? 'Return Reason' : step.status === 'REJECTED' ? 'Rejection Reason' : 'Comment'}
                      </span>
                    </div>
                    <p className="text-sm">{step.comment}</p>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Approval Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-4">
              {timelineEvents.map((event, i) => (
                <div key={i} className="relative flex gap-4 pl-0">
                  <div className={cn(
                    'relative z-10 flex items-center justify-center w-8 h-8 rounded-full shrink-0',
                    event.color
                  )}>
                    {event.icon}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-sm font-medium">{event.label}</p>
                    <p className="text-xs text-muted-foreground">{event.detail}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {formatDateTime(event.time)} &middot; {formatRelativeTime(event.time)}
                    </p>
                    {event.comment && (
                      <div className="mt-2 p-2 rounded border bg-muted/50 text-xs italic">
                        &ldquo;{event.comment}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Comments - visible and interactive for both agents and approvers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Discussion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CommentThread
            comments={comments}
            onAddComment={addComment}
            canComment={!!user}
            placeholder="Add a comment..."
          />
        </CardContent>
      </Card>

      {/* Edit Approval Chain Dialog */}
      <Dialog open={showEditChainDialog} onOpenChange={setShowEditChainDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Approval Sequence</DialogTitle>
            <DialogDescription>
              Modify the pending approval steps. Completed steps cannot be changed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Completed steps (read-only) */}
            {completedSteps.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Completed Steps (locked)</Label>
                <div className="space-y-2">
                  {completedSteps.map((step) => (
                    <div
                      key={`completed-${step.stepNumber}`}
                      className={cn(
                        'flex items-center gap-2 p-2.5 border rounded-lg opacity-60',
                        step.status === 'APPROVED' && 'border-green-200 bg-green-50/30',
                        step.status === 'RETURNED' && 'border-orange-200 bg-orange-50/30',
                        step.status === 'REJECTED' && 'border-red-200 bg-red-50/30',
                      )}
                    >
                      <div className="mt-0.5">{getStepIcon(step.status)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Step {step.stepNumber}: {step.approverName}</p>
                        <p className="text-[10px] text-muted-foreground">{step.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator className="mt-3" />
              </div>
            )}

            {/* Editable pending steps */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Pending Steps (editable)</Label>
              <div className="space-y-2">
                {editableSteps.map((step, idx) => (
                  <div
                    key={`editable-${step.approverId}-${idx}`}
                    className="flex items-center gap-2 p-2.5 border rounded-lg bg-primary/5 border-primary/20"
                  >
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      Step {completedSteps.length + idx + 1}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{step.approverName}</p>
                      <p className="text-[10px] text-muted-foreground">{step.approverRole}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={idx === 0}
                        onClick={() => handleMoveStep(idx, 'up')}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={idx === editableSteps.length - 1}
                        onClick={() => handleMoveStep(idx, 'down')}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveStep(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
                {editableSteps.length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg border-dashed">
                    No pending approvers. Add at least one below.
                  </div>
                )}
              </div>
            </div>

            {/* Add new approver */}
            {totalEditableStepCount < 3 && unusedApprovers.length > 0 && (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Add Approver</Label>
                  <Select value={selectedNewApprover} onValueChange={setSelectedNewApprover}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select an approver..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unusedApprovers.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({a.department})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddApprover}
                  disabled={!selectedNewApprover}
                  className="gap-1 h-8"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            )}
            {totalEditableStepCount >= 3 && (
              <p className="text-xs text-muted-foreground">Maximum of 3 approval steps reached.</p>
            )}

            {/* Reason for change */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Reason for change (required)</Label>
              <Input
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="e.g. Original approver is on leave"
                className="h-8 text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditChainDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveChain}
              disabled={isSavingChain || editableSteps.length === 0 || !editReason.trim()}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
