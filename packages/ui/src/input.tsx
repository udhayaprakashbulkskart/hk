import * as React from "react";
import { cn } from "./cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50 sm:text-sm",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-[var(--foreground)]", className)} {...props} />;
}

export function Field({ label, hint, children, id }: { label: string; hint?: string | undefined; children: React.ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-[var(--muted-foreground)]">{hint}</p> : null}
    </div>
  );
}
