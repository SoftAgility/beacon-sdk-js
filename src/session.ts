import { generateUuidV7 } from './uuid.js';
import type { ResolvedConfig } from './types.js';
const SK = 'beacon_session_id', SSK = 'beacon_session_started_at';
let ssA: boolean | null = null;
function ssOk(): boolean { if (ssA !== null) return ssA; try { sessionStorage.setItem('__b', '1'); sessionStorage.removeItem('__b'); ssA = true; } catch { ssA = false; } return ssA; }

export class SessionManager {
  private _sid: string | null = null;
  private _la = 0;
  private readonly _c: ResolvedConfig;
  private _es = false;

  constructor(c: ResolvedConfig) { this._c = c; }
  hasActiveSession(): boolean { return this._sid !== null; }
  getSessionId(): string | null { return this._sid; }
  hasEnvironmentBeenSent(): boolean { return this._es; }
  markEnvironmentSent(): void { this._es = true; }
  isSessionExpired(now: number): boolean { return !!this._sid && this._la > 0 && (now - this._la) > this._c.sessionTimeoutMinutes * 60000; }
  touchActivity(now: number): void { this._la = now; }

  private _h(): HeadersInit { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this._c.apiKey}` }; }

  startSession(actorId: string, now: number): Promise<Response | void> {
    const sid = generateUuidV7(now, this._c.debug), sat = new Date(now).toISOString();
    this._sid = sid; this._la = now; this._es = false;
    if (ssOk()) try { sessionStorage.setItem(SK, sid); sessionStorage.setItem(SSK, sat); } catch {}
    else if (this._c.debug) try { console.warn('[Beacon] sessionStorage unavailable.'); } catch {}
    if (this._c.debug) try { console.debug(`[Beacon] Session started: ${sid}`); } catch {}
    return fetch(`${this._c.endpoint}/v1/events/sessions`, {
      method: 'POST', headers: this._h(), body: JSON.stringify({ session_id: sid, actor_id: actorId, source_app: this._c.sourceApp, source_version: this._c.sourceVersion, started_at: sat }),
    }).catch(() => {});
  }

  endSession(now: number, keepalive = false): Promise<Response | void> | void {
    if (!this._sid) return;
    const sid = this._sid; this._sid = null; this._la = 0;
    if (ssOk()) try { sessionStorage.removeItem(SK); sessionStorage.removeItem(SSK); } catch {}
    if (this._c.debug) try { console.debug(`[Beacon] Session ended: ${sid}`); } catch {}
    return fetch(`${this._c.endpoint}/v1/events/sessions/end`, {
      method: 'POST', headers: this._h(), body: JSON.stringify({ session_id: sid, ended_at: new Date(now).toISOString(), end_reason: 'normal' }), keepalive,
    }).catch(() => {});
  }

  clearSession(): void {
    this._sid = null; this._la = 0; this._es = false;
    if (ssOk()) try { sessionStorage.removeItem(SK); sessionStorage.removeItem(SSK); } catch {}
  }
}
