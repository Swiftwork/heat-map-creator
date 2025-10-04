export interface Point {
  x: number;
  y: number;
}

export interface BezierPoint extends Point {
  handleIn?: Point;
  handleOut?: Point;
}

export interface SplinePath {
  id: string;
  points: BezierPoint[];
  color: string;
  strokeWidth: number;
  closed: boolean;
}

export interface DrawingState {
  isDrawing: boolean;
  currentPath: Point[];
  paths: SplinePath[];
  selectedPath: string | null;
  selectedPoint: { pathId: string; pointIndex: number } | null;
  selectedHandle: { pathId: string; pointIndex: number; type: 'in' | 'out' } | null;
}

