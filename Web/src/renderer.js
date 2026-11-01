import * as THREE from 'three';
import {WIDTH,HEIGHT,COLORS,SECTORS,WEAPONS} from './world.js';
import {HdrPresenter} from './hdr.js';
import {orbitTiles,wrap} from './orbit.js';

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
    this.postScene=new THREE.Scene();this.postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));this.postScene.add(this.quad);
    this.pool=new Map();this.textures={};this.frame=0;this.frames=new Map();
    this.settings={lighting:true,gi:true,shadows:true,bloom:.8,fog:.38,ambient:.56,quality:1,hdr:true};
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
    const entries=Object.entries(this.manifest.assets),loader=new THREE.TextureLoader();let done=0;
    await Promise.all(entries.map(async([key,asset])=>{const texture=await loader.loadAsync(new URL(`./assets/${asset.file}`,document.baseURI).href);
      texture.colorSpace=THREE.SRGBColorSpace;this.textures[key]=texture;onProgress(++done/entries.length);}));
  }
  makeGlow(){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'white');g.addColorStop(.18,'rgba(255,255,255,.8)');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(canvas);}
  makeSmoke(){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),image=ctx.createImageData(128,128);
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){const n=.55+.2*Math.sin(x*.19+y*.13)+.15*Math.sin(x*.41-y*.21),r=Math.hypot(x-64,y-64)/64,index=(y*128+x)*4;
      image.data[index]=image.data[index+1]=image.data[index+2]=135+n*75;image.data[index+3]=Math.max(0,1-r*r)*n*180;}
    ctx.putImageData(image,0,0);return new THREE.CanvasTexture(canvas);}
  resize(){const box=this.canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5)*this.settings.quality;
    this.renderer.setPixelRatio(ratio);this.renderer.setSize(Math.max(1,box.width),Math.max(1,box.height),false);
    const fit=Math.min(box.width/1920,box.height/1080);this.viewport={x:(box.width-1920*fit)/2,y:(box.height-1080*fit)/2,width:1920*fit,height:1080*fit};
    this.base.setSize(Math.max(640,Math.round(this.viewport.width*ratio)),Math.max(360,Math.round(this.viewport.height*ratio)));}
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
  object(key,textureKey,x,y,width,color='#ffffff',rotation=0,z=1){const meta=this.manifest.assets[textureKey];if(meta)this.sprite(key,this.textures[textureKey],x,y,width,width*meta.height/meta.width,color,rotation,z);}
  native(key,art,x,y,scale,color='#ffffff',rotation=0,z=1,flip=false,opacity=1,origin=null){
    const meta=this.manifest.assets[art];if(!meta)return;const width=meta.sourceWidth*scale,height=meta.sourceHeight*scale;
    const sprite=this.sprite(key,this.textures[art],x,y,width,height,color,rotation,z,opacity);
    sprite.scale.x=flip?-width:width;sprite.center.set(origin?origin[0]/meta.sourceWidth:.5,origin?1-origin[1]/meta.sourceHeight:.5);return sprite;
  }
  frameTexture(art,frame,columns,rows){const key=`${art}:${frame}`;if(!this.frames.has(key)){const texture=this.textures[art].clone();texture.repeat.set(1/columns,1/rows);texture.offset.set((frame%columns)/columns,1-(Math.floor(frame/columns)+1)/rows);texture.needsUpdate=true;this.frames.set(key,texture);}return this.frames.get(key);}
  pass(material,target){this.quad.material=material;this.renderer.setRenderTarget(target);
    if(target===null){const box=this.canvas.getBoundingClientRect();this.renderer.setViewport(0,0,box.width,box.height);this.renderer.clear();const v=this.viewport;this.renderer.setViewport(v.x,v.y,v.width,v.height);}
    this.renderer.render(this.postScene,this.postCamera);}
  render(w,localId=0){
    this.frame++;for(const e of this.pool.values())e.sprite.visible=false;
    const sector=SECTORS[w.sector-1]??SECTORS[0],pilot=w.players.find(p=>p.id===localId),orbit=orbitTiles(w.time,pilot);
    this.orbitView=orbit.camera;
    for(const [i,tile] of orbit.tiles.entries()){const sprite=this.sprite(`background${i}`,this.textures[sector.background],tile.x,tile.y,WIDTH,HEIGHT+100,'#ffffff',0,-20);sprite.scale.x=(tile.mirror?-1:1)*WIDTH;}
    // Independent depth layers orbit past the painted celestial body. These
    // rocks are scenery only; collidable hazards are rendered separately.
    for(let layer=0;layer<3;layer++)for(let i=0;i<4;i++){
      const depth=layer+1,speed=24+depth*23,x=wrap(i*389+layer*137-w.time*speed,2500)-290;
      const y=wrap(i*263+layer*151,1120)-20-orbit.camera.y*depth;
      this.object(`parallax${layer}-${i}`,['dofFar','dofMid','dofNear'][layer],x,y,45+depth*31+i%3*12,'#ffffff',i*.8+w.time*.008,-13+layer);
    }
    for(let i=0;i<55;i++){const x=((i*383.1-w.time*(18+i%4*13))%2200+2200)%2200-140,y=165+(i*173.23)%800;
      this.sprite(`star${i}`,this.glow,x,y,i%7===0?8:3,i%7===0?8:3,'#b8e5ff',0,-15,.65);}
    for(const r of w.rocks)this.object(`rock${r.id}`,r.id%2?'rock':'rock2',r.x,r.y,r.radius*2,'#d4e1ef',r.angle,1);
    for(const e of w.enemies){let texture=e.kind==='boss'?(w.sector===1?(e.bossType===1?'warden':'sentinel'):w.sector===2?(e.bossType===1?'riftGuardian':'riftBoss'):(e.bossType===1?'infernoGuardian':'infernoBoss')):
        w.sector===3?'infernoEnemy':w.sector===2?(e.kind==='heavy'?'heavy':e.kind==='scout'?'dart':'wisp'):e.kind;
      const scale=e.kind==='boss'?(w.sector===1?(e.bossType===1?.83:1)*.82:w.sector===2?(e.bossType===1?.48:.54):.5):w.sector===1?({heavy:.5,interceptor:.42,scout:.41}[e.kind])*.82:w.sector===2?.32*.82:.62*.82;
      this.native(`enemy${e.id}`,texture,e.x,e.y,scale,'#ffffff',Math.sin(e.age)*.025,2,w.sector===1&&(e.kind!=='boss'||e.bossType===1));
    }
    for(const p of w.players){if(p.lives<=0)continue;
      const roll=p.vy/550*.08,scale=.26*.82,plume=this.manifest.assets.plume;
      this.native(`engine${p.id}`,'plume',p.x-150*.82,p.y+2*.82,(.34+.02*Math.sin(w.time*12))*.82,'#ffffff',roll,2,false,.74,[plume.sourceWidth*.92,plume.sourceHeight*.5]);
      this.native(`player${p.id}`,'ship',p.x,p.y,scale,p.id===localId?'#ffffff':COLORS[p.id],roll,4,false,1,[690,292]);
      const damage=Math.min(3,Math.max(0,p.maxHealth-p.health));if(damage)this.native(`hull${p.id}`,`hull${damage}`,p.x,p.y,scale,'#ffffff',roll,4.1,false,1,[690,292]);
      if(p.shield>0){const pulse=1+.028*Math.sin(w.time*5.6);this.native(`shieldShell${p.id}`,'shieldShell',p.x,p.y,.78*.82*pulse,'#96f0ff',w.time*.45,3,false,(.42+.08*p.shield)*.8);this.native(`shield${p.id}`,'shield',p.x,p.y,.62*.82*pulse,'#3cd2ff',-w.time*.28,3,false,(.42+.08*p.shield)*.36);}
      if(p.drone||w.upgrades.drone)this.native(`drone${p.id}`,'drone',p.x-75,p.y-65,.43*.82,'#ffffff',0,4);
      if(p.beam){const end=p.beamEnd||1880,width=Math.max(1,end-p.x-80),thickness=8+3.4*(p.level-1),pulse=.78+.22*Math.sin(w.time*12);
        for(let x=p.x+80,i=0;x<end;x+=192,i++){const length=Math.min(192,end-x);this.sprite(`beam${p.id}-${i}`,this.textures.beamStrip,x+length/2,p.y,length,thickness*3,'#ffffff',0,3,pulse);}
        this.native(`muzzle${p.id}`,'beamMuzzle',p.x+80,p.y,.7+p.level*.04,'#ffffff',0,4,false,pulse);
        this.sprite(`beamGlow${p.id}`,this.glow,p.x+80+width/2,p.y,width,45,WEAPONS[4].color,0,2,.3);}
    }
    for(const s of w.shots){const angle=Math.atan2(s.vy,s.vx);if(s.friendly){const art=['pulse','lance','arc','gatling'][s.weapon]??'pulse',meta=this.manifest.assets[art];this.native(`shot${s.id}`,art,s.x,s.y,[.54,.59,.51,.36][s.weapon]??.54,'#ffffff',angle,5,false,1,[meta.sourceWidth*.6,meta.sourceHeight*.5]);}
      else{const width=Math.max(.75,Math.min(1.55,s.radius/10));this.sprite(`shotEdge${s.id}`,this.white,s.x,s.y,43,width*10,'#030917',angle,4.8,.8);this.sprite(`shot${s.id}`,this.white,s.x,s.y,43,width*5.3,s.color,angle,5,.93);this.sprite(`shotCore${s.id}`,this.white,s.x,s.y,21,width*1.9,'#ffffff',angle,5.1,.95);}}
    for(const p of w.pickups){const color={credits:'#ffd483',weapon:'#91f1ff',shield:'#71baff',repair:'#a0ffa9',drone:'#ceaeff'}[p.type];
      const art={credits:'pickupCredits',weapon:'pickupWeapon',shield:'pickupShield',repair:'pickupRepair',drone:'pickupDrone'}[p.type];
      this.sprite(`pickupGlow${p.id}`,this.glow,p.x,p.y,112,112,color,0,4,.3);this.object(`pickup${p.id}`,art,p.x,p.y+Math.sin(w.time*3+p.id)*4,94*(1+.08*Math.sin(w.time*6.4+p.id)),'#ffffff',0,5);}
    for(const f of w.fx){const t=1-f.age/f.life;if(f.type==='explosion'){
        const frame=Math.min(7,Math.floor(f.age/.075));if(f.age<.6)this.sprite(`fx${f.id}`,this.frameTexture('explosion',frame,4,2),f.x,f.y,f.size*2,f.size*2,'#fff0e4',f.id*.7,6,Math.min(1,(1-f.age/.6)*3));
        this.sprite(`smoke${f.id}`,this.frameTexture('damageSmoke',(f.id%3)+Math.min(3,Math.floor(f.age*3))*3,3,4),f.x-25*f.age,f.y-40*f.age,f.size*(.8+f.age),f.size*(.8+f.age),'#ffffff',f.id*.7+f.age*.12,5,t*.55);
      }else if(f.type==='impact'){const weapon=pilot?.weapon??0,art=['impactPulse','impactLance','impactArc','impactGatling','impactBeam'][weapon];this.object(`fx${f.id}`,art,f.x,f.y,Math.max(45,f.size*1.5),'#ffffff',0,6);}
      else this.sprite(`fx${f.id}`,this.glow,f.x,f.y,f.size*(2-t),f.size*(2-t),f.color,0,6,t);}
    if(w.phase!=='lobby')this.sprite('cockpit',this.textures.cockpit,960,66,1920,132,'#ffffff',0,9);
    this.renderer.setRenderTarget(this.base);this.renderer.render(this.scene,this.camera);
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
  diagnostics(){return {webgl:this.context.getParameter(this.context.VERSION),orbit:this.orbitView,pickupSize:94,hdrAvailable:this.hdr,hdrLighting:this.settings.hdr,hdrDisplay:this.presenter.enabled,
    hdrDisplayAvailable:!!navigator.gpu&&this.presenter.display.matches,gi:'2D screen-space radiance diffusion',giEnabled:this.settings.gi,lightingEnabled:this.settings.lighting,
    drawCalls:this.renderer.info.render.calls,textures:this.renderer.info.memory.textures};}
}
