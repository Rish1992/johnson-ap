import { useState, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  FlaskConical, Upload, X, FileText, Loader2,
  CheckCircle2, XCircle, ChevronDown, ExternalLink, Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PipelineStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  duration?: number;
  output?: unknown;
}

interface TestResult {
  type: 'backend' | 'frontend';
  steps: PipelineStep[];
  caseId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STEP_NAMES: Record<string, string> = {
  classify: 'Classify', categorize: 'Categorize', create_case: 'Create Case',
  verify_docs: 'Verify Docs', extract: 'Extract', validate: 'Validate',
};

const BASE = import.meta.env.VITE_API_BASE_URL || '/johnson-api';

function parseSteps(rawSteps: Array<Record<string, unknown>>): PipelineStep[] {
  return rawSteps.map((s) => ({
    name: STEP_NAMES[String(s.name || s.step || '')] || String(s.name || s.step || 'Unknown'),
    status: (s.status === 'running' ? 'running' : s.status === 'pending' ? 'pending' : s.status === 'failed' ? 'failed' : 'success') as PipelineStep['status'],
    duration: s.duration_ms ? +(Number(s.duration_ms) / 1000).toFixed(1) : undefined,
    output: (s.output || (s.error ? { error: s.error } : undefined)) as unknown,
  }));
}

async function callPlayground(
  endpoint: string,
  fromAddress: string, fromName: string, subject: string, body: string, files: File[],
  onStep: (steps: PipelineStep[], caseId?: string) => void,
): Promise<{ steps: PipelineStep[]; caseId?: string }> {
  const form = new FormData();
  form.append('from_address', fromAddress);
  form.append('from_name', fromName);
  form.append('subject', subject);
  form.append('body', body);
  files.forEach(f => form.append('files', f));

  // Submit job — returns immediately with jobId
  onStep([{ name: 'Submitting...', status: 'running' }]);
  const submitResp = await fetch(`${BASE}${endpoint}`, { method: 'POST', body: form });
  if (!submitResp.ok) throw new Error(`Server error: ${submitResp.status}`);
  const { jobId } = await submitResp.json();
  if (!jobId) throw new Error('No jobId returned');

  // Poll for status every 3s
  while (true) {
    await new Promise(r => setTimeout(r, 3000));
    const pollResp = await fetch(`${BASE}/api/jobs/${jobId}?_t=${Date.now()}`, { cache: 'no-store' });
    if (!pollResp.ok) throw new Error(`Poll error: ${pollResp.status}`);
    const job = await pollResp.json();

    const steps = parseSteps(job.steps || []);
    onStep(steps, job.caseId);

    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      return { steps, caseId: job.caseId };
    }
  }
}

// ---------------------------------------------------------------------------
// StepIndicator
// ---------------------------------------------------------------------------

