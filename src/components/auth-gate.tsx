import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Brand } from '@/constants/brand';
import { useAuth } from '@/lib/auth';

/**
 * Redirects between the login screen and the authenticated app based on
 * session state, and blocks rendering the wrong stack while the persisted
 * session is being restored on app start.
 */
export function AuthGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthScreen = segments[0] === 'login' || segments[0] === 'register';

    if (!user && !inAuthScreen) {
      router.replace('/login');
    } else if (user && inAuthScreen) {
      router.replace('/');
    }
  }, [user, isLoading, segments, router]);

  if (isLoading) {
    // Matches the login/register screens' background so there's no flash of
    // a different theme before the redirect above lands.
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.base }}>
        <ActivityIndicator color={Brand.accent} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
