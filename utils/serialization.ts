import {
  TrackData,
  TrackExportData,
  TrackValidationResult,
} from "@/types/spline";

import { validateTrackData } from "./trackUtils";

/**
 * Comprehensive JSON serialization system for Section A compliance
 * Handles both geometric (Bezier control points) and gameplay data (Spaces, Corners, metadata)
 */

/**
 * Serialize track data to JSON with comprehensive metadata
 */
export function serializeTrackData(trackData: TrackData): TrackExportData {
  const validationErrors = validateTrackData(trackData);
  const isValid = validationErrors.length === 0;

  // Update track data with validation results
  const updatedTrackData: TrackData = {
    ...trackData,
    validationErrors,
    isValid,
    lastValidated: new Date().toISOString(),
  };

  return {
    version: "1.0.0",
    trackData: updatedTrackData,
    exportMetadata: {
      exportedAt: new Date().toISOString(),
      exportedBy: "Heat Map Creator",
      format: "heat-track",
      checksum: calculateChecksum(updatedTrackData),
    },
  };
}

/**
 * Deserialize track data from JSON with validation
 */
export function deserializeTrackData(exportData: TrackExportData): TrackData {
  const trackData = exportData.trackData;

  // Validate the imported data
  const validationErrors = validateTrackData(trackData);
  const isValid = validationErrors.length === 0;

  return {
    ...trackData,
    validationErrors,
    isValid,
    lastValidated: new Date().toISOString(),
  };
}

/**
 * Calculate checksum for track data integrity
 */
function calculateChecksum(trackData: TrackData): string {
  // Simple checksum based on track structure
  const dataString = JSON.stringify({
    id: trackData.id,
    spacesCount: trackData.spaces.length,
    cornersCount: trackData.corners.length,
    segmentsCount: trackData.splinePath.segments.length,
    metadata: trackData.metadata,
  });

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
}

/**
 * Export track data to various formats
 */
