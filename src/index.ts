/**
 * @softagility/beacon-js — Browser usage event tracking SDK.
 */
import type {
  BeaconConfig, ResolvedConfig, OutboundEventPayload,
  ExceptionPayload, BreadcrumbEntry, ErrorSeverity, EventsApi,
} from './types.js';
import { generateUuidV7 } from './uuid.js';
import { readOptOutFromStorage, persistOptOut, clearOptOut, clearIdentityStorage } from './consent.js';
import { loadOrCreateActorId, setActorId, resetActorId, getDeviceId } from './identity.js';
import { SessionManager } from './session.js';
import { Transport } from './transport.js';
import { BreadcrumbRingBuffer } from './breadcrumbs.js';
import { EventDefinitionRegistry } from './event-definitions.js';
import { installPageViewHooks, removePageViewHooks } from './page-views.js';

export type { BeaconConfig, OutboundEventPayload, BreadcrumbEntry, ErrorSeverity, EventsApi } from './types.js';
export type { EventDefinition, EventManifest } from './types.js';

const W = typeof window !== 'undefined';
const DE = 'https://api.beacon.softagility.com';

function cl(v: number | undefined, lo: number, hi: number, d: number, f: string, dbg: boolean): number {
  if (v == null) return d;
  const n = typeof v === 'number' ? v : d;
  if (n < lo) { if (dbg) try { console.warn(`[Beacon] ${f} clamped to ${lo}.`); } catch {} return lo; }
  if (n > hi) { if (dbg) try { console.warn(`[Beacon] ${f} clamped to ${hi}.`); } catch {} return hi; }
  return n;
}

function rc(c: BeaconConfig): ResolvedConfig {
  const d = c.debug === true;
  return {
    apiKey: c.apiKey, sourceApp: c.sourceApp, sourceVersion: c.sourceVersion,
    sessionTimeoutMinutes: cl(c.sessionTimeoutMinutes, 1, 1440, 30, 'sessionTimeoutMinutes', d),
    autoPageViews: c.autoPageViews !== false,
    flushIntervalMs: cl(c.flushIntervalMs, 1000, 300000, 10000, 'flushIntervalMs', d),
    maxBatchSize: cl(c.maxBatchSize, 1, 1000, 50, 'maxBatchSize', d),
    endpoint: c.endpoint ? c.endpoint.replace(/\/+$/, '') : DE,
    debug: d, maxQueueSize: cl(c.maxQueueSize, 100, 10000, 5000, 'maxQueueSize', d),
    maxBreadcrumbs: cl(c.maxBreadcrumbs, 0, 200, 25, 'maxBreadcrumbs', d),
  };
}

function vc(c: BeaconConfig): void {
  if (!c.apiKey || typeof c.apiKey !== 'string') throw new TypeError('Beacon: apiKey is required.');
  if (!c.sourceApp || typeof c.sourceApp !== 'string') throw new TypeError('Beacon: sourceApp is required.');
  if (!c.sourceVersion || typeof c.sourceVersion !== 'string') throw new TypeError('Beacon: sourceVersion is required.');
  if (c.endpoint != null && c.endpoint !== '' && (typeof c.endpoint !== 'string' || (!c.endpoint.startsWith('https://') && !c.endpoint.startsWith('http://')))) {
    throw new TypeError('Beacon: endpoint must be a valid absolute URL beginning with https:// or http://.');
  }
}

function sp(p: Record<string, string | number | boolean> | undefined, d: boolean): Record<string, string | number | boolean> | undefined {
  if (!p || typeof p !== 'object') return undefined;
  const r: Record<string, string | number | boolean> = {};
  let n = 0;
  for (const k of Object.keys(p)) {
    if (n >= 20) break;
    if (k.length > 64) { if (d) try { console.warn(`[Beacon] Property "${k}" dropped.`); } catch {} continue; }
    const v = p[k], t = typeof v;
    if (t === 'string') { r[k] = (v as string).length > 256 ? (v as string).substring(0, 256) : v as string; n++; }
    else if (t === 'number' || t === 'boolean') { r[k] = v; n++; }
    else if (d) try { console.warn(`[Beacon] Property "${k}" dropped.`); } catch {}
  }
  return n > 0 ? r : undefined;
}

let inst: Beacon | null = null;

