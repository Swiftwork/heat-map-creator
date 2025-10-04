'use client';

import { useMemo } from 'react';

import { BezierPoint, Corner, Space } from '@/types/spline';
import {
  calculateChainArcLength,
  calculateChainTangent,
  evaluateChainAtT,
  findTForDistance,
  pointsToBezierSegments,
} from '@/utils/bezierChain';
import { bezierToSvgPath } from '@/utils/pathUtils';

import { CornerBadge } from './CornerBadge';
import { CountdownBadge } from './CountdownBadge';

const DEFAULT_TRACK_WIDTH = 100;
const SAMPLES_PER_CURVE = 100;
const CHECKER_SIZE = 10;
const FLAG_SIZE = 30;

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
  trackWidth?: number;
  editingMode?: 'spline' | 'corners' | 'metadata' | 'appearance';
  onSpaceClick?: (spaceIndex: number) => void;
  selectedCorner?: string | null;
  onStartFinishClick?: (spaceIndex: number) => void;
}

type Vec2 = {
  x: number;
  y: number;
};

interface SegmentLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface InnerSideSegment {
  startSpace: number;
  endSpace: number;
  side: 'left' | 'right';
}

interface InnerSidePath {
  key: string;
  d: string;
}

interface CheckerSegment extends SegmentLine {
  color: 'white' | 'black';
}

interface StartFinishVisual {
  checkers: CheckerSegment[];
  flag: {
    x: number;
    y: number;
    angle: number;
  };
}

interface CornerVisual {
  corner: Corner;
  line: SegmentLine;
  badge: Vec2;
  rotation: number;
}

const evaluateCubicBezier = (p0: Vec2, cp1: Vec2, cp2: Vec2, p1: Vec2, t: number): Vec2 => {
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

const evaluateCubicBezierTangent = (p0: Vec2, cp1: Vec2, cp2: Vec2, p1: Vec2, t: number): Vec2 => {
  const t2 = t * t;
  const mt = 1 - t;
  const mt2 = mt * mt;

  return {
    x:
      -3 * mt2 * p0.x +
      3 * mt2 * cp1.x -
      6 * mt * t * cp1.x +
      6 * mt * t * cp2.x -
      3 * t2 * cp2.x +
      3 * t2 * p1.x,
    y:
      -3 * mt2 * p0.y +
      3 * mt2 * cp1.y -
      6 * mt * t * cp1.y +
      6 * mt * t * cp2.y -
      3 * t2 * cp2.y +
      3 * t2 * p1.y,
  };
};

const normalizeVector = (vector: Vec2): Vec2 | null => {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) return null;
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
};

const perpendicular = (vector: Vec2): Vec2 => ({
  x: -vector.y,
  y: vector.x,
});

const createPathString = (points: Vec2[], close = false): string => {
  if (points.length === 0) return '';

  const [first, ...rest] = points;
  if (!first) return '';

  let path = `M ${first.x} ${first.y}`;

  rest.forEach(point => {
    path += ` L ${point.x} ${point.y}`;
  });

  return close ? `${path} Z` : path;
};

const sampleOffsetPoints = (points: BezierPoint[], closed: boolean, offset: number): Vec2[] => {
  const numCurves = closed ? points.length : points.length - 1;

  if (numCurves <= 0) {
    return [];
  }

  const sampled: Vec2[] = [];

  for (let i = 0; i < numCurves; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];

    if (!current || !next) {
      continue;
    }

    const cp1 = current.handleOut ?? current;
    const cp2 = next.handleIn ?? next;
    const maxSamples = i === numCurves - 1 ? SAMPLES_PER_CURVE + 1 : SAMPLES_PER_CURVE;

    for (let j = 0; j < maxSamples; j++) {
      const t = Math.min(j / SAMPLES_PER_CURVE, 1);
      const point = evaluateCubicBezier(current, cp1, cp2, next, t);
      const tangent = evaluateCubicBezierTangent(current, cp1, cp2, next, t);
      const normal = normalizeVector(tangent);

      if (!normal) {
        sampled.push(point);
        continue;
      }

      const perp = perpendicular(normal);
      sampled.push({
        x: point.x + perp.x * offset,
        y: point.y + perp.y * offset,
      });
    }
  }

  return sampled;
};

