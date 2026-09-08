import type { DataTransport, TransportState } from './transport';

/** Reserved country matches use the room's binary WebSocket relay. The
 * simulation still runs deterministically on both clients; no public TURN
 * credentials or browser-to-browser network reachability are required. */
export class RoomTransport implements DataTransport {
  onmessage: ((data: Uint8Array) => void) | null = null;
  onstate: ((state: TransportState) => void) | null = null;
  state: TransportState = 'connecting';
  private socket: WebSocket;
  private constructor(socket: WebSocket) { this.socket = socket; }

  static connect(base: string, roomCode: string, peerId: string): Promise<{ transport: RoomTransport; matchToken: string }> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`${base.replace(/^http/, 'ws')}/api/rooms/${roomCode}/socket?clientId=${encodeURIComponent(peerId)}`);
      socket.binaryType = 'arraybuffer';
      const transport = new RoomTransport(socket);
      let joined = false;
      const timer = setTimeout(() => { transport.close(); reject(new Error('Connection timed out. Please try again.')); }, 12000);
      socket.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) { transport.onmessage?.(new Uint8Array(event.data)); return; }
        try {
          const message = JSON.parse(event.data);
          if (message.t === 'room-joined' && typeof message.matchToken === 'string' && !joined) {
            joined = true; clearTimeout(timer); transport.state = 'open';
            resolve({ transport, matchToken: message.matchToken });
          } else if (message.t === 'peer-left') {
            transport.close();
          } else if (message.t === 'error') {
            if (!joined) reject(new Error(message.message ?? 'Room unavailable'));
            transport.close();
          }
        } catch { /* Ignore malformed control messages. */ }
      };
      socket.onerror = () => { if (!joined) reject(new Error('Could not connect. Please try again.')); transport.close(); };
      socket.onclose = () => {
        clearTimeout(timer);
        if (!joined) reject(new Error('Room closed. Please find another match.'));
        transport.finish();
      };
    });
  }
  send(data: Uint8Array) {
    if (this.state !== 'open') return;
    if (this.socket.bufferedAmount > 1024 * 1024) { this.close(); return; }
    this.socket.send(data.slice().buffer);
  }
  private finish() {
    if (this.state === 'closed') return;
    this.state = 'closed'; this.onstate?.('closed');
  }
  close() { this.finish(); this.socket.close(); }
}
