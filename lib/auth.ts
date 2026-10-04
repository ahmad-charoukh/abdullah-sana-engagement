import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';
import { configValue } from './runtime';
export const demoPassword = 'ChangeMe-Sana-2026!';
export function checkCredentials(name:string,password:string){
 const secret=configValue('ADMIN_PASSWORD');
 if(process.env.NODE_ENV==='production'&&!secret)return false;
 const match=timingSafeEqual(Buffer.from(hash(password),'hex'),Buffer.from(hash(secret||demoPassword),'hex'));
 return match&&name===(configValue('ADMIN_USERNAME')||'admin');
}
export const hash = (s:string) => createHash('sha256').update(s).digest('hex');
export async function authenticated() {
 const token=(await cookies()).get('invitation_session')?.value;
 if(!token) return false;
 const session=await db.prepare('SELECT expires FROM sessions WHERE token_hash=?').get(hash(token)) as {expires:number}|undefined;
 return !!session && session.expires > Date.now();
}
export async function loginSession() {
 const token=randomBytes(32).toString('hex');
 await db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
 await db.prepare('INSERT INTO sessions VALUES (?,?)').run(hash(token),Date.now()+12*3600000);
 (await cookies()).set('invitation_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:43200});
}
export async function logoutSession() {
 const jar=await cookies(); const token=jar.get('invitation_session')?.value;
 if(token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));
 jar.delete('invitation_session');
}
