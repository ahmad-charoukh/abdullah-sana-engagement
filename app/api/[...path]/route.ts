import { configValue } from '@/lib/runtime';
import { NextRequest, NextResponse } from 'next/server';
import { db, getSettings, getEvent, publicData, rateLimit } from '@/lib/db';
import { authenticated, checkCredentials, loginSession, logoutSession, hash } from '@/lib/auth';
import { defaults, eventDefaults, eventInstant } from '@/lib/defaults';
import { saveMedia, readMedia, removeMedia } from '@/lib/storage';
import { allowedRequestOrigin } from '@/lib/origin';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{path:string[]}>};
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
function textValue(value:unknown,min=1,max=150) { if(typeof value!=='string' || value.trim().length<min || value.length>max) throw new Error('يرجى التحقق من البيانات المدخلة'); return value.trim(); }
function validMaps(value:string) { if(!value) return true; try { const u=new URL(value); return u.protocol==='https:' && ['maps.google.com','www.google.com','google.com','maps.app.goo.gl','goo.gl'].includes(u.hostname) && (u.hostname!=='goo.gl'||u.pathname.startsWith('/maps')); } catch { return false; } }
function mediaUrl(value:string) { return !value || /^\/api\/media\/[a-f0-9-]{36}\.(webp|png|jpg|mp3)$/.test(value) || value==='/assets/quiet-celebration.mp3'; }
export async function GET(request:NextRequest,context:Context) {
 const path=(await context.params).path;
 if(path[0]==='media' && path.length===2) {
   try {
    const bytes=await readMedia(path[1]); const isMusic=path[1].endsWith('.mp3');
    const headers={'Content-Type':isMusic?'audio/mpeg':path[1].endsWith('.png')?'image/png':path[1].endsWith('.jpg')?'image/jpeg':'image/webp','Cache-Control':'public,max-age=31536000,immutable','Accept-Ranges':'bytes'};
    const range=request.headers.get('range');
    if(range) { const match=/^bytes=(\d*)-(\d*)$/.exec(range); if(!match) return new NextResponse(null,{status:416,headers:{'Content-Range':`bytes */${bytes.length}`}}); let start=match[1]?Number(match[1]):Math.max(0,bytes.length-Number(match[2])); let end=match[1]&&match[2]?Number(match[2]):bytes.length-1; end=Math.min(end,bytes.length-1); if(start>end||start>=bytes.length) return new NextResponse(null,{status:416,headers:{'Content-Range':`bytes */${bytes.length}`}}); return new NextResponse(new Uint8Array(bytes.subarray(start,end+1)),{status:206,headers:{...headers,'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':String(end-start+1)}}); }
    return new NextResponse(new Uint8Array(bytes),{headers:{...headers,'Content-Length':String(bytes.length)}});
   } catch { return json({error:'الملف غير موجود'},404); }
 }
 if(path.join('/')==='public') return json(await publicData());
 if(path.join('/')==='calendar') {
   const e=await getEvent(),s=await getSettings(); const start=eventInstant(e); const end=new Date(start.getTime()+3*3600000);
   const stamp=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
   const escape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,'\\$&');
   const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Invitation//Engagement//AR','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:engagement-${e.date}@invitation.local`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${escape(`${s.occasion} — ${s.firstName} و ${s.secondName}`)}`,`LOCATION:${escape(s.showLocation?s.locationTitle:'')}`,`DESCRIPTION:${escape(s.eventText)}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
   return new NextResponse(ics,{headers:{'Content-Type':'text/calendar;charset=utf-8','Content-Disposition':'attachment; filename="engagement.ics"'}});
 }
 if(path[0]==='admin') {
   if(!await authenticated()) return json({error:'يرجى تسجيل الدخول'},401);
   return json({settings:await getSettings(),event:await getEvent(),gallery:await db.prepare('SELECT * FROM gallery ORDER BY position,id').all(),rsvps:await db.prepare('SELECT id,name,guests,attending,created_at FROM rsvps ORDER BY id DESC').all(),wishes:await db.prepare('SELECT id,name,message,status,created_at FROM wishes ORDER BY id DESC').all()});
 }
 return json({error:'غير موجود'},404);
}
export async function POST(request:NextRequest,context:Context) {
 const path=(await context.params).path.join('/');
 if(!allowedRequestOrigin({origin:request.headers.get('origin'),fetchSite:request.headers.get('sec-fetch-site'),host:request.headers.get('host'),forwardedHost:request.headers.get('x-forwarded-host'),requestOrigin:request.nextUrl.origin,appUrl:configValue('APP_URL')})) return json({error:'طلب غير مسموح'},403);
 const contentLength=Number(request.headers.get('content-length')||0);
 if(contentLength>16*1024*1024) return json({error:'الملف كبير جدًا'},413);
 const ip=hash(request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'local');
 try {
  if(path==='login') {
    if(!await rateLimit(`login:${ip}`,8,15*60000)) return json({error:'محاولات كثيرة. حاول لاحقًا'},429);
    const body=await request.json(); const name=textValue(body.username,1,100),password=textValue(body.password,1,200);
    if(!checkCredentials(name,password)) return json({error:process.env.NODE_ENV==='production'&&!configValue('ADMIN_PASSWORD')?'اضبط ADMIN_PASSWORD أولًا':'اسم المستخدم أو كلمة المرور غير صحيحة'},401);
    await loginSession(); return json({ok:true});
  }
  if(path==='logout') {await logoutSession();return json({ok:true});}
  if(path==='rsvp'||path==='wishes') {
    if(!await rateLimit(`public:${ip}`,20,60000)) return json({error:'يرجى الانتظار قليلًا قبل المحاولة مجددًا'},429);
    const body=await request.json(); if(body.website) return json({error:'طلب غير صالح'},400);
    const name=textValue(body.name,2,100); const fingerprint=hash(`${ip}:${name.toLocaleLowerCase()}`);
    if(!await rateLimit(`${path}:${fingerprint}`,1,30000)) return json({error:'تم استلام ردك. انتظر قليلًا قبل إرسال رد آخر'},429);
    if(path==='rsvp') {
      const guests=Number(body.guests); if(!Number.isInteger(guests)||guests<1||guests>20||typeof body.attending!=='boolean') throw new Error('تحقق من عدد الأشخاص والحالة');
      const duplicate=await db.prepare("SELECT id FROM rsvps WHERE fingerprint=? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')").get(fingerprint) as {id:number}|undefined;
      if(duplicate) await db.prepare('UPDATE rsvps SET name=?,guests=?,attending=? WHERE id=?').run(name,guests,body.attending?1:0,duplicate.id);
      else await db.prepare('INSERT INTO rsvps (name,guests,attending,fingerprint) VALUES (?,?,?,?)').run(name,guests,body.attending?1:0,fingerprint);
      return json({ok:true});
    }
    const message=textValue(body.message,2,1000); const status=(await getSettings()).moderation?'pending':'approved';
    await db.prepare('INSERT INTO wishes (name,message,status,fingerprint) VALUES (?,?,?,?)').run(name,message,status,fingerprint);
    return json({ok:true,pending:status==='pending'});
  }
  if(!await authenticated()) return json({error:'يرجى تسجيل الدخول'},401);
  if(path==='admin/upload') {
    const form=await request.formData(); const kind=form.get('kind'); const file=form.get('file');
    if(!(file instanceof File)||!['image','music'].includes(String(kind))) throw new Error('اختر ملفًا صالحًا');
    const url=await saveMedia(file,kind as 'image'|'music');
    await db.prepare('INSERT INTO media (url,kind,original_name) VALUES (?,?,?)').run(url,String(kind),file.name.slice(0,200));
    const target=form.get('target');
    if(kind==='music') { const s=await getSettings(),old=s.musicUrl; s.musicUrl=url; await db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(s)); if(old.startsWith('/api/media/')) {await removeMedia(old);await db.prepare('DELETE FROM media WHERE url=?').run(old);} }
    else if(target==='location') {const s=await getSettings(),old=s.locationImage;s.locationImage=url;await db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(s));if(old){await removeMedia(old);await db.prepare('DELETE FROM media WHERE url=?').run(old);}}
    else {const count=(await db.prepare('SELECT COUNT(*) AS n FROM gallery').get() as {n:number}).n;await db.prepare('INSERT INTO gallery (url,alt,position,is_cover) VALUES (?,?,?,?)').run(url,'لحظة من حفل خطوبتنا',count,count===0?1:0);}
    return json({ok:true,url});
  }
  const body=await request.json();
  if(path==='admin/settings') {
    const s=await getSettings();
    for(const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
      if(!(key in body)) continue;
      if(typeof defaults[key]==='boolean') {if(typeof body[key]!=='boolean') throw new Error('قيمة غير صالحة'); (s as unknown as Record<string,unknown>)[key]=body[key];}
      else (s as unknown as Record<string,unknown>)[key]=textValue(body[key],0,2000);
    }
    if(!s.firstName||!s.secondName) throw new Error('الاسمان مطلوبان');
    for(const key of ['burgundy','gold','ivory'] as const) if(!/^#[0-9a-f]{6}$/i.test(s[key])) throw new Error('لون غير صالح');
    if(!validMaps(s.mapsUrl)) throw new Error('استخدم رابط Google Maps يبدأ بـ https');
    if(!mediaUrl(s.musicUrl)||!mediaUrl(s.locationImage)) throw new Error('ارفع الملفات من لوحة التحكم');
    const old=await getSettings();
    await db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(s));
    for(const field of ['musicUrl','locationImage'] as const) if(old[field] && !s[field]) {await removeMedia(old[field]);await db.prepare('DELETE FROM media WHERE url=?').run(old[field]);}
    return json({ok:true});
  }
  if(path==='admin/event') {
    const e=await getEvent(); for(const key of Object.keys(eventDefaults) as (keyof typeof eventDefaults)[]) if(key in body) e[key]=textValue(body[key],0,80);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||![e.reception,e.start].every(x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x))||!/^([+-])(0\d|1[0-4]):[0-5]\d$/.test(e.timezone)||isNaN(eventInstant(e).getTime())||new Date(e.date+'T12:00:00Z').toISOString().slice(0,10)!==e.date) throw new Error('التاريخ أو الوقت غير صالح');
    await db.prepare('UPDATE event_details SET value=? WHERE id=1').run(JSON.stringify(e)); return json({ok:true});
  }
  if(path==='admin/gallery') {
    if(body.action==='delete') {const row=await db.prepare('SELECT url FROM gallery WHERE id=?').get(Number(body.id)) as {url:string}|undefined;if(row){await db.prepare('DELETE FROM gallery WHERE id=?').run(Number(body.id));await removeMedia(row.url);await db.prepare('DELETE FROM media WHERE url=?').run(row.url);}}
    else if(body.action==='cover') {if(!await db.prepare('SELECT id FROM gallery WHERE id=?').get(Number(body.id))) throw new Error('الصورة غير موجودة');await db.batch([{sql:'UPDATE gallery SET is_cover=0',args:[]},{sql:'UPDATE gallery SET is_cover=1 WHERE id=?',args:[Number(body.id)]}]);}
    else if(body.action==='alt') {await db.prepare('UPDATE gallery SET alt=? WHERE id=?').run(textValue(body.alt,1,200),Number(body.id));}
    else if(body.action==='reorder') {if(!Array.isArray(body.ids)) throw new Error('ترتيب غير صالح');const ids=(await db.prepare('SELECT id FROM gallery').all()).map(x=>Number(x.id));if(body.ids.length!==ids.length||new Set(body.ids).size!==ids.length||body.ids.some((id:unknown)=>!ids.includes(Number(id)))) throw new Error('ترتيب غير صالح');await db.batch(body.ids.map((id:number,i:number)=>({sql:'UPDATE gallery SET position=? WHERE id=?',args:[i,id]})));}
    else throw new Error('إجراء غير صالح'); return json({ok:true});
  }
  if(path==='admin/rsvp') {await db.prepare('DELETE FROM rsvps WHERE id=?').run(Number(body.id));return json({ok:true});}
  if(path==='admin/wishes') {
    if(body.action==='delete') await db.prepare('DELETE FROM wishes WHERE id=?').run(Number(body.id));
    else if(['approved','rejected'].includes(body.action)) await db.prepare('UPDATE wishes SET status=? WHERE id=?').run(body.action,Number(body.id));
    else throw new Error('إجراء غير صالح'); return json({ok:true});
  }
  return json({error:'غير موجود'},404);
 } catch(error) {return json({error:error instanceof Error?error.message:'تعذر إتمام الطلب'},400);}
}
