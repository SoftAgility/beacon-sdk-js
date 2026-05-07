/**
 * UUID v7 generator per RFC 9562.
 */
let hasCR = false;
let fbw = false;
try { if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') hasCR = true; } catch {}

function rb(n: number, debug: boolean): Uint8Array {
  const b = new Uint8Array(n);
  if (hasCR) { crypto.getRandomValues(b); }
  else {
    if (debug && !fbw) { fbw = true; try { console.warn('[Beacon] crypto.getRandomValues() unavailable \u2014 using Math.random() fallback for UUID generation.'); } catch {} }
    for (let i = 0; i < n; i++) b[i] = Math.random() * 256 | 0;
  }
  return b;
}

const H: string[] = [];
for (let i = 0; i < 256; i++) H[i] = (i + 256).toString(16).substring(1);

export function generateUuidV7(now: number, debug: boolean): string {
  const r = rb(10, debug);
  const hi = (now / 0x100000000 | 0) & 0xffff, lo = now >>> 0;
  return H[hi >>> 8 & 255] + H[hi & 255] + H[lo >>> 24 & 255] + H[lo >>> 16 & 255] + '-' +
    H[lo >>> 8 & 255] + H[lo & 255] + '-' +
    H[0x70 | r[0] & 15] + H[r[1]] + '-' +
    H[0x80 | r[2] & 63] + H[r[3]] + '-' +
    H[r[4]] + H[r[5]] + H[r[6]] + H[r[7]] + H[r[8]] + H[r[9]];
}
