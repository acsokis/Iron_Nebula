import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const env={...process.env};if(existsSync('.browsers'))env.PLAYWRIGHT_BROWSERS_PATH=resolve('.browsers');
for(const args of [['node_modules/vite/bin/vite.js','build'],['scripts/verify-release.mjs']]){
  const check=spawnSync(process.execPath,args,{env,stdio:'inherit'});if(check.status!==0)process.exit(check.status??1);
}
const result=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test',...process.argv.slice(2)],{env,stdio:'inherit'});
process.exit(result.status??1);
