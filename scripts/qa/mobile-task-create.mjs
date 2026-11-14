import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const fixture = JSON.parse(fs.readFileSync(".qa-browser-state.json", "utf8"));
const url = "http://127.0.0.1:4173";
const db = createClient(process.env.QA_SUPABASE_URL, process.env.QA_SUPABASE_SERVICE_ROLE_KEY,{
  auth: { autoRefreshToken: false, persistSession: false },
});
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
fs.mkdirSync("qa-artifacts", { recursive: true });
const results = [];

async function eventually(test, label) {
  for(let i = 0; i < 40; i++){
    if(await test()) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(label);
}

async function persisted(title) {
  const { data, error } = await db.from("tasks")
    .select("id,title,stage_id,completed_at")
    .eq("project_id",fixture.projectId).eq("title",title).maybeSingle();
  if(error) throw error;
  return data;
}

for (const config of [
  { label:"desktop", width:1440, height:900, hasTouch:false, isMobile:false },
  { label:"mobile", width:390, height:844, hasTouch:true, isMobile:true },
]) {
  const context = await browser.newContext({
    viewport: { width:config.width, height:config.height },
    isMobile: config.isMobile,
    hasTouch: config.hasTouch,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", err => console.error("PAGE ERROR:",err.message));
  await page.route("**/functions/v1/list-workspaces",async route => {
    await route.fulfill({
      status:200, contentType:"application/json",
      headers:{
        "Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type",
        "Access-Control-Allow-Methods":"POST, OPTIONS, GET",
      },
      body:JSON.stringify({workspaces:[{
        id:fixture.workspaceId, name:"Browser QA Workspace",
        slug:"browser-qa",type:"agency",owner_id:fixture.userId,role:"owner",
      }]}),
    });
  });

  const test = async(name, execute) => {
    try {
      await execute();
      results.push({viewport:config.label,name,result:"PASS"});
      console.log(`PASS [${config.label}] ${name}`);
    } catch(err) {
      const reason = String(err?.message??err).slice(0,1500);
      results.push({viewport:config.label,name,result:"FAIL",reason});
      console.error(`FAIL [${config.label}] ${name}: ${reason}`);
      await page.screenshot({path:path.join("qa-artifacts",`${config.label}-${results.length}-failure.png`),fullPage:true}).catch(()=>{});
    }
  };

  let signedIn = false;
  await test("log in to isolated project",async()=>{
    await page.goto(url+"/auth",{waitUntil:"domcontentloaded"});
    await page.locator('input[type="email"]').fill(fixture.email);
    await page.locator('input[type="password"]').fill(fixture.password);
    await page.getByRole("button",{name:/sign in/i}).last().click();
    await page.waitForURL(next=>next.pathname!=="/auth",{timeout:30000});
    await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith("sb-")&&k.endsWith("-auth-token")));
    await page.goto(`${url}/projects/${fixture.projectId}`,{waitUntil:"domcontentloaded"});
    await page.getByRole("button",{name:"Task: QA ordinary task"}).waitFor({state:"visible",timeout:30000});
    signedIn=true;
  });
  if(!signedIn) { await context.close(); continue; }

  const createTitle = `QA ${config.label} touch task`;
  await test("tap stage add and submit with real touch / pointer coordinates",async()=>{
    const headerAdd=page.getByRole("button",{name:"Add task to Backlog"});
    const headerSize=await headerAdd.boundingBox();
    if(!headerSize||headerSize.width<40||headerSize.height<40)throw Error("Header Add hit area under 40px");
    if(config.hasTouch)await headerAdd.tap({timeout:10000});
    else await headerAdd.click({timeout:10000});
    const form=page.getByRole("form",{name:"New task in Backlog"});
    await form.waitFor({state:"visible"});
    const input=form.getByRole("textbox",{name:"Task title"});
    await input.fill(createTitle);
    const add=form.getByRole("button",{name:"Add",exact:true});
    const hit=await add.evaluate(el=>{
      const r=el.getBoundingClientRect();
      const target=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return {within:target===el||el.contains(target),tag:target?.tagName,className:target?.getAttribute("class")?.slice(0,100)};
    });
    if(!hit.within)throw Error("Task button center intercepted by "+JSON.stringify(hit));
    if(config.hasTouch)await add.tap({timeout:10000});
    else await add.click({timeout:10000});
    await eventually(async()=>Boolean(await persisted(createTitle)),"Task not stored after Add tap");
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByRole("button",{name:`Task: ${createTitle}`}).waitFor({state:"visible"});
  });

  const keyboardTitle=`QA ${config.label} keyboard task`;
  await test("keyboard Enter submits once and remains after refresh",async()=>{
    await page.getByRole("button",{name:"Add task to Backlog"}).click();
    const input=page.getByRole("form",{name:"New task in Backlog"}).getByRole("textbox",{name:"Task title"});
    await input.fill(keyboardTitle);
    await input.press("Enter");
    await eventually(async()=>Boolean(await persisted(keyboardTitle)),"Keyboard submit not stored");
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByRole("button",{name:`Task: ${keyboardTitle}`}).waitFor({state:"visible"});
    const {count,error}=await db.from("tasks").select("id",{count:"exact",head:true})
      .eq("project_id",fixture.projectId).eq("title",keyboardTitle);
    if(error||count!==1)throw Error(`Expected 1 keyboard-submitted task, got ${count}`);
  });

  await test("card open and menu still work after creating tasks",async()=>{
    await page.getByRole("button",{name:"Task: QA ordinary task"}).click();
    await page.getByRole("button",{name:"Mark complete"}).waitFor({state:"visible"});
  });

  await page.screenshot({path:path.join("qa-artifacts",`${config.label}-board-after-create.png`),fullPage:true});
  await context.close();
}
await browser.close();
fs.writeFileSync("qa-artifacts/mobile-create-results.json",JSON.stringify(results,null,2));
const fails=results.filter(x=>x.result==="FAIL");
console.log(`Mobile create QA: ${results.length-fails.length}/${results.length} passed`);
if(fails.length)process.exitCode=1;
