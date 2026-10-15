import { expect, it } from "@effect/vitest";
import { glob, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

it("backend domains don't depend on platform adapters, SDKs, or Cloudflare globals", async () => {
  const src = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const violations: Array<string> = [];
  for await (const path of glob("**/*.ts", { cwd: src })) {
    if (path.startsWith("ui/") || path.startsWith("platform/")) continue;
    const source = await readFile(resolve(src, path), "utf8");
    // Include type-only imports and re-exports, which don't appear in a runtime import scan.
    for (const match of source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier === undefined) continue;
      const target = resolve(src, dirname(path), specifier);
      if (
        /^(alchemy|cloudflare:|@cloudflare\/|agents(?:\/|$))/.test(specifier) ||
        target.startsWith(`${src}/platform/`)
      ) {
        violations.push(`${path}: ${specifier}`);
      }
    }
    const globals =
      source.match(
        /\b(?:DurableObjectStorage|DurableObjectState|D1Database|Ai|ExecutionContext|SqlStorage)\b/g,
      ) ?? [];
    violations.push(...globals.map((name) => `${path}: ${name}`));
  }
  expect(violations).toEqual([]);
});
