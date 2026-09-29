import React from 'react';
import { FORMATS, type FormatId, type SafeArea } from '../engine/formats';

/**
 * Frame layout for 2D layers: size, platform-safe area, and a `y()` helper
 * that maps a 9:16 design position (0..1920) into this format's height so
 * graphics designed once reflow for 4:5 and 1:1.
 */
export interface Layout {
  format: FormatId;
  width: number;
  height: number;
  safe: SafeArea;
  /** Uniform scale for tall full-frame graphics (1 on 9:16). */
  fit: number;
}

export function layoutFor(format: FormatId): Layout {
  const f = FORMATS[format];
  return { format, width: f.width, height: f.height, safe: f.safe, fit: Math.min(1, f.height / 1920 + 0.18) };
}

const Ctx = React.createContext<Layout>(layoutFor('reel'));

export const LayoutProvider: React.FC<{ format: FormatId; children: React.ReactNode }> = ({ format, children }) => (
  <Ctx.Provider value={React.useMemo(() => layoutFor(format), [format])}>{children}</Ctx.Provider>
);

export const useLayout = (): Layout => React.useContext(Ctx);
