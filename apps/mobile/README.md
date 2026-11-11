# apps/mobile: iOS and Android app

Expo (React Native, TypeScript) customer app. Same screens, data boundary and design tokens as the web app.

**Status: Phase 3 (UI).** All data comes from `@hkfinhub/api-client`, the same data client as the web app. Sign-in, OTP and transfers are simulated. Phase 4 replaces the client with the real API.

## Structure

- `app/`: Expo Router routes.
  - `index.tsx`: splash and gate. Routes to sign-in, the app, or the biometric lock.
  - `(auth)/`: login, registration, OTP, password reset.
  - `(app)/(tabs)/`: Home, Trade, Transfer, Portfolio, More.
  - `(app)/`: accounts, receive, global transfer, exchange, transactions, notifications, security, profile, settings, scan, deposit, withdraw, statements, orders.
  - `symbol/[symbol].tsx`: market detail. `pay/[ref].tsx`: payment-request link target.
- `src/lib/session.tsx`: session token in the device secure store (Keychain / Keystore). Memory only on the web preview.
- `src/lib/biometric.ts`: Face ID, fingerprint or device passcode via `expo-local-authentication`.
- `src/lib/prefs.ts`: app-lock preference. The unlock state is held in memory, so each cold start asks again.
- `src/lib/push.ts`: notification permission and Expo push token. The token is not stored server-side until Phase 4.
- `src/components/`: native UI primitives, area chart (react-native-svg), send-money wizard, payment shell, logo.
- `src/theme/`: dark (default) and light themes from `@hkfinhub/tokens`. The choice is stored per device.

## Native features

| Feature | Implementation | Notes |
|---|---|---|
| Biometric unlock | `expo-local-authentication` | Gated behind an Apple/Android-enrolled sensor. Falls back to device passcode. |
| Push notifications | `expo-notifications` | Needs an EAS project ID in `app.json` (`extra.eas.projectId`). |
| QR scanning | `expo-camera` barcode scanner | Accepts `hkfinhub://pay/REQ-…` and the HTTPS pay link. |
| Deep links | `scheme: "hkfinhub"` + Expo Router | `hkfinhub://pay/REQ-…` opens the payment request screen. |
| Secure session | `expo-secure-store` | Token is a test marker, not a credential. |

## Commands

```bash
pnpm --filter @hkfinhub/mobile start          # Expo dev server
pnpm --filter @hkfinhub/mobile typecheck
cd apps/mobile && EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform ios --platform android --platform web --output-dir <dir>
```

## Versions

Native modules are pinned to the versions bundled with Expo SDK 58 (`node_modules/expo/bundledNativeModules.json`). React is pinned to 19.3.0, which React Native 0.88 requires. Do not bump these individually; move the whole SDK together.

## Not verified in this environment

Real iOS and Android simulators, device biometrics, camera scanning and Maestro end-to-end runs need a physical device or simulator. Bundle compilation and the web preview are verified (see `tests/mobile-e2e`).