const buildOffsetPath = (points: BezierPoint[], closed: boolean, offset: number): string => {
  const sampledPoints = sampleOffsetPoints(points, closed, offset);
  if (sampledPoints.length === 0) {
    return '';
  }

  return createPathString(sampledPoints, closed);
};

const buildTrackFillPath = (points: BezierPoint[], closed: boolean, halfTrackWidth: number): string => {
  const leftPoints = sampleOffsetPoints(points, closed, halfTrackWidth);
  const rightPoints = sampleOffsetPoints(points, closed, -halfTrackWidth);

  if (!leftPoints.length || !rightPoints.length) {
    return '';
  }

  const pathPoints = [...leftPoints, ...rightPoints.reverse()];
  return createPathString(pathPoints, true);
};

const buildInnerSideSegments = (closed: boolean, corners: Corner[]): InnerSideSegment[] => {
  if (!closed || corners.length === 0) {
    return [];
  }

  const sortedCorners = [...corners].sort((a, b) => a.spaceIndex - b.spaceIndex);

  return sortedCorners.map((corner, index) => {
    const nextCorner = sortedCorners[(index + 1) % sortedCorners.length] ?? corner;

    return {
      startSpace: corner.spaceIndex,
      endSpace: nextCorner.spaceIndex,
      side: corner.innerSide,
    };
  });
};

const buildInnerSidePaths = (
  segments: InnerSideSegment[],
  bezierSegments: ReturnType<typeof pointsToBezierSegments>,
  segmentArcLength: number,
  totalArcLength: number,
  spacesCount: number,
  halfTrackWidth: number
): InnerSidePath[] => {
  if (segments.length === 0 || bezierSegments.length === 0 || segmentArcLength === 0) {
    return [];
  }

  return segments.reduce<InnerSidePath[]>((paths, segment, index) => {
    const startDistance = (segment.startSpace - 0.5) * segmentArcLength;
    let endDistance = (segment.endSpace - 0.5) * segmentArcLength;

    if (segment.endSpace < segment.startSpace) {
      endDistance = totalArcLength + (segment.endSpace - 0.5) * segmentArcLength;
    }

    const sectionLength = endDistance - startDistance;
    const numSpaces = segment.endSpace > segment.startSpace
      ? segment.endSpace - segment.startSpace
      : spacesCount - segment.startSpace + segment.endSpace;

    const numSamples = Math.max(numSpaces * 50, 100);
    const innerPoints: Vec2[] = [];

    for (let i = 0; i <= numSamples; i++) {
      const progress = i / numSamples;
      let targetDistance = startDistance + sectionLength * progress;

      if (targetDistance > totalArcLength) {
        targetDistance -= totalArcLength;
      }

      const { segmentIndex, t } = findTForDistance(bezierSegments, targetDistance);
      const centerPoint = evaluateChainAtT(bezierSegments, segmentIndex, t);
      const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
      const normal = normalizeVector(tangent);

      if (!normal) {
        continue;
      }

      const perp = perpendicular(normal);
      const offset = segment.side === 'left' ? halfTrackWidth : -halfTrackWidth;
      innerPoints.push({
        x: centerPoint.x + perp.x * offset,
        y: centerPoint.y + perp.y * offset,
      });
    }

    if (innerPoints.length < 2) {
      return paths;
    }

    paths.push({
      key: `${segment.side}-${segment.startSpace}-${segment.endSpace}-${index}`,
      d: createPathString(innerPoints),
    });

    return paths;
  }, []);
};

const computeSpaceCountdowns = (corners: Corner[], spaces: Space[]): Map<number, number> => {
  if (corners.length === 0 || spaces.length === 0) {
    return new Map();
  }

  const sortedCorners = [...corners].sort((a, b) => a.spaceIndex - b.spaceIndex);
  const countdowns = new Map<number, number>();

  spaces.forEach(space => {
    const nextCorner = sortedCorners.find(corner => corner.spaceIndex > space.index) ?? sortedCorners[0];
    if (!nextCorner) {
      return;
    }

    let spacesToCorner = nextCorner.spaceIndex - space.index;
    if (spacesToCorner < 0) {
      spacesToCorner = spaces.length - space.index + nextCorner.spaceIndex;
    }

    // Start countdown at 0 and exclude the last number (don't show countdown at the corner itself)
    const countdownValue = Math.max(0, spacesToCorner - 1);
    
    // Show countdown including 0 (exclude only the corner space itself)
    if (countdownValue >= 0) {
      countdowns.set(space.index, countdownValue);
    }
  });

  return countdowns;
};

