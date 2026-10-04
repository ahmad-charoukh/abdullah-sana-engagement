// Replace this adapter with an object-storage adapter when deploying to a serverless platform.
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { dataDirectory } from './local-db';
export async function saveMedia(file:File,kind:'image'|'music') {
 const max=kind==='music'?15*1024*1024:10*1024*1024;
 if(!file.size || file.size>max) throw new Error(kind==='music'?'حجم الأغنية يجب ألا يتجاوز 15MB':'حجم الصورة يجب ألا يتجاوز 10MB');
 let bytes:Buffer<ArrayBufferLike>=Buffer.from(await file.arrayBuffer());
 let extension='webp';
 if(kind==='image') {
   try { const metadata=await sharp(bytes,{limitInputPixels:40000000}).metadata(); if(!['jpeg','png','webp'].includes(metadata.format||'')) throw new Error(); bytes=await sharp(bytes).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:84}).toBuffer(); }
   catch { throw new Error('اختر صورة JPEG أو PNG أو WebP صالحة'); }
 } else {
   const mp3=bytes.subarray(0,3).toString()==='ID3' || (bytes[0]===255 && (bytes[1]&224)===224);
   if(!mp3) throw new Error('اختر ملف MP3 صالحًا'); extension='mp3';
 }
 const filename=`${randomUUID()}.${extension}`;
 await writeFile(join(dataDirectory,'uploads',filename),bytes,{flag:'wx'});
 return `/api/media/${filename}`;
}
export async function readMedia(filename:string) {
 if(!/^[a-f0-9-]{36}\.(webp|mp3)$/.test(filename)) throw new Error('not found');
 return readFile(join(dataDirectory,'uploads',filename));
}
export async function removeMedia(url:string) {
 const filename=url.split('/').pop()||'';
 if(/^\/api\/media\/[a-f0-9-]{36}\.(webp|mp3)$/.test(url)) await unlink(join(dataDirectory,'uploads',filename)).catch(()=>{});
}
