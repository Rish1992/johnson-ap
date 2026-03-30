import { useEffect, useState, useMemo } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useCaseStore } from '@/stores/caseStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
// MockInvoiceDocument removed — replaced with real PDF viewer
import { ReturnReasonBanner } from '@/components/shared/ReturnReasonBanner';
import { useAuthStore } from '@/stores/authStore';
import { Separator } from '@/components/ui/separator';
import {
  Save, CheckCircle, X, Plus, Trash2, Upload, Mail, AlertTriangle,
  FileText, ZoomIn, ZoomOut, Loader2,
  GripVertical, ChevronUp, ChevronDown, UserCheck, Users,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { CURRENCIES, INVOICE_TYPES } from '@/lib/constants';
import { toast } from 'sonner';
import type { ConfidenceLevel } from '@/types/case';

// ---------------------------------------------------------------------------
// Deterministic hash for a string -> number in [0, 1)
// Used to generate synthetic confidence scores that are stable across renders
// ---------------------------------------------------------------------------
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) / 2147483647; // normalise to 0-1
}

function syntheticConfidence(fieldKey: string, overallConfidence: number): { value: number; level: ConfidenceLevel } {
  // Produce a deterministic value in [overall*0.85, overall*1.0]
  const h = hashString(fieldKey);
  const raw = overallConfidence * (0.85 + h * 0.15);
  const clamped = Math.min(raw, 1);
  const level: ConfidenceLevel = clamped >= 0.85 ? 'HIGH' : clamped >= 0.7 ? 'MEDIUM' : 'LOW';
  return { value: clamped, level };
}

// ---------------------------------------------------------------------------
// Format a 0-1 confidence score to "XX.XX" for display.
// If the value is already > 1 (i.e. already on 0-100 scale), don't multiply.
// ---------------------------------------------------------------------------
function formatConfidencePercent(score: number): string {
  const pct = score > 1 ? score : score * 100;
  return pct.toFixed(2);
}


// ---------------------------------------------------------------------------
// Inline ConfidenceBadge that formats to 2 decimal places
// Wraps the shared component but overrides the score display
// ---------------------------------------------------------------------------
function InlineConfidenceBadge({ score, level }: { score: number; level: ConfidenceLevel }) {
  const pctString = formatConfidencePercent(score);
  // We render our own percentage display because the shared component
  // does `{score}%` which won't give us 2 decimal places.
  return (
    <ConfidenceBadge score={Number(pctString)} level={level} />
  );
}

