import React, { useId } from "react";
import { cn } from "@/lib/utils";

export type SelectVariant = "bordered" | "underline";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
  variant?: SelectVariant;
  options?: SelectOption[];
  containerClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      id,
      label,
      error,
      helperText,
      placeholder,
      variant = "bordered",
      options,
      className,
      disabled,
      required,
      children,
      containerClassName,
      defaultValue,
      value,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const errorId = error ? `${selectId}-error` : undefined;
    const helperId = helperText ? `${selectId}-helper` : undefined;

    const variantStyles = {
      bordered: cn(
        "w-full bg-white text-charcoal text-sm font-sans appearance-none [-webkit-appearance:none] [-moz-appearance:none]",
        "border border-warm-grey/60 px-4 py-3 pr-10 rounded-none shadow-none cursor-pointer",
        "transition-colors duration-200 ease-out",
        "focus:outline-none focus:border-bronze focus:ring-1 focus:ring-bronze",
        error && "border-red-600 focus:border-red-600 focus:ring-red-600"
      ),
      underline: cn(
        "w-full bg-transparent text-charcoal text-sm font-sans appearance-none [-webkit-appearance:none] [-moz-appearance:none]",
        "border-0 border-b border-warm-grey/60 px-0 py-3 pr-8 rounded-none shadow-none cursor-pointer",
        "transition-colors duration-200 ease-out",
        "focus:outline-none focus:border-bronze focus:border-b-2",
        error && "border-red-600 focus:border-red-600"
      ),
    };

    return (
      <div className={cn("w-full flex flex-col", containerClassName)}>
        {label && (
          <label
            htmlFor={selectId}
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
          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            required={required}
            value={value}
            defaultValue={defaultValue ?? (placeholder ? "" : undefined)}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId || helperId}
            className={cn(
              variantStyles[variant],
              disabled &&
                "opacity-50 cursor-not-allowed bg-warm-grey/10 border-warm-grey/30",
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled hidden>
                {placeholder}
              </option>
            )}

            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="bg-white text-charcoal py-1"
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          {/* Architectural geometric chevron arrow */}
          <div
            className={cn(
              "absolute pointer-events-none flex items-center justify-center text-charcoal/70 transition-transform",
              variant === "underline" ? "right-0" : "right-3.5"
            )}
            aria-hidden="true"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="square"
              strokeLinejoin="miter"
            >
              <polyline points="4 6 8 10 12 6" />
            </svg>
          </div>
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

Select.displayName = "Select";

export default Select;
