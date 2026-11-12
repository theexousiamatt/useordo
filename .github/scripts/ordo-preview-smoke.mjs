import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const origin = process.env.PREVIEW_URL;
assert.ok(origin?.startsWith("https://"), "Preview URL required");
const browser = await chromium.launch({headless:true});
await fs.mkdir(".github/screenshots",{recursive:true});
const sizes=[
  {name:"desktop",width:1440,height:900},
  {name:"tablet",width:768,height:1024},
  {name:"mobile",width:390,height:844},
];

try {
  for(const size of sizes){
    const context=await browser.newContext({viewport:{width:size.width,height:size.height},ignoreHTTPSErrors:false});
    const page=await context.newPage();
    const failures=[];
    page.on("pageerror", error=>failures.push(`pageerror: ${error.message}`));
    const response=await page.goto(`${origin}/auth`,{waitUntil:"domcontentloaded",timeout:30000});
    assert.equal(response?.status(),200,`Preview auth should load at ${size.name}`);
    await page.getByRole("heading",{name:"Sign in",exact:true}).waitFor({timeout:20000});
    await page.getByRole("textbox",{name:/Email address/i}).waitFor();
    await page.getByLabel("Password",{exact:true}).waitFor();
    await page.screenshot({path:`.github/screenshots/ordo-${size.name}-auth.png`,fullPage:true});
    const dimensions=await page.evaluate(()=>({
      scroll:document.documentElement.scrollWidth,
      viewport:document.documentElement.clientWidth,
      title:document.title,
    }));
    assert.ok(dimensions.scroll<=dimensions.viewport+3,`Horizontal overflow on ${size.name}: ${JSON.stringify(dimensions)}`);
    assert.ok(!failures.length,`JS errors on ${size.name}: ${failures.join("; ")}`);
    console.log(`${size.name}: PASS auth and no overflow, width=${size.width}`);
    if(size.name==="desktop"){
      const release=await page.request.get(`${origin}/release.json`);
      assert.equal(release.status(),200,"Preview release metadata should be public and reachable");
      const rel=await release.json();
      assert.equal(rel.environment,"preview");
      assert.match(rel.source_sha,/^[0-9a-f]{40}$/);
      const signUp=await page.goto(`${origin}/auth/sign-up`,{waitUntil:"domcontentloaded"});
      assert.equal(signUp?.status(),200,"Sign-up route should return an SPA page");
      await page.getByRole("textbox",{name:/Email/i}).first().waitFor({timeout:20000});
      const protectedRoute=await page.goto(`${origin}/projects`,{waitUntil:"domcontentloaded"});
      assert.equal(protectedRoute?.status(),200,"Protected route must return SPA fallback");
      await page.waitForURL(/\/auth(?:\?|$)/,{timeout:20000});
      console.log("Preview deep-links, sign-up and protected route redirect: PASS");
    }
    await context.close();
  }
}finally{
  await browser.close();
}
