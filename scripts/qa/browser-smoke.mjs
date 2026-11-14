// Isolated browser QA using the real local Supabase task API.
// Only workspace-discovery (a separate edge function) is stubbed.
// Runs at desktop and mobile widths, with refreshes between mutations.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const fixture=JSON.parse(fs.readFileSync(".qa-browser-state.json","utf8"));
const base="http://127.0.0.1:4173";
const admin=createClient(process.env.QA_SUPABASE_URL,process.env.QA_SUPABASE_SERVICE_ROLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false},
});
fs.mkdirSync("qa-artifacts",{recursive:true});
const reports=[];
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});

async function verify(label,fn,context){
  try{
    await fn();
    reports.push({viewport:context.label,case:label,result:"PASS"});
    console.log(`PASS [${context.label}] ${label}`);
    return true;
  }catch(e){
    const msg=String(e?.message??e).slice(0,650);
    reports.push({viewport:context.label,case:label,result:"FAIL",error:msg});
    console.error(`FAIL [${context.label}] ${label}: ${msg}`);
    try{await context.page.screenshot({path:path.join("qa-artifacts",`${context.label}-fail-${reports.length}.png`),fullPage:true});}catch{}
    return false;
  }
}
async function openProject(ctx){
  await ctx.page.goto(`${base}/projects/${fixture.projectId}`,{waitUntil:"domcontentloaded"});
  await ctx.page.getByRole("heading",{name:"Ordo Browser QA"}).waitFor({state:"visible",timeout:30000});
  await ctx.page.getByRole("button",{name:"Task: QA Done-stage task"}).waitFor({state:"visible",timeout:30000});
}
async function rowFromDB(title){
  const {data,error}=await admin.from("tasks")
    .select("id,title,stage_id,completed_at,archived_at")
    .eq("project_id",fixture.projectId).eq("title",title).maybeSingle();
  if(error)throw error;
  return data;
}
for(const viewport of [
  {label:"desktop",width:1440,height:900},
  {label:"mobile",width:390,height:844,isMobile:true,hasTouch:true},
]){
  const context=await browser.newContext({
    viewport:{width:viewport.width,height:viewport.height},
    isMobile:!!viewport.isMobile,hasTouch:!!viewport.hasTouch,
    deviceScaleFactor:1,
  });
  const page=await context.newPage();
  page.setDefaultTimeout(15000);
  const ctx={page,label:viewport.label};

  // Only intercept workspace discovery; task, stage, label, auth and
  // checklist API calls go to the real disposable local database.
  await page.route("**/functions/v1/list-workspaces",async route=>{
    await route.fulfill({status:200,contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type","Access-Control-Allow-Methods":"POST, OPTIONS, GET"},
      body:JSON.stringify({workspaces:[{
        id:fixture.workspaceId,name:"Browser QA Workspace",slug:"browser-qa",
        type:"agency",owner_id:fixture.userId,role:"owner",
      }]})});
  });

  const authOk=await verify("authenticated sign-in and project board",async()=>{
    await page.goto(`${base}/auth`,{waitUntil:"domcontentloaded"});
    await page.locator('input[type="email"]').fill(fixture.email);
    await page.locator('input[type="password"]').fill(fixture.password);
    await page.getByRole("button",{name:/sign in/i}).last().click();
    await openProject(ctx);
  },ctx);
  if(!authOk){await context.close();continue;}

  await verify("stage named Done is neutral; incomplete task still shows real 1/2 checklist",async()=>{
    const card=page.getByRole("button",{name:"Task: QA Done-stage task"});
    await card.getByRole("button",{name:"Mark task complete"}).waitFor({state:"visible"});
    await card.getByRole("progressbar",{name:"Subtask completion"}).waitFor({state:"visible"});
    if(!(await card.innerText()).includes("50%"))throw Error("Expected 50% checklist progress");
  },ctx);

  const newTitle=`QA ${viewport.label} created task`;
  await verify("create task in Backlog and persist after reload",async()=>{
    await page.getByRole("button",{name:"Add task to Backlog"}).click();
    await page.getByPlaceholder("Task title…").fill(newTitle);
    await page.getByRole("button",{name:"Add",exact:true}).click();
    await page.getByRole("button",{name:`Task: ${newTitle}`}).waitFor({state:"visible"});
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByRole("button",{name:`Task: ${newTitle}`}).waitFor({state:"visible"});
    if(!(await rowFromDB(newTitle)))throw Error("Created task missing from server after reload");
  },ctx);

  await verify("complete/reopen task independently of stage; persist after refresh",async()=>{
    await page.getByRole("button",{name:`Task: ${newTitle}`})
      .getByRole("button",{name:"Mark task complete"}).click();
    await page.getByRole("button",{name:`Task: ${newTitle}`})
      .getByRole("button",{name:"Reopen task"}).waitFor({state:"visible"});
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByRole("button",{name:`Task: ${newTitle}`})
      .getByRole("button",{name:"Reopen task"}).waitFor({state:"visible"});
    const completed=await rowFromDB(newTitle);
    if(!completed?.completed_at)throw Error("Completion timestamp missing in persisted DB");
    await page.getByRole("button",{name:`Task: ${newTitle}`})
      .getByRole("button",{name:"Reopen task"}).click();
    await page.reload({waitUntil:"domcontentloaded"});
    if((await rowFromDB(newTitle))?.completed_at)throw Error("Reopening did not persist");
  },ctx);

  await verify("open task drawer and update checklist after reload",async()=>{
    await page.getByRole("button",{name:"Task: QA Done-stage task"}).click();
    await page.getByRole("checkbox",{name:"Mark QA checklist two complete"}).click();
    await page.getByText("2 of 2 complete").waitFor({state:"visible"});
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByRole("button",{name:"Task: QA Done-stage task"}).click();
    await page.getByText("2 of 2 complete").waitFor({state:"visible"});
    // Restore baseline for the other viewport run.
    await page.getByRole("checkbox",{name:"Mark QA checklist two incomplete"}).click();
    await page.reload({waitUntil:"domcontentloaded"});
  },ctx);

  await verify("create a custom stage and retain it after refresh",async()=>{
    await page.getByRole("button",{name:"Add stage"}).click();
    await page.getByLabel("Stage name").fill(`QA ${viewport.label} review`);
    await page.getByRole("button",{name:"Create stage"}).click();
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByText(`QA ${viewport.label} review`,{exact:true}).waitFor({state:"visible"});
    const {data,error}=await admin.from("project_stages").select("id,name,theme")
      .eq("project_id",fixture.projectId).eq("name",`QA ${viewport.label} review`).single();
    if(error||!data?.id)throw Error("Stage did not persist in real database");
  },ctx);

  await verify("mobile/desktop board has no document-level horizontal overflow",async()=>{
    const documentOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
    if(documentOverflow)throw Error("Whole document overflows; board should scroll internally");
  },ctx);
  await page.screenshot({path:path.join("qa-artifacts",`${viewport.label}-board.png`),fullPage:true});
  await context.close();
}
await browser.close();
fs.writeFileSync("qa-artifacts/results.json",JSON.stringify(reports,null,2));
const failures=reports.filter(r=>r.result==="FAIL");
console.log(`Browser cases: ${reports.length-failures.length}/${reports.length} passed`);
if(failures.length)process.exitCode=1;
