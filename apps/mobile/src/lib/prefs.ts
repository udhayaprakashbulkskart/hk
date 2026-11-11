import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Per-device preferences. None of these values is a credential.
 * The "unlocked this launch" flag lives in memory only, so every cold start asks for biometrics again.
 */
const LOCK_KEY = "hkf.lockEnabled";
let unlockedFlag = false;

export async function lockEnabled(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(LOCK_KEY)) === "1"; } catch { return false; }
}
export async function setLockEnabled(on: boolean): Promise<void> {
  try { await AsyncStorage.setItem(LOCK_KEY, on ? "1" : "0"); } catch { /* preference not saved */ }
}
export async function unlockedThisLaunch(): Promise<boolean> { return unlockedFlag; }
export async function markUnlocked(): Promise<void> { unlockedFlag = true; }
export function resetUnlock(): void { unlockedFlag = false; }
