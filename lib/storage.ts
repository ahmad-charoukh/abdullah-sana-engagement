import { supabaseAdmin } from './supabase';

const validName=/^[a-f0-9-]{36}\.(webp|png|jpg|mp3)$/;
const bucket='invitation-media';

export async function saveMedia(file:File,kind:'image'|'music') {
  const remote=supabaseAdmin();

  if(!remote)
    return (await import('./local-storage')).saveMedia(file,kind);

  if(!file.size || file.size>(kind==='music'?15:10)*1024*1024)
    throw new Error('حجم الملف أكبر من المسموح');

  const bytes=new Uint8Array(await file.arrayBuffer());

  let ext='';
  let mime='';

  if(kind==='music') {
    const valid=
      bytes.slice(0,3).toString()==='73,68,51' ||
      (bytes[0]===255 && (bytes[1]&224)===224);

    if(!valid) throw new Error('اختر ملف MP3 صالحًا');

    ext='mp3';
    mime='audio/mpeg';
  } else if(
    bytes[0]===0x52 &&
    bytes[1]===0x49 &&
    bytes[2]===0x46 &&
    bytes[3]===0x46 &&
    bytes[8]===0x57 &&
    bytes[9]===0x45 &&
    bytes[10]===0x42 &&
    bytes[11]===0x50
  ) {
    ext='webp';
    mime='image/webp';
  } else if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255) {
    ext='jpg';
    mime='image/jpeg';
  } else if(
    bytes[0]===137 &&
    bytes[1]===80 &&
    bytes[2]===78 &&
    bytes[3]===71
  ) {
    ext='png';
    mime='image/png';
  } else {
    throw new Error('اختر صورة JPEG أو PNG أو WebP صالحة');
  }

  const filename=`${crypto.randomUUID()}.${ext}`;

  const result=await remote.storage
    .from(bucket)
    .upload(filename,bytes,{
      contentType:mime,
      cacheControl:'31536000',
      upsert:false
    });

  if(result.error) throw new Error(result.error.message);

  return `/api/media/${filename}`;
}

export async function readMedia(filename:string){
  if(!validName.test(filename)) throw new Error('not found');

  const remote=supabaseAdmin();

  if(!remote)
    return (await import('./local-storage')).readMedia(filename);

  const result=await remote.storage.from(bucket).download(filename);

  if(result.error || !result.data)
    throw new Error('not found');

  return Buffer.from(await result.data.arrayBuffer());
}

export async function removeMedia(url:string){
  if(!url.startsWith('/api/media/'))
    return;

  const filename=url.slice(11);

  if(!validName.test(filename))
    return;

  const remote=supabaseAdmin();

  if(!remote)
    return (await import('./local-storage')).removeMedia(url);

  const result=await remote.storage.from(bucket).remove([filename]);

  if(result.error) throw new Error(result.error.message);
}
