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

describe('Transport — Error Handling', () => {
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

  it('401 halts further flushes (AC-1707, EC-620)', async () => {
    const b = Beacon.init(validConfig());
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
    b.track('cat', 'name');
    await b.flush();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('401'));
    b.track('cat2', 'name2');
    await b.flush();
    expect(b._getTransport().isHalted()).toBe(true);
    consoleSpy.mockRestore();
  });

  it('5xx discards events (AC-1709)', async () => {
    const b = Beacon.init(validConfig());
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));
    b.track('cat', 'name');
    await b.flush();
    expect(b._getTransport().getQueue().filter(e => e.category === 'cat')).toHaveLength(0);
  });

  it('429 re-queues events and honors Retry-After backoff (AC-1708, EC-622)', async () => {
    Beacon._resetSingleton();
    const b = Beacon.init({ ...validConfig(), debug: true });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '45' } }));
    b.track('cat', 'name');
    await b.flush();
    const q = b._getTransport().getQueue();
    expect(q.some(e => e.category === 'cat')).toBe(true);
    const eventCalls = fetchMock.mock.calls.filter((c: any[]) =>
      typeof c[0] === 'string' && c[0].endsWith('/v1/events'));
    expect(eventCalls).toHaveLength(1);
    warnSpy.mockRestore();
  });
});
