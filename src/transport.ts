import type { OutboundEventPayload, ResolvedConfig } from './types.js';
import { collectEnvironmentData, encodeEnvironmentData } from './environment.js';
import type { SessionManager } from './session.js';

export class Transport {
  private _q: OutboundEventPayload[] = [];
  private readonly _c: ResolvedConfig;
  private readonly _sm: SessionManager;
  private readonly _oo: () => boolean;
  private _halt = false;
  private _rau = 0;

  constructor(c: ResolvedConfig, sm: SessionManager, oo: () => boolean) { this._c = c; this._sm = sm; this._oo = oo; }

  enqueue(ev: OutboundEventPayload): void { if (this._q.length >= this._c.maxQueueSize) this._q.shift(); this._q.push(ev); }
  get queueLength(): number { return this._q.length; }
  isAtBatchThreshold(): boolean { return this._q.length >= this._c.maxBatchSize; }
  clearQueue(): void { this._q = []; }
  isHalted(): boolean { return this._halt; }
  getQueue(): OutboundEventPayload[] { return this._q; }

  async flush(): Promise<void> {
    if (this._oo() || this._halt || !this._q.length) return;
    if (this._rau > 0 && Date.now() < this._rau) return;
    this._rau = 0;
    await this._send(this._q.splice(0, this._c.maxBatchSize));
  }

  async flushAll(): Promise<void> {
    if (this._oo() || this._halt) return;
    if (this._rau > 0 && Date.now() < this._rau) return;
    while (this._q.length > 0) {
      await this._send(this._q.splice(0, this._c.maxBatchSize));
      if (this._halt) break;
      if (this._rau > 0 && Date.now() < this._rau) break;
    }
  }

  exitFlush(): boolean {
    if (this._oo() || !this._q.length) return false;
    let b = [...this._q]; this._q = [];
    let p = JSON.stringify(b);
    const e = new TextEncoder(); let tc = 0;
    while (e.encode(p).length > 65536 && b.length > 1) { b.pop(); tc++; p = JSON.stringify(b); }
    if (tc && this._c.debug) try { console.warn(`[Beacon] exit flush trimmed ${tc} events.`); } catch {}
    if (!b.length) return false;
    try { fetch(`${this._c.endpoint}/v1/events`, { method: 'POST', headers: this._h(), body: p, keepalive: true }).catch(() => {}); } catch {}
    return true;
  }

  private _h(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${this._c.apiKey}` };
    if (!this._sm.hasEnvironmentBeenSent()) {
      const d = collectEnvironmentData();
      if (d) { const v = encodeEnvironmentData(d); if (v) { h['X-Environment-Data'] = v; this._sm.markEnvironmentSent(); } }
    }
    return h;
  }

  private async _send(batch: OutboundEventPayload[]): Promise<void> {
    try {
      const r = await fetch(`${this._c.endpoint}/v1/events`, { method: 'POST', headers: this._h(), body: JSON.stringify(batch), keepalive: false });
      const s = r.status;
      if (s === 401) { try { console.error('Beacon: API key rejected (401). Check BeaconConfig.apiKey. Event delivery halted.'); } catch {} this._halt = true; this._q.unshift(...batch); return; }
      if (s === 402) { if (this._c.debug) try { console.warn('Beacon: account hard-capped (402). Events discarded.'); } catch {} return; }
      if (s === 429) {
        const ra = r.headers.get('Retry-After'); let sec = 30;
        if (ra) { const p = parseInt(ra, 10); if (!isNaN(p)) sec = Math.min(Math.max(p, 0), 60); }
        this._q = [...batch, ...this._q].slice(0, this._c.maxQueueSize);
        this._rau = Date.now() + sec * 1000;
        if (this._c.debug) try { console.warn(`Beacon: rate limited (429). Retrying after ${sec}s.`); } catch {}
        return;
      }
      if (s >= 500) { if (this._c.debug) try { console.warn(`Beacon: server error (${s}). Events discarded.`); } catch {} return; }
      if (s === 207 && this._c.debug) try { const b = await r.json(); if (b?.results) for (const x of b.results) if (x?.status !== 'accepted' && x?.event_id) console.warn(`[Beacon] Event ${x.event_id} rejected (207).`); } catch {}
      if (this._c.debug) try { console.debug(`[Beacon] Flushed ${batch.length} events.`); } catch {}
    } catch {}
  }
}
