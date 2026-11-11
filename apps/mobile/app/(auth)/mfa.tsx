import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { Button, Field, Muted, Screen, Title } from "@/components/ui";
import { authClient, currentDevice, messageFor } from "@/lib/auth";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/theme";

export default function MfaScreen() {
  const { colors } = useTheme();
  const { mfaToken } = useLocalSearchParams<{ mfaToken?: string }>();
  const { signIn } = useSession();
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const digits = code.replace(/\s/g, "");
    if (!mfaToken) return setError("Your sign-in has expired. Log in again.");
    if (!/^\d{6}$/.test(digits) && recovery.trim().length < 8) return setError("Enter the 6-digit code or a recovery code.");
    setError(null);
    setBusy(true);
    try {
      const out = await authClient.loginMfa(
        /^\d{6}$/.test(digits)
          ? { mfaToken: String(mfaToken), code: digits, device: currentDevice() }
          : { mfaToken: String(mfaToken), recoveryCode: recovery.trim(), device: currentDevice() },
      );
      if (out.status === "authenticated") {
        await signIn(out.tokens);
        router.replace("/home");
      }
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title eyebrow="Two-step verification" title="Enter your code" description="Use the 6-digit code from your authenticator app, or one of your recovery codes." />
      <Field label="Authenticator code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} />
      <Field label="Or a recovery code" value={recovery} onChangeText={setRecovery} autoCapitalize="characters" autoCorrect={false} hint="Each recovery code works once." />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
      <Button onPress={submit} loading={busy}>Continue</Button>
      <Muted>Lost your device? Use a recovery code, then set up two-step verification again.</Muted>
    </Screen>
  );
}
