import type { EventDefinition, EventManifest, EventsApi } from './types.js';
export class EventDefinitionRegistry {
  private readonly _r = new Set<string>();
  private readonly _sa: string;
  private readonly _d: boolean;
  constructor(sa: string, d: boolean) { this._sa = sa; this._d = d; }
  define(c: string, n: string): void {
    if (typeof c !== 'string' || typeof n !== 'string' || !c || !n || c.length > 128 || n.length > 256) {
      if (this._d) try { console.warn('[Beacon] events.define() requires non-empty category and name strings \u2014 ignored.'); } catch {} return;
    }
    const k = c + '\0' + n;
    if (!this._r.has(k)) { this._r.add(k); if (this._d) try { console.debug(`[Beacon] Event defined: ${c}/${n}`); } catch {} }
  }
  exportManifest(): string {
    try {
      const e: EventDefinition[] = [];
      for (const k of this._r) { const p = k.split('\0'); e.push({ category: p[0], name: p[1] }); }
      e.sort((a, b) => a.category < b.category ? -1 : a.category > b.category ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
      return JSON.stringify({ schema_version: '1', generated_at: new Date().toISOString(), product: this._sa, events: e } as EventManifest);
    } catch { return ''; }
  }
  createApi(): EventsApi { return { define: (c, n) => this.define(c, n), exportManifest: () => this.exportManifest() }; }
  clear(): void { this._r.clear(); }
}
