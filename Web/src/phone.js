import {Peer} from 'peerjs';
import QRCode from 'qrcode';
import {peerOptions,send} from './network.js';
import {makeCode,cleanCode,packet,readPacket,RateGate} from './protocol.js';
import {neutralInput,clamp} from './world.js';

export class PhoneBridge{
  constructor(onInput,onStatus){this.onInput=onInput;this.onStatus=onStatus;this.peer=null;this.connection=null;this.code='';this.last=0;this.generation=0;this.pending=new Set();}
  async pair(iceServers){
    this.close();const generation=this.generation;this.code=makeCode(14);
    const peer=this.peer=new Peer(`iron-nebula-pad-${this.code.toLowerCase()}`,peerOptions(iceServers));
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{if(generation===this.generation)this.close();else peer.destroy();reject(new Error('Phone signaling timed out.'));},15000);
      peer.once('open',()=>{clearTimeout(timer);resolve();});peer.on('error',()=>{clearTimeout(timer);reject(new Error('Phone pairing signaling is unavailable.'));});});
    if(generation!==this.generation){peer.destroy();throw new Error('Phone pairing was cancelled.');}
    this.expiry=setTimeout(()=>{if(!this.connection){this.close();this.onStatus('Pairing code expired. Generate a new code.');}},10*60*1000);
    peer.on('connection',connection=>{
      if(this.connection?.open){connection.on('open',()=>{send(connection,packet('error',{message:'A phone is already paired.'}));setTimeout(()=>connection.close(),100);});return;}
      if(this.pending.size>=4){connection.close();return;}this.pending.add(connection);
      let admitted=false;const gate=new RateGate(60),timer=setTimeout(()=>{if(!admitted)connection.close();},5000);
      connection.on('data',data=>{
        if(generation!==this.generation||admitted&&this.connection!==connection){connection.close();return;}
        const message=readPacket(data);if(!message){connection.close();return;}
        if(!admitted){if(message.kind!=='phone-hello'||message.code!==this.code||generation!==this.generation){connection.close();return;}
          if(this.connection?.open){connection.close();return;}admitted=true;clearTimeout(timer);clearTimeout(this.expiry);this.connection=connection;this.last=performance.now();
          send(connection,packet('phone-welcome'));this.onStatus('Phone controller connected.');return;}
        if(message.kind!=='phone-input'||!gate.accept(performance.now(),message.input.seq)){connection.close();return;}
        this.last=performance.now();this.onInput(message.input,message.buttons);
      });
      connection.on('close',()=>{this.pending.delete(connection);clearTimeout(timer);if(this.connection===connection){this.connection=null;this.onInput(neutralInput(),[]);this.onStatus('Phone disconnected. Controls released.');}});
      connection.on('error',()=>connection.close());
    });
    const url=new URL(document.baseURI);url.search='';url.searchParams.set('controller',this.code);
    if(import.meta.env.DEV&&new URLSearchParams(location.search).get('test')==='1')url.searchParams.set('test','1');
    return {code:this.code,url:url.href,qr:await QRCode.toDataURL(url.href,{width:248,margin:2,color:{dark:'#071322',light:'#f1f8ff'}})};
  }
  tick(){if(this.connection&&performance.now()-this.last>250){this.onInput(neutralInput(),[]);if(performance.now()-this.last>10000)this.connection.close();}}
  close(){this.generation++;clearTimeout(this.expiry);for(const connection of this.pending)connection.close();this.pending.clear();this.connection?.close();this.connection=null;this.peer?.destroy();this.peer=null;this.code='';this.onInput(neutralInput(),[]);}
}

