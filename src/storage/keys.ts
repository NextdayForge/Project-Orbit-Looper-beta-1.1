export const STORAGE_KEYS = {
  looperData: 'looper-data',
  looperDecisions: 'looper-decisions',
  /** pre-rebrand keys — read once for migration, then looper-data takes over */
  legacyOrbitData: 'orbit-data',
  legacyOrbitDecisions: 'orbit-decisions',
  /** v1 legacy key — read once for migration, then looper-data takes over */
  legacyV1: 'my-calendar-app-data',
  /** v1 backup before first migration (Architecture v1.1 / Migration Spec) */
  legacyV1Backup: 'my-calendar-app-data-v1-backup',
} as const;

export const DEBOUNCE_MS = 500;

export const DECISION_LOG_RETENTION_DAYS = 90;
