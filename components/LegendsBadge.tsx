"use client";

interface LegendsBadgeProps {
  x: number;
  y: number;
  rotation?: number;
  isSelected?: boolean;
  isRemoveMode?: boolean;
  onClick?: () => void;
  scale?: number; // Scale percentage (100 = 100%)
}

// Constants for badge sizing and styling
const BADGE_SIZE = 75;

// Color constants
const COLORS = {
  WHITE: "white",
  RED: "#ff4444",
  YELLOW: "#d39013",
  BROWN: "#8b4513",
  DARKGREY: "#333",
  BEIGE: "#f5f5dc",
  BLACK: "black",
  GREEN: "#4caf50",
} as const;

export function LegendsBadge({
  x,
  y,
  rotation = 0,
  isSelected = false,
  isRemoveMode = false,
  onClick,
  scale = 100,
}: LegendsBadgeProps) {
  // Apply scale to badge size while keeping final values the same
  const scaledBadgeSize = BADGE_SIZE * (scale / 100);
  const scaledBadgeRadius = scaledBadgeSize / 2;
  const scaledScaleFactor = scaledBadgeSize / 100;

  const getBadgeColor = (): string => {
    if (isRemoveMode) return COLORS.RED;
    if (isSelected) return COLORS.GREEN;
    return COLORS.YELLOW;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <g
      style={{ cursor: onClick ? "pointer" : "default" }}
      transform={`translate(${x - scaledBadgeRadius}, ${y - scaledBadgeRadius}) scale(${scaledScaleFactor}) rotate(${rotation} 50 50)`}
      onClick={handleClick}
    >
      <path
        d="M98.58,17.78l-9.6-10.63c-10.4,4-28.86,3.54-39.69-7.15-10.83,10.69-29.29,11.15-39.69,7.15L0,17.78s10.51,17.03,6.06,40.23,2.63,35.14,16.23,35.49c13.6.34,19.8-.09,27,6.51,7.2-6.59,13.4-6.16,27-6.51,13.6-.34,20.69-12.29,16.23-35.49s6.06-40.23,6.06-40.23Z"
        fill={getBadgeColor()}
      />
      <path
        d="M49.29,91.22c-6.91-4.29-13.97-4.44-23.72-4.65-.99-.02-2.03-.04-3.11-.07-3.36-.08-5.82-1.15-7.52-3.25-1.99-2.47-4.9-8.87-2.01-23.91,3.51-18.29-1.31-33.14-4.53-40.41l3.41-3.78c3.6.87,7.56,1.33,11.55,1.33,9.74,0,18.87-2.67,25.92-7.46,7.05,4.79,16.18,7.46,25.92,7.46,3.99,0,7.95-.46,11.55-1.33l3.41,3.78c-3.22,7.27-8.04,22.12-4.53,40.41,2.89,15.04-.02,21.44-2.01,23.91-1.69,2.1-4.15,3.17-7.52,3.25-1.08.03-2.12.05-3.11.07-9.75.21-16.8.36-23.72,4.65Z"
        fill={COLORS.BROWN}
      />
      <path
        d="M76.86,46.55c0-15.22-12.34-27.57-27.57-27.57h0c-15.22,0-27.57,12.34-27.57,27.57,0,1.17-.67,8.27.81,15.47,1.16,5.61,1.31,10.63,6.06,17.23,0,0,.29-.68.88-1.73-3.07-7.01-5.89-17.32-6.09-20.63-.23-3.78.17-4.98,4.69-4.92,4.51.06,8.57,2.06,21.23,2.06s16.71-2,21.23-2.06c4.51-.06,4.91,1.14,4.69,4.92-.2,3.3-3.02,13.62-6.09,20.63.59,1.06.88,1.73.88,1.73,4.74-6.6,4.9-11.62,6.06-17.23,1.49-7.2.81-14.3.81-15.47Z"
        fill={COLORS.YELLOW}
      />
      <path
        d="M70.52,51.96c-4.51.06-8.57,2.06-21.23,2.06s-16.71-2-21.23-2.06c-4.51-.06-4.91,1.14-4.69,4.92.2,3.3,3.02,13.62,6.09,20.63,2.2-3.98,8.62-13.44,19.82-13.44h0c11.2,0,17.62,9.46,19.82,13.44,3.07-7.01,5.89-17.32,6.09-20.63.23-3.78-.17-4.98-4.69-4.92Z"
        fill={COLORS.DARKGREY}
      />
      <path
        d="M72.88,32.28l-4.37-.51c-.2-.47-.43-.99-.7-1.58-1.89-4.18-4.34-4.57-4.34-4.57,0,0-7.49-2.34-14.17-2.34s-14.17,2.34-14.17,2.34c0,0-2.46.39-4.34,4.57-.27.59-.5,1.11-.7,1.58l-4.38.51c-1.85,3.06-3.13,6.51-3.68,10.2h6.33c.24,1.19.84,2.33,2.19,3.26,3.31,2.29,6.57,4.46,11.66.97,5.09-3.49,4.23-4.29,4.74-5.6s1.37-2.86,2.34-2.86,1.83,1.54,2.34,2.86-.34,2.11,4.74,5.6c5.09,3.49,8.34,1.31,11.66-.97,1.34-.93,1.95-2.07,2.19-3.26h6.33c-.55-3.69-1.82-7.14-3.68-10.2Z"
        fill={COLORS.DARKGREY}
      />
      <path
        d="M30.66,33.04c.68-1.5,5.14-2.97,8.91-2.86s6.63.11,6.91,2.86-.74,4.86-1.83,6.4-1.89,4.46-7.83,4.57-5.66-2-6.17-3.43-.57-6.29,0-7.54Z"
        fill={COLORS.BEIGE}
      />
      <path
        d="M67.87,33.04c-.68-1.5-5.14-2.97-8.91-2.86s-6.63.11-6.91,2.86.74,4.86,1.83,6.4,1.89,4.46,7.83,4.57,5.66-2,6.17-3.43.57-6.29,0-7.54Z"
        fill={COLORS.BEIGE}
      />
    </g>
  );
}
