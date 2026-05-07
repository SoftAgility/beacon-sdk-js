import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateUuidV7 } from '../src/uuid';

describe('UUID v7', () => {
  it('generates valid UUID v7 format', () => {
    const uuid = generateUuidV7(Date.now(), false);
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('embeds timestamp correctly', () => {
    const now = 1711497600000; // known timestamp
    const uuid = generateUuidV7(now, false);
    // First 12 hex chars (48 bits) = timestamp
    const hex = uuid.replace(/-/g, '').substring(0, 12);
    const parsed = parseInt(hex, 16);
    expect(parsed).toBe(now);
  });

  it('generates unique UUIDs', () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUuidV7(Date.now(), false));
    }
    expect(uuids.size).toBe(100);
  });

  it('sets version to 7 (bits 0111)', () => {
    const uuid = generateUuidV7(Date.now(), false);
    // Version is at position 14 (13th char after first dash group)
    expect(uuid[14]).toBe('7');
  });

  it('sets variant to 10xx', () => {
    const uuid = generateUuidV7(Date.now(), false);
    // Variant is at position 19
    expect(['8', '9', 'a', 'b']).toContain(uuid[19]);
  });
});
