// Dynamic Expo config layered on top of the static app.json.
//
// Play Protect blocks any distributed build that declares
// `android.permission.READ_SMS` as "financial fraud", and the Play Store
// SMS/Call-Log policy forbids READ_SMS for expense tracking. So READ_SMS is
// NOT in app.json — it is injected here only for builds that opt in via the
// EXPO_PUBLIC_SMS_NATIVE env flag (set per-profile in eas.json).
//
//   internal / development  -> flag "1" -> READ_SMS present (pull path works)
//   preview / production     -> flag off -> NO READ_SMS (Play-compliant)
//
// Expo 56: when both app.json and app.config.js exist, app.json is read first
// and passed in as `config`; the value returned here is authoritative.
// See docs/sms-play-compliance-plan.md (Phase 1).

const SMS_NATIVE = process.env.EXPO_PUBLIC_SMS_NATIVE === '1';

module.exports = ({ config }) => {
  if (!SMS_NATIVE) return config;

  const android = config.android ?? {};
  const permissions = android.permissions ?? [];

  return {
    ...config,
    android: {
      ...android,
      permissions: permissions.includes('android.permission.READ_SMS')
        ? permissions
        : [...permissions, 'android.permission.READ_SMS'],
    },
  };
};
