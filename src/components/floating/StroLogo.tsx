import React from 'react';

export interface StroLogoProps {
  className?: string;
  size?: number;
}

/**
 * STRO — Bespoke architectural geometric monogram derived from a structured "S" plane
 * bisected by a crisp bronze reveal datum and signature crimson focal mark.
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
      {/* Perimeter hairline frame */}
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1"
      />
      {/* Upper architectural S-plane */}
      <path
        d="M7 6.5H25V10.5H11.5V14.25H25V15.5H7V6.5Z"
        fill="currentColor"
      />
      {/* Central horizontal bronze architectural shadow-line reveal */}
      <rect x="7" y="15.5" width="18" height="2" fill="#A78B65" />
      {/* Lower architectural S-plane */}
      <path
        d="M7 17.5H20.5V21.5H7V25.5H25V17.5H7Z"
        fill="currentColor"
        fillOpacity="0.9"
      />
      {/* Signature crimson architectural datum accent */}
      <rect x="22" y="22.5" width="3" height="3" fill="#C41E1E" />
    </svg>
  );
};

export default StroLogo;
