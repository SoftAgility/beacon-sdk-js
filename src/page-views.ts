export type PageViewCallback = () => void;
let origPS: typeof history.pushState | null = null;
let origRS: typeof history.replaceState | null = null;
let popH: ((ev: PopStateEvent) => void) | null = null;

export function installPageViewHooks(cb: PageViewCallback): void {
  if (typeof window === 'undefined') return;
  origPS = history.pushState.bind(history);
  history.pushState = function (...args: Parameters<typeof history.pushState>) { origPS!(...args); cb(); };
  origRS = history.replaceState.bind(history);
  history.replaceState = function (...args: Parameters<typeof history.replaceState>) { const prev = location.href; origRS!(...args); if (location.href !== prev) cb(); };
  popH = () => cb();
  window.addEventListener('popstate', popH);
}

export function removePageViewHooks(): void {
  if (typeof window === 'undefined') return;
  if (origPS) { history.pushState = origPS; origPS = null; }
  if (origRS) { history.replaceState = origRS; origRS = null; }
  if (popH) { window.removeEventListener('popstate', popH); popH = null; }
}
