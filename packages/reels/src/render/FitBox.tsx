import React from 'react';
import { LayoutProvider, useLayout } from './layout';

/**
 * Reflow a graphic designed on the 1080×1920 canvas into the current format:
 * the design band [top, bottom] must fit between the safe insets. Where it
 * already fits (9:16) nothing moves; otherwise it scales down uniformly
 * (≤ 1) around the frame centre line and lands at the safe top.
 */
export const FitBox: React.FC<{ top: number; bottom: number; children: React.ReactNode }> = ({ top, bottom, children }) => {
  const { width, height, safe } = useLayout();
  const availTop = safe.top;
  const availBottom = height - safe.bottom;
  // Children always lay out on the 9:16 design canvas.
  const inner = <LayoutProvider format="reel">{children}</LayoutProvider>;
  if (top >= availTop && bottom <= availBottom) return <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }}>{inner}</div>;
  const s = Math.min(1, (availBottom - availTop) / (bottom - top));
  const band = (bottom - top) * s;
  const y = availTop + Math.max(0, (availBottom - availTop - band) / 2) - top * s;
  const x = (width - 1080 * s) / 2;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${s})` }}>
      {inner}
    </div>
  );
};
