import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Beacon } from '../src/index';

const validConfig = () => ({
  apiKey: 'test-key-123',
  sourceApp: 'test-app',
  sourceVersion: '1.0.0',
  autoPageViews: false,
  flushIntervalMs: 300000,
});

let fetchMock: ReturnType<typeof vi.fn>;

function findSessionStartBody(): any | undefined {
  const call = fetchMock.mock.calls.find(
    c => typeof c[0] === 'string' && (c[0] as string).includes('/v1/events/sessions') && !(c[0] as string).includes('/end')
  );
  if (!call) return undefined;
  return JSON.parse((call[1] as RequestInit).body as string);
}

function findExceptionBody(): any | undefined {
  const call = fetchMock.mock.calls.find(
    c => typeof c[0] === 'string' && (c[0] as string).includes('/v1/events/exceptions')
  );
  if (!call) return undefined;
  return JSON.parse((call[1] as RequestInit).body as string);
}

describe('Account & License context (Slice 3b parity with .NET SDK)', () => {
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

  describe('setAccount() / clearAccount()', () => {
    it('setAccount(id) attaches account_id to next track() event payload', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('acct-123');
      b.track('feature', 'export');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'feature');
      expect(ev).toBeDefined();
      expect(ev!.account_id).toBe('acct-123');
    });

    it('event has no account_id when setAccount was never called', () => {
      const b = Beacon.init(validConfig());
      b.track('feature', 'export');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'feature');
      expect(ev).toBeDefined();
      expect(ev!.account_id).toBeUndefined();
    });

    it('clearAccount() removes account_id from subsequent events', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('acct-123');
      b.clearAccount();
      b.track('feature', 'export');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'feature');
      expect(ev!.account_id).toBeUndefined();
    });

    it('clearAccount() preserves license_id', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('acct-123');
      b.setLicense('lic-456');
      b.clearAccount();
      b.track('feature', 'export');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'feature');
      expect(ev!.account_id).toBeUndefined();
      expect(ev!.license_id).toBe('lic-456');
    });

    it('setAccount trims whitespace before storing', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('  acct-trim  ');
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.account_id).toBe('acct-trim');
    });
  });

  describe('setLicense() / clearLicense()', () => {
    it('setLicense(id) attaches license_id to next track() event payload', () => {
      const b = Beacon.init(validConfig());
      b.setLicense('lic-789');
      b.track('feature', 'export');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'feature');
      expect(ev!.license_id).toBe('lic-789');
    });

    it('event has no license_id when setLicense was never called', () => {
      const b = Beacon.init(validConfig());
      b.track('feature', 'export');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'feature');
      expect(ev!.license_id).toBeUndefined();
    });

    it('clearLicense() removes license_id but preserves account_id', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('acct-123');
      b.setLicense('lic-456');
      b.clearLicense();
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.license_id).toBeUndefined();
      expect(ev!.account_id).toBe('acct-123');
    });
  });

  describe('Validation', () => {
    it('setAccount("") is a no-op', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('');
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.account_id).toBeUndefined();
    });

    it('setAccount with whitespace-only is a no-op', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('   ');
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.account_id).toBeUndefined();
    });

    it('setAccount with > 256 chars is a no-op', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('x'.repeat(257));
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.account_id).toBeUndefined();
    });

    it('setAccount accepts exactly 256 chars', () => {
      const b = Beacon.init(validConfig());
      const id = 'x'.repeat(256);
      b.setAccount(id);
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.account_id).toBe(id);
    });

    it('setAccount with control char (newline) is a no-op', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('valid\nid');
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.account_id).toBeUndefined();
    });

    it('setAccount with control char (carriage return) is a no-op', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('valid\rid');
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.account_id).toBeUndefined();
    });

    it('setAccount with U+2028 line separator is a no-op', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('valid id');
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.account_id).toBeUndefined();
    });

    it('setAccount with null is a no-op (no throw)', () => {
      const b = Beacon.init(validConfig());
      expect(() => b.setAccount(null as any)).not.toThrow();
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.account_id).toBeUndefined();
    });

    it('setAccount with undefined is a no-op (no throw)', () => {
      const b = Beacon.init(validConfig());
      expect(() => b.setAccount(undefined as any)).not.toThrow();
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.account_id).toBeUndefined();
    });

    it('setLicense applies the same validation rules as setAccount', () => {
      const b = Beacon.init(validConfig());
      b.setLicense('');
      b.setLicense('   ');
      b.setLicense('x'.repeat(257));
      b.setLicense('bad\nid');
      b.setLicense(null as any);
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.license_id).toBeUndefined();
    });

    it('invalid setAccount does not overwrite a previously-valid value', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('good-id');
      b.setAccount('bad\nid'); // should be ignored
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.account_id).toBe('good-id');
    });
  });

  describe('reset() clears account + license', () => {
    it('reset() clears both account and license context', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('acct-1');
      b.setLicense('lic-1');
      b.reset();
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.account_id).toBeUndefined();
      expect(ev!.license_id).toBeUndefined();
    });
  });

  describe('Exception payload includes account/license', () => {
    it('trackError POST body includes account_id and license_id when set', async () => {
      const b = Beacon.init(validConfig());
      b.setAccount('acct-err');
      b.setLicense('lic-err');
      b.trackError(new Error('boom'));
      await new Promise(r => setTimeout(r, 50));
      const body = findExceptionBody();
      expect(body).toBeDefined();
      expect(body.account_id).toBe('acct-err');
      expect(body.license_id).toBe('lic-err');
    });

    it('trackError omits account_id/license_id when never set', async () => {
      const b = Beacon.init(validConfig());
      b.trackError(new Error('boom'));
      await new Promise(r => setTimeout(r, 50));
      const body = findExceptionBody();
      expect(body).toBeDefined();
      expect(body.account_id).toBeUndefined();
      expect(body.license_id).toBeUndefined();
    });

    it('trackError omits only the cleared field', async () => {
      const b = Beacon.init(validConfig());
      b.setAccount('acct-1');
      b.setLicense('lic-1');
      b.clearAccount();
      b.trackError(new Error('boom'));
      await new Promise(r => setTimeout(r, 50));
      const body = findExceptionBody();
      expect(body.account_id).toBeUndefined();
      expect(body.license_id).toBe('lic-1');
    });
  });

  describe('Session-start payload includes account/license', () => {
    it('session-start POST body includes account_id and license_id when set before first track', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('acct-session');
      b.setLicense('lic-session');
      b.track('feature', 'export'); // triggers session start
      const body = findSessionStartBody();
      expect(body).toBeDefined();
      expect(body.account_id).toBe('acct-session');
      expect(body.license_id).toBe('lic-session');
    });

    it('session-start POST body omits account_id and license_id when not set', () => {
      const b = Beacon.init(validConfig());
      b.track('feature', 'export');
      const body = findSessionStartBody();
      expect(body).toBeDefined();
      expect(body.account_id).toBeUndefined();
      expect(body.license_id).toBeUndefined();
    });

    it('session rotation on idle timeout carries account/license into the new session-start', () => {
      const b = Beacon.init({ ...validConfig(), sessionTimeoutMinutes: 1 });
      b.setAccount('acct-rotate');
      b.setLicense('lic-rotate');
      b.track('a', '1');

      // Simulate expiry
      const sm = b._getSessionManager();
      (sm as any)._la = Date.now() - 120000;
      fetchMock.mockClear();

      b.track('a', '2');

      // The new session-start call should include account/license
      const body = findSessionStartBody();
      expect(body).toBeDefined();
      expect(body.account_id).toBe('acct-rotate');
      expect(body.license_id).toBe('lic-rotate');
    });
  });

  describe('Opt-out and destroy gating', () => {
    it('setAccount is a no-op when opted out', () => {
      const b = Beacon.init(validConfig());
      b.optOut();
      b.setAccount('acct-1');
      // optIn so we can track
      b.optIn();
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.account_id).toBeUndefined();
    });

    it('setLicense is a no-op when opted out', () => {
      const b = Beacon.init(validConfig());
      b.optOut();
      b.setLicense('lic-1');
      b.optIn();
      b.track('cat', 'name');
      const q = b._getTransport().getQueue();
      const ev = q.find(e => e.category === 'cat');
      expect(ev!.license_id).toBeUndefined();
    });

    it('clearAccount works while opted out (does not throw)', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('acct-1');
      b.optOut();
      expect(() => b.clearAccount()).not.toThrow();
      // Note: opt-out itself does not auto-clear account, but clearAccount should work
    });

    it('setAccount is a no-op after destroy', () => {
      const b = Beacon.init(validConfig());
      b.destroy();
      expect(() => b.setAccount('acct-after-destroy')).not.toThrow();
    });

    it('setLicense is a no-op after destroy', () => {
      const b = Beacon.init(validConfig());
      b.destroy();
      expect(() => b.setLicense('lic-after-destroy')).not.toThrow();
    });

    it('clearAccount and clearLicense are no-ops after destroy (no throw)', () => {
      const b = Beacon.init(validConfig());
      b.destroy();
      expect(() => b.clearAccount()).not.toThrow();
      expect(() => b.clearLicense()).not.toThrow();
    });
  });

  describe('Multiple events share the same context', () => {
    it('all events queued after setAccount carry the same account_id', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('acct-stable');
      b.track('cat1', 'name1');
      b.track('cat2', 'name2');
      b.track('cat3', 'name3');
      const q = b._getTransport().getQueue();
      const cat1 = q.find(e => e.category === 'cat1');
      const cat2 = q.find(e => e.category === 'cat2');
      const cat3 = q.find(e => e.category === 'cat3');
      expect(cat1!.account_id).toBe('acct-stable');
      expect(cat2!.account_id).toBe('acct-stable');
      expect(cat3!.account_id).toBe('acct-stable');
    });

    it('updating account between tracks reflects the latest value', () => {
      const b = Beacon.init(validConfig());
      b.setAccount('acct-A');
      b.track('cat', 'first');
      b.setAccount('acct-B');
      b.track('cat', 'second');
      const q = b._getTransport().getQueue();
      const first = q.find(e => e.name === 'first');
      const second = q.find(e => e.name === 'second');
      expect(first!.account_id).toBe('acct-A');
      expect(second!.account_id).toBe('acct-B');
    });
  });
});
