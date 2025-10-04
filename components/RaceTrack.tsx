"use client";

import { BezierPoint } from "@/types/spline";
import { bezierToSvgPath } from "@/utils/pathUtils";

interface RaceTrackProps {
  points: BezierPoint[];
  segments: number;
  closed: boolean;
}

interface Point {
  x: number;
  y: number;
}

export function RaceTrack({ points, segments, closed }: RaceTrackProps) {
  if (points.length < 2) return null;

  const trackWidth = 100; // Total width of the race track
  const samplesPerCurve = 50; // High sampling for smooth, consistent width

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

      // Sample this curve segment
      for (let j = 0; j < samplesPerCurve; j++) {
        const t = j / samplesPerCurve;
        
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
    
    if (closed && firstPoint) {
      path += ` L ${firstPoint.x} ${firstPoint.y} Z`;
    }

    return path;
  };

  // Create fill path by combining left and right offset paths
  const trackFillPath = (() => {
    const leftPoints: Point[] = [];
    const rightPoints: Point[] = [];
    const numCurves = closed ? points.length : points.length - 1;

    // Sample both sides simultaneously
    for (let i = 0; i < numCurves; i++) {
      const current = points[i];
      const next = points[(i + 1) % points.length];
      if (!current || !next) continue;

      const cp1 = current.handleOut || current;
      const cp2 = next.handleIn || next;

      for (let j = 0; j < samplesPerCurve; j++) {
        const t = j / samplesPerCurve;
        
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

    path += " Z";
    return path;
  })();

  const outerLeftPath = generateOffsetPath(trackWidth / 2);
  const outerRightPath = generateOffsetPath(-trackWidth / 2);
  const centerPath = bezierToSvgPath(points, closed);

  // Calculate dash array for center line based on segments
  // Each segment gets one dash-gap pair
  const dashLength = Math.max(10, 40 - segments / 10);
  const gapLength = dashLength;

  // Generate segment crossing lines
  const segmentLines = (() => {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const numCurves = closed ? points.length : points.length - 1;

    // Sample points along the path for each segment
    for (let seg = 0; seg < segments; seg++) {
      // Calculate position along the entire path
      const t = seg / segments;
      const curvePosition = t * numCurves;
      const curveIndex = Math.floor(curvePosition);
      const curveT = curvePosition - curveIndex;

      if (curveIndex >= points.length) continue;

      const current = points[curveIndex];
      const next = points[(curveIndex + 1) % points.length];

      if (!current || !next) continue;

      // Calculate point on the center curve
      const cp1 = current.handleOut || current;
      const cp2 = next.handleIn || next;

      // Bezier curve evaluation
      const t2 = curveT * curveT;
      const t3 = t2 * curveT;
      const mt = 1 - curveT;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;

      const centerX = mt3 * current.x + 3 * mt2 * curveT * cp1.x + 3 * mt * t2 * cp2.x + t3 * next.x;
      const centerY = mt3 * current.y + 3 * mt2 * curveT * cp1.y + 3 * mt * t2 * cp2.y + t3 * next.y;

      // Calculate tangent for perpendicular
      const tangentX =
        -3 * mt2 * current.x +
        3 * mt2 * cp1.x -
        6 * mt * curveT * cp1.x +
        6 * mt * curveT * cp2.x -
        3 * t2 * cp2.x +
        3 * t2 * next.x;
      const tangentY =
        -3 * mt2 * current.y +
        3 * mt2 * cp1.y -
        6 * mt * curveT * cp1.y +
        6 * mt * curveT * cp2.y -
        3 * t2 * cp2.y +
        3 * t2 * next.y;

      const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
      if (tangentLength === 0) continue;

      // Normalize tangent
      const nx = tangentX / tangentLength;
      const ny = tangentY / tangentLength;

      // Perpendicular is (-ny, nx)
      const perpX = -ny;
      const perpY = nx;

      // Calculate endpoints of the crossing line
      const halfWidth = trackWidth / 2;
      lines.push({
        x1: centerX + perpX * halfWidth,
        y1: centerY + perpY * halfWidth,
        x2: centerX - perpX * halfWidth,
        y2: centerY - perpY * halfWidth,
      });
    }

    return lines;
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
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4}
      />
    </g>
  );
}

