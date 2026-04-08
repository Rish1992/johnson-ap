import { useEffect, useState } from 'react';
import { useCaseStore } from '@/stores/caseStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, Paperclip, Building2, FileText, AlertTriangle, MapPin, CreditCard, Phone, Hash, FileCheck, Send, AtSign, MessageSquare, Clock, Eye, Download, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ReturnReasonBanner } from '@/components/shared/ReturnReasonBanner';
import { PdfViewer } from '@/components/shared/PdfViewer';
import { formatDateTime, formatFileSize } from '@/lib/formatters';
import type { Vendor } from '@/types/masterData';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/johnson-api';

function SapExportButton({ caseId, isPosted }: { caseId: string; isPosted: boolean }) {
  const [loading, setLoading] = useState(false);
  const fetchCaseById = useCaseStore((s) => s.fetchCaseById);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { exportSap } = await import('@/lib/handlers');
      const { downloadUrl, sapDocumentNumber, sapData } = await exportSap(caseId);
      // Download the JSON file
      const blob = new Blob([JSON.stringify(sapData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sap_export_${sapDocumentNumber}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`SAP data exported. Document #: ${sapDocumentNumber}`);
      // Refresh case to update status badge to POSTED
      await fetchCaseById(caseId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'SAP export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" className="gap-2" onClick={handleExport} disabled={loading || isPosted}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {isPosted ? 'Already Posted to SAP' : 'Export to SAP'}
    </Button>
  );
}

export function CaseDetailsTab() {
  const selectedCase = useCaseStore((s) => s.selectedCase);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCase) return;
    // Load vendor details from real API
    import('@/lib/handlers').then(({ fetchVendors }) => {
      fetchVendors().then((vendors: Vendor[]) => {
        const v = vendors.find((mv) => mv.id === selectedCase.vendorId)
          || vendors.find((mv) => mv.vendorNumber === selectedCase.vendorNumber)
          || vendors.find((mv) => mv.name === selectedCase.vendorName);
        if (v) {
          setVendor(v);
        }
      });
    });
  }, [selectedCase]);

  if (!selectedCase) return null;

  const { email, attachments = [], vendorName, vendorNumber } = selectedCase;
  const viewedAtt = attachments.find((a: Record<string, unknown>) => (a.id || a.fileName) === viewingAttachment);

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
            {attachments.map((att, idx) => (
              <div
                key={att.id || att.fileName || idx}
                className="flex items-center justify-between p-3 bg-accent/30 rounded-lg transition-colors hover:bg-accent/50 cursor-pointer group"
                onClick={() => setViewingAttachment(att.id || att.fileName)}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <FileText className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                    <Eye className="h-3 w-3 text-primary absolute -bottom-0.5 -right-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{att.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {att.fileType || 'PDF'} &middot; {formatFileSize(att.fileSize || 0)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={att.isMainInvoice ? 'default' : 'secondary'}>
                    {(att.documentType || 'DOCUMENT').replace('_', ' ')}
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

      {/* SAP Export Button */}
      {(selectedCase.status === 'APPROVED' || selectedCase.status === 'POSTED') && (
        <SapExportButton caseId={selectedCase.id} isPosted={selectedCase.status === 'POSTED'} />
      )}

      {/* Missing Document Warning - only shows if genuinely missing (edge case) */}
      {(selectedCase.category === 'SUBCONTRACTOR' || selectedCase.category === 'RUST_SUBCONTRACTOR' || selectedCase.category === 'DELIVERY_INSTALLATION') &&
        !attachments.some((a: Record<string, unknown>) => a.documentType === 'JOB_SHEET') && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                Missing: Job Sheet / Worksheet
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">
                This case requires a job sheet or worksheet. The case must be rejected — no hold/wait state is available. The vendor must resubmit with the required document.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Preview Dialog */}
      <Dialog open={viewingAttachment !== null} onOpenChange={(open) => { if (!open) setViewingAttachment(null); }}>
        <DialogContent className="max-w-[85vw] h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              {viewedAtt?.fileName || 'Document Preview'}
            </DialogTitle>
            {viewedAtt && (
              <p className="text-xs text-muted-foreground mt-1">
                {(viewedAtt.documentType || 'OTHER').replace('_', ' ')} &middot; {viewedAtt.fileType} &middot; {formatFileSize(viewedAtt.fileSize)} &middot; {selectedCase.vendorName}
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {viewedAtt?.fileUrl ? (
              <PdfViewer
                url={`${API_BASE}${viewedAtt.fileUrl}`}
                className="h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No document available for preview
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
