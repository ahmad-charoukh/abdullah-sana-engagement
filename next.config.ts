import type { NextConfig } from 'next';
import path from 'node:path';
const cloud=process.env.CLOUDFLARE_BUILD==='1';
const config: NextConfig = {
 poweredByHeader:false,
 env:{CLOUDFLARE_BUILD:cloud?'1':'0'},
 serverExternalPackages:cloud?[]:['node:sqlite'],
 webpack(config){if(cloud){config.resolve.alias['./local-db']=path.resolve('lib/cloudflare-local-stub.ts');config.resolve.alias['./local-storage']=path.resolve('lib/cloudflare-local-stub.ts');config.resolve.alias[path.resolve('lib/local-db.ts')]=path.resolve('lib/cloudflare-local-stub.ts');config.resolve.alias[path.resolve('lib/local-storage.ts')]=path.resolve('lib/cloudflare-local-stub.ts');}return config;},
 async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'}]}];}
};
export default config;
