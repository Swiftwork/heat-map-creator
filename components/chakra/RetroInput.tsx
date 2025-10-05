import { Input, InputProps } from "@chakra-ui/react";

export function RetroInput(props: InputProps) {
  return (
    <Input
      bg="#0f0f0b"
      borderColor="yellow.600"
      borderRadius={0}
      borderWidth={2}
      color="white"
      fontFamily="monospace"
      px="4px"
      {...props}
    />
  );
}
