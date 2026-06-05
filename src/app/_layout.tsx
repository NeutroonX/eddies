import {
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
} from '@expo-google-fonts/rajdhani';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { DarkTheme, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { runMigrations } from '@/lib/db/migrations';
import { GlobalToast } from '@/components/ui/global-toast';
import { useArchiveCheck } from '@/hooks/use-archive-check';
import { useStore } from '@/store';

SplashScreen.preventAutoHideAsync();

// Mounted inside SQLiteProvider so it can access the DB.
function ArchiveWatcher() {
  useArchiveCheck();
  const archivePrompt = useStore((s) => s.archivePrompt);

  useEffect(() => {
    if (archivePrompt) {
      router.push('/(modals)/archive');
    }
  }, [archivePrompt]);

  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="eddies.db" onInit={runMigrations}>
        <ThemeProvider value={DarkTheme}>
          <StatusBar style="light" />
          <ArchiveWatcher />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(modals)/entry"   options={{ presentation: 'modal', gestureEnabled: false }} />
            <Stack.Screen name="(modals)/vault"   options={{ presentation: 'modal', gestureEnabled: false }} />
            <Stack.Screen name="(modals)/settings" options={{ presentation: 'modal', gestureEnabled: false }} />
            <Stack.Screen name="(modals)/cap"     options={{ presentation: 'modal', gestureEnabled: false }} />
            <Stack.Screen name="(modals)/export"  options={{ presentation: 'modal', gestureEnabled: false }} />
            <Stack.Screen name="(modals)/archive" options={{ presentation: 'modal', gestureEnabled: false }} />
          </Stack>
          <GlobalToast />
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
