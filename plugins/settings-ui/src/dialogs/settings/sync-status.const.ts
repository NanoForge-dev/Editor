import type { SyncStatus } from '@nanoforge-dev/editor-sdk';

/** What the dialog says of the account sync. */
export const SYNC_STATUS: Record<SyncStatus, string> = {
  idle: 'Account synced',
  syncing: 'Syncing…',
  pending: 'Changes waiting to sync',
  offline: 'Offline: changes sync later',
  conflict: 'Sync conflicts to resolve',
  error: 'Sync failed',
};
