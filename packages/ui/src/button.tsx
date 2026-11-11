import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50 min-h-11 px-4 py-2 sm:min-h-10",
  {
    variants: {
      variant: {
        primary: "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]",
        outline: "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--secondary)]",
        gold: "border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)] hover:text-[var(--gold-foreground)]",
        ghost: "text-[var(--foreground)] hover:bg-[var(--secondary)]",
        danger: "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90",
      },
      size: {
        default: "",
        sm: "min-h-9 px-3 text-xs",
        lg: "min-h-12 px-6 text-base",
        icon: "size-11 p-0 sm:size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
