import { useEffect, useState } from 'react';
import { useCaseStore } from '@/stores/caseStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Mail, Paperclip, Building2, FileText, AlertTriangle, MapPin, CreditCard, Phone, Calendar, Hash, ShieldCheck, FileCheck, Send, AtSign, MessageSquare, Clock, Eye, Download, CheckCircle, XCircle } from 'lucide-react';
import { MockInvoiceDocument } from '@/components/shared/MockInvoiceDocument';
import { ReturnReasonBanner } from '@/components/shared/ReturnReasonBanner';
import { formatDateTime, formatFileSize, formatCurrency } from '@/lib/formatters';
import type { Vendor, VendorContract } from '@/types/masterData';

export function CaseDetailsTab() {
  const selectedCase = useCaseStore((s) => s.selectedCase);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [matchedContract, setMatchedContract] = useState<VendorContract | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCase) return;
    // Load vendor details from mock data
    import('@/mock/vendors').then(({ mockVendors }) => {
      const v = mockVendors.find((mv) => mv.id === selectedCase.vendorId);
      if (v) {
        setVendor(v);
        const contract = v.contracts.find(
          (c) => c.contractNumber === selectedCase.contractNumber
        ) ?? v.contracts.find((c) => c.category === selectedCase.category) ?? null;
        setMatchedContract(contract);
      }
    });
  }, [selectedCase]);

  if (!selectedCase) return null;

  const { email, attachments, vendorName, vendorNumber, contractNumber, contractStatus } = selectedCase;
  const viewedAtt = attachments.find(a => a.id === viewingAttachment);

  return (
    <div className="space-y-6">
      {/* Return Reason Banner */}
      {selectedCase.status === 'RETURNED' && selectedCase.returnReason && (
        <ReturnReasonBanner
          returnedBy={selectedCase.returnedByName || 'Approver'}
          returnedAt={selectedCase.returnedAt ?? undefined}
          returnReason={selectedCase.returnReason}
        />
      )}

      {/* Vendor Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5" />
            Vendor Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Left: Vendor Info */}
            <div className="space-y-4 pb-6 md:pb-0 border-b md:border-b-0 md:border-r border-border md:pr-8">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendor Validation</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{vendorName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{vendorNumber}</p>
                </div>
                <Badge variant="outline" className={vendor?.isActive
                  ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400'
                }>
                  {vendor?.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {vendor && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm">{vendor.address}</p>
                        <p className="text-xs text-muted-foreground">{vendor.city}, {vendor.country}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">ABN</p>
                        <p className="text-sm font-mono">{vendor.taxId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Bank Account</p>
                        <p className="text-sm font-mono">{vendor.bankAccount}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Payment Terms</p>
                        <p className="text-sm">{vendor.paymentTerms}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right: Vendor Match */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Vendor Match</p>
              </div>

              {/* Vendor field match indicators */}
              {vendor && (
                <div className="space-y-1.5 mb-3">
                  {[
                    { label: 'Name', value: vendor.name, matched: vendorName === vendor.name },
                    { label: 'Address', value: `${vendor.address}, ${vendor.city}`, matched: !!vendor.address },
                    { label: 'ABN', value: vendor.taxId, matched: !!vendor.taxId },
                  ].map(({ label, value, matched }) => (
                    <div key={label} className="flex items-center gap-2 text-sm">
                      {matched
                        ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                        : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                      <span className="text-muted-foreground">{label}:</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              )}

              {contractNumber && matchedContract ? (
                <div className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold font-mono">{contractNumber}</p>
                    <Badge variant="outline" className={
                      contractStatus === 'ACTIVE'
                        ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400'
                    }>
                      {contractStatus}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Category</p>
                      <p className="text-sm">{matchedContract.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Max Amount</p>
                      <p className="text-sm font-medium">{formatCurrency(matchedContract.maxAmount, 'AUD')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Start Date
                      </p>
                      <p className="text-sm">{matchedContract.startDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> End Date
                      </p>
                      <p className="text-sm">{matchedContract.endDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Vendor and contract verified against master data
                  </div>
                </div>
              ) : contractNumber ? (
                <div className="border rounded-lg p-3">
                  <p className="text-sm font-mono">{contractNumber}</p>
                  <Badge variant="outline" className={
                    contractStatus === 'ACTIVE'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }>
                    {contractStatus || 'Unknown'}
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700 dark:text-amber-400">No contract matched for this vendor</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5" />
            Email Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Send className="h-3 w-3" />From</p>
              <p className="text-sm font-medium">{email.from}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><AtSign className="h-3 w-3" />To</p>
              <p className="text-sm font-medium">{email.to}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MessageSquare className="h-3 w-3" />Subject</p>
              <p className="text-sm font-medium">{email.subject}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="h-3 w-3" />Received</p>
              <p className="text-sm font-medium">{formatDateTime(email.receivedAt)}</p>
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-xs text-muted-foreground mb-1">Email Body</p>
            <p className="text-sm text-foreground whitespace-pre-wrap bg-accent/30 p-3 rounded-lg">
              {email.body}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-5 w-5" />
            Attachments ({attachments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between p-3 bg-accent/30 rounded-lg transition-colors hover:bg-accent/50 cursor-pointer group"
                onClick={() => setViewingAttachment(att.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <FileText className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                    <Eye className="h-3 w-3 text-primary absolute -bottom-0.5 -right-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{att.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {att.fileType} &middot; {formatFileSize(att.fileSize)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={att.isMainInvoice ? 'default' : 'secondary'}>
                    {att.documentType.replace('_', ' ')}
                  </Badge>
                  {att.isMainInvoice && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                      Main Invoice
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SAP Download Button (Item 35) */}
      {(selectedCase.status === 'APPROVED' || selectedCase.status === 'POSTED') && (() => {
        const glCodes = [...new Set(selectedCase.lineItems.map(li => li.glAccount).filter(Boolean))];
        const generateCsv = (items: typeof selectedCase.lineItems) => {
          const header = 'LineNumber,Description,Quantity,UnitPrice,Amount,GLAccount,CostCenter\n';
          const rows = items.map(li => `${li.lineNumber},"${li.description}",${li.quantity},${li.unitPrice},${li.totalAmount},${li.glAccount},${li.costCenter}`).join('\n');
          return header + rows;
        };
        const downloadCsv = (csv: string, filename: string) => {
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
          URL.revokeObjectURL(url);
        };
        return glCodes.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download SAP File
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => downloadCsv(generateCsv(selectedCase.lineItems), `${selectedCase.id}_SAP_ALL.csv`)}>
                Download All
              </DropdownMenuItem>
              {glCodes.map(gl => (
                <DropdownMenuItem key={gl} onClick={() => downloadCsv(generateCsv(selectedCase.lineItems.filter(li => li.glAccount === gl)), `${selectedCase.id}_SAP_${gl}.csv`)}>
                  Download GL {gl}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" className="gap-2" onClick={() => downloadCsv(generateCsv(selectedCase.lineItems), `${selectedCase.id}_SAP.csv`)}>
            <Download className="h-4 w-4" />
            Download SAP File
          </Button>
        );
      })()}

      {/* Missing Document Warning - only shows if genuinely missing (edge case) */}
      {(selectedCase.category === 'INSTALLATION' || selectedCase.category === 'WARRANTY') &&
        !attachments.some(a => a.documentType === 'JOB_SHEET') && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                Missing: Job Sheet
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">
                This {selectedCase.category.toLowerCase()} case requires a job sheet. The case must be rejected — no hold/wait state is available. The vendor must resubmit with the required document.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Preview Dialog */}
      <Dialog open={viewingAttachment !== null} onOpenChange={(open) => { if (!open) setViewingAttachment(null); }}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              {viewedAtt?.fileName || 'Document Preview'}
            </DialogTitle>
            {viewedAtt && (
              <p className="text-xs text-muted-foreground mt-1">
                {viewedAtt.documentType.replace('_', ' ')} &middot; {viewedAtt.fileType} &middot; {formatFileSize(viewedAtt.fileSize)} &middot; {selectedCase.vendorName}
              </p>
            )}
          </DialogHeader>
          <ScrollArea className="flex-1 bg-accent/10">
            <div className="flex items-start justify-center p-8">
              <div className="transform scale-125 origin-top">
                {viewedAtt?.documentType === 'JOB_SHEET' ? (
                  <div className="w-full max-w-[520px] bg-white rounded shadow-md border border-gray-200 overflow-hidden" style={{ fontFamily: 'monospace' }}>
                    <div className="bg-[#fafaf7]" style={{ transform: 'rotate(0.2deg)' }}>
                      <div className="px-6 pt-6 pb-3 border-b border-gray-300 flex items-start justify-between">
                        <div>
                          <div className="text-sm font-bold text-gray-800">JOB COMPLETION SHEET</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">Service Verification Report</div>
                        </div>
                        <div className="text-right text-[10px] text-gray-600">
                          <div>Ref: <span className="font-semibold">{viewedAtt?.fileName}</span></div>
                          <div>Date: <span className="font-semibold">2025-01-14</span></div>
                        </div>
                      </div>
                      <div className="px-6 py-3 space-y-2 text-[10px] text-gray-700 border-b border-gray-200">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                          <div><span className="text-gray-500">Contractor:</span> <span className="font-semibold">{selectedCase.vendorName}</span></div>
                          <div><span className="text-gray-500">Category:</span> <span className="font-semibold">{selectedCase.category}</span></div>
                          <div><span className="text-gray-500">Work Order:</span> <span className="font-semibold">WO-2025-1234</span></div>
                          <div><span className="text-gray-500">Site:</span> <span className="font-semibold">JCI Facility - Melbourne</span></div>
                        </div>
                      </div>
                      <div className="px-6 py-3 border-b border-gray-200">
                        <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Tasks Completed</div>
                        <div className="space-y-1.5 text-[10px]">
                          {[
                            'Site preparation & safety check',
                            'Unit installation & mounting',
                            'Ductwork connection & sealing',
                            'Electrical wiring & controls',
                            'System commissioning',
                            'Performance testing (24hr)',
                            'Final inspection & sign-off',
                          ].map((task, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-3 h-3 border border-gray-400 rounded-sm flex items-center justify-center text-[7px] text-green-600 font-bold bg-green-50">&#10003;</div>
                              <span>{task}</span>
                              <span className="ml-auto text-green-600 font-semibold text-[9px]">Done</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="px-6 py-3 border-b border-gray-200 text-[10px] text-gray-700">
                        <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Verification Notes</div>
                        <div className="bg-gray-50 border border-gray-200 rounded p-2 text-[9px] leading-snug">
                          All installation work completed as per scope. System running within specified parameters.
                          Air flow and temperature readings within tolerance. No pending snag items.
                        </div>
                      </div>
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
                ) : (
                  <MockInvoiceDocument
                    vendorName={selectedCase.vendorName}
                    invoiceNumber={selectedCase.headerData.invoiceNumber}
                    invoiceDate={selectedCase.headerData.invoiceDate}
                    documentTitle={viewedAtt?.documentType === 'SUPPORTING' ? 'DELIVERY NOTE' : 'TAX INVOICE'}
                    poNumber={selectedCase.headerData.purchaseOrderNumber || 'PO-44821'}
                    dueDate={selectedCase.headerData.dueDate || 'Net 30'}
                    lineItems={(selectedCase.lineItems.length > 0
                      ? selectedCase.lineItems.map(li => ({ desc: li.description, qty: li.quantity, rate: li.unitPrice }))
                      : undefined
                    )}
                    subtotal={formatCurrency(selectedCase.headerData.netAmount || selectedCase.headerData.totalAmount * 0.9, selectedCase.headerData.currency)}
                    gstAmount={formatCurrency(selectedCase.headerData.taxAmount, selectedCase.headerData.currency)}
                    totalAmount={formatCurrency(selectedCase.headerData.totalAmount, selectedCase.headerData.currency)}
                  />
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
