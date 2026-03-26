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
} from 'lucide-react';
import { formatRelativeTime, formatDateTime, formatFileSize, formatConfidence } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { EmailRecord } from '@/mock/handlers';

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
// Category badge component
// ---------------------------------------------------------------------------
function CategoryBadge({ category }: { category: 'UTILITY' | 'INSTALLATION' | 'WARRANTY' }) {
  const styles: Record<string, string> = {
    UTILITY: 'bg-red-50 text-red-700 border-red-200',
    INSTALLATION: 'bg-purple-50 text-purple-700 border-purple-200',
    WARRANTY: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  return (
    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', styles[category])}>
      {category}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Mock Invoice Document (reused pattern from DataValidationTab)
// ---------------------------------------------------------------------------
function MockInvoiceDocument({ fromName, subject }: { fromName: string; subject: string }) {
  const invoiceMatch = subject.match(/INV-\d+/);
  const invoiceNumber = invoiceMatch ? invoiceMatch[0] : 'INV-UNKNOWN';
  return (
    <div
      className="w-full max-w-[520px] mx-auto bg-white rounded shadow-md border border-gray-200 p-0 overflow-hidden select-none"
      style={{ fontFamily: 'monospace' }}
    >
      <div className="relative bg-[#fafaf7]" style={{ transform: 'rotate(-0.3deg)' }}>
        {/* Header area */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-300">
          <div className="flex items-start justify-between">
            <div>
              <div className="w-28 h-8 bg-gray-300 rounded mb-2 flex items-center justify-center">
                <span className="text-[9px] text-gray-600 font-bold tracking-wider">LOGO</span>
              </div>
              <div className="text-[10px] text-gray-700 leading-tight">
                <div className="font-bold text-xs">{fromName.replace(' Accounts', '')}</div>
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
            <span className="font-semibold">{invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date:</span>
            <span className="font-semibold">2025-01-15</span>
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
              <span>167,250</span>
            </div>
            <div className="flex justify-between w-44">
              <span>GST (10%):</span>
              <span>16,725</span>
            </div>
            <div className="flex justify-between w-44 font-bold border-t border-gray-400 pt-1 mt-1 text-xs text-gray-900">
              <span>Total:</span>
              <span>183,975</span>
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
            </div>
          </div>
        )}

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
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  email.classificationConfidence >= 0.85
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : email.classificationConfidence >= 0.6
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                )}
              >
                {formatConfidence(email.classificationConfidence)}%
              </Badge>
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
          <ScrollArea className="flex-1 bg-accent/10">
            <div className="flex items-start justify-center p-8">
              <div className="transform scale-125 origin-top">
                <MockInvoiceDocument fromName={email.fromName} subject={email.subject} />
              </div>
            </div>
          </ScrollArea>
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

  useEffect(() => {
    import('@/mock/handlers').then(({ fetchEmails }) => {
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
          e.fromName.toLowerCase().includes(q)
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

    return result;
  }, [emails, searchQuery, classificationFilter, readFilter, categoryFilter, attachmentFilter]);

  const selectedEmail = useMemo(
    () => emails.find((e) => e.id === selectedEmailId) ?? null,
    [emails, selectedEmailId]
  );

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
            <SelectItem value="UTILITY">Utility</SelectItem>
            <SelectItem value="INSTALLATION">Installation</SelectItem>
            <SelectItem value="WARRANTY">Warranty</SelectItem>
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
      </div>

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
            'overflow-hidden h-full',
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
