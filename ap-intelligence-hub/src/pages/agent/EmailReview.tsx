import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
// MockInvoiceDocument removed — replaced with real PDF viewer
import { StatCard } from '@/components/shared/StatCard';
import {
  Inbox,
  Search,
  Paperclip,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  ExternalLink,
  Mail,
  MailOpen,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Eye,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Download,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime, formatDateTime, formatFileSize } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { EmailRecord } from '@/types/email';

// ---------------------------------------------------------------------------
// File type icon helper
// ---------------------------------------------------------------------------
function getFileIcon(fileType: string) {
  switch (fileType.toUpperCase()) {
    case 'PDF':
      return <FileText className="h-4 w-4 text-red-500" />;
    case 'JPG':
    case 'PNG':
    case 'TIFF':
      return <FileImage className="h-4 w-4 text-indigo-500" />;
    case 'XLSX':
    case 'XLS':
      return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

// ---------------------------------------------------------------------------
// Classification badge component
// ---------------------------------------------------------------------------
function ClassificationBadge({ classification }: { classification: EmailRecord['classification'] }) {
  switch (classification) {
    case 'INVOICE':
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
          <ShieldCheck className="h-3 w-3 mr-1" />
          Invoice
        </Badge>
      );
    case 'NON_INVOICE':
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">
          <ShieldAlert className="h-3 w-3 mr-1" />
          Non-Invoice
        </Badge>
      );
    case 'UNCLASSIFIED':
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
          <ShieldQuestion className="h-3 w-3 mr-1" />
          Unclassified
        </Badge>
      );
  }
}


