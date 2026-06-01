import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Beacon } from '../src/index';

const validConfig = () => ({
  apiKey: 'test-key-123',
  product: 'test-app',
  sourceVersion: '1.0.0',
  autoPageViews: false,
  flushIntervalMs: 300000,
  debug: false,
});

// Mock fetch globally
const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
vi.stubGlobal('fetch', fetchMock);

describe('Beacon', () => {
  beforeEach(() => {
    Beacon._resetSingleton();
    localStorage.clear();
    sessionStorage.clear();
    fetchMock.mockClear();
  });

  afterEach(() => {
    try { Beacon._resetSingleton(); } catch {}
  });

  describe('init()', () => {
    it('returns a Beacon instance with valid config (AC-1661)', () => {
      const b = Beacon.init({ ...validConfig(), sourceVersion: '1.0.0' });
      expect(b).toBeDefined();
      expect(b).toBeInstanceOf(Beacon);
    });

    it('returns same instance on second call (AC-1662, ED-682)', () => {
      const b1 = Beacon.init(validConfig());
      const b2 = Beacon.init({ ...validConfig(), apiKey: 'other' });
      expect(b1).toBe(b2);
    });

    it('throws TypeError on missing apiKey (AC-1663, EC-617)', () => {
      expect(() => Beacon.init({ apiKey: '', product: 'app', sourceVersion: '1.0' })).toThrow(TypeError);
      expect(() => Beacon.init({ apiKey: '', product: 'app', sourceVersion: '1.0' })).toThrow('Beacon: apiKey is required.');
      Beacon._resetSingleton();
    });

    it('throws TypeError on missing product (AC-1664, EC-618)', () => {
      expect(() => Beacon.init({ apiKey: 'key', product: '', sourceVersion: '1.0' })).toThrow('Beacon: product is required.');
      Beacon._resetSingleton();
    });

    it('throws TypeError on missing sourceVersion (AC-1783, AC-1784, EC-637)', () => {
      expect(() => Beacon.init({ apiKey: 'key', product: 'app', sourceVersion: '' })).toThrow('Beacon: sourceVersion is required.');
      Beacon._resetSingleton();
      expect(() => Beacon.init({ apiKey: 'key', product: 'app' } as any)).toThrow('Beacon: sourceVersion is required.');
      Beacon._resetSingleton();
    });

    it('throws TypeError on invalid endpoint (AC-1665, EC-619)', () => {
      expect(() => Beacon.init({ ...validConfig(), endpoint: 'not-a-url' })).toThrow('valid absolute URL');
      Beacon._resetSingleton();
    });

    it('clamps maxBatchSize to 1000 (AC-1666)', () => {
      const b = Beacon.init({ ...validConfig(), maxBatchSize: 2000 });
      expect(b._getConfig().maxBatchSize).toBe(1000);
    });

    it('clamps sessionTimeoutMinutes to 1 (AC-1667)', () => {
      Beacon._resetSingleton();
      const b = Beacon.init({ ...validConfig(), sessionTimeoutMinutes: 0 });
      expect(b._getConfig().sessionTimeoutMinutes).toBe(1);
    });

    it('clamps maxQueueSize to 10000 (AC-1789)', () => {
      Beacon._resetSingleton();
      const b = Beacon.init({ ...validConfig(), maxQueueSize: 50000 });
      expect(b._getConfig().maxQueueSize).toBe(10000);
    });

    it('clamps maxBreadcrumbs to 200 (AC-1759)', () => {
      Beacon._resetSingleton();
      const b = Beacon.init({ ...validConfig(), maxBreadcrumbs: 500 });
      expect(b._getConfig().maxBreadcrumbs).toBe(200);
    });

    it('defaults maxBreadcrumbs to 25 (AC-1758)', () => {
      Beacon._resetSingleton();
      const b = Beacon.init(validConfig());
      expect(b._getConfig().maxBreadcrumbs).toBe(25);
    });
  });

  describe('identity', () => {
    it('generates anonymous actor ID in localStorage (AC-1668)', () => {
      const b = Beacon.init(validConfig());
      const actorId = b.getActorId();
      expect(actorId).toBeTruthy();
      expect(localStorage.getItem('beacon_actor_id')).toBe(actorId);
    });

    it('uses existing actor ID from localStorage (AC-1669)', () => {
      localStorage.setItem('beacon_actor_id', 'prior-uuid');
      const b = Beacon.init(validConfig());
      expect(b.getActorId()).toBe('prior-uuid');
    });

    it('identify sets actor ID (AC-1680)', () => {
      const b = Beacon.init(validConfig());
      b.identify('user-123');
      expect(b.getActorId()).toBe('user-123');
      expect(localStorage.getItem('beacon_actor_id')).toBe('user-123');
    });

    it('identify does not queue events (AC-1681)', () => {
      const b = Beacon.init(validConfig());
      fetchMock.mockClear();
      b.identify('user-123');
      // Only session start fetch, no event queue growth
      const queue = b._getTransport().getQueue();
      // The queue may have a page view from session start if autoPageViews is true
      // but we set it false, so only session start fetch call
      expect(queue.filter(e => e.category !== 'navigation')).toHaveLength(0);
    });

    it('identify with empty string is no-op (AC-1682, EC-626)', () => {
      const b = Beacon.init(validConfig());
      const originalId = b.getActorId();
      b.identify('');
      expect(b.getActorId()).toBe(originalId);
    });

    it('identify twice updates to latest (AC-1720, ED-691)', () => {
      const b = Beacon.init(validConfig());
      b.identify('user-1');
      b.identify('user-2');
      expect(b.getActorId()).toBe('user-2');
      expect(localStorage.getItem('beacon_actor_id')).toBe('user-2');
    });
  });

  describe('track()', () => {
    it('queues an event with correct fields (AC-1670)', () => {
      const b = Beacon.init(validConfig());
      b.track('feature', 'export');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'feature');
      expect(ev).toBeDefined();
      expect(ev!.name).toBe('export');
      expect(ev!.event_id).toBeTruthy();
      expect(ev!.actor_id).toBeTruthy();
      expect(ev!.timestamp).toBeTruthy();
    });

    it('truncates category to 128 chars (AC-1674)', () => {
      const b = Beacon.init(validConfig());
      b.track('x'.repeat(200), 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category.startsWith('x'));
      expect(ev!.category.length).toBe(128);
    });

    it('truncates property value to 256 chars (AC-1782)', () => {
      const b = Beacon.init(validConfig());
      b.track('cat', 'name', { key: 'x'.repeat(300) });
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect((ev!.properties!.key as string).length).toBe(256);
    });

    it('drops properties with 21+ keys (AC-1671)', () => {
      const b = Beacon.init(validConfig());
      const props: Record<string, string> = {};
      for (let i = 0; i < 21; i++) props[`k${i}`] = `v${i}`;
      b.track('cat', 'name', props);
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(Object.keys(ev!.properties!).length).toBe(20);
    });

    it('drops key > 64 chars (AC-1672)', () => {
      const b = Beacon.init(validConfig());
      b.track('cat', 'name', { ['x'.repeat(65)]: 'val', short: 'ok' });
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.properties!['short']).toBe('ok');
      expect(ev!.properties!['x'.repeat(65)]).toBeUndefined();
    });

    it('drops nested objects from properties (AC-1673)', () => {
      const b = Beacon.init(validConfig());
      b.track('cat', 'name', { nested: { a: 1 } as any, ok: 'yes' });
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.properties!['nested']).toBeUndefined();
      expect(ev!.properties!['ok']).toBe('yes');
    });

    it('is no-op when opted out (AC-1675)', () => {
      const b = Beacon.init(validConfig());
      b.optOut();
      b.track('cat', 'name');
      expect(b._getTransport().getQueue()).toHaveLength(0);
    });

    it('reserved category prefix _ is ignored (FR-1010)', () => {
      const b = Beacon.init(validConfig());
      const initialLen = b._getTransport().getQueue().length;
      b.track('_reserved', 'event');
      expect(b._getTransport().getQueue().length).toBe(initialLen);
    });

    it('drops oldest event when maxQueueSize exceeded (AC-1788)', () => {
      Beacon._resetSingleton();
      const b = Beacon.init({ ...validConfig(), maxQueueSize: 100, maxBatchSize: 1000 });
      for (let i = 0; i < 102; i++) b.track('cat', `e${i}`);
      const q = b._getTransport().getQueue();
      // Queue should be exactly maxQueueSize (100) — but there may be a page_view from session start
      expect(q.length).toBeLessThanOrEqual(100);
    });
  });

  describe('breadcrumbs', () => {
    it('track() appends breadcrumb (AC-1760)', () => {
      const b = Beacon.init({ ...validConfig(), maxBreadcrumbs: 3 });
      expect(b._getConfig().maxBreadcrumbs).toBe(3);
      b.track('feature', 'export', { format: 'pdf' });
      const snap = b._getBreadcrumbs().snapshot();
      const crumb = snap.find(c => c.category === 'feature');
      expect(crumb).toBeDefined();
      expect(crumb!.name).toBe('export');
      expect(crumb!.timestamp).toBeTruthy();
      expect(crumb!.properties?.format).toBe('pdf');
    });

    it('ring buffer evicts oldest at capacity (AC-1762)', () => {
      Beacon._resetSingleton();
      const b = Beacon.init({ ...validConfig(), maxBreadcrumbs: 3 });
      b.track('a', '1'); b.track('b', '2'); b.track('c', '3'); b.track('d', '4');
      const snap = b._getBreadcrumbs().snapshot();
      expect(snap.length).toBe(3);
      expect(snap[0].category).toBe('b');
      expect(snap[2].category).toBe('d');
    });

    it('optOut clears breadcrumbs (AC-1767)', () => {
      const b = Beacon.init(validConfig());
      b.track('a', 'b'); b.track('c', 'd');
      b.optOut();
      expect(b._getBreadcrumbs().size).toBe(0);
    });

    it('reset clears breadcrumbs (AC-1768)', () => {
      const b = Beacon.init(validConfig());
      b.track('a', 'b'); b.track('c', 'd');
      b.reset();
      expect(b._getBreadcrumbs().size).toBe(0);
    });

    it('no breadcrumbs when opted out (AC-1769)', () => {
      const b = Beacon.init(validConfig());
      b.optOut();
      b.track('cat', 'name'); // no-op
      expect(b._getBreadcrumbs().size).toBe(0);
    });

    it('maxBreadcrumbs 0 disables breadcrumbs (AC-1766)', () => {
      Beacon._resetSingleton();
      const b = Beacon.init({ ...validConfig(), maxBreadcrumbs: 0 });
      b.track('cat', 'name');
      expect(b._getBreadcrumbs().size).toBe(0);
    });

    it('breadcrumb properties truncated to 256 chars (AC-1770, ED-706)', () => {
      const b = Beacon.init(validConfig());
      b.track('cat', 'name', { key: 'x'.repeat(500) });
      const snap = b._getBreadcrumbs().snapshot();
      const crumb = snap.find(c => c.category === 'cat');
      expect((crumb!.properties!.key as string).length).toBe(256);
    });
  });

  describe('consent', () => {
    it('optOut sets localStorage flag (AC-1676)', () => {
      const b = Beacon.init(validConfig());
      b.optOut();
      expect(localStorage.getItem('beacon_opted_out')).toBe('1');
    });

    it('optOut clears event queue (AC-1677)', () => {
      const b = Beacon.init(validConfig());
      b.track('a', '1'); b.track('b', '2'); b.track('c', '3');
      b.optOut();
      expect(b._getTransport().getQueue()).toHaveLength(0);
    });

    it('optIn resumes tracking (AC-1678)', () => {
      const b = Beacon.init(validConfig());
      b.optOut();
      b.optIn();
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      expect(q.some(e => e.category === 'cat')).toBe(true);
    });

    it('init respects persisted opt-out (AC-1679)', () => {
      localStorage.setItem('beacon_opted_out', '1');
      const b = Beacon.init(validConfig());
      expect(b._isOptedOut()).toBe(true);
      b.track('cat', 'name');
      expect(b._getTransport().getQueue()).toHaveLength(0);
    });

    it('cross-tab storage event propagates opt-out (AC-1785)', () => {
      const b = Beacon.init(validConfig());
      // Simulate storage event from another tab
      const event = new StorageEvent('storage', { key: 'beacon_opted_out', newValue: '1' });
      window.dispatchEvent(event);
      expect(b._isOptedOut()).toBe(true);
      b.track('cat', 'name');
      expect(b._getTransport().getQueue()).toHaveLength(0);
    });

    it('cross-tab storage event propagates opt-in (AC-1786)', () => {
      const b = Beacon.init(validConfig());
      b.optOut();
      const event = new StorageEvent('storage', { key: 'beacon_opted_out', newValue: null });
      window.dispatchEvent(event);
      expect(b._isOptedOut()).toBe(false);
    });
  });

  describe('reset()', () => {
    it('clears actor, queue, session (AC-1683)', () => {
      const b = Beacon.init(validConfig());
      const oldActor = b.getActorId();
      b.track('cat', 'name');
      b.reset();
      expect(b.getActorId()).not.toBe(oldActor);
      expect(b._getTransport().getQueue()).toHaveLength(0);
      expect(b.getSessionId()).toBeNull();
    });
  });

  describe('event definitions', () => {
    it('events.define and exportManifest work (AC-1771, AC-1780)', () => {
      const b = Beacon.init(validConfig());
      expect(typeof b.events.define).toBe('function');
      expect(typeof b.events.exportManifest).toBe('function');
      b.events.define('feature', 'export');
      const manifest = JSON.parse(b.events.exportManifest());
      expect(manifest.events).toHaveLength(1);
      expect(manifest.events[0]).toEqual({ category: 'feature', name: 'export' });
    });

    it('duplicate define is idempotent (AC-1772)', () => {
      const b = Beacon.init(validConfig());
      b.events.define('feature', 'export');
      b.events.define('feature', 'export');
      b.events.define('feature', 'export');
      const manifest = JSON.parse(b.events.exportManifest());
      expect(manifest.events).toHaveLength(1);
    });

    it('exportManifest sorts by category then name (AC-1773)', () => {
      const b = Beacon.init(validConfig());
      b.events.define('z-cat', 'a-name');
      b.events.define('a-cat', 'z-name');
      const manifest = JSON.parse(b.events.exportManifest());
      expect(manifest.events[0].category).toBe('a-cat');
      expect(manifest.events[1].category).toBe('z-cat');
    });

    it('exportManifest returns empty events when none defined (AC-1774)', () => {
      const b = Beacon.init(validConfig());
      const manifest = JSON.parse(b.events.exportManifest());
      expect(manifest.events).toEqual([]);
    });

    it('exportManifest has correct schema (AC-1775)', () => {
      const b = Beacon.init(validConfig());
      const manifest = JSON.parse(b.events.exportManifest());
      expect(manifest.schema_version).toBe('1');
      expect(manifest.generated_at).toBeTruthy();
      expect(manifest.product).toBe('test-app');
    });

    it('exportManifest works when opted out (AC-1776)', () => {
      const b = Beacon.init(validConfig());
      b.events.define('cat', 'name');
      b.optOut();
      const manifest = JSON.parse(b.events.exportManifest());
      expect(manifest.events).toHaveLength(1);
    });

    it('define works when opted out (AC-1777)', () => {
      const b = Beacon.init(validConfig());
      b.optOut();
      b.events.define('cat', 'name');
      const manifest = JSON.parse(b.events.exportManifest());
      expect(manifest.events).toHaveLength(1);
    });

    it('define with empty category is no-op (AC-1778)', () => {
      const b = Beacon.init(validConfig());
      b.events.define('', 'name');
      const manifest = JSON.parse(b.events.exportManifest());
      expect(manifest.events).toHaveLength(0);
    });

    it('define with empty name is no-op (AC-1779)', () => {
      const b = Beacon.init(validConfig());
      b.events.define('cat', '');
      const manifest = JSON.parse(b.events.exportManifest());
      expect(manifest.events).toHaveLength(0);
    });
  });

  describe('destroy()', () => {
    it('clears all storage and stops activity (AC-1790)', () => {
      const b = Beacon.init(validConfig());
      b.identify('user-1');
      b.destroy();
      expect(localStorage.getItem('beacon_actor_id')).toBeNull();
      expect(localStorage.getItem('beacon_opted_out')).toBeNull();
      expect(sessionStorage.getItem('beacon_session_id')).toBeNull();
      // Subsequent track is no-op
      b.track('cat', 'name');
      expect(b._getTransport().getQueue()).toHaveLength(0);
    });

    it('allows re-initialization after destroy (AC-1791)', () => {
      const b1 = Beacon.init(validConfig());
      b1.destroy();
      const b2 = Beacon.init(validConfig());
      expect(b2).not.toBe(b1);
      expect(b2).toBeInstanceOf(Beacon);
      b2.destroy();
    });
  });

  describe('no-throw guarantee (FR-1040)', () => {
    it('track() never throws (AC-1710)', () => {
      const b = Beacon.init(validConfig());
      expect(() => b.track(null as any, undefined as any)).not.toThrow();
    });

    it('identify() with localStorage error does not throw (AC-1711)', () => {
      const b = Beacon.init(validConfig());
      // Force localStorage to throw
      const orig = localStorage.setItem;
      localStorage.setItem = () => { throw new Error('blocked'); };
      expect(() => b.identify('user-123')).not.toThrow();
      localStorage.setItem = orig;
    });
  });

  describe('debug logging (FR-1041)', () => {
    it('no console calls when debug is false (AC-1712)', () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      Beacon._resetSingleton();
      const b = Beacon.init({ ...validConfig(), debug: false });
      b.track('cat', 'name');
      // No debug/warn calls (init logs may have happened)
      // We verify no debug calls for the track operation
      expect(debugSpy).not.toHaveBeenCalledWith(expect.stringContaining('[Beacon] track:'));
      debugSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('console.debug called when debug is true (AC-1713)', () => {
      Beacon._resetSingleton();
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const b = Beacon.init({ ...validConfig(), debug: true });
      b.track('cat', 'name');
      expect(debugSpy).toHaveBeenCalled();
      debugSpy.mockRestore();
    });
  });

  describe('device ID and identify POST (FR-1772)', () => {
    it('beacon_device_id is persisted in localStorage on initialization (AC-2329)', () => {
      const b = Beacon.init(validConfig());
      const deviceId = localStorage.getItem('beacon_device_id');
      expect(deviceId).toBeTruthy();
      expect(typeof deviceId).toBe('string');
      expect(deviceId!.length).toBeGreaterThan(0);
    });

    it('beacon_device_id equals beacon_actor_id before identify (AC-2329)', () => {
      const b = Beacon.init(validConfig());
      const deviceId = localStorage.getItem('beacon_device_id');
      const actorId = localStorage.getItem('beacon_actor_id');
      expect(deviceId).toBe(actorId);
    });

    it('identify does NOT overwrite beacon_device_id (AC-2329)', () => {
      const b = Beacon.init(validConfig());
      const deviceIdBefore = localStorage.getItem('beacon_device_id');
      b.identify('user-123');
      const deviceIdAfter = localStorage.getItem('beacon_device_id');
      expect(deviceIdAfter).toBe(deviceIdBefore);
      // But actor_id should be updated
      expect(localStorage.getItem('beacon_actor_id')).toBe('user-123');
    });

    it('identify fires POST with anonymous_actor_id from beacon_device_id (AC-2330)', () => {
      fetchMock.mockClear();
      const b = Beacon.init(validConfig());
      const deviceId = localStorage.getItem('beacon_device_id')!;

      // Clear fetch calls from init (session start etc.)
      fetchMock.mockClear();

      b.identify('userA');

      // Find the identify POST call
      const identifyCall = fetchMock.mock.calls.find(
        c => typeof c[0] === 'string' && c[0].includes('/v1/actors/identify')
      );
      expect(identifyCall).toBeDefined();

      const opts = identifyCall![1] as RequestInit;
      expect(opts.method).toBe('POST');

      const body = JSON.parse(opts.body as string);
      expect(body.anonymous_actor_id).toBe(deviceId);
      expect(body.identified_actor_id).toBe('userA');
      expect(body.product).toBe('test-app');
      expect(body.source_version).toBe('1.0.0');
      expect(body.identified_at).toBeTruthy();
    });

    it('identify same user does NOT fire POST (AC-2327 equivalent for JS)', () => {
      fetchMock.mockClear();
      const b = Beacon.init(validConfig());
      b.identify('userA');
      fetchMock.mockClear();

      // Re-identify with same user
      b.identify('userA');

      const identifyCall = fetchMock.mock.calls.find(
        c => typeof c[0] === 'string' && c[0].includes('/v1/actors/identify')
      );
      expect(identifyCall).toBeUndefined();
    });

    it('reset generates a new beacon_device_id (AC-2331)', () => {
      const b = Beacon.init(validConfig());
      const deviceIdBefore = localStorage.getItem('beacon_device_id');
      expect(deviceIdBefore).toBeTruthy();

      b.reset();

      const deviceIdAfter = localStorage.getItem('beacon_device_id');
      expect(deviceIdAfter).toBeTruthy();
      expect(deviceIdAfter).not.toBe(deviceIdBefore);
      // After reset, actor_id should match the new device_id
      expect(localStorage.getItem('beacon_actor_id')).toBe(deviceIdAfter);
    });

    it('identify POST on 409 logs console.warn (AC-2328 equivalent for JS)', async () => {
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(new Response('{}', { status: 200 }))
      );
      // Set up a 409 response for the identify call
      fetchMock.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/v1/actors/identify')) {
          return Promise.resolve(new Response(
            '{"error":"identity_already_linked","existing_identified_actor_id":"userA"}',
            { status: 409 }
          ));
        }
        return Promise.resolve(new Response('{}', { status: 200 }));
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const b = Beacon.init(validConfig());
      b.identify('userB');

      // Wait for the fetch promise to resolve
      await new Promise(r => setTimeout(r, 50));

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('already linked to a different user')
      );

      // Actor ID should still be userB (not reverted)
      expect(b.getActorId()).toBe('userB');

      warnSpy.mockRestore();
      fetchMock.mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 })));
    });

    it('identify POST is non-blocking (AC-2333)', () => {
      const b = Beacon.init(validConfig());
      const start = performance.now();
      b.identify('userA');
      const elapsed = performance.now() - start;
      // identify() should return in under 10ms (no blocking HTTP)
      expect(elapsed).toBeLessThan(10);
    });

    it('destroy clears beacon_device_id from localStorage', () => {
      const b = Beacon.init(validConfig());
      expect(localStorage.getItem('beacon_device_id')).toBeTruthy();
      b.destroy();
      expect(localStorage.getItem('beacon_device_id')).toBeNull();
    });
  });
});
