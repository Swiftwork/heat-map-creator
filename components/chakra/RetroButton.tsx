import React from "react";
import { Button, ButtonProps } from "@chakra-ui/react";

interface RetroButtonProps extends ButtonProps {
  children: React.ReactNode;
  isActive?: boolean;
  isToggled?: boolean;
}

export function RetroButton({
  children,
  isActive,
  isToggled,
  ...props
}: RetroButtonProps) {
  const retroButtonProps = {
    borderRadius: 0,
    fontFamily: "monospace",
    borderWidth: 2,
    borderColor: "black",
    boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.45)",
    _hover: { transform: "translateY(-1px)" },
    textTransform: "uppercase" as const,
    // Enhanced styling for toggle states
    ...(isActive && {
      bg: "yellow.500",
      color: "black",
      borderColor: "yellow.600",
      _hover: {
        transform: "translateY(-1px)",
        bg: "yellow.600",
      },
    }),
    ...(isToggled && {
      bg: "yellow.400",
      color: "black",
      borderColor: "yellow.600",
      _hover: {
        transform: "translateY(0px)",
      },
    }),
    px: "8px",
    ...props,
  };

  return <Button {...retroButtonProps}>{children}</Button>;
}
