import {
  BezierSegment,
  Corner,
  Point,
  Space,
  Spot,
  TrackData,
  TrackMetadata,
} from "@/types/spline";
import {
  calculateChainArcLength,
  calculateChainTangent,
  evaluateChainAtT,
  findTForDistance,
} from "./bezierChain";
import { generateId } from "./pathUtils";

/**
 * Calculate the arc length of a cubic Bezier curve
 */
export function calculateBezierArcLength(
  p0: Point,
  cp1: Point,
  cp2: Point,
  p1: Point,
  samples: number = 100,
): number {
  let length = 0;
  let prevPoint = p0;

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const point = evaluateCubicBezier(p0, cp1, cp2, p1, t);

    const dx = point.x - prevPoint.x;
    const dy = point.y - prevPoint.y;
    length += Math.sqrt(dx * dx + dy * dy);

    prevPoint = point;
  }

  return length;
}

/**
 * Evaluate a cubic Bezier curve at parameter t
 */
export function evaluateCubicBezier(
  p0: Point,
  cp1: Point,
  cp2: Point,
  p1: Point,
  t: number,
): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p1.x,
    y: mt3 * p0.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p1.y,
  };
}

/**
 * Calculate the tangent vector of a cubic Bezier curve at parameter t
 */
export function calculateBezierTangent(
  p0: Point,
  cp1: Point,
  cp2: Point,
  p1: Point,
  t: number,
): Point {
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
}

/**
 * Calculate curvature at a point on a Bezier curve
 */
export function calculateCurvature(
  p0: Point,
  cp1: Point,
  cp2: Point,
  p1: Point,
  t: number,
): number {
  const tangent = calculateBezierTangent(p0, cp1, cp2, p1, t);
  const tangentLength = Math.sqrt(
    tangent.x * tangent.x + tangent.y * tangent.y,
  );

  if (tangentLength === 0) return 0;

  // Calculate second derivative for curvature
  const t2 = t * t;
  const mt = 1 - t;

  const secondDeriv = {
    x:
      6 * mt * p0.x -
      12 * mt * cp1.x +
      6 * mt * cp2.x +
      6 * t * cp1.x -
      12 * t * cp2.x +
      6 * t * p1.x,
    y:
      6 * mt * p0.y -
      12 * mt * cp1.y +
      6 * mt * cp2.y +
      6 * t * cp1.y -
      12 * t * cp2.y +
      6 * t * p1.y,
  };

  const crossProduct = tangent.x * secondDeriv.y - tangent.y * secondDeriv.x;
  return Math.abs(crossProduct) / Math.pow(tangentLength, 3);
}

/**
 * Enhanced space discretization using proper Bezier chain
 * Implements Section A requirements for fixed arclength intervals
 */
export function discretizePathToSpaces(
  bezierSegments: BezierSegment[],
  targetSpacesPerLap: number,
  trackWidth: number = 100,
  spotCount: number = 5,
): Space[] {
  if (bezierSegments.length === 0) return [];

  const spaces: Space[] = [];

  // Calculate total arc length
  const totalLength = calculateChainArcLength(bezierSegments);
  const spaceLength = totalLength / targetSpacesPerLap;

  // Generate spaces along the path
  for (let spaceIndex = 0; spaceIndex < targetSpacesPerLap; spaceIndex++) {
    const targetDistance = spaceIndex * spaceLength;

    // Find the exact position on the Bezier chain
    const { segmentIndex, t } = findTForDistance(
      bezierSegments,
      targetDistance,
    );

    const position = evaluateChainAtT(bezierSegments, segmentIndex, t);
    const tangent = calculateChainTangent(bezierSegments, segmentIndex, t);
    const curvature = calculateCurvatureAtChainPosition(
      bezierSegments,
      segmentIndex,
      t,
    );

    // Generate spots for this space
    const spots = generateSpotsForSpace(
      position,
      tangent,
      trackWidth,
      spotCount,
    );

    spaces.push({
      id: generateId(),
      index: spaceIndex,
      position,
      spots,
      metadata: {
        isCornerLine: false,
        isStartFinish: false,
        isStraight: curvature < 0.01,
        curvature,
        trackWidth,
        surface: "asphalt",
      },
    });
  }

  return spaces;
}

