/** SDK configuration passed to `Beacon.init()`. */
export interface BeaconConfig {
  /** API key for the `Authorization: Bearer` header. Required, non-empty. */
  apiKey: string;
  /** Application identifier. Required, non-empty, max 128 chars. */
  product: string;
  /** Application version. Required, non-empty, max 256 chars. */
  productVersion: string;
  /** Inactivity timeout in minutes before a session rotates. Default 30, clamped [1, 1440]. */
  sessionTimeoutMinutes?: number;
  /** When true, hooks `pushState` and `popstate` for auto page views. Default true. */
  autoPageViews?: boolean;
  /** Flush interval in milliseconds. Default 10000, clamped [1000, 300000]. */
  flushIntervalMs?: number;
  /** Maximum events per flush batch. Default 50, clamped [1, 1000]. */
  maxBatchSize?: number;
  /** Override API base URL. Must start with https:// or http:// if set. */
  endpoint?: string;
  /** When true, SDK actions are logged via console.debug. Default false. */
  debug?: boolean;
  /** Maximum in-memory queue depth. Default 5000, clamped [100, 10000]. */
  maxQueueSize?: number;
  /** Breadcrumb ring buffer capacity. Default 25, clamped [0, 200]. 0 disables breadcrumbs. */
  maxBreadcrumbs?: number;
}

/** Resolved configuration with all defaults applied and values clamped. */
export interface ResolvedConfig {
  apiKey: string;
  product: string;
  productVersion: string;
  sessionTimeoutMinutes: number;
  autoPageViews: boolean;
  flushIntervalMs: number;
  maxBatchSize: number;
  endpoint: string;
  debug: boolean;
  maxQueueSize: number;
  maxBreadcrumbs: number;
}

/** Per-event payload sent in the `POST /v1/events` JSON array body. */
export interface OutboundEventPayload {
  event_id: string;
  category: string;
  name: string;
  timestamp: string;
  actor_id: string;
  product: string;
  product_version: string;
  session_id?: string;
  /** Opaque account identifier set via `setAccount()`. Omitted entirely from the
   *  payload when not set — ingest distinguishes "absent" from "present but invalid". */
  account_id?: string;
  /** Opaque license identifier set via `setLicense()`. Omitted entirely from the
   *  payload when not set — ingest distinguishes "absent" from "present but invalid". */
  license_id?: string;
  properties?: Record<string, string | number | boolean>;
}

/** Body for `POST /v1/events/sessions`. */
export interface SessionStartPayload {
  session_id: string;
  actor_id: string;
  product: string;
  product_version: string;
  started_at: string;
  /** Opaque account identifier set via `setAccount()`. Omitted when not set. */
  account_id?: string;
  /** Opaque license identifier set via `setLicense()`. Omitted when not set. */
  license_id?: string;
}

/** Body for `POST /v1/events/sessions/end`. */
export interface SessionEndPayload {
  session_id: string;
  ended_at: string;
  end_reason: string;
}

/** Body for `POST /v1/events/exceptions`. */
export interface ExceptionPayload {
  exception_id: string;
  exception_type: string;
  severity: 'fatal' | 'non_fatal';
  occurred_at: string;
  actor_id: string;
  product: string;
  product_version: string;
  message?: string;
  stack_trace?: string;
  session_id?: string;
  /** Opaque account identifier set via `setAccount()`. Omitted when not set. */
  account_id?: string;
  /** Opaque license identifier set via `setLicense()`. Omitted when not set. */
  license_id?: string;
  breadcrumbs?: BreadcrumbEntry[];
}

/** Element of the `breadcrumbs` array in `ExceptionPayload`. */
export interface BreadcrumbEntry {
  category: string;
  name: string;
  timestamp: string;
  properties?: Record<string, string | number | boolean>;
}

/** Base64-encoded JSON sent as `X-Environment-Data` header. */
export interface BrowserEnvironmentData {
  browser_name: string;
  browser_version: string;
  screen_width: number;
  screen_height: number;
  viewport_width: number;
  viewport_height: number;
  language: string;
  device_type: string;
  platform: string;
  connection_type?: string;
}

/** Event definition for the event registry. */
export interface EventDefinition {
  category: string;
  name: string;
}

/** JSON output of `beacon.events.exportManifest()`. */
export interface EventManifest {
  schema_version: string;
  generated_at: string;
  product: string;
  events: EventDefinition[];
}

/** Severity level for error tracking. */
export type ErrorSeverity = 'fatal' | 'non_fatal';

/** The sub-object exposed as `beacon.events`. */
export interface EventsApi {
  define(category: string, name: string): void;
  exportManifest(): string;
}