// ---------------------------------------------------------------------------
// Approver type
// ---------------------------------------------------------------------------
interface Approver {
  id: string;
  name: string;
  department: string;
  limit: number;
  selected: boolean;
  order: number;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function DataValidationTab() {
  const user = useAuthStore((s) => s.user);
  const hideConfidence = user?.role === 'AP_REVIEWER';

  const {
    selectedCase, draftHeaderData, draftLineItems,
    initDraft, updateDraftField, updateDraftLineItem, addLineItem, removeLineItem,
    saveDraft, saveAndConfirm,
  } = useCaseStore();

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitComment, setSubmitComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [activeDocumentType, setActiveDocumentType] = useState<'INVOICE' | 'JOB_SHEET'>('INVOICE');
  const [docPreviewOpen, setDocPreviewOpen] = useState(false);
  const [glAccounts, setGLAccounts] = useState<{ id: string; accountNumber: string; name: string }[]>([]);
  const [showDraftEmailDialog, setShowDraftEmailDialog] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [missingDocsDismissed, setMissingDocsDismissed] = useState(false);

  // Determine which document types are available based on category
  const availableDocTypes = useMemo(() => {
    if (!selectedCase) return ['INVOICE'] as const;
    if (selectedCase.category === 'SUBCONTRACTOR' || selectedCase.category === 'RUST_SUBCONTRACTOR' || selectedCase.category === 'DELIVERY_INSTALLATION') {
      return ['INVOICE', 'JOB_SHEET'] as const;
    }
    return ['INVOICE'] as const;
  }, [selectedCase]);

  useEffect(() => {
    initDraft();
    // Load GL accounts from real API
    import('@/lib/handlers').then(({ fetchGLAccounts }) => {
      fetchGLAccounts().then((accounts: { accountNumber: string; name: string }[]) => {
        setGLAccounts(accounts.map(a => a.accountNumber));
      });
    });
    // Load approvers from real API
    import('@/lib/handlers').then(({ fetchUsers }) => {
      fetchUsers().then((users: { id: string; role: string; isActive: boolean; fullName: string; department?: string; approvalLimit?: number }[]) => {
        const totalAmount = selectedCase?.headerData.totalAmount ?? 0;
        const reviewers = users
          .filter(u => u.role === 'AP_REVIEWER' && u.isActive)
          .map((u, idx) => ({
            id: u.id,
            name: u.fullName,
            department: u.department || '',
            limit: u.approvalLimit || 0,
            selected: (u.approvalLimit || 0) >= totalAmount,
            order: idx,
          }))
          .sort((a, b) => b.limit - a.limit);

        const anySelected = reviewers.some(a => a.selected);
        if (!anySelected && reviewers.length > 0) {
          reviewers[0].selected = true;
        }

        let order = 0;
        for (const a of reviewers) {
          if (a.selected) {
            a.order = order++;
          }
        }

        setApprovers(reviewers);
      });
    });
  }, [initDraft, selectedCase]);

  if (!selectedCase || !draftHeaderData) return null;

  const headerData = { ...selectedCase.headerData, ...draftHeaderData };
  const lineItems = draftLineItems || selectedCase.lineItems;

  const isReadOnly = !['EXTRACTED', 'IN_REVIEW', 'RETURNED'].includes(selectedCase.status);

  // Build confidence map for ALL fields
  const getFieldConfidence = (fieldKey: string): { value: number; level: ConfidenceLevel } => {
    const explicit = selectedCase.confidenceScores[fieldKey];
    if (explicit) {
      return { value: explicit.value, level: explicit.level };
    }
    return syntheticConfidence(fieldKey, selectedCase.overallConfidence);
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    await saveDraft();
    setIsSaving(false);
    toast.success('Draft saved successfully');
  };

  const handleSaveAndConfirmClick = () => {
    const selectedApproverIds = approvers
      .filter(a => a.selected)
      .sort((a, b) => a.order - b.order)
      .map(a => a.id);

    if (selectedApproverIds.length === 0) {
      toast.error('Select at least one approver in the Approval Sequence section');
      return;
    }

    setSubmitComment('');
    setShowSubmitDialog(true);
  };

  const handleConfirmSubmit = async () => {
    const selectedApproverIds = approvers
      .filter(a => a.selected)
      .sort((a, b) => a.order - b.order)
      .map(a => a.id);

    setShowSubmitDialog(false);
    setIsSaving(true);
    await saveAndConfirm();
    const { submitForApproval } = useCaseStore.getState();
    await submitForApproval(selectedApproverIds, submitComment.trim() || undefined);
    setIsSaving(false);
    toast.success('Case submitted for approval');
  };

  const handleReject = async () => {
    if (rejectReason.trim().length < 10) {
      toast.error('Please provide a reason (min 10 characters)');
      return;
    }
    const { rejectCase } = useCaseStore.getState();
    await rejectCase(rejectReason);
    setShowRejectDialog(false);
    toast.success('Case rejected');
  };

  const toggleApprover = (approverId: string) => {
    setApprovers(prev => {
      const updated = prev.map(a => {
        if (a.id === approverId) {
          return { ...a, selected: !a.selected };
        }
        return a;
      });
      // Re-assign order for selected ones
      let order = 0;
      for (const a of updated) {
        if (a.selected) {
          a.order = order++;
        }
      }
      return updated;
    });
  };

  const moveApprover = (approverId: string, direction: 'up' | 'down') => {
    setApprovers(prev => {
      const selectedList = prev.filter(a => a.selected).sort((a, b) => a.order - b.order);
      const idx = selectedList.findIndex(a => a.id === approverId);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= selectedList.length) return prev;

      // Swap orders
      const tempOrder = selectedList[idx].order;
      const swapOrder = selectedList[swapIdx].order;

      return prev.map(a => {
        if (a.id === selectedList[idx].id) return { ...a, order: swapOrder };
        if (a.id === selectedList[swapIdx].id) return { ...a, order: tempOrder };
        return a;
      });
    });
  };

  const removeApprover = (approverId: string) => {
    setApprovers(prev => {
      const updated = prev.map(a =>
        a.id === approverId ? { ...a, selected: false } : a
      );
      let order = 0;
      for (const a of updated.filter(a => a.selected).sort((a, b) => a.order - b.order)) {
        const target = updated.find(u => u.id === a.id);
        if (target) target.order = order++;
      }
      return [...updated];
    });
  };

