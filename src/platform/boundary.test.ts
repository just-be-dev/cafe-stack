import { expect, it } from "@effect/vitest";
import { glob, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The `no-restricted-imports` overrides in oxlint.config.ts mirror these checks for fast editor
// feedback. This test stays authoritative: it resolves paths exactly, including the UI's `@/`
// alias, and scans backend code for Cloudflare globals.

const src = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const e2e = resolve(src, "..", "e2e");
const backendOnlyPackage = /^(alchemy|cloudflare:|@cloudflare\/|agents(?:\/|$))/;

const sources = async function* (include: (path: string) => boolean, root = src) {
  for await (const path of glob("**/*.ts", { cwd: root })) {
    if (include(path)) yield { path, source: await readFile(resolve(root, path), "utf8") };
  }
};

// Include type-only imports, re-exports, and dynamic imports, which a runtime import scan misses.
const importSpecifiers = (source: string) =>
  Array.from(source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g))
    .map((match) => match[1])
    .filter((specifier) => specifier !== undefined);

// Resolves relative and `@/` specifiers to absolute paths; packages resolve to undefined.
const resolveSpecifier = (path: string, specifier: string, root = src) =>
  specifier.startsWith("@/")
    ? resolve(src, "ui", specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(root, dirname(path), specifier)
      : undefined;

const importViolations = (path: string, source: string, root = src) =>
  importSpecifiers(source)
    .filter(
      (specifier) =>
        backendOnlyPackage.test(specifier) ||
        (resolveSpecifier(path, specifier, root)?.startsWith(`${src}/platform/`) ?? false),
    )
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

// Browser tests answer the UI with the portable routes in src/api.ts, never the Workers.
it("browser tests don't depend on platform adapters or backend-only SDKs", async () => {
  const violations: Array<string> = [];
  for await (const { path, source } of sources(() => true, e2e)) {
    violations.push(...importViolations(path, source, e2e).map((violation) => `e2e/${violation}`));
  }
  expect(violations).toEqual([]);
});

// Tests may wire the real server to the real client; shipped UI code may not.
const sharedWithUi = [resolve(src, "rpc.ts"), resolve(src, "model.ts")];

it("the UI bundle reaches backend code only through the shared contract and models", async () => {
  const violations: Array<string> = [];
  for await (const { path, source } of sources(
    (path) => path.startsWith("ui/") && !path.endsWith(".test.ts"),
  )) {
    for (const specifier of importSpecifiers(source)) {
      const target = resolveSpecifier(path, specifier);
      if (target === undefined) continue;
      if (!target.startsWith(`${src}/ui/`) && !sharedWithUi.includes(target)) {
        violations.push(`${path}: ${specifier}`);
      }
    }
  }
  expect(violations).toEqual([]);
});
