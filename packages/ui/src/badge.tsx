import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-[var(--secondary)] text-[var(--muted-foreground)]",
        gold: "border border-[var(--gold)]/40 bg-[var(--gold)]/10 text-[var(--gold)]",
        success: "bg-[var(--success)]/15 text-[var(--success)]",
        danger: "bg-[var(--destructive)]/15 text-[var(--destructive)]",
        primary: "bg-[var(--primary)]/15 text-[var(--primary)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
