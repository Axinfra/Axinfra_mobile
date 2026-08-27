import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthGate } from '@/components/auth-gate';
import { ShareIntentGate } from '@/components/share-intent-gate';
import { AuthProvider } from '@/lib/auth';
import { queryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    // Required by the (app) group's Drawer navigator (react-native-gesture-handler powers its
    // swipe-to-open/close) — belongs at the true root of the app, not nested under the group
    // that actually uses it, so gestures work correctly everywhere.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AnimatedSplashOverlay />
            <ShareIntentGate />
            <AuthGate />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
