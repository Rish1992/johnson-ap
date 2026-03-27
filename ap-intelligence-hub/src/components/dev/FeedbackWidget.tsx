import { useEffect, useRef, useState, useCallback } from 'react';
import { Flag, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { useAuthStore } from '@/stores/authStore';
import { useCaseStore } from '@/stores/caseStore';

type Severity = 'critical' | 'high' | 'minor' | 'cosmetic';
type ReportType = 'bug' | 'enhancement' | 'question';

interface QAReport {
  id: string;
  timestamp: string;
  user: string;
  userRole: string;
  page: string;
  element: string;
  clickX: number;
  clickY: number;
  viewport: string;
  userAgent: string;
  caseId?: string;
  caseStatus?: string;
  caseVendor?: string;
  caseCategory?: string;
  invoiceNumber?: string;
  screenshotPath?: string;
  consoleLogs: string[];
  networkLogs: string[];
  comment: string;
  severity: Severity;
  type: ReportType;
  expectedBehavior?: string;
  status: 'open';
}

function getSelector(el: HTMLElement): string {
  if (el.dataset.testid) return `[data-testid="${el.dataset.testid}"]`;
  const parts: string[] = [];
  let current: HTMLElement | null = el;
  for (let i = 0; i < 3 && current && current !== document.body; i++) {
    let part = current.tagName.toLowerCase();
    if (current.id) { part += `#${current.id}`; parts.unshift(part); break; }
    if (current.className && typeof current.className === 'string') {
      part += '.' + current.className.trim().split(/\s+/).slice(0, 2).join('.');
    }
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

function extractCaseId(pathname: string): string | undefined {
  const match = pathname.match(/\/cases?\/([^/]+)/);
  return match?.[1];
}

export function FeedbackWidget() {
  const [fab, setFab] = useState<{ x: number; y: number } | null>(null);
  const [panel, setPanel] = useState<{ x: number; y: number; element: string } | null>(null);
  const [comment, setComment] = useState('');
  const [severity, setSeverity] = useState<Severity>('high');
  const [reportType, setReportType] = useState<ReportType>('bug');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [showExpected, setShowExpected] = useState(false);
  const [includeLogs, setIncludeLogs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>();
  const clickRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const consoleLogRef = useRef<string[]>([]);
  const networkLogRef = useRef<string[]>([]);

  const closeFab = useCallback(() => { setFab(null); clearTimeout(dismissTimer.current); }, []);
  const closePanel = useCallback(() => {
    setPanel(null); setComment(''); setExpectedBehavior(''); setShowExpected(false);
    setSeverity('high'); setReportType('bug'); setIncludeLogs(true);
  }, []);

  // Auto-toggle includeLogs when type changes
  useEffect(() => {
    setIncludeLogs(reportType === 'bug');
  }, [reportType]);

  // Intercept console (log/warn/error) and all network requests with timing
  useEffect(() => {
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;
    const capture = (level: string) => (...args: unknown[]) => {
      const msg = `[${level}] ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}`;
      consoleLogRef.current = [...consoleLogRef.current.slice(-19), msg];
    };
    console.log = (...args: unknown[]) => { capture('LOG')(...args); origLog.apply(console, args); };
    console.warn = (...args: unknown[]) => { capture('WARN')(...args); origWarn.apply(console, args); };
    console.error = (...args: unknown[]) => { capture('ERROR')(...args); origError.apply(console, args); };

    const origFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      if (url.includes('/api/feedback')) return origFetch(...args); // don't log our own requests
      const start = performance.now();
      try {
        const res = await origFetch(...args);
        const ms = Math.round(performance.now() - start);
        networkLogRef.current = [...networkLogRef.current.slice(-9), `${res.status} ${ms}ms ${url}`];
        return res;
      } catch (err) {
        const ms = Math.round(performance.now() - start);
        networkLogRef.current = [...networkLogRef.current.slice(-9), `ERR ${ms}ms ${url}`];
        throw err;
      }
    };

    return () => { console.log = origLog; console.warn = origWarn; console.error = origError; window.fetch = origFetch; };
  }, []);

  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      clickRef.current = { x: e.clientX, y: e.clientY };
      const selector = getSelector(e.target as HTMLElement);
      (window as any).__fb_sel = selector;
      clearTimeout(dismissTimer.current);
      const fabX = Math.max(8, e.clientX - 140);
      const fabY = Math.max(8, e.clientY - 44);
      setTimeout(() => setFab({ x: fabX, y: fabY }), 120);
      dismissTimer.current = setTimeout(() => setFab(null), 5000);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) return;
      if ((e.target as HTMLElement).closest('[data-feedback-widget]')) return;
      closeFab();
    };

    document.addEventListener('contextmenu', onContext);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('mousedown', onMouseDown);
      clearTimeout(dismissTimer.current);
    };
  }, [closeFab]);

  const openPanel = () => {
    closeFab();
    const { x, y } = clickRef.current;
    setPanel({ x: Math.min(x, window.innerWidth - 320), y: Math.min(y, window.innerHeight - 300), element: (window as any).__fb_sel || 'unknown' });
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      // Capture screenshot — wrapped defensively, cross-origin CSS can cause SecurityError
      let screenshotBase64: string | undefined;
      try {
        const capturePromise = toPng(document.body, {
          quality: 0.7,
          skipFonts: true,
          filter: (node: Node) => {
            if (node instanceof HTMLElement && node.dataset.feedbackWidget) return false;
            return true;
          },
        }).catch(() => undefined);
        const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 3000));
        screenshotBase64 = await Promise.race([capturePromise, timeout]);
      } catch {
        screenshotBase64 = undefined;
      }

      const authUser = useAuthStore.getState().user;
      const currentCase = useCaseStore.getState().selectedCase;
      const caseId = extractCaseId(window.location.pathname);

      const report: QAReport = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        user: authUser?.fullName || 'unknown',
        userRole: authUser?.role || 'unknown',
        page: window.location.pathname,
        element: panel!.element,
        clickX: clickRef.current.x,
        clickY: clickRef.current.y,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        userAgent: navigator.userAgent,
        caseId,
        caseStatus: caseId ? currentCase?.status : undefined,
        caseVendor: caseId ? currentCase?.vendorName : undefined,
        caseCategory: caseId ? currentCase?.category : undefined,
        invoiceNumber: caseId ? currentCase?.invoiceNumber : undefined,
        consoleLogs: includeLogs ? consoleLogRef.current.slice() : [],
        networkLogs: includeLogs ? networkLogRef.current.slice() : [],
        comment,
        severity,
        type: reportType,
        expectedBehavior: expectedBehavior.trim() || undefined,
        status: 'open',
      };

      // Try POST to Vite middleware, fall back to localStorage
      let saved = false;
      try {
        const res = await window.fetch('/johnson-api/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report, screenshot: screenshotBase64 }),
        });
        saved = res.ok;
      } catch { /* server not available */ }

      if (!saved) {
        // localStorage fallback
        const existing: QAReport[] = JSON.parse(localStorage.getItem('feedback-items') || '[]');
        existing.push(report);
        localStorage.setItem('feedback-items', JSON.stringify(existing));
      }

      toast.success('Issue reported');
      closePanel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {fab && (
        <div
          data-feedback-widget
          className="fixed z-[9999] flex items-center gap-1.5 rounded-lg bg-neutral-900/90 px-3 py-1.5 text-xs text-white shadow-lg cursor-pointer hover:bg-neutral-800 animate-in fade-in duration-200"
          style={{ left: fab.x, top: fab.y }}
          onClick={openPanel}
        >
          <Flag className="size-3.5" />
          Report Issue
        </div>
      )}
      {panel && (
        <div
          data-feedback-widget
          className="fixed z-[9999] w-[300px] rounded-xl border bg-popover p-3 shadow-xl animate-in fade-in duration-200"
          style={{ left: panel.x, top: panel.y }}
        >
          <div className="flex gap-2 mb-2">
            <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
              <SelectTrigger size="sm" className="flex-1 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[10000]">
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="minor">Minor</SelectItem>
                <SelectItem value="cosmetic">Cosmetic</SelectItem>
              </SelectContent>
            </Select>
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger size="sm" className="flex-1 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[10000]">
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="enhancement">Enhancement</SelectItem>
                <SelectItem value="question">Question</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={includeLogs} onCheckedChange={(v) => setIncludeLogs(!!v)} className="h-3.5 w-3.5" />
            Include console &amp; network activity
          </label>
          <Textarea
            rows={3}
            placeholder="Describe the issue..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mb-2 min-h-0 text-sm"
            autoFocus
          />
          {!showExpected ? (
            <button
              type="button"
              onClick={() => setShowExpected(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
            >
              <ChevronDown className="size-3" /> Add expected behavior
            </button>
          ) : (
            <Textarea
              rows={2}
              placeholder="What should have happened?"
              value={expectedBehavior}
              onChange={(e) => setExpectedBehavior(e.target.value)}
              className="mb-2 min-h-0 text-xs"
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={closePanel}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={submit} disabled={!comment.trim() || submitting}>
              {submitting ? 'Capturing...' : 'Report'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