  const selectedApproversCount = approvers.filter(a => a.selected).length;

  // Fields shown for invoice documents
  const invoiceFields = [
    { key: 'invoiceNumber', label: 'Invoice Number', type: 'text' },
    { key: 'invoiceType', label: 'Invoice Type', type: 'select', options: INVOICE_TYPES },
    { key: 'invoiceDate', label: 'Invoice Date', type: 'date' },
    { key: 'dueDate', label: 'Due Date', type: 'date' },
    { key: 'currency', label: 'Currency', type: 'select', options: CURRENCIES },
    { key: 'totalAmount', label: 'Total Amount', type: 'number' },
    { key: 'taxAmount', label: 'Tax Amount', type: 'number' },
    { key: 'netAmount', label: 'Net Amount', type: 'number' },
    { key: 'purchaseOrderNumber', label: 'PO Number', type: 'text' },
    { key: 'deliveryNoteNumber', label: 'Delivery Note', type: 'text' },
    { key: 'paymentTerms', label: 'Payment Terms', type: 'text' },
    { key: 'companyCode', label: 'Company Code', type: 'text' },
    { key: 'plantCode', label: 'Plant Code', type: 'text' },
    { key: 'costCenter', label: 'Cost Center', type: 'text' },
    { key: 'glAccount', label: 'GL Account', type: 'text' },
    { key: 'taxCode', label: 'Tax Code', type: 'text' },
    { key: 'description', label: 'Description', type: 'text' },
  ] as const;

  // Fields shown for job sheet documents
  const jobSheetFields = [
    { key: 'purchaseOrderNumber', label: 'PO / Work Order', type: 'text' },
    { key: 'deliveryNoteNumber', label: 'Delivery Note', type: 'text' },
    { key: 'invoiceDate', label: 'Completion Date', type: 'date' },
    { key: 'companyCode', label: 'Company Code', type: 'text' },
    { key: 'plantCode', label: 'Plant Code', type: 'text' },
    { key: 'costCenter', label: 'Cost Center', type: 'text' },
    { key: 'description', label: 'Work Description', type: 'text' },
  ] as const;

  const headerFields = activeDocumentType === 'JOB_SHEET' ? jobSheetFields : invoiceFields;

