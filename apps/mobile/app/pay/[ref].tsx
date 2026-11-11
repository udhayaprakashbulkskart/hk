import { router, useLocalSearchParams } from "expo-router";
import { Muted, Screen, Card, Row, Title, Button, Notice } from "@/components/ui";

export default function PayRequestScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const reference = String(ref ?? "");
  const valid = /^REQ-[A-Z0-9]{4,12}$/.test(reference);
  if (!valid) return <Screen><Muted>This payment link is not valid.</Muted></Screen>;
  return (
    <Screen>
      <Title eyebrow="Payment request" title={`Request ${reference}`} description="Review the request, then pay with your HK FinHub account." />
      <Card>
        <Row label="Reference" value={reference} />
        <Row label="Amount" value="Set by the requester" />
        <Row label="Status" value="Not yet payable" />
      </Card>
      <Notice>Live payments are not yet enabled. Nothing is paid.</Notice>
      <Button disabled>Pay request</Button>
      <Button variant="outline" onPress={() => router.replace("/home")}>Back to home</Button>
    </Screen>
  );
}