const buildSpacePositions = (
  spaces: Space[],
  bezierSegments: ReturnType<typeof pointsToBezierSegments>,
  segmentArcLength: number
): Map<number, Vec2> => {
  const positions = new Map<number, Vec2>();

  if (bezierSegments.length === 0 || segmentArcLength === 0) {
    return positions;
  }

  spaces.forEach(space => {
    const targetDistance = space.index * segmentArcLength;
    const { segmentIndex, t } = findTForDistance(bezierSegments, targetDistance);
    const position = evaluateChainAtT(bezierSegments, segmentIndex, t);
    positions.set(space.index, position);
  });

  return positions;
};

const computeSegmentLines = (
  closed: boolean,
  segments: number,
  bezierSegments: ReturnType<typeof pointsToBezierSegments>,
  segmentArcLength: number,
  halfTrackWidth: number
): SegmentLine[] => {
  if (!closed || segments === 0 || bezierSegments.length === 0 || segmentArcLength === 0) {
    return [];
  }

  const lines: SegmentLine[] = [];

  for (let segmentIndexValue = 0; segmentIndexValue < segments; segmentIndexValue++) {
    const targetDistance = (segmentIndexValue + 0.5) * segmentArcLength;
    const { segmentIndex, t } = findTForDistance(bezierSegments, targetDistance);
    const centerPoint = evaluateChainAtT(bezierSegments, segmentIndex, t);
    const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
    const normal = normalizeVector(tangent);

    if (!normal) {
      continue;
    }

    const perp = perpendicular(normal);
    lines.push({
      x1: centerPoint.x + perp.x * halfTrackWidth,
      y1: centerPoint.y + perp.y * halfTrackWidth,
      x2: centerPoint.x - perp.x * halfTrackWidth,
      y2: centerPoint.y - perp.y * halfTrackWidth,
    });
  }

  return lines;
};

const computeCornerVisuals = (
  closed: boolean,
  corners: Corner[],
  spaces: Space[],
  bezierSegments: ReturnType<typeof pointsToBezierSegments>,
  segmentArcLength: number,
  halfTrackWidth: number,
  flagOffset: number
): CornerVisual[] => {
  if (!closed || corners.length === 0 || bezierSegments.length === 0 || segmentArcLength === 0) {
    return [];
  }

  const validSpaces = new Set(spaces.map(space => space.index));

  return corners.reduce<CornerVisual[]>((visuals, corner) => {
    if (!validSpaces.has(corner.spaceIndex)) {
      return visuals;
    }

    const targetDistance = (corner.spaceIndex - 0.5) * segmentArcLength;
    const { segmentIndex, t } = findTForDistance(bezierSegments, targetDistance);
    const centerPoint = evaluateChainAtT(bezierSegments, segmentIndex, t);
    const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
    const normal = normalizeVector(tangent);

    if (!normal) {
      return visuals;
    }

    const perp = perpendicular(normal);
    const line: SegmentLine = {
      x1: centerPoint.x + perp.x * halfTrackWidth,
      y1: centerPoint.y + perp.y * halfTrackWidth,
      x2: centerPoint.x - perp.x * halfTrackWidth,
      y2: centerPoint.y - perp.y * halfTrackWidth,
    };

    const badgeOffset = corner.innerSide === 'left' ? -1 : 1;
    const badge: Vec2 = {
      x: centerPoint.x + perp.x * badgeOffset * flagOffset,
      y: centerPoint.y + perp.y * badgeOffset * flagOffset,
    };

    // Calculate rotation angle from tangent vector (in degrees)
    // For right inner side corners, rotate 180 degrees to face the correct direction
    let rotation = Math.atan2(tangent.y, tangent.x) * (180 / Math.PI);
    if (corner.innerSide === 'right') {
      rotation += 180;
    }

    visuals.push({ corner, line, badge, rotation });
    return visuals;
  }, []);
};

