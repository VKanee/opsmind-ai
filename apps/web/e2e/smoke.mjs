import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const webUrl = process.env.OPSMIND_WEB_URL ?? "http://127.0.0.1:5173";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const screenshotDir = process.env.E2E_SCREENSHOT_DIR;

async function login(page) {
  await page.goto(webUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await page.getByRole("heading", { name: "Operations overview" }).waitFor({
    timeout: 15_000,
  });
}

async function screenshot(page, name) {
  if (!screenshotDir) return;
  await fs.mkdir(screenshotDir, { recursive: true });
  await page.screenshot({
    path: `${screenshotDir}/${name}.png`,
    fullPage: true,
  });
}

const browser = await chromium.launch({
  headless: true,
  executablePath: executablePath || undefined,
  args: ["--disable-gpu"],
});

try {
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await desktopContext.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await login(page);
  await screenshot(page, "e2e-dashboard");
  await page.getByRole("link", { name: "Open incident queue" }).click();
  await page
    .locator("a.incident-row")
    .filter({ hasText: "Checkout API latency spike after release" })
    .click();
  await page.getByText("RCA workspace").waitFor({ timeout: 15_000 });
  assert.match(await page.locator("body").innerText(), /Evidence chain/);
  assert.match(await page.locator("body").innerText(), /Human approval required/);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/investigations") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Re-run/ }).click();
  const rerunResponse = await responsePromise;
  assert.equal(rerunResponse.status(), 201);
  await screenshot(page, "e2e-incident");

  await page.getByRole("link", { name: "Approvals" }).click();
  await page.getByRole("heading", { name: "Approval queue" }).waitFor();
  assert.match(await page.locator("body").innerText(), /awaiting decision/);

  await page.getByRole("link", { name: "Knowledge" }).click();
  await page.getByRole("heading", { name: "Knowledge base" }).waitFor();
  await page
    .getByRole("textbox", { name: "Search knowledge base" })
    .fill("checkout latency database pool");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByText(/Top evidence for/).waitFor();
  assert.match(await page.locator("body").innerText(), /Checkout latency runbook/);
  assert.deepEqual(errors, []);

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const mobilePage = await mobileContext.newPage();
  await login(mobilePage);
  const overflow = await mobilePage.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.equal(overflow.scrollWidth, overflow.clientWidth);
  await mobilePage.getByRole("button", { name: "Open navigation" }).click();
  await mobilePage.getByRole("link", { name: "Incidents" }).click();
  await mobilePage.getByRole("heading", { name: "Incident queue" }).waitFor();
  await mobilePage.waitForTimeout(300);
  const mobileOverflow = await mobilePage.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.equal(mobileOverflow.scrollWidth, mobileOverflow.clientWidth);
  await screenshot(mobilePage, "e2e-mobile");

  const viewerContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const viewerPage = await viewerContext.newPage();
  await viewerPage.goto(webUrl, { waitUntil: "networkidle" });
  await viewerPage.getByRole("button", { name: "Viewer" }).click();
  await viewerPage.getByRole("button", { name: "Enter workspace" }).click();
  await viewerPage.getByRole("heading", { name: "Operations overview" }).waitFor();
  await viewerPage.getByRole("link", { name: "Incidents", exact: true }).click();
  await viewerPage.getByRole("heading", { name: "Incident queue" }).waitFor();
  assert.equal(
    await viewerPage.getByRole("button", { name: "New incident" }).count(),
    0,
  );

  console.log("OpsMind browser smoke test passed.");
} finally {
  await browser.close();
}
