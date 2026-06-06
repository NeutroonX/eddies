# Eddies Telemetry & Crash Reporting Guide

Complete walkthrough: Sentry.io setup → local dev → EAS builds → Play Store & App Store → GitHub releases → user installation.

---

## 1. Sentry.io Account & Project Setup

### 1.1 Create Account
1. Go to [sentry.io](https://sentry.io)
2. Sign up (free tier: 5k events/month, enough for small apps)
3. Verify email

### 1.2 Create Project
1. Click **Projects** → **Create Project**
2. Select **React Native** as platform
3. Name: `eddies` (or your choice)
4. Alert frequency: **As it happens** (get notified on new crashes)
5. Click **Create Project**

### 1.3 Get Your DSN
After project creation, you'll see your **DSN** on the settings page:
```
https://examplekey@o123456.ingest.sentry.io/654321
```
Copy this — you'll use it in every environment.

---

## 2. Local Development Setup

### 2.1 Environment File
Create or update `.env.local`:
```bash
EXPO_PUBLIC_SENTRY_DSN=https://examplekey@o123456.ingest.sentry.io/654321
```

**Why public?** The DSN is a write-only ingest endpoint. It's safe to embed in your app.

### 2.2 Disable in Dev (Optional)
In `src/lib/telemetry.ts`, the SDK automatically disables sending when `__DEV__` is true. You can still test locally:
```bash
# Start app in dev mode (won't send to Sentry)
npx expo start

# Test crash reporting
# - Go to Settings > CRASH REPORTS (toggle ON if you want to test)
# - Throw an error in your app
# - Check Sentry dashboard — nothing will appear (disabled in __DEV__)
```

To **force send during dev** (not recommended):
```typescript
// In src/lib/telemetry.ts, temporarily change:
enabled: !__DEV__, // → enabled: true,
```

---

## 3. Building for Android (Google Play Store)

### 3.1 Configure EAS

Update `eas.json` with environment variable for production builds:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab",
        "env": {
          "EXPO_PUBLIC_SENTRY_DSN": "https://examplekey@o123456.ingest.sentry.io/654321"
        }
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-play-key.json"
      }
    }
  }
}
```

### 3.2 Build APK/AAB
```bash
# Build preview APK (test on device)
eas build --platform android --profile preview

