import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
const directory=await mkdtemp(join(tmpdir(),'invitation-test-'));
const port=Number(process.env.TEST_PORT||3005),base=`http://localhost:${port}`;
const cloud=process.env.TEST_CLOUDFLARE==='1';
if(cloud){const migrated=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--persist-to',directory],{encoding:'utf8',env:{...process.env,CI:'1'}});if(migrated.status!==0)throw new Error(migrated.stdout+migrated.stderr);}
let server;
function launch(){server=spawn(process.execPath,cloud?['node_modules/wrangler/bin/wrangler.js','dev','--inspector-port','0','--port',String(port),'--ip','127.0.0.1','--persist-to',directory,'--var','ADMIN_PASSWORD:Integration-password-2026!','--var',`APP_URL:${base}`]:['node_modules/next/dist/bin/next','start','-p',String(port),'-H','127.0.0.1'],{env:{...process.env,DATA_DIR:directory,ADMIN_USERNAME:'admin',ADMIN_PASSWORD:'Integration-password-2026!',APP_URL:base},stdio:['ignore','pipe','pipe']});server.stderr.on('data',value=>{if(!value.toString().includes('ExperimentalWarning')&&!value.toString().includes('trace-warnings'))process.stderr.write(value);});}
async function ready(){for(let i=0;i<160;i++){try{const r=await fetch(base+'/api/public');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw new Error('Server failed to start');}
let cookie='';let checks=0;
async function request(path,body,auth=false,extra={}){return fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(body!==undefined?{'Content-Type':'application/json','Origin':base}:{}),...(auth?{Cookie:cookie}:{}),...extra},...(body!==undefined?{body:JSON.stringify(body)}:{})});}
async function ok(path,body,auth=false){const r=await request(path,body,auth);const result=await r.json();assert.equal(r.status,200,JSON.stringify(result));checks++;return result;}
async function status(path,body,expected,auth=false,extra={}){assert.equal((await request(path,body,auth,extra)).status,expected);checks++;}
async function upload(bytes,kind,target){const form=new FormData();form.set('file',new Blob([bytes],{type:kind==='music'?'audio/mpeg':'image/png'}),kind==='music'?'original.mp3':'photo.png');form.set('kind',kind);if(target)form.set('target',target);const response=await fetch(base+'/api/admin/upload',{method:'POST',headers:{Cookie:cookie,Origin:base},body:form});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));checks++;return result.url;}
try {
 launch();await ready();
 const initial=await ok('public');assert.equal(initial.settings.galleryTitle,'لحظات من حفل خطوبتنا');assert.equal(initial.settings.mapsUrl,'');assert.ok(!/زفاف|عرس|الرياض|قاعة الملوك/.test(JSON.stringify(initial)));checks+=3;
 await status('admin',undefined,401);await status('admin/settings',{firstName:'تعديل غير مسموح'},401);
 await status('login',{username:'admin',password:'incorrect'},401);
 const login=await request('login',{username:'admin',password:'Integration-password-2026!'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/SameSite=strict/i);checks+=3;
 await status('admin/settings',{firstName:'تغيير'},403,true,{Origin:'https://evil.example'});
 await status('admin/settings',{mapsUrl:'javascript:alert(1)'},400,true);
 await ok('admin/settings',{mapsUrl:'https://maps.google.com/?q=place',locationTitle:'موقع حفلنا',locationDescription:'تفاصيل قابلة للتعديل',burgundy:'#701225'},true);
 assert.equal((await ok('public')).settings.locationTitle,'موقع حفلنا');checks++;
 await status('admin/event',{date:'2026-02-30'},400,true);
 await ok('admin/event',{date:'2027-10-09',start:'18:30',reception:'16:00',timezone:'+03:00'},true);
 assert.equal((await ok('public')).event.start,'18:30');checks++;
 await ok('rsvp',{name:'ضيف الاختبار',guests:2,attending:true});await status('rsvp',{name:'ضيف الاختبار',guests:2,attending:true},429);
 await ok('rsvp',{name:'ضيف معتذر',guests:1,attending:false});
 const attendance=(await ok('admin',undefined,true)).rsvps;assert.equal(attendance.length,2);assert.equal(attendance.filter(r=>r.attending).reduce((n,r)=>n+r.guests,0),2);checks+=2;
 const pending=await ok('wishes',{name:'تهنئة اختبار',message:'بارك الله لكما وكتب لكما الخير'});assert.equal(pending.pending,true);assert.equal((await ok('public')).wishes.length,0);checks+=2;
 let admin=await ok('admin',undefined,true);const wishId=admin.wishes[0].id;
 await ok('admin/wishes',{action:'approved',id:wishId},true);assert.equal((await ok('public')).wishes.length,1);checks++;
 await ok('admin/wishes',{action:'rejected',id:wishId},true);assert.equal((await ok('public')).wishes.length,0);checks++;
 await ok('admin/settings',{moderation:false},true);await ok('wishes',{name:'تهنئة ثانية',message:'ألف مبروك لكما'});assert.equal((await ok('public')).wishes.length,1);checks++;
 const png=await sharp({create:{width:480,height:600,channels:3,background:'#6e1022'}}).png().toBuffer();
 const photo1=await upload(png,'image'),photo2=await upload(png,'image');assert.equal((await fetch(base+photo1)).headers.get('content-type'),cloud?'image/png':'image/webp');checks++;
 admin=await ok('admin',undefined,true);const [a,b]=admin.gallery;
 await ok('admin/gallery',{action:'reorder',ids:[b.id,a.id]},true);assert.equal((await ok('admin',undefined,true)).gallery[0].id,b.id);checks++;
 await ok('admin/gallery',{action:'cover',id:b.id},true);assert.equal((await ok('public')).gallery[0].id,b.id);checks++;
 await ok('admin/gallery',{action:'alt',id:b.id,alt:'صورة الحفل'},true);
 await upload(png,'image','location');assert.ok((await ok('public')).settings.locationImage);checks++;
 const music=await upload(await readFile('public/assets/quiet-celebration.mp3'),'music');const range=await fetch(base+music,{headers:{Range:'bytes=0-99'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,100);checks+=2;
 await ok('admin/settings',{musicUrl:''},true);assert.equal((await fetch(base+music)).status,404);checks++;
 const bad=new FormData();bad.set('kind','image');bad.set('file',new Blob(['not an image']),'fake.png');assert.equal((await fetch(base+'/api/admin/upload',{method:'POST',headers:{Cookie:cookie,Origin:base},body:bad})).status,400);checks++;
 const calendar=await request('calendar');assert.equal(calendar.status,200);const ics=await calendar.text();assert.match(ics,/DTSTART:20271009T153000Z/);assert.match(ics,/BEGIN:VCALENDAR/);checks+=3;
 await ok('admin/gallery',{action:'delete',id:a.id},true);assert.equal((await fetch(base+photo1)).status,404);checks++;
 await ok('admin/rsvp',{id:attendance[0].id},true);assert.equal((await ok('admin',undefined,true)).rsvps.length,1);checks++;
 await ok('admin/wishes',{action:'delete',id:wishId},true);assert.equal((await ok('admin',undefined,true)).wishes.length,1);checks++;
 await ok('logout',{},true);await status('admin',undefined,401,true);
 await new Promise(resolve=>{server.once('exit',resolve);server.kill('SIGTERM');});launch();await ready();assert.equal((await ok('public')).settings.locationTitle,'موقع حفلنا');assert.equal((await ok('public')).gallery.length,1);checks+=2;
 console.log(`PASS (${cloud?'Cloudflare D1/R2':'local SQLite'}): ${checks} API, auth, upload, moderation, calendar, rate-limit and persistence assertions.`);
} finally {if(server&&!server.killed)server.kill('SIGTERM');await rm(directory,{recursive:true,force:true});}
