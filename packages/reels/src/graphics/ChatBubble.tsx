import React from 'react';

export const ChatBubble: React.FC<{ text: string; side?: 'left' | 'right' }> = ({ text, side = 'left' }) => (
  <div style={{ position: 'absolute', left: side === 'left' ? 70 : undefined, right: side === 'right' ? 70 : undefined, top: 480, maxWidth: 640 }}>
    <div style={{ backgroundColor: '#fff', borderRadius: 26, padding: '20px 28px', fontSize: 40, fontWeight: 700, color: '#101b31', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
      {text}
      <div style={{ position: 'absolute', bottom: -18, left: side === 'left' ? 60 : undefined, right: side === 'right' ? 60 : undefined, width: 0, height: 0, borderLeft: '18px solid transparent', borderRight: '18px solid transparent', borderTop: '22px solid #fff' }} />
    </div>
  </div>
);
