import * as THREE from 'three';
import {ShieldSpectrum,voxelCount} from './shield-spectrum.js';

const clamp=v=>Math.max(0,Math.min(1,v));
const rank=(x,y)=>{let h=Math.imul(x+1,374761393)^Math.imul(y+3,668265263);h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0;};
export class DamageVisuals{
  constructor(renderer){this.renderer=renderer;this.topologies=new Map();this.records=new Map();this.shards=[];this.shieldArt=null;this.frame=0;this.time=0;this.lastTime=0;}
  begin(time){if(time<this.time){this.records.clear();this.shards=[];}this.lastTime=this.time;this.time=time;this.frame++;}
  topology(texture){
    if(this.topologies.has(texture))return this.topologies.get(texture);
    const image=texture.image,columns=48,rows=Math.max(8,Math.round(columns*image.height/image.width)),canvas=document.createElement('canvas');canvas.width=columns;canvas.height=rows;
    const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0,columns,rows);const rgba=c.getImageData(0,0,columns,rows).data,cells=[];
    for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)if(rgba[(y*columns+x)*4+3]>20)cells.push({x,y,order:rank(x,y)});
    cells.sort((a,b)=>a.order-b.order||a.y-b.y||a.x-b.x);const bytes=new Uint8Array(columns*rows*4);bytes.fill(255);
    cells.forEach((cell,i)=>{const at=(cell.y*columns+cell.x)*4;bytes[at]=i>>8;bytes[at+1]=i&255;bytes[at+2]=0;});
    const mask=new THREE.DataTexture(bytes,columns,rows);mask.flipY=true;mask.magFilter=mask.minFilter=THREE.NearestFilter;mask.needsUpdate=true;
    const topology={cells,columns,rows,mask,texture};this.topologies.set(texture,topology);return topology;
  }
  silhouette(){
    if(this.shieldArt)return this.shieldArt;
    const image=this.renderer.textures.ship.image,width=512,height=Math.round(width*image.height/image.width),margin=24;
    const mask=document.createElement('canvas');mask.width=width+margin*2;mask.height=height+margin*2;
    const m=mask.getContext('2d');m.drawImage(image,margin,margin,width,height);m.globalCompositeOperation='source-in';m.fillStyle='#72eaff';m.fillRect(0,0,mask.width,mask.height);
    const canvas=document.createElement('canvas');canvas.width=mask.width;canvas.height=mask.height;const c=canvas.getContext('2d');
    // Alpha-derived dilation minus the hull: no circular approximation or baked
    // shield ring. The same silhouette follows banking and the native origin.
    c.shadowColor='#62dcff';c.shadowBlur=9;
    for(let i=0;i<16;i++){const a=i*Math.PI/8;c.drawImage(mask,Math.cos(a)*7,Math.sin(a)*7);}
    c.shadowBlur=0;c.globalCompositeOperation='destination-out';c.drawImage(mask,0,0);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
    this.shieldArt={texture,width,height,margin};return this.shieldArt;
  }
  attach(sprite,topology,shield){
    let u=sprite.material.userData.voxels;if(u)return u;
    u={voxelMask:{value:topology.mask},voxelKeep:{value:topology.cells.length},shieldWave:{value:new Float32Array(64)},shieldFlash:{value:0}};
    sprite.material.userData.voxels=u;
    sprite.material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,u);
      shader.fragmentShader=`uniform sampler2D voxelMask;uniform float voxelKeep;${shield?'uniform float shieldWave[64];uniform float shieldFlash;':''}\n`+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`${shield?`vec2 shieldUv=vMapUv;float angle=atan((shieldUv.y-.5)*.48,shieldUv.x-.5);int mode=int(mod((angle/6.2831853+1.0)*64.0,64.0));shieldUv+=normalize(shieldUv-.5+vec2(.0001))*shieldWave[mode]*.012;diffuseColor*=texture2D(map,shieldUv);diffuseColor.rgb*=1.5+shieldFlash*1.8;`:'#include <map_fragment>'}
        vec2 encoded=texture2D(voxelMask,vMapUv).rg;float cellRank=floor(encoded.r*65280.0+encoded.g*255.0+.5);if(cellRank>=voxelKeep)discard;`);
    };
    sprite.material.customProgramCacheKey=()=>shield?'nebula-shield-spectrum-v1':'nebula-hull-voxels-v1';sprite.material.needsUpdate=true;return u;
  }
  metallicFrame(key,sprite,texture){
    const frame=this.renderer.sprite(`metallic:${key}`,texture,sprite.position.x,1080-sprite.position.y,
      sprite.scale.x*1.075,sprite.scale.y*1.075,'#9ab0bd',-sprite.material.rotation,sprite.renderOrder-.01,sprite.material.opacity);
    frame.center.copy(sprite.center);
  }
  track(key,sprite,texture,fraction,{shield=false,hurt=0,impact=null,metallic=false}={}){
    fraction=clamp(fraction);const topology=this.topology(texture),keep=voxelCount(fraction,topology.cells.length),u=this.attach(sprite,topology,shield);
    if(metallic&&!shield)this.metallicFrame(key,sprite,texture);
    let record=this.records.get(key);
    if(!record||record.topology!==topology){record={topology,keep,spectrum:shield?new ShieldSpectrum():null,hurt,flash:0};this.records.set(key,record);}
    const changed=keep!==record.keep;
    if(keep<record.keep)this.breakCells(record,keep,record.keep,shield);
    if(shield&&(changed||hurt!==record.hurt)){
      let phase=.5;if(impact){const dx=impact.x-sprite.position.x,dy=1080-impact.y-sprite.position.y;phase=Math.atan2(dy,dx)/(Math.PI*2);}
      record.spectrum.impulse(phase,keep>record.keep?.65:1.4);record.flash=1;
    }
    record.keep=keep;record.hurt=hurt;record.frame=this.frame;record.sprite=sprite;
    // Snapshot transforms: THREE's object pool may reuse/hide the sprite later.
    record.transform={x:sprite.position.x,y:1080-sprite.position.y,z:sprite.position.z,width:sprite.scale.x,height:sprite.scale.y,cx:sprite.center.x,cy:sprite.center.y,angle:-sprite.material.rotation,mirror:texture.repeat.x<0};
    u.voxelMask.value=topology.mask;u.voxelKeep.value=keep;
    if(shield){u.shieldWave.value=record.spectrum.step(this.time-this.lastTime);record.flash*=Math.exp(-Math.max(0,this.time-this.lastTime)*4);u.shieldFlash.value=record.flash;}
  }
  breakCells(record,from,to,shield){
    if(!record.transform)return;const {cells,columns,rows,texture}=record.topology,t=record.transform;
    for(let i=from;i<to;i++){
      const cell=cells[i],u=(cell.x+.5)/columns,v=(cell.y+.5)/rows;
      const dx=((t.mirror?1-u:u)-t.cx)*t.width,dy=(v-(1-t.cy))*t.height,c=Math.cos(t.angle),s=Math.sin(t.angle);
      const x=t.x+dx*c-dy*s,y=t.y+dx*s+dy*c,angle=(rank(cell.y,cell.x)%6283)/1000;
      this.shards.push({texture,columns,rows,frame:cell.y*columns+cell.x,x,y,z:t.z+.3,width:t.width/columns,height:t.height/rows,
        vx:Math.cos(angle)*(shield?100:60)-40,vy:Math.sin(angle)*(shield?100:60),rotation:t.angle,spin:(i%9-4)*.8,born:this.time,life:shield?.65:1.5});
    }
    if(this.shards.length>1200)this.shards.splice(0,this.shards.length-1200);
  }
  shield(key,hull,fraction,hurt,impact){
    const art=this.silhouette(),factorX=1+art.margin*2/art.width,factorY=1+art.margin*2/art.height;
    const sprite=this.renderer.sprite(key,art.texture,hull.position.x,1080-hull.position.y,hull.scale.x*factorX,hull.scale.y*factorY,'#a8f5ff',-hull.material.rotation,4.3,.85);
    sprite.center.set((hull.center.x*art.width+art.margin)/(art.width+art.margin*2),(hull.center.y*art.height+art.margin)/(art.height+art.margin*2));
    this.track(key,sprite,art.texture,fraction,{shield:true,hurt,impact});
  }
  end(){
    for(const [key,r]of this.records)if(r.frame!==this.frame){if(r.transform?.x>-100&&r.transform?.x<2050)this.breakCells(r,0,r.keep,!!r.spectrum);this.records.delete(key);}
    this.shards=this.shards.filter(s=>this.time-s.born<s.life);
    for(const s of this.shards){const age=this.time-s.born;
      this.renderer.gpuSprites.add(`voxel:${s.texture.uuid}`,s.texture,{x:s.x+s.vx*age,y:s.y+s.vy*age+age*age*18,width:s.width,height:s.height,rotation:s.rotation+s.spin*age,opacity:Math.min(1,(s.life-age)*3),frame:s.frame,columns:s.columns,rows:s.rows,z:s.z},1200);
    }
  }
  diagnostics(){return {backend:'GPU voxel masks and instanced fragments',fragments:this.shards.length,objects:[...this.records].map(([key,r])=>{
    const hull=r.sprite,frame=this.renderer.pool.get(`metallic:${key}`)?.sprite;
    return {key,total:r.topology.cells.length,remaining:r.keep,shield:!!r.spectrum,wave:r.spectrum?Math.max(...r.spectrum.field.map(Math.abs)):0,
      metallicFrame:!!frame?.visible,frameBehind:!!frame&&frame.renderOrder<hull.renderOrder,frameUsesHullTexture:!!frame&&frame.material.map===hull.material.map,
      frameScale:frame&&hull.scale.x?frame.scale.x/hull.scale.x:0};
  })};}
}
