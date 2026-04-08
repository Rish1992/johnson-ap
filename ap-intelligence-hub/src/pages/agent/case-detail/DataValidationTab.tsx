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
import { PdfViewer } from '@/components/shared/PdfViewer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ReturnReasonBanner } from '@/components/shared/ReturnReasonBanner';
import { useAuthStore } from '@/stores/authStore';
import { Separator } from '@/components/ui/separator';
import {
  Save, CheckCircle, X, Plus, Trash2, Upload, Mail, AlertTriangle,
  FileText, ZoomIn, ZoomOut, Loader2, Maximize2, MapPin,
  GripVertical, ChevronUp, ChevronDown, UserCheck, Users, Search, ChevronsUpDown,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { CURRENCIES, INVOICE_TYPES } from '@/lib/constants';
import { toast } from 'sonner';
import type { ConfidenceLevel, BoundingBox, ExtractedField } from '@/types/case';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/johnson-api';

// ---------------------------------------------------------------------------
// Simple field presence indicator (green check / red X)
// ---------------------------------------------------------------------------
function FieldPresenceBadge({ hasValue }: { hasValue: boolean }) {
  return hasValue ? (
    <span className="text-green-600 text-xs font-medium">&#10003;</span>
  ) : (
    <span className="text-red-500 text-xs font-medium">&#10007;</span>
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
  const [activeBbox, setActiveBbox] = useState<BoundingBox | null>(null);
  const [approverDropdownOpen, setApproverDropdownOpen] = useState(false);
  const [approverSearch, setApproverSearch] = useState('');
  const [dynamicInvoiceFields, setDynamicInvoiceFields] = useState<{ key: string; label: string; type: string }[] | null>(null);
  const [dynamicSupportingFields, setDynamicSupportingFields] = useState<Record<string, { key: string; label: string; type: string }[]> | null>(null);

  // Determine which document types are available based on category AND actual attachments
  const availableDocTypes = useMemo(() => {
    if (!selectedCase) return ['INVOICE'] as const;
    const hasJobSheet = (selectedCase.attachments ?? []).some(a => a.documentType === 'JOB_SHEET');
    if (hasJobSheet && (selectedCase.category === 'SUBCONTRACTOR' || selectedCase.category === 'RUST_SUBCONTRACTOR' || selectedCase.category === 'DELIVERY_INSTALLATION')) {
      return ['INVOICE', 'JOB_SHEET'] as const;
    }
    return ['INVOICE'] as const;
  }, [selectedCase]);

  useEffect(() => {
    initDraft();
    // Load GL accounts from real API
    import('@/lib/handlers').then(({ fetchGLAccounts }) => {
      fetchGLAccounts().then((accounts: { accountNumber: string; name: string }[]) => {
        setGLAccounts(accounts.map(a => ({ id: a.accountNumber, accountNumber: a.accountNumber, name: a.name })));
      });
    });
    // Load approvers from real API
    import('@/lib/handlers').then(({ fetchUsers }) => {
      fetchUsers().then((users: { id: string; role: string; isActive: boolean; fullName: string; department?: string; approvalLimit?: number }[]) => {
        const totalAmount = selectedCase?.headerData.grandTotal ?? 0;
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

  // Fetch dynamic field definitions from API (fallback to hardcoded on failure)
  useEffect(() => {
    if (!selectedCase?.category) return;
    import('@/lib/handlers').then(({ fetchCategoryFields }) => {
      fetchCategoryFields(selectedCase.category).then((cfg) => {
        if (cfg?.invoiceFields?.length) setDynamicInvoiceFields(cfg.invoiceFields);
        if (cfg?.supportingFields && Object.keys(cfg.supportingFields).length) {
          // Flatten all supporting doc types into a single array for the JOB_SHEET tab
          const allSupporting = Object.values(cfg.supportingFields).flat();
          if (allSupporting.length) setDynamicSupportingFields(cfg.supportingFields);
        }
      }).catch(() => { /* fallback to hardcoded */ });
    });
  }, [selectedCase?.category]);

  const supportingData = useMemo(() => {
    const sd = selectedCase?.supportingData || {};
    return Object.values(sd).reduce((acc, docFields) => ({ ...acc, ...(docFields || {}) }), {} as Record<string, unknown>);
  }, [selectedCase?.supportingData]);

  // Build lookup from extractedFields for bbox and presence checks
  const fieldsByDoc = useMemo(() => {
    const fields = selectedCase?.extractedFields || [];
    const map: Record<string, Record<string, ExtractedField>> = {};
    for (const f of fields) {
      if (!map[f.doc]) map[f.doc] = {};
      map[f.doc][f.key] = f;
    }
    return map;
  }, [selectedCase?.extractedFields]);

  // Fields shown — dynamic from API, no hardcoded fallback
  const invoiceFields = dynamicInvoiceFields ?? [];
  const jobSheetFields = useMemo(() => {
    if (!dynamicSupportingFields) return [];
    const extractedDocTypes = new Set(Object.keys(fieldsByDoc).filter(d => d !== 'Invoice'));
    return Object.entries(dynamicSupportingFields)
      .filter(([docType]) => extractedDocTypes.has(docType))
      .flatMap(([, fields]) => fields);
  }, [dynamicSupportingFields, fieldsByDoc]);

  if (!selectedCase || !draftHeaderData) return null;

  const headerData = { ...selectedCase.headerData, ...draftHeaderData };
  const lineItems = draftLineItems || selectedCase.lineItems;

  const isReadOnly = ['APPROVED', 'POSTED', 'CLOSED', 'REJECTED', 'DISCARDED'].includes(selectedCase.status);


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

  const headerFields = activeDocumentType === 'JOB_SHEET' ? jobSheetFields : invoiceFields;
  const fieldConfigMissing = !dynamicInvoiceFields;

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

      {fieldConfigMissing && (
        <div className="p-4 mb-4 flex items-center gap-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Failed to load field configuration for category: {selectedCase?.category || 'unknown'}. Contact admin to verify category config exists.
          </p>
        </div>
      )}

      <ResizablePanelGroup orientation="horizontal" className="min-h-[600px] rounded-lg border">
        {/* Left Panel - Document Viewer */}
        <ResizablePanel defaultSize={50} minSize={30}>
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

            {/* Document content - PDF viewer with bbox highlighting */}
            {(() => {
              const atts = selectedCase.attachments || [];
              const att = activeDocumentType === 'INVOICE'
                ? (atts.find((a: Record<string, unknown>) => a.documentType === 'INVOICE') || atts[0])
                : atts.find((a: Record<string, unknown>) => a.documentType === 'JOB_SHEET') || atts[0];
              const fileUrl = att?.fileUrl;
              return fileUrl ? (
                <PdfViewer
                  url={`${API_BASE}${fileUrl}`}
                  activeBbox={activeBbox}
                  className="flex-1"
                />
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
                    <ConfidenceBadge
                      score={selectedCase.overallConfidence}
                      level={selectedCase.overallConfidenceLevel}
                    />
                  )}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {headerFields.map((field) => {
                    const ef = activeDocumentType === 'JOB_SHEET'
                      ? Object.entries(fieldsByDoc).filter(([doc]) => doc !== 'Invoice').map(([, fields]) => fields[field.key]).find(f => f)
                      : fieldsByDoc['Invoice']?.[field.key];
                    const bbox = ef?.bbox ? { page: ef.page ?? 1, x: ef.bbox.x, y: ef.bbox.y, width: ef.bbox.width, height: ef.bbox.height } as BoundingBox : null;
                    const dataSource = activeDocumentType === 'JOB_SHEET' ? supportingData : headerData as unknown as Record<string, unknown>;
                    const value = dataSource[field.key];
                    const original = (selectedCase.headerData as unknown as Record<string, unknown>)[field.key];
                    const isModified = draftHeaderData[field.key as keyof typeof draftHeaderData] !== undefined &&
                      draftHeaderData[field.key as keyof typeof draftHeaderData] !== original;

                    return (
                      <div
                        key={field.key}
                        className={`space-y-1 group/field${bbox ? ' cursor-pointer' : ''}`}
                        onClick={bbox ? () => setActiveBbox(bbox) : undefined}
                      >
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            {field.label}
                            {bbox && <MapPin className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover/field:opacity-100 transition-opacity" />}
                          </Label>
                          <div className="flex items-center gap-1">
                            {isModified && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200">
                                Edited
                              </Badge>
                            )}
                            {!hideConfidence && <FieldPresenceBadge hasValue={value != null && value !== ''} />}
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
                    Auto-identified based on invoice amount ({formatCurrency(headerData.grandTotal, headerData.currency)}). Reorder or modify as needed.
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

                  {/* Add approvers — multi-select dropdown */}
                  {approvers.some(a => !a.selected) && (
                    <Popover open={approverDropdownOpen} onOpenChange={(o) => { setApproverDropdownOpen(o); if (!o) setApproverSearch(''); }}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-between gap-2 h-8 text-xs font-normal text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            Add approvers…
                          </span>
                          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0" align="start">
                        {/* Search */}
                        <div className="p-2 border-b">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                              className="w-full pl-8 pr-3 py-1.5 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
                              placeholder="Search approvers…"
                              value={approverSearch}
                              onChange={e => setApproverSearch(e.target.value)}
                              autoFocus
                            />
                          </div>
                        </div>
                        {/* List */}
                        <div className="max-h-52 overflow-y-auto">
                          {approvers
                            .filter(a => !a.selected && (
                              !approverSearch ||
                              a.name.toLowerCase().includes(approverSearch.toLowerCase()) ||
                              a.department.toLowerCase().includes(approverSearch.toLowerCase())
                            ))
                            .map(approver => (
                              <label
                                key={approver.id}
                                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
                              >
                                <Checkbox
                                  checked={false}
                                  onCheckedChange={() => { toggleApprover(approver.id); }}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{approver.name}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {approver.department} · Limit: {formatCurrency(approver.limit)}
                                  </p>
                                </div>
                                {approver.limit < headerData.grandTotal && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                                    Below limit
                                  </Badge>
                                )}
                              </label>
                            ))}
                          {approvers.filter(a => !a.selected).length === 0 && (
                            <p className="text-center text-xs text-muted-foreground py-4">All approvers added</p>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
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

      {/* Missing Documents Auto-Detection Banner — driven by verify_docs step output */}
      {!isReadOnly && !missingDocsDismissed && (() => {
        const verifyEntry = (selectedCase.businessRuleResults || []).find(
          (r: any) => r.step === 'verify_docs'
        ) as { step: string; output: { missingDocs?: string[] } } | undefined;
        const missing: string[] = verifyEntry?.output?.missingDocs ?? [];
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
        <DialogContent className="max-w-[85vw] h-[90vh] flex flex-col p-0">
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
              <PdfViewer url={`${API_BASE}${fileUrl}`} className="flex-1" />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">No document available</div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
