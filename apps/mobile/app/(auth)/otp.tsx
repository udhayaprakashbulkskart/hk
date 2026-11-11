import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { Button, Field, Muted, Screen, Title } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/theme";

export default function OtpScreen() {
  const { colors } = useTheme();
  const { purpose } = useLocalSearchParams<{ purpose?: string }>();
  const { signIn } = useSession();
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  async function verify() {
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code.");
    setError(null);
    await signIn();
    router.replace("/home");
  }

  return (
    <Screen>
      <Title eyebrow={purpose === "register" ? "Step 2 of 2" : "Verification"} title="Enter your code" description="We sent a 6-digit code to your email and mobile. Sandbox: any 6 digits continue." />
      <Field
        label="One-time code"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        accessibilityHint="Six digits"
      />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
      <Button onPress={verify} disabled={code.length !== 6}>Verify</Button>
      <Muted>{seconds > 0 ? `Resend code in ${seconds}s` : "Didn't get it? Resend code"}</Muted>
      {seconds <= 0 ? <Button variant="outline" onPress={() => setSeconds(30)}>Resend code</Button> : null}
    </Screen>
  );
}