// ---------------------------------------------------------------------------
// Email List Item
// ---------------------------------------------------------------------------
function EmailListItem({
  email,
  isSelected,
  onClick,
}: {
  email: EmailRecord;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 p-3 cursor-pointer border-b border-border transition-colors',
        isSelected
          ? 'bg-primary/5 border-l-2 border-l-primary'
          : 'hover:bg-accent/50 border-l-2 border-l-transparent',
        !email.isRead && 'bg-red-50/50'
      )}
      onClick={onClick}
    >
      {/* Row 1: Sender + time */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {email.isRead ? (
            <MailOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
          )}
          <span
            className={cn(
              'text-sm truncate',
              !email.isRead ? 'font-semibold text-foreground' : 'font-medium text-foreground'
            )}
          >
            {email.fromName}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(email.receivedAt)}
        </span>
      </div>

      {/* Row 2: Subject */}
      <p
        className={cn(
          'text-sm truncate pl-5',
          !email.isRead ? 'font-medium text-foreground' : 'text-muted-foreground'
        )}
      >
        {email.subject}
      </p>

      {/* Row 3: Badges */}
      <div className="flex items-center gap-1.5 pl-5 flex-wrap">
        <ClassificationBadge classification={email.classification} />
        <Badge variant={email.poType === 'PO' ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0">
          {email.poType === 'PO' ? 'PO' : 'Non-PO'}
        </Badge>
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', email.entity === 'AU' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200')}>
          {email.entity}
        </Badge>
        {email.invoiceCategory && <CategoryBadge category={email.invoiceCategory} />}
        {email.attachmentCount > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
            <Paperclip className="h-2.5 w-2.5" />
            {email.attachmentCount}
          </Badge>
        )}
        {email.linkedCaseId && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-700 border-red-200">
            {email.linkedCaseId}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email Detail Panel
// ---------------------------------------------------------------------------
function EmailDetail({
  email,
  onBack,
}: {
  email: EmailRecord;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const [viewingAttachmentIdx, setViewingAttachmentIdx] = useState<number | null>(null);
  const [xeroDownloading, setXeroDownloading] = useState(false);
  const [xeroDownloaded, setXeroDownloaded] = useState(false);
  const viewedAtt = viewingAttachmentIdx !== null ? email.attachments[viewingAttachmentIdx] : null;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Mobile back button */}
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden -ml-2 mb-2 gap-1"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Button>

        {/* Email header */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground leading-snug">{email.subject}</h2>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{email.fromName}</span>
                <span className="text-xs text-muted-foreground">&lt;{email.from}&gt;</span>
              </div>
              <div className="text-xs text-muted-foreground">
                To: {email.to}
              </div>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDateTime(email.receivedAt)}
            </span>
          </div>
        </div>

        <Separator />

        {/* Classification Details */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Classification Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Classification</p>
              <ClassificationBadge classification={email.classification} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <ConfidenceBadge
                score={email.classificationConfidence}
                level={email.classificationConfidence >= 0.85 ? 'HIGH' : email.classificationConfidence >= 0.6 ? 'MEDIUM' : 'LOW'}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Entity</p>
              <Badge variant="outline" className={cn('text-xs', email.entity === 'AU' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200')}>
                {email.entity}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">PO Type</p>
              <Badge variant={email.poType === 'PO' ? 'default' : 'outline'} className="text-xs">
                {email.poType === 'PO' ? 'PO' : 'Non-PO'}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Mandatory Attachment</p>
              <div className="flex items-center gap-1 text-sm">
                {email.attachments.length > 0 ? (
                  <><CheckCircle className="h-4 w-4 text-emerald-600" /> <span className="text-emerald-700">Present</span></>
                ) : (
                  <><XCircle className="h-4 w-4 text-red-500" /> <span className="text-red-600">Missing</span></>
                )}
              </div>
            </div>
            {email.invoiceCategory && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Invoice Category</p>
                <CategoryBadge category={email.invoiceCategory} />
              </div>
            )}
            {email.linkedCaseId && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Linked Case</p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-sm gap-1"
                  onClick={() => navigate(`/agent/cases/${email.linkedCaseId}/overview`)}
                >
                  {email.linkedCaseId}
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Email body */}
        <div className="rounded-lg border bg-card p-4">
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {email.body}
          </pre>
        </div>

        {/* Attachments */}
        {email.attachments.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Attachments ({email.attachments.length})
            </h3>
            <div className="space-y-2">
              {email.attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors cursor-pointer group"
                  onClick={() => setViewingAttachmentIdx(idx)}
                >
                  <div className="relative">
                    {getFileIcon(att.fileType)}
                    <Eye className="h-2.5 w-2.5 text-primary absolute -bottom-0.5 -right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{att.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {att.fileType} &middot; {formatFileSize(att.fileSize)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to preview
                  </span>
                </div>
              ))}
              {xeroDownloaded && (
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                  {getFileIcon('PDF')}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">xero-invoice.pdf</p>
                    <p className="text-xs text-muted-foreground">PDF &middot; Downloaded from Xero</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">Xero</Badge>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Xero Link Detection (Item 25) */}
        {email.xeroLink && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">Xero Invoice Detected</span>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-400 truncate">{email.xeroLink}</p>
            {xeroDownloaded ? (
              <div className="flex items-center gap-1 text-xs text-emerald-700"><CheckCircle className="h-3.5 w-3.5" /> Downloaded — see attachments</div>
            ) : (
              <Button size="sm" className="gap-1 text-xs" disabled={xeroDownloading} onClick={() => {
                setXeroDownloading(true);
                setTimeout(() => {
                  setXeroDownloading(false);
                  setXeroDownloaded(true);
                  toast.success('Invoice downloaded from Xero');
                }, 1000);
              }}>
                {xeroDownloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                Download from Xero
              </Button>
            )}
          </div>
        )}

      </div>

      {/* Attachment Preview Dialog */}
      <Dialog open={viewingAttachmentIdx !== null} onOpenChange={(open) => { if (!open) setViewingAttachmentIdx(null); }}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              {viewedAtt?.fileName || 'Document Preview'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {viewedAtt?.fileType} &middot; {viewedAtt ? formatFileSize(viewedAtt.fileSize) : ''} &middot; {email.fromName}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 bg-accent/10">
            {viewedAtt?.fileUrl ? (
              <iframe
                src={`/johnson-api${viewedAtt.fileUrl}`}
                className="w-full h-full border-0"
                title={viewedAtt.fileName}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No document preview available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function EmailReview() {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<string>('ALL');
  const [readFilter, setReadFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [attachmentFilter, setAttachmentFilter] = useState<string>('ALL');
  const [poTypeFilter, setPoTypeFilter] = useState<string>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<string>('NEWEST');

  useEffect(() => {
    import('@/lib/handlers').then(({ fetchEmails }) => {
      fetchEmails().then((data) => {
        setEmails(data);
        setIsLoading(false);
      });
    });
  }, []);

  // Filter emails
  const filteredEmails = useMemo(() => {
    let result = [...emails];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.subject.toLowerCase().includes(q) ||
          e.from.toLowerCase().includes(q) ||
          e.fromName.toLowerCase().includes(q) ||
          (e.linkedCaseId && e.linkedCaseId.toLowerCase().includes(q))
      );
    }

    if (classificationFilter !== 'ALL') {
      result = result.filter((e) => e.classification === classificationFilter);
    }

    if (readFilter === 'READ') {
      result = result.filter((e) => e.isRead);
    } else if (readFilter === 'UNREAD') {
      result = result.filter((e) => !e.isRead);
    }

    if (categoryFilter !== 'ALL') {
      result = result.filter((e) => e.invoiceCategory === categoryFilter);
    }

    if (attachmentFilter === 'WITH') {
      result = result.filter((e) => e.attachmentCount > 0);
    } else if (attachmentFilter === 'WITHOUT') {
      result = result.filter((e) => e.attachmentCount === 0);
    }

    if (poTypeFilter !== 'ALL') {
      result = result.filter((e) => e.poType === poTypeFilter);
    }

    if (entityFilter !== 'ALL') {
      result = result.filter((e) => e.entity === entityFilter);
    }

    if (dateFromFilter) {
      result = result.filter((e) => e.receivedAt >= dateFromFilter);
    }

    if (dateToFilter) {
      const toEnd = dateToFilter + 'T23:59:59';
      result = result.filter((e) => e.receivedAt <= toEnd);
    }

    result.sort((a, b) =>
      sortOrder === 'NEWEST'
        ? b.receivedAt.localeCompare(a.receivedAt)
        : a.receivedAt.localeCompare(b.receivedAt)
    );

    return result;
  }, [emails, searchQuery, classificationFilter, readFilter, categoryFilter, attachmentFilter, poTypeFilter, entityFilter, dateFromFilter, dateToFilter, sortOrder]);

  const selectedEmail = useMemo(
    () => emails.find((e) => e.id === selectedEmailId) ?? null,
    [emails, selectedEmailId]
  );

  const emailStats = useMemo(() => {
    const total = emails.length;
    const invoice = emails.filter((e) => e.classification === 'INVOICE').length;
    const nonInvoice = total - invoice;
    return { total, invoice, nonInvoice };
  }, [emails]);

  const unreadCount = useMemo(() => emails.filter((e) => !e.isRead).length, [emails]);

  const handleSelectEmail = (emailId: string) => {
    setSelectedEmailId(emailId);
    // Mark as read
    setEmails((prev) =>
      prev.map((e) => (e.id === emailId ? { ...e, isRead: true } : e))
    );
  };

  return (
    <div>
      <PageHeader title="Email Review" count={filteredEmails.length}>
        {unreadCount > 0 && (
          <Badge variant="default" className="gap-1">
            <Mail className="h-3 w-3" />
            {unreadCount} unread
          </Badge>
        )}
      </PageHeader>

      {/* Search and Filter bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by subject or sender..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={classificationFilter} onValueChange={setClassificationFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="INVOICE">Invoice</SelectItem>
            <SelectItem value="NON_INVOICE">Non-Invoice</SelectItem>
            <SelectItem value="UNCLASSIFIED">Unclassified</SelectItem>
          </SelectContent>
        </Select>
        <Select value={readFilter} onValueChange={setReadFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="UNREAD">Unread</SelectItem>
            <SelectItem value="READ">Read</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            <SelectItem value="SUBCONTRACTOR">Subcontractor</SelectItem>
            <SelectItem value="RUST_SUBCONTRACTOR">Rust - Subcontractor</SelectItem>
            <SelectItem value="DELIVERY_INSTALLATION">D&I</SelectItem>
            <SelectItem value="FREIGHT_FINISHED_GOODS">Freight - Finished Goods</SelectItem>
            <SelectItem value="FREIGHT_SPARE_PARTS">Freight - Spare Parts</SelectItem>
            <SelectItem value="FREIGHT_ADDITIONAL_CHARGES">Freight - Add. Charges</SelectItem>
          </SelectContent>
        </Select>
        <Select value={attachmentFilter} onValueChange={setAttachmentFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Attachments</SelectItem>
            <SelectItem value="WITH">Has Attachments</SelectItem>
            <SelectItem value="WITHOUT">No Attachments</SelectItem>
          </SelectContent>
        </Select>
        <Select value={poTypeFilter} onValueChange={setPoTypeFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All PO Types</SelectItem>
            <SelectItem value="PO">PO</SelectItem>
            <SelectItem value="NON_PO">Non-PO</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Entities</SelectItem>
            <SelectItem value="AU">AU</SelectItem>
            <SelectItem value="NZ">NZ</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFromFilter}
          onChange={(e) => setDateFromFilter(e.target.value)}
          className="w-[140px]"
          placeholder="From date"
        />
        <Input
          type="date"
          value={dateToFilter}
          onChange={(e) => setDateToFilter(e.target.value)}
          className="w-[140px]"
          placeholder="To date"
        />
        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NEWEST">Newest First</SelectItem>
            <SelectItem value="OLDEST">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stat Cards */}
      {!isLoading && emails.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard title="Total Emails" value={emailStats.total} icon={<Inbox className="h-4 w-4" />} />
          <StatCard title="Invoice Emails" value={emailStats.invoice} icon={<ShieldCheck className="h-4 w-4" />} variant="success" />
          <StatCard title="Non-Invoice Emails" value={emailStats.nonInvoice} icon={<ShieldAlert className="h-4 w-4" />} />
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-0 border rounded-lg min-h-[600px]">
          <div className="space-y-0 border-r">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 bg-accent/30 animate-pulse border-b" />
            ))}
          </div>
          <div className="p-8">
            <div className="h-6 w-2/3 bg-accent/30 rounded animate-pulse mb-4" />
            <div className="h-4 w-1/3 bg-accent/30 rounded animate-pulse mb-8" />
            <div className="h-40 bg-accent/30 rounded animate-pulse" />
          </div>
        </div>
      ) : filteredEmails.length === 0 ? (
        <EmptyState
          title="No emails found"
          description={searchQuery || classificationFilter !== 'ALL' ? 'Try adjusting your search or filters.' : 'No emails have been received yet.'}
          icon={<Inbox className="h-16 w-16" />}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] border rounded-lg min-h-[600px] max-h-[calc(100vh-260px)] overflow-hidden">
          {/* Left panel: Email list */}
          <div className={cn(
            'border-r overflow-hidden flex flex-col',
            selectedEmail && 'hidden lg:flex'
          )}>
            <ScrollArea className="flex-1">
              {filteredEmails.map((email) => (
                <EmailListItem
                  key={email.id}
                  email={email}
                  isSelected={email.id === selectedEmailId}
                  onClick={() => handleSelectEmail(email.id)}
                />
              ))}
            </ScrollArea>
          </div>

          {/* Right panel: Email detail */}
          <div className={cn(
            'overflow-y-auto h-full',
            !selectedEmail && 'hidden lg:flex'
          )}>
            {selectedEmail ? (
              <EmailDetail
                email={selectedEmail}
                onBack={() => setSelectedEmailId(null)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                <Inbox className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Select an email to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
