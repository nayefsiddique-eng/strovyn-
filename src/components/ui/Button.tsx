import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export type ButtonProps = ButtonBaseProps &
  (
    | (React.ButtonHTMLAttributes<HTMLButtonElement> & {
        href?: undefined;
        type?: "button" | "submit" | "reset";
      })
    | (React.AnchorHTMLAttributes<HTMLAnchorElement> & {
        href: string;
        type?: never;
      })
  );

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-bronze text-white border border-bronze hover:bg-[#967B56] hover:border-[#967B56] active:bg-[#856C4A]",
  secondary:
    "bg-charcoal text-white border border-charcoal hover:bg-[#2D2E2B] hover:border-[#2D2E2B] active:bg-[#1A1B19]",
  outline:
    "bg-transparent text-charcoal border border-charcoal hover:bg-charcoal hover:text-white active:bg-charcoal/90",
  ghost:
    "bg-transparent text-charcoal border border-transparent hover:border-warm-grey/40 hover:bg-charcoal/[0.04] active:bg-charcoal/[0.08]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-xs tracking-[0.12em]",
  md: "px-6 py-3 text-xs sm:text-sm tracking-[0.14em]",
  lg: "px-8 py-4 text-sm sm:text-base tracking-[0.16em]",
};

export const Button = React.forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps
>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      className,
      children,
      href,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const baseStyles = cn(
      "relative inline-flex items-center justify-center font-medium uppercase font-sans",
      "rounded-none shadow-none text-center cursor-pointer select-none",
      "transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze focus-visible:ring-offset-2",
      variantStyles[variant],
      sizeStyles[size],
      isDisabled &&
        "opacity-50 cursor-not-allowed pointer-events-none hover:bg-transparent hover:text-inherit",
      className
    );

    const spinner = (
      <svg
        className="animate-spin -ml-1 mr-2 h-4 w-4 shrink-0 text-current"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );

    const content = (
      <>
        {loading && spinner}
        {!loading && leftIcon && (
          <span className="mr-2 inline-flex items-center shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <span className="truncate">{children}</span>
        {!loading && rightIcon && (
          <span className="ml-2 inline-flex items-center shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </>
    );

    if (href !== undefined) {
      if (isDisabled) {
        return (
          <a
            ref={ref as React.Ref<HTMLAnchorElement>}
            role="link"
            aria-disabled="true"
            tabIndex={-1}
            className={baseStyles}
            {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
          >
            {content}
          </a>
        );
      }

      return (
        <Link
          href={href}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={baseStyles}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type}
        disabled={isDisabled}
        aria-busy={loading}
        className={baseStyles}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
