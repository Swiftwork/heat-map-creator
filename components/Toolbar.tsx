"use client";

/* eslint-disable simple-import-sort/imports */
import {
  Box,
  Button,
  HStack,
  Input,
  Text,
  VStack
} from "@chakra-ui/react";
import React, { useRef } from "react";
import { FaEye, FaEyeSlash, FaImage, FaTimes, FaTrash } from "react-icons/fa";

import { Corner } from "@/types/spline";

interface ToolbarProps {
  onClear: () => void;
  onImageUpload: (imageUrl: string) => void;
  onImageRemove: () => void;
  raceSegments: number;
  onRaceSegmentsChange: (value: number) => void;
  hasImage: boolean;
  // New props for Section B features
  showSpaces: boolean;
  showCorners: boolean;
  showStartFinish: boolean;
  onToggleSpaces: () => void;
  onToggleCorners: () => void;
  onToggleStartFinish: () => void;
  editingMode: 'spline' | 'corners' | 'metadata';
  onEditingModeChange: (mode: 'spline' | 'corners' | 'metadata') => void;
  trackMetadata?: {
    name: string;
    laps: number;
    startFinishSpaceIndex: number;
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
  hasImage,
  showSpaces,
  showCorners,
  showStartFinish,
  onToggleSpaces,
  onToggleCorners,
  onToggleStartFinish,
  editingMode,
  onEditingModeChange,
  trackMetadata,
  onMetadataChange,
  selectedPointIndex,
  onRemoveSelectedPoint,
  selectedCorner,
  onCornerUpdate,
  onCornerRemove,
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
      case 'spline':
        return { color: 'blue.400', text: '✏️ Spline Editing Mode', description: 'Draw and edit track path' };
      case 'corners':
        return { color: 'orange.400', text: '🏁 Corner Placement Mode', description: 'Click spaces to add/edit corners' };
      case 'metadata':
        return { color: 'purple.400', text: '📋 Track Metadata Mode', description: 'Edit track information' };
    }
  };

  const modeInfo = getModeInfo();

  return (
    <Box
      bg="gray.800"
      boxShadow="xl"
      color="white"
      data-toolbar="true"
      left={0}
      position="fixed"
      px={6}
      py={4}
      right={0}
      top={0}
      width="100%"
      zIndex={1000}
    >
      <VStack align="stretch" gap={3}>
        {/* Mode Status Bar */}
        <HStack justify="center">
          <Box
            bg={modeInfo.color}
            borderRadius="md"
            color="white"
            fontSize="sm"
            fontWeight="bold"
            px={4}
            py={1}
          >
            {modeInfo.text}
          </Box>
          <Text color="gray.400" fontSize="xs">
            {modeInfo.description}
          </Text>
        </HStack>

        {/* Main Controls Row */}
        <HStack gap={4} justify="center" wrap="wrap">
          {/* Race Segments */}
          <HStack gap={2}>
            <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
              Spaces:
            </Text>
            <Input
              bg="gray.700"
              border="1px solid"
              borderColor="gray.600"
              min={1}
              size="sm"
              type="number"
              value={raceSegments}
              width="80px"
              onChange={handleRaceSegmentsChange}
            />
          </HStack>

          {/* Editing Mode */}
          <HStack gap={2}>
            <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
              Mode:
            </Text>
            <Button
              colorScheme="blue"
              size="sm"
              variant={editingMode === 'spline' ? 'solid' : 'outline'}
              onClick={() => onEditingModeChange('spline')}
            >
              {editingMode === 'spline' && '✓ '}Spline
            </Button>
            <Button
              colorScheme="orange"
              size="sm"
              variant={editingMode === 'corners' ? 'solid' : 'outline'}
              onClick={() => onEditingModeChange('corners')}
            >
              {editingMode === 'corners' && '✓ '}Corners
            </Button>
            <Button
              colorScheme="purple"
              size="sm"
              variant={editingMode === 'metadata' ? 'solid' : 'outline'}
              onClick={() => onEditingModeChange('metadata')}
            >
              {editingMode === 'metadata' && '✓ '}Metadata
            </Button>
          </HStack>

          {/* Visual Toggles */}
          <HStack gap={2}>
            <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
              Show:
            </Text>
            <HStack gap={1}>
              <Button
                colorScheme={showSpaces ? 'blue' : 'gray'}
                size="sm"
                onClick={onToggleSpaces}
              >
                {showSpaces ? <FaEye /> : <FaEyeSlash />} Spaces
              </Button>
              <Button
                colorScheme={showCorners ? 'blue' : 'gray'}
                size="sm"
                onClick={onToggleCorners}
              >
                {showCorners ? <FaEye /> : <FaEyeSlash />} Corners
              </Button>
              <Button
                colorScheme={showStartFinish ? 'blue' : 'gray'}
                size="sm"
                onClick={onToggleStartFinish}
              >
                {showStartFinish ? <FaEye /> : <FaEyeSlash />} Start/Finish
              </Button>
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
            <Button
              colorScheme="orange"
              size="sm"
              onClick={onImageRemove}
            >
              <FaTimes /> Remove Image
            </Button>
          ) : (
            <Button
              colorScheme="green"
              size="sm"
              onClick={() => {
                console.log('Add Image clicked, fileInputRef:', fileInputRef.current);
                fileInputRef.current?.click();
              }}
            >
              <FaImage /> Add Image
            </Button>
          )}

          <Button colorScheme="red" size="sm" onClick={onClear}>
            <FaTrash /> Clear All
          </Button>

          {/* Manual Point Controls */}
          {editingMode === 'spline' && (
            <>
              <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                Click on spline to add points
              </Text>
              {selectedPointIndex !== null && (
                <Button
                  colorScheme="red"
                  size="sm"
                  title="Remove selected point"
                  onClick={onRemoveSelectedPoint}
                >
                  - Remove Point
                </Button>
              )}
            </>
          )}

          {/* Corner Mode Instructions */}
          {editingMode === 'corners' && !selectedCorner && (
            <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
              Click on spaces to add corners
            </Text>
          )}

          {/* Metadata Mode Instructions */}
          {editingMode === 'metadata' && (
            <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
              Click on spaces to place Start/Finish line
            </Text>
          )}
        </HStack>

        {/* Corner Editing Controls */}
        {editingMode === 'corners' && selectedCorner && (
          <HStack gap={4} justify="center" wrap="wrap">
            <Text fontSize="sm" fontWeight="bold">
              Corner at Space {selectedCorner.spaceIndex}:
            </Text>
            
            <HStack gap={2}>
              <Text fontSize="sm" whiteSpace="nowrap">
                Speed Limit:
              </Text>
              <Input
                bg="gray.700"
                border="1px solid"
                borderColor="gray.600"
                max={20}
                min={1}
                size="sm"
                type="number"
                value={selectedCorner.speedLimit}
                width="70px"
                onChange={(e) => onCornerUpdate?.({ speedLimit: parseInt(e.target.value, 10) })}
              />
            </HStack>

            <HStack gap={2}>
              <Text fontSize="sm" whiteSpace="nowrap">
                Inner Side:
              </Text>
              <Button
                colorScheme={selectedCorner.innerSide === 'left' ? 'blue' : 'gray'}
                size="sm"
                onClick={() => onCornerUpdate?.({ innerSide: 'left' })}
              >
                Left
              </Button>
              <Button
                colorScheme={selectedCorner.innerSide === 'right' ? 'blue' : 'gray'}
                size="sm"
                onClick={() => onCornerUpdate?.({ innerSide: 'right' })}
              >
                Right
              </Button>
            </HStack>

            <Button
              colorScheme="red"
              size="sm"
              onClick={onCornerRemove}
            >
              <FaTrash /> Remove Corner
            </Button>
          </HStack>
        )}


        {/* Track Metadata Controls */}
        {trackMetadata && editingMode === 'metadata' && (
          <VStack align="stretch" gap={4} p={4}>
            <HStack gap={4} justify="center" wrap="wrap">
              <HStack gap={2}>
                <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                  Track Name:
                </Text>
                <Input
                  bg="gray.700"
                  border="1px solid"
                  borderColor="gray.600"
                  size="sm"
                  value={trackMetadata.name}
                  width="120px"
                  onChange={(e) => handleMetadataChange('name', e.target.value)}
                />
              </HStack>

              <HStack gap={2}>
                <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                  Laps:
                </Text>
                <Input
                  bg="gray.700"
                  border="1px solid"
                  borderColor="gray.600"
                  min={1}
                  size="sm"
                  type="number"
                  value={trackMetadata.laps}
                  width="60px"
                  onChange={(e) => handleMetadataChange('laps', parseInt(e.target.value, 10))}
                />
              </HStack>

              <HStack gap={2}>
                <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                  Start/Finish Space:
                </Text>
                <Input
                  bg="gray.700"
                  border="1px solid"
                  borderColor="gray.600"
                  min={0}
                  size="sm"
                  type="number"
                  value={trackMetadata.startFinishSpaceIndex}
                  width="80px"
                  onChange={(e) => handleMetadataChange('startFinishSpaceIndex', parseInt(e.target.value, 10))}
                />
              </HStack>

              <HStack gap={2}>
                <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                  Heat Cards:
                </Text>
                <Input
                  bg="gray.700"
                  border="1px solid"
                  borderColor="gray.600"
                  min={0}
                  size="sm"
                  type="number"
                  value={trackMetadata.boardMetadata.heatCardCount}
                  width="60px"
                  onChange={(e) => handleBoardMetadataChange('heatCardCount', parseInt(e.target.value, 10))}
                />
              </HStack>

              <HStack gap={2}>
                <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                  Stress Cards:
                </Text>
                <Input
                  bg="gray.700"
                  border="1px solid"
                  borderColor="gray.600"
                  min={0}
                  size="sm"
                  type="number"
                  value={trackMetadata.boardMetadata.stressCardCount}
                  width="60px"
                  onChange={(e) => handleBoardMetadataChange('stressCardCount', parseInt(e.target.value, 10))}
                />
              </HStack>
            </HStack>
          </VStack>
        )}
      </VStack>
    </Box>
  );
}

