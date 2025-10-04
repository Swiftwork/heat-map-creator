"use client";

import { useRef } from "react";
import { FaImage, FaTimes, FaTrash } from "react-icons/fa";
import { Box, Button, HStack, Input, Text } from "@chakra-ui/react";

interface ToolbarProps {
  onClear: () => void;
  onImageUpload: (imageUrl: string) => void;
  onImageRemove: () => void;
  raceSegments: number;
  onRaceSegmentsChange: (value: number) => void;
  hasImage: boolean;
}

export function Toolbar({
  onClear,
  onImageUpload,
  onImageRemove,
  raceSegments,
  onRaceSegmentsChange,
  hasImage,
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
  return (
    <Box
      bg="gray.800"
      borderRadius="lg"
      bottom={4}
      boxShadow="xl"
      color="white"
      left="50%"
      position="fixed"
      px={6}
      py={3}
      transform="translateX(-50%)"
      zIndex={1000}
    >
      <HStack gap={4}>
        <HStack gap={2}>
          <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
            Race Segments:
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
            leftIcon={<FaTimes />}
            size="sm"
            onClick={onImageRemove}
          >
            Remove Image
          </Button>
        ) : (
          <Button
            colorScheme="green"
            leftIcon={<FaImage />}
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Add Image
          </Button>
        )}

        <Button colorScheme="red" leftIcon={<FaTrash />} size="sm" onClick={onClear}>
          Clear All
        </Button>
      </HStack>
    </Box>
  );
}

