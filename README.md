# SoftAgility Beacon — JavaScript / TypeScript SDK

[![npm version](https://img.shields.io/npm/v/@softagility/beacon-js.svg)](https://www.npmjs.com/package/@softagility/beacon-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/@softagility/beacon-js)](https://bundlephobia.com/package/@softagility/beacon-js)

The official browser SDK for [SoftAgility Beacon](https://beacon.softagility.com) — a usage-tracking SaaS for web and Node applications. Buffered, batched, durable, and under 6 KB gzipped. Works with any framework or as a paste-in `<script>` tag.

---

## Installation

### npm / yarn / pnpm (build-step apps)

```bash
npm install @softagility/beacon-js
```

```ts
import { Beacon } from '@softagility/beacon-js';

const beacon = Beacon.init({
  apiKey:        'pk_your_api_key',
  sourceApp:     'my-app',           // becomes source_app on every event
  sourceVersion: '1.4.2',            // becomes source_version on every event
});

beacon.identify('user-12345');
beacon.track('billing', 'checkout.completed', { amount: 1990, currency: 'USD' });
```

### CDN (snippet-paste install — no build step)

For static sites, CMS plugins, marketing landing pages, or any context without a bundler:

```html
<!-- Pinned to a specific version (recommended for production) -->
<script src="https://cdn.jsdelivr.net/npm/@softagility/beacon-js@1.0.0"></script>

<script>
  const beacon = Beacon.init({
    apiKey:        'pk_your_api_key',
    sourceApp:     'marketing-site',
    sourceVersion: '2026-05-07',
  });
  beacon.track('page', 'view', { path: location.pathname });
</script>
```

The package is also reachable via [unpkg](https://unpkg.com/@softagility/beacon-js@1.0.0). Both jsDelivr and unpkg auto-mirror every npm publish.

---

## Quick reference

| Method | Purpose |
|---|---|
| `Beacon.init(config)` | Singleton factory. Returns the instance (or a no-op stub if not in a browser). Idempotent — repeated calls return the existing instance. |
| `beacon.identify(userId)` | Set the actor id for subsequent calls. Anonymous device id is auto-linked on first identify. |
| `beacon.track(category, name, properties?)` | Track an event. Returns immediately; batched + flushed in the background. |
| `beacon.trackError(error, severity?, properties?)` | Report an exception. Severity: `'fatal'` or `'non_fatal'` (default). Includes a breadcrumb trail of recent track calls. |
| `beacon.pageView(url?, properties?)` | Track a page view. With `autoPageViews: true` (default), `pushState` and `popstate` are auto-instrumented. |
| `beacon.flush()` | Force-flush queued events. Returns a promise. Used at navigation / shutdown. |
| `beacon.events.define(category, name)` | Declare an event for manifest export. |
| `beacon.events.exportManifest()` | Returns a JSON manifest for upload to the portal's Allowlists Import flow. |
| `beacon.optOut()` / `beacon.optIn()` | Persist consent state to `localStorage`. While opted out, every method is a silent no-op. |
| `beacon.reset()` | Clear actor + session + queue + breadcrumbs. Rotates the anonymous device id. Used on logout. |
| `beacon.destroy()` | Stop all timers and release resources. The instance becomes inert. |
| `beacon.getSessionId()` / `beacon.getActorId()` | Read current state. |

---

## Configuration

| Field | Default | Range | Notes |
|---|---|---|---|
| `apiKey` | required | — | API key from the Beacon portal. Sent as `Authorization: Bearer`. |
| `sourceApp` | required | ≤128 chars | `source_app` on every event. Must match a registered product in the portal. |
| `sourceVersion` | required | ≤256 chars | `source_version`. Auto-registers on first event. |
| `endpoint` | `https://beacon.softagility.com` | URL | Override for self-hosted / staging. |
| `sessionTimeoutMinutes` | `30` | 1-1440 | Inactivity window before a new session rotates. |
| `autoPageViews` | `true` | — | Hook `history.pushState` and `popstate` for auto page views. |
| `flushIntervalMs` | `10000` | 1000-300000 | Background flush cadence. |
| `maxBatchSize` | `50` | 1-1000 | Events per HTTP batch. |
| `maxQueueSize` | `5000` | 100-10000 | In-memory queue depth (oldest dropped on overflow). |
| `maxBreadcrumbs` | `25` | 0-200 | Breadcrumb ring buffer; `0` disables. |
| `debug` | `false` | — | Enable `console.debug` SDK logs. |

---

## What the SDK does for you

| Behaviour | Detail |
|---|---|
| **Buffered & batched** | Events queue in memory and flush every `flushIntervalMs` (default 10 s) in batches of up to `maxBatchSize` (default 50). Background, non-blocking. |
| **Anonymous-by-default** | Without `identify`, the SDK generates a UUIDv7 device id stored in `localStorage`. `identify` later links the device to the actor (POST `/v1/actors/identify`). |
| **Sessions** | Idle-timeout-based session rotation; environment data sent once per session as `X-Environment-Data` header. |
| **Exception capture** | `trackError` includes the most recent breadcrumbs, exception type, message, stack, and severity. |
| **Auto page views** | When enabled, `pushState` and `popstate` events are instrumented. Disable with `autoPageViews: false` for SPAs that prefer manual control. |
| **Opt-in / opt-out** | `optOut` persists to `localStorage`; reload-safe. Subsequent SDK calls become silent no-ops until `optIn` clears the flag. |
| **Reset** | `reset()` clears actor + session + queue + breadcrumbs and rotates the anonymous device id — used for "Forget me" / logout. |
| **Exit-flush** | `beforeunload` fires a `keepalive: true` POST so events queued seconds before navigation aren't lost. |
| **Bounded** | All inputs are sanitized: max 20 properties per event, max 64-char keys, max 256-char string values, payloads >64 KB are trimmed to fit. |

---

## SSR / Node compatibility

The SDK works in Node 18+. In a non-browser context (`typeof window === 'undefined'`), `Beacon.init` returns a no-op stub that satisfies the type signature without doing any work. Safe to call from server-rendered code paths.

```ts
// Next.js Server Component / Express / Cloudflare Worker — all safe
const beacon = Beacon.init({ apiKey, sourceApp, sourceVersion });
beacon.track('whatever');  // no-op on the server, real call in the browser
```

---

## Bundle size

The ESM build is **under 6 KB gzipped** — smaller than the typical analytics vendor (Segment ~30 KB, Amplitude ~25 KB, Mixpanel ~50 KB, PostHog ~80 KB). Run `npm run size` after `npm run build` to verify.

---

## Examples

A working browser example lives at [`sdk/examples/web`](https://github.com/softagility/beacon/tree/main/sdk/examples) in the main repo (where present) — covers init, identify, track, sessions, exception reporting, and graceful shutdown.

---

## Related

- **Beacon portal:** https://beacon.softagility.com
- **Other SDKs:** [.NET](https://www.nuget.org/packages/SoftAgility.Beacon), [C++](https://github.com/softagility/beacon-sdk-cpp)
- **REST API:** integrate without an SDK by POSTing to `/v1/events` directly
- **Source:** https://github.com/softagility/beacon-sdk-js

## License

MIT — see [LICENSE](LICENSE).
