import React from 'react';

export interface StroLogoProps {
  className?: string;
  size?: number;
}

/**
 * STRO — Original architectural geometric monogram derived from the letter "S".
 * Two precision-angled coating planes separated by a clean architectural reveal.
 */
export const StroLogo: React.FC<StroLogoProps> = ({
  className = '',
  size = 24,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Upper architectural plane forming top half of geometric S */}
      <path
        d="M8 5H24V10.5H13.5V14H24V15.5H8V5Z"
        fill="currentColor"
      />
      {/* Precision diagonal/stepped bronze reveal accent */}
      <path
        d="M8 15.5H24V17.5H8V15.5Z"
        fill="#A78B65"
        className="dark:fill-[#C9B28F]"
      />
      {/* Lower architectural plane forming bottom half of geometric S */}
      <path
        d="M8 17.5H18.5V21.5H8V27H24V17.5H8Z"
        fill="currentColor"
        opacity="0.92"
      />
      {/* Subtle signature crimson corner point */}
      <rect x="21" y="24" width="3" height="3" fill="#C41E1E" />
    </svg>
  );
};

export default StroLogo;
