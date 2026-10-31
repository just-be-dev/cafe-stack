import { expect, it } from "@effect/vitest";
import { glob, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The `no-restricted-imports` overrides in oxlint.config.ts mirror these checks for fast editor
// feedback. This test stays authoritative: it resolves paths exactly, including the UI's `@/`
// alias, and scans backend code for Cloudflare globals.

const src = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backendOnlyPackage = /^(alchemy|cloudflare:|@cloudflare\/|agents(?:\/|$))/;

const sources = async function* (include: (path: string) => boolean) {
  for await (const path of glob("**/*.ts", { cwd: src })) {
    if (include(path)) yield { path, source: await readFile(resolve(src, path), "utf8") };
  }
};

// Include type-only imports, re-exports, and dynamic imports, which a runtime import scan misses.
const importViolations = (path: string, source: string) =>
  Array.from(source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g))
    .map((match) => match[1])
    .filter((specifier) => specifier !== undefined)
    .filter((specifier) => {
      const target = specifier.startsWith("@/")
        ? resolve(src, "ui", specifier.slice(2))
        : resolve(src, dirname(path), specifier);
      return backendOnlyPackage.test(specifier) || target.startsWith(`${src}/platform/`);
    })
    .map((specifier) => `${path}: ${specifier}`);

it("backend domains don't depend on platform adapters, SDKs, or Cloudflare globals", async () => {
  const violations: Array<string> = [];
  for await (const { path, source } of sources(
    (path) => !path.startsWith("ui/") && !path.startsWith("platform/"),
  )) {
    violations.push(...importViolations(path, source));
    const globals =
      source.match(
        /\b(?:DurableObjectStorage|DurableObjectState|D1Database|Ai|ExecutionContext|SqlStorage)\b/g,
      ) ?? [];
    violations.push(...globals.map((name) => `${path}: ${name}`));
  }
  expect(violations).toEqual([]);
});

it("the UI doesn't depend on platform adapters or backend-only SDKs", async () => {
  const violations: Array<string> = [];
  for await (const { path, source } of sources((path) => path.startsWith("ui/"))) {
    violations.push(...importViolations(path, source));
  }
  expect(violations).toEqual([]);
});
