import { useRouter } from 'expo-router';
import { useShareIntent } from 'expo-share-intent';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';
import { setPendingShare } from '@/lib/pending-share';

/**
 * Catches content shared into the app from another app (WhatsApp, Photos, Files, …) — the
 * native side (see app.json's expo-share-intent plugin config) hands us a cold-start or
 * resume event with the shared file(s); this stashes them (see lib/pending-share.ts) and routes
 * to the picker screen that decides what to do with them. Mounted once at the true root
 * (src/app/_layout.tsx), same place AuthGate lives, so it catches a share even when the app was
 * fully closed and just launched because of it.
 *
 * Requires a custom dev/production build — this native module doesn't exist in Expo Go, so
 * `useShareIntent` simply never fires there (safe no-op, not a crash).
 */
export function ShareIntentGate() {
  const { user } = useAuth();
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (!hasShareIntent || !user) return;

    const files = (shareIntent.files ?? [])
      .filter((f) => f.path)
      .map((f) => ({ uri: f.path, name: f.fileName || `shared-${Date.now()}`, mimeType: f.mimeType || 'application/octet-stream' }));

    resetShareIntent();

    if (files.length === 0) return;
    setPendingShare(files);
    router.push('/shared-content');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShareIntent, user]);

  return null;
}
