import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const destination=resolve('public/assets');await mkdir(destination,{recursive:true});
const manifest=JSON.parse(await readFile(resolve(destination,'manifest.json'),'utf8'));
for(const [key,name]of Object.entries({spaceFrontier:'frontier',spaceRift:'rift',spaceInferno:'inferno'})){
  const input=await readFile(resolve(`../Assets/Space/${name}.png`)),original=await sharp(input).metadata();
  const bytes=await sharp(input).webp({quality:90,effort:6}).toBuffer(),file=`${key}.webp`;
  await writeFile(resolve(destination,file),bytes);
  manifest.assets[key]={file,source:`Space/${name}.png`,width:original.width,height:original.height,sourceWidth:original.width,sourceHeight:original.height,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
await writeFile(resolve(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Prepared three shared generated space backgrounds.');
