import { Text } from "react-native";
import { Badge, Button, Card, Muted, Row, Screen, SandboxNotice, Title } from "@/components/ui";

export function PaymentShell({ mode }: { mode: "deposit" | "withdraw" }) {
  const isDeposit = mode === "deposit";
  return (
    <Screen>
      <Title eyebrow="Payments" title={isDeposit ? "Deposit funds" : "Withdraw funds"} description={isDeposit ? "Add money from a linked bank or card." : "Move money from your wallet to a verified bank account."} />
      <SandboxNotice>Live {isDeposit ? "deposits" : "withdrawals"} are not yet enabled. Nothing is processed in this sandbox.</SandboxNotice>
      <Card>
        <Row label="Currency" value="HKD" />
        <Row label="Fees" value="Shown before you confirm" />
        <Button disabled>{isDeposit ? "Continue to deposit" : "Continue to withdrawal"}</Button>
      </Card>
      {(isDeposit
        ? ["Bank transfer (local)", "Debit or credit card", "UPI (India)"]
        : ["Bank account", "Local bank payout"]
      ).map((m) => (
        <Card key={m}>
          <Text style={{ fontWeight: "600" }}>{m}</Text>
          <Badge>Not yet enabled</Badge>
        </Card>
      ))}
      <Muted>We never collect bank login passwords, UPI PINs or card CVVs.</Muted>
    </Screen>
  );
}
