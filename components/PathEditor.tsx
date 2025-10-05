"use client";

import { BezierPoint } from "@/types/spline";
import { bezierToSvgPath } from "@/utils/pathUtils";

interface PathEditorProps {
  points: BezierPoint[];
  color: string;
  strokeWidth: number;
  closed: boolean;
  isSelected: boolean;
  selectedPointIndex: number | null;
  onPointDrag: (index: number, x: number, y: number) => void;
  onHandleDrag: (
    index: number,
    type: "in" | "out",
    x: number,
    y: number,
  ) => void;
  onPathClick: () => void;
  onPointClick: (index: number) => void;
  onPathClickWithCoords?: (x: number, y: number) => void;
  toolMode?: "select" | "add" | "remove";
}

export function PathEditor({
  points,
  color,
  strokeWidth: _strokeWidth,
  closed,
  isSelected,
  selectedPointIndex,
  onPointDrag,
  onHandleDrag,
  onPathClick,
  onPointClick,
  onPathClickWithCoords,
  toolMode = "select",
}: PathEditorProps) {
  const pathData = bezierToSvgPath(points, closed);

  return (
    <g>
      {/* Main path - hidden, only used for selection */}
      <path
        d={pathData}
        fill="none"
        stroke="transparent"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={30}
        style={{ cursor: toolMode === "add" ? "crosshair" : "pointer" }}
        onClick={(e) => {
          // Only allow adding points in add mode
          if (toolMode === "add" && onPathClickWithCoords) {
            const svg = (e.target as SVGElement).ownerSVGElement;
            if (svg) {
              const pt = svg.createSVGPoint();
              pt.x = e.clientX;
              pt.y = e.clientY;
              const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
              onPathClickWithCoords(svgP.x, svgP.y);
            }
          }
          onPathClick();
        }}
      />

      {/* Show control points and handles when selected */}
      {isSelected &&
        points.map((point, index) => {
          const isPointSelected = selectedPointIndex === index;
          return (
            <g key={index}>
              {/* Handle lines */}
              {isPointSelected && point.handleIn && (
                <line
                  stroke="#4299e1"
                  strokeDasharray="4 2"
                  strokeWidth={1}
                  x1={point.x}
                  x2={point.handleIn.x}
                  y1={point.y}
                  y2={point.handleIn.y}
                />
              )}
              {isPointSelected && point.handleOut && (
                <line
                  stroke="#4299e1"
                  strokeDasharray="4 2"
                  strokeWidth={1}
                  x1={point.x}
                  x2={point.handleOut.x}
                  y1={point.y}
                  y2={point.handleOut.y}
                />
              )}

              {/* Handle in control */}
              {isPointSelected && point.handleIn && (
                <circle
                  cx={point.handleIn.x}
                  cy={point.handleIn.y}
                  fill="#4299e1"
                  r={4}
                  stroke="white"
                  strokeWidth={2}
                  style={{ cursor: "move" }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const svg = (e.target as SVGElement).ownerSVGElement;
                      if (!svg) return;

                      const pt = svg.createSVGPoint();
                      pt.x = moveEvent.clientX;
                      pt.y = moveEvent.clientY;
                      const svgP = pt.matrixTransform(
                        svg.getScreenCTM()?.inverse(),
                      );

                      onHandleDrag(index, "in", svgP.x, svgP.y);
                    };

                    const handleMouseUp = () => {
                      document.removeEventListener(
                        "mousemove",
                        handleMouseMove,
                      );
                      document.removeEventListener("mouseup", handleMouseUp);
                    };

                    document.addEventListener("mousemove", handleMouseMove);
                    document.addEventListener("mouseup", handleMouseUp);
                  }}
                />
              )}

              {/* Handle out control */}
              {isPointSelected && point.handleOut && (
                <circle
                  cx={point.handleOut.x}
                  cy={point.handleOut.y}
                  fill="#4299e1"
                  r={4}
                  stroke="white"
                  strokeWidth={2}
                  style={{ cursor: "move" }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const svg = (e.target as SVGElement).ownerSVGElement;
                      if (!svg) return;

                      const pt = svg.createSVGPoint();
                      pt.x = moveEvent.clientX;
                      pt.y = moveEvent.clientY;
                      const svgP = pt.matrixTransform(
                        svg.getScreenCTM()?.inverse(),
                      );

                      onHandleDrag(index, "out", svgP.x, svgP.y);
                    };

                    const handleMouseUp = () => {
                      document.removeEventListener(
                        "mousemove",
                        handleMouseMove,
                      );
                      document.removeEventListener("mouseup", handleMouseUp);
                    };

                    document.addEventListener("mousemove", handleMouseMove);
                    document.addEventListener("mouseup", handleMouseUp);
                  }}
                />
              )}

              {/* Main point */}
              <circle
                cx={point.x}
                cy={point.y}
                fill={toolMode === "remove" ? "#ff4444" : "white"}
                r={6}
                stroke={toolMode === "remove" ? "#cc0000" : color}
                strokeWidth={2}
                style={{
                  cursor:
                    toolMode === "select"
                      ? "move"
                      : toolMode === "remove"
                        ? "pointer"
                        : "default",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onPointClick(index);
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  // Only allow dragging in select mode
                  if (toolMode !== "select") return;

                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const svg = (e.target as SVGElement).ownerSVGElement;
                    if (!svg) return;

                    const pt = svg.createSVGPoint();
                    pt.x = moveEvent.clientX;
                    pt.y = moveEvent.clientY;
                    const svgP = pt.matrixTransform(
                      svg.getScreenCTM()?.inverse(),
                    );

                    onPointDrag(index, svgP.x, svgP.y);
                  };

                  const handleMouseUp = () => {
                    document.removeEventListener("mousemove", handleMouseMove);
                    document.removeEventListener("mouseup", handleMouseUp);
                  };

                  document.addEventListener("mousemove", handleMouseMove);
                  document.addEventListener("mouseup", handleMouseUp);
                }}
              />
            </g>
          );
        })}
    </g>
  );
}
