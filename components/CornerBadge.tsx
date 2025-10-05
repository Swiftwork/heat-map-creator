"use client";

interface CornerBadgeProps {
  speedLimit: number;
  x: number;
  y: number;
  rotation?: number;
  isSelected?: boolean;
  isRemoveMode?: boolean;
  onClick?: () => void;
}

// Constants for badge sizing and styling
const BADGE_SIZE = 45;
const BADGE_RADIUS = BADGE_SIZE / 2;
const SCALE_FACTOR = BADGE_SIZE / 100;
const FONT_SIZE_RATIO = 0.45;
const TEXT_Y_OFFSET_RATIO = 0.22;

// Color constants
const COLORS = {
  WHITE: "white",
  RED: "#ff4444",
  YELLOW: "#ffe600",
  BLACK: "black",
  GRAY: "#555",
} as const;

export function CornerBadge({
  speedLimit,
  x,
  y,
  rotation = 0,
  isSelected = false,
  isRemoveMode = false,
  onClick,
}: CornerBadgeProps) {
  const fontSize = BADGE_SIZE * FONT_SIZE_RATIO;

  const getBadgeColor = (): string => {
    if (isRemoveMode) return COLORS.RED;
    if (isSelected) return COLORS.YELLOW;
    return COLORS.WHITE;
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
      transform={`translate(${x - BADGE_RADIUS}, ${y - BADGE_RADIUS}) scale(${SCALE_FACTOR}) rotate(${rotation} 50 50)`}
      onClick={handleClick}
    >
      {/* Background circle */}
      <circle cx="50" cy="50" fill={getBadgeColor()} r="50" />

      <circle cx="50" cy="50" r="45.98" />
      <circle cx="50" cy="50" fill={COLORS.WHITE} r="41.35" />
      <path d="M28.77,65.66l-4.09,3.68c-3.83-5-6.21-11.17-6.52-17.88l5.51.19c-.03-.55-.06-1.1-.06-1.65,0-1.18.09-2.34.24-3.49l-5.51-.19c.76-6.63,3.56-12.63,7.74-17.39l3.83,3.97c1.11-1.31,2.35-2.5,3.7-3.57l-3.84-3.97c4.88-4.01,10.98-6.59,17.65-7.12v5.51c.85-.08,1.7-.13,2.57-.13s1.73.04,2.57.13v-5.51c7.46.6,14.19,3.76,19.32,8.6l-4.1,3.69c1.27,1.16,2.42,2.44,3.44,3.82l4.09-3.68c3.83,5,6.21,11.17,6.52,17.88l-5.51-.19c.03.55.06,1.1.06,1.65,0,1.18-.09,2.34-.24,3.49l5.51.19c-.76,6.63-3.56,12.63-7.74,17.39l-3.83-3.97c-1.11,1.3-2.34,2.48-3.67,3.55l7.34,7.6c8.04-6.77,13.16-16.91,13.16-28.24,0-20.38-16.52-36.91-36.91-36.91S13.09,29.62,13.09,50c0,10.4,4.31,19.78,11.22,26.49l7.84-7.06c-1.25-1.15-2.39-2.41-3.39-3.77Z" fill={COLORS.GRAY} />

      {/* Speed limit text */}
      <text
        fill={COLORS.BLACK}
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: `${fontSize / SCALE_FACTOR}px`,
          fontWeight: 700,
        }}
        textAnchor="middle"
        x="50"
        y={50 + (BADGE_SIZE * TEXT_Y_OFFSET_RATIO) / SCALE_FACTOR}
      >
        {speedLimit}
      </text>
    </g>
  );
}
