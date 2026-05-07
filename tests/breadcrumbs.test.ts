import { describe, it, expect } from 'vitest';
import { BreadcrumbRingBuffer } from '../src/breadcrumbs';
import type { BreadcrumbEntry } from '../src/types';

function entry(cat: string, name: string): BreadcrumbEntry {
  return { category: cat, name, timestamp: new Date().toISOString() };
}

describe('BreadcrumbRingBuffer', () => {
  it('starts empty', () => {
    const buf = new BreadcrumbRingBuffer(5);
    expect(buf.size).toBe(0);
    expect(buf.snapshot()).toEqual([]);
  });

  it('appends entries', () => {
    const buf = new BreadcrumbRingBuffer(5);
    buf.append(entry('a', 'b'));
    expect(buf.size).toBe(1);
    expect(buf.snapshot()[0].category).toBe('a');
  });

  it('evicts oldest entry when at capacity (ED-701)', () => {
    const buf = new BreadcrumbRingBuffer(3);
    buf.append(entry('1', 'a'));
    buf.append(entry('2', 'b'));
    buf.append(entry('3', 'c'));
    buf.append(entry('4', 'd'));
    expect(buf.size).toBe(3);
    const snap = buf.snapshot();
    expect(snap[0].category).toBe('2');
    expect(snap[2].category).toBe('4');
  });

  it('snapshot is a copy (FR-1062)', () => {
    const buf = new BreadcrumbRingBuffer(5);
    buf.append(entry('a', 'b'));
    const snap = buf.snapshot();
    buf.append(entry('c', 'd'));
    expect(snap.length).toBe(1);
    expect(buf.size).toBe(2);
  });

  it('clear empties the buffer', () => {
    const buf = new BreadcrumbRingBuffer(5);
    buf.append(entry('a', 'b'));
    buf.append(entry('c', 'd'));
    buf.clear();
    expect(buf.size).toBe(0);
    expect(buf.snapshot()).toEqual([]);
  });

  it('capacity 0 disables breadcrumbs (ED-703)', () => {
    const buf = new BreadcrumbRingBuffer(0);
    expect(buf.isEnabled()).toBe(false);
    buf.append(entry('a', 'b'));
    expect(buf.size).toBe(0);
  });

  it('isEnabled returns true for capacity > 0', () => {
    const buf = new BreadcrumbRingBuffer(1);
    expect(buf.isEnabled()).toBe(true);
  });
});
