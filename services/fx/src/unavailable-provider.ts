import { FxError } from "./service";
import type { FxProvider } from "./ports";

/**
 * The FX rate source is not connected. Every quote is refused with NOT_AVAILABLE. No rate is ever invented.
 * A real provider replaces this under its approved contract (decision D-FX).
 */
export function createUnavailableFxProvider(): FxProvider {
  const refuse = (): never => {
    throw new FxError("NOT_AVAILABLE", "currency conversion is not yet available");
  };
  return {
    id: "unavailable",
    rate: async () => refuse(),
    history: async () => refuse(),
  } as unknown as FxProvider;
}
