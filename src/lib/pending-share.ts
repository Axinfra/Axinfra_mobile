/**
 * Holds a file shared into the app from another app (e.g. WhatsApp) between the moment
 * shared-content.tsx routes the user to an upload screen and the moment that screen actually
 * reads it — a plain in-memory singleton, not React state, since it only ever needs to survive
 * a screen navigation within the same running app instance, never a reload or a restart.
 */
export interface PendingShareFile {
  uri: string;
  name: string;
  mimeType: string;
}

let pending: PendingShareFile[] | null = null;

export function setPendingShare(files: PendingShareFile[]) {
  pending = files.length > 0 ? files : null;
}

/** Reads and clears — a screen that consumes the shared file(s) should call this once, so
 * navigating back to the same screen later doesn't re-attach a stale share. */
export function takePendingShare(): PendingShareFile[] | null {
  const files = pending;
  pending = null;
  return files;
}

export function hasPendingShare(): boolean {
  return pending != null && pending.length > 0;
}
