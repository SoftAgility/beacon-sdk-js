import { describe, it, expect, vi } from 'vitest';
import { EventDefinitionRegistry } from '../src/event-definitions';

describe('EventDefinitionRegistry', () => {
  it('registers a category+name pair (FR-1063)', () => {
    const reg = new EventDefinitionRegistry('my-app', false);
    reg.define('feature', 'export');
    const manifest = JSON.parse(reg.exportManifest());
    expect(manifest.events).toHaveLength(1);
    expect(manifest.events[0]).toEqual({ category: 'feature', name: 'export' });
  });

  it('is idempotent — duplicates ignored (ED-705)', () => {
    const reg = new EventDefinitionRegistry('my-app', false);
    reg.define('feature', 'export');
    reg.define('feature', 'export');
    reg.define('feature', 'export');
    const manifest = JSON.parse(reg.exportManifest());
    expect(manifest.events).toHaveLength(1);
  });

  it('rejects empty category (EC-636)', () => {
    const reg = new EventDefinitionRegistry('my-app', false);
    reg.define('', 'name');
    const manifest = JSON.parse(reg.exportManifest());
    expect(manifest.events).toHaveLength(0);
  });

  it('rejects empty name (EC-636)', () => {
    const reg = new EventDefinitionRegistry('my-app', false);
    reg.define('cat', '');
    const manifest = JSON.parse(reg.exportManifest());
    expect(manifest.events).toHaveLength(0);
  });

  it('rejects category > 128 chars', () => {
    const reg = new EventDefinitionRegistry('my-app', false);
    reg.define('x'.repeat(129), 'name');
    const manifest = JSON.parse(reg.exportManifest());
    expect(manifest.events).toHaveLength(0);
  });

  it('rejects name > 256 chars', () => {
    const reg = new EventDefinitionRegistry('my-app', false);
    reg.define('cat', 'x'.repeat(257));
    const manifest = JSON.parse(reg.exportManifest());
    expect(manifest.events).toHaveLength(0);
  });

  it('exportManifest returns valid JSON (FR-1066)', () => {
    const reg = new EventDefinitionRegistry('my-app', false);
    reg.define('feature', 'export');
    const manifest = JSON.parse(reg.exportManifest());
    expect(manifest.schema_version).toBe('1');
    expect(manifest.generated_at).toBeTruthy();
    expect(manifest.source_app).toBe('my-app');
    expect(manifest.events).toBeInstanceOf(Array);
  });

  it('returns empty events when none defined (ED-704)', () => {
    const reg = new EventDefinitionRegistry('my-app', false);
    const manifest = JSON.parse(reg.exportManifest());
    expect(manifest.events).toEqual([]);
  });

  it('sorts by category then name (FR-1065)', () => {
    const reg = new EventDefinitionRegistry('my-app', false);
    reg.define('z-cat', 'a-name');
    reg.define('a-cat', 'z-name');
    const manifest = JSON.parse(reg.exportManifest());
    expect(manifest.events[0].category).toBe('a-cat');
    expect(manifest.events[1].category).toBe('z-cat');
  });

  it('clear removes all definitions', () => {
    const reg = new EventDefinitionRegistry('my-app', false);
    reg.define('feature', 'export');
    reg.clear();
    const manifest = JSON.parse(reg.exportManifest());
    expect(manifest.events).toEqual([]);
  });

  it('createApi returns working define and exportManifest', () => {
    const reg = new EventDefinitionRegistry('my-app', false);
    const api = reg.createApi();
    expect(typeof api.define).toBe('function');
    expect(typeof api.exportManifest).toBe('function');
    api.define('cat', 'name');
    const manifest = JSON.parse(api.exportManifest());
    expect(manifest.events).toHaveLength(1);
  });
});
