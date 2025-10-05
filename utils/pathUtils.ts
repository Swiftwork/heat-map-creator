import { BezierPoint, Point } from "@/types/spline";

function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function perpendicularDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.sqrt(dx * dx + dy * dy);

  if (mag === 0) return distance(point, lineStart);

  const u =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);

  if (u < 0) return distance(point, lineStart);
  if (u > 1) return distance(point, lineEnd);

  const intersectionX = lineStart.x + u * dx;
  const intersectionY = lineStart.y + u * dy;

  return distance(point, { x: intersectionX, y: intersectionY });
}

/**
 * Simplifies a path using the Ramer-Douglas-Peucker algorithm
 */
export function simplifyPath(points: Point[], tolerance: number = 3): Point[] {
  if (points.length < 3) return points;

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
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  } else {
    return [firstPoint, lastPoint];
  }
}

/**
 * Converts simplified points to bezier points with handles
 */
export function pointsToBezier(points: Point[]): BezierPoint[] {
  if (points.length < 2) return points.map((p) => ({ ...p }));

  const bezierPoints: BezierPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    if (!current) continue;

    const prev = i > 0 ? points[i - 1] : points[points.length - 1];
    const next = i < points.length - 1 ? points[i + 1] : points[0];

    if (!prev || !next) continue;

    // Calculate tangent
    const tangentX = (next.x - prev.x) * 0.25;
    const tangentY = (next.y - prev.y) * 0.25;

    bezierPoints.push({
      x: current.x,
      y: current.y,
      handleIn: { x: current.x - tangentX, y: current.y - tangentY },
      handleOut: { x: current.x + tangentX, y: current.y + tangentY },
    });
  }

  return bezierPoints;
}

/**
 * Generates SVG path string from bezier points
 */
export function bezierToSvgPath(
  points: BezierPoint[],
  closed: boolean = true,
): string {
  if (points.length === 0) return "";

  const firstPoint = points[0];
  if (!firstPoint) return "";

  let path = `M ${firstPoint.x} ${firstPoint.y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];

    if (!current || !next) continue;

    const cp1 = current.handleOut || current;
    const cp2 = next.handleIn || next;

    path += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${next.x} ${next.y}`;
  }

  if (closed && points.length > 2) {
    const last = points[points.length - 1];
    const first = points[0];

    if (!last || !first) return path;

    const cp1 = last.handleOut || last;
    const cp2 = first.handleIn || first;

    path += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${first.x} ${first.y}`;
    path += " Z";
  }

  return path;
}

/**
 * Generates a unique ID
 */
export function generateId(): string {
  return `path-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Evaluates a cubic bezier curve at parameter t (0 to 1)
 */
function cubicBezier(
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
 * Samples points along a bezier path
 */
export function sampleBezierPath(
  points: BezierPoint[],
  numSegments: number,
  closed: boolean = true,
): Point[] {
  if (points.length < 2) return [];

  const samples: Point[] = [];
  const numCurves = closed ? points.length : points.length - 1;

  for (let i = 0; i < numCurves; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];

    if (!current || !next) continue;

    const cp1 = current.handleOut || current;
    const cp2 = next.handleIn || next;

    // Sample points along this curve segment
    const samplesPerCurve = Math.ceil(numSegments / numCurves);
    for (let j = 0; j < samplesPerCurve; j++) {
      const t = j / samplesPerCurve;
      samples.push(cubicBezier(current, cp1, cp2, next, t));
    }
  }

  return samples;
}

/**
 * Calculates the tangent (derivative) at a point on a cubic bezier curve
 */
function cubicBezierTangent(
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
 * Offsets a point perpendicular to the path direction
 */
export function offsetPoint(
  points: BezierPoint[],
  curveIndex: number,
  t: number,
  offset: number,
): Point {
  const current = points[curveIndex];
  const next = points[(curveIndex + 1) % points.length];

  if (!current || !next) return { x: 0, y: 0 };

  const cp1 = current.handleOut || current;
  const cp2 = next.handleIn || next;

  // Get the tangent at this point
  const tangent = cubicBezierTangent(current, cp1, cp2, next, t);

  // Normalize and get perpendicular
  const length = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
  if (length === 0) return cubicBezier(current, cp1, cp2, next, t);

  const nx = tangent.x / length;
  const ny = tangent.y / length;

  // Perpendicular is (-ny, nx)
  const perpX = -ny;
  const perpY = nx;

  // Get the base point and offset it
  const basePoint = cubicBezier(current, cp1, cp2, next, t);

  return {
    x: basePoint.x + perpX * offset,
    y: basePoint.y + perpY * offset,
  };
}
