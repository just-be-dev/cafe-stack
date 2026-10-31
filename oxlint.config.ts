import { defineConfig } from "oxlint";
import effect from "@mpsuesser/oxlint-plugin-effect";
import foldkit from "@foldkit/oxlint-plugin";

// Mirrors src/platform/boundary.test.ts, which stays the authoritative check: it also resolves
// paths exactly and scans for Cloudflare globals. Keep the two in sync.
const backendOnlyPackages = [
  {
    regex: "^(?:alchemy|agents)(?:/|$)",
    message: "Only src/platform/ may depend on Alchemy or agents.",
  },
  {
    regex: "^(?:cloudflare:|@cloudflare/)",
    message: "Only src/platform/ may depend on Cloudflare runtime modules and types.",
  },
];

const platformPaths = {
  regex: "^(?:\\.\\.?/)+platform(?:/|$)",
  message: "Platform imports domain, never the reverse. Depend on a capability contract instead.",
};

export default defineConfig({
  plugins: ["typescript"],
  jsPlugins: [...effect.configs.recommended.jsPlugins, ...foldkit.configs.recommended.jsPlugins],
  rules: {
    "effect/avoid-non-null-assertion": "error",
    "effect/no-chained-type-assertions": "error",
    "effect/no-module-mocking": "error",
    "typescript/no-explicit-any": "error",
    "typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }],
    "no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      },
    ],
  },
  overrides: [
    {
      files: ["src/**/*.ts"],
      excludeFiles: ["src/ui/**", "src/platform/**"],
      rules: {
        "no-restricted-imports": ["error", { patterns: [...backendOnlyPackages, platformPaths] }],
      },
    },
    {
      files: ["src/ui/**/*.ts"],
      rules: {
        ...foldkit.configs.recommended.rules,
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              ...backendOnlyPackages.map(({ regex }) => ({
                regex,
                message: "The browser UI can't load Worker, Alchemy, or agents modules.",
              })),
              {
                regex: platformPaths.regex,
                message: "The UI talks to the platform over HTTP, never by importing it.",
              },
            ],
          },
        ],
      },
    },
    ...foldkit.configs.recommended.overrides,
  ],
});
