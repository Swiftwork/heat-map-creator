import { Input, InputProps } from '@chakra-ui/react';

export function RetroColorInput(props: InputProps) {
  return (
    <Input
      _focus={{
        borderColor: 'yellow.400',
      }}
      _hover={{
        borderColor: 'yellow.500',
      }}
      bg="#0f0f0b"
      borderColor="yellow.600"
      borderRadius={0}
      borderWidth={2}
      color="white"
      fontFamily="monospace"
      type="color"
      {...props}
    />
  );
}