export function exportTrackData(
  trackData: TrackData,
  format: "json" | "heat-track" | "legacy",
): string {
  switch (format) {
    case "json":
      return JSON.stringify(serializeTrackData(trackData), null, 2);

    case "heat-track":
      return JSON.stringify(serializeTrackData(trackData), null, 0);

    case "legacy":
      return exportLegacyFormat(trackData);

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Export in legacy format for backward compatibility
 */
function exportLegacyFormat(trackData: TrackData): string {
  // Convert to legacy format with points array instead of segments
  const legacyData = {
    id: trackData.id,
    splinePath: {
      ...trackData.splinePath,
      points: trackData.splinePath.points || [],
      segments: undefined, // Remove segments for legacy compatibility
    },
    spaces: trackData.spaces,
    corners: trackData.corners,
    metadata: trackData.metadata,
    discretizationSettings: trackData.discretizationSettings,
  };

  return JSON.stringify(legacyData, null, 2);
}

/**
 * Import track data from various formats
 */
export function importTrackData(
  data: string,
  format: "json" | "heat-track" | "legacy",
): TrackData {
  try {
    const parsedData = JSON.parse(data);

    switch (format) {
      case "json":
      case "heat-track":
        if (parsedData.version && parsedData.trackData) {
          return deserializeTrackData(parsedData);
        }
        throw new Error("Invalid export format - missing version or trackData");

      case "legacy":
        return importLegacyFormat(parsedData);

      default:
        throw new Error(`Unsupported import format: ${format}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to parse track data: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Import legacy format and convert to new format
 */
function importLegacyFormat(legacyData: any): TrackData {
  // Convert legacy points array to segments if needed
  let splinePath = legacyData.splinePath;

  if (splinePath.points && !splinePath.segments) {
    // Convert points to segments
    const { pointsToBezierSegments } = require("./bezierChain");
    splinePath = {
      ...splinePath,
      segments: pointsToBezierSegments(splinePath.points),
    };
  }

  // Migrate corners to include innerSide and badgeSide properties if missing
  const corners = (legacyData.corners || []).map((corner: any) => ({
    ...corner,
    innerSide: corner.innerSide || "left", // Default to left for legacy corners
    badgeSide: corner.badgeSide || corner.innerSide || "left", // Default badge side to match inner side or left
  }));

  const trackData: TrackData = {
    id: legacyData.id,
    splinePath,
    spaces: legacyData.spaces || [],
    corners,
    metadata: legacyData.metadata || createDefaultMetadata(),
    discretizationSettings:
      legacyData.discretizationSettings ||
      createDefaultDiscretizationSettings(),
    validationErrors: [],
    isValid: false,
    lastValidated: new Date().toISOString(),
  };

  // Validate the converted data
  const validationErrors = validateTrackData(trackData);

  return {
    ...trackData,
    validationErrors,
    isValid: validationErrors.length === 0,
  };
}

/**
 * Create default metadata for legacy imports
 */
function createDefaultMetadata() {
  return {
    name: "Imported Track",
    laps: 3,
    startFinishSpaceIndex: 0,
    boardMetadata: {
      cornersPerLap: 0,
      spacesPerLap: 0,
      heatCardCount: 0,
      stressCardCount: 0,
      trackLength: 0,
      averageSpeed: 0,
      difficulty: 5,
      trackType: "road-course" as const,
      elevationChange: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: "1.0.0",
    author: "Unknown",
    description: "Imported track",
    tags: ["imported"],
  };
}

/**
 * Create default discretization settings for legacy imports
 */
function createDefaultDiscretizationSettings() {
  return {
    targetSpacesPerLap: 50,
    currentSpacesPerLap: 50,
    trackWidth: 100,
    spotCount: 5,
    raceLineOffset: 0,
    arcLengthSamples: 100,
    curvatureThreshold: 0.1,
  };
}

/**
 * Validate track data and return comprehensive validation result
 */
export function validateTrackDataComprehensive(
  trackData: TrackData,
): TrackValidationResult {
  const errors = validateTrackData(trackData);
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Generate warnings
  if (trackData.corners.length === 0) {
    warnings.push(
      "No corners defined - consider adding corners for gameplay variety",
    );
  }

  if (trackData.spaces.length < 20) {
    warnings.push(
      "Track has fewer than 20 spaces - consider increasing discretization",
    );
  }

  if (trackData.spaces.length > 100) {
    warnings.push(
      "Track has more than 100 spaces - consider reducing discretization",
    );
  }

  // Generate suggestions
  if (trackData.metadata.boardMetadata.difficulty < 3) {
    suggestions.push(
      "Track difficulty is low - consider adding more challenging corners",
    );
  }

  if (trackData.metadata.boardMetadata.difficulty > 8) {
    suggestions.push(
      "Track difficulty is high - consider adding more straight sections",
    );
  }

  // Geometry validation
  const geometryValidation = {
    isClosed: trackData.splinePath.closed,
    hasSelfIntersections: false, // Would be calculated by intersection detection
    minRadius: calculateMinRadius(trackData),
    maxRadius: calculateMaxRadius(trackData),
  };

  // Gameplay validation
  const gameplayValidation = {
    cornerPlacementValid: trackData.corners.every(
      (corner) => corner.spaceIndex < trackData.spaces.length,
    ),
    startFinishValid:
      trackData.metadata.startFinishSpaceIndex < trackData.spaces.length,
    spaceDistributionValid: trackData.spaces.length > 0,
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    geometryValidation,
    gameplayValidation,
  };
}

/**
 * Calculate minimum radius of the track
 */
function calculateMinRadius(trackData: TrackData): number {
  let minRadius = Infinity;

  for (const space of trackData.spaces) {
    if (space.metadata.curvature > 0) {
      const radius = 1 / space.metadata.curvature;
      minRadius = Math.min(minRadius, radius);
    }
  }

  return minRadius === Infinity ? 0 : minRadius;
}

/**
 * Calculate maximum radius of the track
 */
function calculateMaxRadius(trackData: TrackData): number {
  let maxRadius = 0;

  for (const space of trackData.spaces) {
    if (space.metadata.curvature > 0) {
      const radius = 1 / space.metadata.curvature;
      maxRadius = Math.max(maxRadius, radius);
    }
  }

  return maxRadius;
}

/**
 * Create a backup of track data
 */
export function createTrackBackup(trackData: TrackData): TrackExportData {
  return {
    version: "1.0.0",
    trackData: {
      ...trackData,
      id: `${trackData.id}_backup_${Date.now()}`,
    },
    exportMetadata: {
      exportedAt: new Date().toISOString(),
      exportedBy: "Heat Map Creator Backup",
      format: "heat-track",
      checksum: calculateChecksum(trackData),
    },
  };
}

/**
 * Restore track data from backup
 */
export function restoreTrackBackup(backup: TrackExportData): TrackData {
  return deserializeTrackData(backup);
}
