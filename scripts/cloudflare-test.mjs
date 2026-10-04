import {spawnSync} from 'node:child_process';
const test=process.argv[2]==='browser'?'tests/browser.mjs':'tests/integration.mjs';
const result=spawnSync(process.execPath,[test],{stdio:'inherit',env:{...process.env,TEST_CLOUDFLARE:'1'}});
process.exit(result.status??1);
