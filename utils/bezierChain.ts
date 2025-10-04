import { BezierPoint, BezierQualityMetrics, BezierSegment, ContinuitySettings, Point, SplinePath } from '@/types/spline';
import { generateId } from './pathUtils';

/**
 * Enhanced Bezier chain utilities for proper Section A compliance
 * Implements connected chain of cubic Bezier segments with continuity enforcement
 */

/**
 * Convert legacy points array to proper Bezier segments
 */
export function pointsToBezierSegments(
  points: BezierPoint[],
  continuity: 'C0' | 'C1' | 'C2' = 'C1'
): BezierSegment[] {
  if (points.length < 2) return [];

  const segments: BezierSegment[] = [];
  
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    
    if (!current || !next) continue;

    // Extract control points
    const cp1 = current.handleOut || current;
    const cp2 = next.handleIn || next;

    segments.push({
      id: generateId(),
      startPoint: current,
      endPoint: next,
      cp1,
      cp2,
      continuity: i === 0 ? continuity : 'C0', // Only first segment gets continuity
    });
  }

  return segments;
}

/**
 * Convert Bezier segments back to points array (for legacy compatibility)
 */
export function bezierSegmentsToPoints(segments: BezierSegment[]): BezierPoint[] {
  if (segments.length === 0) return [];

  const points: BezierPoint[] = [];
  
  for (const segment of segments) {
    // Add start point with handleOut
    points.push({
      x: segment.startPoint.x,
      y: segment.startPoint.y,
      handleIn: segment.startPoint.handleIn,
      handleOut: segment.cp1,
    });
  }

  // Add the last end point
  const lastSegment = segments[segments.length - 1];
  if (lastSegment) {
    points.push({
      x: lastSegment.endPoint.x,
      y: lastSegment.endPoint.y,
      handleIn: lastSegment.cp2,
      handleOut: lastSegment.endPoint.handleOut,
    });
  }

  return points;
}

/**
 * Enforce continuity between Bezier segments
 */
export function enforceContinuity(
  segments: BezierSegment[],
  settings: ContinuitySettings
): BezierSegment[] {
  if (segments.length < 2) return segments;

  const updatedSegments = [...segments];

  for (let i = 0; i < updatedSegments.length; i++) {
    const current = updatedSegments[i];
    const next = updatedSegments[(i + 1) % updatedSegments.length];
    
    if (!current || !next) continue;

    // C1 continuity: tangent vectors must be collinear
    if (settings.enforceC1) {
      const tangent1 = {
        x: current.cp1.x - current.endPoint.x,
        y: current.cp1.y - current.endPoint.y,
      };
      
      const tangent2 = {
        x: next.startPoint.x - next.cp2.x,
        y: next.startPoint.y - next.cp2.y,
      };

      // Make tangents collinear by adjusting next segment's cp2
      const tangentLength = Math.sqrt(tangent1.x * tangent1.x + tangent1.y * tangent1.y);
      if (tangentLength > 0) {
        const scale = Math.sqrt(tangent2.x * tangent2.x + tangent2.y * tangent2.y) / tangentLength;
        next.cp2 = {
          x: next.startPoint.x - tangent1.x * scale,
          y: next.startPoint.y - tangent1.y * scale,
        };
      }
    }

    // C2 continuity: curvature must be continuous
    if (settings.enforceC2) {
      // This is more complex and requires solving curvature equations
      // For now, we'll implement a simplified version
      const curvature1 = calculateSegmentCurvature(current);
      const curvature2 = calculateSegmentCurvature(next);
      
      // Adjust control points to match curvature
      if (Math.abs(curvature1 - curvature2) > settings.tolerance) {
        // Simplified curvature matching
        const avgCurvature = (curvature1 + curvature2) / 2;
        adjustSegmentForCurvature(next, avgCurvature);
      }
    }
  }

  return updatedSegments;
}

/**
 * Calculate curvature for a Bezier segment
 */
function calculateSegmentCurvature(segment: BezierSegment): number {
  // Sample curvature at multiple points along the segment
  let totalCurvature = 0;
  const samples = 10;
  
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const curvature = calculateCurvatureAtT(
      segment.startPoint,
      segment.cp1,
      segment.cp2,
      segment.endPoint,
      t
    );
    totalCurvature += curvature;
  }
  
  return totalCurvature / (samples + 1);
}

/**
 * Calculate curvature at parameter t on a Bezier curve
 */
