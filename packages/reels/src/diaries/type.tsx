import React, { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

/** Documentary type: Barlow Condensed (titles) + Inter (small text), both OFL. */
export const DIARY_TYPE = {
  display: "'Barlow Condensed', 'Arial Narrow', sans-serif",
  text: "'Inter', system-ui, sans-serif",
};

const FONTS: [string, string, string][] = [
  ['Barlow Condensed', 'generated/diaries/fonts/BarlowCondensed-SemiBold.ttf', '600'],
  ['Barlow Condensed', 'generated/diaries/fonts/BarlowCondensed-Medium.ttf', '500'],
  ['Inter', 'generated/diaries/fonts/Inter.ttf', '100 900'],
];

let loaded: Promise<void> | undefined;

/** Blocks the render until the episode fonts are registered (once per page). */
export const useDiaryFonts = (): void => {
  const [handle] = useState(() => delayRender('diary fonts'));
  useEffect(() => {
    loaded ??= Promise.all(
      FONTS.map(async ([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(file)})`, { weight });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => undefined);
    loaded.then(() => continueRender(handle)).catch((e) => {
      console.error(e);
      continueRender(handle);
    });
  }, [handle]);
};
