import type { BreadcrumbEntry } from './types.js';

export class BreadcrumbRingBuffer {
  private readonly _cap: number;
  private _buf: BreadcrumbEntry[] = [];
  constructor(cap: number) { this._cap = cap; }
  isEnabled(): boolean { return this._cap > 0; }
  append(e: BreadcrumbEntry): void { if (this._cap <= 0) return; if (this._buf.length >= this._cap) this._buf.shift(); this._buf.push(e); }
  snapshot(): BreadcrumbEntry[] { return [...this._buf]; }
  clear(): void { this._buf = []; }
  get size(): number { return this._buf.length; }
}