function calculateCurvatureAtT(
  p0: Point,
  cp1: Point,
  cp2: Point,
  p1: Point,
  t: number
): number {
  // First derivative (tangent)
  const t2 = t * t;
  const mt = 1 - t;
  const mt2 = mt * mt;

  const dx = -3 * mt2 * p0.x + 3 * mt2 * cp1.x - 6 * mt * t * cp1.x + 6 * mt * t * cp2.x - 3 * t2 * cp2.x + 3 * t2 * p1.x;
  const dy = -3 * mt2 * p0.y + 3 * mt2 * cp1.y - 6 * mt * t * cp1.y + 6 * mt * t * cp2.y - 3 * t2 * cp2.y + 3 * t2 * p1.y;

  // Second derivative
  const ddx = 6 * mt * p0.x - 12 * mt * cp1.x + 6 * mt * cp2.x + 6 * t * cp1.x - 12 * t * cp2.x + 6 * t * p1.x;
  const ddy = 6 * mt * p0.y - 12 * mt * cp1.y + 6 * mt * cp2.y + 6 * t * cp1.y - 12 * t * cp2.y + 6 * t * p1.y;

  // Curvature = |x'y'' - y'x''| / (x'^2 + y'^2)^(3/2)
  const numerator = Math.abs(dx * ddy - dy * ddx);
  const denominator = Math.pow(dx * dx + dy * dy, 1.5);

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Adjust segment control points to achieve target curvature
 */
function adjustSegmentForCurvature(segment: BezierSegment, targetCurvature: number): void {
  // Simplified curvature adjustment
  // In a full implementation, this would solve the curvature equation
  
  const currentCurvature = calculateSegmentCurvature(segment);
  const adjustment = (targetCurvature - currentCurvature) * 0.1;
  
  // Adjust control points proportionally
  const centerX = (segment.startPoint.x + segment.endPoint.x) / 2;
  const centerY = (segment.startPoint.y + segment.endPoint.y) / 2;
  
  segment.cp1.x += adjustment * (segment.cp1.x - centerX);
  segment.cp1.y += adjustment * (segment.cp1.y - centerY);
  segment.cp2.x += adjustment * (segment.cp2.x - centerX);
  segment.cp2.y += adjustment * (segment.cp2.y - centerY);
}

/**
 * Calculate total arc length of a Bezier chain
 */
export function calculateChainArcLength(segments: BezierSegment[], samples: number = 100): number {
  let totalLength = 0;
  
  for (const segment of segments) {
    totalLength += calculateSegmentArcLength(segment, samples);
  }
  
  return totalLength;
}

/**
 * Calculate arc length of a single Bezier segment
 */
function calculateSegmentArcLength(segment: BezierSegment, samples: number = 100): number {
  let length = 0;
  let prevPoint = segment.startPoint;

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const point = evaluateCubicBezier(
      segment.startPoint,
      segment.cp1,
      segment.cp2,
      segment.endPoint,
      t
    );
    
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
function evaluateCubicBezier(
  p0: Point,
  cp1: Point,
  cp2: Point,
  p1: Point,
  t: number
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
 * Find parameter t for a given distance along a Bezier chain
 */
export function findTForDistance(
  segments: BezierSegment[],
  targetDistance: number,
  samples: number = 100
): { segmentIndex: number; t: number } {
  let accumulatedDistance = 0;
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;
    
    const segmentLength = calculateSegmentArcLength(segment, samples);
    
    if (accumulatedDistance + segmentLength >= targetDistance) {
      const localDistance = targetDistance - accumulatedDistance;
      const t = findTForDistanceInSegment(segment, localDistance, samples);
      return { segmentIndex: i, t };
    }
    
    accumulatedDistance += segmentLength;
  }
  
  // Fallback to last segment
  return { segmentIndex: segments.length - 1, t: 1 };
}

/**
 * Find parameter t for a given distance within a single segment
 */
function findTForDistanceInSegment(
  segment: BezierSegment,
  targetDistance: number,
  samples: number = 100
): number {
  let accumulatedDistance = 0;
  let prevPoint = segment.startPoint;
  
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const point = evaluateCubicBezier(
      segment.startPoint,
      segment.cp1,
      segment.cp2,
      segment.endPoint,
      t
    );
    
    const dx = point.x - prevPoint.x;
    const dy = point.y - prevPoint.y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);
    
    if (accumulatedDistance + segmentLength >= targetDistance) {
      const ratio = (targetDistance - accumulatedDistance) / segmentLength;
      return (i - 1) / samples + ratio / samples;
    }
    
    accumulatedDistance += segmentLength;
    prevPoint = point;
  }
  
  return 1;
}

