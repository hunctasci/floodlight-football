import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

export type CaptionPreset = 'subtitle' | 'impact' | 'word-pop' | 'meme' | 'sports' | 'retro' | 'breaking-news';

const PRESET_STYLE: Record<CaptionPreset, React.CSSProperties> = {
  subtitle: { fontSize: 44, fontWeight: 500, color: '#fff', backgroundColor: 'rgba(0,0,0,0.65)', padding: '10px 22px', borderRadius: 12 },
  impact: { fontSize: 84, fontWeight: 900, color: '#fff', WebkitTextStroke: '3px #000', textShadow: '0 6px 0 #000, 0 10px 30px rgba(0,0,0,0.6)', fontFamily: 'Impact, Arial Black, sans-serif' },
  'word-pop': { fontSize: 72, fontWeight: 900, color: '#ffea00', WebkitTextStroke: '2px #000', textShadow: '0 5px 0 #000', fontFamily: 'Impact, Arial Black, sans-serif' },
  meme: { fontSize: 56, fontWeight: 900, color: '#fff', WebkitTextStroke: '2px #000', textShadow: '0 4px 0 #000', fontFamily: 'Impact, Arial Black, sans-serif' },
  sports: { fontSize: 64, fontWeight: 900, color: '#fff', backgroundColor: '#101b31', padding: '12px 28px', borderLeft: '10px solid #f8cc54', fontStyle: 'italic' },
  retro: { fontSize: 60, fontWeight: 900, color: '#f8cc54', textShadow: '3px 3px 0 #e30a17, 6px 6px 0 #101b31', fontFamily: 'Impact, Arial Black, sans-serif' },
  'breaking-news': { fontSize: 52, fontWeight: 800, color: '#fff', backgroundColor: '#c00', padding: '10px 24px', letterSpacing: 2 },
};

/** Semantic caption: preset owns typography/animation/safe-area. Deterministic in frame. */
export const Caption: React.FC<{
  text: string;
  preset?: string;
  startFrame?: number;
  durationInFrames?: number;
  /** Absolute global frame. Defaults to useCurrentFrame() outside Sequences. */
  frame?: number;
}> = ({ text, preset = 'subtitle', startFrame = 0, durationInFrames = 60, frame: frameProp }) => {
  const hookFrame = useCurrentFrame();
  const frame = frameProp ?? hookFrame;
  const local = frame - (startFrame ?? 0);
  if (local < 0 || local >= (durationInFrames ?? 60)) return null;
  const style = PRESET_STYLE[(preset as CaptionPreset) ?? 'subtitle'] ?? PRESET_STYLE.subtitle;
  const pop = preset === 'word-pop' || preset === 'impact' || preset === 'meme'
    ? interpolate(local, [0, 6], [0.6, 1.08], { extrapolateRight: 'clamp' })
    : 1;
  const scale = local > 6 && (preset === 'word-pop' || preset === 'impact')
    ? interpolate(local, [6, 12], [1.08, 1], { extrapolateRight: 'clamp' })
    : pop;
  const opacity = interpolate(local, [(durationInFrames ?? 60) - 8, (durationInFrames ?? 60) - 1], [1, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1180, display: 'flex', justifyContent: 'center', padding: '0 60px', opacity }}>
      <div style={{ ...style, transform: `scale(${scale})`, textAlign: 'center', lineHeight: 1.1, maxWidth: 960 }}>{text}</div>
    </div>
  );
};
