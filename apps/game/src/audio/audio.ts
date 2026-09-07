import type { GameEvent } from '../types';

/** Tiny original synthesised match soundscape. No samples or music files. */
export class MatchAudio {
  private ctx: AudioContext | null = null;
  private muted = localStorage.getItem('floodlight-muted') === '1';
  private ambience: OscillatorNode | null = null;
  get isMuted() { return this.muted; }
  enable() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (!this.ambience && !this.muted) this.startAmbience();
  }
  toggle() { this.muted = !this.muted; localStorage.setItem('floodlight-muted', this.muted ? '1' : '0'); if (this.muted) this.stopAmbience(); else { this.enable(); this.startAmbience(); } return this.muted; }
  private tone(freq: number, seconds: number, type: OscillatorType, volume: number, slide = 1) {
    const c = this.ctx; if (!c || this.muted) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, c.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(25, freq * slide), c.currentTime + seconds);
    g.gain.setValueAtTime(volume, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + seconds); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + seconds);
  }
  private noise(seconds: number, volume: number) {
    const c = this.ctx; if (!c || this.muted) return;
    const b = c.createBuffer(1, Math.max(1, c.sampleRate * seconds), c.sampleRate), d = b.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1-i/d.length);
    const s=c.createBufferSource(), g=c.createGain(); s.buffer=b; g.gain.value=volume; s.connect(g).connect(c.destination); s.start();
  }
  private startAmbience() { const c=this.ctx; if (!c || this.muted || this.ambience) return; const o=c.createOscillator(),g=c.createGain(); o.type='triangle';o.frequency.value=75;g.gain.value=.008;o.connect(g).connect(c.destination);o.start();this.ambience=o; }
  private stopAmbience(){ this.ambience?.stop();this.ambience=null; }
  event(e: GameEvent) { this.enable(); switch(e.type) { case 'kick': this.tone(160,.07,'square',.045,.55); break; case 'shot': { const p=e.power??28; this.noise(.08,.05); this.tone(95+p*1.4,.18,'sawtooth',.055+Math.min(.05,p*.0011),2.2); break; } case 'tackle': { if (e.slide) { this.noise(.22,.1); this.tone(85,.1,'square',.06,.45); } else this.noise(.11,.09); break; } case 'save': this.tone(260,.12,'square',.06,.55); break; case 'post': this.tone(790,.28,'sine',.09,.9); break; case 'goal': this.noise(.5,.12); this.tone(300,.7,'sawtooth',.075,2.8); break; case 'whistle': this.tone(1500,.22,'sine',.08,.98); break; case 'restart': this.tone(420,.08,'triangle',.04,1.2); } }
}
