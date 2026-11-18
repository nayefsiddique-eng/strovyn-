"use client";

import React, { useId, useState } from "react";
import { cn } from "@/lib/utils";

export type TextareaVariant = "bordered" | "underline";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  variant?: TextareaVariant;
  showCount?: boolean;
  containerClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      id,
      label,
      error,
      helperText,
      variant = "bordered",
      showCount = false,
      maxLength,
      className,
      disabled,
      required,
      rows = 4,
      containerClassName,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const errorId = error ? `${textareaId}-error` : undefined;
    const helperId = helperText ? `${textareaId}-helper` : undefined;

    // Track character count for both controlled and uncontrolled usage
    const initialLength =
      typeof value === "string"
        ? value.length
        : typeof defaultValue === "string"
        ? defaultValue.length
        : 0;

    const [charCount, setCharCount] = useState<number>(initialLength);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      onChange?.(e);
    };

    // If controlled, sync count with value
    const currentLength =
      typeof value === "string" ? value.length : charCount;

    const variantStyles = {
      bordered: cn(
        "w-full bg-white text-charcoal text-sm font-sans placeholder:text-warm-grey-dark",
        "border border-warm-grey/60 p-4 rounded-none shadow-none resize-y",
        "transition-colors duration-200 ease-out",
        "focus:outline-none focus:border-bronze focus:ring-1 focus:ring-bronze",
        error && "border-red-600 focus:border-red-600 focus:ring-red-600"
      ),
      underline: cn(
        "w-full bg-transparent text-charcoal text-sm font-sans placeholder:text-warm-grey-dark",
        "border-0 border-b border-warm-grey/60 px-0 py-3 rounded-none shadow-none resize-y",
        "transition-colors duration-200 ease-out",
        "focus:outline-none focus:border-bronze focus:border-b-2",
        error && "border-red-600 focus:border-red-600"
      ),
    };

    return (
      <div className={cn("w-full flex flex-col", containerClassName)}>
        <div className="flex items-center justify-between mb-2">
          {label && (
            <label
              htmlFor={textareaId}
              className="text-xs font-medium uppercase tracking-[0.12em] text-charcoal select-none"
            >
              {label}
              {required && (
                <span className="text-bronze ml-1" aria-hidden="true">
                  *
                </span>
              )}
            </label>
          )}

          {showCount && (
            <span
              className={cn(
                "text-[11px] font-sans tracking-wider text-warm-grey ml-auto",
                maxLength &&
                  currentLength >= maxLength &&
                  "text-red-600 font-semibold"
              )}
              aria-live="polite"
            >
              {maxLength ? `${currentLength}/${maxLength}` : `${currentLength} chars`}
            </span>
          )}
        </div>

        <textarea
          id={textareaId}
          ref={ref}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled}
          required={required}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
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

Textarea.displayName = "Textarea";

export default Textarea;
