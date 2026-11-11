import { useEffect, useMemo, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { api, formatMoney, parseToMinor } from "@hkfinhub/api-client";
import type { Beneficiary, CurrencyCode, FxQuote, TransferReceipt } from "@hkfinhub/types";
import { CURRENCIES } from "@hkfinhub/types";
import { Badge, Button, Card, Chip, Field, Heading, Loading, Muted, Row, Screen } from "@/components/ui";
import { useAsync } from "@/lib/useAsync";
import { useTheme } from "@/theme/theme";

type Step = "recipient" | "amount" | "review" | "confirm" | "result";
const STEPS: Step[] = ["recipient", "amount", "review", "confirm"];
const METHOD = { upi: "UPI ID", bank: "Bank account", swift: "SWIFT / IBAN" } as const;

/** Send money: recipient, amount with a quote, review, authentication, then a pending result. */
export function SendWizard({ initialAmount }: { initialAmount?: string }) {
  const { colors } = useTheme();
  const benef = useAsync(() => api.listBeneficiaries());
  const [step, setStep] = useState<Step>("recipient");
  const [beneficiaryId, setBeneficiaryId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDest, setNewDest] = useState("");
  const [method, setMethod] = useState<keyof typeof METHOD>("swift");
  const [amount, setAmount] = useState(initialAmount ?? "");
  const [currency, setCurrency] = useState<CurrencyCode>("SGD");
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null);
  const [key] = useState(() => Crypto.randomUUID());

  const selected: Beneficiary | undefined = useMemo(() => benef.data?.find((b) => b.id === beneficiaryId), [benef.data, beneficiaryId]);
  const isNew = beneficiaryId === "new";
  const recipient = isNew ? newName : selected?.name ?? "";
  const destination = isNew ? newDest : selected?.destination ?? "";
  const minor = parseToMinor(amount, "HKD");

  useEffect(() => {
    if (!minor || BigInt(minor) <= 0n) { setQuote(null); return; }
    let live = true;
    setQuoteErr(null);
    api.getFxQuote("HKD", currency, minor)
      .then((q) => live && setQuote(q))
      .catch((e: unknown) => live && (setQuote(null), setQuoteErr(e instanceof Error ? e.message : "No quote.")));
    return () => { live = false; };
  }, [minor, currency]);

  if (benef.loading) return <Screen><Loading /></Screen>;

  function next() {
    setError(null);
    if (step === "recipient") {
      if (!recipient.trim() || !destination.trim()) return setError("Choose a saved recipient or enter the details.");
      return setStep("amount");
    }
    if (step === "amount") {
      if (!minor || BigInt(minor) <= 0n) return setError("Enter an amount above zero, with up to two decimals.");
      if (!quote) return setError(quoteErr ?? "Waiting for a rate quote.");
      return setStep("review");
    }
    if (step === "review") return setStep("confirm");
  }

  async function submit() {
    setError(null);
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit code from your authenticator app.");
    if (!confirmed) return setError("Confirm the recipient and amount first.");
    setBusy(true);
    try {
      const r = await api.submitTransfer({ beneficiaryId: beneficiaryId ?? "new", amountMinor: minor!, currency, idempotencyKey: key });
      setReceipt(r);
      setStep("result");
    } catch {
      setError("We could not submit this transfer. Nothing has been sent.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "result" && receipt) {
    return (
      <Screen>
        <Card>
          <Badge tone="gold">Pending</Badge>
          <Text accessibilityRole="header" style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>Transfer pending confirmation</Text>
          <Muted>{receipt.message}</Muted>
          <Row label="Reference" value={receipt.reference} />
          <Row label="Recipient" value={recipient} />
          <Row label="You send" value={formatMoney({ amountMinor: minor!, currency: "HKD" })} />
          {quote ? <Row label="Recipient gets" value={formatMoney(quote.recipientAmount)} strong /> : null}
          <Muted>No money has moved. Your balance updates only after the payment partner confirms.</Muted>
        </Card>
        <Button variant="outline" onPress={() => { setStep("recipient"); setReceipt(null); setOtp(""); setConfirmed(false); setAmount(""); }}>Send another</Button>
      </Screen>
    );
  }

  const index = STEPS.indexOf(step);
  return (
    <Screen>
      <View style={{ flexDirection: "row", gap: 6 }} accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= index ? colors.primary : colors.border }} />
        ))}
      </View>

      {step === "recipient" && (
        <>
          <Heading>Who are you sending to?</Heading>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(METHOD) as (keyof typeof METHOD)[]).map((m) => (
              <Chip key={m} label={METHOD[m]} selected={method === m} onPress={() => { setMethod(m); setBeneficiaryId(null); }} />
            ))}
          </View>
          <View style={{ gap: 8 }}>
            {(benef.data ?? []).filter((b) => b.method === method).map((b) => (
              <Pressable key={b.id} accessibilityRole="radio" accessibilityState={{ selected: beneficiaryId === b.id }} onPress={() => setBeneficiaryId(b.id)} style={{ borderRadius: 12, borderWidth: 1, borderColor: beneficiaryId === b.id ? colors.primary : colors.border, backgroundColor: colors.card, padding: 14, gap: 2 }}>
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>{b.name}</Text>
                <Muted>{b.destination} · {b.currency}</Muted>
              </Pressable>
            ))}
            <Pressable accessibilityRole="radio" accessibilityState={{ selected: isNew }} onPress={() => setBeneficiaryId("new")} style={{ borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: isNew ? colors.primary : colors.border, padding: 14 }}>
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>+ New recipient</Text>
            </Pressable>
          </View>
          {(benef.data ?? []).some((b) => b.method === method) ? null : <Muted>No saved {METHOD[method]} recipients yet. Add a new one below.</Muted>}
          {isNew ? (
            <>
              <Field label="Recipient full name" value={newName} onChangeText={setNewName} />
              <Field label={method === "upi" ? "UPI ID" : method === "bank" ? "Account number" : "SWIFT / BIC and IBAN"} value={newDest} onChangeText={setNewDest} autoCapitalize="none" autoCorrect={false} hint={method === "swift" ? "We never ask for online banking passwords or card CVVs." : undefined} />
            </>
          ) : null}
        </>
      )}

      {step === "amount" && (
        <>
          <Heading>How much?</Heading>
          <Field label="You send (HKD)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" hint="Up to two decimal places." />
          <Muted>Recipient currency</Muted>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {CURRENCIES.filter((c) => c !== "HKD").map((c) => (
              <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />
            ))}
          </View>
          <Card>
            {quote ? (
              <>
                <Row label="Exchange rate" value={`1 HKD = ${quote.rate.toFixed(4)} ${currency}`} />
                <Row label="Service fee" value={formatMoney(quote.serviceFee)} />
                <Row label="Rate provider" value={quote.provider} />
                <Row label="Recipient gets" value={formatMoney(quote.recipientAmount)} strong />
              </>
            ) : (
              <Muted>{quoteErr ?? "Enter an amount to see the rate, fees and what your recipient gets."}</Muted>
            )}
          </Card>
        </>
      )}

      {step === "review" && quote && (
        <Card>
          <Heading>Review</Heading>
          <Row label="Recipient" value={recipient} />
          <Row label="Destination" value={destination} />
          <Row label="You send" value={formatMoney({ amountMinor: minor!, currency: "HKD" })} />
          <Row label="Service fee" value={formatMoney(quote.serviceFee)} />
          <Row label="Exchange rate" value={`1 HKD = ${quote.rate.toFixed(4)} ${currency}`} />
          <Row label="Recipient gets" value={formatMoney(quote.recipientAmount)} strong />
        </Card>
      )}

      {step === "confirm" && (
        <>
          <Heading>Confirm and authorise</Heading>
          <Field label="Authenticator code" value={otp} onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} hint="Enter the 6-digit code from your authenticator app." />
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Switch value={confirmed} onValueChange={setConfirmed} accessibilityLabel="I have checked the recipient and amount" />
            <Muted>I have checked the recipient and amount. The transfer stays pending until our payment partner confirms it.</Muted>
          </View>
        </>
      )}

      {error ? <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text> : null}

      <View style={{ flexDirection: "row", gap: 10 }}>
        {index > 0 ? <View style={{ flex: 1 }}><Button variant="outline" onPress={() => setStep(STEPS[index - 1]!)}>Back</Button></View> : null}
        <View style={{ flex: 1 }}>
          {step === "confirm" ? (
            <Button onPress={submit} disabled={!confirmed || otp.length !== 6} loading={busy}>Submit transfer</Button>
          ) : (
            <Button onPress={next}>Continue</Button>
          )}
        </View>
      </View>
    </Screen>
  );
}
