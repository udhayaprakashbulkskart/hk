import { useEffect, useState } from "react";
import { Share, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { CURRENCIES, type CurrencyCode } from "@hkfinhub/types";
import { formatMoney, parseToMinor } from "@hkfinhub/api-client";
import { Button, Card, Chip, Field, Heading, Muted, Screen, Title } from "@/components/ui";
import { useTheme } from "@/theme/theme";

export default function ReceiveScreen() {
  const { colors } = useTheme();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("HKD");
  const [reference, setReference] = useState<string | null>(null);
  const minor = parseToMinor(amount, currency);
  useEffect(() => { setReference(`REQ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`); }, []);
  const link = reference ? `hkfinhub://pay/${reference}` : "";

  return (
    <Screen>
      <Title eyebrow="Payments" title="Receive money" description="Show this QR code or share the link. A payment counts only after the provider confirms it." />
      <Field label="Amount (optional)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" error={amount && !minor ? "Use up to two decimal places." : null} />
      <Muted>Currency</Muted>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {CURRENCIES.map((c) => <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />)}
      </View>
      <Card style={{ alignItems: "center", gap: 14 }}>
        <View style={{ backgroundColor: "#ffffff", padding: 14, borderRadius: 14 }} accessibilityLabel={`QR code for payment request ${reference ?? ""}`}>
          {link ? <QRCode value={link} size={200} color="#11141a" backgroundColor="#ffffff" /> : <View style={{ width: 200, height: 200 }} />}
        </View>
        <Text style={{ color: colors.foreground, fontWeight: "600" }}>{minor ? formatMoney({ amountMinor: minor, currency }) : "Any amount"}</Text>
        <Muted>Reference {reference ?? "…"}</Muted>
      </Card>
      <Heading>Share</Heading>
      <Button variant="outline" disabled={!link} onPress={() => Share.share({ message: `Pay me with HK FinHub: ${link}` })}>Share payment link</Button>
      <Muted>Sandbox link. It becomes a live payment page after payment collection is approved.</Muted>
    </Screen>
  );
}
