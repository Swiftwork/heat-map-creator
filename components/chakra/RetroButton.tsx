// eslint-disable-next-line simple-import-sort/imports
import { Button, ButtonProps } from '@chakra-ui/react';
import React from 'react';

interface RetroButtonProps extends ButtonProps {
  children: React.ReactNode;
}

export function RetroButton({ children, ...props }: RetroButtonProps) {
  const retroButtonProps = {
    borderRadius: 0,
    fontFamily: 'monospace',
    borderWidth: 2,
    borderColor: 'black',
    boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.45)',
    _hover: { transform: 'translateY(-1px)' },
    textTransform: 'uppercase' as const,
    px: '8px',
    ...props,
  };

  return <Button {...retroButtonProps}>{children}</Button>;
}
