import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Beacon } from '../src/index';

const validConfig = () => ({
  apiKey: 'test-key-123',
  product: 'test-app',
  sourceVersion: '1.0.0',
  autoPageViews: false,
  flushIntervalMs: 300000,
});

let fetchMock: ReturnType<typeof vi.fn>;

describe('Session Management', () => {
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

  it('session starts lazily on first track() (AC-1684)', () => {
    const b = Beacon.init(validConfig());
    // No session yet
    expect(b.getSessionId()).toBeNull();
    // track triggers session start
    b.track('test', 'event');
    expect(b.getSessionId()).toBeTruthy();
    // Should have sent POST /v1/events/sessions
    const sessionCalls = fetchMock.mock.calls.filter(c => (c[0] as string).includes('/v1/events/sessions') && !(c[0] as string).includes('/end'));
    expect(sessionCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('no session start during init (AC-1684)', () => {
    const b = Beacon.init(validConfig());
    expect(b.getSessionId()).toBeNull();
    const sessionCalls = fetchMock.mock.calls.filter(c => (c[0] as string).includes('/v1/events/sessions'));
    expect(sessionCalls).toHaveLength(0);
  });

  it('track() includes session_id when session active (AC-1685)', () => {
    const b = Beacon.init(validConfig());
    b.track('test', 'event1');
    const sid = b.getSessionId();
    b.track('test', 'event2');
    const q = b._getTransport().getQueue();
    const ev = q.find(e => e.name === 'event2');
    expect(ev!.session_id).toBe(sid);
  });

  it('session rotates on idle timeout (AC-1686, ED-684)', () => {
    Beacon._resetSingleton();
    const b = Beacon.init({ ...validConfig(), sessionTimeoutMinutes: 1 });
    b.track('test', 'event1');
    const oldSid = b.getSessionId();

    // Simulate time passing (> 1 minute)
    const sm = b._getSessionManager();
    // Manually set last activity to far past
    (sm as any)._la = Date.now() - 120000; // 2 minutes ago

    b.track('test', 'event2');
    const newSid = b.getSessionId();
    expect(newSid).toBeTruthy();
    expect(newSid).not.toBe(oldSid);

    // Should have sent session end for old session
    const endCalls = fetchMock.mock.calls.filter(c => (c[0] as string).includes('/sessions/end'));
    expect(endCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('reset() ends session and starts new anonymous actor (AC-1683)', () => {
    const b = Beacon.init(validConfig());
    b.track('test', 'event');
    const oldSid = b.getSessionId();
    const oldActor = b.getActorId();

    b.reset();
    expect(b.getSessionId()).toBeNull();
    expect(b.getActorId()).not.toBe(oldActor);
  });
});
