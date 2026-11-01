import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
const source=resolve(process.argv[2] ?? '../Assets');
const destination=resolve('public/assets');
await mkdir(destination,{recursive:true});
const files={
  ship:'HD/player_sideview_refit.png',plume:'HD/player_engine_plume.png',scout:'HD/enemy_scout_stable.png',interceptor:'HD/enemy_interceptor_stable.png',heavy:'HD/enemy_heavy_stable.png',
  frontier:'HD/outer_frontier_cinematic.png',rift:'Rift/rift_clean_075.png',inferno:'Inferno/inferno_backdrop_0.jpg',
  riftGuardian:'Rift/rift_guardian_boss.png',riftBoss:'Rift/rift_colossus_boss.png',
  infernoGuardian:'Inferno/inferno_guardian_boss.png',infernoBoss:'Inferno/inferno_titan_boss.png',
  dart:'Rift/rift_dart.png',wisp:'Rift/rift_wisp.png',infernoEnemy:'Inferno/inferno_enemy_0.png',
  pulse:'FX/primary_pulse.png',lance:'FX/primary_lance.png',arc:'FX/primary_arc.png',gatling:'FX/primary_gatling.png',
  warden:'mini_warden.png',sentinel:'boss_sentinel.png',rock:'HD/rock_04.png',rock2:'HD/rock_09.png',drone:'support_drone.png',shield:'shield_ring.png',
  shieldShell:'FX/shield_shell.png',cockpit:'FX/cockpit_hud_slim_075.png',menu:'UI/menu_backdrop_092.jpg',uiAtlas:'ui_atlas.png',
  pickupCredits:'FX/pickup_credits.png',pickupWeapon:'FX/pickup_weapon.png',pickupShield:'FX/pickup_shield.png',pickupRepair:'FX/pickup_repair.png',pickupDrone:'FX/pickup_drone.png',
  explosion:'FX/explosion_sheet.png',damageSmoke:'FX/damage_smoke_sheet.png',beamStrip:'FX/primary_beam_strip.png',beamMuzzle:'FX/primary_beam_muzzle.png',
  impactPulse:'FX/impact_pulse.png',impactLance:'FX/impact_lance.png',impactArc:'FX/impact_arc.png',impactGatling:'FX/impact_gatling.png',impactBeam:'FX/impact_beam.png',
  hull1:'HD/hull_damage_1.png',hull2:'HD/hull_damage_2.png',hull3:'HD/hull_damage_3.png',
  dofFar:'HD/dof_far_04.png',dofMid:'HD/dof_mid_04.png',dofNear:'HD/dof_near_04.png',
};
const manifest={schema:1,assets:{}};
for(const [key,name] of Object.entries(files)){
  const input=await readFile(resolve(source,name));
  const background=['frontier','rift','inferno','menu','cockpit','explosion','damageSmoke','uiAtlas'].includes(key);
  const pipeline=sharp(input);
  const original=await sharp(input).metadata();
  // Preserve transparent hull edges and icon details: lossy RGB compression
  // introduces dark/color fringes beside the otherwise lossless alpha channel.
  const transparent=!!original.hasAlpha;
  const output=await pipeline.resize({width:background?1920:1280,height:background?1080:1280,fit:'inside',withoutEnlargement:true})
    .webp({quality:background?87:92,lossless:transparent||key==='uiAtlas',alphaQuality:100,effort:6}).toBuffer();
  const file=`${key}.webp`;await writeFile(resolve(destination,file),output);
  const metadata=await sharp(output).metadata();
  manifest.assets[key]={file,source:name,width:metadata.width,height:metadata.height,sourceWidth:original.width,sourceHeight:original.height,bytes:output.length,sha256:createHash('sha256').update(output).digest('hex')};
}
await writeFile(resolve(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${Object.keys(files).length} original-game web textures in ${relative(process.cwd(),destination)}; no soundtrack included.`);
