import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
const root=resolve('node_modules'),lock=JSON.parse(await readFile('package-lock.json','utf8'));
const notices=['IRON NEBULA WEB — THIRD-PARTY NOTICES','Game imagery remains attributed to the original Iron Nebula project. No original soundtrack is distributed.',''];
const inventory=[];
for(const [path,entry]of Object.entries(lock.packages)){
  if(!path||entry.dev||entry.devOptional)continue;
  const dir=resolve(path);if(relative(root,dir).startsWith('..'))throw new Error('Package outside node_modules.');
  let pkg;try{pkg=JSON.parse(await readFile(join(dir,'package.json'),'utf8'));}catch{continue;}
  const names=(await readdir(dir)).filter(name=>/^(licen[sc]e|copying|notice)(\.|$)/i.test(name));
  inventory.push({name:pkg.name,version:pkg.version,license:pkg.license??'SEE LICENSE'});
  notices.push(`\n${'='.repeat(72)}\n${pkg.name}@${pkg.version}\nLicense: ${typeof pkg.license==='string'?pkg.license:'see package license'}\n`);
  for(const name of names){const text=await readFile(join(dir,name),'utf8');if(text.length>200000)throw new Error('Unexpectedly large license file.');notices.push(`${name}\n${text}`);}
  if(!names.length)notices.push('No top-level license text file was included by this package. Refer to its pinned npm package metadata.');
}
await writeFile('public/THIRD_PARTY_NOTICES.txt',notices.join('\n').trimEnd()+'\n');
await writeFile('public/dependency-licenses.json',JSON.stringify(inventory.sort((a,b)=>a.name.localeCompare(b.name)),null,2)+'\n');
console.log(`Recorded licenses for ${inventory.length} installed production packages.`);
