import * as THREE from 'three';
import {WIDTH,HEIGHT,COLORS,SECTORS,WEAPONS} from './world.js';
import {HdrPresenter} from './hdr.js';
import {orbitTiles,wrap} from './orbit.js';
import {GpuSprites} from './gpu-sprites.js';
import {DamageVisuals} from './damage-visuals.js';
import {downloadAsset} from './preload.js';

const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const lighting=`precision highp float;
varying vec2 vUv;uniform vec4 lights[24];uniform vec3 colors[24];uniform vec3 blocks[12];uniform int lightCount,blockCount;
uniform float shadows;void main(){vec2 p=vec2(vUv.x*1920.,(1.-vUv.y)*1080.);vec3 total=vec3(0.);
for(int i=0;i<24;i++){if(i>=lightCount)break;vec2 d=lights[i].xy-p;float len=length(d),fall=max(0.,1.-len/lights[i].z);float visible=1.;
if(shadows>.5&&fall>0.)for(int j=0;j<12;j++){if(j>=blockCount)break;vec2 c=blocks[j].xy-p;float t=dot(c,d)/max(dot(d,d),1.);
if(t>.025&&t<.97&&length(c)>blocks[j].z*.85){float dist=length(c-d*t);visible*=mix(1.,smoothstep(blocks[j].z*.8,blocks[j].z+18.,dist),.87);}}
total+=colors[i]*fall*fall*lights[i].w*visible;}
gl_FragColor=vec4(total,1.);}`;
const bounce=`precision highp float;varying vec2 vUv;uniform sampler2D previous,albedo;uniform vec2 texel;uniform float radius;
void main(){vec3 sum=texture2D(previous,vUv).rgb*.2;
for(int i=0;i<8;i++){float a=float(i)*.785398;vec2 uv=vUv+vec2(cos(a),sin(a))*texel*radius;
sum+=texture2D(previous,uv).rgb*.1;}
vec3 surface=texture2D(albedo,vUv).rgb;gl_FragColor=vec4(sum*(.35+.65*surface)*.87,1.);}`;
const bloom=`precision highp float;varying vec2 vUv;uniform sampler2D source,lightmap;uniform vec2 texel;uniform float extract;
vec3 tap(vec2 uv){vec3 c=texture2D(source,uv).rgb;if(extract>.5)c=max(c*(.6+texture2D(lightmap,uv).rgb)-.8,0.);return c;}
void main(){vec3 sum=tap(vUv)*.24;sum+=(tap(vUv+texel*2.)+tap(vUv-texel*2.))*.2;
sum+=(tap(vUv+texel*4.)+tap(vUv-texel*4.))*.18;gl_FragColor=vec4(sum,1.);}`;
const composite=`precision highp float;varying vec2 vUv;uniform sampler2D scene,lightmap,giMap,bloomMap;
uniform float giStrength,bloomStrength,fogStrength,ambient,time,lightingOn,hdrEnabled,outputHDR;uniform vec3 fogColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(a),hash(a+vec2(1.,0.)),f.x),mix(hash(a+vec2(0.,1.)),hash(a+1.),f.x),f.y);}
void main(){vec3 base=texture2D(scene,vUv).rgb,l=texture2D(lightmap,vUv).rgb,gi=texture2D(giMap,vUv).rgb;
vec3 color=base*(lightingOn>.5?vec3(ambient)+l+gi*giStrength:vec3(1.));
color+=texture2D(bloomMap,vUv).rgb*bloomStrength;
float n=noise(vUv*vec2(6.,4.)+vec2(time*.017,time*.008))*.65+noise(vUv*vec2(16.,10.)-time*.014)*.35;
float fog=fogStrength*n*.38;color=mix(color,fogColor+ l*.16+gi*.11,fog);
float vignette=1.-.18*pow(length((vUv-.5)*1.4),2.);color*=vignette;
if(outputHDR>.5){gl_FragColor=vec4(max(color,vec3(0.)),1.);return;}
color=hdrEnabled>.5?vec3(1.)-exp(-color*1.16):clamp(color,0.,1.);gl_FragColor=vec4(color,1.);
#include <colorspace_fragment>
}`;

