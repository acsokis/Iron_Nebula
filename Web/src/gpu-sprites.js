import * as THREE from 'three';

// WebGL 2 instanced quads: one draw per texture/atlas rather than per particle.
// Collision/ownership stays on the authoritative CPU simulation; billboard
// transforms, smoke drift/expansion, atlas sampling and blending run on the GPU.
export class GpuSprites{
  constructor(scene){this.scene=scene;this.batches=new Map();this.colors=new Map();}
  begin(){for(const batch of this.batches.values())batch.count=0;}
  add(key,map,{x,y,width,height,rotation=0,color='#ffffff',opacity=1,z=5,anchor=.5,frame=0,columns=1,rows=1,smokeAge=-1},capacity=600){
    let b=this.batches.get(key);
    if(!b){
      const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.index=plane.index;geometry.attributes.position=plane.attributes.position;geometry.attributes.uv=plane.attributes.uv;
      const attributes={rect:4,style:4,tint:4,atlas:4};b={count:0,capacity,geometry,arrays:{}};
      for(const [name,size]of Object.entries(attributes)){const array=new Float32Array(capacity*size);b.arrays[name]=array;geometry.setAttribute(name,new THREE.InstancedBufferAttribute(array,size).setUsage(THREE.DynamicDrawUsage));}
      const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{map:{value:map}},vertexShader:`
        attribute vec4 rect,style,tint,atlas;varying vec2 vUv;varying vec4 vTint;
        void main(){float age=max(0.0,style.w);float expansion=style.w>=0.0 ? 0.8+age : 1.0;
          vec2 local=vec2(position.x+(.5-style.z),position.y)*rect.zw*expansion;
          float angle=style.x,c=cos(angle),s=sin(angle);vec2 rotated=vec2(c*local.x-s*local.y,s*local.x+c*local.y);
          vec2 drift=style.w>=0.0 ? vec2(-25.0*age,40.0*age) : vec2(0.0);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(rect.xy+drift+rotated,0.,1.);
          vUv=atlas.xy+uv*atlas.zw;vTint=vec4(tint.rgb,tint.a*style.y);
        }`,fragmentShader:`uniform sampler2D map;varying vec2 vUv;varying vec4 vTint;
          void main(){vec4 texel=texture2D(map,vUv);gl_FragColor=texel*vTint;if(gl_FragColor.a<.002)discard;}`});
      b.mesh=new THREE.Mesh(geometry,material);b.mesh.frustumCulled=false;b.mesh.renderOrder=z;b.mesh.position.z=z;this.scene.add(b.mesh);this.batches.set(key,b);
    }
    if(b.count>=b.capacity)return;const index=b.count++*4;
    let tint=this.colors.get(color);if(!tint){tint=new THREE.Color(color);this.colors.set(color,tint);}
    b.arrays.rect.set([x,1080-y,width,height],index);b.arrays.style.set([-rotation,opacity,anchor,smokeAge],index);
    b.arrays.tint.set([tint.r,tint.g,tint.b,1],index);b.arrays.atlas.set([(frame%columns)/columns,1-(Math.floor(frame/columns)+1)/rows,1/columns,1/rows],index);
  }
  end(){for(const b of this.batches.values()){b.geometry.instanceCount=b.count;b.mesh.visible=b.count>0;for(const name of Object.keys(b.arrays))b.geometry.attributes[name].needsUpdate=true;}}
  diagnostics(){return {backend:'WebGL 2 instancing',draws:[...this.batches.values()].filter(b=>b.count>0).length,instances:[...this.batches.values()].reduce((sum,b)=>sum+b.count,0)};}
}