/**
 * Evaluate a point on the Bezier chain at given segment and t
 */
export function evaluateChainAtT(
  segments: BezierSegment[],
  segmentIndex: number,
  t: number
): Point {
  const segment = segments[segmentIndex];
  if (!segment) return { x: 0, y: 0 };
  
  return evaluateCubicBezier(
    segment.startPoint,
    segment.cp1,
    segment.cp2,
    segment.endPoint,
    t
  );
}

/**
 * Calculate tangent vector at a point on the Bezier chain
 */
export function calculateChainTangent(
  segments: BezierSegment[],
  segmentIndex: number,
  t: number
): Point {
  const segment = segments[segmentIndex];
  if (!segment) return { x: 0, y: 0 };
  
  const t2 = t * t;
  const mt = 1 - t;
  const mt2 = mt * mt;

  return {
    x: -3 * mt2 * segment.startPoint.x + 3 * mt2 * segment.cp1.x - 6 * mt * t * segment.cp1.x + 6 * mt * t * segment.cp2.x - 3 * t2 * segment.cp2.x + 3 * t2 * segment.endPoint.x,
    y: -3 * mt2 * segment.startPoint.y + 3 * mt2 * segment.cp1.y - 6 * mt * t * segment.cp1.y + 6 * mt * t * segment.cp2.y - 3 * t2 * segment.cp2.y + 3 * t2 * segment.endPoint.y,
  };
}

/**
 * Analyze Bezier chain quality metrics
 */
export function analyzeChainQuality(segments: BezierSegment[]): BezierQualityMetrics {
  const totalLength = calculateChainArcLength(segments);
  
  // Calculate curvature statistics
  const curvatures: number[] = [];
  for (const segment of segments) {
    curvatures.push(calculateSegmentCurvature(segment));
  }
  
  const averageCurvature = curvatures.reduce((sum, c) => sum + c, 0) / curvatures.length;
  const maxCurvature = Math.max(...curvatures);
  const curvatureVariation = Math.sqrt(
    curvatures.reduce((sum, c) => sum + Math.pow(c - averageCurvature, 2), 0) / curvatures.length
  );
  
  // Determine continuity level
  let continuityLevel: 'C0' | 'C1' | 'C2' = 'C0';
  if (segments.length > 1) {
    // Check C1 continuity
    const hasC1 = checkC1Continuity(segments);
    if (hasC1) {
      continuityLevel = 'C1';
      // Check C2 continuity
      const hasC2 = checkC2Continuity(segments);
      if (hasC2) {
        continuityLevel = 'C2';
      }
    }
  }
  
  return {
    totalLength,
    averageCurvature,
    maxCurvature,
    curvatureVariation,
    segmentCount: segments.length,
    continuityLevel,
  };
}

/**
 * Check C1 continuity between segments
 */
function checkC1Continuity(segments: BezierSegment[], tolerance: number = 0.01): boolean {
  for (let i = 0; i < segments.length; i++) {
    const current = segments[i];
    const next = segments[(i + 1) % segments.length];
    
    if (!current || !next) continue;
    
    const tangent1 = {
      x: current.cp1.x - current.endPoint.x,
      y: current.cp1.y - current.endPoint.y,
    };
    
    const tangent2 = {
      x: next.startPoint.x - next.cp2.x,
      y: next.startPoint.y - next.cp2.y,
    };
    
    // Check if tangents are collinear
    const crossProduct = Math.abs(tangent1.x * tangent2.y - tangent1.y * tangent2.x);
    if (crossProduct > tolerance) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check C2 continuity between segments
 */
function checkC2Continuity(segments: BezierSegment[], tolerance: number = 0.01): boolean {
  // Simplified C2 check - in practice this would be more complex
  for (let i = 0; i < segments.length; i++) {
    const current = segments[i];
    const next = segments[(i + 1) % segments.length];
    
    if (!current || !next) continue;
    
    const curvature1 = calculateSegmentCurvature(current);
    const curvature2 = calculateSegmentCurvature(next);
    
    if (Math.abs(curvature1 - curvature2) > tolerance) {
      return false;
    }
  }
  
  return true;
}

/**
 * Create a proper SplinePath from Bezier segments
 */
export function createSplinePathFromSegments(
  segments: BezierSegment[],
  color: string = '#3182ce',
  strokeWidth: number = 3,
  closed: boolean = true
): SplinePath {
  return {
    id: generateId(),
    segments,
    color,
    strokeWidth,
    closed,
    // Legacy points array for compatibility
    points: bezierSegmentsToPoints(segments),
  };
}
