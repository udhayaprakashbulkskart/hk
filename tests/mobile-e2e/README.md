# Mobile tests

Phase 3 verification for `apps/mobile` (Expo, React Native).

- Bundling: `expo export --platform ios --platform android --platform web` compiles the full app (Hermes bytecode for iOS and Android).
- `specs/preview.spec.ts`: drives the web export of the same screens at phone size in dark and light themes. Checks sign-in, every customer screen for horizontal overflow and uncaught errors, and the public screens.

Real iOS and Android simulators, Maestro flows and device biometrics are not available in the build environment. They are run on a device in the release process (Phase 11).

```bash
cd apps/mobile && EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform web --output-dir /path/to/export
cd tests/mobile-e2e && EXPORT_DIR=/path/to/export ./node_modules/.bin/playwright test
```
