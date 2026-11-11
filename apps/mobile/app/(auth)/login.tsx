import { useState } from "react";
import { Link, router } from "expo-router";
import { Text, View } from "react-native";
import { Button, Card, Field, Muted, Screen, Title } from "@/components/ui";
import { authClient, currentDevice, messageFor } from "@/lib/auth";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/theme";

export default function LoginScreen() {
  const { colors } = useTheme();
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !pw) return setError("Enter your email and password.");
    setError(null);
    setBusy(true);
    try {
      const out = await authClient.login({ email: email.trim(), password: pw, device: currentDevice() });
      if (out.status === "mfa_required") {
        router.push({ pathname: "/(auth)/mfa", params: { mfaToken: out.mfaToken } });
      } else {
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
      <Title title="Log in to your account" description="Log in with your email address and password." />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="username" keyboardType="email-address" placeholder="you@example.com" hint="Mobile-number log in is coming soon." />
      <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry autoComplete="password" />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
      <Button onPress={submit} loading={busy}>Log in</Button>
      <Link href="/(auth)/reset" asChild>
        <Text accessibilityRole="link" style={{ color: colors.gold, fontWeight: "600", textAlign: "center" }}>Forgot password?</Text>
      </Link>
      <Card>
        <Muted>Biometric sign-in unlocks the app after your first log in. You can turn it on in Security.</Muted>
      </Card>
      <View style={{ alignItems: "center", gap: 8, paddingTop: 8 }}>
        <Muted>New to HK FinHub?</Muted>
        <Link href="/(auth)/register" asChild>
          <Text accessibilityRole="link" style={{ color: colors.gold, fontWeight: "700" }}>Create an account</Text>
        </Link>
      </View>
    </Screen>
  );
}