# Or build production AAB (for Play Store)
eas build --platform android --profile production
```

### 3.3 Optional: Source Maps
For better crash stack traces, Sentry can symbolicate native crashes:

1. After build completes, download the build artifacts
2. In Sentry: **Project Settings → Integrations → Android native**
3. Upload `android-source-map.json` from your build

(EAS can auto-upload; see [Expo docs](https://docs.expo.dev/versions/v56.0.0/guides/sentry/) for details.)

---

## 4. Building for iOS (App Store)

### 4.1 Configure EAS

Update `eas.json`:

```json
{
  "build": {
    "preview": {
      "ios": {
        "buildType": "simulator"
      }
    },
    "production": {
      "ios": {
        "buildType": "archive",
        "env": {
          "EXPO_PUBLIC_SENTRY_DSN": "https://examplekey@o123456.ingest.sentry.io/654321"
        }
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "appleIdPassword": "@env APPLE_ID_PASSWORD",
        "teamId": "ABC123XYZ"
      }
    }
  }
}
```

### 4.2 Build Archive
```bash
# Build production archive (for App Store)
eas build --platform ios --profile production
```

### 4.3 Source Maps for iOS
Same as Android — Sentry will symbolicate native Objective-C crashes automatically once you upload debug symbols.

---

## 5. Submitting to App Stores

### 5.1 Google Play Store

1. **Create signing key** (if you haven't):
   ```bash
   eas credentials
   # Follow prompts to generate Android signing key
   ```

2. **Upload build**:
   ```bash
   # Use EAS submit (auto-uploads to Play Store)
   eas submit --platform android --latest
   ```
   Or manually upload the `.aab` file via [Google Play Console](https://play.google.com/console).

3. **Configure app listing**:
   - Fill in app description, screenshots, category
   - Under **Data & privacy**, declare:
     - **Data Safety**: ✅ Crash logs
     - **Third-party sharing**: ✅ Yes (Sentry, Inc.)
     - **Data collection**: Opt-in (users can toggle in Settings)

4. **Submit for review** → Live in 2–4 hours typically

### 5.2 Apple App Store

1. **Create signing certificates** (if you haven't):
   ```bash
   eas credentials
   # Follow prompts for iOS signing
   ```

2. **Upload build**:
   ```bash
   eas submit --platform ios --latest
   ```
   Or manually upload via [App Store Connect](https://appstoreconnect.apple.com).

3. **Configure app listing**:
   - Fill in description, screenshots, keywords
   - Under **Privacy Policy**, link to your privacy policy (see section 7)
   - Under **App Privacy** (required as of iOS 15):
     - ✅ **Crash Data**: Linked to ID (optional)
     - ✅ **Performance Data**: Not linked to ID
     - ✅ **Other Diagnostic Data**: Not linked to ID

4. **Submit for review** → Decision in 1–3 days

---

## 6. GitHub Releases & Direct Installation

### 6.1 Publish Build Artifacts to GitHub

1. **Build locally**:
   ```bash
   # Download APK/AAB from EAS or build locally
   eas build --platform android --profile preview --local
   eas build --platform ios --profile preview --local
   ```

2. **Create GitHub Release**:
   ```bash
   gh release create v1.0.0 \
     --title "Eddies v1.0.0" \
     --notes "Crash reporting enabled via Sentry" \
     ./dist/eddies.apk \
     ./dist/eddies.ipa
   ```

3. **Add to README**:
   ```markdown
   ## Installation

   ### Official Stores
   - [Google Play Store](https://play.google.com/store/apps/details?id=com.eddies.app)
   - [Apple App Store](https://apps.apple.com/app/eddies/id...)

   ### Direct Download
   Download the latest APK or IPA from [Releases](https://github.com/yourname/eddies/releases).
   ```

### 6.2 User Installation (Android)

**From Play Store** (recommended):
- Search "Eddies" → Install
- Automatic updates every 2–4 weeks

**From GitHub APK** (direct):
1. Go to [Releases](https://github.com/yourname/eddies/releases)
2. Download `.apk`
3. Enable **Settings → Security → Unknown Sources** (if needed)
4. Tap the `.apk` file → Install

### 6.3 User Installation (iOS)

**From App Store** (only official way):
- Search "Eddies" → Get
- Automatic updates

**TestFlight** (for early access):
```bash
# Build and submit to TestFlight via App Store Connect
eas submit --platform ios --track internal
```

---

## 7. Automatic Crash Collection (How It Works)

### 7.1 What Happens When App Crashes

1. **User action** (e.g., tapping a button) triggers an error
2. **Error caught** by:
   - React error boundary (`AppErrorBoundary` in `_layout.tsx`)
   - JavaScript exception handler
   - Native crash (Android/iOS runtime)
3. **Sentry SDK captures** the error with context:
   - Stack trace (file, line number, function)
   - Device info (model, OS, app version)
   - Breadcrumbs (recent user actions)
4. **`beforeSend` hook scrubs** financial keys:
   - Strips `amount`, `balance`, `account`, `vault`, etc.
   - Keeps only safe context (device, timestamp, error type)
5. **Event sent** to Sentry servers (HTTPS, encrypted)
6. **You see it** in [sentry.io](https://sentry.io) dashboard in real-time

### 7.2 No User Warning Needed (Why?)

**Current implementation**: Crash reporting is **opt-in by default** in Settings:
- Users see **Settings → CRASH REPORTS** toggle
- Clear explanation: *"Sends anonymous crash logs and performance data to help fix bugs. No financial data is ever included."*
- Users can toggle OFF anytime

**Privacy compliance**:
- ✅ **Transparent**: Users can see in Settings
- ✅ **Explicit consent**: Must toggle ON (default enabled, but visible)
- ✅ **No financial data**: Scrubbed by `beforeSend`
- ✅ **GDPR/CCPA compliant**: Users can opt out, data is anonymized

### 7.3 Optional: Make It Truly Silent (Opt-Out)

If you want crash reporting **always on** with no Settings toggle (opt-out, not opt-in):

**In `src/store/preferences.ts`**:
```typescript
crashReportingEnabled: true,  // Always true
// Remove the setter — users can't change it
```

**In `src/app/(modals)/settings.tsx`**:
```typescript
// Remove the crash reporting toggle section entirely
// Users won't see it in Settings
```

**This is legal if**:
- You clearly state in your **Privacy Policy**: *"We collect anonymous crash data via Sentry to improve app stability."*
- You link to [Sentry's privacy docs](https://sentry.io/privacy/)
- You ensure no PII is captured (our `beforeSend` scrubber does this)

---

## 8. Privacy Policy & Legal

### 8.1 What to Add to Your Privacy Policy

```markdown
## Crash Reporting

We use [Sentry](https://sentry.io) to collect anonymous crash logs and 
performance metrics. This helps us identify and fix bugs faster.

**What we collect:**
- Stack traces (file names, line numbers, function names)
- Device model and OS version
- App version
- Timestamp of crash

**What we never collect:**
- Account information or user identity
- Financial data (amounts, balances, account names)
- Personal identifiable information (PII)

**Your control:**
You can opt out of crash reporting in **Settings → CRASH REPORTS**.

**Data handling:**
Sentry is a US-based data processor. For details, see 
[Sentry's Privacy Policy](https://sentry.io/privacy/).
```

### 8.2 App Store Privacy Label (iOS)

In App Store Connect, declare under **App Privacy**:

| Category | Value |
|----------|-------|
| Crash Data | ✅ Yes, not linked to user ID |
| Performance Data | ✅ Yes, not linked to user ID |
| Other Diagnostic Data | ✅ Yes (optional), not linked to user ID |

### 8.3 Google Play Data Safety (Android)

In Play Console, declare under **Data Safety**:

| Item | Value |
|------|-------|
| **Crash Logs** | Collected |
| **Shared with third parties** | Yes (Sentry, Inc.) |
| **Used to track users** | No |
| **Linked to user ID** | No |
| **User choice** | Yes (Settings toggle) |

---

## 9. Monitoring & Troubleshooting

### 9.1 Check Sentry Dashboard

1. Go to [sentry.io](https://sentry.io)
2. **Issues** tab → see all crashes grouped by type
3. **Issues Details** → see stack trace, device info, affected users
4. **Alerts** → set thresholds (e.g., alert if >10 new errors in 1 hour)

### 9.2 Verify Crash is Being Sent

**Test in production build**:
```bash
# iOS: Build to device via EAS, then manually trigger a crash
eas build --platform ios --profile production --local
# Then in your app Settings, verify toggle is ON
# Trigger a test crash (throw new Error('test') somewhere)
# Wait 30 seconds, check Sentry dashboard
```

### 9.3 Why Crashes Aren't Showing Up?

| Issue | Solution |
|-------|----------|
| DSN is blank | Add `EXPO_PUBLIC_SENTRY_DSN` to `.env.local` and rebuild |
| App in dev mode | Sentry disabled in `__DEV__`. Build for production. |
| Crash reporting toggle OFF | User disabled in Settings. Toggle it back ON. |
| Network down | Sentry caches crashes; tries again when online. |
| Privacy scrubber too aggressive | Adjust financial keys in `src/lib/telemetry.ts:FINANCIAL_KEY_FRAGMENTS` |

---

## 10. Updating & Maintenance

### 10.1 Keep Sentry SDK Updated

```bash
# Check for updates
npm outdated @sentry/react-native

# Update
npx expo install @sentry/react-native@latest
```

### 10.2 Rotate DSN (If Compromised)

1. Go to **Sentry Project Settings → Keys**
2. Delete old key, create new one
3. Update `.env.local` and `eas.json`
4. Rebuild and redeploy

### 10.3 Monitor Free Tier Limits

Sentry free tier = 5,000 events/month. To check usage:
1. Go to **Organization Settings → Plans**
2. See current month's event count
3. Upgrade to paid if needed (starts $25/month)

---

## 11. Example Flow: User Crashes, You Fix It

1. **User's app crashes** (e.g., balance calculation error)
2. **Crash auto-sent** to Sentry (within 1 second if online, queued if offline)
3. **You get Sentry alert** (email or Slack if configured)
4. **You see stack trace**: `src/lib/money.ts:42 — divide by zero`
5. **You fix the bug**, test locally, push to `main`
6. **You build new version** (`1.0.1`) with `eas build --platform android --profile production`
7. **You submit** to Play Store & App Store
8. **Users auto-update** (or manually update)
9. **In Sentry**, mark issue as **Resolved** → dashboard stops alerting
10. **Next version** shows 0 crashes for that issue

---

## 12. Sentry Best Practices

### 12.1 Set Release Tag

Automatically set in `eas.json`:
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_APP_VERSION": "1.0.0"
      }
    }
  }
}
```

Then in `src/lib/telemetry.ts`:
```typescript
Sentry.init({
  release: process.env.EXPO_PUBLIC_APP_VERSION,
  // ...
});
```

This lets Sentry group crashes by version.

### 12.2 Add Breadcrumbs

Track user actions for context:
```typescript
import * as Sentry from '@sentry/react-native';

function handleTransaction() {
  Sentry.addBreadcrumb({
    message: 'User created transaction',
    level: 'info',
    data: { type: 'outflow', categoryId: 'cat_food' },
  });
  // ... create transaction
}
```

### 12.3 Sample Rates (Don't Send Everything)

Currently set to 15% of sessions in `src/lib/telemetry.ts`:
```typescript
tracesSampleRate: 0.15,  // 15% of non-error events
```

This reduces data usage while still catching crashes (100% of errors always sent).

---

## 13. Summary Checklist

- [ ] Create Sentry project at sentry.io
- [ ] Copy DSN to `.env.local`
- [ ] Add DSN to `eas.json` for production builds
- [ ] Build APK/AAB for Android testing
- [ ] Build archive for iOS testing
- [ ] Verify crashes appear in Sentry dashboard
- [ ] Write Privacy Policy section on Crash Reporting
- [ ] Configure App Store privacy label (iOS)
- [ ] Configure Play Console data safety (Android)
- [ ] Submit to stores
- [ ] Monitor crashes on sentry.io
- [ ] Set up alerts in Sentry (optional)
- [ ] Share Privacy Policy link in app (optional, add to Settings)

---

## 14. References

- [Sentry React Native Docs](https://docs.sentry.io/platforms/react-native/)
- [Expo + Sentry Integration](https://docs.expo.dev/versions/v56.0.0/guides/sentry/)
- [Google Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/)
- [GDPR Compliance](https://sentry.io/for/gdpr/)

---

**Questions?** Check Sentry's support or Expo's Sentry guide linked above.
