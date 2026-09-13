// Covers FR-2366 (SDK drain pacing against the server-side event rate limit):
//   AC-3446: flushAll() stops draining on a 429 instead of sending every remaining batch
//   AC-3447: Retry-After is honoured across later flush cycles, not just the one that saw it
//   AC-3448: A Retry-After of 0 still produces a real cooldown
//   AC-3449: exitFlush() does not fire during a cooldown
//   AC-3450: Sending resumes once the cooldown elapses
//
// The assertion throughout is the number of requests that reach the server, because that is
// the behaviour the server-side limit cares about.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Beacon } from '../src/index';

const validConfig = () => ({
  apiKey: 'test-key-123',
  product: 'test-app',
  productVersion: '1.0.0',
  autoPageViews: false,
  flushIntervalMs: 300000,
  maxBatchSize: 5,
});

let fetchMock: ReturnType<typeof vi.fn>;

const eventCalls = () =>
  fetchMock.mock.calls.filter(
    (c: any[]) => typeof c[0] === 'string' && c[0].endsWith('/v1/events'));

const rateLimited = (retryAfter?: string) =>
  new Response('{}', {
    status: 429,
    headers: retryAfter === undefined ? {} : { 'Retry-After': retryAfter },
  });

describe('Transport — rate-limit pacing (FR-2366)', () => {
  beforeEach(() => {
    Beacon._resetSingleton();
    localStorage.clear();
    sessionStorage.clear();
    fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    try { Beacon._resetSingleton(); } catch {}
  });

  // AC-3446: five batches queued, the first is rejected. The other four must not be sent —
  // they are charged against the same exhausted per-minute budget.
  //
  // The queue is built with enqueue() rather than track(), because track() fires its own
  // size-triggered flush. Those are dispatched before the first 429 *response* arrives, so
  // they are not something a cooldown can suppress — a cooldown can only govern requests
  // issued after the server has answered. Isolating flushAll keeps this test measuring the
  // drain decision rather than that unrelated race.
  it('flushAll stops the drain on the first 429', async () => {
    const b = Beacon.init(validConfig());
    const t = b._getTransport();

    b.track('cat', 'seed');
    const seed = t.getQueue()[0];
    for (let i = 0; i < 24; i++) t.enqueue({ ...seed, event_id: `evt_${i}` });
    expect(t.queueLength).toBe(25);

    fetchMock.mockResolvedValue(rateLimited('60'));
    await t.flushAll();

    expect(eventCalls()).toHaveLength(1);
  });

  // AC-3447: a cooldown that does not survive the cycle that set it is not a cooldown.
  it('holds off later flush cycles for the Retry-After window', async () => {
    const b = Beacon.init(validConfig());
    fetchMock.mockResolvedValue(rateLimited('60'));

    b.track('cat', 'first');
    await b.flush();
    expect(eventCalls()).toHaveLength(1);

    for (let i = 0; i < 3; i++) {
      b.track('cat', `during_cooldown_${i}`);
      await b.flush();
      await b._getTransport().flushAll();
    }

    expect(eventCalls()).toHaveLength(1);
  });

  // AC-3448: Retry-After: 0 used to set the deadline to "now", which is no cooldown at all —
  // the next tick walked straight back into the same limit.
  it('treats a zero Retry-After as a real cooldown', async () => {
    const b = Beacon.init(validConfig());
    fetchMock.mockResolvedValue(rateLimited('0'));

    b.track('cat', 'first');
    await b.flush();
    expect(eventCalls()).toHaveLength(1);

    b.track('cat', 'second');
    await b.flush();

    expect(eventCalls()).toHaveLength(1);
  });

  // AC-3449: an unload beacon during a cooldown is a request the server has already refused.
  it('does not fire an exit flush during a cooldown', async () => {
    const b = Beacon.init(validConfig());
    fetchMock.mockResolvedValue(rateLimited('60'));

    b.track('cat', 'first');
    await b.flush();
    const afterCooldownArmed = eventCalls().length;

    b.track('cat', 'queued_during_cooldown');
    expect(b._getTransport().exitFlush()).toBe(false);
    expect(eventCalls()).toHaveLength(afterCooldownArmed);
  });

  // AC-3450: a cooldown that never lifts is an outage.
  it('resumes sending once the cooldown elapses', async () => {
    const b = Beacon.init(validConfig());
    fetchMock.mockResolvedValue(rateLimited('60'));

    b.track('cat', 'first');
    await b.flush();
    expect(eventCalls()).toHaveLength(1);

    // Advance past the 60s window rather than waiting it out.
    const realNow = Date.now;
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 61_000);

    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    b.track('cat', 'after_cooldown');
    await b.flush();

    expect(eventCalls().length).toBeGreaterThan(1);
  });
});
