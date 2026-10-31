// Optional extended-range presentation. The game itself remains WebGL 2.
// A float readback bridge is deliberately opt-in: it costs more than SDR presentation.
export class HdrPresenter{
  constructor(source){this.source=source;this.enabled=false;this.reason='HDR display / WebGPU not available.';
    this.display=matchMedia('(dynamic-range: high)');this.display.addEventListener('change',()=>{if(!this.display.matches)this.disable();});}
  async enable(){
    if(!isSecureContext||!navigator.gpu||!this.display.matches)throw new Error('Native HDR needs a secure page, an HDR display and a compatible WebGPU browser.');
    const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('No HDR-capable graphics adapter was exposed.');
    const device=await adapter.requestDevice(),canvas=document.createElement('canvas');canvas.className='hdr-layer';canvas.width=960;canvas.height=540;
    const context=canvas.getContext('webgpu');if(!context){device.destroy();throw new Error('HDR presentation is unavailable.');}
    try{
      context.configure({device,format:'rgba16float',alphaMode:'opaque',colorSpace:'display-p3',toneMapping:{mode:'extended'}});
      const configuration=context.getConfiguration?.();
      if(configuration?.toneMapping?.mode!=='extended')throw new Error('The browser did not confirm extended-range canvas output.');
      const texture=device.createTexture({size:[960,540],format:'rgba32float',usage:GPUTextureUsage.COPY_DST|GPUTextureUsage.TEXTURE_BINDING});
      const shader=device.createShaderModule({code:`
        @group(0) @binding(0) var source: texture_2d<f32>;
        @vertex fn vertex(@builtin(vertex_index) i:u32)->@builtin(position) vec4f {
          var vertices=array<vec2f,3>(vec2f(-1.,-1.),vec2f(3.,-1.),vec2f(-1.,3.));return vec4f(vertices[i],0.,1.);}
        @fragment fn fragment(@builtin(position) p:vec4f)->@location(0) vec4f {
          let rgb=textureLoad(source,vec2i(i32(p.x),539-i32(p.y)),0).rgb;
          let p3=vec3f(.82246*rgb.r+.17754*rgb.g,.03319*rgb.r+.96681*rgb.g,.01708*rgb.r+.0724*rgb.g+.91052*rgb.b);
          return vec4f(clamp(p3,vec3f(0.),vec3f(4.)),1.);}`});
      const layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'unfilterable-float'}}]});
      const pipeline=await device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[layout]}),vertex:{module:shader,entryPoint:'vertex'},fragment:{module:shader,entryPoint:'fragment',targets:[{format:'rgba16float'}]},primitive:{topology:'triangle-list'}});
      const bind=device.createBindGroup({layout,entries:[{binding:0,resource:texture.createView()}]});
      this.device=device;this.canvas=canvas;this.context=context;this.texture=texture;this.pipeline=pipeline;this.bind=bind;
      this.source.parentElement.append(canvas);this.source.style.opacity='0';this.enabled=true;this.reason='Extended-range output enabled (physical HDR brightness not measurable by this app).';
      device.lost.then(()=>{if(this.device===device)this.disable();});
    }catch(error){context.unconfigure();device.destroy();throw error;}
  }
  draw(pixels){
    if(!this.enabled)return;
    this.device.queue.writeTexture({texture:this.texture},pixels,{bytesPerRow:960*16,rowsPerImage:540},[960,540]);
    const encoder=this.device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});
    pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.bind);pass.draw(3);pass.end();this.device.queue.submit([encoder.finish()]);
  }
  disable(){this.enabled=false;this.source.style.opacity='1';this.canvas?.remove();this.context?.unconfigure();this.texture?.destroy();this.device?.destroy();this.canvas=null;this.device=null;}
}
