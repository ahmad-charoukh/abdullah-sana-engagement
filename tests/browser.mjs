import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory=await mkdtemp(join(tmpdir(),'invitation-ui-'));
const port=Number(process.env.TEST_PORT||3006),base=`http://localhost:${port}`;
const cloud=process.env.TEST_CLOUDFLARE==='1';
if(cloud){const migrated=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--persist-to',directory],{encoding:'utf8',env:{...process.env,CI:'1'}});if(migrated.status!==0)throw new Error(migrated.stdout+migrated.stderr);}
const server=spawn(process.execPath,cloud?['node_modules/wrangler/bin/wrangler.js','dev','--inspector-port','0','--port',String(port),'--ip','127.0.0.1','--persist-to',directory,'--var','ADMIN_PASSWORD:Browser-test-2026!','--var',`APP_URL:${base}`]:['node_modules/next/dist/bin/next','start','-p',String(port),'-H','127.0.0.1'],{env:{...process.env,DATA_DIR:directory,ADMIN_USERNAME:'admin',ADMIN_PASSWORD:'Browser-test-2026!',APP_URL:base},stdio:['ignore',process.env.DEBUG_CF?'pipe':'ignore','pipe']});
if(process.env.DEBUG_CF)server.stdout.on('data',value=>process.stdout.write(value));
server.stderr.on('data',value=>{if(!value.toString().includes('ExperimentalWarning')&&!value.toString().includes('trace-warnings'))process.stderr.write(value);});
let browser;let checks=0;const errors=[];
const screenshotDir=process.env.SCREENSHOT_DIR||'/tmp/invitation-screenshots';
await mkdir(screenshotDir,{recursive:true});
async function waitServer(){for(let i=0;i<160;i++){try{if((await fetch(base+'/api/public')).ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw new Error('Server failed to start');}
async function noOverflow(page){const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(sizes.scroll<=sizes.width,JSON.stringify(sizes));checks++;}
try {
 await waitServer();browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const page=await context.newPage();page.on('pageerror',err=>errors.push(err.message));if(process.env.DEBUG_CF)page.on('requestfailed',r=>console.log('REQUEST FAILED',new Date().toISOString(),r.url(),r.failure()));
 await page.goto(base,{waitUntil:'networkidle'});await page.screenshot({path:join(screenshotDir,'intro-390.png')});await noOverflow(page);
 assert.equal(await page.locator('.envelope').count(),1);checks++;
 await page.getByRole('button',{name:'افتح الدعوة',exact:true}).click();await page.waitForTimeout(950);
 const flap=await page.locator('.envelope-flap').evaluate(el=>getComputedStyle(el).transform);assert.notEqual(flap,'none');checks++;
 await page.locator('.reveal-card').waitFor();await page.waitForTimeout(2100);await page.screenshot({path:join(screenshotDir,'reveal-390.png')});
 assert.equal(await page.locator('.name-center').evaluate(el=>getComputedStyle(el).opacity),'1');checks++;
 const panels=await page.locator('.name-panel').evaluateAll(els=>els.map(el=>getComputedStyle(el).transform));assert.ok(panels.every(x=>x!=='none'));checks++;
 await page.waitForFunction(()=>{const a=document.querySelector('audio');return a&&!a.paused&&a.currentTime>0;});checks++;
 await page.getByRole('button',{name:'إيقاف الموسيقى',exact:true}).click();assert.ok(await page.locator('audio').evaluate(el=>el.paused));checks++;
 await page.getByRole('button',{name:'تشغيل الموسيقى',exact:true}).click();assert.ok(!await page.locator('audio').evaluate(el=>el.paused));checks++;
 await page.locator('#guest-name').fill('ضيف المتصفح');await page.locator('#guest-count').fill('3');await page.getByRole('button',{name:'تأكيد الحضور',exact:true}).click();await page.locator('.success-state').waitFor();checks++;
 await page.locator('#wish-name').fill('مباركة المتصفح');await page.locator('#wish-message').fill('كل الفرح لكما في بداية قصتكما الجميلة');await page.getByRole('button',{name:'إرسال التهنئة',exact:true}).click();await page.getByText('شكرًا لك، ستظهر تهنئتك بعد الموافقة عليها').waitFor();assert.equal(await page.locator('.wish-card').count(),0);checks++;
 await page.goto(base+'/admin',{waitUntil:'networkidle'});assert.equal(await page.locator('.admin-login').count(),1);await page.locator('#admin-user').fill('admin');await page.locator('#admin-pass').fill('Browser-test-2026!');await page.getByRole('button',{name:'تسجيل الدخول',exact:true}).click();await page.locator('.stats-grid').waitFor();checks++;
 await page.getByRole('button',{name:'نصوص الدعوة',exact:true}).click();await page.getByLabel('الاسم الإنجليزي الأول', {exact:true}).fill('ABDULLAH');await page.getByRole('button',{name:'حفظ نصوص الدعوة'}).click();await page.getByText('تم الحفظ بنجاح').waitFor();checks++;
 await page.getByRole('button',{name:'الموقع',exact:true}).click();await page.getByLabel('عنوان المكان',{exact:true}).fill('الموقع');await page.getByLabel('رابط Google Maps').fill('https://maps.google.com/?q=engagement');await page.getByRole('button',{name:'حفظ الموقع',exact:true}).click();await page.getByText('تم الحفظ بنجاح').waitFor();checks++;
 await page.getByRole('button',{name:'الصور',exact:true}).click();await page.getByLabel('إظهار قسم الصور في الدعوة').check();await page.getByText('تم الحفظ بنجاح').waitFor();await page.getByLabel('رفع صور الحفل').setInputFiles([{name:'floral-one.webp',mimeType:'image/webp',buffer:await readFile('public/assets/floral-corner.webp')},{name:'floral-two.webp',mimeType:'image/webp',buffer:await readFile('public/assets/floral-corner.webp')}]);await page.getByText('تم رفع الصور', {exact:true}).waitFor();assert.equal(await page.locator('.admin-gallery article').count(),2);checks++;
 await page.getByRole('button',{name:'تأخير الصورة'}).first().click();await page.getByText('تم ترتيب الصور',{exact:true}).waitFor();checks++;
 await page.getByRole('button',{name:'الموسيقى',exact:true}).click();await page.getByLabel('تغيير الأغنية — رفع MP3 (حتى 15MB)').setInputFiles('public/assets/quiet-celebration.mp3');await page.getByText('تم رفع الموسيقى',{exact:true}).waitFor();assert.equal(await page.locator('.media-editor audio').count(),1);checks++;
 await page.getByRole('button',{name:'التهاني',exact:true}).click();await page.getByRole('button',{name:'موافقة',exact:true}).click();await page.getByText('تم قبول التهنئة',{exact:true}).waitFor();checks++;
 await page.getByRole('button',{name:'المظهر',exact:true}).click();await page.screenshot({path:join(screenshotDir,'admin-390.png')});await noOverflow(page);
 await page.goto(base,{waitUntil:'networkidle'});if(await page.locator('.intro').count())await page.getByRole('button',{name:'افتح الدعوة',exact:true}).click();await page.locator('.reveal-card').waitFor();await page.waitForTimeout(1800);
 assert.equal(await page.getByRole('link',{name:'فتح الموقع على الخريطة'}).getAttribute('href'),'https://maps.google.com/?q=engagement');checks++;
 await page.locator('#gallery').scrollIntoViewIfNeeded();await page.locator('.gallery-stage>img').waitFor();const first=await page.locator('.gallery-stage>img').getAttribute('src');await page.getByRole('button',{name:'الصورة التالية',exact:true}).click();assert.notEqual(await page.locator('.gallery-stage>img').getAttribute('src'),first);checks++;
 await page.locator('.gallery-stage').dispatchEvent('touchstart',{touches:[{identifier:1,clientX:250}]});await page.locator('.gallery-stage').dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:100}]});assert.equal(await page.locator('.gallery-stage>img').getAttribute('src'),first);checks++;
 await page.locator('#details').scrollIntoViewIfNeeded();await page.waitForTimeout(1100);await page.screenshot({path:join(screenshotDir,'details-390.png')});
 const forbidden=await page.locator('body').innerText();assert.ok(!/زفاف|عرس|الرياض|قاعة الملوك/.test(forbidden));checks++;
 for(const width of [375,390,393,430,768,1440]){
  const c=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});const p=await c.newPage();p.on('pageerror',err=>errors.push(err.message));await p.goto(base);await noOverflow(p);await p.getByRole('button',{name:'افتح الدعوة',exact:true}).click();await p.locator('.reveal-card').waitFor();await noOverflow(p);
  assert.equal(await p.locator('.name-center .names').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true,`Name clipping at ${width}`);checks++;
  await p.locator('#rsvp').scrollIntoViewIfNeeded();await noOverflow(p);await p.screenshot({path:join(screenshotDir,`rsvp-${width}.png`)});
  await p.goto(base+'/admin');await noOverflow(p);await c.close();
 }
 const reduced=await browser.newContext({viewport:{width:393,height:844},reducedMotion:'reduce'});const rp=await reduced.newPage();await rp.goto(base);assert.equal(await rp.locator('.envelope').evaluate(el=>getComputedStyle(el).animationName),'none');checks++;await reduced.close();
 assert.deepEqual(errors,[]);checks++;
 console.log(`PASS (${cloud?'Cloudflare':'Node'}): ${checks} browser assertions. Opening/panels/music, RSVP/wishes, admin/settings/uploads/moderation, gallery arrows/swipe, maps, six widths, reduced motion; no page errors.`);
}catch(error){console.error('UI failed:',error.message);throw error;}finally{if(browser)await browser.close();server.kill('SIGTERM');await new Promise(r=>setTimeout(r,150));await rm(directory,{recursive:true,force:true});}
