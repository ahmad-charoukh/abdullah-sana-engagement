import { getCloudflareContext } from '@opennextjs/cloudflare';
// The build flag prevents a deployed Worker from silently falling back to local storage.
export function cloudEnv():CloudflareEnv|null {
 if(process.env.CLOUDFLARE_BUILD!=='1') return null;
 const env=getCloudflareContext().env as CloudflareEnv;
 if(!env.DB||!env.MEDIA) throw new Error('Cloudflare D1 / R2 bindings are missing');
 return env;
}
export function configValue(key:'ADMIN_PASSWORD'|'ADMIN_USERNAME'|'APP_URL'){const env=cloudEnv();return env?env[key]:process.env[key];}
