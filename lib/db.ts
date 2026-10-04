import { defaults, eventDefaults, type Settings, type EventDetails, type PublicData, type GalleryItem, type Wish } from './defaults';
import { cloudEnv } from './runtime';
type Params = (string | number | null)[];
async function connection() {
 const env=cloudEnv();
 if(env) return {remote:env.DB,local:null};
 const {db}=await import('./local-db'); return {remote:null,local:db};
}
export const db={
 prepare(sql:string){return {
 async get(...args:Params):Promise<Record<string,unknown>|undefined>{const c=await connection();return c.remote?(await c.remote.prepare(sql).bind(...args).first() ?? undefined):c.local!.prepare(sql).get(...args);},
 async all(...args:Params):Promise<Record<string,unknown>[]>{const c=await connection();return c.remote?(await c.remote.prepare(sql).bind(...args).all()).results:c.local!.prepare(sql).all(...args).map(x=>({...x}));},
 async run(...args:Params){const c=await connection();return c.remote?c.remote.prepare(sql).bind(...args).run():c.local!.prepare(sql).run(...args);}
 };},
 async batch(statements:{sql:string,args:Params}[]){const c=await connection();if(c.remote) return c.remote.batch(statements.map(s=>c.remote!.prepare(s.sql).bind(...s.args)));c.local!.exec('BEGIN');try {for(const s of statements)c.local!.prepare(s.sql).run(...s.args);c.local!.exec('COMMIT');}catch(e){c.local!.exec('ROLLBACK');throw e;}}
};
export async function getSettings():Promise<Settings>{const row=await db.prepare('SELECT value FROM settings WHERE id=1').get();return {...defaults,...JSON.parse(String(row?.value||'{}'))};}
export async function getEvent():Promise<EventDetails>{const row=await db.prepare('SELECT value FROM event_details WHERE id=1').get();return {...eventDefaults,...JSON.parse(String(row?.value||'{}'))};}
export async function publicData():Promise<PublicData>{return {settings:await getSettings(),event:await getEvent(),gallery:await db.prepare('SELECT * FROM gallery ORDER BY is_cover DESC,position,id').all() as unknown as GalleryItem[],wishes:await db.prepare("SELECT id,name,message,status,created_at FROM wishes WHERE status='approved' ORDER BY id DESC LIMIT 40").all() as unknown as Wish[]};}
export async function rateLimit(key:string,limit:number,windowMs:number){
 const now=Date.now();
 const row=await db.prepare('INSERT INTO rate_limits (key,count,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING count').get(key,now+windowMs,now,now);
 return Number(row?.count)<=limit;
}
