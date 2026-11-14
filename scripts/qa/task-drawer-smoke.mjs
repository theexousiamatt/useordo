import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const fixture = JSON.parse(fs.readFileSync(".qa-browser-state.json","utf8"));
const base = "http://127.0.0.1:4173";
const db = createClient(process.env.QA_SUPABASE_URL,process.env.QA_SUPABASE_SERVICE_ROLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false},
});
const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
fs.mkdirSync("qa-artifacts",{recursive:true});
const reports=[];

async function until(predicate,message){
  for(let i=0;i<40;i++){
    if(await predicate())return;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error(message);
}
for(const config of [
  {label:"desktop",width:1440,height:900,isMobile:false,hasTouch:false},
  {label:"mobile",width:390,height:844,isMobile:true,hasTouch:true},
]){
  const context=await browser.newContext({
    viewport:{width:config.width,height:config.height},
    hasTouch:config.hasTouch,isMobile:config.isMobile,deviceScaleFactor:1,
  });
  const page=await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror",error=>console.error(`PAGE ERROR [${config.label}]: ${error.message}`));
  await page.route("**/functions/v1/list-workspaces",async route=>{
    await route.fulfill({status:200,contentType:"application/json",headers:{
      "Access-Control-Allow-Origin":"*",
      "Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type",
      "Access-Control-Allow-Methods":"POST, OPTIONS, GET",
    },body:JSON.stringify({workspaces:[{
      id:fixture.workspaceId,name:"Browser QA Workspace",slug:"browser-qa",
      type:"agency",owner_id:fixture.userId,role:"owner",
    }]})});
  });
  async function check(name,work){
    try{
      await work();
      console.log(`PASS [${config.label}] ${name}`);
      reports.push({viewport:config.label,name,result:"PASS"});
    }catch(error){
      const reason=String(error?.message??error).slice(0,1300);
      console.error(`FAIL [${config.label}] ${name}: ${reason}`);
      reports.push({viewport:config.label,name,result:"FAIL",reason});
      await page.screenshot({path:path.join("qa-artifacts",`${config.label}-fail-${reports.length}.png`),fullPage:true}).catch(()=>{});
    }
  }
  async function openTask(name){
    await page.goto(`${base}/projects/${fixture.projectId}`,{waitUntil:"domcontentloaded"});
    await page.getByRole("button",{name:`Task: ${name}`}).waitFor({state:"visible",timeout:30000});
    await page.getByRole("button",{name:`Task: ${name}`}).click();
    const dialog=page.getByRole("dialog");
    await dialog.getByRole("heading",{name:`Task details: ${name}`}).waitFor({state:"visible"});
    return dialog;
  }
  let authed=false;
  await check("authenticate into disposable Ordo workspace",async()=>{
    await page.goto(base+"/auth",{waitUntil:"domcontentloaded"});
    await page.locator('input[type="email"]').fill(fixture.email);
    await page.locator('input[type="password"]').fill(fixture.password);
    await page.getByRole("button",{name:/sign in/i}).last().click();
    await page.waitForURL(location=>location.pathname!=="/auth",{timeout:30000});
    await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith("sb-")&&k.endsWith("-auth-token")));
    await page.goto(`${base}/projects/${fixture.projectId}`,{waitUntil:"domcontentloaded"});
    await page.getByRole("button",{name:"Task: QA ordinary task"}).waitFor({state:"visible",timeout:30000});
    authed=true;
  });
  if(!authed){await context.close();continue;}

  await check("one workspace shows properties, checklist, files and discussion without tab navigation",async()=>{
    const dialog=await openTask("QA Done-stage task");
    await dialog.getByRole("button",{name:"Change task stage"}).waitFor();
    await dialog.getByRole("button",{name:"Edit task assignees"}).waitFor();
    await dialog.getByRole("button",{name:"Edit task due date"}).waitFor();
    await dialog.getByRole("button",{name:"Edit task labels"}).waitFor();
    await dialog.getByRole("button",{name:"Mark task complete"}).waitFor();
    await dialog.getByRole("region",{name:"Checklist"}).waitFor();
    await dialog.getByRole("region",{name:"Discussion"}).waitFor();
    await dialog.getByRole("button",{name:"Activity history"}).waitFor();
    if(await dialog.getByRole("tab").count())throw Error("Legacy Overview/Comments/Activity tabs remain");
    await page.screenshot({path:path.join("qa-artifacts",`${config.label}-drawer.png`),fullPage:true});
  });

  const description=`QA ${config.label} updated brief`;
  await check("direct description edit saves and survives refresh",async()=>{
    let dialog=await openTask("QA ordinary task");
    await dialog.getByRole("button",{name:/^(Add a description|Edit task description)$/}).click();
    const field=dialog.getByRole("textbox",{name:"Task description"});
    await field.fill(description);
    await field.press("Tab");
    await until(async()=>{
      const {data,error}=await db.from("tasks").select("description").eq("id",fixture.normalTaskId).single();
      if(error)throw error;
      return data?.description===description;
    },"Description did not save");
    dialog=await openTask("QA ordinary task");
    await dialog.getByRole("button",{name:"Edit task description"}).getByText(description).waitFor({state:"visible"});
  });

  await check("stage editing is immediate and does not mark a task complete",async()=>{
    const dialog=await openTask("QA ordinary task");
    await dialog.getByRole("button",{name:"Change task stage"}).click();
    await page.getByRole("button",{name:"Done",exact:true}).last().click();
    await until(async()=>{
      const {data,error}=await db.from("tasks").select("stage_id,completed_at").eq("id",fixture.normalTaskId).single();
      if(error)throw error;
      return data?.stage_id===fixture.doneStageId&&data.completed_at===null;
    },"Stage change was not persisted without auto-completion");
    const again=await openTask("QA ordinary task");
    await again.getByRole("button",{name:"Change task stage"}).getByText("Done").waitFor();
  });

  await check("discussion is accessible inline and comments survive refresh",async()=>{
    let dialog=await openTask("QA ordinary task");
    const content=`QA ${config.label} feedback`;
    await dialog.getByRole("textbox",{name:"Write a comment"}).fill(content);
    await dialog.getByRole("button",{name:"Post comment"}).click();
    await until(async()=>{
      const {data,error}=await db.from("project_comments").select("id")
        .eq("task_id",fixture.normalTaskId).eq("content",content).maybeSingle();
      if(error)throw error;
      return Boolean(data?.id);
    },"Comment was not persisted");
    dialog=await openTask("QA ordinary task");
    await dialog.getByText(content).waitFor({state:"visible"});
  });

  await check("drawer fits viewport with direct completion control and close action",async()=>{
    const dialog=await openTask("QA ordinary task");
    // Sheet uses 500ms entrance animations; wait for their completion rather than
    // measuring the in-flight translated rect, which temporarily extends past 100vw.
    await dialog.evaluate(async element=>{
      const animations=element.getAnimations({subtree:false});
      await Promise.allSettled(animations.map(animation=>animation.finished));
    });
    await page.waitForTimeout(650);
    const geometry=await dialog.evaluate(element=>{
      const rect=element.getBoundingClientRect();
      return {width:rect.width,left:rect.left,right:rect.right,innerWidth:window.innerWidth,
        clientWidth:document.documentElement.clientWidth,visualWidth:window.visualViewport?.width};
    });
    console.log(`DRAWER_GEOMETRY [${config.label}] ${JSON.stringify(geometry)}`);
    if(geometry.width>config.width+2 || geometry.right>config.width+2 || geometry.left< -2)
      throw Error(`Drawer exceeds ${config.width}px viewport: ${JSON.stringify(geometry)}`);
    await dialog.getByRole("button",{name:"Mark task complete"}).waitFor({state:"visible"});
    await dialog.getByRole("button",{name:"Close"}).click();
    await page.getByRole("button",{name:"Task: QA ordinary task"}).waitFor({state:"visible"});
  });
  await context.close();
}
await browser.close();
fs.writeFileSync("qa-artifacts/task-drawer-results.json",JSON.stringify(reports,null,2));
const failures=reports.filter(result=>result.result==="FAIL");
console.log(`Task drawer QA: ${reports.length-failures.length}/${reports.length} passed`);
if(failures.length)process.exitCode=1;
