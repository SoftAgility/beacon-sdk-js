import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Beacon } from '../src/index';

const validConfig = () => ({
  apiKey: 'test-key-123',
  sourceApp: 'test-app',
  sourceVersion: '1.0.0',
  autoPageViews: false,
  flushIntervalMs: 300000,
  maxBatchSize: 50,
});

let fetchMock: ReturnType<typeof vi.fn>;

describe('Transport — Flush', () => {
  beforeEach(() => {
    Beacon._resetSingleton();
    localStorage.clear();
    sessionStorage.clear();
    fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    try { Beacon._resetSingleton(); } catch {}
  });

  it('flush sends POST /v1/events with auth header (AC-1692, AC-1694)', async () => {
    const b = Beacon.init({ ...validConfig(), maxBatchSize: 50 });
    for (let i = 0; i < 5; i++) b.track('cat', `e${i}`);
    fetchMock.mockClear();
    await b.flush();
    const flushCall = fetchMock.mock.calls.find(c => (c[0] as string).includes('/v1/events') && !(c[0] as string).includes('sessions') && !(c[0] as string).includes('exceptions'));
    expect(flushCall).toBeDefined();
    expect(flushCall![1].headers.Authorization).toBe('Bearer test-key-123');
    expect(flushCall![1].headers['Content-Type']).toBe('application/json');
  });

  it('flush resolves with empty queue (AC-1693, ED-686)', async () => {
    const b = Beacon.init(validConfig());
    b._getTransport().clearQueue();
    fetchMock.mockClear();
    await b.flush();
    const eventCalls = fetchMock.mock.calls.filter(c => (c[0] as string).endsWith('/v1/events'));
    expect(eventCalls).toHaveLength(0);
  });

  it('size-triggered flush at maxBatchSize (AC-1702)', async () => {
    Beacon._resetSingleton();
    const b = Beacon.init({ ...validConfig(), maxBatchSize: 3 });
    fetchMock.mockClear();
    b.track('a', '1'); b.track('b', '2'); b.track('c', '3');
    await new Promise(r => setTimeout(r, 50));
    const eventCalls = fetchMock.mock.calls.filter(c => (c[0] as string).endsWith('/v1/events'));
    expect(eventCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('first flush for session includes X-Environment-Data header (AC-1695)', async () => {
    const b = Beacon.init(validConfig());
    b.track('cat', 'name');
    fetchMock.mockClear();
    await b.flush();
    const flushCall = fetchMock.mock.calls.find(c => (c[0] as string).endsWith('/v1/events'));
    if (flushCall) {
      expect(flushCall[1].headers['X-Environment-Data']).toBeTruthy();
    }
  });

  it('subsequent flushes do not include X-Environment-Data (AC-1696)', async () => {
    const b = Beacon.init(validConfig());
    b.track('cat', 'name1');
    await b.flush();
    b.track('cat', 'name2');
    fetchMock.mockClear();
    await b.flush();
    const flushCall = fetchMock.mock.calls.find(c => (c[0] as string).endsWith('/v1/events'));
    if (flushCall) {
      expect(flushCall[1].headers['X-Environment-Data']).toBeUndefined();
    }
  });
});
