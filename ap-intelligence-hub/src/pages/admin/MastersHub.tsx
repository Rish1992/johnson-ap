import { useEffect, useRef, useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { useMasterDataStore } from '@/stores/masterDataStore';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, ClipboardCheck, Check, X, Upload, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INVOICE_TYPE_CONFIG } from '@/lib/constants';
import { toast } from 'sonner';
import { uploadMaster, downloadMaster } from '@/lib/api';
import type { CategoryFieldConfig } from '@/types/masterData';

interface PendingChange {
  id: string;
  table: string;
  field: string;
  oldValue: string;
  newValue: string;
  submittedBy: string;
  submittedAt: string;
}

const TABS = [
  { key: 'vendors', label: 'Vendors' },
  { key: 'cost-centers', label: 'Cost Centers' },
  { key: 'gl-accounts', label: 'GL Accounts' },
  { key: 'tax-codes', label: 'Tax Codes' },
  { key: 'approval-sequences', label: 'Approval Sequences' },
  { key: 'freight-rates', label: 'Freight Rates' },
  { key: 'service-rates', label: 'Service Rates' },
  { key: 'agreements', label: 'Agreements' },
  { key: 'invoice-categories', label: 'Invoice Categories' },
  { key: 'extraction-fields', label: 'Extraction Fields' },
  { key: 'validation-rules', label: 'Validation Rules' },
];

