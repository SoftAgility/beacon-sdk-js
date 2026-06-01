import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Beacon } from '../src/index';

const validConfig = () => ({
  apiKey: 'test-key-123',
  product: 'test-app',
  sourceVersion: '1.0.0',
  flushIntervalMs: 300000,
});

let fetchMock: ReturnType<typeof vi.fn>;
let currentBeacon: ReturnType<typeof Beacon.init> | null = null;

describe('Page Views', () => {
  beforeEach(() => {
    // Fully destroy and reset
    if (currentBeacon) {
      try { currentBeacon.destroy(); } catch {}
      currentBeacon = null;
    }
    Beacon._resetSingleton();
    localStorage.clear();
    sessionStorage.clear();
    fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    if (currentBeacon) {
      try { currentBeacon.destroy(); } catch {}
      currentBeacon = null;
    }
    Beacon._resetSingleton();
  });

  it('auto page view queued on init (AC-1687)', () => {
    currentBeacon = Beacon.init({ ...validConfig(), autoPageViews: true });
    // Init eagerly starts a session and fires the initial page view
    const q = currentBeacon._getTransport().getQueue();
    const pvEvent = q.find(e => e.category === 'navigation' && e.name === 'page_view');
    expect(pvEvent).toBeDefined();
    expect(pvEvent!.properties?.url).toBeTruthy();
    expect(pvEvent!.session_id).toBeTruthy();
  });

  it('pushState hook queues page view (AC-1688)', () => {
    currentBeacon = Beacon.init({ ...validConfig(), autoPageViews: true });
    currentBeacon.track('test', 'event'); // start session
    const initialQ = currentBeacon._getTransport().getQueue().length;
    history.pushState(null, '', '/new-route');
    const q = currentBeacon._getTransport().getQueue();
    expect(q.length).toBeGreaterThan(initialQ);
    const pvEvent = q.find(e => e.category === 'navigation' && e.name === 'page_view' && e.properties?.url === '/new-route');
    expect(pvEvent).toBeDefined();
  });

  it('autoPageViews false does not patch pushState (AC-1689)', () => {
    currentBeacon = Beacon.init({ ...validConfig(), autoPageViews: false });
    currentBeacon.track('test', 'event'); // start session
    const initialQ = currentBeacon._getTransport().getQueue().length;
    history.pushState(null, '', '/other');
    expect(currentBeacon._getTransport().getQueue().length).toBe(initialQ);
  });

  it('pageView() queues navigation/page_view with custom url (AC-1690)', () => {
    currentBeacon = Beacon.init({ ...validConfig(), autoPageViews: false });
    currentBeacon.pageView('/custom', { section: 'admin' });
    const q = currentBeacon._getTransport().getQueue();
    const ev = q.find(e => e.category === 'navigation' && e.name === 'page_view' && e.properties?.url === '/custom');
    expect(ev).toBeDefined();
    expect(ev!.properties?.section).toBe('admin');
  });

  it('pageView() defaults to window.location.pathname (AC-1691)', () => {
    currentBeacon = Beacon.init({ ...validConfig(), autoPageViews: false });
    currentBeacon.pageView();
    const q = currentBeacon._getTransport().getQueue();
    const ev = q.find(e => e.category === 'navigation' && e.name === 'page_view');
    expect(ev).toBeDefined();
    expect(ev!.properties?.url).toBe(window.location.pathname);
  });

  it('pageView adds breadcrumb (AC-1761)', () => {
    currentBeacon = Beacon.init({ ...validConfig(), autoPageViews: false });
    currentBeacon.pageView('/dashboard');
    const snap = currentBeacon._getBreadcrumbs().snapshot();
    const crumb = snap.find(c => c.category === 'navigation' && c.name === 'page_view');
    expect(crumb).toBeDefined();
    expect(crumb!.properties?.url).toBe('/dashboard');
  });
});
