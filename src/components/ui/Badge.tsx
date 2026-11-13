import React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "bronze"
  | "success"
  | "warning"
  | "error";

export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  default: {
    container: "bg-warm-grey/15 border-warm-grey/60 text-charcoal",
    dot: "bg-charcoal",
  },
  bronze: {
    container: "bg-bronze/10 border-bronze text-[#876E4B]",
    dot: "bg-bronze",
  },
  success: {
    container: "bg-emerald-950/5 border-emerald-700/40 text-emerald-800",
    dot: "bg-emerald-600",
  },
  warning: {
    container: "bg-amber-950/5 border-amber-700/40 text-amber-800",
    dot: "bg-amber-600",
  },
  error: {
    container: "bg-rose-950/5 border-rose-700/40 text-rose-800",
    dot: "bg-rose-600",
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[10px] tracking-[0.12em]",
  md: "px-2.5 py-1 text-xs tracking-[0.14em]",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = "default",
      size = "md",
      dot = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const currentVariant = variantStyles[variant];

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 font-mono sm:font-sans font-medium uppercase select-none",
          "border rounded-none shadow-none",
          currentVariant.container,
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn("w-1.5 h-1.5 rounded-none shrink-0", currentVariant.dot)}
            aria-hidden="true"
          />
        )}
        <span>{children}</span>
      </span>
    );
  }
);

Badge.displayName = "Badge";

export default Badge;