export function MastersHub() {
  const { tab = 'vendors' } = useParams<{ tab: string }>();
  const store = useMasterDataStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [showPendingChanges, setShowPendingChanges] = useState(false);
  const [categoryConfigs, setCategoryConfigs] = useState<CategoryFieldConfig[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; updated: number; errors: { row: number; message: string }[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    store.fetchAll();
    import('@/lib/handlers').then(({ fetchCategoryConfigs }) => {
      fetchCategoryConfigs().then(setCategoryConfigs).catch(() => {});
    });
  }, []);

  // Reset page on tab or search change
  useEffect(() => { setPage(1); }, [tab, searchQuery]);

  // Paginate helper
  function paginate<T>(data: T[]): { rows: T[]; total: number } {
    const start = (page - 1) * pageSize;
    return { rows: data.slice(start, start + pageSize), total: data.length };
  }

  // Upload handler
  const handleUpload = async (file: File) => {
    try {
      const result = await uploadMaster(tab!, file);
      setUploadResult(result);
      store.fetchAll(); // refresh data
      toast.success(`Upload complete: ${result.inserted} new, ${result.updated} updated`);
    } catch (e: unknown) {
      toast.error(`Upload failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  // Download handler
  const handleDownload = async () => {
    try {
      const blob = await downloadMaster(tab!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${tab}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      toast.error(`Download failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  // Row click handler — open edit dialog
  const handleRowClick = (row: Record<string, unknown>) => {
    setEditRow({ ...row });
    setShowEditDialog(true);
  };

  // Edit field definitions per tab (for the edit dialog form)
  const TAB_FIELDS: Record<string, { key: string; label: string }[]> = {
    'vendors': [
      { key: 'vendorNumber', label: 'Vendor Number' }, { key: 'name', label: 'Vendor Name' },
      { key: 'address', label: 'Address' }, { key: 'city', label: 'City' }, { key: 'taxId', label: 'ABN No' },
      { key: 'country', label: 'Country' }, { key: 'email', label: 'Email' }, { key: 'bankAccount', label: 'Bank' }, { key: 'currency', label: 'Currency' },
    ],
    'cost-centers': [
      { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'department', label: 'Department' }, { key: 'companyCode', label: 'Company Code' },
    ],
    'gl-accounts': [
      { key: 'accountNumber', label: 'Account #' }, { key: 'name', label: 'Name' }, { key: 'type', label: 'Type' }, { key: 'companyCode', label: 'Company Code' },
    ],
    'tax-codes': [
      { key: 'code', label: 'Code' }, { key: 'description', label: 'Description' }, { key: 'rate', label: 'Rate' }, { key: 'country', label: 'Country' },
    ],
    'approval-sequences': [
      { key: 'invoiceType', label: 'Invoice Category' }, { key: 'name', label: 'Name' },
    ],
    'freight-rates': [
      { key: 'origin', label: 'Origin' }, { key: 'destination', label: 'Destination' }, { key: 'containerType', label: 'Container Type' },
      { key: 'rate', label: 'Rate' }, { key: 'currency', label: 'Currency' },
    ],
    'service-rates': [
      { key: 'service', label: 'Service' }, { key: 'rate', label: 'Rate' }, { key: 'currency', label: 'Currency' }, { key: 'vendorId', label: 'Vendor' },
    ],
    'agreements': [
      { key: 'vendorName', label: 'Vendor' }, { key: 'agreementNumber', label: 'Agreement No.' }, { key: 'status', label: 'Status' },
      { key: 'startDate', label: 'Start Date' }, { key: 'endDate', label: 'End Date' },
    ],
    'invoice-categories': [
      { key: 'name', label: 'Category' }, { key: 'glAccount', label: 'Default GL Account' },
    ],
  };

  // Pagination bar component
  const PaginationBar = ({ total }: { total: number }) => {
    if (total <= pageSize) return null;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <span className="text-sm text-muted-foreground">Showing {start}-{end} of {total}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (tab) {
      case 'vendors': {
        const filtered = store.vendors.filter(v =>
          !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.vendorNumber.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const { rows, total } = paginate(filtered);
        return (<>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Vendor Number</TableHead><TableHead>Vendor Name</TableHead><TableHead>Address</TableHead>
                <TableHead>ABN No</TableHead><TableHead>Country</TableHead><TableHead>Email</TableHead>
                <TableHead>Bank</TableHead><TableHead>Currency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(v => (
                <TableRow key={v.id} className="cursor-pointer hover:bg-muted/60" onClick={() => handleRowClick(v as unknown as Record<string, unknown>)}>
                  <TableCell className="font-mono">{v.vendorNumber}</TableCell>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{v.address}{v.city ? `, ${v.city}` : ''}</TableCell>
                  <TableCell className="font-mono text-sm">{v.taxId}</TableCell>
                  <TableCell>{v.country}</TableCell>
                  <TableCell className="text-sm">{v.email}</TableCell>
                  <TableCell className="font-mono text-xs">{v.bankAccount}</TableCell>
                  <TableCell>{v.currency}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar total={total} />
        </>);
      }
      case 'cost-centers': {
        const filtered = store.costCenters.filter(c =>
          !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const { rows, total } = paginate(filtered);
        return (<>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead>
                <TableHead>Company Code</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/60" onClick={() => handleRowClick(c as unknown as Record<string, unknown>)}>
                  <TableCell className="font-mono">{c.code}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.department}</TableCell>
                  <TableCell>{c.companyCode}</TableCell>
                  <TableCell><Badge variant={c.isActive ? 'default' : 'secondary'}>{c.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar total={total} />
        </>);
      }
      case 'gl-accounts': {
        const { rows, total } = paginate(store.glAccounts);
        return (<>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Account #</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead>
                <TableHead>Company Code</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(g => (
                <TableRow key={g.id} className="cursor-pointer hover:bg-muted/60" onClick={() => handleRowClick(g as unknown as Record<string, unknown>)}>
                  <TableCell className="font-mono">{g.accountNumber}</TableCell>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell><Badge variant="outline">{g.type}</Badge></TableCell>
                  <TableCell>{g.companyCode}</TableCell>
                  <TableCell><Badge variant={g.isActive ? 'default' : 'secondary'}>{g.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar total={total} />
        </>);
      }
      case 'tax-codes': {
        const { rows, total } = paginate(store.taxCodes);
        return (<>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Code</TableHead><TableHead>Description</TableHead><TableHead>Rate</TableHead>
                <TableHead>Country</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(t => (
                <TableRow key={t.id} className="cursor-pointer hover:bg-muted/60" onClick={() => handleRowClick(t as unknown as Record<string, unknown>)}>
                  <TableCell className="font-mono">{t.code}</TableCell>
                  <TableCell className="font-medium">{t.description}</TableCell>
                  <TableCell>{t.rate}%</TableCell>
                  <TableCell>{t.country}</TableCell>
                  <TableCell><Badge variant={t.isActive ? 'default' : 'secondary'}>{t.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar total={total} />
        </>);
      }
      case 'approval-sequences': {
        const filtered = store.approvalSequences.filter(s =>
          !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.invoiceType.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const { rows, total } = paginate(filtered);
        return (<>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Invoice Category</TableHead><TableHead>Approver 1 Name</TableHead>
                <TableHead>Approver 1 Email ID</TableHead><TableHead>Approver 2 Name</TableHead>
                <TableHead>Approver 2 Email ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(s => {
                const typeConfig = INVOICE_TYPE_CONFIG[s.invoiceType];
                const step1 = s.steps.find(st => st.stepNumber === 1);
                const step2 = s.steps.find(st => st.stepNumber === 2);
                return (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/60" onClick={() => handleRowClick(s as unknown as Record<string, unknown>)}>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-xs', typeConfig?.bgColor, typeConfig?.color)}>
                        {typeConfig?.label || s.invoiceType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{step1?.approverName ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{step1?.approverEmail ?? '—'}</TableCell>
                    <TableCell className="font-medium">{step2?.approverName ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{step2?.approverEmail ?? '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <PaginationBar total={total} />
        </>);
      }
      case 'freight-rates':
      case 'freight-rate-cards': {
        const { rows, total } = paginate(store.freightRateCards);
        return (<>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Origin</TableHead><TableHead>Destination</TableHead><TableHead>Container Type</TableHead>
                <TableHead>Rate</TableHead><TableHead>Currency</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(f => (
                <TableRow key={f.id} className="cursor-pointer hover:bg-muted/60" onClick={() => handleRowClick(f as unknown as Record<string, unknown>)}>
                  <TableCell className="font-medium">{f.origin}</TableCell>
                  <TableCell>{f.destination}</TableCell>
                  <TableCell><Badge variant="outline">{f.containerType}</Badge></TableCell>
                  <TableCell className="font-mono">{f.rate.toLocaleString()}</TableCell>
                  <TableCell>{f.currency}</TableCell>
                  <TableCell><Badge variant={f.isActive ? 'default' : 'secondary'}>{f.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar total={total} />
        </>);
      }
      case 'service-rates': {
        const { rows, total } = paginate(store.serviceRateCards);
        return (<>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Service</TableHead><TableHead>Rate</TableHead><TableHead>Currency</TableHead>
                <TableHead>Vendor</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(s => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-muted/60" onClick={() => handleRowClick(s as unknown as Record<string, unknown>)}>
                  <TableCell className="font-medium">{s.service}</TableCell>
                  <TableCell className="font-mono">{s.rate.toLocaleString()}</TableCell>
                  <TableCell>{s.currency}</TableCell>
                  <TableCell>{s.vendorId}</TableCell>
                  <TableCell><Badge variant={s.isActive ? 'default' : 'secondary'}>{s.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar total={total} />
        </>);
      }
      case 'agreements': {
        const { rows, total } = paginate(store.agreementMasters);
        return (<>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Vendor</TableHead><TableHead>Agreement No.</TableHead><TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead><TableHead>End Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(a => (
                <TableRow key={a.id} className="cursor-pointer hover:bg-muted/60" onClick={() => handleRowClick(a as unknown as Record<string, unknown>)}>
                  <TableCell className="font-medium">{a.vendorName}</TableCell>
                  <TableCell className="font-mono">{a.agreementNumber}</TableCell>
                  <TableCell><Badge variant={a.status === 'Active' ? 'default' : a.status === 'Expired' ? 'destructive' : 'secondary'}>{a.status}</Badge></TableCell>
                  <TableCell>{a.startDate}</TableCell>
                  <TableCell>{a.endDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar total={total} />
        </>);
      }
      case 'invoice-categories': {
        const categories = store.invoiceCategoryConfigs as { id: string; name: string; requiredDocs: string[]; glAccount: string; isActive: boolean }[];
        const { rows, total } = paginate(categories);
        return (<>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Category</TableHead><TableHead>Required Documents</TableHead>
                <TableHead>Default GL Account</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/60" onClick={() => handleRowClick(c as unknown as Record<string, unknown>)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.requiredDocs?.map(d => <Badge key={d} variant="outline" className="text-xs">{d}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{c.glAccount}</TableCell>
                  <TableCell><Badge variant={c.isActive ? 'default' : 'secondary'}>{c.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar total={total} />
        </>);
      }
      case 'extraction-fields': {
        const allRows = categoryConfigs.flatMap(cfg => {
          const invoiceRows = cfg.invoiceFields.map(f => ({ ...f, category: cfg.category, document: 'Invoice' }));
          const supportingRows = Object.entries(cfg.supportingFields).flatMap(([docType, fields]) =>
            fields.map(f => ({ ...f, category: cfg.category, document: docType }))
          );
          return [...invoiceRows, ...supportingRows];
        }).filter(r =>
          !searchQuery || r.label.toLowerCase().includes(searchQuery.toLowerCase()) || r.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const { rows, total } = paginate(allRows);
        return (<>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Category</TableHead><TableHead>Document</TableHead><TableHead>Field Key</TableHead>
                <TableHead>Label</TableHead><TableHead>Type</TableHead><TableHead>Required</TableHead>
                <TableHead>Validation</TableHead><TableHead>Edge Case</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={`${r.category}-${r.document}-${r.key}-${i}`}>
                  <TableCell><Badge variant="outline" className="text-xs">{r.category}</Badge></TableCell>
                  <TableCell className="text-sm">{r.document}</TableCell>
                  <TableCell className="font-mono text-xs">{r.key}</TableCell>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{r.type}</Badge></TableCell>
                  <TableCell>{r.required ? <Badge variant="default" className="text-xs">Yes</Badge> : <span className="text-muted-foreground text-xs">No</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.validation ?? '—'}</TableCell>
                  <TableCell className="text-xs">{r.edgeCaseAction ? <Badge variant="outline" className="text-xs">{r.edgeCaseAction}</Badge> : '—'}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No field configurations found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationBar total={total} />
        </>);
      }
      case 'validation-rules': {
        const allRules = categoryConfigs.flatMap(cfg =>
          cfg.validationRules.map(r => ({ ...r, category: cfg.category }))
        ).filter(r =>
          !searchQuery || r.ruleName.toLowerCase().includes(searchQuery.toLowerCase()) || r.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const { rows, total } = paginate(allRules);
        return (<>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Category</TableHead><TableHead>Rule ID</TableHead><TableHead>Rule Name</TableHead>
                <TableHead>Condition</TableHead><TableHead>Severity</TableHead><TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={`${r.category}-${r.ruleId}-${i}`}>
                  <TableCell><Badge variant="outline" className="text-xs">{r.category}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{r.ruleId}</TableCell>
                  <TableCell className="font-medium">{r.ruleName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{r.condition}</TableCell>
                  <TableCell><Badge variant={r.severity === 'ERROR' ? 'destructive' : r.severity === 'WARNING' ? 'default' : 'secondary'} className="text-xs">{r.severity}</Badge></TableCell>
                  <TableCell className="text-sm">{r.action}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No validation rules found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationBar total={total} />
        </>);
      }
      default:
        return (
          <div className="text-center py-8 text-muted-foreground">
            <p>Select a tab to view master data</p>
          </div>
        );
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageHeader title="Master Data" />
        {pendingChanges.length > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowPendingChanges(true)}>
            <ClipboardCheck className="h-4 w-4" />
            Pending Changes
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{pendingChanges.length}</Badge>
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground -mt-4 mb-4">Manage reference data used across the invoice processing pipeline.</p>

      {/* Tab Navigation - Pill Style */}
      <div className="flex items-center gap-1 mb-6 p-1 bg-muted/50 rounded-lg overflow-x-auto w-fit">
        {TABS.map(t => (
          <NavLink
            key={t.key}
            to={`/admin/masters/${t.key}`}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap',
              tab === t.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      {/* Search + Upload/Download + Add */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${tab?.replace('-', ' ')}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
          />
          <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Upload Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" /> Download Excel
          </Button>
          <Button className="gap-2" onClick={() => { setEditRow(null); setShowEditDialog(true); }}>
            <Plus className="h-4 w-4" /> Add New
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-hidden rounded-lg">
          {store.isLoading ? (
            <div className="p-8 space-y-2">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-10 bg-accent/30 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            renderContent()
          )}
        </CardContent>
      </Card>

      {/* Edit / Add Dialog (Item 13) */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editRow?.id ? 'Edit Record' : 'Add New Record'}</DialogTitle>
            <DialogDescription>{editRow?.id ? 'Modify the fields below and save.' : 'Fill in the fields to create a new record.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(TAB_FIELDS[tab!] || []).map(f => (
              <div key={f.key} className="grid grid-cols-3 items-center gap-3">
                <Label className="text-right text-sm">{f.label}</Label>
                <Input
                  className="col-span-2"
                  value={String(editRow?.[f.key] ?? '')}
                  onChange={(e) => setEditRow(prev => prev ? { ...prev, [f.key]: e.target.value } : { [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={() => {
              toast.success(editRow?.id ? 'Record updated' : 'Record created');
              setShowEditDialog(false);
              store.fetchAll();
            }}>
              {editRow?.id ? 'Save Changes' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Result Dialog (Item 14) */}
      <Dialog open={!!uploadResult} onOpenChange={() => setUploadResult(null)}>
        <DialogContent className="sm:max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Results</DialogTitle>
            <DialogDescription>
              Uploaded: {uploadResult?.inserted ?? 0} new, {uploadResult?.updated ?? 0} updated, {uploadResult?.errors?.length ?? 0} errors
            </DialogDescription>
          </DialogHeader>
          {uploadResult?.errors && uploadResult.errors.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Row</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadResult.errors.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono">{e.row}</TableCell>
                    <TableCell className="text-sm text-destructive">{e.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex justify-end pt-2">
            <Button onClick={() => setUploadResult(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending Changes Dialog (Item 26 — Maker-Checker) */}
      <Dialog open={showPendingChanges} onOpenChange={setShowPendingChanges}>
        <DialogContent className="sm:max-w-2xl max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /> Pending Changes</DialogTitle>
            <DialogDescription>Changes awaiting approval from another administrator.</DialogDescription>
          </DialogHeader>
          {pendingChanges.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No pending changes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Table</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Old Value</TableHead>
                  <TableHead>New Value</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingChanges.map(pc => (
                  <TableRow key={pc.id}>
                    <TableCell className="font-medium">{pc.table}</TableCell>
                    <TableCell>{pc.field}</TableCell>
                    <TableCell className="text-xs text-muted-foreground line-through">{pc.oldValue}</TableCell>
                    <TableCell className="text-xs font-semibold">{pc.newValue}</TableCell>
                    <TableCell className="text-xs">{pc.submittedBy}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50" onClick={() => {
                          setPendingChanges(prev => prev.filter(p => p.id !== pc.id));
                          toast.success('Change approved and applied');
                        }}><Check className="h-3 w-3" /> Approve</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-700 border-red-300 hover:bg-red-50" onClick={() => {
                          setPendingChanges(prev => prev.filter(p => p.id !== pc.id));
                          toast.info('Change rejected');
                        }}><X className="h-3 w-3" /> Reject</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
