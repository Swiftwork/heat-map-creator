"use client";

import { useMemo } from "react";

import { BezierPoint, Corner, Space } from "@/types/spline";
import {
  calculateChainArcLength,
  calculateChainTangent,
  evaluateChainAtT,
  findTForDistance,
  pointsToBezierSegments,
} from "@/utils/bezierChain";
import { bezierToSvgPath } from "@/utils/pathUtils";

import { CornerBadge } from "./CornerBadge";
import { CountdownBadge } from "./CountdownBadge";

const BASE_TRACK_WIDTH = 100;
const BASE_STROKE_WIDTH = 3;
const SAMPLES_PER_CURVE = 100;
const BASE_FLAG_SIZE = 30;
const BASE_COUNTDOWN_TEXT_FONT_SIZE = 20;

// Corner and metadata graphics configuration
const BASE_CIRCLE_RADIUS = 20; // Visual circle radius for both corners and metadata
const CORNER_SELECTED_STROKE_WIDTH = 3;
const CORNER_DEFAULT_STROKE_WIDTH = 1;
const CORNER_OPACITY = 0.6;
const CORNER_COLOR = "#4a9eff";
const CORNER_DEFAULT_STROKE = "#4a9eff";

const METADATA_SELECTED_COLOR = "#009700ff";

interface RaceTrackProps {
  points: BezierPoint[];
  segments: number;
  closed: boolean;
  spaces: Space[];
  corners: Corner[];
  debugMode: boolean;
  startFinishSpaceIndex: number;
  raceDirection: boolean; // true = clockwise, false = counter-clockwise
  scale?: number; // Scale percentage (100 = 100%)
  trackColor?: string;
  countdownTextColor?: string;
  editingMode?: "spline" | "corners" | "metadata" | "appearance";
  cornerToolMode?: "select" | "add" | "remove";
  onSpaceClick?: (spaceIndex: number) => void;
  selectedCorner?: string | null;
  onStartFinishClick?: (spaceIndex: number) => void;
  onCornerClick?: (cornerId: string) => void;
  onTrackClickWithCoords?: (x: number, y: number) => void;
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
  side: "left" | "right";
}

interface InnerSidePath {
  key: string;
  d: string;
}

