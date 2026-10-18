import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const webUrl = process.env.OPSMIND_WEB_URL ?? "http://127.0.0.1:5173";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const screenshotDir = process.env.E2E_SCREENSHOT_DIR;

async function login(page) {
  await page.goto(webUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "进入工作区" }).click();
  await page.getByRole("heading", { name: "运营总览" }).waitFor({
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
  await page.getByRole("link", { name: "打开事故队列" }).click();
  await page
    .locator("a.incident-row")
    .filter({ hasText: "checkout-api 发布后出现延迟突增" })
    .click();
  await page.getByText("根因分析工作台").waitFor({ timeout: 15_000 });
  assert.match(await page.locator("body").innerText(), /证据链/);
  assert.match(await page.locator("body").innerText(), /需要人工审批/);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/investigations") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /重新分析/ }).click();
  const rerunResponse = await responsePromise;
  assert.equal(rerunResponse.status(), 201);
  await screenshot(page, "e2e-incident");

  await page.getByRole("link", { name: "审批中心" }).click();
  await page.getByRole("heading", { name: "审批队列" }).waitFor();
  assert.match(await page.locator("body").innerText(), /等待决策/);

  await page.getByRole("link", { name: "知识库" }).click();
  await page.getByRole("heading", { name: "知识库" }).waitFor();
  await page
    .getByRole("textbox", { name: "搜索知识库" })
    .fill("结算 延迟 数据库 连接池");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await page.getByText(/的相关证据/).waitFor();
  assert.match(await page.locator("body").innerText(), /结算服务高延迟处置手册/);
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
  await mobilePage.getByRole("button", { name: "打开导航" }).click();
  await mobilePage.getByRole("link", { name: "事故中心" }).click();
  await mobilePage.getByRole("heading", { name: "事故队列" }).waitFor();
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
  await viewerPage.getByRole("button", { name: "只读用户" }).click();
  await viewerPage.getByRole("button", { name: "进入工作区" }).click();
  await viewerPage.getByRole("heading", { name: "运营总览" }).waitFor();
  await viewerPage.getByRole("link", { name: "事故中心", exact: true }).click();
  await viewerPage.getByRole("heading", { name: "事故队列" }).waitFor();
  assert.equal(
    await viewerPage.getByRole("button", { name: "新建事故" }).count(),
    0,
  );

  console.log("OpsMind browser smoke test passed.");
} finally {
  await browser.close();
}
