# Changelog

All notable changes to the SoftAgility Beacon JS/TS SDK are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