export class Renderer{
  constructor(canvas,manifest){
    this.canvas=canvas;this.manifest=manifest;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.context=this.renderer.getContext();if(!(this.context instanceof WebGL2RenderingContext))throw new Error('WebGL 2 is required.');
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor('#030715');
    this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(0,WIDTH,HEIGHT,0,-100,100);this.camera.position.z=10;
    this.gpuSprites=new GpuSprites(this.scene);
    this.damageVisuals=new DamageVisuals(this);
    this.postScene=new THREE.Scene();this.postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));this.postScene.add(this.quad);
    this.pool=new Map();this.textures={};this.frame=0;this.frames=new Map();this.mirrors=new Map();this.pickupBadges=new Map();
    this.settings={lighting:true,gi:true,shadows:false,bloom:.65,fog:.28,ambient:.56,quality:.75,hdr:true,fxBudget:48,profile:'balanced'};
    const target=(w,h)=>new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false});
    // Half-float targets preserve emissive energy before bloom and radiance diffusion.
    this.hdr=!!this.context.getExtension('EXT_color_buffer_float');
    this.settings.hdr=this.hdr;
    const make=(w,h)=>{const t=target(w,h);if(!this.hdr)t.texture.type=THREE.UnsignedByteType;return t;};
    this.base=make(1280,720);this.light=make(480,270);this.giA=make(480,270);this.giB=make(480,270);this.bloomA=make(480,270);this.bloomB=make(480,270);
    this.lightMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:lighting,uniforms:{lights:{value:Array.from({length:24},()=>new THREE.Vector4())},colors:{value:Array.from({length:24},()=>new THREE.Color())},blocks:{value:Array.from({length:12},()=>new THREE.Vector3())},lightCount:{value:0},blockCount:{value:0},shadows:{value:1}}});
    this.giMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:bounce,uniforms:{previous:{value:null},albedo:{value:this.base.texture},texel:{value:new THREE.Vector2(1/480,1/270)},radius:{value:4}}});
    this.bloomMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:bloom,uniforms:{source:{value:null},lightmap:{value:this.light.texture},texel:{value:new THREE.Vector2(1/480,0)},extract:{value:1}}});
    this.finalMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:composite,uniforms:{scene:{value:this.base.texture},lightmap:{value:this.light.texture},giMap:{value:this.giB.texture},bloomMap:{value:this.bloomB.texture},giStrength:{value:.85},bloomStrength:{value:.8},fogStrength:{value:.38},ambient:{value:.56},time:{value:0},lightingOn:{value:1},hdrEnabled:{value:1},outputHDR:{value:0},fogColor:{value:new THREE.Color('#20384d')}}});
    this.presenter=new HdrPresenter(canvas);
    this.glow=this.makeGlow();this.smoke=this.makeSmoke();this.white=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);this.white.needsUpdate=true;
    this.resize();
  }
  async load(onProgress=()=>{}){
    const entries=Object.entries(this.manifest.assets),loader=new THREE.TextureLoader(),total=entries.reduce((sum,[,a])=>sum+a.bytes,0),bytes=new Map();let done=0,index=0;
    const report=(key,asset,received)=>{bytes.set(key,received);const loaded=[...bytes.values()].reduce((sum,value)=>sum+value,0);onProgress(Math.min(1,loaded/total),{loaded,total,completed:done,count:entries.length,asset:asset.file});};
    const worker=async()=>{while(index<entries.length){const [key,asset]=entries[index++];
      const blob=await downloadAsset(new URL(`./assets/${asset.file}`,document.baseURI).href,received=>report(key,asset,received));
      const url=URL.createObjectURL(blob);let texture;try{texture=await loader.loadAsync(url);}finally{URL.revokeObjectURL(url);}
      texture.colorSpace=THREE.SRGBColorSpace;
      // Transparent art must not average opaque black padding into mip levels.
      // Linear sampling retains the source alpha edge at the small gameplay scale.
      if(!['frontier','rift','inferno','menu'].includes(key)){texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;}
      this.textures[key]=texture;done++;report(key,asset,asset.bytes);
    }};await Promise.all(Array.from({length:4},worker));
  }
  async prepare(world,onProgress=()=>{}){
    this.render(world,0,true);const textures=[...new Set([...Object.values(this.textures),this.glow,this.smoke,this.white])];
    for(let i=0;i<textures.length;i++){this.renderer.initTexture(textures[i]);onProgress((i+1)/(textures.length+5));if(i%4===0)await new Promise(requestAnimationFrame);}
    await this.renderer.compileAsync(this.scene,this.camera);
    const materials=[this.lightMaterial,this.giMaterial,this.bloomMaterial,this.finalMaterial];
    for(let i=0;i<materials.length;i++){this.quad.material=materials[i];await this.renderer.compileAsync(this.postScene,this.postCamera);onProgress((textures.length+i+2)/(textures.length+5));}
  }
  makeGlow(){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'white');g.addColorStop(.18,'rgba(255,255,255,.8)');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(canvas);}
  pickupBadge(art,color){
    if(this.pickupBadges.has(art))return this.pickupBadges.get(art);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
    const plate=c.createLinearGradient(0,22,0,234);plate.addColorStop(0,'#294554');plate.addColorStop(.45,'#071522');plate.addColorStop(1,'#142736');
    c.beginPath();c.arc(128,128,111,0,Math.PI*2);c.fillStyle=plate;c.fill();
    const rim=c.createLinearGradient(30,20,210,240);rim.addColorStop(0,'#e2f6ff');rim.addColorStop(.35,'#426379');rim.addColorStop(.7,'#1a2b38');rim.addColorStop(1,'#8ba9b8');
    c.strokeStyle=rim;c.lineWidth=5;c.stroke();
    c.beginPath();c.arc(128,128,99,0,Math.PI*2);c.strokeStyle=color;c.lineWidth=2;c.globalAlpha=.65;c.stroke();c.globalAlpha=1;
    for(let i=0;i<4;i++){const a=i*Math.PI/2;c.beginPath();c.arc(128,128,105,a-.15,a+.15);c.strokeStyle=color;c.lineWidth=6;c.stroke();}
    // Retain the original collectible glyph, framed consistently across types.
    c.drawImage(this.textures[art].image,52,52,152,152);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;this.pickupBadges.set(art,texture);return texture;
  }
  fieldArt(kind){
    if(this.textures[kind])return this.textures[kind];
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');c.translate(128,128);
    c.strokeStyle='#99b5c4';c.fillStyle='#263846';c.lineWidth=5;
    if(kind==='station'){
      c.beginPath();c.arc(0,0,97,0,Math.PI*2);c.stroke();
      for(let i=0;i<6;i++){c.save();c.rotate(i*Math.PI/3);c.fillRect(18,-9,72,18);c.strokeRect(18,-9,72,18);c.fillStyle='#58ddff';c.fillRect(55,-4,24,8);c.restore();}
      c.beginPath();c.arc(0,0,30,0,Math.PI*2);c.fill();c.stroke();
    }else{
      c.rotate(.3);for(let i=0;i<5;i++){c.fillStyle=['#40505c','#23303c','#73818a'][i%3];c.fillRect(-88+i*27,-35+(i%2)*22,56,63);c.strokeRect(-88+i*27,-35+(i%2)*22,56,63);}
      c.fillStyle='#e4b16c';c.fillRect(-45,-8,56,5);c.fillStyle='#64d8ef';c.fillRect(45,10,24,7);
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;this.textures[kind]=texture;return texture;
  }
  makeSmoke(){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),image=ctx.createImageData(128,128);
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){const n=.55+.2*Math.sin(x*.19+y*.13)+.15*Math.sin(x*.41-y*.21),r=Math.hypot(x-64,y-64)/64,index=(y*128+x)*4;
      image.data[index]=image.data[index+1]=image.data[index+2]=135+n*75;image.data[index+3]=Math.max(0,1-r*r)*n*180;}
    ctx.putImageData(image,0,0);return new THREE.CanvasTexture(canvas);}
  resize(){const box=this.canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5)*this.settings.quality;
    this.renderer.setPixelRatio(ratio);this.renderer.setSize(Math.max(1,box.width),Math.max(1,box.height),false);
    const fit=Math.min(box.width/1920,box.height/1080);this.viewport={x:(box.width-1920*fit)/2,y:(box.height-1080*fit)/2,width:1920*fit,height:1080*fit};
    this.base.setSize(Math.max(640,Math.round(this.viewport.width*ratio)),Math.max(360,Math.round(this.viewport.height*ratio)));}
  preset(name){const presets={performance:{quality:.5,fxBudget:24,gi:false,shadows:false,bloom:.4,fog:.16},balanced:{quality:.75,fxBudget:48,gi:true,shadows:false,bloom:.65,fog:.28},high:{quality:1,fxBudget:100,gi:true,shadows:true,bloom:.8,fog:.38}};if(!presets[name])return;Object.assign(this.settings,presets[name],{profile:name});this.resize();}
  setHdrLighting(enabled){this.settings.hdr=!!enabled&&this.hdr;
    if(!this.settings.hdr)this.presenter.disable();
    for(const target of [this.base,this.light,this.giA,this.giB,this.bloomA,this.bloomB]){target.dispose();target.texture.type=this.settings.hdr?THREE.HalfFloatType:THREE.UnsignedByteType;}
  }
  async setHdrDisplay(enabled){
    if(!enabled){this.presenter.disable();return;}
    if(!this.hdr)throw new Error('Floating-point WebGL rendering is not available.');
    this.setHdrLighting(true);await this.presenter.enable();
    this.hdrTarget??=new THREE.WebGLRenderTarget(960,540,{type:THREE.FloatType,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});this.hdrPixels??=new Float32Array(960*540*4);
  }
  sprite(key,texture,x,y,width,height,color='#ffffff',rotation=0,z=0,opacity=1){
    let entry=this.pool.get(key);if(!entry){const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false});
      entry={sprite:new THREE.Sprite(material),last:this.frame};this.scene.add(entry.sprite);this.pool.set(key,entry);}
    const s=entry.sprite;entry.last=this.frame;s.visible=true;s.material.map=texture;s.material.color.set(color);s.material.rotation=-rotation;s.material.opacity=opacity;
    s.position.set(x,HEIGHT-y,z);s.scale.set(width,height,1);s.renderOrder=z;return s;
  }
  object(key,textureKey,x,y,width,color='#ffffff',rotation=0,z=1){const meta=this.manifest.assets[textureKey];if(meta)return this.sprite(key,this.textures[textureKey],x,y,width,width*meta.height/meta.width,color,rotation,z);}
  oriented(art,flip=false){if(!flip)return this.textures[art];if(!this.mirrors.has(art)){const texture=this.textures[art].clone();texture.repeat.x=-1;texture.offset.x=1;texture.needsUpdate=true;this.mirrors.set(art,texture);}return this.mirrors.get(art);}
  native(key,art,x,y,scale,color='#ffffff',rotation=0,z=1,flip=false,opacity=1,origin=null){
    const meta=this.manifest.assets[art];if(!meta)return;const width=meta.sourceWidth*scale,height=meta.sourceHeight*scale;
    const sprite=this.sprite(key,this.oriented(art,flip),x,y,width,height,color,rotation,z,opacity);
    sprite.center.set(origin?(flip?1-origin[0]/meta.sourceWidth:origin[0]/meta.sourceWidth):.5,origin?1-origin[1]/meta.sourceHeight:.5);return sprite;
  }
  frameTexture(art,frame,columns,rows){const key=`${art}:${frame}`;if(!this.frames.has(key)){const texture=this.textures[art].clone();texture.repeat.set(1/columns,1/rows);texture.offset.set((frame%columns)/columns,1-(Math.floor(frame/columns)+1)/rows);texture.needsUpdate=true;this.frames.set(key,texture);}return this.frames.get(key);}
  pass(material,target){this.quad.material=material;this.renderer.setRenderTarget(target);
    if(target===null){const box=this.canvas.getBoundingClientRect();this.renderer.setViewport(0,0,box.width,box.height);this.renderer.clear();const v=this.viewport;this.renderer.setViewport(v.x,v.y,v.width,v.height);}
    this.renderer.render(this.postScene,this.postCamera);}
  render(w,localId=0,preparing=false){
    this.frame++;for(const e of this.pool.values())e.sprite.visible=false;this.gpuSprites.begin();this.damageVisuals.begin(w.time);
    const sector=SECTORS[w.sector-1]??SECTORS[0],pilot=w.players.find(p=>p.id===localId),orbit=orbitTiles(w.time,pilot);
    this.orbitView=orbit.camera;
    const background=['spaceFrontier','spaceRift','spaceInferno'][w.sector-1]??'spaceFrontier';
    for(const [i,tile] of orbit.tiles.entries()){
      const sprite=this.sprite(`background${i}`,this.textures[background],tile.x,tile.y,WIDTH+256,HEIGHT+100,'#ffffff',0,-20);
      sprite.renderOrder=-20+i*.001;
      if(!sprite.material.userData.periodic){sprite.material.userData.periodic=true;sprite.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.a*=smoothstep(0.0,0.117647,vMapUv.x);');};sprite.material.customProgramCacheKey=()=> 'periodic-space-overlap';sprite.material.needsUpdate=true;}
    }
    // Independent depth layers orbit past the painted celestial body. These
    // rocks are scenery only; collidable hazards are rendered separately.
    for(let layer=0;layer<1;layer++)for(let i=0;i<4;i++){
      const depth=layer+1,speed=[35,140,340][layer],x=wrap(i*389+layer*137-w.time*speed,2500)-290;
      const y=wrap(i*263+layer*151,1120)-20-orbit.camera.y*depth;
      this.object(`parallax${layer}-${i}`,i%2?'rock':'rock2',x,y,40+depth*28+i%3*12,['#788b9c','#b4c2d0','#ffffff'][layer],i*.8+w.time*.008,-13+layer);
    }
    for(let i=0;i<55;i++){const x=((i*383.1-w.time*(18+i%4*13))%2200+2200)%2200-140,y=165+(i*173.23)%800;
      this.sprite(`star${i}`,this.glow,x,y,i%7===0?8:3,i%7===0?8:3,'#b8e5ff',0,-15,.65);}
    for(const r of w.rocks){const texture=['wreck','station'].includes(r.kind)?this.fieldArt(r.kind):this.textures[r.id%2?'rock':'rock2'];
      const sprite=this.sprite(`rock${r.id}`,texture,r.x,r.y,r.radius*2,r.radius*2,'#d4e1ef',r.angle,1);this.damageVisuals.track(`rock${r.id}`,sprite,texture,r.health/(r.maxHealth??4));}
    for(const e of w.enemies){let texture=e.kind==='boss'?(w.sector===1?(e.bossType===1?'warden':'sentinel'):w.sector===2?(e.bossType===1?'riftGuardian':'riftBoss'):(e.bossType===1?'infernoGuardian':'infernoBoss')):
        w.sector===3?'infernoEnemy':w.sector===2?(e.kind==='heavy'?'heavy':e.kind==='scout'?'dart':'wisp'):e.kind;
      const scale=e.kind==='boss'?(w.sector===1?(e.bossType===1?.83:1)*.82:w.sector===2?(e.bossType===1?.48:.54):.5):w.sector===1?({heavy:.5,interceptor:.42,scout:.41}[e.kind])*.82:w.sector===2?.32*.82:.62*.82;
      const sprite=this.native(`enemy${e.id}`,texture,e.x,e.y,scale,'#ffffff',Math.sin(e.age)*.025,2,['scout','interceptor','heavy','warden'].includes(texture));
      this.damageVisuals.track(`enemy${e.id}`,sprite,sprite.material.map,e.health/e.maxHealth,{metallic:true});
    }
    for(const p of w.players){if(p.lives<=0)continue;
      const roll=p.vy/550*.08,scale=.26*.82,plume=this.manifest.assets.plume;
      this.native(`engine${p.id}`,'plume',p.x-150*.82,p.y+2*.82,(.34+.02*Math.sin(w.time*12))*.82,'#ffffff',roll,2,false,.74,[plume.sourceWidth*.92,plume.sourceHeight*.5]);
      const hull=this.native(`player${p.id}`,'ship',p.x,p.y,scale,p.id===localId?'#ffffff':COLORS[p.id],roll,4,false,1,[690,292]);
      this.damageVisuals.track(`player${p.id}`,hull,this.textures.ship,p.health/p.maxHealth,{metallic:true});
      const impact=w.fx.findLast(f=>f.type==='impact'&&Math.hypot(f.x-p.x,f.y-p.y)<180);
      this.damageVisuals.shield(`shield${p.id}`,hull,p.shield/Math.max(1,p.maxShield),p.hurt,impact);
      if(p.drone||w.upgrades.drone)this.native(`drone${p.id}`,'drone',p.x-75,p.y-65,.43*.82,'#ffffff',0,4);
      if(p.beam){const end=p.beamEnd||1880,width=Math.max(1,end-p.x-80),thickness=8+3.4*(p.level-1),pulse=.78+.22*Math.sin(w.time*12);
        for(let x=p.x+80,i=0;x<end;x+=192,i++){const length=Math.min(192,end-x);this.sprite(`beam${p.id}-${i}`,this.textures.beamStrip,x+length/2,p.y,length,thickness*3,'#ffffff',0,3,pulse);}
        this.native(`muzzle${p.id}`,'beamMuzzle',p.x+80,p.y,.7+p.level*.04,'#ffffff',0,4,false,pulse);
        this.sprite(`beamGlow${p.id}`,this.glow,p.x+80+width/2,p.y,width,45,WEAPONS[4].color,0,2,.3);}
    }
    for(const s of w.shots){const rotation=Math.atan2(s.vy,s.vx);if(s.friendly){const art=['pulse','lance','arc','gatling'][s.weapon]??'pulse',meta=this.manifest.assets[art],scale=[.54,.59,.51,.36][s.weapon]??.54;this.gpuSprites.add(art,this.textures[art],{x:s.x,y:s.y,width:meta.sourceWidth*scale,height:meta.sourceHeight*scale,rotation,anchor:.6});}
      else{const width=Math.max(.75,Math.min(1.55,s.radius/10));for(const [length,height,color,opacity]of [[43,width*10,'#030917',.8],[43,width*5.3,s.color,.93],[21,width*1.9,'#ffffff',.95]])this.gpuSprites.add('enemyShots',this.white,{x:s.x,y:s.y,width:length,height,rotation,color,opacity},1800);}}
    for(const p of w.pickups){const color={credits:'#ffd483',weapon:'#91f1ff',shield:'#71baff',repair:'#a0ffa9',drone:'#ceaeff'}[p.type];
      const art={credits:'pickupCredits',weapon:'pickupWeapon',shield:'pickupShield',repair:'pickupRepair',drone:'pickupDrone'}[p.type];
      const y=p.y+Math.sin(w.time*3+p.id)*3;
      this.sprite(`pickupGlow${p.id}`,this.glow,p.x,y,132,132,color,0,4,.14);
      this.sprite(`pickup${p.id}`,this.pickupBadge(art,color),p.x,y,108,108,'#ffffff',0,5);}
    for(const f of w.fx.slice(-this.settings.fxBudget)){const t=1-f.age/f.life;if(f.type==='explosion'){
        const frame=Math.min(7,Math.floor(f.age/.075));if(f.age<.6)this.sprite(`fx${f.id}`,this.frameTexture('explosion',frame,4,2),f.x,f.y,f.size*2,f.size*2,'#fff0e4',f.id*.7,6,Math.min(1,(1-f.age/.6)*3));
        this.gpuSprites.add('smoke',this.textures.damageSmoke,{x:f.x,y:f.y,width:f.size,height:f.size,rotation:f.id*.7+f.age*.12,opacity:t*.55,frame:(f.id%3)+Math.min(3,Math.floor(f.age*3))*3,columns:3,rows:4,smokeAge:f.age,z:5},100);
      }else if(f.type==='impact'){const weapon=pilot?.weapon??0,art=['impactPulse','impactLance','impactArc','impactGatling','impactBeam'][weapon];this.object(`fx${f.id}`,art,f.x,f.y,Math.max(45,f.size*1.5),'#ffffff',0,6);}
      else this.sprite(`fx${f.id}`,this.glow,f.x,f.y,f.size*(2-t),f.size*(2-t),f.color,0,6,t);}
    this.damageVisuals.end();this.gpuSprites.end();if(w.phase!=='lobby')this.sprite('cockpit',this.textures.cockpit,960,66,1920,132,'#ffffff',0,9);
    if(preparing)return;
    this.renderer.setRenderTarget(this.base);this.renderer.render(this.scene,this.camera);this.sceneDrawCalls=this.renderer.info.render.calls;
    const lights=[];const add=(x,y,r,intensity,color)=>{if(lights.length<24)lights.push({x,y,r,intensity,color});};
    for(const f of w.fx.slice(-6))add(f.x,f.y,Math.max(100,f.size*3),2*(f.type==='explosion'?Math.exp(-f.age*7):1-f.age/f.life),f.color);
    for(const p of w.players.filter(p=>p.lives>0)){add(p.x-70,p.y,210,.85,COLORS[p.id]);if(p.beam){add(p.x+180,p.y,260,1.7,WEAPONS[4].color);add(p.beamEnd,p.y,200,1.8,WEAPONS[4].color);}}
    const stride=Math.max(1,Math.ceil(w.shots.length/12));for(let i=0;i<w.shots.length&&lights.length<24;i+=stride){const s=w.shots[i];add(s.x,s.y,s.friendly?140:90,s.friendly?1.2:.65,s.color);}
    const u=this.lightMaterial.uniforms;u.lightCount.value=lights.length;u.shadows.value=this.settings.shadows?1:0;
    lights.forEach((l,i)=>{u.lights.value[i].set(l.x,l.y,l.r,l.intensity);u.colors.value[i].set(l.color);});
    const blocks=[...w.rocks.map(r=>[r.x,r.y,r.radius]),...w.enemies.filter(e=>e.kind==='heavy'||e.kind==='boss').map(e=>[e.x,e.y,e.radius*.7])].slice(0,12);
    u.blockCount.value=blocks.length;blocks.forEach((b,i)=>u.blocks.value[i].set(...b));this.pass(this.lightMaterial,this.light);
    let previous=this.light.texture;
    if(this.settings.gi)for(let i=0;i<4;i++){this.giMaterial.uniforms.previous.value=previous;this.giMaterial.uniforms.radius.value=5+i*5;const target=i%2===0?this.giA:this.giB;this.pass(this.giMaterial,target);previous=target.texture;}
    this.bloomMaterial.uniforms.source.value=this.base.texture;this.bloomMaterial.uniforms.extract.value=1;this.bloomMaterial.uniforms.texel.value.set(1/480,0);this.pass(this.bloomMaterial,this.bloomA);
    this.bloomMaterial.uniforms.source.value=this.bloomA.texture;this.bloomMaterial.uniforms.extract.value=0;this.bloomMaterial.uniforms.texel.value.set(0,1/270);this.pass(this.bloomMaterial,this.bloomB);
    const f=this.finalMaterial.uniforms;f.giStrength.value=this.settings.gi?.85:0;f.bloomStrength.value=this.settings.bloom;f.fogStrength.value=this.settings.fog;
    f.ambient.value=this.settings.ambient;f.lightingOn.value=this.settings.lighting?1:0;f.time.value=w.time;f.fogColor.value.set(sector.color).multiplyScalar(.13);
    f.hdrEnabled.value=this.settings.hdr?1:0;f.outputHDR.value=this.presenter.enabled?1:0;
    if(this.presenter.enabled){this.pass(this.finalMaterial,this.hdrTarget);this.renderer.readRenderTargetPixels(this.hdrTarget,0,0,960,540,this.hdrPixels);this.presenter.draw(this.hdrPixels);}
    else this.pass(this.finalMaterial,null);
    if(this.frame%120===0)for(const [key,e]of this.pool)if(this.frame-e.last>120){this.scene.remove(e.sprite);e.sprite.material.dispose();this.pool.delete(key);}
  }
  diagnostics(){return {webgl:this.context.getParameter(this.context.VERSION),gpuFx:this.gpuSprites.diagnostics(),damage:this.damageVisuals.diagnostics(),sceneDrawCalls:this.sceneDrawCalls,profile:this.settings.profile,fxBudget:this.settings.fxBudget,orbit:this.orbitView,pickupSize:108,hdrAvailable:this.hdr,hdrLighting:this.settings.hdr,hdrDisplay:this.presenter.enabled,
    hdrDisplayAvailable:!!navigator.gpu&&this.presenter.display.matches,gi:'2D screen-space radiance diffusion',giEnabled:this.settings.gi,lightingEnabled:this.settings.lighting,
    drawCalls:this.renderer.info.render.calls,textures:this.renderer.info.memory.textures};}
}
