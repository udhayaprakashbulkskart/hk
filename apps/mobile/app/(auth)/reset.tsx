import { useState } from "react";
import { router } from "expo-router";
import { Text } from "react-native";
import { Button, Field, Screen, Title } from "@/components/ui";
import { authClient, messageFor } from "@/lib/auth";
import { useTheme } from "@/theme/theme";

export default function ResetScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function request() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Enter a valid email address.");
    setError(null);
    setBusy(true);
    try {
      // Same answer for every address, so this cannot reveal which emails are registered.
      await authClient.requestPasswordReset(email.trim());
      setRequested(true);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from the email.");
    if (newPassword.length < 12) return setError("Password must be at least 12 characters.");
    setError(null);
    setBusy(true);
    try {
      await authClient.confirmPasswordReset({ email: email.trim(), code, newPassword });
      router.replace("/(auth)/login");
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title title="Reset your password" description={requested ? "If an account exists for that address, we have sent a code. It expires in five minutes." : "Enter your registered email. If an account exists, we will send a secure code."} />
      {!requested ? (
        <>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Button onPress={request} loading={busy}>Send reset code</Button>
        </>
      ) : (
        <>
          <Field label="Code from email" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} />
          <Field label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" hint="At least 12 characters. Ends all your active sessions." />
          <Button onPress={confirm} loading={busy}>Set new password</Button>
        </>
      )}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
    </Screen>
  );
}
