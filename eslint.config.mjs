import { builtinModules } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import prettierConfig from "eslint-config-prettier";
import sortImportsPlugin from "eslint-plugin-simple-import-sort";
import unusedImportsPlugin from "eslint-plugin-unused-imports";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // All files
    files: [
      "**/*.js",
      "**/*.cjs",
      "**/*.mjs",
      "**/*.jsx",
      "**/*.ts",
      "**/*.tsx",
    ],
    plugins: {
      "unused-imports": unusedImportsPlugin,
      "simple-import-sort": sortImportsPlugin,
    },
    rules: {
      // Props
      "react/jsx-sort-props": [
        "error",
        {
          callbacksLast: true,
          shorthandFirst: false,
          shorthandLast: true,
          ignoreCase: true,
          noSortAlphabetically: false,
          reservedFirst: true,
        },
      ],

      // Imports
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "unused-imports/no-unused-imports": ["warn"],
      "import/first": ["warn"],
      "import/newline-after-import": ["warn"],
      "import/no-named-as-default": ["off"],
      "simple-import-sort/exports": ["warn"],
      "simple-import-sort/imports": [
        "warn",
        {
          groups: [
            // Side effect imports.
            ["^\\u0000"],
            // Node.js builtins, react, and third-party packages.
            [`^(node:)?(${builtinModules.join("|")})(/|$)`, "^react", "^@?\\w"],
            // Path aliased root, parent imports, and just `..`.
            ["^@/", "^\\.\\.(?!/?$)", "^\\.\\./?$"],
            // Relative imports, same-folder imports, and just `.`.
            ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
            // Style imports.
            ["^.+\\.s?css$"],
          ],
        },
      ],
    },
  },
  {
    // TypeScript files
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Typescript Specific
      "@typescript-eslint/no-unused-vars": "off", // handled by unused-imports
      "@typescript-eslint/explicit-module-boundary-types": ["off"],
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        {
          considerDefaultExhaustiveForUnions: true,
          requireDefaultForNonUnion: true,
        },
      ],
      "@typescript-eslint/no-non-null-assertion": ["warn"],
      "@typescript-eslint/no-empty-function": ["off"],
      "@typescript-eslint/no-explicit-any": ["off"],
      "@typescript-eslint/no-use-before-define": ["warn"],
      "@typescript-eslint/no-shadow": ["warn"],
    },
  },
  {
    // Prettier Overrides
    files: [
      "**/*.js",
      "**/*.cjs",
      "**/*.mjs",
      "**/*.jsx",
      "**/*.ts",
      "**/*.tsx",
    ],
    rules: {
      ...prettierConfig.rules,
    },
  },
];

export default eslintConfig;
