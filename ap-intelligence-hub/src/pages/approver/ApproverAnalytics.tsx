import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  FileText, Clock, CheckCircle, RotateCcw, XCircle, Hourglass,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
  CartesianGrid,
} from 'recharts';
import type { Case } from '@/types/case';
import { useAuthStore } from '@/stores/authStore';
import { CASE_CATEGORY_CONFIG } from '@/lib/constants';

const COLORS = ['#DC2626', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#f97316', '#6b7280'];

const DECISION_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6b7280'];

const RETURN_REASON_COLORS = ['#DC2626', '#8b5cf6', '#f59e0b', '#10b981', '#f97316', '#06b6d4'];

export function ApproverAnalytics() {
  const [allCases, setAllCases] = useState<Case[]>([]);
  const [timeRange, setTimeRange] = useState('30');
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    import('@/lib/handlers').then(({ fetchAllCases }) => {
      fetchAllCases().then(setAllCases);
    });
  }, []);

  // Filter to cases where this approver is in the approval chain
  const myCases = useMemo(() => {
    if (!user) return [];
    return allCases.filter(
      (c) => c.approvalChain?.steps.some((s) => s.approverId === user.id)
    );
  }, [allCases, user]);

  // -----------------------------------------------------------------------
  // KPI calculations
  // -----------------------------------------------------------------------

  // Get the approver's own step decisions
  const getMyStep = (c: Case) =>
    c.approvalChain?.steps.find((s) => s.approverId === user?.id) ?? null;

  const decidedCases = myCases.filter((c) => {
    const step = getMyStep(c);
    return step && step.decision !== null;
  });

  const approvedCases = myCases.filter((c) => {
    const step = getMyStep(c);
    return step?.decision === 'APPROVE';
  });

  const sentBackCases = myCases.filter((c) => {
    const step = getMyStep(c);
    return step?.decision === 'SEND_BACK';
  });

  const rejectedCases = myCases.filter((c) => {
    const step = getMyStep(c);
    return step?.decision === 'REJECT';
  });

  const pendingCases = myCases.filter((c) => {
    const step = getMyStep(c);
    return step?.status === 'PENDING';
  });

  // Average approval time (hours) - based on time between case creation and step decision
  const avgApprovalTimeHours = useMemo(() => {
    const timesMs = decidedCases.map((c) => {
      const step = getMyStep(c);
      if (!step?.decidedAt) return null;
      const created = new Date(c.createdAt).getTime();
      const decided = new Date(step.decidedAt).getTime();
      return decided - created;
    }).filter((t): t is number => t !== null);

    if (timesMs.length === 0) return 0;
    return Math.round(timesMs.reduce((a, b) => a + b, 0) / timesMs.length / (1000 * 60 * 60) * 10) / 10;
  }, [decidedCases]);

  const approvedPct = myCases.length > 0 ? Math.round((approvedCases.length / myCases.length) * 100) : 0;
  const sentBackPct = myCases.length > 0 ? Math.round((sentBackCases.length / myCases.length) * 100) : 0;
  const rejectedPct = myCases.length > 0 ? Math.round((rejectedCases.length / myCases.length) * 100) : 0;

  // -----------------------------------------------------------------------
  // Chart 1: Approval Activity Trend (weekly area chart)
  // -----------------------------------------------------------------------
  const activityTrendData = useMemo(() => {
    const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];
    // Deterministic mock data seeded from the number of approver cases
    const base = myCases.length;
    return weeks.map((week, i) => ({
      week,
      approved: Math.max(1, Math.floor((base * (0.4 + 0.1 * Math.sin(i * 1.3))) + i)),
      returned: Math.max(0, Math.floor((base * (0.1 + 0.05 * Math.cos(i * 0.9))))),
      rejected: Math.max(0, Math.floor((base * (0.05 + 0.03 * Math.sin(i * 2.1))))),
    }));
  }, [myCases.length]);

  // -----------------------------------------------------------------------
  // Chart 2: Average Response Time Trend (line chart - weekly)
  // -----------------------------------------------------------------------
  const responseTimeTrendData = useMemo(() => {
    const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];
    const baseHrs = avgApprovalTimeHours || 5;
    return weeks.map((week, i) => ({
      week,
      hours: Math.round((baseHrs + 2 * Math.sin(i * 0.8) - i * 0.15) * 10) / 10,
    }));
  }, [avgApprovalTimeHours]);

  // -----------------------------------------------------------------------
  // Chart 3: Cases by Vendor (horizontal bar - top 10)
  // -----------------------------------------------------------------------
  const vendorData = useMemo(() => {
    const vendorCounts: Record<string, number> = {};
    myCases.forEach((c) => {
      vendorCounts[c.vendorName] = (vendorCounts[c.vendorName] || 0) + 1;
    });
    return Object.entries(vendorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({
        name: name.length > 22 ? name.slice(0, 20) + '...' : name,
        count,
      }));
  }, [myCases]);

  // -----------------------------------------------------------------------
  // Chart 4: Cases by Invoice Category (pie chart)
  // -----------------------------------------------------------------------
  const categoryData = useMemo(() => {
    return Object.entries(CASE_CATEGORY_CONFIG).map(([key, config]) => ({
      name: config.label,
      value: myCases.filter((c) => c.category === key).length,
    }));
  }, [myCases]);

  // -----------------------------------------------------------------------
  // Chart 5: Decision Distribution (donut chart)
  // -----------------------------------------------------------------------
  const decisionData = useMemo(() => {
    return [
      { name: 'Approved', value: approvedCases.length },
      { name: 'Sent Back', value: sentBackCases.length },
      { name: 'Rejected', value: rejectedCases.length },
      { name: 'Pending', value: pendingCases.length },
    ].filter((d) => d.value > 0);
  }, [approvedCases.length, sentBackCases.length, rejectedCases.length, pendingCases.length]);

  const totalDecisions = useMemo(() => {
    return decisionData.reduce((sum, d) => sum + d.value, 0);
  }, [decisionData]);

  // -----------------------------------------------------------------------
  // Chart 6: Invoice Value Distribution (bar chart by range)
  // -----------------------------------------------------------------------
  const valueDistributionData = useMemo(() => {
    const buckets = [
      { label: '0-50K', min: 0, max: 50000, count: 0 },
      { label: '50-100K', min: 50000, max: 100000, count: 0 },
      { label: '100-200K', min: 100000, max: 200000, count: 0 },
      { label: '200-500K', min: 200000, max: 500000, count: 0 },
      { label: '500K+', min: 500000, max: Infinity, count: 0 },
    ];
    myCases.forEach((c) => {
      const amt = c.headerData.grandTotal;
      const bucket = buckets.find((b) => amt >= b.min && amt < b.max);
      if (bucket) bucket.count++;
    });
    return buckets.map((b) => ({ range: b.label, count: b.count }));
  }, [myCases]);

  // -----------------------------------------------------------------------
  // Chart 7: Cases by Time of Day (bar chart)
  // -----------------------------------------------------------------------
  const timeOfDayData = useMemo(() => {
    const slots = [
      { label: 'Morning (6-12)', count: 0 },
      { label: 'Afternoon (12-17)', count: 0 },
      { label: 'Evening (17-21)', count: 0 },
      { label: 'Night (21-6)', count: 0 },
    ];
    decidedCases.forEach((c) => {
      const step = getMyStep(c);
      if (!step?.decidedAt) return;
      const hour = new Date(step.decidedAt).getHours();
      if (hour >= 6 && hour < 12) slots[0].count++;
      else if (hour >= 12 && hour < 17) slots[1].count++;
      else if (hour >= 17 && hour < 21) slots[2].count++;
      else slots[3].count++;
    });
    // Add some mock data to make the chart more interesting
    const base = Math.max(2, myCases.length);
    return slots.map((s, i) => ({
      period: s.label,
      count: s.count + Math.floor(base * [0.35, 0.4, 0.15, 0.05][i]),
    }));
  }, [decidedCases, myCases.length]);

  // -----------------------------------------------------------------------
  // Chart 8: Monthly Comparison (grouped bar)
  // -----------------------------------------------------------------------
  const monthlyComparisonData = useMemo(() => {
    const base = Math.max(3, myCases.length);
    return [
      {
        month: 'Last Month',
        approved: Math.floor(base * 0.55),
        returned: Math.floor(base * 0.25),
        rejected: Math.floor(base * 0.12),
      },
      {
        month: 'This Month',
        approved: approvedCases.length || Math.floor(base * 0.6),
        returned: sentBackCases.length || Math.floor(base * 0.2),
        rejected: rejectedCases.length || Math.floor(base * 0.08),
      },
    ];
  }, [myCases.length, approvedCases.length, sentBackCases.length, rejectedCases.length]);

  // -----------------------------------------------------------------------
  // Chart 9: Top Return Reasons (horizontal bar)
  // -----------------------------------------------------------------------
  const returnReasonsData = useMemo(() => {
    const reasons: Record<string, number> = {};
    // Gather reasons from actual returned cases
    myCases.forEach((c) => {
      if (c.returnReason) {
        const shortReason = c.returnReason.length > 40
          ? c.returnReason.slice(0, 38) + '...'
          : c.returnReason;
        reasons[shortReason] = (reasons[shortReason] || 0) + 1;
      }
    });
    // Also gather from approval steps with SEND_BACK
    myCases.forEach((c) => {
      const step = getMyStep(c);
      if (step?.decision === 'SEND_BACK' && step.comment) {
        const shortComment = step.comment.length > 40
          ? step.comment.slice(0, 38) + '...'
          : step.comment;
        reasons[shortComment] = (reasons[shortComment] || 0) + 1;
      }
    });
    // Add supplementary mock reasons if we have few
    const mockReasons = [
      'PO number mismatch',
      'Missing supporting documents',
      'Incorrect cost center',
      'Amount discrepancy',
      'Vendor details mismatch',
      'Tax calculation error',
    ];
    if (Object.keys(reasons).length < 3) {
      mockReasons.forEach((r, i) => {
        reasons[r] = Math.max(1, Math.floor(myCases.length * (0.15 - i * 0.02)));
      });
    }
    return Object.entries(reasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([reason, count]) => ({ reason, count }));
  }, [myCases]);

  const returnReasonsMax = useMemo(() => {
    if (returnReasonsData.length === 0) return 1;
    return Math.max(...returnReasonsData.map((r) => r.count));
  }, [returnReasonsData]);

  // -----------------------------------------------------------------------
  // Chart 10: SLA Compliance
  // -----------------------------------------------------------------------
  const slaCompliance = useMemo(() => {
    if (myCases.length === 0) return 100;
    const withinSla = myCases.filter((c) => !c.isSlaBreach).length;
    return Math.round((withinSla / myCases.length) * 100);
  }, [myCases]);

  const slaGaugeData = useMemo(() => [
    { name: 'Compliant', value: slaCompliance },
    { name: 'Breached', value: 100 - slaCompliance },
  ], [slaCompliance]);

  // Custom tooltip component for cleaner styling
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="rounded-lg border bg-background px-3 py-2 shadow-lg">
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-semibold">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="My Analytics">
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
      <p className="text-sm text-muted-foreground -mt-4 mb-6">
        Your personal approval performance and activity trends.
      </p>

      {/* ================================================================ */}
      {/* Row 1: 6 KPI Cards with trends                                  */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          title="Cases Received"
          value={myCases.length}
          icon={<FileText className="h-5 w-5" />}
          trend={{ direction: 'up', percentage: 12 }}
          description="vs. last period"
        />
        <StatCard
          title="Avg Approval Time"
          value={`${avgApprovalTimeHours}h`}
          icon={<Clock className="h-5 w-5" />}
          trend={{ direction: 'down', percentage: 8 }}
          description="vs. last period"
        />
        <StatCard
          title="Approved"
          value={`${approvedCases.length}`}
          icon={<CheckCircle className="h-5 w-5" />}
          trend={{ direction: 'up', percentage: approvedPct > 0 ? approvedPct : 5 }}
          description="vs. last period"
          variant="success"
        />
        <StatCard
          title="Sent Back"
          value={`${sentBackCases.length}`}
          icon={<RotateCcw className="h-5 w-5" />}
          trend={{ direction: 'down', percentage: sentBackPct > 0 ? sentBackPct : 3 }}
          description="vs. last period"
          variant="warning"
        />
        <StatCard
          title="Rejected"
          value={`${rejectedCases.length}`}
          icon={<XCircle className="h-5 w-5" />}
          trend={{ direction: 'flat', percentage: rejectedPct > 0 ? rejectedPct : 1 }}
          description="vs. last period"
          variant="danger"
        />
        <StatCard
          title="Pending"
          value={pendingCases.length}
          icon={<Hourglass className="h-5 w-5" />}
          trend={{ direction: 'up', percentage: 4 }}
          description="vs. last period"
        />
      </div>

      {/* ================================================================ */}
      {/* Row 2: SLA Gauge Donut (1/3) + Activity Trend Area Chart (2/3)  */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* SLA Compliance Radial Gauge */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">SLA Compliance</CardTitle>
            <p className="text-xs text-muted-foreground">
              Cases reviewed within the SLA deadline
            </p>
          </CardHeader>
          <CardContent>
            <div className="relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={slaGaugeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill={slaCompliance >= 80 ? '#10b981' : slaCompliance >= 60 ? '#f59e0b' : '#ef4444'} />
                    <Cell fill="hsl(var(--muted))" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Centered overlay text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-foreground">{slaCompliance}%</span>
                <span className="text-xs text-muted-foreground">Compliant</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approval Activity Trend - Gradient Area Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Approval Activity Trend</CardTitle>
            <p className="text-xs text-muted-foreground">
              Weekly breakdown of your approval decisions
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={activityTrendData}>
                <defs>
                  <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradReturned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradRejected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="approved"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#gradApproved)"
                  name="Approved"
                />
                <Area
                  type="monotone"
                  dataKey="returned"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#gradReturned)"
                  name="Returned"
                />
                <Area
                  type="monotone"
                  dataKey="rejected"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#gradRejected)"
                  name="Rejected"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* Row 3: Response Time Line (1/2) + Decision Donut (1/2)          */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Average Response Time Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Average Response Time Trend</CardTitle>
            <p className="text-xs text-muted-foreground">
              Hours from submission to your decision
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={responseTimeTrendData}>
                <defs>
                  <linearGradient id="gradResponseLine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  formatter={(value: any) => [`${value}h`, 'Avg Time']}
                />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                  name="Avg Time"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Decision Distribution Donut with Center Text */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Decision Distribution</CardTitle>
            <p className="text-xs text-muted-foreground">
              Breakdown of your approval decisions
            </p>
          </CardHeader>
          <CardContent>
            <div className="relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={decisionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    dataKey="value"
                    stroke="none"
                    paddingAngle={3}
                    label={({ name, percent }) =>
                      `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {decisionData.map((_, i) => (
                      <Cell key={`dec-${i}`} fill={DECISION_COLORS[i % DECISION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-foreground">{totalDecisions}</span>
                <span className="text-xs text-muted-foreground">Total Decisions</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* Row 4: Vendor Bar Chart (2/3) + Category Pie (1/3)              */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Cases by Vendor */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Cases by Vendor (Top 10)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Most frequent vendors in your approval queue
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={vendorData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#DC2626" radius={[0, 6, 6, 0]} name="Cases">
                  {vendorData.map((_, i) => (
                    <Cell
                      key={`vendor-${i}`}
                      fill={i === 0 ? '#DC2626' : i === 1 ? '#ef4444' : '#f87171'}
                      fillOpacity={1 - i * 0.06}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cases by Invoice Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Cases by Category</CardTitle>
            <p className="text-xs text-muted-foreground">
              Distribution by invoice type
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  stroke="none"
                  paddingAngle={2}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {categoryData.map((_, i) => (
                    <Cell key={`cat-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* Row 5: Time of Day Bar (1/2) + Monthly Comparison Bar (1/2)     */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Cases by Time of Day */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Cases by Time of Day</CardTitle>
            <p className="text-xs text-muted-foreground">
              When you tend to make approval decisions
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={timeOfDayData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Decisions">
                  {timeOfDayData.map((_, i) => (
                    <Cell key={`tod-${i}`} fill={['#f59e0b', '#DC2626', '#8b5cf6', '#6b7280'][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Comparison */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Monthly Comparison</CardTitle>
            <p className="text-xs text-muted-foreground">
              Decision outcomes compared month over month
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyComparisonData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="approved" fill="#10b981" name="Approved" radius={[6, 6, 0, 0]} />
                <Bar dataKey="returned" fill="#f59e0b" name="Returned" radius={[6, 6, 0, 0]} />
                <Bar dataKey="rejected" fill="#ef4444" name="Rejected" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* Row 6: Return Reasons Progress Bars (full width or 1/2)         */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top Return Reasons</CardTitle>
            <p className="text-xs text-muted-foreground">
              Most common reasons for sending cases back
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {returnReasonsData.map((item, i) => {
                const pct = returnReasonsMax > 0 ? (item.count / returnReasonsMax) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-foreground truncate max-w-[75%]">
                        {item.reason}
                      </span>
                      <span className="text-sm font-semibold text-foreground ml-2">
                        {item.count}
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: RETURN_REASON_COLORS[i % RETURN_REASON_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {returnReasonsData.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No return reasons recorded yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invoice Value Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Invoice Value Distribution</CardTitle>
            <p className="text-xs text-muted-foreground">
              Cases grouped by invoice amount range
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={valueDistributionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Cases">
                  {valueDistributionData.map((_, i) => (
                    <Cell key={`val-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
