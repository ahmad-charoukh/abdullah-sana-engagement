import {spawnSync} from 'node:child_process';
const bin=process.platform==='win32'?'npx.cmd':'npx';
const result=spawnSync(bin,['opennextjs-cloudflare','build'],{stdio:'inherit',shell:process.platform==='win32',env:{...process.env,CLOUDFLARE_BUILD:'1'}});
process.exit(result.status??1);
