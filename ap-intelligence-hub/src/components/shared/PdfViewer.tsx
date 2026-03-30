import { useEffect, useRef, useState } from 'react';
import type { BoundingBox } from '@/types/case';

interface PdfViewerProps {
  url: string;
  activeBbox?: BoundingBox | null;
  className?: string;
}

/**
 * PDF viewer using iframe with bounding box highlight overlay.
 * Uses iframe for reliable PDF rendering, overlays highlights as absolute-positioned divs.
 * Bbox coordinates are normalized 0-1 (from backend bbox_locator).
 */
export function PdfViewer({ url, activeBbox, className = '' }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightKey, setHighlightKey] = useState(0);

  // Re-trigger animation when activeBbox changes
  useEffect(() => {
    setHighlightKey(prev => prev + 1);
  }, [activeBbox]);

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ minHeight: 0 }}>
      {/* PDF rendered via iframe — reliable, no worker issues */}
      <iframe
        src={`${url}#toolbar=0&navpanes=0&scrollbar=0&zoom=page-width`}
        className="w-full h-full border-0"
        title="Document"
      />

      {/* Bounding box highlight overlay */}
      {activeBbox && (
        <div
          key={highlightKey}
          style={{
            position: 'absolute',
            left: `${activeBbox.x * 100}%`,
            top: `${activeBbox.y * 100}%`,
            width: `${activeBbox.width * 100}%`,
            height: `${activeBbox.height * 100}%`,
            background: 'rgba(255, 213, 0, 0.35)',
            border: '2px solid rgba(255, 170, 0, 0.9)',
            borderRadius: '2px',
            pointerEvents: 'none',
            zIndex: 10,
            animation: 'bbox-pulse 3s ease-out forwards',
          }}
        />
      )}

      <style>{`
        @keyframes bbox-pulse {
          0% { background: rgba(255, 213, 0, 0.5); box-shadow: 0 0 8px rgba(255, 170, 0, 0.6); }
          30% { background: rgba(255, 213, 0, 0.25); }
          60% { background: rgba(255, 213, 0, 0.4); }
          100% { background: rgba(255, 213, 0, 0.2); box-shadow: none; }
        }
      `}</style>
    </div>
  );
}
