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
import { RetroInput } from './chakra/RetroInput';

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
        return { color: 'blue.400', text: 'Spline Editing Mode', description: 'Draw and edit track path' };
      case 'corners':
        return { color: 'orange.400', text: 'Corner Placement Mode', description: 'Click spaces to add/edit corners' };
      case 'metadata':
        return { color: 'purple.400', text: 'Track Metadata Mode', description: 'Edit track information' };
    }
  };

  const modeInfo = getModeInfo();

  // shared retro button appearance
  const retroButtonProps = {
    borderRadius: 0,
    fontFamily: 'monospace',
    borderWidth: 2,
    borderColor: 'black',
    boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.45)',
    _hover: { transform: 'translateY(-1px)' },
  } as const;

  // small SVG tile (8x8) for a crisp repeating checkered pattern
  const checkeredSvg = encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><rect width='8' height='8' fill='white'/><rect x='0' y='0' width='4' height='4' fill='black'/><rect x='4' y='4' width='4' height='4' fill='black'/></svg>");

  return (
    <Box
      /* vintage racing look: dark leather background with subtle gradient + felt texture */
      bgGradient="linear(to-r, gray.900, #0f1410)"
      bgImage={"repeating-linear-gradient(135deg, rgba(255,255,255,0.01) 0 2px, transparent 2px 6px)"}
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
          {/* small racing stripe accent */}
          <Box
            bgGradient="linear(to-b, blackAlpha.900, yellow.400)"
            borderRadius="2px"
            boxShadow="inset 0 -2px 0 rgba(0,0,0,0.6)"
            height="28px"
            mr={2}
            width="8px"
          />

          {/* Checkered flag patch (SVG tile for crisp squares) */}
          <Box
            backgroundImage={`url("data:image/svg+xml;utf8,${checkeredSvg}")`}
            backgroundPosition="0 0"
            backgroundRepeat="repeat"
            backgroundSize="8px 8px"
            border="1px solid rgba(0,0,0,0.25)"
            borderRadius="2px"
            boxShadow="inset 0 -2px 0 rgba(0,0,0,0.4)"
            height="28px"
            mr={2}
            width="40px"
          />

          {/* Gauge circle */}
          <HStack align="center" gap={3}>
            <Box
              alignItems="center"
              bgGradient="radial(circle at 30% 30%, whiteAlpha.600, gray.200 30%, gray.100 60%, gray.300)"
              border="3px solid"
              borderColor="#444"
              borderRadius="full"
              boxShadow="inset 0 -6px 0 rgba(0,0,0,0.35), 0 3px 0 rgba(0,0,0,0.6)"
              display="flex"
              height="56px"
              justifyContent="center"
              width="56px"
            >
              <Text fontSize="xs" fontWeight="bold" lineHeight="1" textAlign="center">
                {editingMode === 'spline' ? '✏️' : editingMode === 'corners' ? '🏁' : '📋'}
              </Text>
            </Box>

            <Box>
              <Text color="yellow.200" fontSize="sm" fontWeight="bold" letterSpacing="0.06em" textTransform="uppercase">
                {modeInfo.text}
              </Text>
              <Text color="gray.300" fontSize="xs">
                {modeInfo.description}
              </Text>
            </Box>
          </HStack>
        </HStack>

        {/* Main Controls Row */}
        <HStack gap={4} justify="center" wrap="wrap">
          {/* Race Segments */}
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

          {/* Editing Mode Buttons */}
          <HStack gap={2}>
            <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
              Mode:
            </Text>
            <Button
              {...retroButtonProps}
              colorScheme="yellow"
              size="sm"
              textTransform="uppercase"
              variant={editingMode === 'spline' ? 'solid' : 'outline'}
              onClick={() => onEditingModeChange('spline')}
            >
              {editingMode === 'spline' && '✓ '}Spline
            </Button>
            <Button
              {...retroButtonProps}
              colorScheme="orange"
              size="sm"
              textTransform="uppercase"
              variant={editingMode === 'corners' ? 'solid' : 'outline'}
              onClick={() => onEditingModeChange('corners')}
            >
              {editingMode === 'corners' && '✓ '}Corners
            </Button>
            <Button
              {...retroButtonProps}
              colorScheme="red"
              size="sm"
              textTransform="uppercase"
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
              <Button {...retroButtonProps} colorScheme={showSpaces ? 'blue' : 'gray'} size="sm" onClick={onToggleSpaces}>
                {showSpaces ? <FaEye /> : <FaEyeSlash />} Spaces
              </Button>
              <Button {...retroButtonProps} colorScheme={showCorners ? 'orange' : 'gray'} size="sm" onClick={onToggleCorners}>
                {showCorners ? <FaEye /> : <FaEyeSlash />} Corners
              </Button>
              <Button {...retroButtonProps} colorScheme={showStartFinish ? 'blue' : 'gray'} size="sm" onClick={onToggleStartFinish}>
                {showStartFinish ? <FaEye /> : <FaEyeSlash />} Start/Finish
              </Button>
            </HStack>
          </HStack>

          {/* Image Controls */}
          <Input ref={fileInputRef} accept="image/*" display="none" type="file" onChange={handleFileChange} />
          {hasImage ? (
            <Button {...retroButtonProps} colorScheme="orange" size="sm" onClick={onImageRemove}>
              <FaTimes /> Remove Image
            </Button>
          ) : (
            <Button
              {...retroButtonProps}
              colorScheme="green"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <FaImage /> Add Image
            </Button>
          )}

          <Button {...retroButtonProps} colorScheme="red" size="sm" onClick={onClear}>
            <FaTrash /> Clear All
          </Button>

          {/* Manual Point Controls */}
          {editingMode === 'spline' && (
            <>
              <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
                Click on spline to add points
              </Text>
              {selectedPointIndex !== null && (
                <Button colorScheme="red" size="sm" title="Remove selected point" onClick={onRemoveSelectedPoint}>
                  - Remove Point
                </Button>
              )}
            </>
          )}

          {/* Corner/metadata hints */}
          {editingMode === 'corners' && !selectedCorner && (
            <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">Click on spaces to add corners</Text>
          )}
          {editingMode === 'metadata' && (
            <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">Click on spaces to place Start/Finish line</Text>
          )}
        </HStack>

        {/* Corner Editing Controls */}
        {editingMode === 'corners' && selectedCorner && (
          <HStack gap={4} justify="center" wrap="wrap">
            <Text fontSize="sm" fontWeight="bold">Corner at Space {selectedCorner.spaceIndex}:</Text>

            <HStack gap={2}>
              <Text fontSize="sm" whiteSpace="nowrap">Speed Limit:</Text>
              <RetroInput
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
              <Text fontSize="sm" whiteSpace="nowrap">Inner Side:</Text>
              <Button colorScheme={selectedCorner.innerSide === 'left' ? 'blue' : 'gray'} size="sm" onClick={() => onCornerUpdate?.({ innerSide: 'left' })}>Left</Button>
              <Button colorScheme={selectedCorner.innerSide === 'right' ? 'blue' : 'gray'} size="sm" onClick={() => onCornerUpdate?.({ innerSide: 'right' })}>Right</Button>
            </HStack>

            <Button colorScheme="red" size="sm" onClick={onCornerRemove}><FaTrash /> Remove Corner</Button>
          </HStack>
        )}

        {/* Track Metadata Controls */}
        {trackMetadata && editingMode === 'metadata' && (
          <VStack align="stretch" gap={4} p={4}>
            <HStack gap={4} justify="center" wrap="wrap">
              <HStack gap={2}>
                <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">Track Name:</Text>
                <Input bg="gray.700" border="1px solid" borderColor="gray.600" size="sm" value={trackMetadata.name} width="120px" onChange={(e) => handleMetadataChange('name', e.target.value)} />
              </HStack>

              <HStack gap={2}>
                <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">Laps:</Text>
                <RetroInput min={1} size="sm" type="number" value={trackMetadata.laps} width="60px" onChange={(e) => handleMetadataChange('laps', parseInt(e.target.value, 10))} />
              </HStack>

              <HStack gap={2}>
                <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">Start/Finish Space:</Text>
                <RetroInput min={0} size="sm" type="number" value={trackMetadata.startFinishSpaceIndex} width="80px" onChange={(e) => handleMetadataChange('startFinishSpaceIndex', parseInt(e.target.value, 10))} />
              </HStack>

              <HStack gap={2}>
                <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">Heat Cards:</Text>
                <RetroInput min={0} size="sm" type="number" value={trackMetadata.boardMetadata.heatCardCount} width="60px" onChange={(e) => handleBoardMetadataChange('heatCardCount', parseInt(e.target.value, 10))} />
              </HStack>

              <HStack gap={2}>
                <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">Stress Cards:</Text>
                <RetroInput min={0} size="sm" type="number" value={trackMetadata.boardMetadata.stressCardCount} width="60px" onChange={(e) => handleBoardMetadataChange('stressCardCount', parseInt(e.target.value, 10))} />
              </HStack>
            </HStack>
          </VStack>
        )}
      </VStack>
    </Box>
  );
}

