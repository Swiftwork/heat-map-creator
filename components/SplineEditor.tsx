/* eslint-disable simple-import-sort/imports */
"use client";

import { Box } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useIndexedDBImage } from "@/hooks/useIndexedDB";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  Corner,
  EditorState,
  Point,
  SplinePath,
  TrackData,
} from "@/types/spline";
import {
  createSplinePathFromSegments,
  pointsToBezierSegments,
} from "@/utils/bezierChain";
import { generateId, pointsToBezier, simplifyPath } from "@/utils/pathUtils";
import {
  createDefaultTrackMetadata,
  discretizePathToSpaces,
  updateTrackMetadata,
} from "@/utils/trackUtils";

import { PathEditor } from "./PathEditor";
import { RaceTrack } from "./RaceTrack";
import { Toolbar } from "./Toolbar";

const STORAGE_KEY = "track-data";
const STORAGE_KEY_IMAGE = "background-image";
const SPLINE_SIMPLIFICATION_TOLERANCE = 50;

export function SplineEditor() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [trackData, setTrackData, isLoaded] = useLocalStorage<TrackData | null>(
    STORAGE_KEY,
    null
  );
  const [
    backgroundImage,
    updateBackgroundImage,
    removeBackgroundImage,
    isImageLoaded,
  ] = useIndexedDBImage(STORAGE_KEY_IMAGE);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(
    null
  );
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [raceSegments, setRaceSegments] = useState(100);
  const [scale, setScale] = useState(100);
  const [trackColor, setTrackColor, _isTrackColorLoaded] = useLocalStorage(
    "track-appearance-color",
    "#3a3a3a"
  );
  const [countdownTextColor, setCountdownTextColor, _isCountdownColorLoaded] =
    useLocalStorage("track-appearance-countdown-text-color", "#ffd700");
  const [showTrack, setShowTrack, _isShowTrackLoaded] = useLocalStorage(
    "track-display-show-track",
    true
  );

  // New editor state
  const [editorState, setEditorState] = useState<EditorState>({
    currentTrack: null,
    selectedCorner: null,
    selectedSpace: null,
    debugMode: false,
    editingMode: "spline",
    splineToolMode: "select",
    cornerToolMode: "select",
  });

  // Update dimensions on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      // Measure toolbar height
      const toolbar = document.querySelector('[data-toolbar="true"]');
      const tbHeight = toolbar?.getBoundingClientRect().height || 0;
      setToolbarHeight(tbHeight);

      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - tbHeight,
      });
    };

    updateDimensions();
    // Small delay to ensure toolbar is rendered
    const timer = setTimeout(updateDimensions, 100);

    window.addEventListener("resize", updateDimensions);
    return () => {
      window.removeEventListener("resize", updateDimensions);
      clearTimeout(timer);
    };
  }, []);

  // Restore race segments, track width, and editor state from saved track data
  useEffect(() => {
    if (isLoaded && trackData) {
      // Migrate legacy tracks that don't have raceDirection
      let migratedTrackData = trackData;
      if (trackData.metadata.raceDirection === undefined) {
        migratedTrackData = {
          ...trackData,
          metadata: {
            ...trackData.metadata,
            raceDirection: true, // Default to clockwise
          },
        };
        setTrackData(migratedTrackData);
      }

      // Restore discretization settings
      const { discretizationSettings } = migratedTrackData;
      if (discretizationSettings) {
        const savedSegments = discretizationSettings.targetSpacesPerLap;
        const savedScale = discretizationSettings.trackWidth; // trackWidth now represents scale %
        if (savedSegments) setRaceSegments(savedSegments);
        if (savedScale) setScale(savedScale);
      }

      // Initialize editor state with saved track data while preserving current mode
      setEditorState((prev) => ({
        ...prev,
        currentTrack: migratedTrackData,
        debugMode: prev.debugMode ?? false,
      }));

      // Select the spline path if it exists and we're in spline mode
      if (migratedTrackData.splinePath) {
        setSelectedPathId((prev) => prev ?? migratedTrackData.splinePath.id);
      }
    }
  }, [isLoaded, trackData, setTrackData]);

  const getSvgPoint = useCallback((clientX: number, clientY: number): Point => {
    if (!svgRef.current) return { x: clientX, y: clientY };

    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    return { x: svgP.x, y: svgP.y };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0) return; // Only left click

      // Prevent drawing if a track already exists
      if (trackData) return;

      const point = getSvgPoint(e.clientX, e.clientY);
      setIsDrawing(true);
      setCurrentPath([point]);
      setSelectedPathId(null);
      setSelectedPointIndex(null);
    },
    [getSvgPoint, trackData]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isDrawing) return;

      const point = getSvgPoint(e.clientX, e.clientY);
      setCurrentPath((prev) => [...prev, point]);
    },
    [isDrawing, getSvgPoint]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || currentPath.length < 3) {
      setIsDrawing(false);
      setCurrentPath([]);
      return;
    }

    // Simplify and convert to bezier (higher tolerance = fewer points)
    const simplified = simplifyPath(
      currentPath,
      SPLINE_SIMPLIFICATION_TOLERANCE
    );
    const bezierPoints = pointsToBezier(simplified);

    // Convert points to Bezier segments
    const bezierSegments = pointsToBezierSegments(bezierPoints, "C1");

    // Create new spline path with segments
    const splinePath: SplinePath = createSplinePathFromSegments(
      bezierSegments,
      "#3182ce",
      3,
      true
    );

    // Discretize path into spaces using segments
    const spaces = discretizePathToSpaces(bezierSegments, raceSegments);

    // Start with empty corners - user can add them manually
    const corners: any[] = [];

    // Create complete track data
    const newTrackData: TrackData = {
      id: generateId(),
      splinePath,
      spaces,
      corners,
      metadata: createDefaultTrackMetadata(),
      discretizationSettings: {
        targetSpacesPerLap: raceSegments,
        currentSpacesPerLap: raceSegments,
        trackWidth: 100,
        spotCount: 5,
        raceLineOffset: 0,
        arcLengthSamples: 100,
        curvatureThreshold: 0.1,
      },
      validationErrors: [],
      isValid: false,
      lastValidated: new Date().toISOString(),
    };

    // Update metadata with actual counts and calculated values
    const updatedMetadata = updateTrackMetadata(
      newTrackData.metadata,
      spaces,
      corners,
      0 // Total length would be calculated from segments
    );

    newTrackData.metadata = updatedMetadata;

    setTrackData(newTrackData);
    setEditorState((prev) => ({ ...prev, currentTrack: newTrackData }));
    setIsDrawing(false);
    setCurrentPath([]);
    setSelectedPathId(splinePath.id);
  }, [isDrawing, currentPath, setTrackData, raceSegments]);

  const handlePointDrag = useCallback(
    (pathId: string, pointIndex: number, x: number, y: number) => {
      if (!trackData) return;

      // Use legacy points array for compatibility with existing PathEditor
      const points = trackData.splinePath.points || [];
      const newPoints = [...points];
      const point = newPoints[pointIndex];

      if (!point) return;

      // Calculate delta
      const dx = x - point.x;
      const dy = y - point.y;

      // Move point and handles together
      newPoints[pointIndex] = {
        x,
        y,
        handleIn: point.handleIn
          ? {
              x: point.handleIn.x + dx,
              y: point.handleIn.y + dy,
            }
          : undefined,
        handleOut: point.handleOut
          ? {
              x: point.handleOut.x + dx,
              y: point.handleOut.y + dy,
            }
          : undefined,
      };

      // Update track data with new points
      const updatedTrackData = {
        ...trackData,
        splinePath: {
          ...trackData.splinePath,
          points: newPoints,
        },
      };

      setTrackData(updatedTrackData);
      setEditorState((prev) => ({ ...prev, currentTrack: updatedTrackData }));
    },
    [trackData, setTrackData]
  );

  const handleHandleDrag = useCallback(
    (
      pathId: string,
      pointIndex: number,
      type: "in" | "out",
      x: number,
      y: number
    ) => {
      if (!trackData) return;

      // Use legacy points array for compatibility with existing PathEditor
      const points = trackData.splinePath.points || [];
      const newPoints = [...points];
      const point = newPoints[pointIndex];

      if (!point) return;

      // Mirror the opposite handle to keep them in sync
      if (type === "in") {
        // Calculate mirrored handleOut position
        const mirroredOutX = 2 * point.x - x;
        const mirroredOutY = 2 * point.y - y;

        newPoints[pointIndex] = {
          x: point.x,
          y: point.y,
          handleIn: { x, y },
          handleOut: { x: mirroredOutX, y: mirroredOutY },
        };
      } else {
        // Calculate mirrored handleIn position
        const mirroredInX = 2 * point.x - x;
        const mirroredInY = 2 * point.y - y;

        newPoints[pointIndex] = {
          x: point.x,
          y: point.y,
          handleIn: { x: mirroredInX, y: mirroredInY },
          handleOut: { x, y },
        };
      }

      // Update track data with new points
      const updatedTrackData = {
        ...trackData,
        splinePath: {
          ...trackData.splinePath,
          points: newPoints,
        },
      };

      setTrackData(updatedTrackData);
      setEditorState((prev) => ({ ...prev, currentTrack: updatedTrackData }));
    },
    [trackData, setTrackData]
  );

  const handleClear = useCallback(() => {
    setTrackData(null);
    setEditorState((prev) => ({ ...prev, currentTrack: null }));
    setSelectedPathId(null);
    setSelectedPointIndex(null);
  }, [setTrackData]);

  const handlePathClick = useCallback((pathId: string) => {
    setSelectedPathId(pathId);
    setSelectedPointIndex(null);
  }, []);

  const handlePointClick = useCallback(
    (pathId: string, pointIndex: number) => {
      // In remove mode, remove the point immediately
      if (editorState.splineToolMode === "remove" && trackData) {
        const points = trackData.splinePath.points || [];
        if (points.length <= 3) return; // Don't allow removing if only 3 points left

        const newPoints = [...points];
        newPoints.splice(pointIndex, 1);

        const updatedTrackData = {
          ...trackData,
          splinePath: {
            ...trackData.splinePath,
            points: newPoints,
          },
        };

        setTrackData(updatedTrackData);
        setEditorState((prev) => ({ ...prev, currentTrack: updatedTrackData }));
        return;
      }

      // In select mode, select the point
      setSelectedPathId(pathId);
      setSelectedPointIndex(pointIndex);
    },
    [editorState.splineToolMode, trackData, setTrackData]
  );

  const handleImageUpload = useCallback(
    (imageUrl: string) => {
      updateBackgroundImage(imageUrl);
    },
    [updateBackgroundImage]
  );

  const handleImageRemove = useCallback(() => {
    removeBackgroundImage();
  }, [removeBackgroundImage]);

  // Update race segments and regenerate spaces
  const handleRaceSegmentsChange = useCallback(
    (newSegments: number) => {
      setRaceSegments(newSegments);

      if (trackData) {
        // Ensure we have Bezier segments - convert from points if needed
        let bezierSegments = trackData.splinePath.segments;
        if (!bezierSegments || bezierSegments.length === 0) {
          const points = trackData.splinePath.points || [];
          bezierSegments = pointsToBezierSegments(points, "C1");
        }

        // Regenerate spaces with new segment count using segments
        const newSpaces = discretizePathToSpaces(bezierSegments, newSegments);

        const updatedTrackData = {
          ...trackData,
          spaces: newSpaces,
          corners: [], // Keep corners empty - user manages them manually
          discretizationSettings: {
            ...trackData.discretizationSettings,
            targetSpacesPerLap: newSegments,
            currentSpacesPerLap: newSegments,
          },
        };

        // Update metadata with calculated values
        const updatedMetadata = updateTrackMetadata(
          updatedTrackData.metadata,
          newSpaces,
          [],
          0 // Total length would be calculated from segments
        );

        updatedTrackData.metadata = updatedMetadata;

        setTrackData(updatedTrackData);
        setEditorState((prev) => ({ ...prev, currentTrack: updatedTrackData }));
      }
    },
    [trackData, setTrackData]
  );

  // Update scale
  const handleScaleChange = useCallback(
    (newScale: number) => {
      setScale(newScale);

      if (trackData) {
        const updatedTrackData = {
          ...trackData,
          discretizationSettings: {
            ...trackData.discretizationSettings,
            trackWidth: newScale, // trackWidth now represents scale %
          },
        };

        setTrackData(updatedTrackData);
        setEditorState((prev) => ({ ...prev, currentTrack: updatedTrackData }));
      }
    },
    [trackData, setTrackData]
  );

  // Toggle visibility handlers
  const handleDebugMode = useCallback(() => {
    setEditorState((prev) => ({ ...prev, debugMode: !prev.debugMode }));
  }, []);

  const handleToggleTrack = useCallback(() => {
    setShowTrack((prev) => !prev);
  }, [setShowTrack]);

  // Editing mode handler
  const handleEditingModeChange = useCallback(
    (mode: "spline" | "corners" | "metadata" | "appearance") => {
      setEditorState((prev) => ({
        ...prev,
        editingMode: mode,
        selectedCorner: null,
      }));
      setSelectedPointIndex(null);
    },
    []
  );

  // Spline tool mode handler
  const handleSplineToolModeChange = useCallback(
    (mode: "select" | "add" | "remove") => {
      setEditorState((prev) => ({
        ...prev,
        splineToolMode: mode,
      }));
      // Clear selection when switching modes
      if (mode !== "select") {
        setSelectedPointIndex(null);
      }
    },
    []
  );

  // Corner tool mode handler
  const handleCornerToolModeChange = useCallback(
    (mode: "select" | "add" | "remove") => {
      setEditorState((prev) => ({
        ...prev,
        cornerToolMode: mode,
        selectedCorner: mode !== "select" ? null : prev.selectedCorner,
      }));
    },
    []
  );

  // Metadata change handler
  const handleMetadataChange = useCallback(
    (updatedMetadata: any) => {
      if (trackData) {
        const updatedTrackData = {
          ...trackData,
          metadata: updatedMetadata,
        };
        setTrackData(updatedTrackData);
        setEditorState((prev) => ({ ...prev, currentTrack: updatedTrackData }));
      }
    },
    [trackData, setTrackData]
  );

  // Helper function to calculate distance from point to line segment
  const distanceToLineSegment = useCallback(
    (
      px: number,
      py: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number
    ): number => {
      const A = px - x1;
      const B = py - y1;
      const C = x2 - x1;
      const D = y2 - y1;

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;
      if (lenSq !== 0) param = dot / lenSq;

      let xx, yy;

      if (param < 0) {
        xx = x1;
        yy = y1;
      } else if (param > 1) {
        xx = x2;
        yy = y2;
      } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
      }

      const dx = px - xx;
      const dy = py - yy;
      return Math.sqrt(dx * dx + dy * dy);
    },
    []
  );

  // Manual point editing handlers
  const handleAddPointAtCoords = useCallback(
    (x: number, y: number) => {
      if (!trackData) return;

      // Use legacy points array for compatibility with existing PathEditor
      const points = trackData.splinePath.points || [];
      const newPoints = [...points];

      // Find the best place to insert the point by finding the closest segment
      let bestInsertIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < newPoints.length; i++) {
        const currentPoint = newPoints[i];
        const nextPoint = newPoints[(i + 1) % newPoints.length];

        if (currentPoint && nextPoint) {
          // Calculate distance from click point to line segment
          const distance = distanceToLineSegment(
            x,
            y,
            currentPoint.x,
            currentPoint.y,
            nextPoint.x,
            nextPoint.y
          );

          if (distance < minDistance) {
            minDistance = distance;
            bestInsertIndex = i + 1;
          }
        }
      }

      // Calculate handles for the new point based on neighbors
      const prevPoint =
        newPoints[bestInsertIndex - 1] || newPoints[newPoints.length - 1];
      const nextPoint = newPoints[bestInsertIndex % newPoints.length];

      let handleIn = { x, y };
      let handleOut = { x, y };

      if (prevPoint && nextPoint) {
        // Calculate tangent based on neighbors
        const tangentX = (nextPoint.x - prevPoint.x) * 0.25;
        const tangentY = (nextPoint.y - prevPoint.y) * 0.25;

        handleIn = { x: x - tangentX, y: y - tangentY };
        handleOut = { x: x + tangentX, y: y + tangentY };
      }

      // Insert the new point with handles
      const newPoint = {
        x,
        y,
        handleIn,
        handleOut,
      };

      newPoints.splice(bestInsertIndex, 0, newPoint);

      const updatedTrackData = {
        ...trackData,
        splinePath: {
          ...trackData.splinePath,
          points: newPoints,
        },
      };

      setTrackData(updatedTrackData);
      setEditorState((prev) => ({ ...prev, currentTrack: updatedTrackData }));

      // Select the newly added point
      setSelectedPointIndex(bestInsertIndex);
    },
    [trackData, setTrackData, distanceToLineSegment]
  );

  const handleRemoveSelectedPoint = useCallback(() => {
    // Use legacy points array for compatibility with existing PathEditor
    const points = trackData?.splinePath.points || [];
    if (!trackData || points.length <= 3 || selectedPointIndex === null) return;

    const newPoints = [...points];
    newPoints.splice(selectedPointIndex, 1);

    const updatedTrackData = {
      ...trackData,
      splinePath: {
        ...trackData.splinePath,
        points: newPoints,
      },
    };

    setTrackData(updatedTrackData);
    setEditorState((prev) => ({ ...prev, currentTrack: updatedTrackData }));

    // Clear selection
    setSelectedPointIndex(null);
  }, [trackData, setTrackData, selectedPointIndex]);

  // Helper function to find nearest space to a point
  const findNearestSpace = useCallback(
    (x: number, y: number): number | null => {
      if (!trackData) return null;

      let nearestSpaceIndex: number | null = null;
      let minDistance = Infinity;

      trackData.spaces.forEach((space) => {
        const dx = space.position.x - x;
        const dy = space.position.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
          nearestSpaceIndex = space.index;
        }
      });


      // Debug print: log coordinates, final nearest index, and nearest space coordinates
      let nearestSpaceCoords = null;
      if (nearestSpaceIndex !== null) {
        const nearestSpace = trackData.spaces.find(s => s.index === nearestSpaceIndex);
        if (nearestSpace) {
          nearestSpaceCoords = nearestSpace.position;
        }
      }
      console.debug(
        `[findNearestSpace] Input: x=${x}, y=${y} | Nearest space index: ${nearestSpaceIndex}` +
        (nearestSpaceCoords ? ` | Nearest space coords: x=${nearestSpaceCoords.x}, y=${nearestSpaceCoords.y}` : "")
      );

      return nearestSpaceIndex;
    },
    [trackData]
  );

  // Handle clicking on track space to add corner directly at space index
  const handleAddCornerAtSpace = useCallback(
    (spaceIndex: number) => {
      if (!trackData) return;

      // Check if corner already exists at this space
      const existingCorner = trackData.corners.find(
        (c) => c.spaceIndex === spaceIndex
      );
      if (existingCorner) return; // Don't allow adding if corner already exists

      const space = trackData.spaces.find((s) => s.index === spaceIndex);
      if (!space) return;

      // Debug print: log space index and position
      console.log(`[handleAddCornerAtSpace] Adding corner at space index: ${spaceIndex}`);

      const newCorner: Corner = {
        id: generateId(),
        spaceIndex: spaceIndex,
        speedLimit: 5, // Default speed limit
        position: space.position,
        isAutoSuggested: false,
        innerSide: trackData.metadata.raceDirection ? "left" : "right", // Set based on race direction (true = clockwise = left)
        badgeSide: trackData.metadata.raceDirection ? "left" : "right", // Default badge side to match inner side
        cornerType: "medium",
        difficulty: 5,
        suggestedGear: 3,
        heatPenalty: 0,
        entryAngle: 0,
        exitAngle: 0,
        radius: 0,
      };

      const updatedTrackData = {
        ...trackData,
        corners: [...trackData.corners, newCorner],
      };

      setTrackData(updatedTrackData);
      setEditorState((prev) => ({
        ...prev,
        currentTrack: updatedTrackData,
        selectedCorner: newCorner.id,
      }));
    },
    [trackData, setTrackData]
  );

  // Handle clicking on track to add corner at nearest space (legacy - kept for backward compatibility)
  const handleAddCornerAtCoords = useCallback(
    (x: number, y: number) => {
      if (!trackData) return;

      const nearestSpaceIndex = findNearestSpace(x, y);
      if (nearestSpaceIndex === null) return;

      // Use the new space-based handler
      handleAddCornerAtSpace(nearestSpaceIndex);
    },
    [trackData, findNearestSpace, handleAddCornerAtSpace]
  );

  // Handle corner badge click for selection/removal
  const handleCornerClick = useCallback(
    (cornerId: string) => {
      if (!trackData || editorState.editingMode !== "corners") return;

      // In remove mode, remove the corner immediately
      if (editorState.cornerToolMode === "remove") {
        const updatedTrackData = {
          ...trackData,
          corners: trackData.corners.filter((c) => c.id !== cornerId),
        };

        setTrackData(updatedTrackData);
        setEditorState((prev) => ({
          ...prev,
          currentTrack: updatedTrackData,
          selectedCorner: null,
        }));
        return;
      }

      // In select mode, select the corner
      if (editorState.cornerToolMode === "select") {
        setEditorState((prev) => ({
          ...prev,
          selectedCorner: cornerId,
        }));
      }
    },
    [
      trackData,
      editorState.editingMode,
      editorState.cornerToolMode,
      setTrackData,
    ]
  );

  // Handle space click (legacy - for backward compatibility if needed)
  const handleSpaceClick = useCallback(
    (_spaceIndex: number) => {
      if (!trackData || editorState.editingMode !== "corners") return;
      // This is now only used for non-corner interactions if any
    },
    [trackData, editorState.editingMode]
  );

  // Update selected corner properties
  const handleUpdateCorner = useCallback(
    (updates: Partial<Corner>) => {
      if (!trackData || !editorState.selectedCorner) return;

      const updatedTrackData = {
        ...trackData,
        corners: trackData.corners.map((c) =>
          c.id === editorState.selectedCorner ? { ...c, ...updates } : c
        ),
      };

      setTrackData(updatedTrackData);
      setEditorState((prev) => ({ ...prev, currentTrack: updatedTrackData }));
    },
    [trackData, editorState.selectedCorner, setTrackData]
  );

  // Move selected corner backward on the track
  const handleMoveCornerBackward = useCallback(() => {
    if (!trackData || !editorState.selectedCorner) return;

    const selectedCorner = trackData.corners.find(
      (c) => c.id === editorState.selectedCorner
    );
    if (!selectedCorner) return;

    // Find the previous space index (wrap around if necessary)
    const totalSpaces = trackData.spaces.length;
    const currentSpaceIndex = selectedCorner.spaceIndex;
    let newSpaceIndex = currentSpaceIndex - 1;

    if (newSpaceIndex < 0) {
      newSpaceIndex = totalSpaces - 1;
    }

    // Check if there's already a corner at the target space
    const existingCorner = trackData.corners.find(
      (c) => c.spaceIndex === newSpaceIndex && c.id !== selectedCorner.id
    );
    if (existingCorner) return; // Don't move if target space is occupied

    // Find the new position from spaces
    const newSpace = trackData.spaces.find((s) => s.index === newSpaceIndex);
    if (!newSpace) return;

    const updatedTrackData = {
      ...trackData,
      corners: trackData.corners.map((c) =>
        c.id === editorState.selectedCorner
          ? { ...c, spaceIndex: newSpaceIndex, position: newSpace.position }
          : c
      ),
    };

    setTrackData(updatedTrackData);
    setEditorState((prev) => ({ ...prev, currentTrack: updatedTrackData }));
  }, [trackData, editorState.selectedCorner, setTrackData]);

  // Move selected corner forward on the track
  const handleMoveCornerForward = useCallback(() => {
    if (!trackData || !editorState.selectedCorner) return;

    const selectedCorner = trackData.corners.find(
      (c) => c.id === editorState.selectedCorner
    );
    if (!selectedCorner) return;

    // Find the next space index (wrap around if necessary)
    const totalSpaces = trackData.spaces.length;
    const currentSpaceIndex = selectedCorner.spaceIndex;
    let newSpaceIndex = currentSpaceIndex + 1;

    if (newSpaceIndex >= totalSpaces) {
      newSpaceIndex = 0;
    }

    // Check if there's already a corner at the target space
    const existingCorner = trackData.corners.find(
      (c) => c.spaceIndex === newSpaceIndex && c.id !== selectedCorner.id
    );
    if (existingCorner) return; // Don't move if target space is occupied

    // Find the new position from spaces
    const newSpace = trackData.spaces.find((s) => s.index === newSpaceIndex);
    if (!newSpace) return;

    const updatedTrackData = {
      ...trackData,
      corners: trackData.corners.map((c) =>
        c.id === editorState.selectedCorner
          ? { ...c, spaceIndex: newSpaceIndex, position: newSpace.position }
          : c
      ),
    };

    setTrackData(updatedTrackData);
    setEditorState((prev) => ({ ...prev, currentTrack: updatedTrackData }));
  }, [trackData, editorState.selectedCorner, setTrackData]);

  // Handle start/finish line placement
  const handleStartFinishClick = useCallback(
    (spaceIndex: number) => {
      if (!trackData || editorState.editingMode !== "metadata") return;

      // Debug print: log space index for start/finish line placement
      console.log(`[handleStartFinishClick] Setting start/finish line at space index: ${spaceIndex}`);

      const updatedTrackData = {
        ...trackData,
        metadata: {
          ...trackData.metadata,
          startFinishSpaceIndex: spaceIndex,
        },
      };

      setTrackData(updatedTrackData);
      setEditorState((prev) => ({ ...prev, currentTrack: updatedTrackData }));
    },
    [trackData, editorState.editingMode, setTrackData]
  );

  // Generate SVG path string for current drawing
  const currentPathString =
    currentPath.length > 1
      ? `M ${currentPath.map((p) => `${p.x} ${p.y}`).join(" L ")}`
      : "";

  return (
    <Box
      bottom={0}
      left={0}
      overflow="hidden"
      position="fixed"
      right={0}
      top={`${toolbarHeight}px`}
    >
      <svg
        ref={svgRef}
        height={dimensions.height}
        style={{
          cursor: isDrawing ? "crosshair" : "default",
          userSelect: "none",
        }}
        width={dimensions.width}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Background image */}
        {isImageLoaded && backgroundImage && (
          <image
            height={dimensions.height}
            href={backgroundImage}
            preserveAspectRatio="xMidYMid meet"
            style={{ pointerEvents: "none" }}
            width={dimensions.width}
          />
        )}

        {/* Render race track */}
        {isLoaded && trackData && showTrack && (
          <RaceTrack
            key={`track-${trackData.id}`}
            closed={trackData.splinePath.closed}
            corners={trackData.corners}
            cornerToolMode={editorState.cornerToolMode}
            countdownTextColor={countdownTextColor}
            debugMode={editorState.debugMode}
            editingMode={editorState.editingMode}
            points={trackData.splinePath.points || []}
            raceDirection={trackData.metadata.raceDirection}
            scale={trackData.discretizationSettings.trackWidth}
            segments={raceSegments}
            selectedCorner={editorState.selectedCorner}
            spaces={trackData.spaces}
            startFinishSpaceIndex={trackData.metadata.startFinishSpaceIndex}
            trackColor={trackColor}
            onCornerClick={handleCornerClick}
            onCornerSpaceClick={handleAddCornerAtSpace}
            onSpaceClick={handleSpaceClick}
            onStartFinishClick={handleStartFinishClick}
            onTrackClickWithCoords={handleAddCornerAtCoords}
          />
        )}

        {/* Render spline path editor - only in spline mode */}
        {isLoaded && trackData && editorState.editingMode === "spline" && (
          <PathEditor
            key={trackData.splinePath.id}
            closed={trackData.splinePath.closed}
            color={trackData.splinePath.color}
            isSelected={selectedPathId === trackData.splinePath.id}
            points={trackData.splinePath.points || []}
            selectedPointIndex={
              selectedPathId === trackData.splinePath.id
                ? selectedPointIndex
                : null
            }
            strokeWidth={trackData.splinePath.strokeWidth}
            toolMode={editorState.splineToolMode}
            onHandleDrag={(index, type, x, y) =>
              handleHandleDrag(trackData.splinePath.id, index, type, x, y)
            }
            onPathClick={() => handlePathClick(trackData.splinePath.id)}
            onPathClickWithCoords={handleAddPointAtCoords}
            onPointClick={(index) =>
              handlePointClick(trackData.splinePath.id, index)
            }
            onPointDrag={(index, x, y) =>
              handlePointDrag(trackData.splinePath.id, index, x, y)
            }
          />
        )}

        {/* Render current drawing path TODO*/}
        {isDrawing && currentPath.length > 1 && (
          <path
            d={currentPathString}
            fill="none"
            opacity={0.6}
            stroke="#3182ce"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
          />
        )}
      </svg>

      <Toolbar
        _onRemoveSelectedPoint={handleRemoveSelectedPoint}
        _selectedPointIndex={selectedPointIndex}
        cornerToolMode={editorState.cornerToolMode}
        countdownTextColor={countdownTextColor}
        debugMode={editorState.debugMode}
        editingMode={editorState.editingMode}
        hasImage={!!backgroundImage}
        raceSegments={raceSegments}
        scale={scale}
        selectedCorner={trackData?.corners.find(
          (c) => c.id === editorState.selectedCorner
        )}
        showTrack={showTrack}
        splineToolMode={editorState.splineToolMode}
        trackColor={trackColor}
        trackMetadata={trackData?.metadata}
        onClear={handleClear}
        onCornerMoveBackward={handleMoveCornerBackward}
        onCornerMoveForward={handleMoveCornerForward}
        onCornerToolModeChange={handleCornerToolModeChange}
        onCornerUpdate={handleUpdateCorner}
        onCountdownTextColorChange={setCountdownTextColor}
        onEditingModeChange={handleEditingModeChange}
        onImageRemove={handleImageRemove}
        onImageUpload={handleImageUpload}
        onMetadataChange={handleMetadataChange}
        onRaceSegmentsChange={handleRaceSegmentsChange}
        onScaleChange={handleScaleChange}
        onSplineToolModeChange={handleSplineToolModeChange}
        onToggleDebug={handleDebugMode}
        onToggleTrack={handleToggleTrack}
        onTrackColorChange={setTrackColor}
      />
    </Box>
  );
}
