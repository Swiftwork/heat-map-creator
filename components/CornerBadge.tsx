'use client';

interface CornerBadgeProps {
  speedLimit: number;
  x: number;
  y: number;
  rotation?: number;
}

export function CornerBadge({ speedLimit, x, y, rotation = 0 }: CornerBadgeProps) {
  const size = 45;
  const radius = size / 2;
  const scale = size / 100; // Scale factor from original 100x100 SVG
  
  // Calculate font size - make it large and proportional to badge size
  const fontSize = size * 0.52;

  return (
    <>
      {/* Badge background, clock marks, and text - all scaled and rotated together */}
      <g transform={`translate(${x - radius}, ${y - radius}) scale(${scale}) rotate(${rotation} 50 50)`}>
        <defs>
          <clipPath id={`clip-badge-${speedLimit}`}>
            <rect height="100" rx="50" width="100" />
          </clipPath>
        </defs>
        
        {/* Background circle with white fill */}
        <rect fill="white" height="100" rx="50" width="100" />
        
        <g clipPath={`url(#clip-badge-${speedLimit})`}>
          {/* Clock/game board marks */}
          <path
            d="M21.2053 81.9353C14.7486 76.1135 10.2082 68.4714 8.18297 60.0168C6.15777 51.5622 6.74287 42.6923 9.86112 34.577C12.9794 26.4616 18.4843 19.4821 25.6498 14.559C32.8153 9.63583 41.3048 7.0003 49.9985 7C58.6923 6.9997 67.182 9.63466 74.3478 14.5573C81.5137 19.48 87.019 26.4591 90.1378 34.5742C93.2566 42.6893 93.8423 51.5592 91.8177 60.0139C89.7931 68.4687 85.2532 76.1111 78.7969 81.9333L75.8951 78.7155C81.7008 73.48 85.7832 66.6076 87.6038 59.0048C89.4244 51.4021 88.8977 43.426 86.0932 36.1287C83.2887 28.8313 78.3381 22.5554 71.8943 18.1288C65.4506 13.7022 57.8164 11.3328 49.9987 11.333C42.181 11.3333 34.5469 13.7033 28.1035 18.1303C21.6601 22.5574 16.7099 28.8336 13.9058 36.1311C11.1018 43.4287 10.5757 51.4048 12.3968 59.0074C14.2179 66.6101 18.3008 73.4821 24.1069 78.7172L21.2053 81.9353Z"
            fill="black"
          />
          <path d="M29.4941 73.335L21.7158 81.1123L18.8877 78.2842L26.665 70.5059L29.4941 73.335Z" fill="black" />
          <path d="M81.1123 78.2842L78.2842 81.1123L70.5059 73.335L73.335 70.5059L81.1123 78.2842Z" fill="black" />
          <path d="M19 52H8V48H19V52Z" fill="black" />
          <path d="M92 52H81V48H92V52Z" fill="black" />
          <path d="M29.4941 26.665L26.665 29.4941L18.8877 21.7158L21.7158 18.8877L29.4941 26.665Z" fill="black" />
          <path d="M81.1123 21.7158L73.335 29.4941L70.5059 26.665L78.2842 18.8877L81.1123 21.7158Z" fill="black" />
          <path d="M52 19H48V8H52V19Z" fill="black" />
        </g>
        
        {/* Border */}
        <rect
          fill="none"
          height="97"
          rx="48.5"
          stroke="black"
          strokeWidth="3"
          width="97"
          x="1.5"
          y="1.5"
        />
        
        {/* Speed limit number - now inside the rotated group */}
        <text
          fill="black"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: `${fontSize / scale}px`, // Adjust font size for scaling
            fontWeight: 700,
          }}
          textAnchor="middle"
          x="50"
          y={50 + (size * 0.19) / scale} // Adjust y position for scaling
        >
          {speedLimit}
        </text>
      </g>
    </>
  );
}
