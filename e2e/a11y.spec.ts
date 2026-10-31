import { writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { type Page, type TestInfo, expect, test } from "@playwright/test";
import { TEST_APP_NAME, dropApiRequests, gatedAppInfo, serveApi } from "./api.ts";
import { applySiteHeaders, heading, submitGreeting } from "./page.ts";

/**
 * Runs axe on the whole page, saves the report and a full-page screenshot
 * beside the test's results, and fails softly so every state gets scanned.
 */
const checkState = async (page: Page, testInfo: TestInfo, state: string) => {
  // Scan resting colors: move the pointer off the last clicked button and let
  // its hover and re-enable transitions finish.
  await page.mouse.move(0, 0);
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running"),
  );
  const scan = await new AxeBuilder({ page }).analyze();
  const reportPath = testInfo.outputPath(`${state}-axe.json`);
  await writeFile(reportPath, JSON.stringify(scan, null, 2));
  await testInfo.attach(`${state}-axe`, { path: reportPath, contentType: "application/json" });
  await testInfo.attach(`${state}-screenshot`, {
    body: await page.screenshot({ fullPage: true, path: testInfo.outputPath(`${state}.png`) }),
    contentType: "image/png",
  });
  expect
    .soft(
      scan.violations.map((violation) => ({
        rule: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.slice(0, 5).map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
      `${state} accessibility violations`,
    )
    .toEqual([]);
  expect
    .soft(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      `${state} fits the viewport without horizontal scrolling`,
    )
    .toBe(true);
};

const status = (page: Page) =>
  page.getByRole("region", { name: "RPC example" }).locator("[aria-live=polite]");

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [320, 390, 1440]) {
    test(`every greeting state passes axe at ${width}px in ${colorScheme} mode`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await applySiteHeaders(page);
      const info = gatedAppInfo();
      try {
        await serveApi(page, { info: info.layer });
        await page.goto("./");
        await expect(heading(page)).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await checkState(page, testInfo, "idle");

        await page.getByRole("button", { name: "Increment" }).click();
        await submitGreeting(page, "");
        await expect(status(page)).toHaveText("Enter a name of 1 to 40 characters.");
        await checkState(page, testInfo, "invalid-name");

        await submitGreeting(page, "Ada");
        await expect(status(page)).toHaveText("Greeting Ada…");
        await checkState(page, testInfo, "loading");

        info.release();
        await expect(status(page)).toHaveText(`Hello, Ada! (from ${TEST_APP_NAME})`);
        await checkState(page, testInfo, "succeeded");

        await submitGreeting(page, "admin");
        await expect(status(page)).toHaveText("“admin” is reserved. Try another name.");
        await checkState(page, testInfo, "reserved-name");

        await dropApiRequests(page);
        await submitGreeting(page, "Ada");
        await expect(status(page)).toHaveText("The API didn't answer. Try again.");
        await checkState(page, testInfo, "unavailable");
      } finally {
        info.release();
      }
    });
  }
}
