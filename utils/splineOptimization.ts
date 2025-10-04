import { BezierPoint, Point } from '@/types/spline';

/**
 * Advanced spline optimization utilities for simplifying curves
 */

/**
 * Calculates the curvature at a point on a cubic bezier curve
 */
function calculateCurvature(
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
 * Calculates the total curvature of a bezier curve segment
 */
function calculateSegmentCurvature(
  p0: Point,
  cp1: Point,
  cp2: Point,
  p1: Point,
  samples: number = 10
): number {
  let totalCurvature = 0;
  
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    totalCurvature += calculateCurvature(p0, cp1, cp2, p1, t);
  }
  
  return totalCurvature / (samples + 1);
}

/**
 * Evaluates a cubic bezier curve at parameter t
 */
function cubicBezier(
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
 * Calculates the distance between two points
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates perpendicular distance from a point to a line
 */
function perpendicularDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.sqrt(dx * dx + dy * dy);

  if (mag === 0) return distance(point, lineStart);

  const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);

  if (u < 0) return distance(point, lineStart);
  if (u > 1) return distance(point, lineEnd);

  const intersectionX = lineStart.x + u * dx;
  const intersectionY = lineStart.y + u * dy;

  return distance(point, { x: intersectionX, y: intersectionY });
}

/**
 * Advanced spline simplification using multiple criteria
 */
export function advancedSimplifySpline(
  points: BezierPoint[],
  options: {
    tolerance?: number;
    minCurvature?: number;
    maxPoints?: number;
    preserveCorners?: boolean;
  } = {}
): BezierPoint[] {
  const {
    tolerance = 5,
    minCurvature = 0.01,
    maxPoints = 20,
    preserveCorners = true
  } = options;

  if (points.length <= 2) return points;

  // First pass: Remove points based on curvature
  let simplified = [...points];
  
  if (preserveCorners) {
    // Calculate curvature for each segment
    const curvatures: number[] = [];
    for (let i = 0; i < simplified.length; i++) {
      const current = simplified[i];
      const next = simplified[(i + 1) % simplified.length];
      
      if (!current || !next) continue;
      
      const cp1 = current.handleOut || current;
      const cp2 = next.handleIn || next;
      
      curvatures.push(calculateSegmentCurvature(current, cp1, cp2, next));
    }
    
    // Find high-curvature points (corners) to preserve
    const avgCurvature = curvatures.reduce((sum, c) => sum + c, 0) / curvatures.length;
    const cornerThreshold = avgCurvature * 2;
    
    const pointsToKeep = new Set<number>();
    
    // Always keep first and last points
    pointsToKeep.add(0);
    pointsToKeep.add(simplified.length - 1);
    
    // Keep high-curvature points
    curvatures.forEach((curvature, index) => {
      if (curvature > cornerThreshold) {
        pointsToKeep.add(index);
        pointsToKeep.add((index + 1) % simplified.length);
      }
    });
    
    // Apply Douglas-Peucker with preserved points
    simplified = douglasPeuckerWithPreserved(simplified, tolerance, pointsToKeep);
  } else {
    // Standard Douglas-Peucker
    simplified = douglasPeucker(simplified, tolerance);
  }
  
  // Second pass: Limit maximum points
  if (simplified.length > maxPoints) {
    simplified = limitPoints(simplified, maxPoints);
  }
  
  // Third pass: Remove low-curvature segments
  simplified = removeLowCurvatureSegments(simplified, minCurvature);
  
  return simplified;
}

/**
 * Douglas-Peucker algorithm with preserved points
 */
function douglasPeuckerWithPreserved(
  points: BezierPoint[],
  tolerance: number,
  preserved: Set<number>
): BezierPoint[] {
  if (points.length <= 2) return points;

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (!firstPoint || !lastPoint) return points;

  let maxDistance = 0;
  let maxIndex = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    if (!point) continue;

    // Skip if this point must be preserved
    if (preserved.has(i)) continue;

    const dist = perpendicularDistance(point, firstPoint, lastPoint);
    if (dist > maxDistance) {
      maxDistance = dist;
      maxIndex = i;
    }
  }

  if (maxDistance > tolerance) {
    const left = douglasPeuckerWithPreserved(points.slice(0, maxIndex + 1), tolerance, preserved);
    const right = douglasPeuckerWithPreserved(points.slice(maxIndex), tolerance, preserved);
    return [...left.slice(0, -1), ...right];
  } else {
    return [firstPoint, lastPoint];
  }
}

/**
 * Standard Douglas-Peucker algorithm
 */
function douglasPeucker(points: BezierPoint[], tolerance: number): BezierPoint[] {
  if (points.length <= 2) return points;

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (!firstPoint || !lastPoint) return points;

  let maxDistance = 0;
  let maxIndex = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    if (!point) continue;

    const dist = perpendicularDistance(point, firstPoint, lastPoint);
    if (dist > maxDistance) {
      maxDistance = dist;
      maxIndex = i;
    }
  }

  if (maxDistance > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  } else {
    return [firstPoint, lastPoint];
  }
}

/**
 * Limits the number of points by removing the least important ones
 */