/**
 * Calculate curvature at a specific position on the Bezier chain
 */
function calculateCurvatureAtChainPosition(
  segments: BezierSegment[],
  segmentIndex: number,
  t: number,
): number {
  const segment = segments[segmentIndex];
  if (!segment) return 0;

  return calculateCurvature(
    segment.startPoint,
    segment.cp1,
    segment.cp2,
    segment.endPoint,
    t,
  );
}

/**
 * Enhanced spot generation for Heat: Pedal to the Metal
 * Creates proper race line + outer spots with gameplay properties
 */
function generateSpotsForSpace(
  centerPosition: Point,
  tangent: Point,
  trackWidth: number,
  spotCount: number = 5,
): Spot[] {
  const tangentLength = Math.sqrt(
    tangent.x * tangent.x + tangent.y * tangent.y,
  );
  if (tangentLength === 0) return [];

  // Normalize tangent
  const nx = tangent.x / tangentLength;
  const ny = tangent.y / tangentLength;

  // Perpendicular vector (pointing to the right side of track)
  const perpX = -ny;
  const perpY = nx;

  const halfWidth = trackWidth / 2;
  const spotSpacing = trackWidth / (spotCount - 1);

  const spots: Spot[] = [];

  // Generate spots across the track width
  for (let i = 0; i < spotCount; i++) {
    const offset = (i - (spotCount - 1) / 2) * spotSpacing;
    const spotPosition = {
      x: centerPosition.x + perpX * offset,
      y: centerPosition.y + perpY * offset,
    };

    // Determine spot type and properties
    let spotType: "race-line" | "outer" | "inner";
    let isBlocking: boolean;
    let slipstreamValue: number;

    if (i === Math.floor(spotCount / 2)) {
      // Center spot - race line
      spotType = "race-line";
      isBlocking = false;
      slipstreamValue = 0;
    } else if (i === 0 || i === spotCount - 1) {
      // Edge spots - outer
      spotType = "outer";
      isBlocking = true;
      slipstreamValue = 2; // Outer spots provide slipstream
    } else {
      // Middle spots - inner
      spotType = "inner";
      isBlocking = false;
      slipstreamValue = 1; // Inner spots provide some slipstream
    }

    spots.push({
      id: generateId(),
      position: spotPosition,
      type: spotType,
      isOccupied: false,
      spotIndex: i,
      isBlocking,
      slipstreamValue,
    });
  }

  return spots;
}

/**
 * Enhanced corner suggestion based on curvature analysis
 * Implements Section A requirements for corner placement at space boundaries
 */
export function autoSuggestCorners(
  spaces: Space[],
  curvatureThreshold: number = 0.1,
  minCornerSpacing: number = 3,
): Corner[] {
  const corners: Corner[] = [];
  const highCurvatureSpaces: Array<{ space: Space; curvature: number }> = [];

  // Analyze curvature for each space
  for (const space of spaces) {
    const curvature = space.metadata.curvature;

    if (curvature > curvatureThreshold) {
      highCurvatureSpaces.push({ space, curvature });
    }
  }

  // Sort by curvature and apply minimum spacing
  highCurvatureSpaces.sort((a, b) => b.curvature - a.curvature);

  const usedIndices = new Set<number>();

  for (const { space, curvature } of highCurvatureSpaces) {
    // Check if this space is too close to existing corners
    const tooClose = Array.from(usedIndices).some(
      (usedIndex) => Math.abs(space.index - usedIndex) < minCornerSpacing,
    );

    if (!tooClose) {
      // Calculate corner properties based on curvature
      const cornerType = determineCornerType(curvature);
      const speedLimit = calculateSpeedLimit(curvature, cornerType);
      const difficulty = calculateCornerDifficulty(curvature, speedLimit);

      corners.push({
        id: generateId(),
        spaceIndex: space.index,
        speedLimit,
        position: space.position,
        isAutoSuggested: true,
        innerSide: "left", // Default to left, can be adjusted manually based on race direction
        cornerType,
        difficulty,
        suggestedGear: calculateSuggestedGear(speedLimit),
        heatPenalty: calculateHeatPenalty(speedLimit),
        entryAngle: 0, // Would be calculated from track geometry
        exitAngle: 0, // Would be calculated from track geometry
        radius: calculateCornerRadius(curvature),
      });

      usedIndices.add(space.index);
    }
  }

  return corners;
}

