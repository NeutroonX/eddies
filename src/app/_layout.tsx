import React from 'react';
import * as Sentry from '@sentry/react-native';
import {
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
} from '@expo-google-fonts/rajdhani';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { DarkTheme, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { runMigrations } from '@/lib/db/migrations';
import { GlobalToast } from '@/components/ui/global-toast';
import { useArchiveCheck } from '@/hooks/use-archive-check';
import { useInitSettings } from '@/hooks/use-init-settings';
import { useStore } from '@/store';
import { captureError, initTelemetry } from '@/lib/telemetry';

// Initialise Sentry before any React render so native crash handler is ready.
initTelemetry();

SplashScreen.preventAutoHideAsync();

// ── Error boundary ─────────────────────────────────────────────────────────
// Catches render errors (e.g. Zod parse throw on schema drift) so a single
// bad row never white-screens the entire app.
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { captureError(error); }
  render() {
    if (this.state.error) {
      return (
        <View style={eb.wrap}>
          <Text style={eb.title}>SOMETHING WENT WRONG</Text>
          <Text style={eb.msg}>{String(this.state.error.message)}</Text>
          <Pressable onPress={() => this.setState({ error: null })} style={eb.btn}>
            <Text style={eb.btnText}>RETRY</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#E24B4A', letterSpacing: 3, fontSize: 13, marginBottom: 12 },
  msg: { color: '#8A8F98', fontSize: 11, textAlign: 'center', marginBottom: 24, lineHeight: 17 },
  btn: { borderWidth: 1, borderColor: '#E24B4A', paddingHorizontal: 20, paddingVertical: 10 },
  btnText: { color: '#E24B4A', letterSpacing: 2, fontSize: 11 },
});

// ── Archive watcher ────────────────────────────────────────────────────────
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

// ── Onboarding gate ────────────────────────────────────────────────────────
function OnboardingGate() {
  useInitSettings();
  const onboardingComplete = useStore((s) => s.onboardingComplete);
  const segments           = useSegments();

  useEffect(() => {
    if (onboardingComplete === null) return;
    const inOnboarding = segments[0] === '(onboarding)';
    if (!onboardingComplete && !inOnboarding) {
      router.replace('/(onboarding)');
    }
  }, [onboardingComplete, segments]);

  return null;
}

// ── Invite gate ────────────────────────────────────────────────────────────
// Bidirectional: sends validated users to tabs, unvalidated users to auth.
// null = still loading from SQLite — do nothing to avoid premature redirects.
function InviteGate() {
  const onboardingComplete = useStore((s) => s.onboardingComplete);
  const inviteValidated    = useStore((s) => s.inviteValidated);
  const segments           = useSegments();

  useEffect(() => {
    if (onboardingComplete !== true) return;
    if (inviteValidated === null) return;

    const inAuth = segments[0] === '(auth)';
    if (inviteValidated && inAuth) {
      router.replace('/(tabs)');
    } else if (!inviteValidated && !inAuth) {
      router.replace('/(auth)');
    }
  }, [onboardingComplete, inviteValidated, segments]);

  return null;
}

// ── Root layout ────────────────────────────────────────────────────────────
function RootLayout() {
  const [loaded, error] = useFonts({
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  const onboardingComplete = useStore((s) => s.onboardingComplete);
  const inviteValidated    = useStore((s) => s.inviteValidated);

  const fontsReady    = loaded || !!error;
  const settingsReady = onboardingComplete !== null && inviteValidated !== null;

  useEffect(() => {
    if (fontsReady && settingsReady) SplashScreen.hideAsync();
  }, [fontsReady, settingsReady]);

  const modalOptions = {
    gestureEnabled: false,
    presentation: 'modal' as const,
    contentStyle: { backgroundColor: '#000000' },
  };

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SQLiteProvider databaseName="eddies.db" onInit={runMigrations}>
          <ThemeProvider value={DarkTheme}>
            <StatusBar style="light" />
            <ArchiveWatcher />
            <OnboardingGate />
            <InviteGate />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="(onboarding)"
                options={{ animation: 'fade', gestureEnabled: false }}
              />
              <Stack.Screen
                name="(auth)"
                options={{ animation: 'fade', gestureEnabled: false }}
              />
              <Stack.Screen name="(modals)/entry"   options={modalOptions} />
              <Stack.Screen name="(modals)/vault"   options={modalOptions} />
              <Stack.Screen name="(modals)/settings" options={modalOptions} />
              <Stack.Screen name="(modals)/cap"     options={modalOptions} />
              <Stack.Screen name="(modals)/export"  options={modalOptions} />
              <Stack.Screen name="(modals)/archive" options={modalOptions} />
            </Stack>
            <GlobalToast />
          </ThemeProvider>
        </SQLiteProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
