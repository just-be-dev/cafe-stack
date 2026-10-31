import { readFileSync } from "node:fs";
import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Headers that `public/_headers` gives every path (`/*`), such as the CSP.
 * `vite preview` doesn't read that file, so `applySiteHeaders` adds them, and
 * the app is tested under the policy it ships with.
 */
const siteHeaders = (() => {
  const lines = readFileSync(new URL("../public/_headers", import.meta.url), "utf8").split("\n");
  const headers: Record<string, string> = {};
  let inSiteBlock = false;
  for (const line of lines) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      inSiteBlock = line.trim() === "/*";
      continue;
    }
    const separator = line.indexOf(":");
    if (inSiteBlock && separator > 0) {
      headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
    }
  }
  return headers;
})();

/** Serves documents with the headers from `public/_headers`. Register before `serveApi`. */
export const applySiteHeaders = async (page: Page) => {
  expect(siteHeaders["content-security-policy"]).toBeDefined();
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") {
      return route.fallback();
    }
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...siteHeaders } });
  });
};

/** Records uncaught page errors and console errors (CSP violations log there too). */
export const collectErrors = (page: Page) => {
  const errors: Array<string> = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
};

export const heading = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Your next project starts here." });

/**
 * Opens the app at the configured base URL and checks it booted without page
 * errors, console errors, or failed requests.
 */
export const assertLoadedCleanly = async (page: Page) => {
  const errors = collectErrors(page);
  page.on("requestfailed", (request) => errors.push(`requestfailed: ${request.url()}`));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`);
  });
  const response = await page.goto("./", { waitUntil: "networkidle" });
  expect(response?.headers()["content-security-policy"]).toBe(
    siteHeaders["content-security-policy"],
  );
  await expect(heading(page)).toBeVisible();
  await expect(page.getByText("Count: 0")).toBeVisible();
  expect(errors).toEqual([]);
};

export const greetingForm = (page: Page) => {
  const form = page.getByRole("form", { name: "Greeting" });
  return {
    name: form.getByLabel("Your name"),
    greet: form.getByRole("button", { name: "Greet" }),
  };
};

/** Fills the name and submits through the Greet button. */
export const submitGreeting = async (page: Page, name: string) => {
  const form = greetingForm(page);
  await form.name.fill(name);
  await form.greet.click();
};

/** WebKit on macOS only moves focus to buttons with Option+Tab. */
export const tabKeys = (browserName: string) => {
  const modifier = browserName === "webkit" && process.platform === "darwin" ? "Alt+" : "";
  return { next: `${modifier}Tab`, previous: `${modifier}Shift+Tab` };
};

/**
 * Checks the element has keyboard focus, matches `:focus-visible`, and draws
 * a visible indicator: an outline or a ring (box-shadow).
 */
export const expectFocusVisible = async (locator: Locator) => {
  await expect(locator).toBeFocused();
  await expect
    .poll(() =>
      locator.evaluate((element) => {
        const style = getComputedStyle(element);
        const hasOutline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
        return element.matches(":focus-visible") && (hasOutline || style.boxShadow !== "none");
      }),
    )
    .toBe(true);
};
