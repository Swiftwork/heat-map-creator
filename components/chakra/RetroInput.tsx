import { Input, InputProps } from '@chakra-ui/react';

export function RetroInput(props: InputProps) {
  return (
    <Input
      bg="#0f0f0b"
      borderColor="yellow.600"
      borderRadius={0}
      borderWidth={2}
      boxShadow="inset 0 -3px 0 rgba(0,0,0,0.45)"
      color="white"
      fontFamily="monospace"
      {...props}
    />
  );
}
