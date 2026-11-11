import { useState } from "react";
import { router } from "expo-router";
import { Pressable, Switch, Text, View } from "react-native";
import { Button, Chip, Field, Muted, Screen, Title } from "@/components/ui";
import { authClient, messageFor } from "@/lib/auth";
import { useTheme } from "@/theme/theme";

const COUNTRIES = [["HK", "Hong Kong", "+852"], ["IN", "India", "+91"], ["SG", "Singapore", "+65"], ["US", "United States", "+1"], ["GB", "United Kingdom", "+44"], ["AE", "UAE", "+971"], ["CN", "China", "+86"]] as const;

export default function RegisterScreen() {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<string>("HK");
  const [pw, setPw] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dial = COUNTRIES.find(([c]) => c === country)?.[2] ?? "+852";

  async function submit() {
    const problems: string[] = [];
    if (name.trim().length < 2) problems.push("Enter your full name as on your ID.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push("Enter a valid email address.");
    if (phone.replace(/\D/g, "").length < 6) problems.push("Enter a valid mobile number.");
    if (pw.length < 12) problems.push("Password must be at least 12 characters.");
    if (!terms) problems.push("Accept the terms to continue.");
    if (problems.length) return setError(problems.join(" "));
    setError(null);
    setBusy(true);
    try {
      await authClient.register({ email: email.trim(), phone: `${dial} ${phone.trim()}`, password: pw, fullName: name.trim(), countryCode: country, language: "en" });
      router.push({ pathname: "/(auth)/otp", params: { email: email.trim() } });
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title title="Create your account" description="We verify your email and mobile number before you can move money." />
      <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label={`Mobile number (${dial})`} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="5555 0123" />
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>Country of residence</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {COUNTRIES.map(([code, label]) => <Chip key={code} label={label} selected={country === code} onPress={() => setCountry(code)} />)}
        </View>
      </View>
      <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" hint="At least 12 characters. Not a common password." />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: terms }} onPress={() => setTerms(!terms)} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <Switch value={terms} onValueChange={setTerms} accessibilityLabel="Accept terms" />
        <Muted>I accept the terms of use and privacy notice. HK FinHub services are provided through authorised partners.</Muted>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}
      <Button onPress={submit} loading={busy}>Continue</Button>
    </Screen>
  );
}
