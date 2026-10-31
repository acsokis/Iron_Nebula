import {validInput,validSnapshot,WEAPONS} from './world.js';
export const BUILD='0.9.13-web',MAX_MESSAGE=512*1024;
export const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeCode(length=10){const bytes=crypto.getRandomValues(new Uint8Array(length));return [...bytes].map(b=>ALPHABET[b%32]).join('');}
export function cleanCode(value,max=14){const code=String(value??'').replace(/[\s-]/g,'').toUpperCase();return code.length>=8&&code.length<=max&&[...code].every(c=>ALPHABET.includes(c))?code:null;}
export function cleanName(value){return String(value??'PILOT').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,20)||'PILOT';}
export function packet(kind,body={}){return {version:1,build:BUILD,kind,...body};}
export function readPacket(data){
  try{
    if(!data||typeof data!=='object'||Array.isArray(data))return null;
    const size=JSON.stringify(data).length;if(size>MAX_MESSAGE||(data.kind!=='world'&&size>4096))return null;
    if(data.version!==1||data.build!==BUILD||typeof data.kind!=='string')return null;
    if(data.kind==='input')return validInput(data.input)?data:null;
    if(data.kind==='world'){const world=unpackSnapshot(data.world);return validSnapshot(world)?{...data,world}:null;}
    if(data.kind==='hello')return typeof data.code==='string'&&data.code.length<=14&&typeof data.name==='string'&&data.name.length<=20?data:null;
    if(data.kind==='welcome')return Number.isInteger(data.id)&&data.id>=1&&data.id<6?data:null;
    if(data.kind==='error')return typeof data.message==='string'&&data.message.length<=180?data:null;
    if(data.kind==='phone-hello')return typeof data.code==='string'&&data.code.length<=14?data:null;
    if(data.kind==='phone-input')return validInput(data.input)&&Array.isArray(data.buttons)&&data.buttons.length<=17&&data.buttons.every(b=>typeof b==='boolean')?data:null;
    if(data.kind==='phone-welcome'||data.kind==='bye')return data;
  }catch{}return null;
}

export function packSnapshot(world){
  return {...world,shots:[],shotData:world.shots.map(s=>[s.id,s.owner,Math.round(s.x),Math.round(s.y),Math.round(Math.atan2(s.vy,s.vx)*1000)/1000,s.weapon,s.radius])};
}
export function unpackSnapshot(world){
  if(!world||!Object.hasOwn(world,'shotData'))return world;
  if(!Array.isArray(world.shotData)||world.shotData.length>600||!Array.isArray(world.shots)||world.shots.length!==0)throw new Error('Invalid compact snapshot.');
  const shots=world.shotData.map(row=>{
    if(!Array.isArray(row)||row.length!==7||!Number.isSafeInteger(row[0])||row[0]<1||!Number.isInteger(row[1])||row[1]<-1||row[1]>5||
      !row.slice(2).every(Number.isFinite)||Math.abs(row[2])>5000||Math.abs(row[3])>3000||Math.abs(row[4])>3.15||!Number.isInteger(row[5])||row[5]<0||row[5]>4||row[6]<1||row[6]>50)throw new Error('Invalid compact projectile.');
    return {id:row[0],owner:row[1],friendly:row[1]>=0,x:row[2],y:row[3],px:row[2],py:row[3],vx:Math.cos(row[4]),vy:Math.sin(row[4]),weapon:row[5],radius:row[6],
      age:0,life:3,damage:1,pierce:1,hits:[],color:row[1]>=0?WEAPONS[row[5]].color:world.sector===2?'#db92ff':'#ff946b'};
  });const result={...world,shots};delete result.shotData;return result;
}
export class RateGate{
  constructor(limit=90){this.limit=limit;this.start=0;this.count=0;this.last=0;}
  accept(now,sequence){if(now-this.start>=1000){this.start=now;this.count=0;}if(++this.count>this.limit)return false;
    if(sequence!==undefined){if(sequence<=this.last)return false;this.last=sequence;}return true;}
}
export function validIceServers(value){
  if(!Array.isArray(value)||value.length>6)throw new Error('Use up to six ICE server entries.');
  return value.map(server=>{
    if(!server||typeof server!=='object')throw new Error('Invalid ICE server.');
    const urls=Array.isArray(server.urls)?server.urls:[server.urls];
    if(!urls.length||urls.length>4||urls.some(u=>typeof u!=='string'||u.length>512||!/^stuns?:|^turns?:/.test(u)))throw new Error('Only stun:, stuns:, turn: and turns: ICE URLs are accepted.');
    const result={urls};for(const key of ['username','credential'])if(server[key]!==undefined){if(typeof server[key]!=='string'||server[key].length>512)throw new Error('ICE credential is too long.');result[key]=server[key];}
    return result;
  });
}

// PeerJS JSON channels cap a single encoded message near 16 KiB. Keep each part
// safely below that limit and bound reassembly before parsing the full packet.
export function fragmentPacket(message,id){
  const text=JSON.stringify(message);if(text.length>MAX_MESSAGE)throw new Error('Packet exceeds snapshot budget.');
  if(text.length<3500)return [message];
  const total=Math.ceil(text.length/3500);return Array.from({length:total},(_,index)=>packet('chunk',{id,index,total,data:text.slice(index*3500,(index+1)*3500)}));
}
export class PacketAssembler{
  constructor(limit=MAX_MESSAGE){this.limit=limit;this.current=null;}
  push(message,now=performance.now()){
    if(message?.kind!=='chunk')return message;
    if(message.version!==1||message.build!==BUILD||!Number.isSafeInteger(message.id)||message.id<1||!Number.isInteger(message.total)||message.total<1||message.total>Math.ceil(this.limit/3500)||
      !Number.isInteger(message.index)||message.index<0||message.index>=message.total||typeof message.data!=='string'||message.data.length>3500)throw new Error('Invalid chunk header.');
    if(!this.current||this.current.id!==message.id)this.current={id:message.id,total:message.total,parts:Array(message.total),count:0,length:0,start:now};
    const frame=this.current;if(frame.total!==message.total||now-frame.start>5000||frame.parts[message.index]!==undefined)throw new Error('Invalid or expired chunk sequence.');
    frame.parts[message.index]=message.data;frame.count++;frame.length+=message.data.length;if(frame.length>this.limit)throw new Error('Reassembly budget exceeded.');
    if(frame.count<frame.total)return null;
    this.current=null;return JSON.parse(frame.parts.join(''));
  }
}
