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

describe('Transport — Exit Flush', () => {
  beforeEach(() => {
    Beacon._resetSingleton();
    localStorage.clear();
    sessionStorage.clear();
    fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    try { Beacon._resetSingleton(); } catch {}
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
  });

  it('visibilitychange hidden triggers keepalive flush (AC-1699)', () => {
    const b = Beacon.init(validConfig());
    b.track('cat', 'name');
    fetchMock.mockClear();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
    // SDK listens on window; dispatch there so the event reaches the handler in happy-dom
    window.dispatchEvent(new Event('visibilitychange'));
    const keepaliveCalls = fetchMock.mock.calls.filter(c => c[1]?.keepalive === true && (c[0] as string).endsWith('/v1/events'));
    expect(keepaliveCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('beforeunload sends session end with keepalive (AC-1701)', () => {
    const b = Beacon.init(validConfig());
    b.track('cat', 'name');
    fetchMock.mockClear();
    window.dispatchEvent(new Event('beforeunload'));
    const sessionEndCalls = fetchMock.mock.calls.filter(c => (c[0] as string).includes('/sessions/end') && c[1]?.keepalive === true);
    expect(sessionEndCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('exitFlushed flag prevents double flush (AC-1787, ED-685)', () => {
    const b = Beacon.init(validConfig());
    b.track('cat', 'name');
    fetchMock.mockClear();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
    window.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('beforeunload'));
    const eventFlushCalls = fetchMock.mock.calls.filter(c => (c[0] as string).endsWith('/v1/events') && c[1]?.keepalive === true);
    expect(eventFlushCalls.length).toBe(1);
  });
});
