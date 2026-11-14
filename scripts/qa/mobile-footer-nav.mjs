import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const fixture = JSON.parse(fs.readFileSync(".qa-browser-state.json", "utf8"));
const root = "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const output = "qa-artifacts";
fs.mkdirSync(output, { recursive: true });

const configurations = [
  { audience: "studio", width: 390, height: 844, isMobile: true },
  { audience: "studio", width: 820, height: 1180, isMobile: true },
  { audience: "client", width: 390, height: 844, isMobile: true },
  { audience: "studio", width: 1280, height: 900, isMobile: false },
  { audience: "client", width: 1280, height: 900, isMobile: false },
];

const fail = (message) => { throw new Error(message); };
const results = [];

try {
  for (const config of configurations) {
    const tag = `${config.audience}-${config.width}`;
    const context = await browser.newContext({
      viewport: { width: config.width, height: config.height },
      isMobile: config.isMobile,
      hasTouch: config.isMobile,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.route("**/functions/v1/list-workspaces", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
        },
        body: JSON.stringify({
          workspaces: [{
            id: fixture.workspaceId,
            name: "Mobile Footer QA",
            slug: "mobile-footer-qa",
            type: "agency",
            owner_id: fixture.userId,
            role: config.audience === "client" ? "client" : "owner",
          }],
        }),
      });
    });

    try {
      await page.goto(root + "/auth", { waitUntil: "domcontentloaded" });
      await page.locator('input[type="email"]').fill(fixture.email);
      await page.locator('input[type="password"]').fill(fixture.password);
      await page.getByRole("button", { name: /sign in/i }).last().click();
      await page.waitForURL((url) => url.pathname !== "/auth", { timeout: 30000 });

      const navName = config.audience === "client"
        ? "Client mobile navigation" : "Studio mobile navigation";
      const footer = page.getByRole("navigation", { name: navName });
      const destinations = config.audience === "client"
        ? ["/client", "/client/projects", "/client/approvals"]
        : ["/", "/projects", "/tasks"];

      if (config.isMobile) {
        await footer.waitFor({ state: "visible", timeout: 30000 });
        const links = footer.getByRole("link");
        if (await links.count() !== 3) fail("Footer must have exactly three links");
        const hrefs = await links.evaluateAll((elements) =>
          elements.map((element) => new URL(element.href).pathname));
        if (JSON.stringify(hrefs) !== JSON.stringify(destinations)) {
          fail("Incorrect footer destinations: " + JSON.stringify(hrefs));
        }

        const geometry = await footer.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const content = document.querySelector(".mobile-nav-content");
          return {
            bottom: rect.bottom,
            viewport: window.innerHeight,
            footerHeight: rect.height,
            contentPadding: parseFloat(getComputedStyle(content).paddingBottom),
            horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
          };
        });
        if (Math.abs(geometry.bottom - geometry.viewport) > 2) fail("Footer is not anchored to viewport bottom");
        if (geometry.contentPadding < geometry.footerHeight + 12) fail("Main content lacks footer clearance");
        if (geometry.horizontalOverflow) fail("Mobile viewport has horizontal overflow");

        await page.goto(root + destinations[1], { waitUntil: "domcontentloaded" });
        await footer.getByRole("link", { name: "Projects" }).waitFor({ state: "visible" });
        if (await footer.getByRole("link", { name: "Projects" }).getAttribute("aria-current") !== "page") {
          fail("Projects navigation state is incorrect");
        }
        await footer.getByRole("link", { name: config.audience === "client" ? /Approvals/ : "Tasks" }).click();
        await page.waitForURL((url) => url.pathname === destinations[2]);
        if (await footer.getByRole("link", { name: config.audience === "client" ? /Approvals/ : "Tasks" })
          .getAttribute("aria-current") !== "page") fail("Third destination did not become active");

        await page.getByRole("button", { name: "Open navigation" }).click();
        await page.getByRole("dialog").waitFor({ state: "visible" });
        const secondary = page.getByRole("dialog").getByRole("link", { name: "Activity" });
        if (await secondary.count() === 0) fail("Secondary Activity destination is missing from the menu");
        if (await footer.isVisible()) fail("Footer must be hidden while navigation drawer is open");
        await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
        await footer.waitFor({ state: "visible" });

        await page.evaluate(() => {
          const input = document.createElement("input");
          input.id = "mobile-footer-keyboard-probe";
          document.body.append(input);
          input.focus();
        });
        await page.waitForFunction(() =>
          getComputedStyle(document.querySelector(".mobile-bottom-nav")).display === "none");
        await page.evaluate(() => document.getElementById("mobile-footer-keyboard-probe").remove());
        await footer.waitFor({ state: "visible" });
      } else {
        await footer.waitFor({ state: "hidden" });
        const sidebarName = config.audience === "client" ? "Client navigation" : "Workspace navigation";
        await page.getByRole("navigation", { name: sidebarName }).waitFor({ state: "visible" });
      }

      await page.screenshot({ path: path.join(output, `mobile-footer-${tag}.png`), fullPage: true });
      if (errors.length) fail("Unhandled page errors: " + errors.join(" / "));
      results.push({ viewport: tag, result: "PASS" });
      console.log(`PASS ${tag}: role routes, desktop/mobile visibility, safe area and editor behaviour`);
    } catch (error) {
      results.push({ viewport: tag, result: "FAIL", message: String(error?.message ?? error) });
      console.error(`FAIL ${tag}: ${String(error?.message ?? error)}`);
      await page.screenshot({ path: path.join(output, `mobile-footer-${tag}-failure.png`), fullPage: true }).catch(() => {});
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, "mobile-footer-results.json"), JSON.stringify(results, null, 2));
}

if (results.some((result) => result.result === "FAIL")) process.exitCode = 1;