interface CheckerSegment extends SegmentLine {
  color: "white" | "black" | "red";
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

interface CornerCheckeredLine {
  corner: Corner;
  segments: CheckerSegment[];
}

const evaluateCubicBezier = (
  p0: Vec2,
  cp1: Vec2,
  cp2: Vec2,
  p1: Vec2,
  t: number
): Vec2 => {
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

const evaluateCubicBezierTangent = (
  p0: Vec2,
  cp1: Vec2,
  cp2: Vec2,
  p1: Vec2,
  t: number
): Vec2 => {
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
  if (points.length === 0) return "";

  const [first, ...rest] = points;
  if (!first) return "";

  let path = `M ${first.x} ${first.y}`;

  rest.forEach((point) => {
    path += ` L ${point.x} ${point.y}`;
  });

  return close ? `${path} Z` : path;
};

const sampleOffsetPoints = (
  points: BezierPoint[],
  closed: boolean,
  offset: number
): Vec2[] => {
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
    const maxSamples =
      i === numCurves - 1 ? SAMPLES_PER_CURVE + 1 : SAMPLES_PER_CURVE;

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

const buildOffsetPath = (
  points: BezierPoint[],
  closed: boolean,
  offset: number
): string => {
  const sampledPoints = sampleOffsetPoints(points, closed, offset);
  if (sampledPoints.length === 0) {
    return "";
  }

  return createPathString(sampledPoints, closed);
};

const buildTrackFillPath = (
  points: BezierPoint[],
  closed: boolean,
  halfTrackWidth: number
): string => {
  const leftPoints = sampleOffsetPoints(points, closed, halfTrackWidth);
  const rightPoints = sampleOffsetPoints(points, closed, -halfTrackWidth);

  if (!leftPoints.length || !rightPoints.length) {
    return "";
  }

  const pathPoints = [...leftPoints, ...rightPoints.reverse()];
  return createPathString(pathPoints, true);
};

const buildInnerSideSegments = (
  closed: boolean,
  corners: Corner[]
): InnerSideSegment[] => {
  if (!closed || corners.length === 0) {
    return [];
  }

  const sortedCorners = [...corners].sort(
    (a, b) => a.spaceIndex - b.spaceIndex
  );

  return sortedCorners.map((corner, index) => {
    const nextCorner =
      sortedCorners[(index + 1) % sortedCorners.length] ?? corner;

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
  halfTrackWidth: number,
  baseStrokeWidth: number
): InnerSidePath[] => {
  if (
    segments.length === 0 ||
    bezierSegments.length === 0 ||
    segmentArcLength === 0
  ) {
    return [];
  }

  return segments.reduce<InnerSidePath[]>((paths, segment, index) => {
    const startDistance = (segment.startSpace - 0.5) * segmentArcLength;
    let endDistance = (segment.endSpace - 0.5) * segmentArcLength;

    if (segment.endSpace < segment.startSpace) {
      endDistance =
        totalArcLength + (segment.endSpace - 0.5) * segmentArcLength;
    }

    const sectionLength = endDistance - startDistance;
    const numSpaces =
      segment.endSpace > segment.startSpace
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

      const { segmentIndex, t } = findTForDistance(
        bezierSegments,
        targetDistance
      );
      const centerPoint = evaluateChainAtT(bezierSegments, segmentIndex, t);
      const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
      const normal = normalizeVector(tangent);

      if (!normal) {
        continue;
      }

      const perp = perpendicular(normal);
      // Offset outward by half the stroke width (baseStrokeWidth)
      const offset =
        segment.side === "left"
          ? halfTrackWidth + baseStrokeWidth
          : -halfTrackWidth - baseStrokeWidth;
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

const computeSpaceCountdowns = (
  corners: Corner[],
  spaces: Space[],
  raceDirection: boolean // true = clockwise, false = counter-clockwise
): Map<number, number> => {
  if (corners.length === 0 || spaces.length === 0) {
    return new Map();
  }

  const sortedCorners = [...corners].sort(
    (a, b) => a.spaceIndex - b.spaceIndex
  );
  const countdowns = new Map<number, number>();

  spaces.forEach((space) => {
    let nextCorner: Corner | undefined;

    if (raceDirection) {
      // For clockwise (true), find the next corner in ascending order
      nextCorner =
        sortedCorners.find((corner) => corner.spaceIndex > space.index) ??
        sortedCorners[0];
    } else {
      // For counter-clockwise (false), find the next corner in descending order
      // We want the corner that comes AFTER the current space when going backwards
      // So we find the corner with spaceIndex <= current space (including current space)
      nextCorner = sortedCorners
        .slice()
        .reverse()
        .find((corner) => corner.spaceIndex <= space.index);

      // If no corner found with smaller or equal index, wrap around to the last corner
      if (!nextCorner) {
        nextCorner = sortedCorners[sortedCorners.length - 1];
      }
    }

    if (!nextCorner) {
      return;
    }

    let spacesToCorner: number;

    if (raceDirection) {
      // For clockwise (true)
      spacesToCorner = nextCorner.spaceIndex - space.index;
      if (spacesToCorner < 0) {
        spacesToCorner = spaces.length - space.index + nextCorner.spaceIndex;
      }
    } else {
      // For counter-clockwise (false), calculate distance going backwards
      spacesToCorner = space.index - nextCorner.spaceIndex;
      if (spacesToCorner < 0) {
        // If we wrapped around, add the total spaces length
        spacesToCorner = space.index + spaces.length - nextCorner.spaceIndex;
      }
    }

    // Show countdown including 0
    // For clockwise: exclude the corner space itself
    // For counter-clockwise: include the corner space and only reset after
    if (spacesToCorner >= 0) {
      if (raceDirection) {
        // For clockwise (true), exclude the corner space itself
        countdowns.set(space.index, spacesToCorner - 1);
      } else {
        // For counter-clockwise (false), include the corner space (don't subtract 1)
        countdowns.set(space.index, spacesToCorner);
      }
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

  spaces.forEach((space) => {
    const targetDistance = space.index * segmentArcLength;
    const { segmentIndex, t } = findTForDistance(
      bezierSegments,
      targetDistance
    );
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
  halfTrackWidth: number,
  baseStrokeWidth: number
): SegmentLine[] => {
  if (
    !closed ||
    segments === 0 ||
    bezierSegments.length === 0 ||
    segmentArcLength === 0
  ) {
    return [];
  }

  const lines: SegmentLine[] = [];
  const insetWidth = halfTrackWidth - baseStrokeWidth * 2;

  for (
    let segmentIndexValue = 0;
    segmentIndexValue < segments;
    segmentIndexValue++
  ) {
    const targetDistance = (segmentIndexValue + 0.5) * segmentArcLength;
    const { segmentIndex, t } = findTForDistance(
      bezierSegments,
      targetDistance
    );
    const centerPoint = evaluateChainAtT(bezierSegments, segmentIndex, t);
    const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
    const normal = normalizeVector(tangent);

    if (!normal) {
      continue;
    }

    const perp = perpendicular(normal);
    lines.push({
      x1: centerPoint.x + perp.x * insetWidth,
      y1: centerPoint.y + perp.y * insetWidth,
      x2: centerPoint.x - perp.x * insetWidth,
      y2: centerPoint.y - perp.y * insetWidth,
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
  flagOffset: number,
  baseStrokeWidth: number
): CornerVisual[] => {
  if (
    !closed ||
    corners.length === 0 ||
    bezierSegments.length === 0 ||
    segmentArcLength === 0
  ) {
    return [];
  }

  const validSpaces = new Set(spaces.map((space) => space.index));

  return corners.reduce<CornerVisual[]>((visuals, corner) => {
    if (!validSpaces.has(corner.spaceIndex)) {
      return visuals;
    }

    const targetDistance = (corner.spaceIndex - 0.5) * segmentArcLength;
    const { segmentIndex, t } = findTForDistance(
      bezierSegments,
      targetDistance
    );
    const centerPoint = evaluateChainAtT(bezierSegments, segmentIndex, t);
    const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
    const normal = normalizeVector(tangent);

    if (!normal) {
      return visuals;
    }

    const perp = perpendicular(normal);
    const badgeOffset = corner.innerSide === "left" ? -1 : 1;

    // Corner lines extend from the badge across the entire track to the opposite outer edge
    const badgeDistance = badgeOffset * flagOffset;
    const oppositeOuterEdgeDistance =
      corner.innerSide === "left"
        ? halfTrackWidth - baseStrokeWidth * 2 // Right outer edge
        : -halfTrackWidth + baseStrokeWidth * 2; // Left outer edge

    const line: SegmentLine = {
      x1: centerPoint.x + perp.x * badgeDistance,
      y1: centerPoint.y + perp.y * badgeDistance,
      x2: centerPoint.x + perp.x * oppositeOuterEdgeDistance,
      y2: centerPoint.y + perp.y * oppositeOuterEdgeDistance,
    };

    const badge: Vec2 = {
      x: centerPoint.x + perp.x * badgeOffset * flagOffset,
      y: centerPoint.y + perp.y * badgeOffset * flagOffset,
    };

    // Calculate rotation angle from tangent vector (in degrees)
    // For right inner side corners, rotate 180 degrees to face the correct direction
    let rotation = Math.atan2(tangent.y, tangent.x) * (180 / Math.PI);
    if (corner.innerSide === "right") {
      rotation += 180;
    }

    visuals.push({ corner, line, badge, rotation });
    return visuals;
  }, []);
};

const computeCornerCheckeredLines = (
  closed: boolean,
  corners: Corner[],
  spaces: Space[],
  bezierSegments: ReturnType<typeof pointsToBezierSegments>,
  segmentArcLength: number,
  totalArcLength: number,
  halfTrackWidth: number,
  baseStrokeWidth: number
): CornerCheckeredLine[] => {
  if (
    !closed ||
    corners.length === 0 ||
    bezierSegments.length === 0 ||
    segmentArcLength === 0
  ) {
    return [];
  }

  const validSpaces = new Set(spaces.map((space) => space.index));
  const sortedCorners = [...corners].sort(
    (a, b) => a.spaceIndex - b.spaceIndex
  );

  return corners.reduce<CornerCheckeredLine[]>((checkeredLines, corner) => {
    if (!validSpaces.has(corner.spaceIndex)) {
      return checkeredLines;
    }

    // Find the next corner to determine the segment length
    const cornerIndex = sortedCorners.findIndex((c) => c.id === corner.id);
    const nextCorner = sortedCorners[(cornerIndex + 1) % sortedCorners.length];

    if (!nextCorner) {
      return checkeredLines;
    }

    // Calculate the start and end distances for the checkered line
    // Start before the corner and end after the corner (2 segments total)
    const startDistance = (corner.spaceIndex - 1.5) * segmentArcLength; // Start one segment before corner
    const endDistance = (corner.spaceIndex + 0.5) * segmentArcLength; // End one segment after corner

    // Handle wrapping around the track
    let adjustedStartDistance = startDistance;
    let adjustedEndDistance = endDistance;

    if (startDistance < 0) {
      adjustedStartDistance = totalArcLength + startDistance;
    }
    if (endDistance > totalArcLength) {
      adjustedEndDistance = endDistance - totalArcLength;
    }

    const sectionLength = adjustedEndDistance - adjustedStartDistance;
    const numSamples = Math.max(Math.floor(sectionLength / 5), 50); // Sample every 5 units
    const checkeredSegments: CheckerSegment[] = [];

    // Generate points along the outer edge on the same side as the corner badge
    // Position checkered line at the same distance from center as the outer strokes
    const outerEdgeOffset =
      corner.innerSide === "left"
        ? -halfTrackWidth + baseStrokeWidth // Left outer edge (same side as badge)
        : halfTrackWidth - baseStrokeWidth; // Right outer edge (same side as badge)

    // Generate points along the track edge
    const trackPoints: Vec2[] = [];
    for (let i = 0; i <= numSamples; i++) {
      const progress = i / numSamples;
      let targetDistance = adjustedStartDistance + sectionLength * progress;

      // Handle wrapping around the track
      if (targetDistance > totalArcLength) {
        targetDistance -= totalArcLength;
      }

      const { segmentIndex, t } = findTForDistance(
        bezierSegments,
        targetDistance
      );
      const centerPoint = evaluateChainAtT(bezierSegments, segmentIndex, t);
      const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
      const normal = normalizeVector(tangent);

      if (!normal) {
        continue;
      }

      const perp = perpendicular(normal);
      const outerPoint = {
        x: centerPoint.x + perp.x * outerEdgeOffset,
        y: centerPoint.y + perp.y * outerEdgeOffset,
      };

      trackPoints.push(outerPoint);
    }

    // Create consistent checkered segments with precise dash widths
    const dashWidth = baseStrokeWidth * 2; // Use line width for equal width and height
    let currentColor: "white" | "red" = "white";
    let currentSegmentStart = 0;
    let accumulatedLength = 0;

    // Calculate total length of the track section
    let totalLength = 0;
    for (let i = 1; i < trackPoints.length; i++) {
      const prev = trackPoints[i - 1];
      const curr = trackPoints[i];
      if (!prev || !curr) continue;
      totalLength += Math.hypot(curr.x - prev.x, curr.y - prev.y);
    }

    // Calculate number of dashes needed
    const numDashes = Math.floor(totalLength / dashWidth);
    const actualDashWidth = totalLength / numDashes; // Adjust dash width to fit evenly

    for (let i = 1; i < trackPoints.length; i++) {
      const prev = trackPoints[i - 1];
      const curr = trackPoints[i];
      if (!prev || !curr) continue;

      const segmentLength = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      accumulatedLength += segmentLength;

      if (accumulatedLength >= actualDashWidth) {
        // Create a checkered segment
        checkeredSegments.push({
          color: currentColor,
          x1: trackPoints[currentSegmentStart]?.x ?? 0,
          y1: trackPoints[currentSegmentStart]?.y ?? 0,
          x2: curr.x,
          y2: curr.y,
        });

        // Switch color and reset for next segment
        currentColor = currentColor === "white" ? "red" : "white";
        currentSegmentStart = i;
        accumulatedLength = 0;
      }
    }

    // Add the final segment if there's remaining length
    if (accumulatedLength > 0 && currentSegmentStart < trackPoints.length - 1) {
      const lastPoint = trackPoints[trackPoints.length - 1];
      if (lastPoint) {
        checkeredSegments.push({
          color: currentColor,
          x1: trackPoints[currentSegmentStart]?.x ?? 0,
          y1: trackPoints[currentSegmentStart]?.y ?? 0,
          x2: lastPoint.x,
          y2: lastPoint.y,
        });
      }
    }

    checkeredLines.push({ corner, segments: checkeredSegments });
    return checkeredLines;
  }, []);
};

const buildStartFinishVisual = (
  bezierSegments: ReturnType<typeof pointsToBezierSegments>,
  segmentArcLength: number,
  startFinishSpaceIndex: number,
  halfTrackWidth: number,
  flagOffset: number,
  baseStrokeWidth: number
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
  const insetWidth = halfTrackWidth - baseStrokeWidth * 2;
  const startPoint = {
    x: centerPoint.x + perp.x * insetWidth,
    y: centerPoint.y + perp.y * insetWidth,
  };
  const endPoint = {
    x: centerPoint.x - perp.x * insetWidth,
    y: centerPoint.y - perp.y * insetWidth,
  };

  const lineVector = {
    x: endPoint.x - startPoint.x,
    y: endPoint.y - startPoint.y,
  };
  const lineLength = Math.hypot(lineVector.x, lineVector.y);
  const checkerSize = baseStrokeWidth * 2; // Use line width for checker size
  const numCheckers = Math.max(1, Math.floor(lineLength / checkerSize));
  const checkers: CheckerSegment[] = [];

  for (let i = 0; i < numCheckers; i++) {
    const progress = i / numCheckers;
    const nextProgress = (i + 1) / numCheckers;

    checkers.push({
      color: i % 2 === 0 ? "white" : "black",
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

export function RaceTrack({
  points,
  segments,
  closed,
  spaces,
  corners,
  debugMode,
  startFinishSpaceIndex,
  raceDirection,
  scale = 100,
  trackColor,
  countdownTextColor,
  editingMode = "spline",
  cornerToolMode = "select",
  onSpaceClick: _onSpaceClick,
  selectedCorner,
  onStartFinishClick,
  onCornerClick,
  onTrackClickWithCoords,
}: RaceTrackProps) {
  // Derive trackWidth and baseStrokeWidth from scale
  const trackWidth = BASE_TRACK_WIDTH * (scale / 100);
  const baseStrokeWidth = BASE_STROKE_WIDTH * (scale / 100);
  const halfTrackWidth = trackWidth / 2;
  const flagOffset = halfTrackWidth + 30 * (scale / 100);
  const flagSize = BASE_FLAG_SIZE * (scale / 100);
  const circleRadius = BASE_CIRCLE_RADIUS * (scale / 100);

  const bezierSegments = useMemo(
    () => pointsToBezierSegments(points, "C1"),
    [points]
  );

  const centerPath = useMemo(
    () => bezierToSvgPath(points, closed),
    [points, closed]
  );
  const outerLeftPath = useMemo(
    () =>
      buildOffsetPath(
        points,
        closed,
        halfTrackWidth - baseStrokeWidth * 2 + baseStrokeWidth / 2
      ),
    [points, closed, halfTrackWidth, baseStrokeWidth]
  );
  const outerRightPath = useMemo(
    () =>
      buildOffsetPath(
        points,
        closed,
        -halfTrackWidth + baseStrokeWidth * 2 - baseStrokeWidth / 2
      ),
    [points, closed, halfTrackWidth, baseStrokeWidth]
  );
  const trackFillPath = useMemo(
    () => buildTrackFillPath(points, closed, halfTrackWidth),
    [points, closed, halfTrackWidth]
  );

  const totalArcLength = useMemo(
    () =>
      bezierSegments.length > 0 ? calculateChainArcLength(bezierSegments) : 0,
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
    () =>
      buildInnerSidePaths(
        innerSideSegments,
        bezierSegments,
        segmentArcLength,
        totalArcLength,
        spaces.length,
        halfTrackWidth,
        baseStrokeWidth
      ),
    [
      innerSideSegments,
      bezierSegments,
      segmentArcLength,
      totalArcLength,
      spaces.length,
      halfTrackWidth,
      baseStrokeWidth,
    ]
  );

  const spaceCountdowns = useMemo(
    () => computeSpaceCountdowns(corners, spaces, raceDirection),
    [corners, spaces, raceDirection]
  );

  const spacePositions = useMemo(
    () => buildSpacePositions(spaces, bezierSegments, segmentArcLength),
    [spaces, bezierSegments, segmentArcLength]
  );

  const segmentLines = useMemo(
    () =>
      computeSegmentLines(
        closed,
        segments,
        bezierSegments,
        segmentArcLength,
        halfTrackWidth,
        baseStrokeWidth
      ),
    [
      closed,
      segments,
      bezierSegments,
      segmentArcLength,
      halfTrackWidth,
      baseStrokeWidth,
    ]
  );

  const cornerVisuals = useMemo(
    () =>
      computeCornerVisuals(
        closed,
        corners,
        spaces,
        bezierSegments,
        segmentArcLength,
        halfTrackWidth,
        flagOffset,
        baseStrokeWidth
      ),
    [
      closed,
      corners,
      spaces,
      bezierSegments,
      segmentArcLength,
      halfTrackWidth,
      flagOffset,
      baseStrokeWidth,
    ]
  );

  const cornerCheckeredLines = useMemo(
    () =>
      computeCornerCheckeredLines(
        closed,
        corners,
        spaces,
        bezierSegments,
        segmentArcLength,
        totalArcLength,
        halfTrackWidth,
        baseStrokeWidth
      ),
    [
      closed,
      corners,
      spaces,
      bezierSegments,
      segmentArcLength,
      totalArcLength,
      halfTrackWidth,
      baseStrokeWidth,
    ]
  );

  const startFinishVisual = useMemo(
    () =>
      buildStartFinishVisual(
        bezierSegments,
        segmentArcLength,
        startFinishSpaceIndex,
        halfTrackWidth,
        flagOffset,
        baseStrokeWidth
      ),
    [
      bezierSegments,
      segmentArcLength,
      startFinishSpaceIndex,
      halfTrackWidth,
      flagOffset,
      baseStrokeWidth,
    ]
  );

  const isCornersMode = editingMode === "corners";
  const isMetadataMode = editingMode === "metadata";

  if (points.length < 2) {
    return null;
  }

  return (
    <g>
      {/* Track fill (main track area) */}
      <path d={trackFillPath} fill={trackColor ?? "#3a3a3a"} stroke="none" />

      {/* Outer left edge of the track */}
      <path
        d={outerLeftPath}
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={baseStrokeWidth}
      />

      {/* Outer right edge of the track */}
      <path
        d={outerRightPath}
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={baseStrokeWidth}
      />

      {/* Inner side highlight paths for corners */}
      {innerSidePaths.map((path) => (
        <path
          key={path.key}
          d={path.d}
          fill="none"
          stroke="white"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={baseStrokeWidth * 2}
        />
      ))}

      {/* Center dashed path */}
      <path
        d={centerPath}
        fill="none"
        stroke="white"
        strokeDasharray={`${baseStrokeWidth * 3} ${baseStrokeWidth * 2 * 1.5}`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={(baseStrokeWidth / 2) * 1.5}
      />

      {/* Segment lines across the track */}
      {segmentLines.map((line, index) => (
        <line
          key={`segment-${index}`}
          stroke="white"
          strokeLinecap="round"
          strokeWidth={baseStrokeWidth}
          x1={line.x1}
          x2={line.x2}
          y1={line.y1}
          y2={line.y2}
        />
      ))}

      {/* Space markers, selection circles */}
      {spaces.map((space) => {
        const position = spacePositions.get(space.index);
        if (!position) {
          return null;
        }

        const isStartFinish = space.index === startFinishSpaceIndex;

        return (
          <g key={`space-${space.id}`}>
            {/* Small circle at each space - only in debug mode */}
            {debugMode && (
              <>
                <circle
                  cx={position.x}
                  cy={position.y}
                  fill={CORNER_COLOR}
                  opacity={0.7}
                  r={3 * (scale / 100)}
                />

                {/* Space index label */}
                <text
                  fill="#4a9eff"
                  fontSize={10 * (scale / 100)}
                  fontWeight="bold"
                  x={position.x + 8 * (scale / 100)}
                  y={position.y - 8 * (scale / 100)}
                >
                  {space.index}
                </text>
              </>
            )}

            {/* Removed corner selection circles - corners now placed by clicking on track */}

            {/* Metadata selection circle for start/finish (interactive) - always visible in metadata mode */}
            {isMetadataMode && (
              <circle
                cx={position.x}
                cy={position.y}
                fill={isStartFinish ? METADATA_SELECTED_COLOR : "transparent"}
                opacity={CORNER_OPACITY}
                r={circleRadius}
                stroke={
                  isStartFinish
                    ? METADATA_SELECTED_COLOR
                    : CORNER_DEFAULT_STROKE
                }
                strokeWidth={
                  isStartFinish
                    ? CORNER_SELECTED_STROKE_WIDTH * (scale / 100)
                    : CORNER_DEFAULT_STROKE_WIDTH * (scale / 100)
                }
                style={{ cursor: "pointer" }}
                onClick={() => onStartFinishClick?.(space.index)}
              />
            )}
          </g>
        );
      })}

      {/* Countdown badges or numbers (for spaces near corners) - always visible */}
      {spaces.map((space) => {
        const position = spacePositions.get(space.index);
        if (!position) {
          return null;
        }
        const countdown = spaceCountdowns.get(space.index);
        if (countdown === undefined || countdown < 0) {
          return null;
        }
        // Calculate perpendicular direction for inside positioning
        const targetDistance = space.index * segmentArcLength;
        const { segmentIndex, t } = findTForDistance(
          bezierSegments,
          targetDistance
        );
        const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
        const normal = normalizeVector(tangent);
        if (!normal) return null;
        const perp = perpendicular(normal);
        // Position on the inside of the track (opposite direction from outer edge)
        const insideOffset = -60 * (scale / 100); // Distance from center line to inside, scaled
        const insideX = position.x - perp.x * insideOffset;
        const insideY = position.y - perp.y * insideOffset;
        // Calculate rotation angle from tangent vector (in degrees)
        const rotation = Math.atan2(tangent.y, tangent.x) * (180 / Math.PI);
        // Use CountdownBadge for numbers 0-3, fallback to text for higher numbers
        if (countdown <= 3) {
          // Additional offset for CountdownBadge to move it further inside
          const badgeOffset = -5 * (scale / 100);
          const badgeX = insideX - perp.x * badgeOffset;
          const badgeY = insideY - perp.y * badgeOffset;
          return (
            <CountdownBadge
              key={`countdown-badge-${space.id}`}
              number={countdown}
              rotation={rotation}
              scale={scale}
              x={badgeX}
              y={badgeY}
            />
          );
        } else {
          return (
            <text
              key={`countdown-text-${space.id}`}
              fill={countdownTextColor || "#ffd700"}
              style={{
                fontSize: `${BASE_COUNTDOWN_TEXT_FONT_SIZE * (scale / 100)}px`,
              }}
              textAnchor="middle"
              transform={`rotate(${rotation + 180} ${insideX} ${insideY})`}
              x={insideX}
              y={insideY}
            >
              {countdown}
            </text>
          );
        }
      })}

      {/* Corner lines */}
      {cornerVisuals.map(({ line }, index) => (
        <line
          key={`corner-line-${index}`}
          stroke="white"
          strokeWidth={baseStrokeWidth * 2}
          x1={line.x1}
          x2={line.x2}
          y1={line.y1}
          y2={line.y2}
        />
      ))}

      {/* Corner checkered lines */}
      {cornerCheckeredLines.map(({ corner, segments: checkeredSegments }) =>
        checkeredSegments.map((segment, index) => (
          <line
            key={`corner-checkered-${corner.id}-${index}`}
            stroke={segment.color}
            strokeLinecap="butt"
            strokeWidth={baseStrokeWidth * 2}
            x1={segment.x1}
            x2={segment.x2}
            y1={segment.y1}
            y2={segment.y2}
          />
        ))
      )}

      {/* Corner badges */}
      {cornerVisuals.map(({ corner, badge, rotation }) => {
        const isSelected = selectedCorner === corner.id;
        return (
          <CornerBadge
            key={`corner-${corner.id}`}
            isRemoveMode={cornerToolMode === "remove"}
            isSelected={isSelected}
            rotation={rotation}
            scale={scale}
            speedLimit={corner.speedLimit}
            x={badge.x}
            y={badge.y}
            onClick={() => onCornerClick?.(corner.id)}
          />
        );
      })}

      {/* Start/finish checkered line and flag */}
      {startFinishVisual && (
        <g key="start-finish">
          {startFinishVisual.checkers.map((checker, index) => (
            <line
              key={`checker-${index}`}
              stroke={checker.color}
              strokeLinecap="butt"
              strokeWidth={baseStrokeWidth * 2}
              x1={checker.x1}
              x2={checker.x2}
              y1={checker.y1}
              y2={checker.y2}
            />
          ))}

          <g
            transform={`rotate(${startFinishVisual.flag.angle} ${startFinishVisual.flag.x} ${startFinishVisual.flag.y})`}
          >
            <line
              stroke="#333"
              strokeWidth={2 * (scale / 100)}
              x1={startFinishVisual.flag.x - flagSize * 0.3}
              x2={startFinishVisual.flag.x - flagSize * 0.3}
              y1={startFinishVisual.flag.y - flagSize * 0.3}
              y2={startFinishVisual.flag.y + flagSize * 0.8}
            />
            <rect
              fill="white"
              height={flagSize}
              stroke="#333"
              strokeWidth={1 * (scale / 100)}
              width={flagSize}
              x={startFinishVisual.flag.x - flagSize * 0.3}
              y={startFinishVisual.flag.y - flagSize * 0.3}
            />
            {[0, 1, 2, 3, 4].map((row) =>
              [0, 1, 2, 3, 4].map((col) => {
                const isBlack = (row + col) % 2 === 0;
                return isBlack ? (
                  <rect
                    key={`flag-${row}-${col}`}
                    fill="black"
                    height={flagSize / 5}
                    width={flagSize / 5}
                    x={
                      startFinishVisual.flag.x -
                      flagSize * 0.3 +
                      col * (flagSize / 5)
                    }
                    y={
                      startFinishVisual.flag.y -
                      flagSize * 0.3 +
                      row * (flagSize / 5)
                    }
                  />
                ) : null;
              })
            )}
          </g>
        </g>
      )}

      {/* Invisible clickable path for corner placement in add mode - rendered last so it's on top */}
      {isCornersMode && cornerToolMode === "add" && (
        <path
          d={trackFillPath}
          fill="transparent"
          stroke="none"
          style={{ cursor: "crosshair", pointerEvents: "all" }}
          onClick={(e) => {
            if (onTrackClickWithCoords) {
              const svg = (e.target as SVGElement).ownerSVGElement;
              if (svg) {
                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
                onTrackClickWithCoords(svgP.x, svgP.y);
              }
            }
          }}
        />
      )}
    </g>
  );
}
