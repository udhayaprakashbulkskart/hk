"use client";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-ghost btn-sm print:hidden" aria-label="Print receipt">
      <Printer className="size-4" />
    </button>
  );
}
