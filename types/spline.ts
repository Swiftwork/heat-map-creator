export interface Point {
  x: number;
  y: number;
}

export interface BezierPoint extends Point {
  handleIn?: Point;
  handleOut?: Point;
}

// Enhanced Bezier segment for proper chain storage
export interface BezierSegment {
  id: string;
  startPoint: BezierPoint;
  endPoint: BezierPoint;
  // Control points are stored relative to start/end points
  cp1: Point; // First control point
  cp2: Point; // Second control point
  continuity: "C0" | "C1" | "C2"; // Continuity level
}

export interface SplinePath {
  id: string;
  segments: BezierSegment[]; // Connected chain of segments
  color: string;
  strokeWidth: number;
  closed: boolean;
  // Legacy support for points array
  points?: BezierPoint[];
}

// New types for Section B requirements

export interface Spot {
  id: string;
  position: Point;
  type: "race-line" | "outer" | "inner";
  isOccupied: boolean;
  // Additional spot properties for Heat: Pedal to the Metal
  spotIndex: number; // Position within the space (0 = innermost, higher = outer)
  isBlocking: boolean; // Can block other cars
  slipstreamValue: number; // Slipstream bonus when behind this spot
}

export interface Space {
  id: string;
  index: number;
  position: Point;
  spots: Spot[];
  // Enhanced metadata for Heat: Pedal to the Metal
  metadata: {
    isCornerLine: boolean;
    speedLimit?: number;
    isStartFinish: boolean;
    legendLine?: string;
    // Additional gameplay properties
    isStraight: boolean;
    curvature: number; // Calculated curvature at this space
    trackWidth: number; // Width of track at this space
    elevation?: number; // Optional elevation change
    surface?: "asphalt" | "gravel" | "dirt"; // Track surface type
  };
}

export interface Corner {
  id: string;
  spaceIndex: number;
  speedLimit: number;
  position: Point;
  isAutoSuggested: boolean;
  innerSide: "left" | "right"; // Which side is the inner side (thicker line) from this corner to the next
  // Enhanced corner properties
  cornerType: "slow" | "medium" | "fast" | "chicane";
  difficulty: number; // 1-10 difficulty rating
  suggestedGear: number; // Suggested gear for this corner
  heatPenalty: number; // Base heat penalty for exceeding speed limit
  // Corner geometry
  entryAngle: number; // Angle of entry into corner
  exitAngle: number; // Angle of exit from corner
  radius: number; // Corner radius (for tightness calculation)
}

export interface TrackMetadata {
  name: string;
  laps: number;
  startFinishSpaceIndex: number;
  raceDirection: boolean; // true = clockwise, false = counter-clockwise
  // Enhanced board metadata
  boardMetadata: {
    cornersPerLap: number;
    spacesPerLap: number;
    heatCardCount: number;
    stressCardCount: number;
    // Additional metadata
    trackLength: number; // Total track length in meters
    averageSpeed: number; // Average speed rating
    difficulty: number; // Overall track difficulty (1-10)
    trackType: "oval" | "road-course" | "street-circuit" | "rally";
    elevationChange: number; // Total elevation change
    // Expansion support
    weatherTokens?: number;
    chicanes?: number;
    tunnels?: number;
  };
  // Track creation and versioning
  createdAt: string;
  updatedAt: string;
  version: string;
  author?: string;
  description?: string;
  tags?: string[];
}

export interface TrackData {
  id: string;
  splinePath: SplinePath;
  spaces: Space[];
  corners: Corner[];
  metadata: TrackMetadata;
  discretizationSettings: {
    sampleDistance?: number;
    targetSpacesPerLap?: number;
    currentSpacesPerLap: number;
    // Enhanced discretization settings
    trackWidth: number;
    spotCount: number; // Number of spots per space
    raceLineOffset: number; // Offset of race line from center
    // Quality settings
    arcLengthSamples: number; // Samples for arc length calculation
    curvatureThreshold: number; // Threshold for corner detection
  };
  // Appearance settings
  appearanceSettings?: {
    trackColor?: string;
    countdownTextColor?: string;
  };
  // Validation and export
  validationErrors: string[];
  isValid: boolean;
  lastValidated: string;
}

export interface DrawingState {
  isDrawing: boolean;
  currentPath: Point[];
  paths: SplinePath[];
  selectedPath: string | null;
  selectedPoint: { pathId: string; pointIndex: number } | null;
  selectedHandle: {
    pathId: string;
    pointIndex: number;
    type: "in" | "out";
  } | null;
}

export interface EditorState {
  currentTrack: TrackData | null;
  selectedCorner: string | null;
  selectedSpace: string | null;
  debugMode: boolean;
  editingMode: "spline" | "corners" | "metadata" | "appearance";
  splineToolMode: "select" | "add" | "remove";
  cornerToolMode: "select" | "add" | "remove";
}

// Serialization and validation types
export interface TrackExportData {
  version: string;
  trackData: TrackData;
  exportMetadata: {
    exportedAt: string;
    exportedBy: string;
    format: "json" | "heat-track";
    checksum: string;
  };
}

export interface TrackValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  // Detailed validation results
  geometryValidation: {
    isClosed: boolean;
    hasSelfIntersections: boolean;
    minRadius: number;
    maxRadius: number;
  };
  gameplayValidation: {
    cornerPlacementValid: boolean;
    startFinishValid: boolean;
    spaceDistributionValid: boolean;
  };
}

// Bezier continuity and quality types
export interface ContinuitySettings {
  enforceC1: boolean; // Tangent continuity
  enforceC2: boolean; // Curvature continuity
  tolerance: number; // Tolerance for continuity checks
}

export interface BezierQualityMetrics {
  totalLength: number;
  averageCurvature: number;
  maxCurvature: number;
  curvatureVariation: number;
  segmentCount: number;
  continuityLevel: "C0" | "C1" | "C2";
}
