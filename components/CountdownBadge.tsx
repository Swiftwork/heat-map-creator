"use client";

interface CountdownBadgeProps {
  number: number;
  x: number;
  y: number;
  rotation?: number;
}

export function CountdownBadge({
  number,
  x,
  y,
  rotation = 0,
}: CountdownBadgeProps) {
  const size = 25;
  const radius = size / 2;
  const scale = size / 100; // Scale factor from original 100x100 SVG

  // Only show for numbers 0-3
  if (number < 0 || number > 3) {
    return null;
  }

  return (
    <>
      {/* Badge with exact SVG structure */}
      <g transform={`translate(${x - radius}, ${y - radius}) scale(${scale}) rotate(${rotation} 50 50)`}>
  <rect fill="#B27E00" height="88" rx="8" stroke="black" strokeWidth="5" width="88" x="6" y="6"/>
  {/* Inner inset stroke to match the sample */}
  <rect fill="none" height="76" rx="6" stroke="black" strokeWidth="3" width="76" x="12" y="12"/>

        {/* Decorative small circles */}
        {/* top-left */}
        <circle cx="22" cy="22" fill="black" r="5" />
        {/* bottom-right */}
        <circle cx="78" cy="78" fill="black" r="5" />

        {/* Countdown number text */}
        <text
          fill="black"
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: `${(size * 0.65) / scale}px`,
            fontWeight: 700,
          }}
          textAnchor="middle"
          transform={`rotate(135 50 ${50 + (size * 0.2) / scale})`}
          x="37"
          y={50 + (size * 0.6) / scale}
        >
          {number}
        </text>
      </g>
    </>
  );
}
