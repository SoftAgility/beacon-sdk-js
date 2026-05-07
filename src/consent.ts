/**
 * Consent management: opt-out / opt-in via localStorage key `beacon_opted_out`.
 */
const OK = 'beacon_opted_out';
function sg(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function ss(k: string, v: string): void { try { localStorage.setItem(k, v); } catch {} }
function sr(k: string): void { try { localStorage.removeItem(k); } catch {} }

export function readOptOutFromStorage(): boolean { return sg(OK) === '1'; }
export function persistOptOut(): void { ss(OK, '1'); }
export function clearOptOut(): void { sr(OK); }
/** Clears identity and session storage but preserves the opt-out preference. */
export function clearIdentityStorage(): void {
  sr('beacon_actor_id'); sr('beacon_device_id');
  try { sessionStorage.removeItem('beacon_session_id'); sessionStorage.removeItem('beacon_session_started_at'); } catch {}
}
/** Clears ALL beacon storage including the opt-out flag (e.g. GDPR erasure). */
export function clearAllStorage(): void {
  sr(OK); clearIdentityStorage();
}
