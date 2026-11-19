import React from 'react';

export interface VoltaBrandMarkProps {
  className?: string;
  inverted?: boolean;
}

export const VoltaBrandMark: React.FC<VoltaBrandMarkProps> = ({
  className = 'w-8 h-8',
  inverted = false,
}) => (
  <svg
    className={`${className} shrink-0`}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
  >
    <rect
      width="32"
      height="32"
      rx="7"
      fill={inverted ? '#0A6847' : '#0A3B40'}
    />
    <path
      d="M9.5 9.5L16 23L22.5 9.5"
      stroke="#FFFFFF"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13 9.5L16 16L19 9.5"
      stroke="#34D399"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
