import { useLocalSearchParams } from "expo-router";
import { SendWizard } from "@/components/SendWizard";

export default function SendTab() {
  const { amount } = useLocalSearchParams<{ amount?: string }>();
  return <SendWizard initialAmount={amount} />;
}
