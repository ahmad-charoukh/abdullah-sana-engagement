import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory=await mkdtemp(join(tmpdir(),'invitation-countdown-'));
const base='http://localhost:3007';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3007','-H','127.0.0.1'],{env:{...process.env,DATA_DIR:directory,ADMIN_PASSWORD:'Countdown-test-2026!'},stdio:'ignore'});
let browser;
try {
 for(let i=0;i<60;i++){try{if((await fetch(base+'/api/public')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:393,height:844},reducedMotion:'reduce'});const page=await context.newPage();
 const login=await context.request.post(base+'/api/login',{data:{username:'admin',password:'Countdown-test-2026!'},headers:{Origin:base}});assert.equal(login.status(),200);
 await context.request.post(base+'/api/admin/event',{data:{date:'2030-10-09'},headers:{Origin:base}});
 await page.goto(base);await page.getByRole('button',{name:'افتح الدعوة',exact:true}).click();await page.locator('.countdown').waitFor();
 const first=await page.locator('.countdown strong').last().textContent();await page.waitForTimeout(1250);const second=await page.locator('.countdown strong').last().textContent();assert.notEqual(first,second);
 await context.request.post(base+'/api/admin/event',{data:{date:'2000-01-01'},headers:{Origin:base}});await page.reload();await page.getByRole('button',{name:'افتح الدعوة',exact:true}).click();await page.locator('.finished').waitFor();assert.equal(await page.locator('.finished').textContent(),'حلّ يوم فرحتنا، أهلًا بكم بكل حب');assert.equal(await page.locator('.countdown').count(),0);
 console.log('PASS: countdown ticks and expired dates show the final message without negative numbers.');
} finally {if(browser)await browser.close();server.kill('SIGTERM');await new Promise(r=>setTimeout(r,100));await rm(directory,{recursive:true,force:true});}