const buildStartFinishVisual = (
  bezierSegments: ReturnType<typeof pointsToBezierSegments>,
  segmentArcLength: number,
  startFinishSpaceIndex: number,
  halfTrackWidth: number,
  flagOffset: number
): StartFinishVisual | null => {
  if (bezierSegments.length === 0 || segmentArcLength === 0) {
    return null;
  }

  const targetDistance = (startFinishSpaceIndex + 0.5) * segmentArcLength;
  const { segmentIndex, t } = findTForDistance(bezierSegments, targetDistance);
  const centerPoint = evaluateChainAtT(bezierSegments, segmentIndex, t);
  const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
  const normal = normalizeVector(tangent);

  if (!normal) {
    return null;
  }

  const perp = perpendicular(normal);
  const startPoint = {
    x: centerPoint.x + perp.x * halfTrackWidth,
    y: centerPoint.y + perp.y * halfTrackWidth,
  };
  const endPoint = {
    x: centerPoint.x - perp.x * halfTrackWidth,
    y: centerPoint.y - perp.y * halfTrackWidth,
  };

  const lineVector = {
    x: endPoint.x - startPoint.x,
    y: endPoint.y - startPoint.y,
  };
  const lineLength = Math.hypot(lineVector.x, lineVector.y);
  const numCheckers = Math.max(1, Math.floor(lineLength / CHECKER_SIZE));
  const checkers: CheckerSegment[] = [];

  for (let i = 0; i < numCheckers; i++) {
    const progress = i / numCheckers;
    const nextProgress = (i + 1) / numCheckers;

    checkers.push({
      color: i % 2 === 0 ? 'white' : 'black',
      x1: startPoint.x + lineVector.x * progress,
      y1: startPoint.y + lineVector.y * progress,
      x2: startPoint.x + lineVector.x * nextProgress,
      y2: startPoint.y + lineVector.y * nextProgress,
    });
  }

  const flagX = centerPoint.x - perp.x * flagOffset;
  const flagY = centerPoint.y - perp.y * flagOffset;
  const angle = Math.atan2(perp.y, perp.x) * (180 / Math.PI);

  return {
    checkers,
    flag: {
      x: flagX,
      y: flagY,
      angle,
    },
  };
};

