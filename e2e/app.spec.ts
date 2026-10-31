import { type Page, expect, test } from "@playwright/test";
import {
  TEST_APP_NAME,
  answerApiWith,
  dropApiRequests,
  gatedAppInfo,
  rpcPath,
  serveApi,
} from "./api.ts";
import {
  applySiteHeaders,
  assertLoadedCleanly,
  expectFocusVisible,
  greetingForm,
  heading,
  submitGreeting,
  tabKeys,
} from "./page.ts";

const greetingStatus = (page: Page) =>
  page.getByRole("region", { name: "RPC example" }).locator("[aria-live=polite]");

test.beforeEach(async ({ page }) => {
  await applySiteHeaders(page);
});

test("boots under the shipped CSP without page errors, console errors, or failed requests", async ({
  page,
}) => {
  await serveApi(page);
  await assertLoadedCleanly(page);
  await expect(page).toHaveTitle("Project starter");
});

test("Increment counts up and Reset returns to zero", async ({ page }) => {
  await page.goto("./");
  const counter = page.getByRole("region", { name: "Counter example" });
  await counter.getByRole("button", { name: "Increment" }).click();
  await counter.getByRole("button", { name: "Increment" }).click();
  await counter.getByRole("button", { name: "Increment" }).click();
  await expect(counter.getByText("Count: 3")).toBeVisible();
  await counter.getByRole("button", { name: "Reset" }).click();
  await expect(counter.getByText("Count: 0")).toBeVisible();
});

test("a valid name posts one Greet RPC and shows the greeting the API returns", async ({
  page,
}) => {
  const requested = await serveApi(page);
  await page.goto("./");
  await expect(greetingStatus(page)).toHaveText("No greeting yet.");
  await submitGreeting(page, "  Ada  ");
  await expect(greetingStatus(page)).toHaveText(`Hello, Ada! (from ${TEST_APP_NAME})`);
  expect(requested).toEqual([rpcPath()]);
});

test("a reserved name renders the API's typed ReservedName failure", async ({ page }) => {
  await serveApi(page);
  await page.goto("./");
  await submitGreeting(page, "Admin");
  await expect(greetingStatus(page)).toHaveText("“Admin” is reserved. Try another name.");
});

for (const [label, name] of [
  ["an empty name", ""],
  ["a blank name", "   "],
  ["a 41-character name", "a".repeat(41)],
] as const) {
  test(`${label} is rejected in the browser without calling the API`, async ({ page }) => {
    const requested = await serveApi(page);
    await page.goto("./");
    await submitGreeting(page, name);
    await expect(greetingStatus(page)).toHaveText("Enter a name of 1 to 40 characters.");
    const field = page.getByLabel("Your name");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription("1 to 40 characters.");
    expect(requested).toEqual([]);
  });
}

test("a 40-character name is accepted", async ({ page }) => {
  await serveApi(page);
  await page.goto("./");
  const name = "a".repeat(40);
  await submitGreeting(page, name);
  await expect(greetingStatus(page)).toHaveText(`Hello, ${name}! (from ${TEST_APP_NAME})`);
});

test("Greet is disabled while a call is in flight and the status names the request", async ({
  page,
}) => {
  const info = gatedAppInfo();
  try {
    await serveApi(page, { info: info.layer });
    await page.goto("./");
    await submitGreeting(page, "Ada");
    await expect(greetingStatus(page)).toHaveText("Greeting Ada…");
    await expect(greetingForm(page).greet).toBeDisabled();
    info.release();
    await expect(greetingStatus(page)).toHaveText(`Hello, Ada! (from ${TEST_APP_NAME})`);
    await expect(greetingForm(page).greet).toBeEnabled();
  } finally {
    info.release();
  }
});

for (const [label, breakApi] of [
  ["a network failure", dropApiRequests],
  ["a non-RPC 503 answer", (page: Page) => answerApiWith(page, 503)],
] as const) {
  test(`${label} shows Unavailable, and retrying after recovery succeeds`, async ({ page }) => {
    await serveApi(page);
    await page.goto("./");
    const restoreApi = await breakApi(page);
    await submitGreeting(page, "Ada");
    await expect(greetingStatus(page)).toHaveText("The API didn't answer. Try again.");
    await restoreApi();
    await greetingForm(page).greet.click();
    await expect(greetingStatus(page)).toHaveText(`Hello, Ada! (from ${TEST_APP_NAME})`);
  });
}

test("keyboard users reach every control with a visible focus ring and submit with Enter", async ({
  page,
  browserName,
}) => {
  const requested = await serveApi(page);
  await page.goto("./");
  await expect(heading(page)).toBeVisible();
  const keys = tabKeys(browserName);
  const increment = page.getByRole("button", { name: "Increment" });
  const reset = page.getByRole("button", { name: "Reset" });
  const form = greetingForm(page);

  await page.keyboard.press(keys.next);
  await expectFocusVisible(increment);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await expect(page.getByText("Count: 2")).toBeVisible();

  await page.keyboard.press(keys.next);
  await expectFocusVisible(reset);
  await page.keyboard.press(keys.next);
  await expectFocusVisible(form.name);
  await page.keyboard.press(keys.next);
  await expectFocusVisible(form.greet);
  await page.keyboard.press(keys.previous);
  await expect(form.name).toBeFocused();

  await page.keyboard.type("Grace");
  await page.keyboard.press("Enter");
  await expect(greetingStatus(page)).toHaveText(`Hello, Grace! (from ${TEST_APP_NAME})`);
  await expect(form.name).toBeFocused();
  expect(requested).toEqual([rpcPath()]);
});