const NE: EventsApi = { define() {}, exportManifest() { return ''; } };
const NB = { events: NE, track() {}, trackError() {}, identify() {}, pageView() {}, async flush() {}, reset() {}, optOut() {}, optIn() {}, destroy() {}, getSessionId() { return null as string | null; }, getActorId() { return ''; }, _getConfig: () => null, _getTransport: () => null, _getBreadcrumbs: () => null, _getSessionManager: () => null, _isOptedOut: () => false };

export class Beacon {
  private readonly _c: ResolvedConfig;
  private _oo: boolean;
  private _aid: string;
  private _dead = false;
  private readonly _sm: SessionManager;
  private readonly _tr: Transport;
  private readonly _bc: BreadcrumbRingBuffer;
  private readonly _er: EventDefinitionRegistry;
  private _tid: ReturnType<typeof setInterval> | null = null;
  private _ef = false;
  private readonly _h1: () => void;
  private readonly _h2: () => void;
  private readonly _h3: (e: StorageEvent) => void;
  readonly events: EventsApi;

  private constructor(c: ResolvedConfig) {
    this._c = c;
    this._oo = readOptOutFromStorage();
    [this._aid] = loadOrCreateActorId(Date.now(), c.debug);
    this._sm = new SessionManager(c);
    this._tr = new Transport(c, this._sm, () => this._oo);
    this._bc = new BreadcrumbRingBuffer(c.maxBreadcrumbs);
    this._er = new EventDefinitionRegistry(c.sourceApp, c.debug);
    this.events = this._er.createApi();
    this._h1 = () => this._vis();
    this._h2 = () => this._bu();
    this._h3 = (e) => this._st(e);
    window.addEventListener('visibilitychange', this._h1);
    window.addEventListener('beforeunload', this._h2);
    window.addEventListener('storage', this._h3);
    if (!this._oo) { this._timer(); if (c.autoPageViews) { installPageViewHooks(() => this._apv()); this._ens(Date.now()); } }
    if (c.debug) try { console.debug(`[Beacon] Initialized. actorId=${this._aid}`); } catch {}
  }

  static init(config: BeaconConfig): Beacon {
    if (!W) return NB as unknown as Beacon;
    if (inst) { if (inst._c.debug) try { console.warn('Beacon: already initialized \u2014 init() call ignored.'); } catch {} return inst; }
    vc(config);
    inst = new Beacon(rc(config));
    return inst;
  }

  track(category: string, name: string, properties?: Record<string, string | number | boolean>): void {
    if (this._dead || this._oo) return;
    try {
      if (typeof category === 'string' && category.startsWith('_')) {
        if (this._c.debug) try { console.warn("[Beacon] Reserved category prefix '_' \u2014 ignored."); } catch {}
        return;
      }
      const t = Date.now(); this._ens(t);
      const s = sp(properties, this._c.debug);
      const cat = typeof category === 'string' ? category.substring(0, 128) : '';
      const nm = typeof name === 'string' ? name.substring(0, 256) : '';
      const ev = this._ev(t, cat, nm, s);
      this._tr.enqueue(ev);
      this._crumb(cat, nm, ev.timestamp, s);
      if (this._c.debug) try { console.debug(`[Beacon] track: ${cat}/${nm}`); } catch {}
      if (this._tr.isAtBatchThreshold()) this._tr.flush().catch(() => {});
    } catch (e) { if (this._c.debug) try { console.error('[Beacon] track error:', e); } catch {} }
  }

