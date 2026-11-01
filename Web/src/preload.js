export async function downloadAsset(url,onProgress=()=>{}){
  const response=await fetch(url,{cache:'force-cache',signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error(`Download failed (${response.status}): ${new URL(url).pathname.split('/').at(-1)}`);
  if(!response.body){const blob=await response.blob();onProgress(blob.size);return blob;}
  const reader=response.body.getReader(),chunks=[];let received=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.byteLength;onProgress(received);}}
  finally{reader.releaseLock();}
  return new Blob(chunks,{type:response.headers.get('content-type')??'application/octet-stream'});
}

export class LoadingScreen{
  constructor(){this.panel=document.querySelector('#loading');this.value=0;this.started=performance.now();}
  update(stage,fraction,detail='',bytes=null){
    const ranges={manifest:[0,.03],textures:[.03,.64],audio:[.64,.84],graphics:[.84,1]},titles={manifest:'Connecting to flight systems',textures:'Preparing the universe',audio:'Preloading the soundtrack',graphics:'Warming up graphics'};
    const [start,end]=ranges[stage];this.value=Math.max(this.value,start+(end-start)*Math.max(0,Math.min(1,fraction)));
    document.querySelector('#loading-label').textContent=titles[stage];document.querySelector('#loading-progress').value=this.value;
    document.querySelector('#loading-percent').textContent=`${Math.floor(this.value*100)}%`;document.querySelector('#loading-detail').textContent=detail;
    if(bytes)document.querySelector('#loading-bytes').textContent=`${(bytes.loaded/1048576).toFixed(1)} / ${(bytes.total/1048576).toFixed(1)} MB`;
    const names=Object.keys(ranges),index=names.indexOf(stage);
    for(const item of document.querySelectorAll('[data-loading-stage]')){const i=names.indexOf(item.dataset.loadingStage);item.dataset.state=i<index?'complete':i===index?'active':'waiting';}
  }
  fail(error){document.querySelector('#loading-label').textContent='Flight preparation interrupted';document.querySelector('#loading-detail').textContent=String(error.message).slice(0,240);document.querySelector('#loading-retry').hidden=false;document.querySelector('#loading-retry').onclick=()=>location.reload();this.panel.dataset.failed='true';}
  async finish(){this.update('graphics',1,'Ready for flight');await new Promise(requestAnimationFrame);this.panel.hidden=true;}
}
