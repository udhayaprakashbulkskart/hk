"use client";
import { ErrorState } from "@/components/ui/states";

export default function StoreError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-10">
      <ErrorState body="We couldn't load this page. It's probably temporary." retry={reset} />
    </div>
  );
}
