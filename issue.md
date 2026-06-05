# Known Issues

## White Flash on Modal Close (Android/Expo Go)

**Status:** Open - Under Investigation

**Affected Screens:**
- LOG modal (Entry form)
- VAULTS modal (Add/Edit vault)

**Behavior:**
When closing either modal by pressing CLOSE or SAVE buttons, a white screen flashes briefly before the modal dismisses. This happens on both Android and Expo Go.

**Symptoms:**
- Modal closes with a jerky/glitchy animation
- White flash appears momentarily
- Not smooth like typical modal animations
- Happens on both close button and save button actions

**Attempted Fixes:**
1. ✅ Dismissed keyboard before closing (works but didn't fix the flash)
2. ✅ Disabled gesture-based dismiss (didn't fix)
3. ✅ Added 100ms delay before modal closes (didn't fix)
4. ✅ Removed KeyboardAvoidingView (didn't fix)

**Root Cause:** Unknown - Could be:
- Expo Router modal presentation issue on Android
- SafeAreaView background rendering during animation
- Screen orientation handling during dismiss
- Expo Go specific rendering issue

**Next Steps to Try:**
1. Check if `presentation: 'transparent-modal'` instead of `modal` helps
2. Try using `animationDuration: 0` to see if it's an animation timing issue
3. Investigate if there's an Android-specific modal configuration needed
4. Check Expo Router Android release notes for modal animation fixes
5. Try wrapping modal dismiss in `InteractionManager.runAfterInteractions()`
6. Check if adding explicit background color to Stack screen options helps
7. Test on physical Android device vs Expo Go (might be emulator-specific)
8. Consider using Animated API for custom modal dismiss animation

**Relevant Files:**
- `src/app/(modals)/entry.tsx` - LOG modal
- `src/app/(modals)/vault.tsx` - VAULTS modal
- `src/app/_layout.tsx` - Modal Stack configuration

**Commits Attempted:**
- `46ba57b` - Added keyboard dismiss
- `c8c6640` - Disabled gesture dismiss, added delay
- `1b6f0c1` - Removed KeyboardAvoidingView

---

**Created:** 2026-06-05
**Platform:** Android, Expo Go v56+
**Priority:** Medium (UX issue, not critical functionality)