function StepIndicator({ step }: { step: PipelineStep }) {
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
      <div className={cn(
        'h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all',
        step.status === 'pending' && 'border-muted-foreground/30 text-muted-foreground/40',
        step.status === 'running' && 'border-blue-500 text-blue-500 animate-pulse',
        step.status === 'success' && 'border-emerald-500 bg-emerald-500 text-white',
        step.status === 'failed' && 'border-red-500 bg-red-500 text-white',
      )}>
        {step.status === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
        {step.status === 'success' && <CheckCircle2 className="h-4 w-4" />}
        {step.status === 'failed' && <XCircle className="h-4 w-4" />}
        {step.status === 'pending' && <div className="h-2 w-2 rounded-full bg-current" />}
      </div>
      <span className="text-[11px] font-medium text-muted-foreground text-center whitespace-nowrap">{step.name}</span>
      {step.duration !== undefined && (
        <span className="text-[10px] text-muted-foreground/60">{step.duration}s</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function Playground() {
  const [fromAddress, setFromAddress] = useState('vendor@example.com');
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [loadingTestCase, setLoadingTestCase] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTestCase = useCallback(async () => {
    setLoadingTestCase(true);
    try {
      const resp = await fetch(`${BASE}/api/test-cases`);
      const cases = await resp.json();
      if (!cases.length) return;
      const tc = cases[0]; // Load first test case
      setFromAddress(tc.fromAddress);
      setFromName(tc.fromName);
      setSubject(tc.subject);
      setBody(tc.body);
      // Download the test files and convert to File objects
      const filePromises = tc.files.map(async (f: { name: string; url: string }) => {
        const fileResp = await fetch(`${BASE}${f.url}`);
        const blob = await fileResp.blob();
        return new File([blob], f.name, { type: 'application/pdf' });
      });
      const testFiles = await Promise.all(filePromises);
      setFiles(testFiles);
    } catch (err) {
      console.error('Failed to load test case:', err);
    } finally {
      setLoadingTestCase(false);
    }
  }, []);

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (newFiles) setFiles(prev => [...prev, ...Array.from(newFiles)]);
  }, []);

  const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index));

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const runTest = async (type: 'backend' | 'frontend') => {
    setRunning(true);
    setResult({ type, steps: [{ name: 'Starting...', status: 'running' }] });

    const endpoint = type === 'backend' ? '/api/playground/test-backend' : '/api/playground/test-frontend';

    try {
      const { steps, caseId } = await callPlayground(
        endpoint, fromAddress, fromName, subject, body, files,
        (liveSteps, liveCaseId) => setResult({ type, steps: liveSteps, caseId: liveCaseId }),
      );
      setResult({ type, steps, caseId });
    } catch (err) {
      setResult(prev => prev ? { ...prev, error: String(err) } : null);
    } finally {
      setRunning(false);
    }
  };

  const hasFailed = result?.steps.some(s => s.status === 'failed');

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Playground" />
        <p className="text-sm text-muted-foreground -mt-4 mb-2">
          Compose a test email and run it through the processing pipeline.
        </p>
      </div>

      {/* Email Compose */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              Compose Test Email
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadTestCase} disabled={loadingTestCase || running} className="gap-1.5 text-xs">
              {loadingTestCase ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
              Load Test Case
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">From Address</Label>
              <Input value={fromAddress} onChange={e => setFromAddress(e.target.value)} placeholder="vendor@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">From Name</Label>
              <Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="John Smith" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Invoice #12345 for services rendered" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Body</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Please find attached invoice..." />
          </div>

          {/* File Upload */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Attachments</Label>
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Drop files here or click to upload</p>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
            </div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted rounded-md px-3 py-1.5 text-sm">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate max-w-[200px]">{f.name}</span>
                    <span className="text-muted-foreground text-xs">({formatBytes(f.size)})</span>
                    <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button variant="outline" onClick={() => runTest('backend')} disabled={running} className="gap-2">
              {running && result?.type === 'backend' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Test Backend
            </Button>
            <Button onClick={() => runTest('frontend')} disabled={running} className="gap-2">
              {running && result?.type === 'frontend' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Test Frontend
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Pipeline Results
              {!running && !hasFailed && result.type === 'frontend' && result.caseId && (
                <span className="ml-3 text-sm font-normal text-emerald-600">
                  Case {result.caseId} created
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step Progress */}
            <div className="flex items-start justify-between gap-2 overflow-x-auto pb-2">
              {result.steps.map((step, i) => (
                <div key={step.name} className="flex items-start flex-1 min-w-0">
                  <div className="flex flex-col items-center w-full">
                    <div className="flex items-center w-full">
                      {i > 0 ? <div className={cn('flex-1 h-[2px]', step.status === 'success' ? 'bg-emerald-500' : 'bg-border')} /> : <div className="flex-1" />}
                      <StepIndicator step={step} />
                      {i < result.steps.length - 1 ? <div className={cn('flex-1 h-[2px]', step.status === 'success' ? 'bg-emerald-500' : 'bg-border')} /> : <div className="flex-1" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Collapsible JSON output for backend tests */}
            {result.type === 'backend' && result.steps.some(s => s.output) && (
              <div className="space-y-2">
                {result.steps.filter(s => s.output).map(step => (
                  <Collapsible key={step.name}>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary w-full text-left py-1">
                      <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
                      {step.name} Output
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto mt-1">
                        {JSON.stringify(step.output, null, 2)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}

            {/* Frontend success link */}
            {result.type === 'frontend' && !running && !hasFailed && result.caseId && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Case {result.caseId} created successfully.
                </span>
                <Link to="/admin/cases" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline ml-auto">
                  View in Case Dashboard <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {/* Error */}
            {result.error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                {result.error}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