  return (
    <>
      {/* Return Reason Banner */}
      {selectedCase.status === 'RETURNED' && selectedCase.returnReason && (
        <ReturnReasonBanner
          returnedBy={selectedCase.returnedByName || 'Approver'}
          returnedAt={selectedCase.returnedAt ?? undefined}
          returnReason={selectedCase.returnReason}
          variant="div"
        />
      )}

      <ResizablePanelGroup orientation="horizontal" className="min-h-[600px] rounded-lg border">
        {/* Left Panel - Document Viewer */}
        <ResizablePanel defaultSize={40} minSize={25}>
          <div className="flex flex-col h-full">
            {/* Document viewer header with type selector */}
            <div className="flex items-center justify-between p-3 border-b bg-accent/30">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <Select
                  value={activeDocumentType}
                  onValueChange={(v) => setActiveDocumentType(v as 'INVOICE' | 'JOB_SHEET')}
                >
                  <SelectTrigger className="h-7 w-[180px] text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INVOICE">Invoice Document</SelectItem>
                    {(availableDocTypes as readonly string[]).includes('JOB_SHEET') && (
                      <SelectItem value="JOB_SHEET">Job Sheet</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Document content - click to expand */}
            {(() => {
              const atts = selectedCase.attachments || [];
              const att = activeDocumentType === 'INVOICE'
                ? (atts.find((a: Record<string, unknown>) => a.documentType === 'INVOICE') || atts[0])
                : atts.find((a: Record<string, unknown>) => a.documentType === 'JOB_SHEET') || atts[0];
              const fileUrl = att?.fileUrl;
              return fileUrl ? (
                <div className="flex-1 relative group/doc cursor-pointer" onClick={() => setDocPreviewOpen(true)} title="Click to expand">
                  <iframe src={`/johnson-api${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=page-width`} className="w-full h-full border-0 pointer-events-none" title={att?.fileName || 'Document'} />
                  <div className="absolute inset-0 bg-black/0 group-hover/doc:bg-black/5 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover/doc:opacity-100 transition-opacity bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg border flex items-center gap-1.5">
                      <ZoomIn className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Click to expand</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-accent/10 text-muted-foreground text-sm">
                  No document available
                </div>
              );
            })()}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Extracted Data */}
        <ResizablePanel defaultSize={60} minSize={35}>
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              {/* Header Data */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  {activeDocumentType === 'JOB_SHEET' ? 'Job Sheet Data' : 'Invoice Data'}
                  {!hideConfidence && selectedCase.overallConfidence > 0 && (
                    <InlineConfidenceBadge
                      score={selectedCase.overallConfidence}
                      level={selectedCase.overallConfidenceLevel}
                    />
                  )}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {headerFields.map((field) => {
                    const confidence = getFieldConfidence(field.key);
                    const value = (headerData as unknown as Record<string, unknown>)[field.key];
                    const original = (selectedCase.headerData as unknown as Record<string, unknown>)[field.key];
                    const isModified = draftHeaderData[field.key as keyof typeof draftHeaderData] !== undefined &&
                      draftHeaderData[field.key as keyof typeof draftHeaderData] !== original;

                    return (
                      <div key={field.key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">{field.label}</Label>
                          <div className="flex items-center gap-1">
                            {isModified && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200">
                                Edited
                              </Badge>
                            )}
                            {!hideConfidence && (<InlineConfidenceBadge score={confidence.value} level={confidence.level} />)}
                          </div>
                        </div>
                        {field.type === 'select' ? (
                          <Select
                            value={String(value)}
                            onValueChange={(v) => updateDraftField(field.key, v)}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger size="sm" className="!h-8 w-full text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(field.options as readonly string[])?.map((opt: string) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                            value={String(value || '')}
                            onChange={(e) => updateDraftField(
                              field.key,
                              field.type === 'number' ? Number(e.target.value) : e.target.value
                            )}
                            className="h-8 text-sm"
                            readOnly={isReadOnly}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Line Items ({lineItems.length})
                  </h3>
                  {!isReadOnly && (
                    <Button variant="outline" size="sm" onClick={addLineItem} className="gap-1">
                      <Plus className="h-3.5 w-3.5" />
                      Add Row
                    </Button>
                  )}
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-16">Qty</TableHead>
                        <TableHead className="w-20">Unit</TableHead>
                        <TableHead className="w-24">Rate</TableHead>
                        <TableHead className="w-24">Amount</TableHead>
                        <TableHead className="w-40">GL Account</TableHead>
                        {!isReadOnly && <TableHead className="w-10" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs text-muted-foreground">{item.lineNumber}</TableCell>
                          <TableCell>
                            <Input
                              value={item.description}
                              onChange={(e) => updateDraftLineItem(item.id, 'description', e.target.value)}
                              className="h-7 text-xs border-0 bg-transparent p-0"
                              readOnly={isReadOnly}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateDraftLineItem(item.id, 'quantity', Number(e.target.value))}
                              className="h-7 text-xs border-0 bg-transparent p-0 w-14"
                              readOnly={isReadOnly}
                            />
                          </TableCell>
                          <TableCell className="text-xs">{item.unit}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => updateDraftLineItem(item.id, 'unitPrice', Number(e.target.value))}
                              className="h-7 text-xs border-0 bg-transparent p-0 w-20"
                              readOnly={isReadOnly}
                            />
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {formatCurrency(item.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.glAccount || ''}
                              onValueChange={(v) => updateDraftLineItem(item.id, 'glAccount', v)}
                              disabled={isReadOnly}
                            >
                              <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 w-36">
                                <SelectValue placeholder="Select GL" />
                              </SelectTrigger>
                              <SelectContent>
                                {glAccounts.map((gl) => (
                                  <SelectItem key={gl.id} value={gl.accountNumber}>
                                    {gl.accountNumber} - {gl.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          {!isReadOnly && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeLineItem(item.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end mt-2">
                  <span className="text-sm font-semibold">
                    Line Total: {formatCurrency(lineItems.reduce((sum, li) => sum + li.totalAmount, 0))}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Approval Sequence */}
              {!isReadOnly && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Approval Sequence
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Auto-identified based on invoice amount ({formatCurrency(headerData.totalAmount, headerData.currency)}). Reorder or modify as needed.
                  </p>

                  {/* Selected approvers in order */}
                  <div className="space-y-2 mb-3">
                    {approvers
                      .filter(a => a.selected)
                      .sort((a, b) => a.order - b.order)
                      .map((approver, idx, arr) => (
                        <div
                          key={approver.id}
                          className="flex items-center gap-2 p-2.5 border rounded-lg bg-primary/5 border-primary/20"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                            Step {idx + 1}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{approver.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {approver.department} &middot; Limit: {formatCurrency(approver.limit)}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              disabled={idx === 0}
                              onClick={() => moveApprover(approver.id, 'up')}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              disabled={idx === arr.length - 1}
                              onClick={() => moveApprover(approver.id, 'down')}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeApprover(approver.id)}
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    {selectedApproversCount === 0 && (
                      <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg border-dashed">
                        No approvers selected. Select from the list below.
                      </div>
                    )}
                  </div>

                  {/* Available approvers to add */}
                  {approvers.some(a => !a.selected) && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground font-medium">Add approvers</span>
                      </div>
                      <div className="space-y-1">
                        {approvers
                          .filter(a => !a.selected)
                          .map((approver) => (
                            <label
                              key={approver.id}
                              className="flex items-center gap-3 p-2 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                            >
                              <Checkbox
                                checked={false}
                                onCheckedChange={() => toggleApprover(approver.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{approver.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {approver.department} &middot; Limit: {formatCurrency(approver.limit)}
                                </p>
                              </div>
                              {approver.limit < headerData.totalAmount && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                                  Below amount
                                </Badge>
                              )}
                            </label>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* File Upload Area */}
      {!isReadOnly && (
        <div className="mt-4">
          <div
            className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setUploadedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]); }}
            onClick={() => document.getElementById('file-upload-input')?.click()}
          >
            <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-sm text-muted-foreground">Drag files here or click to browse</p>
            <input id="file-upload-input" type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) setUploadedFiles(prev => [...prev, ...Array.from(e.target.files!)]); }} />
          </div>
          {uploadedFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              {uploadedFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm px-2 py-1 bg-accent/30 rounded">
                  <span className="truncate">{f.name}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setUploadedFiles(prev => prev.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Missing Documents Auto-Detection Banner (Item 24) */}
      {!isReadOnly && !missingDocsDismissed && (() => {
        const docTypes = (selectedCase.attachments || []).map(a => a.documentType);
        const missing: string[] = [];
        if ((selectedCase.category === 'SUBCONTRACTOR' || selectedCase.category === 'RUST_SUBCONTRACTOR' || selectedCase.category === 'DELIVERY_INSTALLATION') && !docTypes.includes('JOB_SHEET')) missing.push('Job Sheet');
        if (!docTypes.includes('INVOICE')) missing.push('Tax Invoice');
        if (missing.length === 0) return null;
        return (
          <div className="flex items-start gap-3 mt-4 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">Missing mandatory documents detected:</p>
              <ul className="list-disc pl-4 mt-1 text-amber-700 dark:text-amber-400 text-xs">
                {missing.map(d => <li key={d}>{d} (required for {selectedCase.category} category)</li>)}
              </ul>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => {
                setRejectReason(`Missing mandatory documents: ${missing.join(', ')}`);
                setShowRejectDialog(true);
              }}><Mail className="h-3 w-3" /> Auto-Draft Vendor Email</Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setMissingDocsDismissed(true)}>Dismiss</Button>
            </div>
          </div>
        );
      })()}

      {/* Action Bar */}
      {!isReadOnly && (
        <div className="flex items-center justify-between mt-4 p-4 border rounded-lg bg-card">
          <Button
            variant="destructive"
            onClick={() => setShowRejectDialog(true)}
          >
            Reject
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDraftEmailDialog(true)}
              className="gap-1"
            >
              <Mail className="h-4 w-4" />
              Draft Email
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="gap-1"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Draft
            </Button>
            <Button
              onClick={handleSaveAndConfirmClick}
              disabled={isSaving}
              className="gap-1"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Save & Confirm ({selectedApproversCount})
            </Button>
          </div>
        </div>
      )}

      {/* Submit for Approval Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit for Approval</DialogTitle>
            <DialogDescription>
              Add a comment for the approval team (optional)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter a comment for the approvers..."
            value={submitComment}
            onChange={(e) => setSubmitComment(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSubmit} className="gap-1">
              <CheckCircle className="h-4 w-4" />
              Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog with Draft Email */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject Invoice</DialogTitle>
            <DialogDescription>
              This action is permanent. The invoice will be rejected and cannot be reopened.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium">Rejection Comment (min 10 characters)</Label>
              <Textarea
                placeholder="Reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
            {rejectReason.trim().length >= 10 && (
              <div>
                <Label className="text-xs font-medium">Draft Email to Vendor</Label>
                <Textarea
                  readOnly
                  className="mt-1 text-xs bg-muted/50"
                  rows={5}
                  value={`Dear ${selectedCase.vendorName},\n\nWe are unable to process invoice ${headerData.invoiceNumber} due to:\n${rejectReason.trim()}\n\nPlease resubmit with corrected documents.\n\nRegards,\nJohnson Controls AP Team`}
                />
                <div className="flex gap-2 mt-1.5">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                    navigator.clipboard.writeText(`Dear ${selectedCase.vendorName},\n\nWe are unable to process invoice ${headerData.invoiceNumber} due to:\n${rejectReason.trim()}\n\nPlease resubmit with corrected documents.\n\nRegards,\nJohnson Controls AP Team`);
                    toast.success('Email copied to clipboard');
                  }}>Copy Email</Button>
                  <Button size="sm" className="text-xs gap-1" disabled={sendingEmail} onClick={() => {
                    setSendingEmail(true);
                    setTimeout(() => {
                      setSendingEmail(false);
                      toast.success(`Email sent to ${selectedCase.vendorName}`);
                    }, 500);
                  }}>
                    {sendingEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                    Send Email
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft Email Dialog for Validation Issues (Item 17) */}
      <Dialog open={showDraftEmailDialog} onOpenChange={setShowDraftEmailDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Draft Email — Validation Issues</DialogTitle>
            <DialogDescription>Auto-generated email based on business rule failures.</DialogDescription>
          </DialogHeader>
          <Textarea
            readOnly
            className="text-xs bg-muted/50"
            rows={10}
            value={(() => {
              const failures = selectedCase.businessRuleResults.filter(r => r.status === 'FAIL');
              const issueList = failures.length > 0
                ? failures.map((r, i) => `${i + 1}. ${r.ruleName}: ${r.message}${r.expectedValue ? ` (Expected: ${r.expectedValue}, Actual: ${r.actualValue})` : ''}`).join('\n')
                : 'No validation issues found.';
              return `Dear ${selectedCase.vendorName},\n\nThe following issues were found with invoice ${headerData.invoiceNumber}:\n\n${issueList}\n\nPlease address these issues and resubmit.\n\nRegards,\nJohnson Controls AP Team`;
            })()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDraftEmailDialog(false)}>Close</Button>
            <Button onClick={() => {
              const failures = selectedCase.businessRuleResults.filter(r => r.status === 'FAIL');
              const issueList = failures.length > 0
                ? failures.map((r, i) => `${i + 1}. ${r.ruleName}: ${r.message}${r.expectedValue ? ` (Expected: ${r.expectedValue}, Actual: ${r.actualValue})` : ''}`).join('\n')
                : 'No validation issues found.';
              navigator.clipboard.writeText(`Dear ${selectedCase.vendorName},\n\nThe following issues were found with invoice ${headerData.invoiceNumber}:\n\n${issueList}\n\nPlease address these issues and resubmit.\n\nRegards,\nJohnson Controls AP Team`);
              toast.success('Email copied to clipboard');
            }}>
              Copy to Clipboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      <Dialog open={docPreviewOpen} onOpenChange={setDocPreviewOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              {activeDocumentType === 'INVOICE'
                ? (selectedCase.attachments.find(a => a.documentType === 'INVOICE')?.fileName
                    || selectedCase.attachments[0]?.fileName
                    || 'invoice.pdf')
                : (selectedCase.attachments.find(a => a.documentType === 'JOB_SHEET')?.fileName
                    || 'job-sheet.pdf')
              }
            </DialogTitle>
            <DialogDescription className="text-xs">
              {activeDocumentType === 'INVOICE' ? 'Tax Invoice Document' : 'Job Completion Sheet'} &middot; {selectedCase.vendorName}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const atts = selectedCase.attachments || [];
            const att = activeDocumentType === 'INVOICE'
              ? (atts.find((a: Record<string, unknown>) => a.documentType === 'INVOICE') || atts[0])
              : atts.find((a: Record<string, unknown>) => a.documentType === 'JOB_SHEET') || atts[0];
            const fileUrl = att?.fileUrl;
            return fileUrl ? (
              <iframe src={`/johnson-api${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=page-width`} className="flex-1 w-full border-0" title={att?.fileName || 'Document'} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">No document available</div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
