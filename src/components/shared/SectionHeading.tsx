"use client";

import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export type SectionHeadingAlign = "left" | "center" | "right";

export interface SectionHeadingProps
  extends Omit<HTMLMotionProps<"div">, "title"> {
  label?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: SectionHeadingAlign;
  as?: "h1" | "h2" | "h3" | "h4";
  showDivider?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export const SectionHeading = React.forwardRef<HTMLDivElement, SectionHeadingProps>(
  (
    {
      label,
      title,
      description,
      align = "left",
      as: HeadingTag = "h2",
      showDivider = false,
      className,
      ...props
    },
    ref
  ) => {
    const alignmentClasses = {
      left: "text-left items-start",
      center: "text-center items-center mx-auto",
      right: "text-right items-end ml-auto",
    };

    return (
      <motion.div
        ref={ref}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        variants={containerVariants}
        className={cn(
          "flex flex-col max-w-3xl",
          alignmentClasses[align],
          className
        )}
        {...props}
      >
        {label && (
          <motion.div variants={itemVariants} className="mb-3">
            <span className="inline-block text-xs uppercase tracking-[0.2em] font-medium text-bronze select-none">
              {label}
            </span>
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <HeadingTag className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-charcoal leading-[1.15]">
            {title}
          </HeadingTag>
        </motion.div>

        {showDivider && (
          <motion.div
            variants={itemVariants}
            className={cn(
              "w-12 h-[2px] bg-bronze my-4",
              align === "center" && "mx-auto",
              align === "right" && "ml-auto"
            )}
            aria-hidden="true"
          />
        )}

        {description && (
          <motion.div
            variants={itemVariants}
            className={cn(
              "text-charcoal/75 text-sm sm:text-base md:text-lg font-sans leading-relaxed mt-4",
              align === "center" && "max-w-2xl"
            )}
          >
            {typeof description === "string" ? (
              <p>{description}</p>
            ) : (
              description
            )}
          </motion.div>
        )}
      </motion.div>
    );
  }
);

SectionHeading.displayName = "SectionHeading";

export default SectionHeading;