/**
 * Determine corner type based on curvature
 */
function determineCornerType(
  curvature: number,
): "slow" | "medium" | "fast" | "chicane" {
  if (curvature > 0.3) return "slow";
  if (curvature > 0.15) return "medium";
  if (curvature > 0.05) return "fast";
  return "chicane";
}

/**
 * Calculate speed limit based on curvature and corner type
 */
function calculateSpeedLimit(
  curvature: number,
  cornerType: "slow" | "medium" | "fast" | "chicane",
): number {
  switch (cornerType) {
    case "slow":
      return Math.max(1, Math.floor(6 - curvature * 20));
    case "medium":
      return Math.max(2, Math.floor(6 - curvature * 15));
    case "fast":
      return Math.max(3, Math.floor(6 - curvature * 10));
    case "chicane":
      return Math.max(2, Math.floor(6 - curvature * 12));
    default:
      return 3;
  }
}

/**
 * Calculate corner difficulty rating
 */
function calculateCornerDifficulty(
  curvature: number,
  speedLimit: number,
): number {
  const baseDifficulty = Math.min(10, Math.max(1, curvature * 30));
  const speedPenalty = Math.max(0, (6 - speedLimit) * 0.5);
  return Math.min(10, baseDifficulty + speedPenalty);
}

/**
 * Calculate suggested gear for corner
 */
function calculateSuggestedGear(speedLimit: number): number {
  return Math.max(1, Math.min(6, speedLimit));
}

/**
 * Calculate heat penalty for exceeding speed limit
 */
function calculateHeatPenalty(speedLimit: number): number {
  return Math.max(1, 6 - speedLimit);
}

/**
 * Calculate corner radius from curvature
 */
function calculateCornerRadius(curvature: number): number {
  return curvature > 0 ? 1 / curvature : 1000; // Large radius for straight sections
}

/**
 * Create comprehensive default track metadata
 * Implements Section A requirements for track metadata
 */
export function createDefaultTrackMetadata(): TrackMetadata {
  const now = new Date().toISOString();

  return {
    name: "Untitled Track",
    laps: 3,
    startFinishSpaceIndex: 0,
    raceDirection: "clockwise",
    boardMetadata: {
      cornersPerLap: 0,
      spacesPerLap: 0,
      heatCardCount: 0,
      stressCardCount: 0,
      trackLength: 0,
      averageSpeed: 0,
      difficulty: 5,
      trackType: "road-course",
      elevationChange: 0,
    },
    createdAt: now,
    updatedAt: now,
    version: "1.0.0",
    author: "Unknown",
    description: "A custom track for Heat: Pedal to the Metal",
    tags: ["custom", "road-course"],
  };
}

/**
 * Update track metadata with calculated values
 */
export function updateTrackMetadata(
  metadata: TrackMetadata,
  spaces: Space[],
  corners: Corner[],
  totalLength: number,
): TrackMetadata {
  const averageCurvature =
    spaces.reduce((sum, space) => sum + space.metadata.curvature, 0) /
    spaces.length;
  const averageSpeed = calculateAverageSpeed(spaces, corners);
  const difficulty = calculateTrackDifficulty(corners, averageCurvature);

  return {
    ...metadata,
    updatedAt: new Date().toISOString(),
    boardMetadata: {
      ...metadata.boardMetadata,
      cornersPerLap: corners.length,
      spacesPerLap: spaces.length,
      trackLength: totalLength,
      averageSpeed,
      difficulty,
    },
  };
}

