# Eddies Issues & Deferred Work

## M4 Deferred

### File System Integration (Export/Backup enhancement) — P1
Requires installing:
```bash
npm install expo-file-system expo-sharing expo-document-picker
```

Then uncomment file I/O code in:
- `src/app/(modals)/export.tsx` — enable file write + share
- `src/app/(modals)/settings.tsx` — enable backup create/restore
- `src/lib/backup.ts` — full restore with file ops

**Status:** Logic complete, UI ready; awaiting package installation.

---

### Onboarding (Phase 4.3) — P2
- [ ] Onboarding route: `app/onboarding.tsx` (full-screen, not modal)
- [ ] Screen 1 — Welcome (`EDDIES // ONBOARDING 01`)
- [ ] Screen 2 — Create First Vault (name, type, currency, opening balance)
- [ ] Screen 3 — Quick-Add Preview (walkthrough of 3-tap log flow)
- [ ] Gate logic: show only on first run (check `has_completed_onboarding` flag)
- [ ] Animations: Slide transitions between screens (Reanimated, ≤200ms)
- [ ] After completion: vault is created, can immediately log entries
- [ ] Acceptance: First run shows onboarding, not home; re-run doesn't wipe data

---

## v1.1+ (Backlog)

### F14 — Recurring Entries
- Automated duplicate logging (periodic transactions)

### Multi-Currency Conversion
- Auto-conversion math (v1 shows currency per vault, no conversion)

### Household / Shared Budgets
- Multi-user budget collaboration

### Investment / Portfolio Tracking
- Holdings, performance, allocation

### Bill Reminders
- Recurring payment notifications
