/* eslint-disable simple-import-sort/imports */
"use client";

import { Box } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useIndexedDBImage } from "@/hooks/useIndexedDB";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Corner, EditorState, Point, SplinePath, TrackData } from "@/types/spline";
import { createSplinePathFromSegments, pointsToBezierSegments } from "@/utils/bezierChain";
import { generateId, pointsToBezier, simplifyPath } from "@/utils/pathUtils";
import {
  createDefaultTrackMetadata,
  discretizePathToSpaces,
  updateTrackMetadata
} from "@/utils/trackUtils";

import { PathEditor } from "./PathEditor";
import { RaceTrack } from "./RaceTrack";
import { Toolbar } from "./Toolbar";

const STORAGE_KEY = "track-data";
const STORAGE_KEY_IMAGE = "background-image";

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
  
  // New editor state
  const [editorState, setEditorState] = useState<EditorState>({
    currentTrack: null,
    selectedCorner: null,
    selectedSpace: null,
    showSpaces: true,
    showCorners: true,
    showStartFinish: true,
    editingMode: 'spline',
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

  // Restore race segments from saved track data
  useEffect(() => {
    if (isLoaded && trackData?.discretizationSettings?.targetSpacesPerLap) {
      const savedSegments = trackData.discretizationSettings.targetSpacesPerLap;
      setRaceSegments(savedSegments);
    }
  }, [isLoaded, trackData?.discretizationSettings?.targetSpacesPerLap]);

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
    const simplified = simplifyPath(currentPath, 15);
    const bezierPoints = pointsToBezier(simplified);

    // Convert points to Bezier segments
    const bezierSegments = pointsToBezierSegments(bezierPoints, 'C1');

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
    setEditorState(prev => ({ ...prev, currentTrack: newTrackData }));
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
      setEditorState(prev => ({ ...prev, currentTrack: updatedTrackData }));
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
      setEditorState(prev => ({ ...prev, currentTrack: updatedTrackData }));
    },
    [trackData, setTrackData]
  );

  const handleClear = useCallback(() => {
    setTrackData(null);
    setEditorState(prev => ({ ...prev, currentTrack: null }));
    setSelectedPathId(null);
    setSelectedPointIndex(null);
  }, [setTrackData]);

  const handlePathClick = useCallback((pathId: string) => {
    setSelectedPathId(pathId);
    setSelectedPointIndex(null);
  }, []);

  const handlePointClick = useCallback((pathId: string, pointIndex: number) => {
    setSelectedPathId(pathId);
    setSelectedPointIndex(pointIndex);
  }, []);

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
  const handleRaceSegmentsChange = useCallback((newSegments: number) => {
    setRaceSegments(newSegments);
    
    if (trackData) {
      // Ensure we have Bezier segments - convert from points if needed
      let bezierSegments = trackData.splinePath.segments;
      if (!bezierSegments || bezierSegments.length === 0) {
        const points = trackData.splinePath.points || [];
        bezierSegments = pointsToBezierSegments(points, 'C1');
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
      setEditorState(prev => ({ ...prev, currentTrack: updatedTrackData }));
    }
  }, [trackData, setTrackData]);

  // Toggle visibility handlers
  const handleToggleSpaces = useCallback(() => {
    setEditorState(prev => ({ ...prev, showSpaces: !prev.showSpaces }));
  }, []);

  const handleToggleCorners = useCallback(() => {
    setEditorState(prev => ({ ...prev, showCorners: !prev.showCorners }));
  }, []);

  const handleToggleStartFinish = useCallback(() => {
    setEditorState(prev => ({ ...prev, showStartFinish: !prev.showStartFinish }));
  }, []);

  // Editing mode handler
  const handleEditingModeChange = useCallback((mode: 'spline' | 'corners' | 'metadata') => {
    setEditorState(prev => ({ ...prev, editingMode: mode, selectedCorner: null }));
    setSelectedPointIndex(null);
  }, []);

  // Metadata change handler
  const handleMetadataChange = useCallback((updatedMetadata: any) => {
    if (trackData) {
      const updatedTrackData = {
        ...trackData,
        metadata: updatedMetadata,
      };
      setTrackData(updatedTrackData);
      setEditorState(prev => ({ ...prev, currentTrack: updatedTrackData }));
    }
  }, [trackData, setTrackData]);

  // Helper function to calculate distance from point to line segment
  const distanceToLineSegment = useCallback((px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
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
  }, []);

  // Manual point editing handlers
  const handleAddPointAtCoords = useCallback((x: number, y: number) => {
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
        const distance = distanceToLineSegment(x, y, currentPoint.x, currentPoint.y, nextPoint.x, nextPoint.y);
        
        if (distance < minDistance) {
          minDistance = distance;
          bestInsertIndex = i + 1;
        }
      }
    }
    
    // Calculate handles for the new point based on neighbors
    const prevPoint = newPoints[bestInsertIndex - 1] || newPoints[newPoints.length - 1];
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
    setEditorState(prev => ({ ...prev, currentTrack: updatedTrackData }));
    
    // Select the newly added point
    setSelectedPointIndex(bestInsertIndex);
  }, [trackData, setTrackData, distanceToLineSegment]);

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
    setEditorState(prev => ({ ...prev, currentTrack: updatedTrackData }));
    
    // Clear selection
    setSelectedPointIndex(null);
  }, [trackData, setTrackData, selectedPointIndex]);

  // Handle space click for corner placement
  const handleSpaceClick = useCallback((spaceIndex: number) => {
    if (!trackData || editorState.editingMode !== 'corners') return;

    const existingCorner = trackData.corners.find(c => c.spaceIndex === spaceIndex);
    
    if (existingCorner) {
      // Select the corner for editing
      setEditorState(prev => ({ ...prev, selectedCorner: existingCorner.id }));
    } else {
      // Add new corner
      const space = trackData.spaces.find(s => s.index === spaceIndex);
      if (!space) return;

      const newCorner: Corner = {
        id: generateId(),
        spaceIndex,
        speedLimit: 5, // Default speed limit
        position: space.position,
        isAutoSuggested: false,
        innerSide: 'left', // Default inner side
        cornerType: 'medium',
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
      setEditorState(prev => ({ 
        ...prev, 
        currentTrack: updatedTrackData,
        selectedCorner: newCorner.id 
      }));
    }
  }, [trackData, editorState.editingMode, setTrackData]);

  // Remove selected corner
  const handleRemoveCorner = useCallback(() => {
    if (!trackData || !editorState.selectedCorner) return;

    const updatedTrackData = {
      ...trackData,
      corners: trackData.corners.filter(c => c.id !== editorState.selectedCorner),
    };

    setTrackData(updatedTrackData);
    setEditorState(prev => ({ 
      ...prev, 
      currentTrack: updatedTrackData,
      selectedCorner: null 
    }));
  }, [trackData, editorState.selectedCorner, setTrackData]);

  // Update selected corner properties
  const handleUpdateCorner = useCallback((updates: Partial<Corner>) => {
    if (!trackData || !editorState.selectedCorner) return;

    const updatedTrackData = {
      ...trackData,
      corners: trackData.corners.map(c => 
        c.id === editorState.selectedCorner ? { ...c, ...updates } : c
      ),
    };

    setTrackData(updatedTrackData);
    setEditorState(prev => ({ ...prev, currentTrack: updatedTrackData }));
  }, [trackData, editorState.selectedCorner, setTrackData]);

  // Handle start/finish line placement
  const handleStartFinishClick = useCallback((spaceIndex: number) => {
    if (!trackData || editorState.editingMode !== 'metadata') return;

    const updatedTrackData = {
      ...trackData,
      metadata: {
        ...trackData.metadata,
        startFinishSpaceIndex: spaceIndex,
      },
    };

    setTrackData(updatedTrackData);
    setEditorState(prev => ({ ...prev, currentTrack: updatedTrackData }));
  }, [trackData, editorState.editingMode, setTrackData]);

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
        style={{ cursor: isDrawing ? "crosshair" : "default" }}
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
            opacity={0.7}
            preserveAspectRatio="xMidYMid meet"
            style={{ pointerEvents: "none" }}
            width={dimensions.width}
          />
        )}

        {/* Render race track */}
        {isLoaded && trackData && (
          <RaceTrack
            key={`track-${trackData.id}`}
            closed={trackData.splinePath.closed}
            corners={trackData.corners}
            editingMode={editorState.editingMode}
            points={trackData.splinePath.points || []}
            segments={raceSegments}
            selectedCorner={editorState.selectedCorner}
            showCorners={editorState.showCorners}
            showSpaces={editorState.showSpaces}
            showStartFinish={editorState.showStartFinish}
            spaces={trackData.spaces}
            startFinishSpaceIndex={trackData.metadata.startFinishSpaceIndex}
            onSpaceClick={handleSpaceClick}
            onStartFinishClick={handleStartFinishClick}
          />
        )}

        {/* Render spline path editor - only in spline mode */}
        {isLoaded && trackData && editorState.editingMode === 'spline' && (
          <PathEditor
            key={trackData.splinePath.id}
            closed={trackData.splinePath.closed}
            color={trackData.splinePath.color}
            isSelected={selectedPathId === trackData.splinePath.id}
            points={trackData.splinePath.points || []}
            selectedPointIndex={
              selectedPathId === trackData.splinePath.id ? selectedPointIndex : null
            }
            strokeWidth={trackData.splinePath.strokeWidth}
            onHandleDrag={(index, type, x, y) =>
              handleHandleDrag(trackData.splinePath.id, index, type, x, y)
            }
            onPathClick={() => handlePathClick(trackData.splinePath.id)}
            onPathClickWithCoords={handleAddPointAtCoords}
            onPointClick={(index) => handlePointClick(trackData.splinePath.id, index)}
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
        editingMode={editorState.editingMode}
        hasImage={!!backgroundImage}
        raceSegments={raceSegments}
        selectedCorner={trackData?.corners.find(c => c.id === editorState.selectedCorner)}
        selectedPointIndex={selectedPointIndex}
        showCorners={editorState.showCorners}
        showSpaces={editorState.showSpaces}
        showStartFinish={editorState.showStartFinish}
        trackMetadata={trackData?.metadata}
        onClear={handleClear}
        onCornerRemove={handleRemoveCorner}
        onCornerUpdate={handleUpdateCorner}
        onEditingModeChange={handleEditingModeChange}
        onImageRemove={handleImageRemove}
        onImageUpload={handleImageUpload}
        onMetadataChange={handleMetadataChange}
        onRaceSegmentsChange={handleRaceSegmentsChange}
        onRemoveSelectedPoint={handleRemoveSelectedPoint}
        onToggleCorners={handleToggleCorners}
        onToggleSpaces={handleToggleSpaces}
        onToggleStartFinish={handleToggleStartFinish}
      />
    </Box>
  );
}
