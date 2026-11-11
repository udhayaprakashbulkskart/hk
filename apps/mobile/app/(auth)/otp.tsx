import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { Button, Field, Muted, Screen, Title } from "@/components/ui";
import { authClient, messageFor } from "@/lib/auth";
import { useTheme } from "@/theme/theme";

type Step = "EMAIL" | "SMS";

/** Two codes, one per channel: email first, then mobile. The account activates after both. */
export default function OtpScreen() {
  const { colors } = useTheme();
  const { email = "" } = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<Step>("EMAIL");
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  async function verify() {
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code.");
    setError(null);
    setBusy(true);
    try {
      const out = await authClient.verifyOtp({ email: String(email), channel: step, code });
      if (step === "EMAIL") {
        setStep("SMS");
        setCode("");
        setSeconds(30);
      } else if (out.accountActive) {
        router.replace("/(auth)/login");
      }
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    try {
      await authClient.resendOtp({ email: String(email), channel: step });
      setSeconds(30);
    } catch (err) {
      setError(messageFor(err));
    }
  }

  return (
    <Screen>
      <Title eyebrow={`Step ${step === "EMAIL" ? 1 : 2} of 2`} title={step === "EMAIL" ? "Enter the code sent to your email" : "Enter the code sent to your mobile"} description="Codes expire after five minutes. Never share them with anyone." />
      <Field label="One-time code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6} accessibilityHint="Six digits" />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
      <Button onPress={verify} disabled={code.length !== 6} loading={busy}>{step === "EMAIL" ? "Continue" : "Verify and finish"}</Button>
      {seconds > 0 ? <Muted>Resend code in {seconds}s</Muted> : <Button variant="outline" onPress={resend}>Resend code</Button>}
    </Screen>
  );
}
