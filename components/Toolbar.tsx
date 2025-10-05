"use client";

/* eslint-disable simple-import-sort/imports */
import { Box, HStack, Input, Text, VStack } from "@chakra-ui/react";
import React, { useRef } from "react";
import {
  FaEye,
  FaEyeSlash,
  FaFlagCheckered,
  FaHandPointer,
  FaImage,
  FaMinus,
  FaPlus,
  FaTrash,
  FaX,
} from "react-icons/fa6";
import { RetroButton } from "./chakra/RetroButton";
import { RetroColorInput } from "./chakra/RetroColorInput";
import { RetroInput } from "./chakra/RetroInput";

import { Corner } from "@/types/spline";

interface ToolbarProps {
  onClear: () => void;
  onImageUpload: (imageUrl: string) => void;
  onImageRemove: () => void;
  hasImage: boolean;
  trackWidth: number;
  onTrackWidthChange: (value: number) => void;
  baseStrokeWidth: number;
  onBaseStrokeWidthChange: (value: number) => void;
  raceSegments: number;
  onRaceSegmentsChange: (value: number) => void;
  // New props for Section B features
  debugMode: boolean;
  onToggleDebug: () => void;
  editingMode: "spline" | "corners" | "metadata" | "appearance";
  onEditingModeChange: (
    mode: "spline" | "corners" | "metadata" | "appearance",
  ) => void;
  trackColor?: string;
  onTrackColorChange?: (color: string) => void;
  trackMetadata?: {
    name: string;
    laps: number;
    startFinishSpaceIndex: number;
    raceDirection: "clockwise" | "counter-clockwise";
    boardMetadata: {
      cornersPerLap: number;
      spacesPerLap: number;
      heatCardCount: number;
      stressCardCount: number;
    };
  };
  onMetadataChange?: (metadata: any) => void;
  // Manual point editing props
  selectedPointIndex?: number | null;
  onRemoveSelectedPoint?: () => void;
  // Spline tool mode props
  splineToolMode?: "select" | "add" | "remove";
  onSplineToolModeChange?: (mode: "select" | "add" | "remove") => void;
  // Corner tool mode props
  cornerToolMode?: "select" | "add" | "remove";
  onCornerToolModeChange?: (mode: "select" | "add" | "remove") => void;
  // Corner editing props
  selectedCorner?: Corner | undefined;
  onCornerUpdate?: (updates: Partial<Corner>) => void;
  onCornerRemove?: () => void;
}

