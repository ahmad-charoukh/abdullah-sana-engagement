import {
  defaults,
  eventDefaults,
  type Settings,
  type EventDetails,
  type PublicData,
  type GalleryItem,
  type Wish
} from './defaults';

import { supabaseAdmin } from './supabase';

type Params = (string | number | null)[];
const normalize = (sql:string) => sql.replace(/\s+/g,' ').trim();

function unwrap(result:any) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function jsonValue(value:unknown) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); }
  catch { return value; }
}

async function remoteGet(s:any,q:string,args:Params) {
  let r:any;

  if(q==='SELECT value FROM settings WHERE id=1') {
    r=await s.from('settings').select('value').eq('id',1).maybeSingle();
    const data=unwrap(r);
    return data ? {value:JSON.stringify(data.value ?? {})} : undefined;
  }

  if(q==='SELECT value FROM event_details WHERE id=1') {
    r=await s.from('event_details').select('value').eq('id',1).maybeSingle();
    const data=unwrap(r);
    return data ? {value:JSON.stringify(data.value ?? {})} : undefined;
  }

  if(q==='SELECT expires FROM sessions WHERE token_hash=?') {
    r=await s.from('sessions').select('expires').eq('token_hash',String(args[0])).maybeSingle();
    return unwrap(r) ?? undefined;
  }

  if(q.startsWith('SELECT id FROM rsvps WHERE fingerprint=? AND created_at >')) {
    r=await s
      .from('rsvps')
      .select('id')
      .eq('fingerprint',String(args[0]))
      .gt('created_at',new Date(Date.now()-86400000).toISOString())
      .order('id',{ascending:false})
      .limit(1)
      .maybeSingle();
    return unwrap(r) ?? undefined;
  }

  if(q==='SELECT COUNT(*) AS n FROM gallery') {
    r=await s.from('gallery').select('*',{count:'exact',head:true});
    if(r.error) throw new Error(r.error.message);
    return {n:r.count ?? 0};
  }

  if(q==='SELECT url FROM gallery WHERE id=?') {
    r=await s.from('gallery').select('url').eq('id',Number(args[0])).maybeSingle();
    return unwrap(r) ?? undefined;
  }

  if(q==='SELECT id FROM gallery WHERE id=?') {
    r=await s.from('gallery').select('id').eq('id',Number(args[0])).maybeSingle();
    return unwrap(r) ?? undefined;
  }

  if(q.startsWith('INSERT INTO rate_limits')) {
    const key=String(args[0]);
    const nextReset=Number(args[1]);
    const now=Number(args[2]);

    r=await s.from('rate_limits')
      .select('count,reset_at')
      .eq('key',key)
      .maybeSingle();

    if(r.error) throw new Error(r.error.message);

    const old=r.data;
    const expired=!old || Number(old.reset_at)<=now;
    const count=expired ? 1 : Number(old.count)+1;
    const reset_at=expired ? nextReset : Number(old.reset_at);

    const up=await s.from('rate_limits').upsert({
      key,count,reset_at
    },{onConflict:'key'});

    if(up.error) throw new Error(up.error.message);
    return {count};
  }

  throw new Error(`Unsupported Supabase get query: ${q}`);
}

async function remoteAll(s:any,q:string,args:Params) {
  let r:any;

  if(q==='SELECT * FROM gallery ORDER BY is_cover DESC,position,id') {
    r=await s.from('gallery').select('*')
      .order('is_cover',{ascending:false})
      .order('position',{ascending:true})
      .order('id',{ascending:true});
    return unwrap(r) ?? [];
  }

  if(q==='SELECT * FROM gallery ORDER BY position,id') {
    r=await s.from('gallery').select('*')
      .order('position',{ascending:true})
      .order('id',{ascending:true});
    return unwrap(r) ?? [];
  }

  if(q==="SELECT id,name,message,status,created_at FROM wishes WHERE status='approved' ORDER BY id DESC LIMIT 40") {
    r=await s.from('wishes')
      .select('id,name,message,status,created_at')
      .eq('status','approved')
      .order('id',{ascending:false})
      .limit(40);
    return unwrap(r) ?? [];
  }

  if(q==='SELECT id,name,guests,attending,created_at FROM rsvps ORDER BY id DESC') {
    r=await s.from('rsvps')
      .select('id,name,guests,attending,created_at')
      .order('id',{ascending:false});
    return unwrap(r) ?? [];
  }

  if(q==='SELECT id,name,message,status,created_at FROM wishes ORDER BY id DESC') {
    r=await s.from('wishes')
      .select('id,name,message,status,created_at')
      .order('id',{ascending:false});
    return unwrap(r) ?? [];
  }

  if(q==='SELECT id FROM gallery') {
    r=await s.from('gallery').select('id');
    return unwrap(r) ?? [];
  }

  throw new Error(`Unsupported Supabase all query: ${q}`);
}

