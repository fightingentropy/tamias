import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/dist-ssr/**",
      "**/.wrangler/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/.tanstack/**",
      "**/convex/_generated/**",
      "**/.react-email/**",
      "bun.lock",
      "github.png",
      "**/*.tsbuildinfo",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "no-unused-vars": "off",
      "preserve-caught-error": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/triple-slash-reference": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-useless-assignment": "off",
      "no-fallthrough": "off",
    },
  },
  {
    files: ["**/*.{tsx,jsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      ...react.configs.flat["jsx-runtime"].languageOptions,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off",
      "react/no-unknown-property": "off",
      "react/no-children-prop": "off",
      "react/display-name": "off",
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "off",
    },
    settings: {
      react: { version: "detect" },
    },
  },
  prettier,
);