export async function runPhone(code,iceServers){
  const normalized=cleanCode(code);if(!normalized)throw new Error('Invalid phone pairing code.');
  const root=document.querySelector('#phone-mode');root.hidden=false;document.querySelector('#desktop').hidden=true;
  const status=root.querySelector('[data-phone-status]');status.textContent='Connecting to your game…';
  const peer=new Peer(peerOptions(iceServers));const buttons=Array(17).fill(false),pointerSets=new Map();let seq=0,axis={x:0,y:0},connection,closed=false,joystickId=null;
  const reset=()=>{axis={x:0,y:0};buttons.fill(false);joystickId=null;for(const set of pointerSets.values())set.clear();root.querySelectorAll('.pressed').forEach(button=>button.classList.remove('pressed'));root.querySelector('.stick-thumb').style.transform='translate(-50%, -50%)';};
  const transmit=()=>{if(!closed&&connection?.open)send(connection,packet('phone-input',{input:{...neutralInput(++seq),x:axis.x,y:axis.y,fire:buttons[2]||buttons[7],precision:buttons[6]},buttons:[...buttons]}));};
  const stick=root.querySelector('.touch-stick'),thumb=stick.querySelector('.stick-thumb');
  const move=event=>{const rect=stick.getBoundingClientRect(),radius=rect.width*.38;let x=(event.clientX-rect.left-rect.width/2)/radius,y=(event.clientY-rect.top-rect.height/2)/radius;
    const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}axis={x,y};thumb.style.transform=`translate(calc(-50% + ${x*radius}px),calc(-50% + ${y*radius}px))`;transmit();};
  stick.addEventListener('pointerdown',event=>{event.preventDefault();if(joystickId!==null)return;joystickId=event.pointerId;stick.setPointerCapture(event.pointerId);move(event);});
  stick.addEventListener('pointermove',event=>{if(event.pointerId===joystickId)move(event);});
  const stopStick=event=>{if(event.pointerId!==joystickId)return;joystickId=null;axis={x:0,y:0};thumb.style.transform='translate(-50%, -50%)';transmit();};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,stopStick);
  for(const button of root.querySelectorAll('[data-phone-button]')){
    const index=Number(button.dataset.phoneButton),pointers=new Set();
    pointerSets.set(index,pointers);
    button.addEventListener('pointerdown',event=>{event.preventDefault();pointers.add(event.pointerId);button.setPointerCapture(event.pointerId);buttons[index]=true;button.classList.add('pressed');transmit();});
    const release=event=>{pointers.delete(event.pointerId);buttons[index]=pointers.size>0;button.classList.toggle('pressed',buttons[index]);transmit();};
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden){reset();transmit();}});window.addEventListener('blur',()=>{reset();transmit();});
  window.addEventListener('pagehide',()=>{reset();transmit();closed=true;connection?.close();peer.destroy();});
  root.querySelector('[data-phone-exit]').addEventListener('click',()=>{reset();transmit();closed=true;connection?.close();peer.destroy();status.textContent='Disconnected. You can close this tab.';});
  root.querySelector('[data-phone-fullscreen]').addEventListener('click',()=>document.documentElement.requestFullscreen?.().catch(()=>{}));
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{peer.destroy();reject(new Error('Pairing timed out. Keep the game open; this network may require TURN.'));},15000);
    peer.once('open',()=>{
      connection=peer.connect(`iron-nebula-pad-${normalized.toLowerCase()}`,{reliable:true,serialization:'json',metadata:{role:'controller'}});
      connection.on('open',()=>send(connection,packet('phone-hello',{code:normalized})));
      connection.on('data',data=>{const message=readPacket(data);if(message?.kind==='phone-welcome'){clearTimeout(timeout);status.textContent='Connected · your phone controls the local pilot';
          const heartbeat=setInterval(transmit,34);connection.once('close',()=>{clearInterval(heartbeat);reset();status.textContent='Game disconnected. Controls released.';});resolve();}
        else if(message?.kind==='error'){clearTimeout(timeout);connection.close();reject(new Error(message.message));}});
      connection.on('error',()=>{clearTimeout(timeout);reject(new Error('Phone P2P failed. Check STUN/TURN connectivity.'));});
    });
    peer.on('error',()=>{clearTimeout(timeout);reject(new Error('Pairing service or desktop is unavailable.'));});
  });
}
