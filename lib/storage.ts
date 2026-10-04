import { cloudEnv } from './runtime';
const validName=/^[a-f0-9-]{36}\.(webp|png|jpg|mp3)$/;
export async function saveMedia(file:File,kind:'image'|'music') {
 const env=cloudEnv();if(!env)return (await import('./local-storage')).saveMedia(file,kind);
 if(!file.size||file.size>(kind==='music'?15:10)*1024*1024)throw new Error('حجم الملف أكبر من المسموح');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const start=new TextDecoder().decode(bytes.slice(0,12));
 let ext='',mime='';
 if(kind==='music') {if(!(start.startsWith('ID3')||(bytes[0]===255&&(bytes[1]&224)===224)))throw new Error('اختر ملف MP3 صالحًا');ext='mp3';mime='audio/mpeg';}
 else if(start.startsWith('RIFF')&&start.slice(8)==='WEBP'){ext='webp';mime='image/webp';}
 else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){ext='jpg';mime='image/jpeg';}
 else if(bytes[0]===137&&start.slice(1,4)==='PNG'){ext='png';mime='image/png';}
 else throw new Error('اختر صورة JPEG أو PNG أو WebP صالحة');
 const filename=`${crypto.randomUUID()}.${ext}`;
 await env.MEDIA.put(filename,bytes,{httpMetadata:{contentType:mime,cacheControl:'public,max-age=31536000,immutable'}});
 return `/api/media/${filename}`;
}
export async function readMedia(filename:string){
 if(!validName.test(filename))throw new Error('not found');
 const env=cloudEnv();if(!env)return (await import('./local-storage')).readMedia(filename);
 const object=await env.MEDIA.get(filename);if(!object)throw new Error('not found');return Buffer.from(await object.arrayBuffer());
}
export async function removeMedia(url:string){
 if(!url.startsWith('/api/media/')||!validName.test(url.slice(11)))return;
 const env=cloudEnv();if(!env)return (await import('./local-storage')).removeMedia(url);
 await env.MEDIA.delete(url.slice(11));
}
