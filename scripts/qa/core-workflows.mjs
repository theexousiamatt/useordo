import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const fixture = JSON.parse(fs.readFileSync(".qa-browser-state.json", "utf8"));
const db = createClient(process.env.QA_SUPABASE_URL, process.env.QA_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const base = "http://127.0.0.1:4173";
fs.mkdirSync("qa-artifacts", { recursive: true });
const today = new Date().toISOString().slice(0, 10);
const assigned = await db.from("tasks").update({
  assignee_id: fixture.userId, due_date: today,
}).eq("id", fixture.normalTaskId).select("id").single();
if (assigned.error) throw assigned.error;
const submission = await db.from("deliverables").insert({
  workspace_id: fixture.workspaceId,
  project_id: fixture.projectId,
  title: "QA homepage concept",
  description: "Review the homepage hierarchy and mobile layout before approving.",
  status: "submitted",
  requires_approval: true,
  created_by: fixture.userId,
}).select("id").single();
if (submission.error) throw submission.error;
const notification = await db.from("notifications").insert({
  workspace_id: fixture.workspaceId,
  user_id: fixture.userId,
  type: "task_assigned",
  title: "QA task assigned",
  body: "Test that inbox messages open the relevant task.",
  url: "/tasks",
}).select("id").single();
if (notification.error) throw notification.error;

const cases = [
  { role: "owner", viewport: { width: 390, height: 844 }, label: "studio-mobile" },
  { role: "owner", viewport: { width: 1366, height: 900 }, label: "studio-desktop" },
  { role: "client", viewport: { width: 390, height: 844 }, label: "client-mobile" },
];
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const reports = [];

try {
  for (const config of cases) {
    const context = await browser.newContext({
      viewport: config.viewport,
      isMobile: config.viewport.width < 1000,
      hasTouch: config.viewport.width < 1000,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/functions/v1/list-workspaces", (route) => route.fulfill({
      status: 200, contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      },
      body: JSON.stringify({ workspaces: [{
        id: fixture.workspaceId, name: "QA Studio", type: "agency",
        slug: "qa-studio", owner_id: fixture.userId, role: config.role,
      }] }),
    }));
    try {
      await page.goto(base + "/auth", { waitUntil: "domcontentloaded" });
      await page.locator('input[type="email"]').fill(fixture.email);
      await page.locator('input[type="password"]').fill(fixture.password);
      await page.getByRole("button", { name: /sign in/i }).last().click();
      await page.waitForURL((url) => url.pathname !== "/auth", { timeout: 30000 });
      if (config.role === "owner") {
        await page.goto(base + "/tasks?view=today", { waitUntil: "domcontentloaded" });
        await page.getByRole("heading", { name: "My Tasks" }).waitFor();
        await page.getByText("QA ordinary task", { exact: true }).waitFor();
        await page.getByRole("tab", { name: /Overdue/ }).click();
        await page.getByRole("tab", { name: /Overdue/ }).getAttribute("aria-selected").then((value) => {
          if (value !== "true") throw Error("Overdue task tab didn't become active");
        });

        await page.goto(base + "/inbox", { waitUntil: "domcontentloaded" });
        await page.getByRole("heading", { name: "Inbox" }).waitFor();
        await page.getByText("QA task assigned", { exact: true }).waitFor();
        await page.getByRole("button", { name: /Unread/ }).click();
        await page.getByText("QA task assigned", { exact: true }).waitFor();

        await page.goto(base + "/", { waitUntil: "domcontentloaded" });
        await page.getByRole("heading", { name: "Overview" }).waitFor();
        await page.getByRole("button", { name: "My tasks" }).waitFor();
        await page.getByRole("button", { name: "Inbox" }).waitFor();
      } else {
        await page.goto(base + "/client/approvals", { waitUntil: "domcontentloaded" });
        await page.getByRole("heading", { name: "Approvals" }).waitFor();
        await page.getByText("QA homepage concept", { exact: true }).waitFor();
        await page.getByText(/Review the homepage hierarchy/).waitFor();
        await page.getByRole("button", { name: "Request changes" }).click();
        await page.getByRole("textbox", { name: "Revision feedback" }).waitFor();
        const submit = page.getByRole("button", { name: "Send feedback" });
        if (await submit.isEnabled()) throw Error("Sending empty revision feedback must be disabled");
        await page.getByRole("textbox", { name: "Revision feedback" }).fill("Adjust headline and contrast.");
        if (!(await submit.isEnabled())) throw Error("Valid revision feedback should enable submission");
        await page.getByRole("button", { name: "Cancel" }).click();
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      if (overflow) throw Error("Page has horizontal overflow");
      if (errors.length) throw Error("Browser errors: " + errors.join(", "));
      await page.screenshot({ path: path.join("qa-artifacts", `core-${config.label}.png`), fullPage: true });
      reports.push({ label: config.label, status: "PASS" });
      console.log("PASS " + config.label);
    } catch (error) {
      reports.push({ label: config.label, status: "FAIL", error: String(error?.message ?? error) });
      console.error("FAIL " + config.label + ": " + String(error?.message ?? error));
      console.error("DEBUG " + config.label + " URL: " + page.url());
      console.error("DEBUG " + config.label + " PAGE: " + (await page.locator("body").innerText().catch(() => "")).slice(0, 1500));
      console.error("DEBUG " + config.label + " BROWSER ERRORS: " + errors.join(" / "));
      await page.screenshot({ path: path.join("qa-artifacts", `core-${config.label}-failed.png`), fullPage: true }).catch(() => {});
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  fs.writeFileSync("qa-artifacts/core-workflows-results.json", JSON.stringify(reports, null, 2));
}

if (reports.some((report) => report.status === "FAIL")) process.exitCode = 1;
