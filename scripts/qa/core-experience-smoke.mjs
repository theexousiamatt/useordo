import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const fixture=JSON.parse(fs.readFileSync(".qa-browser-state.json","utf8"));
const url=process.env.QA_SUPABASE_URL;
if(!/^http:\/\/(?:127\.0\.0\.1|localhost):54321\/?$/.test(url??"")) throw new Error("Only disposable local Supabase is allowed");
const db=createClient(url,process.env.QA_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const base="http://127.0.0.1:4173";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
fs.mkdirSync("qa-artifacts",{recursive:true});
const reports=[];

async function must(p,label){
  const r=await p;
  if(r.error) throw new Error(label+": "+r.error.message);
  return r.data;
}

const suffix=randomUUID().slice(0,8);
const clientEmail=`ordo-core-client-${suffix}@example.invalid`;
const clientPassword=`QA-client-${randomUUID()}!`;
const client=await must(db.auth.admin.createUser({
  email:clientEmail,password:clientPassword,email_confirm:true,
  user_metadata:{full_name:"QA Client"},
}),"Create client");
const clientId=client.user.id;

const teammateEmail=`ordo-core-member-${suffix}@example.invalid`;
const teammate=await must(db.auth.admin.createUser({
  email:teammateEmail,password:`QA-member-${randomUUID()}!`,email_confirm:true,
  user_metadata:{full_name:"QA Teammate"},
}),"Create teammate");
const teammateId=teammate.user.id;
await must(db.from("profiles").upsert({
  id:teammateId,full_name:"QA Teammate",email:teammateEmail,
}),"Register teammate profile");
await must(db.from("workspace_members").insert({
  workspace_id:fixture.workspaceId,user_id:teammateId,role:"member",status:"active",
}),"Create teammate workspace membership");
await must(db.from("project_members").insert({
  workspace_id:fixture.workspaceId,project_id:fixture.projectId,user_id:teammateId,role:"member",
}),"Share project with teammate");
await must(db.from("workspace_members").insert({
  workspace_id:fixture.workspaceId,user_id:clientId,role:"client",status:"active",
}),"Create client workspace membership");
await must(db.from("project_members").insert({
  workspace_id:fixture.workspaceId,project_id:fixture.projectId,user_id:clientId,role:"client",
}),"Share project with client");
const deliverable=await must(db.from("deliverables").insert({
  workspace_id:fixture.workspaceId,project_id:fixture.projectId,
  title:"QA client homepage",description:"Review the homepage and provide feedback.",
  status:"submitted",requires_approval:true,created_by:fixture.userId,
}).select("id").single(),"Create approval");

async function signIn(page,email,password){
  await page.goto(base+"/auth",{waitUntil:"domcontentloaded"});
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button",{name:/sign in/i}).last().click();
  await page.waitForURL(u=>u.pathname!=="/auth",{timeout:30000});
}

async function scenario({audience,width,height,isMobile}){
  const label=`${audience}-${width}`;
  const context=await browser.newContext({
    viewport:{width,height},isMobile,hasTouch:isMobile,deviceScaleFactor:1,
  });
  const page=await context.newPage();
  page.setDefaultTimeout(16000);
  const pageErrors=[];
  page.on("pageerror",e=>pageErrors.push(e.message));
  await page.route("**/functions/v1/list-workspaces", async route=>{
    await route.fulfill({
      status:200,contentType:"application/json",
      headers:{
        "Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type",
        "Access-Control-Allow-Methods":"POST, OPTIONS, GET",
      },
      body:JSON.stringify({workspaces:[{
        id:fixture.workspaceId,name:"Core QA Studio",slug:"core-qa",
        type:"agency",owner_id:fixture.userId,
        role:audience==="client"?"client":"owner",
      }]}),
    });
  });
  try{
    // Each browser scenario starts with the same disposable fixture state.
    if(audience==="studio"){
      await must(db.from("tasks").update({
        completed_at:null,due_date:new Date().toISOString().slice(0,10),
      }).eq("id",fixture.normalTaskId), "Reset QA task");
      const {data:linked}=await db.from("task_assignees").select("id")
        .eq("task_id",fixture.normalTaskId).eq("user_id",fixture.userId).maybeSingle();
      if(!linked){
        await must(db.from("task_assignees").insert({
          workspace_id:fixture.workspaceId,project_id:fixture.projectId,
          task_id:fixture.normalTaskId,user_id:fixture.userId,created_by:fixture.userId,
        }),"Assign owner with multi-assignee table");
      }
      await signIn(page,fixture.email,fixture.password);
      await page.goto(base+"/",{waitUntil:"domcontentloaded"});
      await page.getByRole("heading",{name:"Your studio, at a glance."}).waitFor({state:"visible"});
      await page.goto(base+"/tasks",{waitUntil:"domcontentloaded"});
      await page.getByRole("heading",{name:"My tasks"}).waitFor({state:"visible"});
      await page.getByText("QA ordinary task").first().waitFor({state:"visible"});
      await page.getByRole("button",{name:"Mark QA ordinary task complete"}).click();
      const done=await must(db.from("tasks").select("completed_at").eq("id",fixture.normalTaskId).single(),"Read completion");
      if(!done.completed_at) throw new Error("Task completion did not persist");

      await page.goto(base+`/projects/${fixture.projectId}`,{waitUntil:"domcontentloaded"});
      await page.getByRole("button",{name:"Task: QA ordinary task"}).waitFor({state:"visible"});
      await page.getByRole("button",{name:"Task: QA ordinary task"}).click();
      const drawer=page.getByRole("dialog");
      await drawer.getByRole("textbox",{name:"Write a comment"}).fill("@QA");
      await drawer.getByRole("option",{name:"QA Teammate"}).click();
      await drawer.getByRole("button",{name:"Post comment"}).click();
      await page.waitForFunction(()=>{
        const comment=Array.from(document.querySelectorAll('[aria-label="Task comments"] li')).find(el=>el.textContent.includes("@QA Teammate"));
        return !!comment;
      },{timeout:20000});
      const mention=await must(db.from("notifications").select("id,entity_id")
        .eq("user_id",teammateId).eq("type","task_mention").order("created_at",{ascending:false}).limit(1).single(),"Read task mention notification");
      if(!mention?.entity_id) throw new Error("Mention notification was not created");

      // Replaying the same authenticated request must not duplicate a notification.
      const ownerApi=createClient(url,process.env.QA_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
      await must(ownerApi.auth.signInWithPassword({email:fixture.email,password:fixture.password}),"Sign in owner API");
      await must(ownerApi.rpc("notify_task_mentions",{
        _comment_id:mention.entity_id,_mentioned_user_ids:[teammateId],
      }),"Replay mention");
      const count=await must(db.from("notifications").select("id",{count:"exact"})
        .eq("user_id",teammateId).eq("entity_id",mention.entity_id),"Read deduplicated mentions");
      if(count.length!==1) throw new Error("Mention replay created duplicate notification");
      await page.goto(base+"/inbox",{waitUntil:"domcontentloaded"});
      await page.getByRole("heading",{name:"Inbox"}).waitFor({state:"visible"});
      await page.goto(base+"/onboarding?create=1",{waitUntil:"domcontentloaded"});
      await page.getByText("Set up your workspace").waitFor({state:"visible"});
    }else{
      await must(db.from("deliverables").update({status:"submitted",approved_at:null,approved_by:null}).eq("id",deliverable.id),"Reset QA review");
      await signIn(page,clientEmail,clientPassword);
      await page.goto(base+"/client/approvals",{waitUntil:"domcontentloaded"});
      await page.getByRole("heading",{name:"Approvals"}).waitFor({state:"visible"});
      await page.getByText("QA client homepage").first().waitFor({state:"visible"});
      await page.getByRole("button",{name:"Request changes"}).first().click();
      await page.getByRole("dialog").getByRole("heading",{name:"Request a revision"}).waitFor({state:"visible"});
      await page.getByRole("textbox",{name:"Revision feedback (required)"}).fill("Please improve spacing and responsive hierarchy.");
      await page.getByRole("button",{name:"Send feedback"}).click();
      await page.getByText("Review history").waitFor({state:"visible"});
      const review=await must(db.from("deliverable_reviews").select("decision,note")
        .eq("deliverable_id",deliverable.id).order("created_at",{ascending:false}).limit(1).single(),"Read review");
      if(review.decision!=="rejected" || !review.note.includes("responsive hierarchy")){
        throw new Error("Client revision and feedback were not persisted");
      }
      await page.goto(base+"/client/inbox",{waitUntil:"domcontentloaded"});
      await page.getByRole("heading",{name:"Inbox"}).waitFor({state:"visible"});
    }

    if(isMobile){
      const nav=page.getByRole("navigation",{name:audience==="client"?"Client mobile navigation":"Studio mobile navigation"});
      await nav.waitFor({state:"visible"});
      if(await nav.getByRole("link").count()!==3) throw new Error("Expected three mobile tabs");
    }
    if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)) {
      throw new Error("Horizontal overflow");
    }
    if(pageErrors.length) throw new Error("Runtime page errors: "+pageErrors.join("; "));
    await page.screenshot({path:path.join("qa-artifacts",`core-${label}.png`),fullPage:true});
    reports.push({label,result:"PASS"});
    console.log(`PASS ${label}`);
  }catch(e){
    reports.push({label,result:"FAIL",reason:String(e?.message??e)});
    console.error(`FAIL ${label}: ${String(e?.message??e)}`);
    await page.screenshot({path:path.join("qa-artifacts",`core-${label}-fail.png`),fullPage:true}).catch(()=>{});
  }finally{
    await context.close();
  }
}

try{
  await scenario({audience:"studio",width:390,height:844,isMobile:true});
  await scenario({audience:"client",width:390,height:844,isMobile:true});
  await scenario({audience:"studio",width:1280,height:900,isMobile:false});
  await scenario({audience:"client",width:1280,height:900,isMobile:false});
}finally{
  await browser.close();
  fs.writeFileSync("qa-artifacts/core-experience-results.json",JSON.stringify(reports,null,2));
}
if(reports.some(r=>r.result==="FAIL")) process.exitCode=1;
