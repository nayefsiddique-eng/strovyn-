import React, { useId } from "react";
import { cn } from "@/lib/utils";

export type InputVariant = "bordered" | "underline";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  variant?: InputVariant;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id,
      label,
      error,
      helperText,
      variant = "bordered",
      leftElement,
      rightElement,
      className,
      disabled,
      required,
      containerClassName,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    const variantStyles = {
      bordered: cn(
        "w-full bg-white text-charcoal text-sm font-sans placeholder:text-warm-grey",
        "border border-warm-grey/60 px-4 py-3 rounded-none shadow-none",
        "transition-colors duration-200 ease-out",
        "focus:outline-none focus:border-bronze focus:ring-1 focus:ring-bronze",
        error && "border-red-600 focus:border-red-600 focus:ring-red-600",
        leftElement && "pl-11",
        rightElement && "pr-11"
      ),
      underline: cn(
        "w-full bg-transparent text-charcoal text-sm font-sans placeholder:text-warm-grey",
        "border-0 border-b border-warm-grey/60 px-0 py-3 rounded-none shadow-none",
        "transition-colors duration-200 ease-out",
        "focus:outline-none focus:border-bronze focus:border-b-2",
        error && "border-red-600 focus:border-red-600",
        leftElement && "pl-8",
        rightElement && "pr-8"
      ),
    };

    return (
      <div className={cn("w-full flex flex-col", containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-charcoal select-none"
          >
            {label}
            {required && (
              <span className="text-bronze ml-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <div className="relative flex items-center w-full">
          {leftElement && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-warm-grey">
              {leftElement}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId || helperId}
            className={cn(
              variantStyles[variant],
              disabled &&
                "opacity-50 cursor-not-allowed bg-warm-grey/10 border-warm-grey/30",
              className
            )}
            {...props}
          />

          {rightElement && (
            <div className="absolute right-3.5 flex items-center text-warm-grey">
              {rightElement}
            </div>
          )}
        </div>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="mt-1.5 text-xs text-red-600 tracking-wide font-sans flex items-center gap-1"
          >
            <span aria-hidden="true">•</span>
            {error}
          </p>
        )}

        {!error && helperText && (
          <p
            id={helperId}
            className="mt-1.5 text-xs text-warm-grey tracking-wide font-sans"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
