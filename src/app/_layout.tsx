import {
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
} from '@expo-google-fonts/rajdhani';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { DarkTheme, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { runMigrations } from '@/lib/db/migrations';

SplashScreen.preventAutoHideAsync();

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
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="(modals)/entry"
              options={{ presentation: 'modal', gestureEnabled: true }}
            />
            <Stack.Screen
              name="(modals)/vault"
              options={{ presentation: 'modal', gestureEnabled: true }}
            />
          </Stack>
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