async function remoteRun(s:any,q:string,args:Params) {
  let r:any;

  if(q==='DELETE FROM sessions WHERE expires < ?')
    r=await s.from('sessions').delete().lt('expires',Number(args[0]));

  else if(q==='INSERT INTO sessions VALUES (?,?)')
    r=await s.from('sessions').insert({
      token_hash:String(args[0]),
      expires:Number(args[1])
    });

  else if(q==='DELETE FROM sessions WHERE token_hash=?')
    r=await s.from('sessions').delete().eq('token_hash',String(args[0]));

  else if(q==='UPDATE rsvps SET name=?,guests=?,attending=? WHERE id=?')
    r=await s.from('rsvps').update({
      name:String(args[0]),
      guests:Number(args[1]),
      attending:Number(args[2])
    }).eq('id',Number(args[3]));

  else if(q==='INSERT INTO rsvps (name,guests,attending,fingerprint) VALUES (?,?,?,?)')
    r=await s.from('rsvps').insert({
      name:String(args[0]),
      guests:Number(args[1]),
      attending:Number(args[2]),
      fingerprint:String(args[3])
    });

  else if(q==='INSERT INTO wishes (name,message,status,fingerprint) VALUES (?,?,?,?)')
    r=await s.from('wishes').insert({
      name:String(args[0]),
      message:String(args[1]),
      status:String(args[2]),
      fingerprint:String(args[3])
    });

  else if(q==='INSERT INTO media (url,kind,original_name) VALUES (?,?,?)')
    r=await s.from('media').insert({
      url:String(args[0]),
      kind:String(args[1]),
      original_name:String(args[2])
    });

  else if(q==='UPDATE settings SET value=? WHERE id=1')
    r=await s.from('settings').update({
      value:jsonValue(args[0])
    }).eq('id',1);

  else if(q==='UPDATE event_details SET value=? WHERE id=1')
    r=await s.from('event_details').update({
      value:jsonValue(args[0])
    }).eq('id',1);

  else if(q==='DELETE FROM media WHERE url=?')
    r=await s.from('media').delete().eq('url',String(args[0]));

  else if(q==='INSERT INTO gallery (url,alt,position,is_cover) VALUES (?,?,?,?)')
    r=await s.from('gallery').insert({
      url:String(args[0]),
      alt:String(args[1]),
      position:Number(args[2]),
      is_cover:Number(args[3])
    });

  else if(q==='DELETE FROM gallery WHERE id=?')
    r=await s.from('gallery').delete().eq('id',Number(args[0]));

  else if(q==='UPDATE gallery SET is_cover=0')
    r=await s.from('gallery').update({is_cover:0}).gte('id',0);

  else if(q==='UPDATE gallery SET is_cover=1 WHERE id=?')
    r=await s.from('gallery').update({is_cover:1}).eq('id',Number(args[0]));

  else if(q==='UPDATE gallery SET alt=? WHERE id=?')
    r=await s.from('gallery').update({alt:String(args[0])}).eq('id',Number(args[1]));

  else if(q==='UPDATE gallery SET position=? WHERE id=?')
    r=await s.from('gallery').update({position:Number(args[0])}).eq('id',Number(args[1]));

  else if(q==='DELETE FROM rsvps WHERE id=?')
    r=await s.from('rsvps').delete().eq('id',Number(args[0]));

  else if(q==='DELETE FROM wishes WHERE id=?')
    r=await s.from('wishes').delete().eq('id',Number(args[0]));

  else if(q==='UPDATE wishes SET status=? WHERE id=?')
    r=await s.from('wishes').update({status:String(args[0])}).eq('id',Number(args[1]));

  else
    throw new Error(`Unsupported Supabase run query: ${q}`);

  if(r.error) throw new Error(r.error.message);
  return r.data;
}

async function connection() {
  const remote=supabaseAdmin();
  if(remote) return {remote,local:null};

  const {db}=await import('./local-db');
  return {remote:null,local:db};
}

export const db={
  prepare(sql:string){
    const q=normalize(sql);

    return {
      async get(...args:Params):Promise<Record<string,unknown>|undefined>{
        const c=await connection();
        return c.remote
          ? remoteGet(c.remote,q,args)
          : c.local!.prepare(sql).get(...args) as Record<string,unknown>|undefined;
      },

      async all(...args:Params):Promise<Record<string,unknown>[]>{
        const c=await connection();
        return c.remote
          ? remoteAll(c.remote,q,args)
          : c.local!.prepare(sql).all(...args).map((x:any)=>({...x}));
      },

      async run(...args:Params){
        const c=await connection();
        return c.remote
          ? remoteRun(c.remote,q,args)
          : c.local!.prepare(sql).run(...args);
      }
    };
  },

  async batch(statements:{sql:string,args:Params}[]){
    const c=await connection();

    if(c.remote) {
      for(const statement of statements)
        await remoteRun(c.remote,normalize(statement.sql),statement.args);
      return;
    }

    c.local!.exec('BEGIN');
    try {
      for(const statement of statements)
        c.local!.prepare(statement.sql).run(...statement.args);
      c.local!.exec('COMMIT');
    } catch(error) {
      c.local!.exec('ROLLBACK');
      throw error;
    }
  }
};

export async function getSettings():Promise<Settings>{
  const row=await db.prepare('SELECT value FROM settings WHERE id=1').get();
  const raw=row?.value;
  const parsed=typeof raw==='string'
    ? JSON.parse(raw || '{}')
    : (raw && typeof raw==='object' ? raw : {});
  return {...defaults,...parsed};
}

export async function getEvent():Promise<EventDetails>{
  const row=await db.prepare('SELECT value FROM event_details WHERE id=1').get();
  const raw=row?.value;
  const parsed=typeof raw==='string'
    ? JSON.parse(raw || '{}')
    : (raw && typeof raw==='object' ? raw : {});
  return {...eventDefaults,...parsed};
}

export async function publicData():Promise<PublicData>{
  return {
    settings:await getSettings(),
    event:await getEvent(),
    gallery:await db.prepare(
      'SELECT * FROM gallery ORDER BY is_cover DESC,position,id'
    ).all() as unknown as GalleryItem[],
    wishes:await db.prepare(
      "SELECT id,name,message,status,created_at FROM wishes WHERE status='approved' ORDER BY id DESC LIMIT 40"
    ).all() as unknown as Wish[]
  };
}

export async function rateLimit(key:string,limit:number,windowMs:number){
  const now=Date.now();
  const row=await db.prepare(
    'INSERT INTO rate_limits (key,count,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING count'
  ).get(key,now+windowMs,now,now);

  return Number(row?.count)<=limit;
}
