/**
 * TEST ONLY. Simulated providers used by the integration tests. None of this is loaded by the runtime container.
 * They produce deterministic answers so that flows can be exercised; they are not market data, scanning or screening.
 */
export { createSandboxFxProvider } from "./fx";
export { createSandboxScanner, createSandboxKycProvider, EICAR_TEST_STRING } from "./kyc";
export { createSandboxScreener, SANDBOX_SANCTIONED_NAME } from "./screener";
export { createSandboxBroker } from "./broker";
