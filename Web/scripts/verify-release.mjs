import {readFile,readdir,lstat,writeFile} from 'node:fs/promises';
import {resolve,relative,extname,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('dist'),files=[];
const check=(condition,message)=>{if(!condition)throw new Error(message);};
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
  const path=resolve(dir,entry.name),rel=relative(root,path);check(!rel.startsWith('..')&&!rel.includes(':')&&!entry.isSymbolicLink(),'Unsafe release path.');
  const stat=await lstat(path);check(!stat.isSymbolicLink(),'Symlink/reparse link in release.');
  if(stat.isDirectory())await walk(path);else if(entry.name!=='release-manifest.json')files.push({path,rel:rel.replaceAll('\\','/'),bytes:stat.size});
}}
await walk(root);check(files.length>20&&files.length<100,'Unexpected release file count.');
const allowed=new Set(['.html','.js','.css','.webp','.json','.txt']);
for(const file of files){check(allowed.has(extname(file.path)),`Unexpected file type: ${file.rel}`);
  check(!/(?:node_modules|\.browsers|test-results|\.git|\.env|\.map|\.exe|\.dll|Propulsive|run-save|gui-settings)/i.test(file.rel),`Excluded content: ${file.rel}`);
  check(file.bytes<2*1024*1024,`Oversized release file: ${file.rel}`);
  const bytes=await readFile(file.path);file.sha256=createHash('sha256').update(bytes).digest('hex');
  if(['.js','.html','.json','.css','.txt'].includes(extname(file.path))){const text=bytes.toString('utf8');
    check(!/(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{25,}|AKIA[A-Z0-9]{16}|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(text),`Credential pattern: ${file.rel}`);
    if(file.rel.endsWith('.js'))check(!text.includes('__IRON_NEBULA__'),'Development mutation hooks leaked into production.');
  }
}
const html=await readFile(join(root,'index.html'),'utf8');
check(html.includes('Content-Security-Policy')&&html.includes("script-src 'self'")&&!html.includes('unsafe-eval')&&!html.includes('unsafe-inline'),'Missing strict production script/style policy.');
check(!html.includes('__DEV_CONNECT__')&&!html.includes('127.0.0.1'),'Development connection policy leaked.');
check(!/<script[^>]*src=["']https?:/i.test(html),'External runtime script.');
check(!/\son[a-z]+\s*=/i.test(html),'Inline event handler.');
const assets=JSON.parse(await readFile(join(root,'assets/manifest.json'),'utf8'));
for(const asset of Object.values(assets.assets)){
  check(/^[a-zA-Z0-9]+\.webp$/.test(asset.file),'Unsafe asset name.');
  const bytes=await readFile(join(root,'assets',asset.file));check(createHash('sha256').update(bytes).digest('hex')===asset.sha256,`Texture integrity mismatch: ${asset.file}`);
}
const pkg=JSON.parse(await readFile('package.json','utf8')),lock=JSON.parse(await readFile('package-lock.json','utf8'));
for(const version of Object.values({...pkg.dependencies,...pkg.devDependencies}))check(/^\d+\.\d+\.\d+$/.test(version),'Unpinned direct dependency.');
for(const [path,entry]of Object.entries(lock.packages))if(path){check(!entry.link,'Linked dependency.');check(entry.resolved?.startsWith('https://registry.npmjs.org/'),'Non-registry dependency source.');check(/^sha512-/.test(entry.integrity??''),'Dependency integrity missing.');}
check(files.some(f=>f.rel==='THIRD_PARTY_NOTICES.txt'),'Third-party notices missing.');
const total=files.reduce((sum,f)=>sum+f.bytes,0);check(total<8*1024*1024,'Release exceeds the static delivery budget.');
const manifest={schema:1,version:pkg.version,sourceCommit:process.env.GITHUB_SHA??process.env.SOURCE_COMMIT??'local-uncommitted',
  bytes:total,personalStateIncluded:false,sourceMapsIncluded:false,nativeExecutablesIncluded:false,
  files:files.map(({rel,bytes,sha256})=>({path:rel,bytes,sha256}))};
await writeFile(join(root,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`PASS: ${files.length} release files, ${(total/1024/1024).toFixed(2)} MiB; SHA256, paths, dependency pins, CSP and private-state exclusions checked.`);
