import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const binary=process.platform==='win32'?'npx.cmd':'npx';
function run(args,capture=false){const r=spawnSync(binary,['wrangler',...args],{encoding:'utf8',stdio:capture?['inherit','pipe','inherit']:'inherit',shell:process.platform==='win32'});if(r.status!==0)throw new Error(`Cloudflare command failed: ${args.join(' ')}`);return r.stdout||'';}
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
try {
 run(['whoami']);
 const databases=JSON.parse(run(['d1','list','--json'],true));
 let database=databases.find(d=>d.name===config.d1_databases[0].database_name);
 if(!database){run(['d1','create',config.d1_databases[0].database_name]);database=JSON.parse(run(['d1','list','--json'],true)).find(d=>d.name===config.d1_databases[0].database_name);}
 if(!database?.uuid)throw new Error('Database ID missing. Check your Cloudflare account selection.');
 config.d1_databases[0].database_id=database.uuid;
 writeFileSync('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
 const buckets=run(['r2','bucket','list'],true);
 const bucket=config.r2_buckets[0].bucket_name;
 if(!buckets.split(/\r?\n/).some(line=>line.trim()===`name:            ${bucket}`||new RegExp(`^name:\\s+${bucket}$`).test(line.trim())))run(['r2','bucket','create',bucket]);
 run(['d1','migrations','apply','DB','--remote']);
 console.log('\nStorage ready. Next: npm run cf:deploy, then npx wrangler secret put ADMIN_PASSWORD\n');
}catch(e){console.error(e.message);process.exitCode=1;}
