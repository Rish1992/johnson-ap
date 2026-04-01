import { useEffect, useState } from 'react';
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
import { Plus, Search, ClipboardCheck, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INVOICE_TYPE_CONFIG } from '@/lib/constants';
import { toast } from 'sonner';

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
];

export function MastersHub() {
  const { tab = 'vendors' } = useParams<{ tab: string }>();
  const store = useMasterDataStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [showPendingChanges, setShowPendingChanges] = useState(false);

  useEffect(() => {
    store.fetchAll();
  }, []);

  const renderContent = () => {
    switch (tab) {
      case 'vendors':
        const vendors = store.vendors.filter(v =>
          !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.vendorNumber.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Vendor Number</TableHead>
                <TableHead>Vendor Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>ABN No</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Currency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map(v => (
                <TableRow key={v.id}>
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
        );
      case 'cost-centers':
        const ccs = store.costCenters.filter(c =>
          !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Company Code</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ccs.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">{c.code}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.department}</TableCell>
                  <TableCell>{c.companyCode}</TableCell>
                  <TableCell><Badge variant={c.isActive ? 'default' : 'secondary'}>{c.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      case 'gl-accounts':
        return (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Account #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Company Code</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.glAccounts.map(g => (
                <TableRow key={g.id}>
                  <TableCell className="font-mono">{g.accountNumber}</TableCell>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell><Badge variant="outline">{g.type}</Badge></TableCell>
                  <TableCell>{g.companyCode}</TableCell>
                  <TableCell><Badge variant={g.isActive ? 'default' : 'secondary'}>{g.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      case 'tax-codes':
        return (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.taxCodes.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono">{t.code}</TableCell>
                  <TableCell className="font-medium">{t.description}</TableCell>
                  <TableCell>{t.rate}%</TableCell>
                  <TableCell>{t.country}</TableCell>
                  <TableCell><Badge variant={t.isActive ? 'default' : 'secondary'}>{t.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      case 'approval-sequences':
        const sequences = store.approvalSequences.filter(s =>
          !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.invoiceType.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Invoice Category</TableHead>
                <TableHead>Approver 1 Name</TableHead>
                <TableHead>Approver 1 Email ID</TableHead>
                <TableHead>Approver 2 Name</TableHead>
                <TableHead>Approver 2 Email ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sequences.map(s => {
                const typeConfig = INVOICE_TYPE_CONFIG[s.invoiceType];
                const step1 = s.steps.find(st => st.stepNumber === 1);
                const step2 = s.steps.find(st => st.stepNumber === 2);
                return (
                  <TableRow key={s.id}>
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
        );
      case 'freight-rates':
        return (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Origin</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Container Type</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.freightRateCards.map(f => (
                <TableRow key={f.id}>
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
        );
      case 'service-rates':
        return (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Service</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.serviceRateCards.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.service}</TableCell>
                  <TableCell className="font-mono">{s.rate.toLocaleString()}</TableCell>
                  <TableCell>{s.currency}</TableCell>
                  <TableCell>{s.vendorId}</TableCell>
                  <TableCell><Badge variant={s.isActive ? 'default' : 'secondary'}>{s.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      case 'agreements':
        return (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Vendor</TableHead>
                <TableHead>Agreement No.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.agreementMasters.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.vendorName}</TableCell>
                  <TableCell className="font-mono">{a.agreementNumber}</TableCell>
                  <TableCell><Badge variant={a.status === 'Active' ? 'default' : a.status === 'Expired' ? 'destructive' : 'secondary'}>{a.status}</Badge></TableCell>
                  <TableCell>{a.startDate}</TableCell>
                  <TableCell>{a.endDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      case 'invoice-categories':
        const categories = store.invoiceCategoryConfigs as { id: string; name: string; requiredDocs: string[]; glAccount: string; isActive: boolean }[];
        return (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Category</TableHead>
                <TableHead>Required Documents</TableHead>
                <TableHead>Default GL Account</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map(c => (
                <TableRow key={c.id}>
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
        );
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

      {/* Search + Add */}
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
        <Button className="gap-2" onClick={() => {
          const mockChange: PendingChange = {
            id: `PC-${Date.now()}`,
            table: tab?.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Vendor',
            field: tab === 'vendors' ? 'Bank Account' : tab === 'gl-accounts' ? 'Account Name' : 'Status',
            oldValue: tab === 'vendors' ? 'XXXX-1234' : 'Previous Value',
            newValue: tab === 'vendors' ? 'XXXX-5678' : 'Updated Value',
            submittedBy: 'Alex Kumar',
            submittedAt: new Date().toISOString(),
          };
          setPendingChanges(prev => [...prev, mockChange]);
          toast.info('Change submitted for approval');
        }}>
          <Plus className="h-4 w-4" />
          Add New
        </Button>
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
