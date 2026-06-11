import React from 'react';
import * as Sentry from '@sentry/react-native';
import {
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
} from '@expo-google-fonts/rajdhani';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { DarkTheme, ThemeProvider, router, Stack, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/lib/cloud/query-client';
import { runMigrations } from '@/lib/db/migrations';
import { GlobalToast } from '@/components/ui/global-toast';
import { useArchiveCheck } from '@/hooks/use-archive-check';
import { useInitSettings } from '@/hooks/use-init-settings';
import { useStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { captureError, initTelemetry } from '@/lib/telemetry';
import { BiometricSetup } from '@/components/biometric/biometric-setup';
import { BiometricLock } from '@/components/biometric/biometric-lock';

// Initialise Sentry before any React render so native crash handler is ready.
initTelemetry();

SplashScreen.preventAutoHideAsync();

// ── Error boundary ─────────────────────────────────────────────────────────
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
          <Pressable onPress={() => this.setState({ error: null })} style={eb.btn} accessibilityRole="button" accessibilityLabel="Retry">
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

// ── Biometric gate ─────────────────────────────────────────────────────────
// Shows setup prompt on first entry, lock screen on subsequent launches and
// when app returns from background. Works on both Android and iOS.
function BiometricGate() {
  const { biometricStatus, inviteValidated, appLocked, setAppLocked } = useStore(
    useShallow((s) => ({
      biometricStatus: s.biometricStatus,
      inviteValidated: s.inviteValidated,
      appLocked: s.appLocked,
      setAppLocked: s.setAppLocked,
    }))
  );
  const segments         = useSegments();

  const appState = useRef(AppState.currentState);

  // Lock when app moves to background, unlock prompt when it returns.
  useEffect(() => {
    if (biometricStatus !== 'enabled') return;

    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current === 'active' && next === 'background') {
        setAppLocked(true);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [biometricStatus, setAppLocked]);

  // Lock on first mount when biometric is enabled and the user is logged in.
  // Guard on inviteValidated so the lock overlay never fires on the auth screen.
  useEffect(() => {
    if (inviteValidated !== true) return;
    if (biometricStatus === 'enabled') {
      setAppLocked(true);
    }
  }, [biometricStatus, inviteValidated, setAppLocked]);

  const inTabs = segments[0] === '(tabs)';

  // Setup prompt: shown after invite validation, before user enters tabs.
  if (biometricStatus === 'pending' && inviteValidated === true && inTabs) {
    return <BiometricSetup />;
  }

  // Lock screen: blurs the underlying app and requests verification.
  if (biometricStatus === 'enabled' && appLocked) {
    return <BiometricLock />;
  }

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

  const { onboardingComplete, inviteValidated } = useStore(
    useShallow((s) => ({ onboardingComplete: s.onboardingComplete, inviteValidated: s.inviteValidated }))
  );

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
        <QueryClientProvider client={queryClient}>
        <SQLiteProvider databaseName="eddies.db" onInit={runMigrations}>
          <ThemeProvider value={DarkTheme}>
            <StatusBar style="light" />
            <ArchiveWatcher />
            <OnboardingGate />
            <InviteGate />
            <BiometricGate />
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
              <Stack.Screen name="(modals)/export"   options={modalOptions} />
              <Stack.Screen name="(modals)/archive"  options={modalOptions} />
              <Stack.Screen name="(modals)/recurring"      options={modalOptions} />
              <Stack.Screen name="(modals)/recurring-edit" options={modalOptions} />
              <Stack.Screen name="(modals)/cloud-backup"  options={modalOptions} />
            </Stack>
            <GlobalToast />
          </ThemeProvider>
        </SQLiteProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
