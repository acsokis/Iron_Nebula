import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
const source=resolve(process.argv[2] ?? '../Assets');
const destination=resolve('public/assets');
await mkdir(destination,{recursive:true});
const files={
  ship:'HD/player_stable.png',scout:'HD/enemy_scout_stable.png',interceptor:'HD/enemy_interceptor_stable.png',heavy:'HD/enemy_heavy_stable.png',
  frontier:'HD/outer_frontier_cinematic.png',rift:'Rift/rift_clean_075.png',inferno:'Inferno/inferno_backdrop_0.jpg',
  riftGuardian:'Rift/rift_guardian_boss.png',riftBoss:'Rift/rift_colossus_boss.png',
  infernoGuardian:'Inferno/inferno_guardian_boss.png',infernoBoss:'Inferno/inferno_titan_boss.png',
  dart:'Rift/rift_dart.png',wisp:'Rift/rift_wisp.png',infernoEnemy:'Inferno/inferno_enemy_0.png',
  pulse:'FX/primary_pulse.png',lance:'FX/primary_lance.png',arc:'FX/primary_arc.png',gatling:'FX/primary_gatling.png',
  warden:'mini_warden.png',sentinel:'boss_sentinel.png',rock:'HD/rock_04.png',rock2:'HD/rock_09.png',drone:'support_drone.png',shield:'shield_ring.png',
};
const manifest={schema:1,assets:{}};
for(const [key,name] of Object.entries(files)){
  const input=await readFile(resolve(source,name));
  const background=['frontier','rift','inferno'].includes(key);
  const pipeline=sharp(input);
  if(!background) pipeline.trim({background:'#00000000',threshold:1});
  const output=await pipeline.resize({width:background?1920:640,height:background?1080:640,fit:'inside',withoutEnlargement:true})
    .webp({quality:background?87:92,alphaQuality:100,effort:6}).toBuffer();
  const file=`${key}.webp`;await writeFile(resolve(destination,file),output);
  const metadata=await sharp(output).metadata();
  manifest.assets[key]={file,source:name,width:metadata.width,height:metadata.height,bytes:output.length,sha256:createHash('sha256').update(output).digest('hex')};
}
await writeFile(resolve(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${Object.keys(files).length} original-game web textures in ${relative(process.cwd(),destination)}; no soundtrack included.`);