  trackError(error: Error | unknown, severity?: ErrorSeverity, properties?: Record<string, string | number | boolean>): void {
    if (this._dead || this._oo) return;
    try {
      if (!(error instanceof Error)) { if (this._c.debug) try { console.warn('[Beacon] trackError() requires Error instance.'); } catch {} return; }
      const t = Date.now(); this._ens(t); const e = error;
      const p: ExceptionPayload = {
        exception_id: generateUuidV7(t, this._c.debug), exception_type: e.name || 'Error',
        severity: severity === 'fatal' ? 'fatal' : 'non_fatal', occurred_at: new Date(t).toISOString(),
        actor_id: this._aid, source_app: this._c.sourceApp, source_version: this._c.sourceVersion,
      };
      if (e.message) p.message = e.message.substring(0, 1000);
      if (e.stack) p.stack_trace = e.stack.substring(0, 32768);
      const sid = this._sm.getSessionId(); if (sid) p.session_id = sid;
      if (this._bc.isEnabled() && this._bc.size > 0) p.breadcrumbs = this._bc.snapshot();
      if (this._c.debug) try { console.debug(`[Beacon] trackError: ${p.exception_type}`); } catch {}
      fetch(`${this._c.endpoint}/v1/events/exceptions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this._c.apiKey}` },
        body: JSON.stringify(p),
      }).catch(() => {});
    } catch (e) { if (this._c.debug) try { console.error('[Beacon] trackError error:', e); } catch {} }
  }

  identify(userId: string): void {
    if (this._dead || this._oo) return;
    try {
      if (!userId || typeof userId !== 'string') { if (this._c.debug) try { console.warn('[Beacon] identify() called with empty or invalid actorId \u2014 ignored.'); } catch {} return; }
      this._ens(Date.now());
      const previousAid = this._aid;
      this._aid = userId; setActorId(userId);
      if (this._c.debug) try { console.debug(`[Beacon] Identified: ${userId}`); } catch {}

      // Fire best-effort identify POST if this is a new identification (not re-identify)
      if (previousAid !== userId) {
        const deviceId = getDeviceId();
        if (deviceId) {
          fetch(`${this._c.endpoint}/v1/actors/identify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this._c.apiKey}` },
            body: JSON.stringify({
              anonymous_actor_id: deviceId,
              identified_actor_id: userId,
              identified_at: new Date().toISOString(),
              source_app: this._c.sourceApp,
              source_version: this._c.sourceVersion,
            }),
          }).then(res => {
            if (res.status === 409) {
              try { console.warn(`[Beacon] device ID ${deviceId} is already linked to a different user. Identity link not recorded.`); } catch {}
            }
          }).catch(() => {});
        }
      }
    } catch (e) { if (this._c.debug) try { console.error('[Beacon] identify error:', e); } catch {} }
  }

  pageView(url?: string, properties?: Record<string, string | number | boolean>): void {
    if (this._dead || this._oo) return;
    try {
      const t = Date.now(); this._ens(t);
      const u = url || window.location.pathname;
      const m: Record<string, string | number | boolean> = { url: u, title: document.title, referrer: document.referrer, ...(properties || {}) };
      const s = sp(m, this._c.debug);
      const ev = this._ev(t, 'navigation', 'page_view', s);
      this._tr.enqueue(ev);
      this._crumb('navigation', 'page_view', ev.timestamp, s);
      if (this._c.debug) try { console.debug(`[Beacon] pageView: ${u}`); } catch {}
      if (this._tr.isAtBatchThreshold()) this._tr.flush().catch(() => {});
    } catch (e) { if (this._c.debug) try { console.error('[Beacon] pageView error:', e); } catch {} }
  }

  async flush(): Promise<void> {
    if (this._dead || this._oo) return;
    try { await this._tr.flushAll(); } catch {}
  }

  reset(): void {
    if (this._dead) return;
    try {
      if (this._sm.hasActiveSession()) this._sm.endSession(Date.now(), true);
      this._tr.clearQueue(); this._bc.clear();
      this._aid = resetActorId(Date.now(), this._c.debug);
      this._sm.clearSession();
      if (this._c.debug) try { console.debug(`[Beacon] Reset. actorId=${this._aid}`); } catch {}
    } catch (e) { if (this._c.debug) try { console.error('[Beacon] reset error:', e); } catch {} }
  }

  optOut(): void {
    if (this._dead) return;
    try { this._oo = true; persistOptOut(); this._tr.clearQueue(); this._bc.clear(); if (this._c.debug) try { console.debug('[Beacon] Opted out.'); } catch {} }
    catch (e) { if (this._c.debug) try { console.error('[Beacon] optOut error:', e); } catch {} }
  }

  optIn(): void {
    if (this._dead) return;
    try { this._oo = false; clearOptOut(); if (!this._tid) this._timer(); if (this._c.debug) try { console.debug('[Beacon] Opted in.'); } catch {} }
    catch (e) { if (this._c.debug) try { console.error('[Beacon] optIn error:', e); } catch {} }
  }

  destroy(): void {
    if (this._dead) return;
    try {
      this._dead = true;
      if (this._tid !== null) { clearInterval(this._tid); this._tid = null; }
      window.removeEventListener('visibilitychange', this._h1);
      window.removeEventListener('beforeunload', this._h2);
      window.removeEventListener('storage', this._h3);
      removePageViewHooks(); clearIdentityStorage();
      this._tr.clearQueue(); this._bc.clear(); this._er.clear();
      inst = null;
    } catch {}
  }

  getSessionId(): string | null { return this._dead ? null : this._sm.getSessionId(); }
  getActorId(): string { return this._dead ? '' : this._aid; }

  // --- private ---
  private _ev(t: number, cat: string, nm: string, props?: Record<string, string | number | boolean>): OutboundEventPayload {
    const ev: OutboundEventPayload = { event_id: generateUuidV7(t, this._c.debug), category: cat, name: nm, timestamp: new Date(t).toISOString(), actor_id: this._aid, source_app: this._c.sourceApp, source_version: this._c.sourceVersion };
    const sid = this._sm.getSessionId(); if (sid) ev.session_id = sid;
    if (props) ev.properties = props;
    return ev;
  }

  private _crumb(cat: string, nm: string, ts: string, p?: Record<string, string | number | boolean>): void {
    if (!this._bc.isEnabled()) return;
    const c: BreadcrumbEntry = { category: cat, name: nm, timestamp: ts };
    if (p) c.properties = p;
    this._bc.append(c);
  }

  private _pv(t: number): void {
    if (!this._c.autoPageViews) return;
    const u = window.location.pathname;
    const s = sp({ url: u, title: document.title, referrer: document.referrer }, this._c.debug);
    const ev = this._ev(t, 'navigation', 'page_view', s);
    this._tr.enqueue(ev);
    this._crumb('navigation', 'page_view', ev.timestamp, s);
  }

  private _ens(t: number): void {
    if (this._sm.hasActiveSession()) {
      if (this._sm.isSessionExpired(t)) { this._sm.endSession(t, false); this._sm.startSession(this._aid, t).catch(() => {}); this._pv(t); }
      else this._sm.touchActivity(t);
      return;
    }
    this._sm.startSession(this._aid, t).catch(() => {});
    if (this._c.autoPageViews) this._pv(t);
  }

  private _apv(): void {
    if (this._dead || this._oo) return;
    try {
      const t = Date.now(); this._ens(t);
      const u = window.location.pathname;
      const s = sp({ url: u, title: document.title, referrer: document.referrer }, this._c.debug);
      const ev = this._ev(t, 'navigation', 'page_view', s);
      this._tr.enqueue(ev);
      this._crumb('navigation', 'page_view', ev.timestamp, s);
      if (this._tr.isAtBatchThreshold()) this._tr.flush().catch(() => {});
    } catch {}
  }

  private _vis(): void {
    if (this._dead) return;
    try {
      if (document.visibilityState === 'hidden') { if (!this._oo && this._tr.exitFlush()) this._ef = true; }
      else if (document.visibilityState === 'visible') this._ef = false;
    } catch {}
  }

  private _bu(): void {
    if (this._dead || this._oo) return;
    try {
      if (!this._ef) this._tr.exitFlush();
      if (this._sm.hasActiveSession()) this._sm.endSession(Date.now(), true);
    } catch {}
  }

  private _st(ev: StorageEvent): void {
    if (this._dead || ev.key !== 'beacon_opted_out') return;
    try {
      if (ev.newValue === '1') { this._oo = true; this._tr.clearQueue(); this._bc.clear(); }
      else if (ev.newValue === null) { this._oo = false; if (!this._tid) this._timer(); }
    } catch {}
  }

  private _timer(): void {
    if (this._tid !== null) return;
    this._tid = setInterval(() => { if (!this._oo && !this._dead) this._tr.flush().catch(() => {}); }, this._c.flushIntervalMs);
  }

  // --- test accessors ---
  _getConfig(): ResolvedConfig { return this._c; }
  _getTransport(): Transport { return this._tr; }
  _getBreadcrumbs(): BreadcrumbRingBuffer { return this._bc; }
  _getSessionManager(): SessionManager { return this._sm; }
  _isOptedOut(): boolean { return this._oo; }
  static _resetSingleton(): void { inst = null; }
}
