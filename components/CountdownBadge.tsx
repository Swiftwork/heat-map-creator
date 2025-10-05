'use client';

interface CountdownBadgeProps {
  number: number;
  x: number;
  y: number;
  rotation?: number;
}

// Constants for badge sizing and styling
const BADGE_SIZE = 25;
const BADGE_RADIUS = BADGE_SIZE / 2;
const SCALE_FACTOR = BADGE_SIZE / 100;
const FONT_SIZE_RATIO = 0.65;
const TEXT_Y_OFFSET_RATIO = 0.6;
const TEXT_ROTATION_OFFSET_RATIO = 0.2;

// Countdown range constants
const MIN_COUNTDOWN = 0;
const MAX_COUNTDOWN = 3;

// Color constants
const COLORS = {
  GOLD: '#d39013ff',
  BLACK: 'black',
} as const;

// Badge dimensions
const BADGE_DIMENSIONS = {
  OUTER: { width: 88, height: 88, rx: 8, x: 6, y: 6, strokeWidth: 5 },
  INNER: { width: 76, height: 76, rx: 6, x: 12, y: 12, strokeWidth: 3 },
  DECORATIVE_CIRCLES: { radius: 5, topLeft: { cx: 22, cy: 22 }, bottomRight: { cx: 78, cy: 78 } },
} as const;

export function CountdownBadge({
  number,
  x,
  y,
  rotation = 0,
}: CountdownBadgeProps) {
  // Only show for valid countdown numbers
  if (number < MIN_COUNTDOWN || number > MAX_COUNTDOWN) {
    return null;
  }

  const fontSize = BADGE_SIZE * FONT_SIZE_RATIO;
  const textRotationY = 50 + (BADGE_SIZE * TEXT_ROTATION_OFFSET_RATIO) / SCALE_FACTOR;
  const textY = 50 + (BADGE_SIZE * TEXT_Y_OFFSET_RATIO) / SCALE_FACTOR;

  return (
    <g
      transform={`translate(${x - BADGE_RADIUS}, ${y - BADGE_RADIUS}) scale(${SCALE_FACTOR}) rotate(${rotation} 50 50)`}
    >
      {/* Outer badge background */}
      <rect
        fill={COLORS.GOLD}
        height={BADGE_DIMENSIONS.OUTER.height}
        rx={BADGE_DIMENSIONS.OUTER.rx}
        stroke={COLORS.BLACK}
        strokeWidth={BADGE_DIMENSIONS.OUTER.strokeWidth}
        width={BADGE_DIMENSIONS.OUTER.width}
        x={BADGE_DIMENSIONS.OUTER.x}
        y={BADGE_DIMENSIONS.OUTER.y}
      />

      {/* Inner border for inset effect */}
      <rect
        fill="none"
        height={BADGE_DIMENSIONS.INNER.height}
        rx={BADGE_DIMENSIONS.INNER.rx}
        stroke={COLORS.BLACK}
        strokeWidth={BADGE_DIMENSIONS.INNER.strokeWidth}
        width={BADGE_DIMENSIONS.INNER.width}
        x={BADGE_DIMENSIONS.INNER.x}
        y={BADGE_DIMENSIONS.INNER.y}
      />

      {/* Decorative circles */}
      <circle
        cx={BADGE_DIMENSIONS.DECORATIVE_CIRCLES.topLeft.cx}
        cy={BADGE_DIMENSIONS.DECORATIVE_CIRCLES.topLeft.cy}
        fill={COLORS.BLACK}
        r={BADGE_DIMENSIONS.DECORATIVE_CIRCLES.radius}
      />
      <circle
        cx={BADGE_DIMENSIONS.DECORATIVE_CIRCLES.bottomRight.cx}
        cy={BADGE_DIMENSIONS.DECORATIVE_CIRCLES.bottomRight.cy}
        fill={COLORS.BLACK}
        r={BADGE_DIMENSIONS.DECORATIVE_CIRCLES.radius}
      />

      {/* Countdown number text */}
      <text
        fill={COLORS.BLACK}
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: `${fontSize / SCALE_FACTOR}px`,
          fontWeight: 700,
        }}
        textAnchor="middle"
        transform={`rotate(135 50 ${textRotationY})`}
        x="37"
        y={textY}
      >
        {number}
      </text>
    </g>
  );
}
