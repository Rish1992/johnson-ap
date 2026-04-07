import { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';
import { CASE_CATEGORY_CONFIG } from '@/lib/constants';
import type { Case } from '@/types/case';

// ---------------------------------------------------------------------------
// Custom rotated X-axis tick — renders labels cleanly below the bars
// ---------------------------------------------------------------------------
function AngledTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}
        textAnchor="end"
        fill="hsl(var(--muted-foreground))"
        fontSize={11}
        transform="rotate(-38)"
      >
        {payload?.value}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
const WARRANTY_COLOR   = '#10b981';
const NO_WARRANTY_COLOR = '#DC2626';
const SPM_COLOR        = '#8b5cf6';
const QUOTED_COLOR     = '#06b6d4';
const ACTUAL_COLOR     = '#f59e0b';
const GL_COLORS        = ['#DC2626', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#f97316'];

// ---------------------------------------------------------------------------
// Shared tooltip
// ---------------------------------------------------------------------------
function ChartTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-xl text-xs">
      {label && <p className="font-medium text-foreground mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
          {p.name}:{' '}
          <span className="font-semibold text-foreground">
            AUD {p.value.toLocaleString()}
          </span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function ReportHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function Analytics() {
  const [allCases, setAllCases] = useState<Case[]>([]);

  useEffect(() => {
    import('@/lib/handlers').then(({ fetchAllCases }) => {
      fetchAllCases().then(setAllCases);
    });
  }, []);

  // ── Report 1: Warranty vs Non-Warranty ──────────────────────────────────
  const warrantyReport = useMemo(() => {
    const serviceCases = allCases.filter(
      c => c.category === 'SUBCONTRACTOR' || c.category === 'RUST_SUBCONTRACTOR',
    );
    const map: Record<string, {
      wCount: number; nwCount: number; wValue: number; nwValue: number;
    }> = {};
    serviceCases.forEach(c => {
      if (!map[c.vendorName]) map[c.vendorName] = { wCount: 0, nwCount: 0, wValue: 0, nwValue: 0 };
      if (c.category === 'RUST_SUBCONTRACTOR') {
        map[c.vendorName].wCount++;
        map[c.vendorName].wValue += c.headerData.grandTotal;
      } else {
        map[c.vendorName].nwCount++;
        map[c.vendorName].nwValue += c.headerData.grandTotal;
      }
    });
    return Object.entries(map).map(([vendorName, d]) => ({
      vendorName,
      totalInvoices: d.wCount + d.nwCount,
      warrantyCount: d.wCount,
      nonWarrantyCount: d.nwCount,
      warrantyValue: Math.round(d.wValue),
      nonWarrantyValue: Math.round(d.nwValue),
      totalValue: Math.round(d.wValue + d.nwValue),
    })).sort((a, b) => b.totalValue - a.totalValue);
  }, [allCases]);

  const warrantyChartData = warrantyReport.map(r => ({
    vendor: r.vendorName.length > 14 ? r.vendorName.slice(0, 12) + '…' : r.vendorName,
    Warranty: r.warrantyValue,
    'Non-Warranty': r.nonWarrantyValue,
  }));

  // ── Report 2: SPM Job Performance ───────────────────────────────────────
  const spmReport = useMemo(() => {
    const spmCases = allCases.filter(c => c.category === 'SUBCONTRACTOR');
    const map: Record<string, { count: number; total: number }> = {};
    spmCases.forEach(c => {
      if (!map[c.vendorName]) map[c.vendorName] = { count: 0, total: 0 };
      map[c.vendorName].count++;
      map[c.vendorName].total += c.headerData.grandTotal;
    });
    return Object.entries(map).map(([vendorName, d]) => ({
      vendorName,
      spmJobCount: d.count,
      totalSpmExpense: Math.round(d.total),
      avgCostPerSpmJob: d.count > 0 ? Math.round(d.total / d.count) : 0,
    })).sort((a, b) => b.totalSpmExpense - a.totalSpmExpense);
  }, [allCases]);

  const spmChartData = spmReport.slice(0, 8).map(r => ({
    vendor: r.vendorName.length > 14 ? r.vendorName.slice(0, 12) + '…' : r.vendorName,
    'SPM Expense': r.totalSpmExpense,
  }));

  // ── Report 3: Delivery & Installation ───────────────────────────────────
  const deliveryReport = useMemo(() => {
    const delCases = allCases.filter(c => c.category === 'DELIVERY_INSTALLATION');
    const map: Record<string, { count: number; total: number }> = {};
    delCases.forEach(c => {
      if (!map[c.vendorName]) map[c.vendorName] = { count: 0, total: 0 };
      map[c.vendorName].count++;
      map[c.vendorName].total += c.headerData.grandTotal;
    });
    return Object.entries(map).map(([vendorName, d]) => ({
      vendorName,
      totalJobs: d.count,
      totalCost: Math.round(d.total),
    })).sort((a, b) => b.totalCost - a.totalCost);
  }, [allCases]);

  // ── Report 4: Quote vs Actual Breach ────────────────────────────────────
  const breachReport = useMemo(() => {
    const map: Record<string, {
      totalJobs: number; totalQuoted: number; totalActual: number; breachCount: number;
    }> = {};
    allCases.forEach(c => {
      // Simulate a quoted value: deterministic per-case factor (0.88–1.08)
      const seed = c.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const factor = 0.88 + (seed % 21) / 100;
      const quoted = Math.round(c.headerData.grandTotal * factor);
      const actual = c.headerData.grandTotal;
      const variancePct = quoted > 0 ? ((actual - quoted) / quoted) * 100 : 0;
      const isBreach = variancePct > 10;
      if (!map[c.vendorName]) map[c.vendorName] = { totalJobs: 0, totalQuoted: 0, totalActual: 0, breachCount: 0 };
      map[c.vendorName].totalJobs++;
      map[c.vendorName].totalQuoted += quoted;
      map[c.vendorName].totalActual += actual;
      if (isBreach) map[c.vendorName].breachCount++;
    });
    return Object.entries(map).map(([vendorName, d]) => {
      const variance = d.totalActual - d.totalQuoted;
      const variancePct = d.totalQuoted > 0 ? (variance / d.totalQuoted) * 100 : 0;
      return {
        vendorName,
        totalJobs: d.totalJobs,
        totalQuotedValue: Math.round(d.totalQuoted),
        totalActualCost: Math.round(d.totalActual),
        variance: Math.round(variance),
        variancePct: Math.round(variancePct * 10) / 10,
        breachCount: d.breachCount,
      };
    }).sort((a, b) => b.breachCount - a.breachCount);
  }, [allCases]);

  const breachChartData = breachReport.slice(0, 8).map(r => ({
    vendor: r.vendorName.length > 14 ? r.vendorName.slice(0, 12) + '…' : r.vendorName,
    Quoted: r.totalQuotedValue,
    Actual: r.totalActualCost,
  }));

  // ── Report 5: GL Expense Summary ────────────────────────────────────────
  const glReport = useMemo(() => {
    const map: Record<string, {
      category: string; branch: string; glCode: string; totalInvoices: number; totalExpense: number;
    }> = {};
    allCases.forEach(c => {
      const catLabel = CASE_CATEGORY_CONFIG[c.category]?.label || c.category;
      const branch = c.headerData.plantCode || c.headerData.companyCode || 'HQ';
      const glCode = c.headerData.glAccount || '—';
      const key = `${catLabel}|${branch}|${glCode}`;
      if (!map[key]) map[key] = { category: catLabel, branch, glCode, totalInvoices: 0, totalExpense: 0 };
      map[key].totalInvoices++;
      map[key].totalExpense += c.headerData.grandTotal;
    });
    return Object.values(map)
      .map(d => ({ ...d, totalExpense: Math.round(d.totalExpense) }))
      .sort((a, b) => b.totalExpense - a.totalExpense);
  }, [allCases]);

  const glBranches = [...new Set(glReport.map(r => r.branch))].slice(0, 8);
  const glCodes    = [...new Set(glReport.map(r => r.glCode))].filter(g => g !== '—').slice(0, 6);
  const glChartData = glBranches.map(branch => {
    const row: Record<string, string | number> = { branch };
    glCodes.forEach(gl => {
      const match = glReport.find(r => r.branch === branch && r.glCode === gl);
      row[gl] = match?.totalExpense || 0;
    });
    return row;
  });

  // ── Shared axis formatters ────────────────────────────────────────────────
  const kFormatter = (v: number) => `${(v / 1000).toFixed(0)}K`;

  return (
    <div>
      <PageHeader title="Analytics" />
      <p className="text-sm text-muted-foreground -mt-4 mb-6">
        Vendor performance and financial analytics across invoice categories.
      </p>

      <Tabs defaultValue="service-category">
        <TabsList className="mb-6">
          <TabsTrigger value="service-category">Service Category</TabsTrigger>
          <TabsTrigger value="delivery">Delivery &amp; Installation</TabsTrigger>
          <TabsTrigger value="breach">Breach Report</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
        </TabsList>

        {/* ================================================================
            SERVICE CATEGORY
            ================================================================ */}
        <TabsContent value="service-category" className="space-y-10">
          {/* Report 1 */}
          <div>
            <ReportHeader
              title="Vendor-wise Warranty vs Non-Warranty Performance"
              subtitle="Stacked expense breakdown per vendor across warranty and non-warranty service jobs."
            />
            <Card className="mb-4">
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={warrantyChartData}
                    margin={{ top: 10, right: 16, left: 16, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="vendor"
                      axisLine={false} tickLine={false}
                      tick={<AngledTick />}
                      interval={0}
                      height={72}
                    />
                    <YAxis
                      axisLine={false} tickLine={false}
                      tick={{ fontSize: 11 }}
                      tickFormatter={kFormatter}
                      width={52}
                    />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Legend />
                    <Bar dataKey="Warranty"     stackId="a" fill={WARRANTY_COLOR}    radius={[0,0,0,0]} />
                    <Bar dataKey="Non-Warranty" stackId="a" fill={NO_WARRANTY_COLOR} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Vendor Name</TableHead>
                      <TableHead className="text-right">Total Invoices</TableHead>
                      <TableHead className="text-right">Warranty Count</TableHead>
                      <TableHead className="text-right">Non-Warranty Count</TableHead>
                      <TableHead className="text-right">Warranty Value</TableHead>
                      <TableHead className="text-right">Non-Warranty Value</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warrantyReport.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No service category data found.
                        </TableCell>
                      </TableRow>
                    ) : warrantyReport.map(r => (
                      <TableRow key={r.vendorName}>
                        <TableCell className="font-medium">{r.vendorName}</TableCell>
                        <TableCell className="text-right">{r.totalInvoices}</TableCell>
                        <TableCell className="text-right">{r.warrantyCount}</TableCell>
                        <TableCell className="text-right">{r.nonWarrantyCount}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.warrantyValue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.nonWarrantyValue)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(r.totalValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Report 2 */}
          <div>
            <ReportHeader
              title="Vendor-wise SPM Job Performance"
              subtitle="Top vendors ranked by total SPM (Service &amp; Preventive Maintenance) cost."
            />
            <Card className="mb-4">
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={spmChartData}
                    margin={{ top: 10, right: 16, left: 16, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="vendor"
                      axisLine={false} tickLine={false}
                      tick={<AngledTick />}
                      interval={0}
                      height={72}
                    />
                    <YAxis
                      axisLine={false} tickLine={false}
                      tick={{ fontSize: 11 }}
                      tickFormatter={kFormatter}
                      width={52}
                    />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Bar dataKey="SPM Expense" fill={SPM_COLOR} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Vendor Name</TableHead>
                      <TableHead className="text-right">SPM Job Count</TableHead>
                      <TableHead className="text-right">Total SPM Expense</TableHead>
                      <TableHead className="text-right">Avg Cost per SPM Job</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spmReport.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No SPM data found.
                        </TableCell>
                      </TableRow>
                    ) : spmReport.map(r => (
                      <TableRow key={r.vendorName}>
                        <TableCell className="font-medium">{r.vendorName}</TableCell>
                        <TableCell className="text-right">{r.spmJobCount}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.totalSpmExpense)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.avgCostPerSpmJob)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ================================================================
            DELIVERY & INSTALLATION
            ================================================================ */}
        <TabsContent value="delivery">
          <ReportHeader
            title="Vendor-wise Delivery &amp; Installation Cost"
            subtitle="Total jobs and cost per vendor for delivery and installation invoices."
          />
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Vendor Name</TableHead>
                    <TableHead className="text-right">Total Jobs</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryReport.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No delivery &amp; installation data found.
                      </TableCell>
                    </TableRow>
                  ) : deliveryReport.map(r => (
                    <TableRow key={r.vendorName}>
                      <TableCell className="font-medium">{r.vendorName}</TableCell>
                      <TableCell className="text-right">{r.totalJobs}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(r.totalCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================
            BREACH REPORT
            ================================================================ */}
        <TabsContent value="breach">
          <ReportHeader
            title="Quote vs Actual — Breach Report"
            subtitle="Vendors where actual invoice cost exceeded quoted value by more than 10%."
          />
          <Card className="mb-4">
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={breachChartData}
                  margin={{ top: 10, right: 16, left: 16, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="vendor"
                    axisLine={false} tickLine={false}
                    tick={{ fontSize: 11 }}
                    angle={-40} textAnchor="end" interval={0}
                    height={80}
                  />
                  <YAxis
                    axisLine={false} tickLine={false}
                    tick={{ fontSize: 11 }}
                    tickFormatter={kFormatter}
                    width={52}
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Legend />
                  <Bar dataKey="Quoted" fill={QUOTED_COLOR} radius={[4,4,0,0]} />
                  <Bar dataKey="Actual" fill={ACTUAL_COLOR}  radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Vendor Name</TableHead>
                    <TableHead className="text-right">Total Jobs</TableHead>
                    <TableHead className="text-right">Total Quoted Value</TableHead>
                    <TableHead className="text-right">Total Actual Cost</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">Variance %</TableHead>
                    <TableHead className="text-right">Breach Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breachReport.map(r => (
                    <TableRow key={r.vendorName}>
                      <TableCell className="font-medium">{r.vendorName}</TableCell>
                      <TableCell className="text-right">{r.totalJobs}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.totalQuotedValue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.totalActualCost)}</TableCell>
                      <TableCell className={`text-right font-semibold ${r.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {r.variance > 0 ? '+' : ''}{formatCurrency(r.variance)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${r.variancePct > 10 ? 'text-red-600' : 'text-green-600'}`}>
                        {r.variancePct > 0 ? '+' : ''}{r.variancePct}%
                      </TableCell>
                      <TableCell className="text-right">
                        {r.breachCount > 0
                          ? <Badge variant="destructive" className="text-xs">{r.breachCount}</Badge>
                          : <span className="text-muted-foreground text-sm">0</span>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================
            FINANCIAL — GL EXPENSE SUMMARY
            ================================================================ */}
        <TabsContent value="financial">
          <ReportHeader
            title="GL Expense Summary"
            subtitle="Expense breakdown by invoice category, branch, and GL code."
          />
          {glCodes.length > 0 && (
            <Card className="mb-4">
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={glChartData}
                    margin={{ top: 10, right: 16, left: 16, bottom: 24 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="branch"
                      axisLine={false} tickLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false} tickLine={false}
                      tick={{ fontSize: 11 }}
                      tickFormatter={kFormatter}
                      width={52}
                    />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Legend />
                    {glCodes.map((gl, i) => (
                      <Bar
                        key={gl}
                        dataKey={gl}
                        stackId="a"
                        fill={GL_COLORS[i % GL_COLORS.length]}
                        radius={i === glCodes.length - 1 ? [4,4,0,0] : [0,0,0,0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Invoice Category</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>GL Code</TableHead>
                    <TableHead className="text-right">Total Invoices</TableHead>
                    <TableHead className="text-right">Total Expense</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {glReport.slice(0, 50).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{r.category}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.branch || '—'}</TableCell>
                      <TableCell className="font-mono text-sm">{r.glCode || '—'}</TableCell>
                      <TableCell className="text-right">{r.totalInvoices}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(r.totalExpense)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
