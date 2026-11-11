import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/theme";
import { Logo } from "@/components/Logo";
import { Button, Muted } from "@/components/ui";
import { biometricState, unlockWithBiometrics, type BiometricState } from "@/lib/biometric";
import { lockEnabled, unlockedThisLaunch, markUnlocked } from "@/lib/prefs";

/** Splash and gate: routes to sign-in, the app, or the biometric lock screen. */
export default function Gate() {
  const { status } = useSession();
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState<boolean | null>(null);
  const [bio, setBio] = useState<BiometricState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (status !== "signed-in") return;
    Promise.all([lockEnabled(), unlockedThisLaunch()]).then(([locked, unlocked]) => {
      setNeedsUnlock(locked && !unlocked);
    });
    biometricState().then(setBio).catch(() => setBio({ supported: false, reason: "Biometrics unavailable." }));
  }, [status]);

  if (status === "loading" || !ready) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.background }]}>
        <Logo size={56} wordmark={false} />
        <Text style={[styles.splashName, { color: colors.foreground }]}>HK FinHub</Text>
        <Muted>Global Finance Made Simple</Muted>
      </View>
    );
  }
  if (status === "signed-out") return <Redirect href="/(auth)/login" />;
  if (needsUnlock === null) return null;
  if (!needsUnlock) return <Redirect href="/home" />;

  async function unlock() {
    setFailed(false);
    const ok = await unlockWithBiometrics("Unlock HK FinHub");
    if (ok) {
      await markUnlocked();
      setNeedsUnlock(false);
    } else {
      setFailed(true);
    }
  }

  return (
    <View style={[styles.splash, { backgroundColor: colors.background, gap: 16 }]}>
      <Logo size={48} />
      <Text accessibilityRole="header" style={[styles.splashName, { color: colors.foreground }]}>Unlock to continue</Text>
      {bio?.supported ? (
        <Button onPress={unlock}>{bio.kind === "face" ? "Unlock with Face ID" : "Unlock with fingerprint"}</Button>
      ) : (
        <Button onPress={unlock}>Unlock with device passcode</Button>
      )}
      {failed ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>Not unlocked. Try again.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  splashName: { fontSize: 22, fontWeight: "700", marginTop: 8 },
});
