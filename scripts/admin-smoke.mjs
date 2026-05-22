import { chromium } from "@playwright/test";
import process from "node:process";

const baseUrl = process.env.ADMIN_SMOKE_BASE_URL || "https://yunginz.com";
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
}

const previewUrl =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/previews/sample-preview.mp3";
const tempBeatTitle = `Codex Smoke ${Date.now()}`;
const tempBeatSlug = `codex-smoke-${Date.now()}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
const responseLog = [];

const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});

page.on("response", async (response) => {
  if (response.url().includes("/admin") || response.url().includes("/api")) {
    responseLog.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  }
});

page.on("pageerror", (error) => {
  consoleErrors.push(error.message);
});

async function expectVisible(locator, message) {
  await locator.waitFor({ state: "visible", timeout: 20000 });
  if (!(await locator.isVisible())) {
    throw new Error(message);
  }
}

try {
  await page.goto(`${baseUrl}/admin/login`, { waitUntil: "networkidle" });

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/admin", { timeout: 20000 });

  await expectVisible(page.getByRole("heading", { name: /beat management/i }), "Admin did not load.");
  await expectVisible(page.getByText("Add a new beat"), "Add beat section missing.");
  await expectVisible(page.getByPlaceholder("Search title, slug, genre, mood"), "Search field missing.");

  await page.getByText("Add a new beat").click();
  await page.waitForTimeout(400);

  await page.locator('input[name="title"]').first().fill(tempBeatTitle);
  await page.locator('input[name="slug"]').first().fill(tempBeatSlug);
  await page.locator('input[name="previewMp3Url"]').first().evaluate((el, value) => {
    el.value = value;
  }, previewUrl);
  await page.locator('input[name="bpm"]').first().fill("140");
  await page.locator('input[name="mood"]').first().fill("Focused");
  await page.locator('input[type="hidden"][name="genre"]').first().evaluate((el) => {
    el.value = "Trap";
  });
  await page.locator('input[name="tags"]').first().fill("smoke, test");
  await page.getByRole("button", { name: /^save beat$/i }).first().click();

  await page.waitForLoadState("networkidle");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByPlaceholder("Search title, slug, genre, mood").fill(tempBeatTitle);
  await page.getByRole("button", { name: /^search$/i }).click();
  await page.waitForLoadState("networkidle");

  const tempBeatSummary = page.getByText(tempBeatTitle).first();
  await expectVisible(tempBeatSummary, "Created beat was not found by search.");
  await tempBeatSummary.click();
  await page.waitForTimeout(400);

  const moodInputs = page.locator('input[name="mood"]');
  await moodInputs.last().fill("Polished");
  const beatSaveButtons = page.getByRole("button", { name: /^save beat$/i });
  await beatSaveButtons.last().click();
  await page.waitForLoadState("networkidle");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByPlaceholder("Search title, slug, genre, mood").fill(tempBeatTitle);
  await page.getByRole("button", { name: /^search$/i }).click();
  await page.waitForLoadState("networkidle");
  await page.getByText(tempBeatTitle).first().click();
  await page.waitForTimeout(400);

  const basicLicense = page.getByText("Basic").last();
  if (await basicLicense.isVisible()) {
    await basicLicense.click();
    await page.waitForTimeout(200);
    const mp3LinkInputs = page.locator('input[name="mp3Link"]');
    if ((await mp3LinkInputs.count()) > 0) {
      await mp3LinkInputs.first().fill("https://dropbox.com/smoke-basic-mp3");
      await page.getByRole("button", { name: /^save license$/i }).first().click();
      await page.waitForLoadState("networkidle");
      await page.reload({ waitUntil: "networkidle" });
      await page.getByPlaceholder("Search title, slug, genre, mood").fill(tempBeatTitle);
      await page.getByRole("button", { name: /^search$/i }).click();
      await page.waitForLoadState("networkidle");
      await page.getByText(tempBeatTitle).first().click();
      await page.waitForTimeout(400);
    }
  }

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole("button", { name: /^delete beat$/i }).first().click();
  await page.waitForLoadState("networkidle");

  await page.getByPlaceholder("Search title, slug, genre, mood").fill(tempBeatTitle);
  await page.getByRole("button", { name: /^search$/i }).click();
  await page.waitForLoadState("networkidle");

  const stillVisible = await page.getByText(tempBeatTitle, { exact: true }).first().isVisible().catch(() => false);
  if (stillVisible) {
    await page.screenshot({ path: "admin-smoke-delete-failed.png", fullPage: true });
    console.log("Response log:", responseLog.join("\n"));
    throw new Error("Beat delete did not remove the beat from the admin list.");
  }

  if (consoleErrors.length) {
    throw new Error(`Browser errors detected: ${consoleErrors.join(" | ")}`);
  }

  console.log("Admin smoke test passed.");
} finally {
  await browser.close();
}
