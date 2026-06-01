# Changelog

All notable changes to the SoftAgility Beacon JS/TS SDK are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.0.0] - 2026-05-31

### BREAKING

- Renamed the config field `sourceApp` to `product` in `Beacon.init(config)`. The value is unchanged — it is still the registered product slug.
- Renamed the outbound wire field `source_app` to `product` on every emission: event (`POST /v1/events`), session-start (`POST /v1/events/sessions`), exception (`POST /v1/events/exceptions`), actor-identify, and the event manifest export (`events.exportManifest()`).

Migration: rename `sourceApp` to `product` in your `Beacon.init({ ... })` call. No other changes are required. `sourceVersion` / `source_version` is unaffected.

## [1.1.0] - 2026-05-23

### Added

- `setAccount(accountId)` and `clearAccount()` — attach a per-customer account identifier to subsequent events, sessions, and exceptions. Enables Beacon's account-grain analytics (Account Detail page, account-grain segments/funnels/retention) for vendors with multi-tenant or multi-customer apps.
- `setLicense(licenseId)` and `clearLicense()` — attach a per-contract license identifier. **Prefer per-contract IDs over per-user IDs** for richer License Detail analytics. See `setLicense` JSDoc for guidance.
- `account_id` and `license_id` fields on `OutboundEventPayload`, `SessionStartPayload`, and `ExceptionPayload` types.
- Validation matches the .NET SDK and ingest validator: 1-256 chars after trim, no whitespace-only, no control characters (including U+2028/U+2029). Invalid inputs are silently ignored — calls never throw.

### Changed

- `reset()` now clears the account and license context in addition to clearing the actor and session.

## [1.0.0] - 2026-05-07

### Added

- Initial public release
- `Beacon.init(config)` singleton factory
- `track`, `trackError`, `identify`, `pageView`, `flush`, `reset`, `optOut`, `optIn`, `destroy`, `getSessionId`, `getActorId` instance methods
- `events.define(category, name)` + `events.exportManifest()` for portal manifest upload
- Anonymous-by-default device identity (UUIDv7) with deterministic linking on `identify`
- Idle-timeout session rotation; environment data sent once per session
- Breadcrumb ring buffer auto-attached to exception reports
- Auto-instrumentation of `history.pushState` and `popstate` for SPAs (opt-out via `autoPageViews: false`)
- `keepalive: true` exit-flush on `beforeunload`
- ESM + CJS + UMD output (under 6 KB gzipped)
- jsDelivr / unpkg CDN snippet-paste install path
- Full TypeScript types
- Targets browsers + Node 18+

### Fixed

- **Default `endpoint` now points at `https://api.beacon.softagility.com`.** The previous default of `https://beacon.softagility.com` was the dashboard URL (Next.js frontend), not the API URL. Customers using the snippet-paste install path without an explicit `endpoint` config would hit the frontend and receive a Next.js 404 on every event POST.
- **`flushAll` now honours the `Retry-After` backoff after a 429 response.** Without this guard, a 429 from the server caused `flush()` (which uses `flushAll`) to re-queue the batch and immediately retry in a tight loop, allocating an `Array.prototype.slice` on every iteration and ultimately crashing the browser tab with an out-of-memory error. The fix adds the same `_rau` (retry-after) check to `flushAll` that `flush()` already had, so a 429 leaves exactly one HTTP call per `flush()` invocation and the events stay queued until the backoff window expires.

### Changed

- **UMD global is now the `Beacon` class itself** (`Beacon.init(...)`), not a namespaced object (`Beacon.Beacon.init(...)`). Switches the UMD bundle to a default-export entry point so the snippet-paste path matches the README and behaves the way customers expect.
