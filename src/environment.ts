import type { BrowserEnvironmentData } from './types.js';
export function collectEnvironmentData(): BrowserEnvironmentData | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  try {
    const ua = navigator.userAgent || '', vw = window.innerWidth || 0;
    let bn = 'Unknown', bv = '0';
    for (const [n, r] of [['Edge',/Edg\w*\/(\d+)/],['Opera',/OPR\/(\d+)/],['Chrome',/Chrome\/(\d+)/],['Firefox',/Firefox\/(\d+)/],['Safari',/Version\/(\d+).*Safari/]] as [string,RegExp][]) {
      const m = ua.match(r); if (m) { bn = n; bv = m[1]; break; }
    }
    const d: BrowserEnvironmentData = {
      browser_name: bn, browser_version: bv,
      screen_width: screen.width || 0, screen_height: screen.height || 0,
      viewport_width: vw, viewport_height: window.innerHeight || 0,
      language: navigator.language || 'unknown',
      device_type: vw < 768 ? 'mobile' : vw < 1024 ? 'tablet' : 'desktop',
      platform: (navigator as any).userAgentData?.platform || navigator.platform || 'unknown',
    };
    const ct = (navigator as any).connection?.effectiveType;
    if (ct) d.connection_type = ct;
    return d;
  } catch { return null; }
}
export function encodeEnvironmentData(d: BrowserEnvironmentData): string {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(d)))); } catch { return ''; }
}
