import { useEffect, useRef, useState, useCallback } from 'react';
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
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState(false);

  // Render PDF pages
  useEffect(() => {
    if (!url) return;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    (async () => {
      try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);
        setError(false);

        // Clear old canvases
        container.querySelectorAll('.pdf-page-wrapper').forEach(el => el.remove());
        canvasRefs.current.clear();

        const containerWidth = container.clientWidth || 600;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          if (cancelled) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          const wrapper = document.createElement('div');
          wrapper.className = 'pdf-page-wrapper';
          wrapper.style.position = 'relative';
          wrapper.style.width = `${viewport.width}px`;
          wrapper.style.height = `${viewport.height}px`;
          wrapper.style.marginBottom = '4px';
          wrapper.dataset.pageNum = String(i);

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);
          canvasRefs.current.set(i, canvas);

          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  // Highlight active bbox
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Remove old highlights
    container.querySelectorAll('.bbox-highlight').forEach(el => el.remove());

    if (!activeBbox) return;

    const wrapper = container.querySelector(
      `.pdf-page-wrapper[data-page-num="${activeBbox.page}"]`,
    ) as HTMLElement | null;
    if (!wrapper) return;

    const canvas = canvasRefs.current.get(activeBbox.page);
    if (!canvas) return;

    const w = canvas.width;
    const h = canvas.height;

    const highlight = document.createElement('div');
    highlight.className = 'bbox-highlight';
    highlight.style.cssText = `
      position: absolute;
      left: ${activeBbox.x * w}px;
      top: ${activeBbox.y * h}px;
      width: ${activeBbox.width * w}px;
      height: ${activeBbox.height * h}px;
      background: rgba(255, 213, 0, 0.3);
      border: 2px solid rgba(255, 170, 0, 0.8);
      border-radius: 2px;
      pointer-events: none;
      animation: bbox-pulse 2.5s ease-out forwards;
    `;
    wrapper.appendChild(highlight);

    // Scroll into view
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeBbox]);

  // Fallback to iframe on error
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
        @keyframes bbox-pulse {
          0% { background: rgba(255, 213, 0, 0.45); }
          30% { background: rgba(255, 213, 0, 0.2); }
          60% { background: rgba(255, 213, 0, 0.35); }
          100% { background: rgba(255, 213, 0, 0.15); }
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
