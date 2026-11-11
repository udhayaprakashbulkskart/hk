import { useState } from "react";
import { Link, router } from "expo-router";
import { Text, View } from "react-native";
import { Button, Card, Field, Muted, Screen, Title } from "@/components/ui";
import { useTheme } from "@/theme/theme";

export default function LoginScreen() {
  const { colors } = useTheme();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!id.trim() || !pw) return setError("Enter your email or mobile number and password.");
    setError(null);
    router.push({ pathname: "/(auth)/otp", params: { purpose: "login" } });
  }

  return (
    <Screen>
      <Title title="Log in to your account" description="Sandbox preview. Any entry continues to the verification step." />
      <Field label="Email or mobile number" value={id} onChangeText={setId} autoCapitalize="none" autoComplete="username" keyboardType="email-address" placeholder="you@example.com" />
      <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry autoComplete="password" />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
      <Button onPress={submit}>Log in</Button>
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
