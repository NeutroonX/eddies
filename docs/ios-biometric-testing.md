# iOS Biometric Lock — Test Checklist

> Requires a native build (Expo Go won't work). Run:
> `eas build --profile preview --platform ios`

## Prerequisites

- [ ] Fresh install on a real iOS device (Face ID or Touch ID)
- [ ] Logged in and invite validated

---

## Setup

- [ ] App lock setup screen appears after first login (once, before tabs load)
- [ ] Tapping **ENABLE LOCK** triggers a Face ID / Touch ID prompt
- [ ] Approving the prompt enables the lock and dismisses the setup screen
- [ ] Tapping **SKIP FOR NOW** dismisses the setup screen without enabling the lock
- [ ] If no biometric is enrolled on the device, "NO BIOMETRIC HARDWARE ENROLLED" error shows and lock is not enabled

---

## Lock screen — on launch

- [ ] With lock enabled: lock screen appears immediately on every cold launch
- [ ] Face ID / Touch ID prompt fires automatically without tapping anything
- [ ] Approving unlocks the app and dismisses the lock screen
- [ ] Tapping **Cancel** on the Face ID sheet leaves the lock screen visible with no error state (no "FAILED" message)
- [ ] Tapping **UNLOCK** button manually re-triggers the prompt

---

## Lock screen — background / foreground

- [ ] Sending the app to background then returning shows the lock screen
- [ ] Lock screen appears even after a short background period (not just cold launch)
- [ ] Same cancel-vs-failure behaviour as above

---

## Lock screen — failure states

- [ ] Failing biometric once shows "FAILED — TRY AGAIN"
- [ ] Failing multiple times shows the attempt count: "FAILED (2×) — TRY AGAIN"
- [ ] After iOS biometric lockout, passcode fallback is offered by iOS (disableDeviceFallback is false)

---

## Settings toggle

- [ ] App Lock toggle is visible in Settings on iOS (no longer Android-only)
- [ ] Toggling on triggers a biometric prompt to confirm
- [ ] Toggling off immediately disables the lock with no prompt
- [ ] State persists across app restarts

---

## Auth screen guard

- [ ] With lock enabled, logging out and returning to the login screen does **not** show the lock overlay on top of the auth screen

---

## Balance redaction

- [ ] Home screen balances show `••••••` while locked
- [ ] Balances reveal after successful biometric authentication
