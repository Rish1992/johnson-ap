import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileCode, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PromptTemplate {
  id: string;
  stepName: string;
  displayName: string;
  systemPrompt: string;
  outputSchema: Record<string, unknown> | null;
  version: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string | null;
}

const STEP_ORDER = ['classify', 'categorize', 'verify_docs', 'extract', 'validate'];

export function PromptEditor() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [selected, setSelected] = useState<PromptTemplate | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<number | null>(null); // version number on save success
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('@/lib/handlers').then(({ fetchPrompts }) => {
      fetchPrompts().then((data: PromptTemplate[]) => {
        setPrompts(data);
        // Auto-select first active prompt
        const first = STEP_ORDER
          .map(s => data.find(p => p.stepName === s && p.isActive))
          .find(Boolean);
        if (first) { setSelected(first); setDraft(first.systemPrompt); }
        setLoading(false);
      });
    });
  }, []);

  const activePrompts = STEP_ORDER
    .map(s => prompts.find(p => p.stepName === s && p.isActive))
    .filter(Boolean) as PromptTemplate[];

  const selectPrompt = (p: PromptTemplate) => {
    setSelected(p);
    setDraft(p.systemPrompt);
    setSaved(null);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaved(null);
    try {
      const { updatePrompt } = await import('@/lib/handlers');
      const updated: PromptTemplate = await updatePrompt(selected.id, { systemPrompt: draft });
      // Update local state
      setPrompts(prev => prev.map(p => p.id === selected.id ? { ...p, isActive: false } : p).concat(updated));
      setSelected(updated);
      setSaved(updated.version);
    } catch {
      // error handling
    } finally {
      setSaving(false);
    }
  };

  const dirty = selected ? draft !== selected.systemPrompt : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Prompt Editor" />
      <p className="text-sm text-muted-foreground -mt-4 mb-4">
        Edit AI pipeline prompts. Each save creates a new version.
      </p>

      <div className="grid grid-cols-[260px_1fr] gap-4">
        {/* Left panel — step list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pipeline Steps</CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-1">
            {activePrompts.map(p => (
              <button
                key={p.id}
                onClick={() => selectPrompt(p)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left',
                  selected?.stepName === p.stepName
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <span className="truncate">{p.displayName}</span>
                <Badge variant="outline" className={cn(
                  'ml-2 shrink-0 text-[10px]',
                  selected?.stepName === p.stepName && 'border-primary-foreground/30 text-primary-foreground'
                )}>
                  v{p.version}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Right panel — editor */}
        {selected ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-primary" />
                    {selected.displayName}
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    {saved && (
                      <span className="flex items-center gap-1 text-sm text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" /> Saved! Version {saved}
                      </span>
                    )}
                    <Button onClick={handleSave} disabled={saving || !dirty} size="sm">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Version {selected.version} &middot; by {selected.createdBy} &middot; {selected.createdAt ? new Date(selected.createdAt).toLocaleDateString() : 'unknown'}
                </p>
              </CardHeader>
              <CardContent>
                <textarea
                  value={draft}
                  onChange={e => { setDraft(e.target.value); setSaved(null); }}
                  rows={22}
                  className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  spellCheck={false}
                />
              </CardContent>
            </Card>

            {/* Output schema */}
            {selected.outputSchema && (
              <Collapsible>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
                        Output Schema
                        <span className="text-xs font-normal text-muted-foreground">(read-only)</span>
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto max-h-[400px] overflow-y-auto">
                        {JSON.stringify(selected.outputSchema, null, 2)}
                      </pre>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
          </div>
        ) : (
          <Card className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Select a step from the left panel
          </Card>
        )}
      </div>
    </div>
  );
}
