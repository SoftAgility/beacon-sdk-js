import { describe, it, expect, beforeEach } from 'vitest';
import { loadOrCreateActorId, setActorId, resetActorId, getStoredActorId } from '../src/identity';

describe('Identity', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates new actor ID when none exists', () => {
    const [id, ephemeral] = loadOrCreateActorId(Date.now(), false);
    expect(id).toBeTruthy();
    expect(id.length).toBeGreaterThan(0);
    expect(localStorage.getItem('beacon_actor_id')).toBe(id);
  });

  it('returns existing actor ID from localStorage', () => {
    localStorage.setItem('beacon_actor_id', 'existing-id');
    const [id] = loadOrCreateActorId(Date.now(), false);
    expect(id).toBe('existing-id');
  });

  it('setActorId writes to localStorage', () => {
    setActorId('user-123');
    expect(localStorage.getItem('beacon_actor_id')).toBe('user-123');
  });

  it('resetActorId generates new ID', () => {
    setActorId('old-id');
    const newId = resetActorId(Date.now(), false);
    expect(newId).not.toBe('old-id');
    expect(localStorage.getItem('beacon_actor_id')).toBe(newId);
  });

  it('getStoredActorId reads from localStorage', () => {
    localStorage.setItem('beacon_actor_id', 'stored-id');
    expect(getStoredActorId()).toBe('stored-id');
  });
});
