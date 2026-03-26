import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FileText, Clock, Target, CheckCircle, Gauge } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  CartesianGrid,
} from 'recharts';
import type { Case } from '@/types/case';
import { CASE_CATEGORY_CONFIG } from '@/lib/constants';

const COLORS = ['#DC2626', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#6b7280', '#f97316', '#ef4444'];

const CATEGORY_COLORS: Record<string, string> = {
  Utility: '#06b6d4',
  Installation: '#8b5cf6',
  Warranty: '#10b981',
};

const STATUS_COLORS = ['#DC2626', '#f59e0b', '#8b5cf6', '#10b981', '#6b7280'];

const AGING_COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#DC2626'];

/* ---------- Custom Recharts tooltip ---------- */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-xl text-xs">
      {label && <p className="font-medium text-foreground mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-semibold text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/* ---------- Donut center label component ---------- */
function DonutCenterLabel({ viewBox, value, label }: { viewBox?: { cx: number; cy: number }; value: string; label: string }) {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  return (
    <g>
      <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="central" className="fill-foreground text-2xl font-bold" style={{ fontSize: 28, fontWeight: 700 }}>
        {value}
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground" style={{ fontSize: 11 }}>
        {label}
      </text>
    </g>
  );
}

/* ---------- Chart card wrapper ---------- */
function ChartCard({ title, subtitle, badge, children, className = '' }: { title: string; subtitle: string; badge?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`hover:shadow-lg transition-all duration-300 ${className}`}>
      <CardHeader className="pb-2 space-y-0.5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
          {badge && (
            <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

export function Analytics() {
  const [allCases, setAllCases] = useState<Case[]>([]);
  const [timeRange, setTimeRange] = useState('30');

  useEffect(() => {
    import('@/mock/handlers').then(({ fetchAllCases }) => {
      fetchAllCases().then(setAllCases);
    });
  }, []);

  /* ---------- Computed metrics (unchanged) ---------- */
  const totalProcessed = allCases.filter(c => ['POSTED', 'CLOSED', 'APPROVED'].includes(c.status)).length;
  const avgConfidence = allCases.filter(c => c.overallConfidence > 0).reduce((sum, c) => sum + c.overallConfidence, 0) / (allCases.filter(c => c.overallConfidence > 0).length || 1);
  const approvalRate = allCases.length > 0
    ? Math.round((allCases.filter(c => ['APPROVED', 'POSTED', 'CLOSED'].includes(c.status)).length / allCases.length) * 100)
    : 0;
  const slaCompliance = allCases.length > 0
    ? Math.round((allCases.filter(c => !c.isSlaBreach).length / allCases.length) * 100)
    : 0;

  // First-Pass Accuracy Rate
  const completedCases = allCases.filter(c => ['APPROVED', 'POSTED', 'CLOSED'].includes(c.status));
  const firstPassCases = completedCases.filter(c => c.overallConfidence >= 0.85 && !c.returnedAt && !c.rejectedAt);
  const firstPassRate = completedCases.length > 0
    ? Math.round((firstPassCases.length / completedCases.length) * 100)
    : 0;

  // Category breakdown
  const catData = Object.entries(CASE_CATEGORY_CONFIG).map(([key, config]) => ({
    name: config.label,
    count: allCases.filter(c => c.category === key).length,
  }));
  const totalCategoryCases = catData.reduce((s, d) => s + d.count, 0);

  // Status donut
  const statusGroups = {
    'Processing': allCases.filter(c => ['RECEIVED', 'CLASSIFIED', 'CATEGORIZED', 'EXTRACTED'].includes(c.status)).length,
    'In Review': allCases.filter(c => ['IN_REVIEW', 'VALIDATED'].includes(c.status)).length,
    'Approval': allCases.filter(c => c.status === 'APPROVAL_PENDING').length,
    'Completed': allCases.filter(c => ['APPROVED', 'POSTED', 'CLOSED'].includes(c.status)).length,
    'Issues': allCases.filter(c => ['REJECTED', 'RETURNED', 'FAILED', 'DISCARDED'].includes(c.status)).length,
  };
  const pieData = Object.entries(statusGroups).map(([name, value]) => ({ name, value }));
  const totalStatusCases = pieData.reduce((s, d) => s + d.value, 0);

  // Volume trend derived from actual case count
  const volumeBase = Math.max(Math.floor(allCases.length / 4), 3);
  const volumeData = [
    { week: 'W1', invoices: Math.round(volumeBase * 0.7) },
    { week: 'W2', invoices: Math.round(volumeBase * 1.1) },
    { week: 'W3', invoices: Math.round(volumeBase * 0.9) },
    { week: 'W4', invoices: allCases.length - Math.round(volumeBase * 0.7) - Math.round(volumeBase * 1.1) - Math.round(volumeBase * 0.9) },
  ];

  // Processing time trend (deterministic, showing improvement over time)
  const processingData = [
    { week: 'W1', hours: 28 },
    { week: 'W2', hours: 22 },
    { week: 'W3', hours: 19 },
    { week: 'W4', hours: 15 },
  ];

  // Top 5 Vendors by Invoice Volume
  const vendorCounts: Record<string, number> = {};
  allCases.forEach(c => {
    vendorCounts[c.vendorName] = (vendorCounts[c.vendorName] || 0) + 1;
  });
  const topVendorData = Object.entries(vendorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 18) + '...' : name, count }));
  const maxVendorCount = Math.max(...topVendorData.map(v => v.count), 1);

  // Aging Analysis
  const now = Date.now();
  const agingBuckets = { '0-24h': 0, '24-48h': 0, '48-72h': 0, '>72h': 0 };
  allCases.forEach(c => {
    const ageHours = (now - new Date(c.createdAt).getTime()) / (1000 * 60 * 60);
    if (ageHours <= 24) agingBuckets['0-24h']++;
    else if (ageHours <= 48) agingBuckets['24-48h']++;
    else if (ageHours <= 72) agingBuckets['48-72h']++;
    else agingBuckets['>72h']++;
  });
  const agingData = Object.entries(agingBuckets).map(([range, count]) => ({ range, count }));

  // Cost Center Spend Distribution
  const costCenterSpend: Record<string, number> = {};
  allCases.forEach(c => {
    const cc = c.headerData.costCenter || 'Unknown';
    costCenterSpend[cc] = (costCenterSpend[cc] || 0) + c.headerData.totalAmount;
  });
  const costCenterPieData = Object.entries(costCenterSpend).map(([name, value]) => ({
    name,
    value: Math.round(value),
  }));
  const totalSpend = costCenterPieData.reduce((s, d) => s + d.value, 0);

  /* ---------- First-pass donut data ---------- */
  const firstPassDonutData = [
    { name: 'First Pass', value: firstPassRate },
    { name: 'Remaining', value: 100 - firstPassRate },
  ];

  return (
    <div>
      <PageHeader title="Analytics">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>
      <p className="text-sm text-muted-foreground -mt-4 mb-8">System-wide performance metrics and processing insights.</p>

      {/* ============================================================
          ROW 1 - KPI Cards (5 cards)
          ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          title="Total Processed"
          value={totalProcessed}
          icon={<FileText className="h-5 w-5" />}
          trend={{ direction: 'up', percentage: 12.5 }}
          description="vs. last period"
        />
        <StatCard
          title="Avg Processing"
          value="19h"
          icon={<Clock className="h-5 w-5" />}
          trend={{ direction: 'down', percentage: 8.3 }}
          description="vs. last period"
        />
        <StatCard
          title="AI Accuracy"
          value={`${Math.round(avgConfidence * 100)}%`}
          icon={<Target className="h-5 w-5" />}
          variant="success"
          trend={{ direction: 'up', percentage: 2.1 }}
          description="vs. last period"
        />
        <StatCard
          title="Approval Rate"
          value={`${approvalRate}%`}
          icon={<CheckCircle className="h-5 w-5" />}
          trend={{ direction: 'flat', percentage: 0.4 }}
          description="vs. last period"
        />
        <StatCard
          title="SLA Compliance"
          value={`${slaCompliance}%`}
          icon={<Gauge className="h-5 w-5" />}
          variant={slaCompliance > 80 ? 'success' : 'warning'}
          trend={{ direction: 'up', percentage: 5.2 }}
          description="vs. last period"
        />
      </div>

      {/* ============================================================
          ROW 2 - First-Pass Accuracy Donut (1/3) + Volume Trend (2/3)
          ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* First-Pass Accuracy Donut */}
        <ChartCard
          title="First-Pass Accuracy"
          subtitle="Cases processed without manual corrections or returns"
          badge="Key Metric"
        >
          <div className="flex flex-col items-center justify-center pt-2">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={firstPassDonutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                >
                  <Cell fill="#DC2626" />
                  <Cell fill="hsl(var(--muted))" />
                  {/* @ts-expect-error recharts label accepts render function */}
                  <label content={<DonutCenterLabel value={`${firstPassRate}%`} label="Accuracy" />} position="center" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground -mt-2">
              <span className="font-semibold text-foreground">{firstPassCases.length}</span> of {completedCases.length} completed cases
            </p>
          </div>
        </ChartCard>

        {/* Invoice Volume Trend - Gradient Area */}
        <ChartCard
          title="Invoice Volume Trend"
          subtitle="Weekly invoice intake over the selected period"
          badge="Trending"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={volumeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="invoices" stroke="#DC2626" strokeWidth={2.5} fill="url(#colorVolume)" dot={false} activeDot={{ r: 5, fill: '#DC2626', stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ============================================================
          ROW 3 - Processing Time Line (1/2) + Category Progress Bars (1/2)
          ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Processing Time Trend */}
        <ChartCard
          title="Processing Time Trend"
          subtitle="Average hours to process invoices per week"
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={processingData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorProcessing" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="hours" stroke="#8b5cf6" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Cases by Category - Progress Bars */}
        <ChartCard
          title="Cases by Category"
          subtitle="Invoice distribution across category types"
        >
          <div className="space-y-5 pt-4">
            {catData.map((cat) => {
              const pct = totalCategoryCases > 0 ? Math.round((cat.count / totalCategoryCases) * 100) : 0;
              const color = CATEGORY_COLORS[cat.name] || '#6b7280';
              return (
                <div key={cat.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">{cat.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{cat.count}</span>
                      <span className="text-xs text-muted-foreground">({pct}%)</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {/* Mini bar chart below progress bars */}
          <div className="mt-6 pt-4 border-t border-border">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={catData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {catData.map((entry, i) => (
                    <Cell key={`cat-bar-${i}`} fill={CATEGORY_COLORS[entry.name] || COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* ============================================================
          ROW 4 - Status Donut (1/3) + Top Vendors Horizontal Bar (2/3)
          ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Status Distribution Donut */}
        <ChartCard
          title="Status Distribution"
          subtitle="Current pipeline status breakdown"
        >
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                dataKey="value"
                strokeWidth={0}
                paddingAngle={2}
              >
                {pieData.map((_, i) => (
                  <Cell key={`status-${i}`} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                ))}
                {/* @ts-expect-error recharts label accepts render function */}
                <label content={<DonutCenterLabel value={String(totalStatusCases)} label="Total" />} position="center" />
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center -mt-2">
            {pieData.map((entry, i) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[i % STATUS_COLORS.length] }} />
                {entry.name}
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Top Vendors - Horizontal Bar */}
        <ChartCard
          title="Top 5 Vendors by Volume"
          subtitle="Highest volume vendor partners this period"
          className="lg:col-span-2"
        >
          <div className="space-y-4 pt-2">
            {topVendorData.map((vendor, i) => {
              const pct = Math.round((vendor.count / maxVendorCount) * 100);
              return (
                <div key={vendor.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground font-medium truncate max-w-[200px]">{vendor.name}</span>
                    <span className="text-sm font-semibold text-foreground">{vendor.count}</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {/* Supporting chart */}
          <div className="mt-6 pt-4 border-t border-border">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={topVendorData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} className="fill-muted-foreground" />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {topVendorData.map((_, i) => (
                    <Cell key={`vendor-bar-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* ============================================================
          ROW 5 - Aging Analysis (1/2) + Cost Center Donut (1/2)
          ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Aging Analysis */}
        <ChartCard
          title="Aging Analysis"
          subtitle="Open case distribution by age bucket"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={agingData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {agingData.map((_, i) => (
                  <Cell key={`aging-${i}`} fill={AGING_COLORS[i % AGING_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Aging legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-1">
            {agingData.map((entry, i) => (
              <div key={entry.range} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: AGING_COLORS[i % AGING_COLORS.length] }} />
                {entry.range}: <span className="font-medium text-foreground">{entry.count}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Cost Center Spend Donut */}
        <ChartCard
          title="Cost Center Spend"
          subtitle="Total invoice value allocated by cost center"
          badge="Spend"
        >
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={costCenterPieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                dataKey="value"
                strokeWidth={0}
                paddingAngle={2}
              >
                {costCenterPieData.map((_, i) => (
                  <Cell key={`cc-${i}`} fill={COLORS[i % COLORS.length]} />
                ))}
                {/* @ts-expect-error recharts label accepts render function */}
                <label content={<DonutCenterLabel value={`${(totalSpend / 1000).toFixed(0)}K`} label="AUD Total" />} position="center" />
              </Pie>
              <Tooltip
                content={<ChartTooltip />}
                formatter={((value: number | undefined) => [`AUD ${((value ?? 0) / 1000).toFixed(0)}K`, 'Spend']) as never}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Cost center legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center -mt-2">
            {costCenterPieData.map((entry, i) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {entry.name}
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
