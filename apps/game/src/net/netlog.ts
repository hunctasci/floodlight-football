/**
 * Privacy-safe multiplayer diagnostics.
 *
 * Best-practice notes (MDN WebRTC docs, RFC 8445 ICE / RFC 8489 STUN /
 * RFC 8656 TURN, bloggeek ICE-restart guide, uCopy NAT-traversal guide,
 * WebTraceCheck leak-test methodology):
 *
 * - Modern browsers mask local host candidates with ephemeral mDNS `.local`
 *   names. The remote peer must resolve them over multicast; same-PC
 *   cross-browser pairs (e.g. Safari + Chrome) are the hardest case because
 *   mDNS responders, hairpin NAT and AP isolation can all break the host
 *   path while srflx-only pairs fail without hairpin support. STUN gives
 *   srflx pairs; only a TURN relay is robust when both fail — this game
 *   ships STUN-only, so the log classifies candidate families to prove
 *   which paths were even attempted.
 * - `addIceCandidate` needs `sdpMid` or `sdpMLineIndex` (TypeError
 *   otherwise); both are always forwarded here.
 * - On `iceConnectionState === 'failed'` the standard recovery is ICE
 *   restart (`restartIce()` + re-offer); on `disconnected`, wait ~2s first.
 *   This client currently surfaces the failure instead of auto-restarting,
 *   so the log records the exact state transitions for the report.
 * - Privacy: classify in the browser, share categories/counts — never raw
 *   candidate IPs/ports, SDP bodies, or the room matchToken (WebTraceCheck
 *   methodology). Full candidate lines never enter this log.
 */

export type NetLogKind = 'signal' | 'sdp' | 'ice' | 'pc' | 'dc' | 'driver' | 'error' | 'info' | 'stats';

export interface NetLogEntry {
  at: number;
  kind: NetLogKind;
  msg: string;
}

const MAX_ENTRIES = 240;

class NetLog {
  entries: NetLogEntry[] = [];
  private t0 = 0;

  log(kind: NetLogKind, msg: string): void {
    const now = Date.now();
    if (!this.t0) this.t0 = now;
    this.entries.push({ at: now, kind, msg: msg.slice(0, 220) });
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
    if (netDebugEnabled()) {
      try {
        console.debug(`[net:${kind}] ${msg}`);
      } catch {
        /* console unavailable */
      }
    }
  }

  clear(): void {
    this.entries = [];
    this.t0 = 0;
  }

  dump(): string {
    return this.entries
      .map((e) => `[+${String(e.at - this.t0).padStart(6, ' ')}ms ${e.kind}] ${e.msg}`)
      .join('\n');
  }
}

export const netlog = new NetLog();

/** Opt-in verbose console mirror: `?debug=net` or localStorage floodlight-debug-net=1. */
export function netDebugEnabled(): boolean {
  try {
    if (typeof location !== 'undefined') {
      const q = new URLSearchParams(location.search);
      if (q.has('debug')) return true;
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('floodlight-debug-net') === '1';
    }
  } catch {
    /* private mode */
  }
  return false;
}

export type CandidateFamily = 'host' | 'srflx' | 'prflx' | 'relay' | 'unknown';

/** Classify `candidate:<...​> typ <family>` without storing the address. */
export function candidateFamily(candidate: string): CandidateFamily {
  const m = /\styp\s+(host|srflx|prflx|relay)\b/i.exec(candidate);
  return m ? (m[1].toLowerCase() as CandidateFamily) : 'unknown';
}

/** One-line redacted candidate summary: family + m-line only. Never IP/port. */
export function redactCandidate(c: {
  candidate?: unknown;
  sdpMid?: unknown;
  sdpMLineIndex?: unknown;
}): string {
  const raw = typeof c.candidate === 'string' ? c.candidate : '';
  const fam = raw ? candidateFamily(raw) : 'unknown';
  const mid = typeof c.sdpMid === 'string' ? c.sdpMid.slice(0, 16) : '';
  const idx =
    typeof c.sdpMLineIndex === 'number' && Number.isInteger(c.sdpMLineIndex) ? c.sdpMLineIndex : -1;
  const mdns = /\.local\b/i.test(raw) ? ' mdns' : '';
  return `typ=${fam}${mdns} mid=${mid || '?'} idx=${idx}`;
}

/** Short peer tag for logs: ephemeral 8-hex session ids are safe as-is. */
export function shortPeer(id: string): string {
  return id.slice(0, 8);
}
