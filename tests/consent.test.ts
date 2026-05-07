import { describe, it, expect, beforeEach } from 'vitest';
import { readOptOutFromStorage, persistOptOut, clearOptOut, clearAllStorage } from '../src/consent';

describe('Consent', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('readOptOutFromStorage returns false when not set', () => {
    expect(readOptOutFromStorage()).toBe(false);
  });

  it('readOptOutFromStorage returns true when "1"', () => {
    localStorage.setItem('beacon_opted_out', '1');
    expect(readOptOutFromStorage()).toBe(true);
  });

  it('persistOptOut sets localStorage to "1"', () => {
    persistOptOut();
    expect(localStorage.getItem('beacon_opted_out')).toBe('1');
  });

  it('clearOptOut removes the key', () => {
    persistOptOut();
    clearOptOut();
    expect(localStorage.getItem('beacon_opted_out')).toBeNull();
  });

  it('clearAllStorage removes all SDK keys', () => {
    localStorage.setItem('beacon_opted_out', '1');
    localStorage.setItem('beacon_actor_id', 'test');
    sessionStorage.setItem('beacon_session_id', 'sess');
    sessionStorage.setItem('beacon_session_started_at', 'time');
    clearAllStorage();
    expect(localStorage.getItem('beacon_opted_out')).toBeNull();
    expect(localStorage.getItem('beacon_actor_id')).toBeNull();
    expect(sessionStorage.getItem('beacon_session_id')).toBeNull();
    expect(sessionStorage.getItem('beacon_session_started_at')).toBeNull();
  });
});
