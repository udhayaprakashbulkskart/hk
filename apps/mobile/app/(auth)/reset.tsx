import { useState } from "react";
import { Text } from "react-native";
import { Button, Field, Screen, Title } from "@/components/ui";
import { useTheme } from "@/theme/theme";

export default function ResetScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <Screen>
      <Title title="Reset your password" description="Enter your registered email. If an account exists, we will send a secure reset link." />
      {sent ? (
        <Text accessibilityRole="alert" style={{ color: colors.foreground }}>
          If an account exists for that address, a reset link is on its way. It expires in 30 minutes.
        </Text>
      ) : (
        <>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Button onPress={() => setSent(true)}>Send reset link</Button>
        </>
      )}
    </Screen>
  );
}
