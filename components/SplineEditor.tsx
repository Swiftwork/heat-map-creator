"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";

import { useIndexedDBImage } from "@/hooks/useIndexedDB";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Point, SplinePath } from "@/types/spline";
import { generateId, pointsToBezier, simplifyPath } from "@/utils/pathUtils";

import { PathEditor } from "./PathEditor";
import { RaceTrack } from "./RaceTrack";
import { Toolbar } from "./Toolbar";

const STORAGE_KEY = "spline-editor-paths";
const STORAGE_KEY_IMAGE = "background-image";

export function SplineEditor() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [paths, setPaths, isLoaded] = useLocalStorage<SplinePath[]>(
    STORAGE_KEY,
    []
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
  const [raceSegments, setRaceSegments] = useState(100);

  // Update dimensions on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

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

      // Prevent drawing if a path already exists
      if (paths.length > 0) return;

      const point = getSvgPoint(e.clientX, e.clientY);
      setIsDrawing(true);
      setCurrentPath([point]);
      setSelectedPathId(null);
      setSelectedPointIndex(null);
    },
    [getSvgPoint, paths.length]
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

    // Create new path (only one path allowed)
    const newPath: SplinePath = {
      id: generateId(),
      points: bezierPoints,
      color: "#3182ce",
      strokeWidth: 3,
      closed: true,
    };

    setPaths([newPath]);
    setIsDrawing(false);
    setCurrentPath([]);
    setSelectedPathId(newPath.id);
  }, [isDrawing, currentPath, setPaths]);

  const handlePointDrag = useCallback(
    (pathId: string, pointIndex: number, x: number, y: number) => {
      const newPaths = paths.map((path) => {
        if (path.id !== pathId) return path;

        const newPoints = [...path.points];
        const point = newPoints[pointIndex];

        if (!point) return path;

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

        return { ...path, points: newPoints };
      });

      setPaths(newPaths);
    },
    [paths, setPaths]
  );

  const handleHandleDrag = useCallback(
    (
      pathId: string,
      pointIndex: number,
      type: "in" | "out",
      x: number,
      y: number
    ) => {
      const newPaths = paths.map((path) => {
        if (path.id !== pathId) return path;

        const newPoints = [...path.points];
        const point = newPoints[pointIndex];

        if (!point) return path;

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

        return { ...path, points: newPoints };
      });

      setPaths(newPaths);
    },
    [paths, setPaths]
  );

  const handleClear = useCallback(() => {
    setPaths([]);
    setSelectedPathId(null);
    setSelectedPointIndex(null);
  }, [setPaths]);

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
      top={0}
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
        {isLoaded &&
          paths.map((path) => (
            <RaceTrack
              key={`track-${path.id}`}
              closed={path.closed}
              points={path.points}
              segments={raceSegments}
            />
          ))}

        {/* Render saved paths */}
        {isLoaded &&
          paths.map((path) => (
            <PathEditor
              key={path.id}
              closed={path.closed}
              color={path.color}
              isSelected={selectedPathId === path.id}
              points={path.points}
              selectedPointIndex={
                selectedPathId === path.id ? selectedPointIndex : null
              }
              strokeWidth={path.strokeWidth}
              onHandleDrag={(index, type, x, y) =>
                handleHandleDrag(path.id, index, type, x, y)
              }
              onPathClick={() => handlePathClick(path.id)}
              onPointClick={(index) => handlePointClick(path.id, index)}
              onPointDrag={(index, x, y) =>
                handlePointDrag(path.id, index, x, y)
              }
            />
          ))}

        {/* Render current drawing path */}
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
        hasImage={!!backgroundImage}
        raceSegments={raceSegments}
        onClear={handleClear}
        onImageRemove={handleImageRemove}
        onImageUpload={handleImageUpload}
        onRaceSegmentsChange={setRaceSegments}
      />
    </Box>
  );
}