export function Toolbar({
  onClear,
  onImageUpload,
  onImageRemove,
  raceSegments,
  onRaceSegmentsChange,
  trackWidth,
  onTrackWidthChange,
  baseStrokeWidth: baseStrokeWidth,
  onBaseStrokeWidthChange: onBaseStrokeWidthChange,
  hasImage,
  debugMode,
  onToggleDebug,
  editingMode,
  onEditingModeChange,
  trackMetadata,
  onMetadataChange,
  selectedPointIndex,
  onRemoveSelectedPoint,
  splineToolMode = "select",
  onSplineToolModeChange,
  cornerToolMode = "select",
  onCornerToolModeChange,
  selectedCorner,
  onCornerUpdate,
  onCornerRemove,
  trackColor,
  onTrackColorChange,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      onImageUpload(imageUrl);
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRaceSegmentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      onRaceSegmentsChange(value);
    }
  };

  const handleTrackWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      onTrackWidthChange(value);
    }
  };

  const handleMetadataChange = (field: string, value: any) => {
    if (onMetadataChange && trackMetadata) {
      const updatedMetadata = {
        ...trackMetadata,
        [field]: value,
      };
      onMetadataChange(updatedMetadata);
    }
  };

  const handleBoardMetadataChange = (field: string, value: any) => {
    if (onMetadataChange && trackMetadata) {
      const updatedMetadata = {
        ...trackMetadata,
        boardMetadata: {
          ...trackMetadata.boardMetadata,
          [field]: value,
        },
      };
      onMetadataChange(updatedMetadata);
    }
  };

  const getModeInfo = () => {
    switch (editingMode) {
      case "spline":
        return {
          color: "blue.400",
          text: "Spline Editing Mode",
          description: "Draw and edit track path",
        };
      case "corners":
        return {
          color: "orange.400",
          text: "Corner Placement Mode",
          description: "Click spaces to add/edit corners",
        };
      case "metadata":
        return {
          color: "purple.400",
          text: "Track Metadata Mode",
          description: "Edit track information",
        };
      case "appearance":
        return {
          color: "green.400",
          text: "Track Appearance Mode",
          description: "Customize track visuals",
        };
    }
  };

  const modeInfo = getModeInfo();

  // small SVG tile (8x8) for a crisp repeating checkered pattern
  const checkeredSvg = encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><rect width='8' height='8' fill='white'/><rect x='0' y='0' width='4' height='4' fill='black'/><rect x='4' y='4' width='4' height='4' fill='black'/></svg>",
  );

  return (
    <Box
      /* vintage racing look: dark leather background with subtle gradient + felt texture */
      bgGradient="linear(to-r, gray.900, gray.200)"
      bgImage={
        "repeating-linear-gradient(135deg, rgba(0, 0, 0, 1) 0 2px, transparent 2px 6px)"
      }
      borderBottom="6px solid"
      borderColor="yellow.500"
      boxShadow="0 6px 0 rgba(0,0,0,0.6)"
      color="white"
      data-toolbar="true"
      fontFamily="monospace"
      left={0}
      letterSpacing="0.04em"
      position="fixed"
      px={6}
      py={4}
      right={0}
      top={0}
      width="100%"
      zIndex={1000}
    >
      <VStack align="stretch" gap={3}>
        {/* Mode Status Bar (gauge + checkered flag) */}
        <HStack align="center" justify="center">
          {/* Checkered flag patch (SVG tile for crisp squares) */}
          <Box
            backgroundImage={`url("data:image/svg+xml;utf8,${checkeredSvg}")`}
            backgroundPosition="0 0"
            backgroundRepeat="repeat"
            backgroundSize="20px 20px"
            border="1px solid rgba(0,0,0,0.25)"
            borderRadius="2px"
            boxShadow="inset 0 -2px 0 rgba(0,0,0,0.4)"
            height="40px"
            mr={2}
            width="60px"
          />

          {/* Gauge circle */}
          <HStack align="center" gap={3}>
            <Box
              alignItems="center"
              bgGradient="radial(circle at 30% 30%, whiteAlpha.600, gray.200 30%, gray.100 60%, gray.300)"
              border="3px solid"
              borderColor="yellow.600"
              borderRadius="full"
              boxShadow="inset 0 -6px 0 rgba(0,0,0,0.35), 0 3px 0 rgba(0,0,0,0.6)"
              display="flex"
              height="56px"
              justifyContent="center"
              width="56px"
            >
              <Text
                fontSize="20px"
                fontWeight="bold"
                lineHeight="1"
                textAlign="center"
              >
                {editingMode === "spline"
                  ? "✏️"
                  : editingMode === "corners"
                    ? "⚠️"
                    : editingMode === "metadata"
                      ? "📋"
                      : "🎨"}
              </Text>
            </Box>

            <Box>
              <Text
                color="grey.100"
                fontSize="sm"
                fontWeight="bold"
                letterSpacing="0.06em"
                textTransform="uppercase"
              >
                {modeInfo.text}
              </Text>
              <Text color="gray.300" fontSize="xs">
                {modeInfo.description}
              </Text>
            </Box>
          </HStack>
        </HStack>

        {/* Main Controls Row + Editing Controls Row */}
        <VStack align="stretch" gap={2}>
          <HStack gap={4} justify="center" wrap="wrap">
            {/* Editing Mode Buttons */}
            <HStack gap={2}>
              <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                Mode:
              </Text>
              <RetroButton
                isToggled={editingMode === "spline"}
                size="sm"
                onClick={() => onEditingModeChange("spline")}
              >
                {editingMode === "spline" && <FaFlagCheckered />} Spline
              </RetroButton>
              <RetroButton
                isToggled={editingMode === "corners"}
                size="sm"
                onClick={() => onEditingModeChange("corners")}
              >
                {editingMode === "corners" && <FaFlagCheckered />}Corners
              </RetroButton>
              <RetroButton
                isToggled={editingMode === "metadata"}
                size="sm"
                onClick={() => onEditingModeChange("metadata")}
              >
                {editingMode === "metadata" && <FaFlagCheckered />}Metadata
              </RetroButton>
              <RetroButton
                isToggled={editingMode === "appearance"}
                size="sm"
                onClick={() => onEditingModeChange("appearance")}
              >
                {editingMode === "appearance" && <FaFlagCheckered />}Appearance
              </RetroButton>
            </HStack>

            {/* Visual Toggles */}
            <HStack gap={2}>
              <HStack gap={1}>
                <RetroButton
                  colorScheme={debugMode ? "blue" : "gray"}
                  size="sm"
                  onClick={onToggleDebug}
                >
                  {debugMode ? <FaEye /> : <FaEyeSlash />} Debug
                </RetroButton>
                {/* Corners toggle removed */}
              </HStack>
            </HStack>

            {/* Image Controls */}
            <Input
              ref={fileInputRef}
              accept="image/*"
              display="none"
              type="file"
              onChange={handleFileChange}
            />
            {hasImage ? (
              <RetroButton
                colorScheme="orange"
                size="sm"
                onClick={onImageRemove}
              >
                <FaX /> Remove Image
              </RetroButton>
            ) : (
              <RetroButton
                colorScheme="green"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <FaImage /> Add Image
              </RetroButton>
            )}

            <RetroButton colorScheme="red" size="sm" onClick={onClear}>
              <FaTrash /> Clear All
            </RetroButton>
          </HStack>

          {/* Editing Controls Row (Manual Point, Corner/metadata hints, Corner Editing, Track Metadata) */}
          <>
            {/* Spline Tool Mode Controls */}
            {editingMode === "spline" && (
              <HStack gap={2} justify="center" wrap="wrap">
                <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                  Tool:
                </Text>
                <RetroButton
                  colorScheme={splineToolMode === "select" ? "blue" : undefined}
                  isToggled={splineToolMode === "select"}
                  size="sm"
                  onClick={() => onSplineToolModeChange?.("select")}
                >
                  <FaHandPointer /> Select Point
                </RetroButton>
                <RetroButton
                  colorScheme={splineToolMode === "add" ? "green" : undefined}
                  isToggled={splineToolMode === "add"}
                  size="sm"
                  onClick={() => onSplineToolModeChange?.("add")}
                >
                  <FaPlus /> Add Point
                </RetroButton>
                <RetroButton
                  colorScheme={splineToolMode === "remove" ? "red" : undefined}
                  isToggled={splineToolMode === "remove"}
                  size="sm"
                  onClick={() => onSplineToolModeChange?.("remove")}
                >
                  <FaMinus /> Remove Point
                </RetroButton>
              </HStack>
            )}

            {/* Corner Tool Mode Controls */}
            {editingMode === "corners" && (
              <HStack gap={2} justify="center" wrap="wrap">
                <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                  Tool:
                </Text>
                <RetroButton
                  colorScheme={cornerToolMode === "select" ? "blue" : undefined}
                  isToggled={cornerToolMode === "select"}
                  size="sm"
                  onClick={() => onCornerToolModeChange?.("select")}
                >
                  <FaHandPointer /> Select Corner
                </RetroButton>
                <RetroButton
                  colorScheme={cornerToolMode === "add" ? "green" : undefined}
                  isToggled={cornerToolMode === "add"}
                  size="sm"
                  onClick={() => onCornerToolModeChange?.("add")}
                >
                  <FaPlus /> Add Corner
                </RetroButton>
                <RetroButton
                  colorScheme={cornerToolMode === "remove" ? "red" : undefined}
                  isToggled={cornerToolMode === "remove"}
                  size="sm"
                  onClick={() => onCornerToolModeChange?.("remove")}
                >
                  <FaMinus /> Remove Corner
                </RetroButton>
              </HStack>
            )}

            {/* Corner Editing Controls */}
            {editingMode === "corners" && selectedCorner && (
              <HStack gap={4} justify="center" wrap="wrap">
                <HStack gap={2}>
                  <Text fontSize="sm" whiteSpace="nowrap">
                    Speed Limit:
                  </Text>
                  <RetroInput
                    max={20}
                    min={1}
                    size="sm"
                    type="number"
                    value={selectedCorner.speedLimit}
                    width="70px"
                    onChange={(e) =>
                      onCornerUpdate?.({
                        speedLimit: parseInt(e.target.value, 10),
                      })
                    }
                  />
                </HStack>

                <HStack gap={2}>
                  <Text fontSize="sm" whiteSpace="nowrap">
                    Inner Side:
                  </Text>
                  <RetroButton
                    isActive={selectedCorner.innerSide === "left"}
                    size="sm"
                    onClick={() => onCornerUpdate?.({ innerSide: "left" })}
                  >
                    Left
                  </RetroButton>
                  <RetroButton
                    isActive={selectedCorner.innerSide === "right"}
                    size="sm"
                    onClick={() => onCornerUpdate?.({ innerSide: "right" })}
                  >
                    Right
                  </RetroButton>
                </HStack>

                <RetroButton
                  colorScheme="red"
                  size="sm"
                  onClick={onCornerRemove}
                >
                  <FaTrash /> Remove Corner
                </RetroButton>
              </HStack>
            )}

            {/* Track Appearance Controls */}
            {editingMode === "appearance" && (
              <VStack align="stretch" gap={4} p={4}>
                <HStack gap={4} justify="center" wrap="wrap">
                  <HStack gap={2}>
                    <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                      Width:
                    </Text>
                    <RetroInput
                      max={300}
                      min={20}
                      size="sm"
                      type="number"
                      value={trackWidth}
                      width="80px"
                      onChange={handleTrackWidthChange}
                    />
                  </HStack>
                  <HStack gap={2}>
                    <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                      Track Color:
                    </Text>
                    <RetroColorInput
                      size="sm"
                      value={trackColor ?? "#3a3a3a"}
                      width="80px"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onTrackColorChange?.(e.target.value)
                      }
                    />
                  </HStack>
                  <HStack gap={2}>
                    <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                      Edge Width:
                    </Text>
                    <RetroInput
                      max={10}
                      min={1}
                      size="sm"
                      type="number"
                      value={baseStrokeWidth}
                      width="80px"
                      onChange={(e) =>
                        onBaseStrokeWidthChange(parseInt(e.target.value, 10))
                      }
                    />
                  </HStack>
                </HStack>
              </VStack>
            )}

            {/* Track Metadata Controls */}
            {trackMetadata && editingMode === "metadata" && (
              <VStack align="stretch" gap={4} p={4}>
                <HStack gap={4} justify="center" wrap="wrap">
                  <HStack gap={2}>
                    <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                      Track Name:
                    </Text>
                    <RetroInput
                      size="sm"
                      value={trackMetadata.name}
                      width="120px"
                      onChange={(e) =>
                        handleMetadataChange("name", e.target.value)
                      }
                    />
                  </HStack>

                  <HStack gap={2}>
                    <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                      Spaces:
                    </Text>
                    <RetroInput
                      min={1}
                      size="sm"
                      type="number"
                      value={raceSegments}
                      width="80px"
                      onChange={handleRaceSegmentsChange}
                    />
                  </HStack>

                  <HStack gap={2}>
                    <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                      Laps:
                    </Text>
                    <RetroInput
                      min={1}
                      size="sm"
                      type="number"
                      value={trackMetadata.laps}
                      width="60px"
                      onChange={(e) =>
                        handleMetadataChange(
                          "laps",
                          parseInt(e.target.value, 10),
                        )
                      }
                    />
                  </HStack>

                  <HStack gap={2}>
                    <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                      Start/Finish Space:
                    </Text>
                    <RetroInput
                      min={0}
                      size="sm"
                      type="number"
                      value={trackMetadata.startFinishSpaceIndex}
                      width="80px"
                      onChange={(e) =>
                        handleMetadataChange(
                          "startFinishSpaceIndex",
                          parseInt(e.target.value, 10),
                        )
                      }
                    />
                  </HStack>

                  <HStack gap={2}>
                    <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                      Heat Cards:
                    </Text>
                    <RetroInput
                      min={0}
                      size="sm"
                      type="number"
                      value={trackMetadata.boardMetadata.heatCardCount}
                      width="60px"
                      onChange={(e) =>
                        handleBoardMetadataChange(
                          "heatCardCount",
                          parseInt(e.target.value, 10),
                        )
                      }
                    />
                  </HStack>

                  <HStack gap={2}>
                    <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                      Stress Cards:
                    </Text>
                    <RetroInput
                      min={0}
                      size="sm"
                      type="number"
                      value={trackMetadata.boardMetadata.stressCardCount}
                      width="60px"
                      onChange={(e) =>
                        handleBoardMetadataChange(
                          "stressCardCount",
                          parseInt(e.target.value, 10),
                        )
                      }
                    />
                  </HStack>
                </HStack>

                <HStack gap={4} justify="center" wrap="wrap">
                  <HStack gap={2}>
                    <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                      Race Direction:
                    </Text>
                    <RetroButton
                      isActive={trackMetadata.raceDirection === "clockwise"}
                      size="sm"
                      onClick={() =>
                        handleMetadataChange("raceDirection", "clockwise")
                      }
                    >
                      Clockwise
                    </RetroButton>
                    <RetroButton
                      isActive={
                        trackMetadata.raceDirection === "counter-clockwise"
                      }
                      size="sm"
                      onClick={() =>
                        handleMetadataChange("raceDirection", "counter-clockwise")
                      }
                    >
                      Counter-Clockwise
                    </RetroButton>
                  </HStack>
                </HStack>
              </VStack>
            )}
          </>
        </VStack>
      </VStack>
    </Box>
  );
}
