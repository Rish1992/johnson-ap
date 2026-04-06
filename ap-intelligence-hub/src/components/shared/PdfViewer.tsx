import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { BoundingBox } from '@/types/case';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

interface PdfViewerProps {
  url: string;
  activeBbox?: BoundingBox | null;
  className?: string;
}

export function PdfViewer({ url, activeBbox, className = '' }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const renderedRef = useRef(false);
  const pageWrappersRef = useRef<Map<number, { el: HTMLElement; w: number; h: number }>>(new Map());

  // Reset when URL changes so we re-render the new document
  useEffect(() => {
    renderedRef.current = false;
    pageWrappersRef.current.clear();
  }, [url]);

  // Load PDF — fetch as blob first to bypass CORS
  useEffect(() => {
    if (!url || renderedRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        // Fetch PDF as blob through same-origin proxy (bypasses CORS)
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);

        const pdf = await pdfjsLib.getDocument(blobUrl).promise;
        if (cancelled) { URL.revokeObjectURL(blobUrl); return; }

        const container = containerRef.current;
        if (!container) { URL.revokeObjectURL(blobUrl); return; }

        const containerWidth = container.clientWidth || 500;
        container.innerHTML = '';
        pageWrappersRef.current.clear();

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          if (cancelled) break;

          const baseVp = page.getViewport({ scale: 1 });
          const scale = containerWidth / baseVp.width;
          const vp = page.getViewport({ scale });

          const wrapper = document.createElement('div');
          wrapper.className = 'pdf-page';
          wrapper.style.cssText = `position:relative;width:${vp.width}px;height:${vp.height}px;margin:0 auto 4px;`;
          wrapper.dataset.page = String(i);

          const canvas = document.createElement('canvas');
          const dpr = window.devicePixelRatio || 1;
          canvas.width = vp.width * dpr;
          canvas.height = vp.height * dpr;
          canvas.style.cssText = `width:${vp.width}px;height:${vp.height}px;display:block;`;

          wrapper.appendChild(canvas);
          container.appendChild(wrapper);
          pageWrappersRef.current.set(i, { el: wrapper, w: vp.width, h: vp.height });

          const ctx = canvas.getContext('2d')!;
          ctx.scale(dpr, dpr);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
        }

        renderedRef.current = true;
        setError(false);
        URL.revokeObjectURL(blobUrl);
      } catch (e: unknown) {
        const err = e as Error;
        console.warn('PdfViewer: failed to render PDF, falling back to iframe', err?.message, err?.stack?.slice(0, 300));
        if (!cancelled) setError(true);
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  // Highlight active bbox
  useEffect(() => {
    // Remove old highlights
    pageWrappersRef.current.forEach(({ el }) => {
      el.querySelectorAll('.bbox-hl').forEach(h => h.remove());
    });

    if (!activeBbox) return;

    const pageInfo = pageWrappersRef.current.get(activeBbox.page);
    if (!pageInfo) return;

    const { el, w, h } = pageInfo;

    const hl = document.createElement('div');
    hl.className = 'bbox-hl';
    hl.style.cssText = `
      position:absolute;
      left:${activeBbox.x * w}px;
      top:${activeBbox.y * h}px;
      width:${Math.max(activeBbox.width * w, 20)}px;
      height:${Math.max(activeBbox.height * h, 12)}px;
      background:rgba(255,213,0,0.35);
      border:2px solid rgba(255,170,0,0.9);
      border-radius:3px;
      pointer-events:none;
      z-index:5;
      animation:bboxPulse 3s ease-out forwards;
      box-shadow:0 0 8px rgba(255,170,0,0.5);
    `;
    el.appendChild(hl);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeBbox]);

  if (error) {
    return (
      <iframe
        src={`${url}#toolbar=0&navpanes=0&scrollbar=0&zoom=page-width`}
        className={`w-full h-full border-0 ${className}`}
        title="Document"
      />
    );
  }

  return (
    <>
      <style>{`
        @keyframes bboxPulse {
          0% { background:rgba(255,213,0,0.5); box-shadow:0 0 12px rgba(255,170,0,0.7); }
          25% { background:rgba(255,213,0,0.2); box-shadow:0 0 4px rgba(255,170,0,0.3); }
          50% { background:rgba(255,213,0,0.4); box-shadow:0 0 8px rgba(255,170,0,0.5); }
          100% { background:rgba(255,213,0,0.15); box-shadow:none; }
        }
      `}</style>
      <div
        ref={containerRef}
        className={`overflow-auto bg-muted/30 ${className}`}
        style={{ minHeight: 0 }}
      />
    </>
  );
}