const buildDashPattern = (path: string, segments: number) => {
  const dashLength = Math.max(3, (40 - segments / 10) / 3);
  const gapLength = dashLength * 0.65;
  let dashOffset = 0;

  if (typeof document !== 'undefined' && path) {
    const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathElement.setAttribute('d', path);
    const pathLength = pathElement.getTotalLength();
    const totalDashUnit = dashLength + gapLength;
    dashOffset = pathLength > 0 ? (pathLength % totalDashUnit) / 2 : 0;
  }

  return { dashLength, gapLength, dashOffset };
};

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
  trackWidth = DEFAULT_TRACK_WIDTH,
  editingMode = 'spline',
  onSpaceClick,
  selectedCorner,
  onStartFinishClick,
}: RaceTrackProps) {
  const halfTrackWidth = trackWidth / 2;
  const flagOffset = halfTrackWidth + 30;
  
  const bezierSegments = useMemo(() => pointsToBezierSegments(points, 'C1'), [points]);

  const centerPath = useMemo(() => bezierToSvgPath(points, closed), [points, closed]);
  const outerLeftPath = useMemo(() => buildOffsetPath(points, closed, halfTrackWidth), [points, closed, halfTrackWidth]);
  const outerRightPath = useMemo(() => buildOffsetPath(points, closed, -halfTrackWidth), [points, closed, halfTrackWidth]);
  const trackFillPath = useMemo(() => buildTrackFillPath(points, closed, halfTrackWidth), [points, closed, halfTrackWidth]);

  const totalArcLength = useMemo(
    () => (bezierSegments.length > 0 ? calculateChainArcLength(bezierSegments) : 0),
    [bezierSegments]
  );

  const segmentArcLength = useMemo(
    () => (segments > 0 && totalArcLength > 0 ? totalArcLength / segments : 0),
    [segments, totalArcLength]
  );

  const innerSideSegments = useMemo(
    () => buildInnerSideSegments(closed, corners),
    [closed, corners]
  );

  const innerSidePaths = useMemo(
    () => buildInnerSidePaths(innerSideSegments, bezierSegments, segmentArcLength, totalArcLength, spaces.length, halfTrackWidth),
    [innerSideSegments, bezierSegments, segmentArcLength, totalArcLength, spaces.length, halfTrackWidth]
  );

  const spaceCountdowns = useMemo(
    () => computeSpaceCountdowns(corners, spaces),
    [corners, spaces]
  );

  const spacePositions = useMemo(
    () => buildSpacePositions(spaces, bezierSegments, segmentArcLength),
    [spaces, bezierSegments, segmentArcLength]
  );

  const spaceCornerMap = useMemo(() => {
    const map = new Map<number, Corner>();
    corners.forEach(corner => {
      map.set(corner.spaceIndex, corner);
    });
    return map;
  }, [corners]);

  const segmentLines = useMemo(
    () => computeSegmentLines(closed, segments, bezierSegments, segmentArcLength, halfTrackWidth),
    [closed, segments, bezierSegments, segmentArcLength, halfTrackWidth]
  );

  const cornerVisuals = useMemo(
    () => computeCornerVisuals(closed, corners, spaces, bezierSegments, segmentArcLength, halfTrackWidth, flagOffset),
    [closed, corners, spaces, bezierSegments, segmentArcLength, halfTrackWidth, flagOffset]
  );

  const startFinishVisual = useMemo(
    () => buildStartFinishVisual(bezierSegments, segmentArcLength, startFinishSpaceIndex, halfTrackWidth, flagOffset),
    [bezierSegments, segmentArcLength, startFinishSpaceIndex, halfTrackWidth, flagOffset]
  );

  const dashPattern = useMemo(
    () => buildDashPattern(centerPath, segments),
    [centerPath, segments]
  );

  const isCornersMode = editingMode === 'corners';
  const isMetadataMode = editingMode === 'metadata';

  if (points.length < 2) {
    return null;
  }

  return (
    <g>
      <path
        d={outerLeftPath}
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
      />

      <path
        d={outerRightPath}
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
      />

      {showCorners && innerSidePaths.map(path => (
        <path
          key={path.key}
          d={path.d}
          fill="none"
          stroke="white"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={8}
        />
      ))}

      <path d={trackFillPath} fill="#3a3a3a" stroke="none" />

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

      {showSpaces && spaces.map(space => {
        const position = spacePositions.get(space.index);
        if (!position) {
          return null;
        }

        const countdown = spaceCountdowns.get(space.index);
        const corner = spaceCornerMap.get(space.index);
        const hasCorner = Boolean(corner);
        const isSelectedCorner = corner ? selectedCorner === corner.id : false;
        const isStartFinish = space.index === startFinishSpaceIndex;

        return (
          <g key={`space-${space.id}`}>
            {isCornersMode && (
              <circle
                cx={position.x}
                cy={position.y}
                fill={hasCorner ? '#ff6b6b' : 'transparent'}
                opacity={0.3}
                r={12}
                stroke={isSelectedCorner ? '#ffff00' : hasCorner ? '#ff6b6b' : '#4a9eff'}
                strokeWidth={isSelectedCorner ? 3 : 1}
                style={{ cursor: 'pointer' }}
                onClick={() => onSpaceClick?.(space.index)}
              />
            )}

            {isMetadataMode && (
              <circle
                cx={position.x}
                cy={position.y}
                fill={isStartFinish ? '#00ff00' : 'transparent'}
                opacity={0.3}
                r={12}
                stroke={isStartFinish ? '#00ff00' : '#4a9eff'}
                strokeWidth={isStartFinish ? 3 : 1}
                style={{ cursor: 'pointer' }}
                onClick={() => onStartFinishClick?.(space.index)}
              />
            )}

            <circle cx={position.x} cy={position.y} fill="#4a9eff" opacity={0.7} r={3} />

            <text
              fill="#4a9eff"
              fontSize="10"
              fontWeight="bold"
              x={position.x + 8}
              y={position.y - 8}
            >
              {space.index}
            </text>

            {countdown !== undefined && countdown >= 0 && (() => {
              // Calculate perpendicular direction for inside positioning
              const targetDistance = space.index * segmentArcLength;
              const { segmentIndex, t } = findTForDistance(bezierSegments, targetDistance);
              const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
              const normal = normalizeVector(tangent);
              
              if (!normal) {
                // Fallback to text if normal calculation fails
                return countdown <= 3 ? (
                  <CountdownBadge
                    number={countdown}
                    x={position.x}
                    y={position.y + 100}
                  />
                ) : (
                  <text
                    fill="#ffd700"
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                    x={position.x}
                    y={position.y + 100}
                  >
                    {countdown}
                  </text>
                );
              }
              
              const perp = perpendicular(normal);
              // Position on the inside of the track (opposite direction from outer edge)
              const insideOffset = -60; // Distance from center line to inside
              const insideX = position.x - perp.x * insideOffset;
              const insideY = position.y - perp.y * insideOffset;
              
              // Calculate rotation angle from tangent vector (in degrees)
              const rotation = Math.atan2(tangent.y, tangent.x) * (180 / Math.PI);
              
              // Use CountdownBadge for numbers 0-3, fallback to text for higher numbers
              if (countdown <= 3) {
                // Additional offset for CountdownBadge to move it further inside
                const badgeOffset = -5;
                const badgeX = insideX - perp.x * badgeOffset;
                const badgeY = insideY - perp.y * badgeOffset;
                
                return (
                  <CountdownBadge
                    number={countdown}
                    rotation={rotation}
                    x={badgeX}
                    y={badgeY}
                  />
                );
              } else {
                return (
                  <text
                    fill="#ffd700"
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                    x={insideX}
                    y={insideY}
                  >
                    {countdown}
                  </text>
                );
              }
            })()}
          </g>
        );
      })}

      {showCorners && cornerVisuals.map(({ line }, index) => (
        <line
          key={`corner-line-${index}`}
          stroke="white"
          strokeWidth={5}
          x1={line.x1}
          x2={line.x2}
          y1={line.y1}
          y2={line.y2}
        />
      ))}

      {showCorners && cornerVisuals.map(({ corner, badge, rotation }) => (
        <CornerBadge
          key={`corner-${corner.id}`}
          rotation={rotation}
          speedLimit={corner.speedLimit}
          x={badge.x}
          y={badge.y}
        />
      ))}

      {showStartFinish && startFinishVisual && (
        <g key="start-finish">
          {startFinishVisual.checkers.map((checker, index) => (
            <line
              key={`checker-${index}`}
              stroke={checker.color}
              strokeLinecap="butt"
              strokeWidth={6}
              x1={checker.x1}
              x2={checker.x2}
              y1={checker.y1}
              y2={checker.y2}
            />
          ))}

          <g transform={`rotate(${startFinishVisual.flag.angle} ${startFinishVisual.flag.x} ${startFinishVisual.flag.y})`}>
            <line
              stroke="#333"
              strokeWidth={2}
              x1={startFinishVisual.flag.x - FLAG_SIZE * 0.3}
              x2={startFinishVisual.flag.x - FLAG_SIZE * 0.3}
              y1={startFinishVisual.flag.y - FLAG_SIZE * 0.3}
              y2={startFinishVisual.flag.y + FLAG_SIZE * 0.8}
            />
            <rect
              fill="white"
              height={FLAG_SIZE}
              stroke="#333"
              strokeWidth={1}
              width={FLAG_SIZE}
              x={startFinishVisual.flag.x - FLAG_SIZE * 0.3}
              y={startFinishVisual.flag.y - FLAG_SIZE * 0.3}
            />
            {[0, 1, 2, 3, 4].map(row =>
              [0, 1, 2, 3, 4].map(col => {
                const isBlack = (row + col) % 2 === 0;
                return isBlack ? (
                  <rect
                    key={`flag-${row}-${col}`}
                    fill="black"
                    height={FLAG_SIZE / 5}
                    width={FLAG_SIZE / 5}
                    x={startFinishVisual.flag.x - FLAG_SIZE * 0.3 + col * (FLAG_SIZE / 5)}
                    y={startFinishVisual.flag.y - FLAG_SIZE * 0.3 + row * (FLAG_SIZE / 5)}
                  />
                ) : null;
              })
            )}
          </g>
        </g>
      )}

      <path
        d={centerPath}
        fill="none"
        stroke="white"
        strokeDasharray={`${dashPattern.dashLength} ${dashPattern.gapLength}`}
        strokeDashoffset={dashPattern.dashOffset}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </g>
  );
}
