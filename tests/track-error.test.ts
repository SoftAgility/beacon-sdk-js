import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Beacon } from '../src/index';

const validConfig = () => ({
  apiKey: 'test-key-123',
  product: 'test-app',
  productVersion: '1.0.0',
  autoPageViews: false,
  flushIntervalMs: 300000,
});

let fetchMock: ReturnType<typeof vi.fn>;

describe('trackError', () => {
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

  it('posts to /v1/events/exceptions (AC-1703)', async () => {
    const b = Beacon.init(validConfig());
    b.trackError(new TypeError('bad input'), 'fatal', { page: '/editor' });
    await new Promise(r => setTimeout(r, 50));
    const exCall = fetchMock.mock.calls.find(c => (c[0] as string).includes('/v1/events/exceptions'));
    expect(exCall).toBeDefined();
    const body = JSON.parse(exCall![1].body);
    expect(body.exception_type).toBe('TypeError');
    expect(body.severity).toBe('fatal');
    expect(body.message).toBe('bad input');
    expect(body.stack_trace).toBeTruthy();
  });

  it('defaults severity to non_fatal (AC-1704)', async () => {
    const b = Beacon.init(validConfig());
    b.trackError(new Error('x'));
    await new Promise(r => setTimeout(r, 50));
    const exCall = fetchMock.mock.calls.find(c => (c[0] as string).includes('/v1/events/exceptions'));
    const body = JSON.parse(exCall![1].body);
    expect(body.severity).toBe('non_fatal');
  });

  it('non-Error argument is no-op (AC-1705, EC-627)', async () => {
    const b = Beacon.init(validConfig());
    fetchMock.mockClear();
    b.trackError('not an error' as any);
    await new Promise(r => setTimeout(r, 50));
    const exCall = fetchMock.mock.calls.find(c => (c[0] as string).includes('/v1/events/exceptions'));
    expect(exCall).toBeUndefined();
  });

  it('truncates stack_trace to 32768 chars (AC-1706)', async () => {
    const b = Beacon.init(validConfig());
    const err = new Error('test');
    err.stack = 'x'.repeat(40000);
    b.trackError(err);
    await new Promise(r => setTimeout(r, 50));
    const exCall = fetchMock.mock.calls.find(c => (c[0] as string).includes('/v1/events/exceptions'));
    const body = JSON.parse(exCall![1].body);
    expect(body.stack_trace.length).toBe(32768);
  });

  it('includes breadcrumb snapshot in payload (AC-1763)', async () => {
    const b = Beacon.init(validConfig());
    b.track('feature', 'export', { format: 'pdf' });
    b.track('feature', 'save');
    b.trackError(new Error('oops'));
    await new Promise(r => setTimeout(r, 50));
    const exCall = fetchMock.mock.calls.find(c => (c[0] as string).includes('/v1/events/exceptions'));
    const body = JSON.parse(exCall![1].body);
    expect(body.breadcrumbs).toBeDefined();
    expect(body.breadcrumbs.length).toBe(2);
    expect(body.breadcrumbs[0].category).toBe('feature');
  });

  it('breadcrumb snapshot is immutable (AC-1764)', async () => {
    const b = Beacon.init(validConfig());
    b.track('a', '1');
    b.trackError(new Error('e'));
    b.track('b', '2'); // should not affect the already-posted payload
    await new Promise(r => setTimeout(r, 50));
    const exCall = fetchMock.mock.calls.find(c => (c[0] as string).includes('/v1/events/exceptions'));
    const body = JSON.parse(exCall![1].body);
    expect(body.breadcrumbs.length).toBe(1);
  });

  it('omits breadcrumbs when buffer empty (AC-1765, ED-702)', async () => {
    const b = Beacon.init(validConfig());
    b.trackError(new Error('e'));
    await new Promise(r => setTimeout(r, 50));
    const exCall = fetchMock.mock.calls.find(c => (c[0] as string).includes('/v1/events/exceptions'));
    const body = JSON.parse(exCall![1].body);
    expect(body.breadcrumbs).toBeUndefined();
  });

  it('no breadcrumbs in payload when maxBreadcrumbs=0 (AC-1766, ED-703)', async () => {
    Beacon._resetSingleton();
    const b = Beacon.init({ ...validConfig(), maxBreadcrumbs: 0 });
    b.track('cat', 'name');
    b.trackError(new Error('e'));
    await new Promise(r => setTimeout(r, 50));
    const exCall = fetchMock.mock.calls.find(c => (c[0] as string).includes('/v1/events/exceptions'));
    const body = JSON.parse(exCall![1].body);
    expect(body.breadcrumbs).toBeUndefined();
  });
});
