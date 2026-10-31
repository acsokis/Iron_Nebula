import {clamp,cycleWeapon,neutralInput} from './world.js';
export class Input{
  constructor(canvas,onProfile){
    this.canvas=canvas;this.onProfile=onProfile;this.profile='keyboard';this.keys=new Set();this.queue=[];this.seq=0;this.revision=0;this.choice=-1;
    this.mouse={x:300,y:540,active:false,fire:false,precision:false};this.padIndex=-1;this.pad=null;this.oldPadButtons=[];this.oldAxes=[];
    this.phone={input:neutralInput(),buttons:[],last:0};this.navHeld='';this.navNext=0;
    this.active=document.hasFocus();
    window.addEventListener('keydown',event=>{
      if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
      this.keys.add(event.code);this.select('keyboard');
      const actions={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Enter:'confirm',Escape:'back',KeyP:'pause',KeyO:'settings',F1:'help',KeyC:'ready'};
      if(actions[event.code]&&(!event.repeat||['up','down','left','right'].includes(actions[event.code])))this.queue.push(actions[event.code]);
      if(!event.repeat){if(event.code==='Tab')this.queue.push('next');if(event.code==='KeyQ')this.queue.push('previous');if(/^Digit[1-5]$/.test(event.code))this.queue.push(`weapon${Number(event.code.at(-1))-1}`);}
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab','F1'].includes(event.code))event.preventDefault();
    });
    window.addEventListener('keyup',event=>this.keys.delete(event.code));
    const point=event=>{const rect=canvas.getBoundingClientRect(),fit=Math.min(rect.width/1920,rect.height/1080),ox=(rect.width-1920*fit)/2,oy=(rect.height-1080*fit)/2;
      this.mouse.x=clamp((event.clientX-rect.left-ox)/fit,100,1800);this.mouse.y=clamp((event.clientY-rect.top-oy)/fit,160,950);};
    canvas.addEventListener('pointermove',event=>{if(event.pointerType==='mouse'||event.buttons){point(event);this.mouse.active=true;this.select('keyboard');}});
    canvas.addEventListener('pointerdown',event=>{point(event);this.mouse.active=true;if(event.button===0)this.mouse.fire=true;if(event.button===2)this.mouse.precision=true;this.select('keyboard');});
    window.addEventListener('pointerup',()=>{this.mouse.fire=this.mouse.precision=false;});canvas.addEventListener('contextmenu',event=>event.preventDefault());
    window.addEventListener('blur',()=>{this.active=false;this.release();});window.addEventListener('focus',()=>{this.active=true;});document.addEventListener('visibilitychange',()=>{if(document.hidden)this.release();});
  }
  select(profile){if(this.profile!==profile){this.profile=profile;this.navHeld='';this.navBlocked=false;this.onProfile(profile);}}
  release(){this.keys.clear();this.mouse.fire=this.mouse.precision=false;this.mouse.active=false;this.phone={input:neutralInput(),buttons:[],last:0};this.stopRumble();}
  setPhone(input,buttons){
    const old=this.phone.buttons;this.phone={input,buttons,last:performance.now()};
    if(Math.hypot(input.x,input.y)>.1||buttons.some((b,i)=>b&&!old[i]))this.select('phone');
    this.buttonEdges(buttons,old);
  }
  buttonEdges(buttons,previous){const mapping={0:'confirm',1:'back',3:'settings',4:'previous',5:'next',8:'help',9:'pause',12:'up',13:'down',14:'left',15:'right'};
    for(const [index,action]of Object.entries(mapping))if(buttons[index]&&!previous[index])this.queue.push(action);
  }
  poll(menu=false){
    let pads=[];try{pads=navigator.getGamepads?.()??[];}catch{}
    const pad=pads[this.padIndex]?.connected?pads[this.padIndex]:[...pads].find(p=>p?.connected);
    if(pad){
      const profile=/xbox|xinput/i.test(pad.id)?'xbox':/dualsense|sony|054c|playstation|wireless controller/i.test(pad.id)?'dualsense':'xbox';
      this.padProfile=profile;
      const buttons=pad.buttons.map(b=>b.pressed||b.value>.5),axes=pad.axes;
      const changed=buttons.some((b,i)=>b&&!this.oldPadButtons[i])||axes.some((a,i)=>Math.abs(a-(this.oldAxes[i]??0))>.045&&Math.abs(a)>.16);
      const connected=this.padIndex!==pad.index||this.pad?.id!==pad.id;
      if(connected||changed)this.select(profile);
      if(!connected)this.buttonEdges(buttons,this.oldPadButtons);else this.navBlocked=true;
      this.oldPadButtons=buttons;this.oldAxes=[...axes];this.padIndex=pad.index;this.pad=pad;
    }else{if(this.pad&&['xbox','dualsense'].includes(this.profile))this.select('keyboard');this.pad=null;this.padProfile=null;this.padIndex=-1;this.oldPadButtons=[];this.oldAxes=[];}
    if(performance.now()-this.phone.last>250)this.phone={input:neutralInput(),buttons:[],last:0};
    if(menu){const axes=this.profile==='phone'?[this.phone.input.x,this.phone.input.y]:this.profile!=='keyboard'?this.pad?.axes??[0,0]:[0,0];
      const direction=Math.abs(axes[1])>.65?(axes[1]>0?'down':'up'):Math.abs(axes[0])>.65?(axes[0]>0?'right':'left'):'';
      if(!direction)this.navBlocked=false;
      if(direction&&!this.navBlocked&&direction!==this.navHeld){this.queue.push(direction);this.navNext=performance.now()+400;}
      else if(direction&&!this.navBlocked&&performance.now()>this.navNext){this.queue.push(direction);this.navNext=performance.now()+120;}
      this.navHeld=direction;
    }else this.navHeld='';
    return this.queue.splice(0);
  }
  read(world,id,blocked,ready){
    const result={...neutralInput(++this.seq),ready,revision:this.revision,weapon:this.choice};if(blocked)return result;
    const keyboard=this.profile==='keyboard';
    let x=keyboard?(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0):0;
    let y=keyboard?(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)-(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0):0;
    const buttons=this.profile==='phone'?this.phone.buttons:keyboard?[]:this.oldPadButtons;
    if(!x&&!y){if(this.profile==='phone'){x=this.phone.input.x;y=this.phone.input.y;}
      else if(this.pad&&!keyboard){const left=[this.pad.axes[0]??0,this.pad.axes[1]??0],right=[this.pad.axes[2]??0,this.pad.axes[3]??0],stick=Math.hypot(...right)>Math.hypot(...left)?right:left;
        const length=Math.hypot(...stick);if(length>.13){x=stick[0]/length*clamp((length-.13)/.87,0,1);y=stick[1]/length*clamp((length-.13)/.87,0,1);}
        if(buttons[12])y=-1;if(buttons[13])y=1;if(buttons[14])x=-1;if(buttons[15])x=1;}}
    result.x=x;result.y=y;result.fire=keyboard&&(this.keys.has('Space')||this.mouse.fire)||!!buttons[2]||!!buttons[7];
    result.precision=keyboard&&(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')||this.mouse.precision)||!!buttons[6];
    if(Math.hypot(x,y)>.01)this.mouse.active=false;
    if(this.mouse.active&&this.profile==='keyboard'&&Math.hypot(x,y)<.01)result.target={x:this.mouse.x,y:this.mouse.y};
    return result;
  }
  weapon(world,id,direction,absolute=-1){const p=world.players.find(p=>p.id===id);if(!p)return;
    const base=this.choice>=0?{...p,weapon:this.choice}:p;const choice=absolute>=0?absolute:cycleWeapon(world,base,direction);
    if(world.unlocked&(1<<choice)){this.choice=choice;this.revision++;}}
  rumble(){const actuator=this.pad?.vibrationActuator;if(actuator?.playEffect)actuator.playEffect('dual-rumble',{duration:140,startDelay:0,strongMagnitude:.55,weakMagnitude:.7}).catch(()=>{});}
  stopRumble(){try{this.pad?.vibrationActuator?.reset?.().catch(()=>{});}catch{}}
}

const svgPath={cross:'M7 7L25 25M25 7L7 25',circle:'M16 5a11 11 0 1 0 0 22a11 11 0 1 0 0-22',square:'M6 6H26V26H6Z',triangle:'M16 5L29 27H3Z',menu:'M7 9H25M7 16H25M7 23H25',view:'M4 5H20V20H4ZM12 12H28V27H12Z',touch:'M3 8H29V25H3Z',nav:'M16 3V29M3 16H29',phone:'M10 3H23V29H10ZM15 25H18'};
export function icon(profile,action){
  const container=document.createElement('span');container.className=`control-icon ${profile}`;
  const keyboard={confirm:'Enter',back:'Esc',fire:'Space',precision:'Shift',previous:'Q',next:'Tab',pause:'P',help:'F1',settings:'O',ready:'C',navigate:'↑↓'};
  const xbox={confirm:'A',back:'B',fire:'RT',precision:'LT',previous:'LB',next:'RB',pause:'menu',help:'view',settings:'Y',ready:'menu',navigate:'nav'};
  const sony={confirm:'cross',back:'circle',fire:'R2',precision:'L2',previous:'L1',next:'R1',pause:'menu',help:'touch',settings:'triangle',ready:'menu',navigate:'nav'};
  const label=profile==='keyboard'?keyboard[action]??action:profile==='dualsense'?sony[action]??action:profile==='phone'?({navigate:'nav',pause:'menu',help:'touch',settings:'triangle',confirm:'cross',back:'circle',fire:'RT',precision:'LT',next:'RB',previous:'LB',ready:'menu'}[action]??'phone'):xbox[action]??action;
  container.dataset.button=label;container.title=`${profile}: ${label}`;container.setAttribute('aria-label',`${profile} ${label}`);
  if(svgPath[label]){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 32 32');svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',svgPath[label]);path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','2.5');path.setAttribute('stroke-linecap','round');svg.append(path);container.append(svg);
  }else container.textContent=label;
  return container;
}
