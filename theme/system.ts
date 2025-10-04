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
    components: {
      Input: {
        variants: {
          retro: {
            field: {
              bg: '#0f0f0b',
              color: 'white',
              borderWidth: '2px',
              borderColor: 'yellow.600',
              fontFamily: 'mono',
              borderRadius: '0',
              boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.45)'
            }
          }
        }
      }
    }
  },
});

export const system = createSystem(defaultConfig, config);
