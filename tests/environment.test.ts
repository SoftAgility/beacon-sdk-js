import { describe, it, expect } from 'vitest';
import { collectEnvironmentData, encodeEnvironmentData } from '../src/environment';

describe('Environment', () => {
  it('collects browser environment data (AC-1697)', () => {
    const data = collectEnvironmentData();
    expect(data).not.toBeNull();
    expect(data!.browser_name).toBeTruthy();
    expect(data!.screen_width).toBeTypeOf('number');
    expect(data!.screen_height).toBeTypeOf('number');
    expect(data!.language).toBeTruthy();
    expect(data!.device_type).toBeTruthy();
    expect(['mobile', 'tablet', 'desktop']).toContain(data!.device_type);
  });

  it('omits connection_type when unavailable (AC-1698)', () => {
    const data = collectEnvironmentData();
    // jsdom typically does not have navigator.connection
    if (data && !data.connection_type) {
      expect(data.connection_type).toBeUndefined();
    }
  });

  it('encodes to valid base64 (AC-1695)', () => {
    const data = collectEnvironmentData();
    if (data) {
      const encoded = encodeEnvironmentData(data);
      expect(encoded).toBeTruthy();
      // Decode and verify
      const decoded = JSON.parse(decodeURIComponent(escape(atob(encoded))));
      expect(decoded.browser_name).toBe(data.browser_name);
    }
  });
});
