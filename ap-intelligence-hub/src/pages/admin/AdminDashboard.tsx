import { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { CaseStatusBadge } from '@/components/shared/CaseStatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  FileText, Clock, AlertTriangle, CheckCircle, Search,
  DollarSign, Gauge, TrendingUp, Activity, Zap, BarChart3,
} from 'lucide-react';
import { formatCurrency, formatRelativeTime } from '@/lib/formatters';
import type { Case } from '@/types/case';
import {
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid,
} from 'recharts';
import { CASE_STATUS_CONFIG, CASE_CATEGORY_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DONUT_COLORS = ['#DC2626', '#f59e0b', '#8b5cf6', '#10b981', '#06b6d4', '#ef4444', '#6b7280', '#f97316'];

const PIPELINE_STAGES = [
  { status: 'RECEIVED',         label: 'Received',   hex: '#64748b' },
  { status: 'CLASSIFIED',       label: 'Classified',  hex: '#64748b' },
  { status: 'EXTRACTED',        label: 'Extracted',   hex: '#DC2626' },
  { status: 'IN_REVIEW',        label: 'In Review',   hex: '#f59e0b' },
  { status: 'VALIDATED',        label: 'Validated',   hex: '#06b6d4' },
  { status: 'APPROVAL_PENDING', label: 'Approval',    hex: '#8b5cf6' },
  { status: 'APPROVED',         label: 'Approved',    hex: '#10b981' },
  { status: 'POSTED',           label: 'Posted',      hex: '#059669' },
] as const;

const CATEGORY_BAR_COLORS: Record<string, string> = {
  Utility:      '#DC2626',
  Installation: '#8b5cf6',
  Warranty:     '#06b6d4',
};

// Generate 12-week mock volume data (deterministic from case count)
function generateWeeklyVolume(totalCases: number) {
  const base = Math.max(Math.floor(totalCases / 3), 4);
  const offsets = [0.6, 0.72, 0.85, 0.78, 1.0, 0.92, 1.1, 1.25, 1.15, 1.32, 1.2, 1.38];
  return offsets.map((m, i) => ({
    week: `W${i + 1}`,
    volume: Math.round(base * m),
  }));
}

// Mini sparkline data (7-point)
const SPARKLINE_POINTS = [4, 7, 5, 9, 6, 11, 8];

// ---------------------------------------------------------------------------
// Sparkline SVG component
// ---------------------------------------------------------------------------
function MiniSparkline({ data, color = '#DC2626' }: { data: number[]; color?: string }) {
  const w = 80;
  const h = 28;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="inline-block">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Glow dot on the last point */}
      {(() => {
        const last = pts[pts.length - 1].split(',');
        return <circle cx={last[0]} cy={last[1]} r="3" fill={color} opacity="0.85" />;
      })()}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip for Area Chart
// ---------------------------------------------------------------------------
function AreaTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-background/95 px-3.5 py-2 shadow-xl backdrop-blur-sm">
      <p className="text-[11px] font-medium text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-bold text-foreground">{payload[0].value} invoices</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export function AdminDashboard() {
  const [allCases, setAllCases] = useState<Case[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    import('@/mock/handlers').then(({ fetchAllCases }) => {
      fetchAllCases().then((data) => {
        setAllCases(data);
      });
    });
  }, []);

  // ---- Core metrics ----
  const totalCases     = allCases.length;
  const inReview       = allCases.filter(c => c.status === 'IN_REVIEW').length;
  const pendingApproval = allCases.filter(c => c.status === 'APPROVAL_PENDING').length;
  const slaBreach      = allCases.filter(c => c.isSlaBreach).length;

  const slaCompliance = totalCases > 0
    ? Math.round((allCases.filter(c => !c.isSlaBreach).length / totalCases) * 100)
    : 0;

  const avgInvoiceValue = totalCases > 0
    ? Math.round(allCases.reduce((sum, c) => sum + c.headerData.totalAmount, 0) / totalCases)
    : 0;

  // ---- Pipeline counts ----
  const pipelineCounts: Record<string, number> = {};
  PIPELINE_STAGES.forEach(stage => {
    pipelineCounts[stage.status] = allCases.filter(c => c.status === stage.status).length;
  });

  // ---- Status distribution (donut) ----
  const statusCounts = allCases.reduce((acc, c) => {
    const label = CASE_STATUS_CONFIG[c.status]?.label || c.status;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // ---- Category distribution (progress bars) ----
  const catCounts = allCases.reduce((acc, c) => {
    const label = CASE_CATEGORY_CONFIG[c.category]?.label || c.category;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const catTotal = Object.values(catCounts).reduce((a, b) => a + b, 0) || 1;
  const categoryBreakdown = Object.entries(catCounts)
    .map(([name, value]) => ({
      name,
      value,
      pct: Math.round((value / catTotal) * 100),
      color: CATEGORY_BAR_COLORS[name] || '#6b7280',
    }))
    .sort((a, b) => b.value - a.value);

  // ---- Weekly volume area chart data ----
  const weeklyVolume = useMemo(() => generateWeeklyVolume(totalCases), [totalCases]);

  // ---- Filtered table ----
  const filteredCases = searchQuery
    ? allCases.filter(c =>
        c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.vendorName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allCases;
  const recentCases = filteredCases.slice(0, 10);

  // ---- Pipeline total for throughput ----
  const pipelineActive = Object.values(pipelineCounts).reduce((a, b) => a + b, 0);

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <PageHeader title="Dashboard" />
        <p className="text-sm text-muted-foreground -mt-4 mb-2">
          Real-time overview of invoice processing activity across the organization.
        </p>
      </div>

      {/* =================================================================
          ROW 1 -- Stat Cards (4-up bento)
          ================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <StatCard
            title="Total Cases"
            value={totalCases}
            icon={<FileText className="h-5 w-5" />}
            variant="default"
            trend={{ direction: 'up', percentage: 12.5 }}
            description="vs. last period"
          />
          {/* Sparkline overlay */}
          <div className="absolute bottom-4 right-5 opacity-80">
            <MiniSparkline data={SPARKLINE_POINTS} color="#3b82f6" />
          </div>
        </div>

        <StatCard
          title="In Review"
          value={inReview}
          icon={<Clock className="h-5 w-5" />}
          variant="warning"
          trend={{ direction: inReview > 3 ? 'up' : 'down', percentage: 8.3 }}
          description="vs. last period"
        />

        <StatCard
          title="Pending Approval"
          value={pendingApproval}
          icon={<CheckCircle className="h-5 w-5" />}
          variant="default"
          trend={{ direction: 'down', percentage: 4.1 }}
          description="vs. last period"
        />

        <StatCard
          title="SLA Breaches"
          value={slaBreach}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant="danger"
          trend={{ direction: slaBreach > 0 ? 'up' : 'flat', percentage: slaBreach > 0 ? 15.0 : 0 }}
          description="vs. last period"
        />
      </div>

      {/* =================================================================
          ROW 2 -- Hero Area Chart (2/3) + Donut (1/3)
          ================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* --- Hero Area Chart --- */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Invoice Volume
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Weekly intake over the last 12 weeks
                </p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-600">+18.2%</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 pr-4 pb-4">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={weeklyVolume} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="heroAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#DC2626" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="#DC2626" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#DC2626" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis
                  dataKey="week"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  dy={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  dx={-4}
                  width={36}
                />
                <RechartsTooltip content={<AreaTooltip />} cursor={{ stroke: '#DC2626', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="#DC2626"
                  strokeWidth={2.5}
                  fill="url(#heroAreaGradient)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: '#DC2626', stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* --- Donut Chart with Center Text --- */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Status Breakdown
            </CardTitle>
            <p className="text-xs text-muted-foreground">Current case distribution</p>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center relative pt-0">
            <div className="relative w-full">
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={((value: number | undefined, name: string | undefined) => [`${value ?? 0} cases`, name ?? '']) as never}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--background))',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center overlay text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-extrabold text-foreground leading-none">{totalCases}</span>
                <span className="text-[11px] font-medium text-muted-foreground mt-1">Total Cases</span>
              </div>
            </div>
            {/* Legend pills below donut */}
            <div className="absolute bottom-3 left-0 right-0 flex flex-wrap justify-center gap-x-3 gap-y-1 px-4">
              {pieData.slice(0, 5).map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                  />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* =================================================================
          ROW 3 -- Processing Pipeline (full width, modern stepper)
          ================================================================= */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Processing Pipeline
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pipelineActive} active invoices across all stages
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
              <span className="text-[11px] font-semibold text-muted-foreground">
                Throughput: {pipelineActive} / cycle
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between overflow-x-auto pb-2 px-2">
            {PIPELINE_STAGES.map((stage, index) => {
              const count = pipelineCounts[stage.status] || 0;
              return (
                <div key={stage.status} className="flex items-start flex-1 min-w-0">
                  {/* Stage node */}
                  <div className="flex flex-col items-center w-full">
                    {/* Connector line + circle row */}
                    <div className="flex items-center w-full">
                      {/* Left connector */}
                      {index > 0 ? (
                        <div className="flex-1 h-[2px] bg-border" />
                      ) : (
                        <div className="flex-1" />
                      )}
                      {/* Circle */}
                      <div
                        className={cn(
                          'relative flex items-center justify-center rounded-full shrink-0 transition-all duration-300',
                          count > 0
                            ? 'h-12 w-12 shadow-lg'
                            : 'h-10 w-10 opacity-50'
                        )}
                        style={{
                          backgroundColor: count > 0 ? stage.hex : 'transparent',
                          border: count > 0 ? 'none' : `2px solid ${stage.hex}`,
                          boxShadow: count > 0 ? `0 4px 14px ${stage.hex}33` : 'none',
                        }}
                      >
                        <span
                          className={cn(
                            'font-bold leading-none',
                            count > 0 ? 'text-white text-base' : 'text-muted-foreground text-sm'
                          )}
                        >
                          {count}
                        </span>
                      </div>
                      {/* Right connector */}
                      {index < PIPELINE_STAGES.length - 1 ? (
                        <div className="flex-1 h-[2px] bg-border" />
                      ) : (
                        <div className="flex-1" />
                      )}
                    </div>
                    {/* Label */}
                    <span className="text-[11px] font-medium text-muted-foreground mt-2 text-center whitespace-nowrap">
                      {stage.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* =================================================================
          ROW 4 -- Category Breakdown (progress bars) + Secondary metrics
          ================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Category Breakdown Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Category Breakdown</CardTitle>
            <p className="text-xs text-muted-foreground">Invoice distribution by category type</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {categoryBreakdown.map((cat) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm font-medium text-foreground">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{cat.value} cases</span>
                    <span className="text-sm font-semibold text-foreground w-10 text-right">{cat.pct}%</span>
                  </div>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${cat.pct}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Secondary metrics cards */}
        <div className="space-y-4">
          <StatCard
            title="SLA Compliance"
            value={`${slaCompliance}%`}
            icon={<Gauge className="h-5 w-5" />}
            variant={slaCompliance >= 80 ? 'success' : 'warning'}
            trend={{ direction: slaCompliance >= 80 ? 'up' : 'down', percentage: 3.2 }}
            description="vs. last period"
          />
          <StatCard
            title="Avg. Invoice Value"
            value={formatCurrency(avgInvoiceValue)}
            icon={<DollarSign className="h-5 w-5" />}
            variant="default"
            trend={{ direction: 'up', percentage: 6.7 }}
            description="vs. last period"
          />
          <StatCard
            title="Approval Queue"
            value={pendingApproval}
            icon={<CheckCircle className="h-5 w-5" />}
            variant={pendingApproval > 5 ? 'warning' : 'success'}
            trend={{ direction: 'down', percentage: 11.0 }}
            description="vs. last period"
          />
        </div>
      </div>

      {/* =================================================================
          ROW 5 -- Recent Cases Table (full width, modern styling)
          ================================================================= */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Recent Cases</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Showing {recentCases.length} of {filteredCases.length} cases
              </p>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID or vendor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-muted/40 border-transparent focus:border-border focus:bg-background transition-colors"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="pl-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Case ID</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Vendor</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Category</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                  <TableHead className="pr-6 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No cases found.
                    </TableCell>
                  </TableRow>
                )}
                {recentCases.map((c) => {
                  const catConfig = CASE_CATEGORY_CONFIG[c.category];
                  return (
                    <TableRow
                      key={c.id}
                      className="group cursor-pointer transition-colors hover:bg-accent/60"
                    >
                      <TableCell className="pl-6 font-mono text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {c.id}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{c.vendorName}</TableCell>
                      <TableCell>
                        {catConfig && (
                          <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium', catConfig.bgColor, catConfig.color)}>
                            {catConfig.label}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <CaseStatusBadge status={c.status} size="sm" />
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">
                        {formatCurrency(c.headerData.totalAmount)}
                      </TableCell>
                      <TableCell className="pr-6 text-sm text-muted-foreground">
                        {formatRelativeTime(c.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
