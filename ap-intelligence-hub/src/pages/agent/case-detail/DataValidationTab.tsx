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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { useAuthStore } from '@/stores/authStore';
import { Separator } from '@/components/ui/separator';
import {
  Save, CheckCircle, X, Plus, Trash2,
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
// Mock Invoice SVG Document Component
// ---------------------------------------------------------------------------
function MockInvoiceDocument({ vendorName, invoiceNumber, invoiceDate, totalAmount }: {
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: string;
}) {
  return (
    <div className="w-full max-w-[520px] mx-auto bg-white rounded shadow-md border border-gray-200 p-0 overflow-hidden select-none" style={{ fontFamily: 'monospace' }}>
      {/* Scanned document effect - slight rotation and noise */}
      <div className="relative bg-[#fafaf7]" style={{ transform: 'rotate(-0.3deg)' }}>
        {/* Header area */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-300">
          <div className="flex items-start justify-between">
            <div>
              <div className="w-28 h-8 bg-gray-300 rounded mb-2 flex items-center justify-center">
                <span className="text-[9px] text-gray-600 font-bold tracking-wider">LOGO</span>
              </div>
              <div className="text-[10px] text-gray-700 leading-tight">
                <div className="font-bold text-xs">{vendorName || 'Vendor Name'}</div>
                <div>123 Business Park, Level 5</div>
                <div>Sydney, NSW 2000</div>
                <div>ABN: 51 824 753 556</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-800 tracking-wide">TAX INVOICE</div>
              <div className="text-[10px] text-gray-600 mt-1">Original for Recipient</div>
            </div>
          </div>
        </div>

        {/* Invoice details */}
        <div className="px-6 py-3 grid grid-cols-2 gap-x-8 gap-y-1 text-[10px] text-gray-700 border-b border-gray-200">
          <div className="flex justify-between">
            <span className="text-gray-500">Invoice No:</span>
            <span className="font-semibold">{invoiceNumber || 'INV-2025001'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date:</span>
            <span className="font-semibold">{invoiceDate || '2025-01-15'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">PO Number:</span>
            <span className="font-semibold">PO-44821</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Due Date:</span>
            <span className="font-semibold">Net 30</span>
          </div>
        </div>

        {/* Bill To / Ship To */}
        <div className="px-6 py-3 grid grid-cols-2 gap-x-8 text-[10px] text-gray-700 border-b border-gray-200">
          <div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Bill To</div>
            <div className="font-semibold">Johnson Controls Australia</div>
            <div>Level 12, 100 Pacific Highway</div>
            <div>North Sydney, NSW 2060</div>
          </div>
          <div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Ship To</div>
            <div className="font-semibold">JCI Facility - Melbourne</div>
            <div>45 Innovation Drive</div>
            <div>Scoresby, VIC 3179</div>
          </div>
        </div>

        {/* Line items table */}
        <div className="px-6 py-3">
          <table className="w-full text-[9px] text-gray-700">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="text-left py-1 w-6">#</th>
                <th className="text-left py-1">Description</th>
                <th className="text-right py-1 w-10">Qty</th>
                <th className="text-right py-1 w-16">Rate</th>
                <th className="text-right py-1 w-16">Amount</th>
              </tr>
            </thead>
            <tbody>
              {[
                { desc: 'HVAC Installation - Unit A', qty: 2, rate: 45000 },
                { desc: 'Ductwork & Fittings', qty: 1, rate: 28500 },
                { desc: 'Control Panel Assembly', qty: 3, rate: 12750 },
                { desc: 'Labour Charges - Electrical', qty: 1, rate: 18000 },
                { desc: 'Commissioning & Testing', qty: 1, rate: 8500 },
              ].map((row, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1">{i + 1}</td>
                  <td className="py-1">{row.desc}</td>
                  <td className="py-1 text-right">{row.qty}</td>
                  <td className="py-1 text-right">{row.rate.toLocaleString('en-AU')}</td>
                  <td className="py-1 text-right">{(row.qty * row.rate).toLocaleString('en-AU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-6 py-3 border-t border-gray-300">
          <div className="flex flex-col items-end text-[10px] text-gray-700 gap-0.5">
            <div className="flex justify-between w-44">
              <span>Subtotal:</span>
              <span>{totalAmount || '170,500'}</span>
            </div>
            <div className="flex justify-between w-44">
              <span>GST (10%):</span>
              <span>17,050</span>
            </div>
            <div className="flex justify-between w-44 font-bold border-t border-gray-400 pt-1 mt-1 text-xs text-gray-900">
              <span>Total:</span>
              <span>187,550</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex items-end justify-between">
          <div className="text-[8px] text-gray-400 leading-snug">
            <div>Bank: Commonwealth Bank, Branch North Sydney</div>
            <div>BSB: 062-000 | A/C: 1234 5678</div>
            <div className="mt-1">E&OE - Subject to Australian law</div>
          </div>
          <div className="text-center">
            <div className="w-20 h-10 border border-dashed border-gray-300 rounded flex items-center justify-center text-[8px] text-gray-400">
              Stamp & Sign
            </div>
            <div className="text-[8px] text-gray-400 mt-0.5">Authorised Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mock Job Sheet SVG Document Component
// ---------------------------------------------------------------------------
function MockJobSheetDocument({ vendorName }: { vendorName: string }) {
  return (
    <div className="w-full max-w-[520px] mx-auto bg-white rounded shadow-md border border-gray-200 p-0 overflow-hidden select-none" style={{ fontFamily: 'monospace' }}>
      <div className="relative bg-[#fafaf7]" style={{ transform: 'rotate(0.2deg)' }}>
        {/* Header */}
        <div className="px-6 pt-6 pb-3 border-b border-gray-300 flex items-start justify-between">
          <div>
            <div className="text-sm font-bold text-gray-800">JOB COMPLETION SHEET</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Service Verification Report</div>
          </div>
          <div className="text-right text-[10px] text-gray-600">
            <div>Job ID: <span className="font-semibold">JOB-2025-0847</span></div>
            <div>Date: <span className="font-semibold">2025-01-14</span></div>
          </div>
        </div>

        {/* Job details */}
        <div className="px-6 py-3 space-y-2 text-[10px] text-gray-700 border-b border-gray-200">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span className="text-gray-500">Contractor:</span> <span className="font-semibold">{vendorName || 'Vendor'}</span></div>
            <div><span className="text-gray-500">Site:</span> <span className="font-semibold">JCI Facility - Melbourne</span></div>
            <div><span className="text-gray-500">Work Order:</span> <span className="font-semibold">WO-2025-1234</span></div>
            <div><span className="text-gray-500">Category:</span> <span className="font-semibold">HVAC Installation</span></div>
          </div>
        </div>

        {/* Task checklist */}
        <div className="px-6 py-3 border-b border-gray-200">
          <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Tasks Completed</div>
          <div className="space-y-1.5 text-[10px] text-gray-700">
            {[
              { task: 'Unit installation & mounting', status: 'Done' },
              { task: 'Ductwork connection & sealing', status: 'Done' },
              { task: 'Electrical wiring & controls', status: 'Done' },
              { task: 'Refrigerant charging', status: 'Done' },
              { task: 'System commissioning', status: 'Done' },
              { task: 'Performance testing (24hr)', status: 'Done' },
              { task: 'Site cleanup', status: 'Done' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 border border-gray-400 rounded-sm flex items-center justify-center text-[7px] text-green-600 font-bold bg-green-50">
                  &#10003;
                </div>
                <span>{item.task}</span>
                <span className="ml-auto text-green-600 font-semibold text-[9px]">{item.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Verification */}
        <div className="px-6 py-3 border-b border-gray-200 text-[10px] text-gray-700">
          <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Verification Notes</div>
          <div className="bg-gray-50 border border-gray-200 rounded p-2 text-[9px] leading-snug">
            All installation work completed as per scope. System running within specified parameters.
            Air flow and temperature readings within tolerance. No pending snag items.
            Warranty period starts from commissioning date.
          </div>
        </div>

        {/* Signatures */}
        <div className="px-6 py-4 grid grid-cols-3 gap-4 text-center">
          {['Contractor Rep.', 'Site Engineer', 'Project Manager'].map((role) => (
            <div key={role}>
              <div className="w-full h-8 border-b border-gray-400 mb-1 flex items-end justify-center">
                <span className="text-[8px] text-gray-300 italic">signed</span>
              </div>
              <div className="text-[8px] text-gray-500">{role}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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

  // Determine which document types are available based on category
  const availableDocTypes = useMemo(() => {
    if (!selectedCase) return ['INVOICE'] as const;
    if (selectedCase.category === 'INSTALLATION' || selectedCase.category === 'WARRANTY') {
      return ['INVOICE', 'JOB_SHEET'] as const;
    }
    return ['INVOICE'] as const;
  }, [selectedCase]);

  useEffect(() => {
    initDraft();
    // Load approvers from mock users, auto-select those within limit
    import('@/mock/users').then(({ mockUsers }) => {
      const totalAmount = selectedCase?.headerData.totalAmount ?? 0;
      const reviewers = mockUsers
        .filter(u => u.role === 'AP_REVIEWER' && u.isActive)
        .map((u, idx) => ({
          id: u.id,
          name: u.fullName,
          department: u.department || '',
          limit: u.approvalLimit || 0,
          // Auto-select approvers whose limit covers the invoice amount
          selected: (u.approvalLimit || 0) >= totalAmount,
          order: idx,
        }))
        // Sort by limit descending so the highest-authority approver is first
        .sort((a, b) => b.limit - a.limit);

      // Auto-select at least one approver - pick the one with the lowest limit that still covers the amount
      const anySelected = reviewers.some(a => a.selected);
      if (!anySelected && reviewers.length > 0) {
        reviewers[0].selected = true;
      }

      // Re-assign order for selected ones
      let order = 0;
      for (const a of reviewers) {
        if (a.selected) {
          a.order = order++;
        }
      }

      setApprovers(reviewers);
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
            <ScrollArea className="flex-1 bg-accent/10">
              <div
                className="p-4 cursor-pointer group/doc"
                onClick={() => setDocPreviewOpen(true)}
                title="Click to expand document"
              >
                <div className="relative">
                  {activeDocumentType === 'INVOICE' ? (
                    <MockInvoiceDocument
                      vendorName={selectedCase.vendorName}
                      invoiceNumber={headerData.invoiceNumber}
                      invoiceDate={headerData.invoiceDate}
                      totalAmount={formatCurrency(headerData.totalAmount, headerData.currency)}
                    />
                  ) : (
                    <MockJobSheetDocument
                      vendorName={selectedCase.vendorName}
                    />
                  )}
                  {/* Expand overlay on hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover/doc:bg-black/5 dark:group-hover/doc:bg-white/5 transition-colors rounded flex items-center justify-center">
                    <div className="opacity-0 group-hover/doc:opacity-100 transition-opacity bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg border flex items-center gap-1.5">
                      <ZoomIn className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Click to expand</span>
                    </div>
                  </div>
                </div>
                {/* Document file info */}
                <div className="mt-3 text-center">
                  <p className="text-[10px] text-muted-foreground">
                    {activeDocumentType === 'INVOICE'
                      ? selectedCase.attachments.find(a => a.documentType === 'INVOICE')?.fileName
                        || selectedCase.attachments[0]?.fileName
                        || 'invoice.pdf'
                      : selectedCase.attachments.find(a => a.documentType === 'JOB_SHEET')?.fileName
                        || 'job-sheet.pdf'
                    }
                  </p>
                </div>
              </div>
            </ScrollArea>
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

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent. The invoice will be rejected and cannot be reopened.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for rejection (min 10 characters)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          <ScrollArea className="flex-1 bg-accent/10">
            <div className="flex items-start justify-center p-8">
              <div className="transform scale-125 origin-top">
                {activeDocumentType === 'INVOICE' ? (
                  <MockInvoiceDocument
                    vendorName={selectedCase.vendorName}
                    invoiceNumber={headerData.invoiceNumber}
                    invoiceDate={headerData.invoiceDate}
                    totalAmount={formatCurrency(headerData.totalAmount, headerData.currency)}
                  />
                ) : (
                  <MockJobSheetDocument
                    vendorName={selectedCase.vendorName}
                  />
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
