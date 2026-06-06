# Eddies

A personal finance tracker built for clarity. Log income and expenses across multiple vaults, track spending against monthly caps, and review trends — all stored locally on device with no cloud sync.

## Tech

- **Expo SDK 56** / React Native 0.85 / React 19
- **expo-router** — file-based routing
- **expo-sqlite** — local SQLite database with migration runner
- **Zustand** — UI/device state
- **Zod** — runtime validation
- **React Native Reanimated 4** + gesture handler

## Getting started

```bash
npm install
npx expo start
```

Open in the Expo Go app, an Android emulator, or iOS simulator.

## Building for store

Requires [EAS CLI](https://docs.expo.dev/build/setup/):

```bash
npm install -g eas-cli
eas login
eas build --platform all --profile production
```

Profiles are defined in `eas.json`:
- `development` — dev client (iOS simulator or Android device)
- `preview` — internal distribution APK
- `production` — store-ready binary with auto-increment build number

## Project structure

```
app/          expo-router screens and layouts
  (tabs)/     main tab screens (ledger, vaults, analyze, settings)
  (modals)/   overlay screens (entry, cap, export, backup, vault editor)
src/
  lib/        business logic (analytics, export, backup, db repos, money)
  components/ shared UI components
  store/      Zustand stores
  hooks/      custom hooks
  constants/  theme tokens, colours, spacing
assets/       icons, splash screen
```

## Scripts

```bash
npm start          # start dev server
npm run typecheck  # tsc --noEmit
npm run lint       # expo lint
npm test           # jest
```

## Data

All data is stored in an on-device SQLite database. Nothing is sent to any server. There are no accounts, no API keys, and no analytics SDKs in the bundle.

## License

MIT
