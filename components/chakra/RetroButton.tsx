// eslint-disable-next-line simple-import-sort/imports
import { Button, ButtonProps } from '@chakra-ui/react';
import React from 'react';

interface RetroButtonProps extends ButtonProps {
  children: React.ReactNode;
  isActive?: boolean;
  isToggled?: boolean;
}

export function RetroButton({ children, isActive, isToggled, ...props }: RetroButtonProps) {
  const retroButtonProps = {
    borderRadius: 0,
    fontFamily: 'monospace',
    borderWidth: 2,
    borderColor: 'black',
    boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.45)',
    _hover: { transform: 'translateY(-1px)' },
    textTransform: 'uppercase' as const,   
    // Enhanced styling for toggle states
    ...(isActive && {
      bg: 'blue.500',
      color: 'white',
      borderColor: 'blue.600',
      boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.6), 0 0 0 2px rgba(59, 130, 246, 0.5)',
      _hover: { 
        transform: 'translateY(-1px)',
        bg: 'blue.600',
      },
    }),
    ...(isToggled && {
      bg: 'green.500',
      color: 'white',
      borderColor: 'green.600',
      boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.6), 0 0 0 2px rgba(34, 197, 94, 0.5)',
      _hover: { 
        transform: 'translateY(-1px)',
        bg: 'green.600',
      },
    }),
    px: '8px',
    ...props,
  };

  return <Button {...retroButtonProps}>{children}</Button>;
}