/**
 * Calculate average speed rating for the track
 */
function calculateAverageSpeed(spaces: Space[], corners: Corner[]): number {
  if (spaces.length === 0) return 0;

  const totalSpaces = spaces.length;
  const cornerSpaces = corners.length;
  const straightSpaces = totalSpaces - cornerSpaces;

  // Assume straight sections allow speed 6, corners average speed 3
  const averageSpeed = (straightSpaces * 6 + cornerSpaces * 3) / totalSpaces;
  return Math.round(averageSpeed * 10) / 10;
}

/**
 * Calculate overall track difficulty
 */
function calculateTrackDifficulty(
  corners: Corner[],
  averageCurvature: number,
): number {
  if (corners.length === 0)
    return Math.min(10, Math.max(1, averageCurvature * 20));

  const averageCornerDifficulty =
    corners.reduce((sum, corner) => sum + corner.difficulty, 0) /
    corners.length;
  const curvatureDifficulty = Math.min(10, Math.max(1, averageCurvature * 20));

  return Math.round((averageCornerDifficulty + curvatureDifficulty) / 2);
}

/**
 * Comprehensive track validation system
 * Implements Section A requirements for track validation
 */
export function validateTrackData(trackData: TrackData): string[] {
  const errors: string[] = [];

  // Basic structure validation
  if (!trackData.splinePath.closed) {
    errors.push("Track must form a closed loop");
  }

  if (trackData.spaces.length === 0) {
    errors.push("Track must have at least one space");
  }

  if (trackData.metadata.startFinishSpaceIndex >= trackData.spaces.length) {
    errors.push("Start/Finish line must be within track bounds");
  }

  // Corner placement validation
  for (const corner of trackData.corners) {
    if (corner.spaceIndex >= trackData.spaces.length) {
      errors.push(`Corner at space ${corner.spaceIndex} is out of bounds`);
    }

    if (corner.speedLimit < 1 || corner.speedLimit > 6) {
      errors.push(
        `Corner at space ${corner.spaceIndex} has invalid speed limit: ${corner.speedLimit}`,
      );
    }
  }

  // Space validation
  for (const space of trackData.spaces) {
    if (space.spots.length === 0) {
      errors.push(`Space ${space.index} has no spots`);
    }

    const raceLineSpots = space.spots.filter(
      (spot) => spot.type === "race-line",
    );
    if (raceLineSpots.length !== 1) {
      errors.push(`Space ${space.index} must have exactly one race line spot`);
    }
  }

  // Bezier chain validation
  if (trackData.splinePath.segments.length < 3) {
    errors.push("Track must have at least 3 Bezier segments");
  }

  // Check for self-intersections (simplified)
  const hasSelfIntersections = checkForSelfIntersections(
    trackData.splinePath.segments,
  );
  if (hasSelfIntersections) {
    errors.push("Track has self-intersections");
  }

  return errors;
}

/**
 * Check for self-intersections in Bezier segments
 */
function checkForSelfIntersections(segments: BezierSegment[]): boolean {
  // Simplified intersection check - in practice this would be more sophisticated
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 2; j < segments.length; j++) {
      const seg1 = segments[i];
      const seg2 = segments[j];
      if (seg1 && seg2 && segmentsIntersect(seg1, seg2)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if two Bezier segments intersect
 */
function segmentsIntersect(seg1: BezierSegment, seg2: BezierSegment): boolean {
  // Simplified intersection check using bounding boxes
  const bbox1 = calculateBoundingBox(seg1);
  const bbox2 = calculateBoundingBox(seg2);

  return !(
    bbox1.maxX < bbox2.minX ||
    bbox1.minX > bbox2.maxX ||
    bbox1.maxY < bbox2.minY ||
    bbox1.minY > bbox2.maxY
  );
}

/**
 * Calculate bounding box for a Bezier segment
 */
function calculateBoundingBox(segment: BezierSegment): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const points = [
    segment.startPoint,
    segment.cp1,
    segment.cp2,
    segment.endPoint,
  ];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
