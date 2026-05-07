/**
 * Actor ID and Device ID management using localStorage.
 * Keys: `beacon_actor_id` (current actor), `beacon_device_id` (persistent anonymous ID).
 *
 * Before identify(), beacon_actor_id === beacon_device_id so anonymous events
 * and the identity link reference the same ID. identify() overwrites
 * beacon_actor_id but leaves beacon_device_id unchanged. reset() regenerates
 * both.
 */
import { generateUuidV7 } from './uuid.js';

const AK = 'beacon_actor_id';
const DK = 'beacon_device_id';
let lsOk: boolean | null = null;

function isLsOk(): boolean {
  if (lsOk !== null) return lsOk;
  try { localStorage.setItem('__b', '1'); localStorage.removeItem('__b'); lsOk = true; } catch { lsOk = false; }
  return lsOk;
}

/**
 * Loads or creates the device ID (persistent anonymous ID).
 * Also sets beacon_actor_id to match the device ID on first creation,
 * so pre-identify events use the device ID as actor_id.
 */
export function loadOrCreateActorId(now: number, debug: boolean): [string, boolean] {
  if (!isLsOk()) {
    if (debug) try { console.warn('[Beacon] localStorage unavailable \u2014 actor ID is ephemeral.'); } catch {}
    return [generateUuidV7(now, debug), true];
  }

  // Load or create device ID first — it's the stable anonymous ID
  let deviceId: string | null = null;
  try { deviceId = localStorage.getItem(DK); } catch {}
  if (!deviceId || deviceId.length === 0) {
    deviceId = generateUuidV7(now, debug);
    try { localStorage.setItem(DK, deviceId); } catch {}
  }

  // If actor ID already exists (e.g., from a previous identify()), use it
  try { const v = localStorage.getItem(AK); if (v && v.length > 0) return [v, false]; } catch {}

  // No actor ID stored — set it to the device ID so anonymous events match
  try { localStorage.setItem(AK, deviceId); } catch {}
  return [deviceId, false];
}

export function setActorId(userId: string): void { try { localStorage.setItem(AK, userId); } catch {} }

/**
 * Regenerates both device ID and actor ID. Called on reset().
 */
export function resetActorId(now: number, debug: boolean): string {
  try { localStorage.removeItem(AK); } catch {}
  try { localStorage.removeItem(DK); } catch {}
  const id = generateUuidV7(now, debug);
  try { localStorage.setItem(DK, id); } catch {}
  try { localStorage.setItem(AK, id); } catch {}
  return id;
}

/**
 * Returns the device ID from localStorage, or null if not set.
 */
export function getDeviceId(): string | null { try { return localStorage.getItem(DK); } catch { return null; } }

export function getStoredActorId(): string | null { try { return localStorage.getItem(AK); } catch { return null; } }
export function removeActorId(): void { try { localStorage.removeItem(AK); } catch {} }
export function removeDeviceId(): void { try { localStorage.removeItem(DK); } catch {} }
