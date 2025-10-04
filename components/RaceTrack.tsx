"use client";

import { BezierPoint, Corner, Space } from "@/types/spline";
import { calculateChainArcLength, calculateChainTangent, evaluateChainAtT, findTForDistance, pointsToBezierSegments } from "@/utils/bezierChain";
import { bezierToSvgPath } from "@/utils/pathUtils";

interface RaceTrackProps {
  points: BezierPoint[];
  segments: number;
  closed: boolean;
  spaces: Space[];
  corners: Corner[];
  showSpaces: boolean;
  showCorners: boolean;
  showStartFinish: boolean;
  startFinishSpaceIndex: number;
  editingMode?: 'spline' | 'corners' | 'metadata';
  onSpaceClick?: (spaceIndex: number) => void;
  selectedCorner?: string | null;
  onStartFinishClick?: (spaceIndex: number) => void;
}

interface Point {
  x: number;
  y: number;
}

export function RaceTrack({ 
  points, 
  segments, 
  closed, 
  spaces, 
  corners, 
  showSpaces, 
  showCorners, 
  showStartFinish, 
  startFinishSpaceIndex,
  editingMode = 'spline',
  onSpaceClick,
  selectedCorner,
  onStartFinishClick
}: RaceTrackProps) {
  if (points.length < 2) return null;

  const trackWidth = 100; // Total width of the race track
  const samplesPerCurve = 100; // High sampling for smooth, consistent width and proper closure

  // Evaluate a cubic bezier at parameter t
  const cubicBezier = (p0: Point, cp1: Point, cp2: Point, p1: Point, t: number): Point => {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    return {
      x: mt3 * p0.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p1.x,
      y: mt3 * p0.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p1.y,
    };
  };

  // Calculate tangent at parameter t
  const cubicBezierTangent = (p0: Point, cp1: Point, cp2: Point, p1: Point, t: number): Point => {
    const t2 = t * t;
    const mt = 1 - t;
    const mt2 = mt * mt;

    return {
      x: -3 * mt2 * p0.x + 3 * mt2 * cp1.x - 6 * mt * t * cp1.x + 6 * mt * t * cp2.x - 3 * t2 * cp2.x + 3 * t2 * p1.x,
      y: -3 * mt2 * p0.y + 3 * mt2 * cp1.y - 6 * mt * t * cp1.y + 6 * mt * t * cp2.y - 3 * t2 * cp2.y + 3 * t2 * p1.y,
    };
  };

  // Sample points densely along the curve and create offset paths
  const generateOffsetPath = (offset: number): string => {
    const sampledPoints: Point[] = [];
    const numCurves = closed ? points.length : points.length - 1;

    // Sample each curve segment
    for (let i = 0; i < numCurves; i++) {
      const current = points[i];
      const next = points[(i + 1) % points.length];
      if (!current || !next) continue;

      const cp1 = current.handleOut || current;
      const cp2 = next.handleIn || next;

      // Sample this curve segment including endpoint on last segment
      const maxSamples = i === numCurves - 1 ? samplesPerCurve + 1 : samplesPerCurve;
      for (let j = 0; j < maxSamples; j++) {
        const t = Math.min(j / samplesPerCurve, 1);
        
        // Get point on curve
        const point = cubicBezier(current, cp1, cp2, next, t);
        
        // Get tangent
        const tangent = cubicBezierTangent(current, cp1, cp2, next, t);
        const length = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
        
        if (length === 0) {
          sampledPoints.push(point);
          continue;
        }

        // Normalize tangent
        const nx = tangent.x / length;
        const ny = tangent.y / length;

        // Perpendicular is (-ny, nx)
        const perpX = -ny;
        const perpY = nx;

        // Offset the point
        sampledPoints.push({
          x: point.x + perpX * offset,
          y: point.y + perpY * offset,
        });
      }
    }

    // Create path from sampled points
    if (sampledPoints.length === 0) return "";
    
    const firstPoint = sampledPoints[0];
    if (!firstPoint) return "";

    let path = `M ${firstPoint.x} ${firstPoint.y}`;
    for (let i = 1; i < sampledPoints.length; i++) {
      const point = sampledPoints[i];
      if (point) {
        path += ` L ${point.x} ${point.y}`;
      }
    }
    
    if (closed) {
      path += ` L ${firstPoint.x} ${firstPoint.y} Z`;
    }

    return path;
  };

  // Create fill path by combining left and right offset paths
  const trackFillPath = (() => {
    const leftPoints: Point[] = [];
    const rightPoints: Point[] = [];
    const numCurves = closed ? points.length : points.length - 1;

    // Sample both sides simultaneously with higher density at connections
    for (let i = 0; i < numCurves; i++) {
      const current = points[i];
      const next = points[(i + 1) % points.length];
      if (!current || !next) continue;

      const cp1 = current.handleOut || current;
      const cp2 = next.handleIn || next;

      // Sample each curve segment including endpoint
      const maxSamples = i === numCurves - 1 ? samplesPerCurve + 1 : samplesPerCurve;
      for (let j = 0; j < maxSamples; j++) {
        const t = Math.min(j / samplesPerCurve, 1);
        
        const point = cubicBezier(current, cp1, cp2, next, t);
        const tangent = cubicBezierTangent(current, cp1, cp2, next, t);
        const length = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
        
        if (length === 0) continue;

        const nx = tangent.x / length;
        const ny = tangent.y / length;
        const perpX = -ny;
        const perpY = nx;

        leftPoints.push({
          x: point.x + perpX * (trackWidth / 2),
          y: point.y + perpY * (trackWidth / 2),
        });

        rightPoints.push({
          x: point.x - perpX * (trackWidth / 2),
          y: point.y - perpY * (trackWidth / 2),
        });
      }
    }

    if (leftPoints.length === 0) return "";

    const first = leftPoints[0];
    if (!first) return "";

    let path = `M ${first.x} ${first.y}`;
    
    // Draw left side
    for (let i = 1; i < leftPoints.length; i++) {
      const p = leftPoints[i];
      if (p) path += ` L ${p.x} ${p.y}`;
    }

    // Connect to right side (reversed)
    for (let i = rightPoints.length - 1; i >= 0; i--) {
      const p = rightPoints[i];
      if (p) path += ` L ${p.x} ${p.y}`;
    }

    // Explicitly close back to start
    if (closed) {
      path += ` L ${first.x} ${first.y}`;
    }
    path += " Z";
    return path;
  })();

  const outerLeftPath = generateOffsetPath(trackWidth / 2);
  const outerRightPath = generateOffsetPath(-trackWidth / 2);
  const centerPath = bezierToSvgPath(points, closed);

  // Calculate total path length for proper dash alignment
  const pathElement = typeof document !== 'undefined' ? document.createElementNS('http://www.w3.org/2000/svg', 'path') : null;
  let pathLength = 0;
  if (pathElement) {
    pathElement.setAttribute('d', centerPath);
    pathLength = pathElement.getTotalLength();
  }

  // Calculate dash array for center line based on segments
  // Make dashes 1/3 of original length, gap slightly more than half of dash length
  const dashLength = Math.max(3, (40 - segments / 10) / 3);
  const gapLength = dashLength * 0.65;
  
  // Adjust dash offset to ensure pattern aligns at closure
  const totalDashUnit = dashLength + gapLength;
  const dashOffset = pathLength > 0 ? (pathLength % totalDashUnit) / 2 : 0;

  // Generate segment crossing lines using arc-length-based spacing
  const segmentLines = (() => {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    
    if (!closed) return lines;
    
    // For closed paths, we need all points including wrapping back to first
    const bezierSegments = pointsToBezierSegments(points, 'C1');
    
    if (bezierSegments.length === 0) return lines;
    
    // Calculate total arc length of the path
    const totalArcLength = calculateChainArcLength(bezierSegments);
    const segmentArcLength = totalArcLength / segments;

    // Generate segment lines at even arc-length intervals
    // Start at half segment offset to avoid placing a line at the exact start/end point
    for (let seg = 0; seg < segments; seg++) {
      const targetDistance = (seg + 0.5) * segmentArcLength;
      
      // Find the position at this arc length
      const { segmentIndex, t } = findTForDistance(bezierSegments, targetDistance);
      
      // Get the point and tangent at this position
      const centerPoint = evaluateChainAtT(bezierSegments, segmentIndex, t);
      const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
      
      const tangentLength = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
      if (tangentLength === 0) continue;

      // Normalize tangent
      const nx = tangent.x / tangentLength;
      const ny = tangent.y / tangentLength;

      // Perpendicular is (-ny, nx)
      const perpX = -ny;
      const perpY = nx;

      // Calculate endpoints of the crossing line
      const halfWidth = trackWidth / 2;
      lines.push({
        x1: centerPoint.x + perpX * halfWidth,
        y1: centerPoint.y + perpY * halfWidth,
        x2: centerPoint.x - perpX * halfWidth,
        y2: centerPoint.y - perpY * halfWidth,
      });
    }

    return lines;
  })();

  // Generate corner lines - thicker lines crossing the track at corner positions
  const cornerLines = (() => {
    const lines: Array<{ 
      x1: number; y1: number; x2: number; y2: number; 
      leftX: number; leftY: number; rightX: number; rightY: number;
      corner: Corner 
    }> = [];
    
    if (!closed || corners.length === 0) return lines;
    
    const bezierSegments = pointsToBezierSegments(points, 'C1');
    if (bezierSegments.length === 0) return lines;
    
    const totalArcLength = calculateChainArcLength(bezierSegments);
    const segmentArcLength = totalArcLength / segments;

    corners.forEach(corner => {
      const space = spaces.find(s => s.index === corner.spaceIndex);
      if (!space) return;
      
      // Position corner at the end of the space (start of next space)
      const targetDistance = (corner.spaceIndex + -0.5) * segmentArcLength;
      const { segmentIndex, t } = findTForDistance(bezierSegments, targetDistance);
      
      const centerPoint = evaluateChainAtT(bezierSegments, segmentIndex, t);
      const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
      
      const tangentLength = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
      if (tangentLength === 0) return;

      const nx = tangent.x / tangentLength;
      const ny = tangent.y / tangentLength;
      const perpX = -ny;
      const perpY = nx;

      const halfWidth = trackWidth / 2;
      lines.push({
        x1: centerPoint.x + perpX * halfWidth,
        y1: centerPoint.y + perpY * halfWidth,
        x2: centerPoint.x - perpX * halfWidth,
        y2: centerPoint.y - perpY * halfWidth,
        leftX: centerPoint.x + perpX * halfWidth,
        leftY: centerPoint.y + perpY * halfWidth,
        rightX: centerPoint.x - perpX * halfWidth,
        rightY: centerPoint.y - perpY * halfWidth,
        corner
      });
    });

    return lines;
  })();

  // Calculate inner side segments between corners
  const innerSideSegments = (() => {
    if (!closed || corners.length === 0) return [];
    
    const sortedCorners = [...corners].sort((a, b) => a.spaceIndex - b.spaceIndex);
    const segments: Array<{
      startSpace: number;
      endSpace: number;
      side: 'left' | 'right';
    }> = [];

    sortedCorners.forEach((corner, idx) => {
      const nextCorner = sortedCorners[(idx + 1) % sortedCorners.length];
      if (!nextCorner) return;
      
      segments.push({
        startSpace: corner.spaceIndex,
        endSpace: nextCorner.spaceIndex,
        side: corner.innerSide
      });
    });

    return segments;
  })();

  // Calculate space countdown to next corner
  const spaceCountdowns = (() => {
    if (corners.length === 0 || spaces.length === 0) return new Map<number, number>();
    
    const sortedCorners = [...corners].sort((a, b) => a.spaceIndex - b.spaceIndex);
    const countdowns = new Map<number, number>();
    
    spaces.forEach(space => {
      // Find the next corner ahead of this space
      const nextCorner = sortedCorners.find(c => c.spaceIndex > space.index) || sortedCorners[0];
      if (!nextCorner) return;
      
      let spacesToCorner = nextCorner.spaceIndex - space.index;
      if (spacesToCorner < 0) {
        spacesToCorner = spaces.length - space.index + nextCorner.spaceIndex;
      }
      
      countdowns.set(space.index, spacesToCorner);
    });
    
    return countdowns;
  })();

  return (
    <g>
      {/* Asphalt fill - solid dark gray background */}
      <path d={trackFillPath} fill="#3a3a3a" stroke="none" />

      {/* White segment crossing lines */}
      {segmentLines.map((line, index) => (
        <line
          key={`segment-${index}`}
          stroke="white"
          strokeLinecap="round"
          strokeWidth={2}
          x1={line.x1}
          x2={line.x2}
          y1={line.y1}
          y2={line.y2}
        />
      ))}

      {/* Inner side thicker lines between corners */}
      {showCorners && innerSideSegments.map((segment, idx) => {
        // Generate smooth path for the thicker inner line
        const bezierSegments = pointsToBezierSegments(points, 'C1');
        if (bezierSegments.length === 0) return null;
        
        const totalArcLength = calculateChainArcLength(bezierSegments);
        const segmentArcLength = totalArcLength / segments;
        
        const innerPoints: Point[] = [];
        const startSpace = segment.startSpace;
        const endSpace = segment.endSpace;
        
        // Calculate start and end distances at the end of spaces
        const startDistance = (startSpace + -0.5) * segmentArcLength;
        let endDistance = (endSpace + -0.5) * segmentArcLength;
        
        // Handle wraparound
        if (endSpace < startSpace) {
          endDistance = totalArcLength + (endSpace + -0.5) * segmentArcLength;
        }
        
        const sectionLength = endDistance - startDistance;
        
        // Sample very densely for smooth curve, especially important for tight corners
        const numSpaces = endSpace > startSpace 
          ? endSpace - startSpace 
          : spaces.length - startSpace + endSpace;
        // Use 50 samples per space for very smooth curves, minimum 100 samples
        const numSamples = Math.max(numSpaces * 50, 100);
        
        for (let i = 0; i <= numSamples; i++) {
          const progress = i / numSamples;
          let targetDistance = startDistance + sectionLength * progress;
          
          // Wrap around if needed
          if (targetDistance > totalArcLength) {
            targetDistance -= totalArcLength;
          }
          
          const { segmentIndex, t } = findTForDistance(bezierSegments, targetDistance);
          
          const centerPoint = evaluateChainAtT(bezierSegments, segmentIndex, t);
          const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
          
          const tangentLength = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
          if (tangentLength === 0) continue;

          const nx = tangent.x / tangentLength;
          const ny = tangent.y / tangentLength;
          const perpX = -ny;
          const perpY = nx;

          const offset = segment.side === 'left' ? trackWidth / 2 : -trackWidth / 2;
          innerPoints.push({
            x: centerPoint.x + perpX * offset,
            y: centerPoint.y + perpY * offset
          });
        }
        
        if (innerPoints.length < 2) return null;
        
        const pathData = `M ${innerPoints[0]!.x} ${innerPoints[0]!.y} ` + 
          innerPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
        
        return (
          <path
            key={`inner-${idx}`}
            d={pathData}
            fill="none"
            stroke="white"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={8}
          />
        );
      })}

      {/* Spaces visualization */}
      {showSpaces && spaces.map((space) => {
        // Calculate current position based on live spline
        // Position at the integer boundary (start of space) to center between segment lines
        const bezierSegments = pointsToBezierSegments(points, 'C1');
        if (bezierSegments.length === 0) return null;
        
        const totalArcLength = calculateChainArcLength(bezierSegments);
        const segmentArcLength = totalArcLength / segments;
        const targetDistance = space.index * segmentArcLength;
        const { segmentIndex, t } = findTForDistance(bezierSegments, targetDistance);
        const currentPosition = evaluateChainAtT(bezierSegments, segmentIndex, t);
        
        const countdown = spaceCountdowns.get(space.index);
        const isInCornersMode = editingMode === 'corners';
        const isInMetadataMode = editingMode === 'metadata';
        const hasCorner = corners.some(c => c.spaceIndex === space.index);
        const corner = corners.find(c => c.spaceIndex === space.index);
        const isSelected = corner && selectedCorner === corner.id;
        const isStartFinish = space.index === startFinishSpaceIndex;
        
        return (
          <g key={`space-${space.id}`}>
            {/* Clickable area for corner placement */}
            {isInCornersMode && (
              <circle
                cx={currentPosition.x}
                cy={currentPosition.y}
                fill={hasCorner ? '#ff6b6b' : 'transparent'}
                opacity={0.3}
                r={12}
                stroke={isSelected ? '#ffff00' : (hasCorner ? '#ff6b6b' : '#4a9eff')}
                strokeWidth={isSelected ? 3 : 1}
                style={{ cursor: 'pointer' }}
                onClick={() => onSpaceClick?.(space.index)}
              />
            )}
            {/* Clickable area for start/finish placement */}
            {isInMetadataMode && (
              <circle
                cx={currentPosition.x}
                cy={currentPosition.y}
                fill={isStartFinish ? '#00ff00' : 'transparent'}
                opacity={0.3}
                r={12}
                stroke={isStartFinish ? '#00ff00' : '#4a9eff'}
                strokeWidth={isStartFinish ? 3 : 1}
                style={{ cursor: 'pointer' }}
                onClick={() => onStartFinishClick?.(space.index)}
              />
            )}
            {/* Space center marker */}
            <circle
              cx={currentPosition.x}
              cy={currentPosition.y}
              fill="#4a9eff"
              opacity={0.7}
              r={3}
            />
            {/* Space number */}
            <text
              fill="#4a9eff"
              fontSize="10"
              fontWeight="bold"
              x={currentPosition.x + 8}
              y={currentPosition.y - 8}
            >
              {space.index}
            </text>
            {/* Countdown to next corner */}
            {countdown !== undefined && countdown > 0 && (
              <text
                fill="#ffd700"
                fontSize="12"
                fontWeight="bold"
                textAnchor="middle"
                x={currentPosition.x}
                y={currentPosition.y + 20}
              >
                {countdown}
              </text>
            )}
          </g>
        );
      })}

      {/* Corner lines crossing the track */}
      {showCorners && cornerLines.map((line, index) => (
        <line
          key={`corner-line-${index}`}
          stroke="#ff6b6b"
          strokeLinecap="round"
          strokeWidth={5}
          x1={line.x1}
          x2={line.x2}
          y1={line.y1}
          y2={line.y2}
        />
      ))}

      {/* Corners visualization */}
      {showCorners && corners.map((corner) => {
        const space = spaces.find(s => s.index === corner.spaceIndex);
        if (!space) return null;
        
        // Calculate badge position outside the track
        const bezierSegments = pointsToBezierSegments(points, 'C1');
        if (bezierSegments.length === 0) return null;
        
        const totalArcLength = calculateChainArcLength(bezierSegments);
        const segmentArcLength = totalArcLength / segments;
        const targetDistance = (corner.spaceIndex + -0.5) * segmentArcLength;
        const { segmentIndex, t } = findTForDistance(bezierSegments, targetDistance);
        
        const centerPoint = evaluateChainAtT(bezierSegments, segmentIndex, t);
        const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
        const tangentLength = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
        
        if (tangentLength === 0) return null;
        
        const nx = tangent.x / tangentLength;
        const ny = tangent.y / tangentLength;
        const perpX = -ny;
        const perpY = nx;
        
        // Position badge on the outer side (opposite of inner side)
        const badgeOffset = corner.innerSide === 'left' ? -1 : 1;
        const badgeDistance = trackWidth / 2 + 25; // 25px outside track edge
        const badgeX = centerPoint.x + perpX * badgeOffset * badgeDistance;
        const badgeY = centerPoint.y + perpY * badgeOffset * badgeDistance;
        
        return (
          <g key={`corner-${corner.id}`}>
            {/* Speed limit badge outside track */}
            <rect
              fill="#ff6b6b"
              height={20}
              rx={4}
              width={30}
              x={badgeX - 15}
              y={badgeY - 10}
            />
            <text
              fill="white"
              fontSize="12"
              fontWeight="bold"
              textAnchor="middle"
              x={badgeX}
              y={badgeY + 4}
            >
              {corner.speedLimit}
            </text>
          </g>
        );
      })}

      {/* Start/Finish line */}
      {showStartFinish && (() => {
        // Calculate start/finish position at segment line (middle of space)
        const bezierSegments = pointsToBezierSegments(points, 'C1');
        if (bezierSegments.length === 0) return null;
        
        const totalArcLength = calculateChainArcLength(bezierSegments);
        const segmentArcLength = totalArcLength / segments;
        const targetDistance = (startFinishSpaceIndex + 0.5) * segmentArcLength;
        const { segmentIndex, t } = findTForDistance(bezierSegments, targetDistance);
        
        const centerPoint = evaluateChainAtT(bezierSegments, segmentIndex, t);
        const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
        const tangentLength = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
        
        if (tangentLength === 0) return null;
        
        const nx = tangent.x / tangentLength;
        const ny = tangent.y / tangentLength;
        const perpX = -ny;
        const perpY = nx;

        const halfWidth = trackWidth / 2;
        
        // Create checkered pattern along the line
        const lineLength = Math.sqrt(
          Math.pow((centerPoint.x - perpX * halfWidth) - (centerPoint.x + perpX * halfWidth), 2) +
          Math.pow((centerPoint.y - perpY * halfWidth) - (centerPoint.y + perpY * halfWidth), 2)
        );
        const checkerSize = 10;
        const numCheckers = Math.floor(lineLength / checkerSize);
        const checkers = [];
        
        for (let i = 0; i < numCheckers; i++) {
          const progress = i / numCheckers;
          const nextProgress = (i + 1) / numCheckers;
          const x1 = centerPoint.x + perpX * halfWidth + (centerPoint.x - perpX * halfWidth - (centerPoint.x + perpX * halfWidth)) * progress;
          const y1 = centerPoint.y + perpY * halfWidth + (centerPoint.y - perpY * halfWidth - (centerPoint.y + perpY * halfWidth)) * progress;
          const x2 = centerPoint.x + perpX * halfWidth + (centerPoint.x - perpX * halfWidth - (centerPoint.x + perpX * halfWidth)) * nextProgress;
          const y2 = centerPoint.y + perpY * halfWidth + (centerPoint.y - perpY * halfWidth - (centerPoint.y + perpY * halfWidth)) * nextProgress;
          
          checkers.push(
            <line
              key={`checker-${i}`}
              stroke={i % 2 === 0 ? 'white' : 'black'}
              strokeLinecap="butt"
              strokeWidth={6}
              x1={x1}
              x2={x2}
              y1={y1}
              y2={y2}
            />
          );
        }
        
        // Checkered flag position and rotation
        const flagX = centerPoint.x - perpX * (halfWidth + 30);
        const flagY = centerPoint.y - perpY * (halfWidth + 30);
        const flagSize = 30;
        
        // Calculate rotation angle to align flag with the line
        // The perpendicular vector gives us the direction across the track
        const angle = Math.atan2(perpY, perpX) * (180 / Math.PI);
        
        return (
          <g key="start-finish">
            {/* Checkered line crossing the track */}
            {checkers}
            
            {/* Checkered flag - rotated to align with line */}
            <g transform={`rotate(${angle} ${flagX} ${flagY})`}>
              {/* Flag pole */}
              <line
                stroke="#333"
                strokeWidth={2}
                x1={flagX - flagSize * 0.3}
                x2={flagX - flagSize * 0.3}
                y1={flagY - flagSize * 0.3}
                y2={flagY + flagSize * 0.8}
              />
              {/* Flag background */}
              <rect
                fill="white"
                height={flagSize}
                stroke="#333"
                strokeWidth={1}
                width={flagSize}
                x={flagX - flagSize * 0.3}
                y={flagY - flagSize * 0.3}
              />
              {/* Checkered pattern on flag - 5x5 grid */}
              {[0, 1, 2, 3, 4].map(row => 
                [0, 1, 2, 3, 4].map(col => {
                  const isBlack = (row + col) % 2 === 0;
                  return isBlack ? (
                    <rect
                      key={`flag-${row}-${col}`}
                      fill="black"
                      height={flagSize / 5}
                      width={flagSize / 5}
                      x={flagX - flagSize * 0.3 + col * (flagSize / 5)}
                      y={flagY - flagSize * 0.3 + row * (flagSize / 5)}
                    />
                  ) : null;
                })
              )}
            </g>
          </g>
        );
      })()}

      {/* White outer boundary - left */}
      <path
        d={outerLeftPath}
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
      />

      {/* White outer boundary - right */}
      <path
        d={outerRightPath}
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
      />

      {/* White dotted center line */}
      <path
        d={centerPath}
        fill="none"
        stroke="white"
        strokeDasharray={`${dashLength} ${gapLength}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </g>
  );
}

