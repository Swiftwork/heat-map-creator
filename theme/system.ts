import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

export const config = defineConfig({
  theme: {
    tokens: {
      fonts: {
        heading: { value: "var(--font-geist-sans)" },
        body: { value: "var(--font-geist-sans)" },
        mono: { value: "var(--font-geist-mono)" },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