function limitPoints(points: BezierPoint[], maxPoints: number): BezierPoint[] {
  if (points.length <= maxPoints) return points;

  // Calculate importance score for each point
  const scores: Array<{ index: number; score: number }> = [];
  
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const prev = points[(i - 1 + points.length) % points.length];
    const next = points[(i + 1) % points.length];
    
    if (!current || !prev || !next) continue;
    
    // Score based on angle change and distance from neighbors
    const angle1 = Math.atan2(current.y - prev.y, current.x - prev.x);
    const angle2 = Math.atan2(next.y - current.y, next.x - current.x);
    const angleChange = Math.abs(angle2 - angle1);
    
    const dist1 = distance(current, prev);
    const dist2 = distance(current, next);
    
    // Higher score = more important (should be kept)
    const score = angleChange * (dist1 + dist2);
    scores.push({ index: i, score });
  }
  
  // Sort by score (descending) and keep top maxPoints
  scores.sort((a, b) => b.score - a.score);
  const indicesToKeep = new Set(scores.slice(0, maxPoints).map(s => s.index));
  
  return points.filter((_, index) => indicesToKeep.has(index));
}

/**
 * Removes segments with low curvature
 */
function removeLowCurvatureSegments(
  points: BezierPoint[],
  minCurvature: number
): BezierPoint[] {
  if (points.length <= 2) return points;

  const result: BezierPoint[] = [];
  
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    
    if (!current || !next) continue;
    
    const cp1 = current.handleOut || current;
    const cp2 = next.handleIn || next;
    
    const curvature = calculateSegmentCurvature(current, cp1, cp2, next);
    
    // Keep the point if it's the first, last, or has sufficient curvature
    if (i === 0 || i === points.length - 1 || curvature >= minCurvature) {
      result.push(current);
    }
  }
  
  return result;
}

/**
 * Automatic spline optimization with smart defaults
 */
export function autoOptimizeSpline(points: BezierPoint[]): BezierPoint[] {
  const pointCount = points.length;
  
  // Adaptive parameters based on spline complexity
  let tolerance: number;
  let maxPoints: number;
  let minCurvature: number;
  
  if (pointCount > 50) {
    // Very complex spline - aggressive simplification
    tolerance = 8;
    maxPoints = 15;
    minCurvature = 0.02;
  } else if (pointCount > 30) {
    // Moderately complex - balanced simplification
    tolerance = 5;
    maxPoints = 20;
    minCurvature = 0.015;
  } else if (pointCount > 15) {
    // Simple spline - light simplification
    tolerance = 3;
    maxPoints = 25;
    minCurvature = 0.01;
  } else {
    // Already simple - minimal changes
    tolerance = 2;
    maxPoints = pointCount;
    minCurvature = 0.005;
  }
  
  return advancedSimplifySpline(points, {
    tolerance,
    maxPoints,
    minCurvature,
    preserveCorners: true
  });
}

/**
 * Manual spline optimization with user controls
 */
export function manualOptimizeSpline(
  points: BezierPoint[],
  settings: {
    tolerance: number;
    maxPoints: number;
    minCurvature: number;
    preserveCorners: boolean;
  }
): BezierPoint[] {
  return advancedSimplifySpline(points, settings);
}

/**
 * Analyzes spline complexity and suggests optimization settings
 */
export function analyzeSplineComplexity(points: BezierPoint[]): {
  pointCount: number;
  averageCurvature: number;
  maxCurvature: number;
  suggestedTolerance: number;
  suggestedMaxPoints: number;
  complexity: 'simple' | 'moderate' | 'complex' | 'very-complex';
} {
  if (points.length === 0) {
    return {
      pointCount: 0,
      averageCurvature: 0,
      maxCurvature: 0,
      suggestedTolerance: 2,
      suggestedMaxPoints: 10,
      complexity: 'simple'
    };
  }

  const curvatures: number[] = [];
  
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    
    if (!current || !next) continue;
    
    const cp1 = current.handleOut || current;
    const cp2 = next.handleIn || next;
    
    curvatures.push(calculateSegmentCurvature(current, cp1, cp2, next));
  }
  
  const averageCurvature = curvatures.reduce((sum, c) => sum + c, 0) / curvatures.length;
  const maxCurvature = Math.max(...curvatures);
  
  let complexity: 'simple' | 'moderate' | 'complex' | 'very-complex';
  let suggestedTolerance: number;
  let suggestedMaxPoints: number;
  
  if (points.length > 50 || averageCurvature > 0.05) {
    complexity = 'very-complex';
    suggestedTolerance = 8;
    suggestedMaxPoints = 15;
  } else if (points.length > 30 || averageCurvature > 0.03) {
    complexity = 'complex';
    suggestedTolerance = 5;
    suggestedMaxPoints = 20;
  } else if (points.length > 15 || averageCurvature > 0.02) {
    complexity = 'moderate';
    suggestedTolerance = 3;
    suggestedMaxPoints = 25;
  } else {
    complexity = 'simple';
    suggestedTolerance = 2;
    suggestedMaxPoints = points.length;
  }
  
  return {
    pointCount: points.length,
    averageCurvature,
    maxCurvature,
    suggestedTolerance,
    suggestedMaxPoints,
    complexity
  };
}
