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
  product:       'my-app',           // the registered product on every event
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
    product:       'marketing-site',
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
| `beacon.setAccount(accountId)` / `beacon.clearAccount()` | Attach (or clear) an opaque per-customer account identifier on subsequent events, sessions, and exceptions. See below for guidance. |
| `beacon.setLicense(licenseId)` / `beacon.clearLicense()` | Attach (or clear) an opaque per-contract license identifier. **Prefer per-contract IDs** — see below. |
| `beacon.reset()` | Clear actor + session + queue + breadcrumbs + account + license. Rotates the anonymous device id. Used on logout. |
| `beacon.destroy()` | Stop all timers and release resources. The instance becomes inert. |
| `beacon.getSessionId()` / `beacon.getActorId()` | Read current state. |

---

## Configuration

| Field | Default | Range | Notes |
|---|---|---|---|
| `apiKey` | required | — | API key from the Beacon portal. Sent as `Authorization: Bearer`. |
| `product` | required | ≤128 chars | The registered product on every event. Must match a registered product in the portal. |
| `sourceVersion` | required | ≤256 chars | `source_version`. Auto-registers on first event. |
| `endpoint` | `https://api.beacon.softagility.com` | URL | Override for self-hosted / staging. |
| `sessionTimeoutMinutes` | `30` | 1-1440 | Inactivity window before a new session rotates. |
| `autoPageViews` | `true` | — | Hook `history.pushState` and `popstate` for auto page views. |
| `flushIntervalMs` | `10000` | 1000-300000 | Background flush cadence. |
| `maxBatchSize` | `50` | 1-1000 | Events per HTTP batch. |
| `maxQueueSize` | `5000` | 100-10000 | In-memory queue depth (oldest dropped on overflow). |
| `maxBreadcrumbs` | `25` | 0-200 | Breadcrumb ring buffer; `0` disables. |
| `debug` | `false` | — | Enable `console.debug` SDK logs. |

---

## Account & License Context

Beacon supports two optional analytics dimensions beyond the per-user `actor_id`:

- **Account** — the vendor's customer account or organization (e.g., a workspace, tenant, team)
- **License** — the contract, subscription, or entitlement under which usage is occurring

Both are pseudonymous opaque strings (1-256 chars). Attach them once after sign-in and every subsequent event, session, and exception carries the context until you clear it or call `reset()`.

```ts
beacon.identify('user-12345');
beacon.setAccount('acct-acme-corp');
beacon.setLicense('sub_1234567890');         // single shared subscription / contract id

beacon.track('feature', 'export');           // emits with account_id + license_id
```

### Modeling licenses — prefer per-contract IDs

The richest Beacon analytics surface (the **License Detail** page, plan-overuse alerts, multi-account-sharing warnings) only lights up when many users emit events under the **same** `license_id`. Pick a string that all users on the same contract / subscription / site key share:

**Recommended** (per-contract id):

```ts
// All 50 users at Acme Corp send the same license_id
beacon.setLicense('sub_acme_corp_pro_annual');
```

**Avoid** (per-user id):

```ts
// Each user sends their own — License Detail becomes a duplicate of the Actor Identities view
beacon.setLicense(`license-for-${userId}`);
```

The `/accounts` and `/licenses` pages in the Beacon portal require the **Business** plan or higher. Ingestion is plan-blind — events emitted on lower plans still carry `account_id`/`license_id` and become visible the moment the plan is upgraded.

### Validation

Invalid inputs are silently ignored — calls never throw. Rules (matching the .NET SDK and ingest validator):

- 1-256 characters after trimming
- No whitespace-only strings
- No control characters (`\r`, `\n`, `\t`, U+2028, U+2029, etc.)

Enable `debug: true` in `init()` to see `console.warn` messages explaining why an input was rejected.

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
const beacon = Beacon.init({ apiKey, product, sourceVersion });
beacon.track('whatever');  // no-op on the server, real call in the browser
```

---

## Bundle size

The ESM build is **under 6 KB gzipped** — smaller than the typical analytics vendor (Segment ~30 KB, Amplitude ~25 KB, Mixpanel ~50 KB, PostHog ~80 KB). Run `npm run size` after `npm run build` to verify.

---

## Related

- **Beacon portal:** https://beacon.softagility.com
- **Other SDKs:** [.NET](https://www.nuget.org/packages/SoftAgility.Beacon), [C++](https://github.com/SoftAgility/beacon-sdk-cpp)
- **REST API:** integrate without an SDK by POSTing to `/v1/events` directly
- **Source:** https://github.com/SoftAgility/beacon-sdk-js

## License

MIT — see [LICENSE](LICENSE).
