import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { BoundingBox } from '@/types/case';

// Vite-compatible worker setup
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
  const [pages, setPages] = useState<{ num: number; width: number; height: number }[]>([]);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState(false);
  const canvasMapRef = useRef<Map<number, HTMLCanvasElement>>(new Map());

  // Load and render PDF
  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    (async () => {
      try {
        const pdf = await pdfjsLib.getDocument({ url, disableAutoFetch: true }).promise;
        if (cancelled) return;

        const container = containerRef.current;
        if (!container) return;

        const containerWidth = container.clientWidth || 500;
        const pageInfos: { num: number; width: number; height: number }[] = [];

        // Clear previous
        container.querySelectorAll('.pdf-page').forEach(el => el.remove());
        canvasMapRef.current.clear();

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          if (cancelled) return;

          const baseVp = page.getViewport({ scale: 1 });
          const s = containerWidth / baseVp.width;
          const vp = page.getViewport({ scale: s });

          if (i === 1) setScale(s);

          const wrapper = document.createElement('div');
          wrapper.className = 'pdf-page';
          wrapper.style.cssText = `position:relative;width:${vp.width}px;height:${vp.height}px;margin:0 auto 4px;`;
          wrapper.dataset.page = String(i);

          const canvas = document.createElement('canvas');
          canvas.width = vp.width * window.devicePixelRatio;
          canvas.height = vp.height * window.devicePixelRatio;
          canvas.style.cssText = `width:${vp.width}px;height:${vp.height}px;`;

          wrapper.appendChild(canvas);
          container.appendChild(wrapper);
          canvasMapRef.current.set(i, canvas);

          const ctx = canvas.getContext('2d')!;
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;

          pageInfos.push({ num: i, width: vp.width, height: vp.height });
        }

        setPages(pageInfos);
        setError(false);
      } catch (e) {
        console.warn('PdfViewer: failed to load PDF, falling back to iframe', e);
        if (!cancelled) setError(true);
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  // Draw highlight
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Remove old highlights
    container.querySelectorAll('.bbox-hl').forEach(el => el.remove());
    if (!activeBbox) return;

    const wrapper = container.querySelector(`[data-page="${activeBbox.page}"]`) as HTMLElement;
    if (!wrapper) return;

    const pw = parseFloat(wrapper.style.width);
    const ph = parseFloat(wrapper.style.height);

    const hl = document.createElement('div');
    hl.className = 'bbox-hl';
    hl.style.cssText = `
      position:absolute;
      left:${activeBbox.x * pw}px;
      top:${activeBbox.y * ph}px;
      width:${activeBbox.width * pw}px;
      height:${activeBbox.height * ph}px;
      background:rgba(255,213,0,0.35);
      border:2px solid rgba(255,170,0,0.9);
      border-radius:2px;
      pointer-events:none;
      z-index:5;
      animation:bboxPulse 3s ease-out forwards;
    `;
    wrapper.appendChild(hl);
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
          0% { background:rgba(255,213,0,0.5); box-shadow:0 0 12px rgba(255,170,0,0.6); }
          30% { background:rgba(255,213,0,0.25); }
          60% { background:rgba(255,213,0,0.4); }
          100% { background:rgba(255,213,0,0.2); box-shadow:none; }
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
