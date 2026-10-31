import {Peer} from 'peerjs';
import {addPlayer,neutralInput} from './world.js';
import {makeCode,cleanCode,cleanName,packet,readPacket,RateGate,validIceServers,fragmentPacket,PacketAssembler,packSnapshot} from './protocol.js';
let transmissionId=0;

export function peerOptions(iceServers){
  const options={debug:0,config:{iceServers:validIceServers(iceServers??[{urls:'stun:stun.l.google.com:19302'}])}};
  const params=new URLSearchParams(location.search);
  if(import.meta.env.DEV&&params.get('test')==='1'&&['127.0.0.1','localhost'].includes(location.hostname))
    Object.assign(options,{host:'127.0.0.1',port:9001,path:'/peerjs',secure:false,key:'peerjs'});
  return options;
}
export function send(connection,message){
  if(!connection?.open)return false;
  const channel=connection.dataChannel??connection._dc;
  if(channel?.bufferedAmount>256*1024)return false;
  try{for(const part of fragmentPacket(message,++transmissionId))connection.send(part);return true;}catch{return false;}
}
export class Network{
  constructor({getWorld,onWorld,onStatus=()=>{},onChange=()=>{}}){this.getWorld=getWorld;this.onWorld=onWorld;this.onStatus=onStatus;this.onChange=onChange;
    this.peer=null;this.connections=new Map();this.inputs={};this.myId=0;this.host=false;this.code='';this.lastSnapshot=0;this.lastInput=0;this.closed=false;this.lastStateAt=0;}
  async hostRoom(name,iceServers){
    this.close();this.closed=false;this.host=true;this.myId=0;this.code=makeCode(10);
    this.peer=new Peer(`iron-nebula-g-${this.code.toLowerCase()}`,peerOptions(iceServers));
    await this.open();this.peer.on('connection',c=>this.admit(c));this.onStatus('Room open. Share the code or invite link.');this.onChange();return this.code;
  }
  async joinRoom(code,name,iceServers){
    const normalized=cleanCode(code);if(!normalized)throw new Error('Enter a valid room code.');
    this.close();this.closed=false;this.host=false;this.myId=-1;this.code=normalized;
    this.peer=new Peer(peerOptions(iceServers));await this.open();
    const connection=this.peer.connect(`iron-nebula-g-${normalized.toLowerCase()}`,{reliable:true,serialization:'json',metadata:{role:'pilot',build:'0.9.13-web'}});
    this.server=connection;this.lastStateAt=performance.now();
    return new Promise((resolve,reject)=>{
      let welcomed=false;const timer=setTimeout(()=>{connection.close();reject(new Error('Connection timed out. The room may be closed, or this network needs TURN.'));},15000);
      connection.on('open',()=>send(connection,packet('hello',{code:normalized,name:cleanName(name)})));
      const gate=new RateGate(60);
      const assembler=new PacketAssembler();
      connection.on('data',raw=>{let data;try{data=assembler.push(raw);}catch{connection.close();return;}if(data===null)return;
        if(!gate.accept(performance.now())){if(gate.count>300)connection.close();return;}const message=readPacket(data);if(!message){connection.close();return;}
        if(message.kind==='welcome'&&!welcomed){welcomed=true;this.myId=message.id;clearTimeout(timer);this.onStatus('P2P connected. Waiting for host.');this.onChange();resolve(normalized);}
        else if(message.kind==='world'&&welcomed){this.lastStateAt=performance.now();this.onWorld(message.world);}
        else if(message.kind==='error'){clearTimeout(timer);reject(new Error(message.message));this.onStatus(message.message);connection.close();}
      });
      connection.on('close',()=>{clearTimeout(timer);if(!welcomed)reject(new Error('Room closed or full.'));if(!this.closed)this.onStatus('Host disconnected. Return to the lobby to reconnect.');this.onChange();});
      connection.on('error',()=>{clearTimeout(timer);reject(new Error('P2P connection failed. Check signaling / STUN / TURN settings.'));});
    });
  }
  open(){return new Promise((resolve,reject)=>{
    const peer=this.peer,timer=setTimeout(()=>{peer.destroy();reject(new Error('Signaling server did not respond.'));},15000);
    peer.once('open',()=>{clearTimeout(timer);resolve();});peer.on('error',error=>{clearTimeout(timer);const message=error.type==='peer-unavailable'?'Room not found. Check the code.':'Signaling / P2P unavailable: '+String(error.type).slice(0,60);this.onStatus(message);reject(new Error(message));});
    peer.on('disconnected',()=>{if(!this.closed)this.onStatus('Signaling disconnected. Existing P2P links may continue; reopen the room for new guests.');});
  });}
  admit(connection){
    if(this.connections.size>=10){connection.close();return;}
    const key=connection.peer;let admitted=false,id=-1;const gate=new RateGate(90);
    const assembler=new PacketAssembler(4096);
    const timer=setTimeout(()=>{if(!admitted)connection.close();},5000);
    this.connections.set(key,{connection,id:-1,last:performance.now(),gate});
    connection.on('data',raw=>{
      const current=this.connections.get(key);if(!current||current.connection!==connection||this.closed)return;
      let data;try{data=assembler.push(raw);}catch{connection.close();return;}if(data===null)return;
      if(!gate.accept(performance.now())){if(gate.count>300)connection.close();return;}
      const message=readPacket(data);if(!message){connection.close();return;}
      if(!admitted){
        const w=this.getWorld();let error='';
        if(message.kind!=='hello'||message.code!==this.code)error='Incorrect room code.';
        else if(w.phase!=='lobby')error='The run has started. Join when the host returns to the lobby.';
        else if(w.players.length>=6)error='Party full (6/6).';
        if(error){send(connection,packet('error',{message:error}));setTimeout(()=>connection.close(),80);return;}
        id=Array.from({length:5},(_,i)=>i+1).find(i=>!w.players.some(p=>p.id===i));
        if(id===undefined||!addPlayer(w,id,cleanName(message.name))){connection.close();return;}
        admitted=true;clearTimeout(timer);this.connections.set(key,{connection,id,last:performance.now(),gate});
        send(connection,packet('welcome',{id}));this.broadcast(true);this.onChange();return;
      }
      if(message.kind==='bye'){connection.close();return;}
      if(message.kind!=='input'){connection.close();return;}
      const record=this.connections.get(key);
      if(!record||record.connection!==connection)return;
      if(message.input.seq<=record.sequence)return;
      record.sequence=message.input.seq;record.last=performance.now();this.inputs[id]=message.input;
    });
    connection.on('close',()=>{clearTimeout(timer);if(this.connections.get(key)?.connection!==connection)return;this.connections.delete(key);delete this.inputs[id];
      if(id>=0&&!this.closed){const w=this.getWorld();w.players=w.players.filter(p=>p.id!==id);this.onChange();}});
    connection.on('error',()=>connection.close());
  }
  input(input){if(this.server?.open)send(this.server,packet('input',{input}));}
  collect(local){const result={0:local},now=performance.now();
    const resumed=this.lastCollect!==undefined&&now-this.lastCollect>1000;this.lastCollect=now;
    for(const record of this.connections.values())if(record.id>=0){if(resumed)record.graceUntil=now+5000;
      const previous=this.inputs[record.id];result[record.id]=now-record.last<250?previous??neutralInput():{...neutralInput(),ready:previous?.ready??false};
      if(now-record.last>15000&&now>(record.graceUntil??0))record.connection.close();}
    return result;
  }
  broadcast(force=false){const now=performance.now();if(!this.host||(!force&&now-this.lastSnapshot<(this.snapshotInterval??50)))return;this.lastSnapshot=now;
    const message=packet('world',{world:packSnapshot(this.getWorld())}),size=JSON.stringify(message).length;
    const count=[...this.connections.values()].filter(c=>c.id>=0).length;
    this.snapshotInterval=Math.max(50,Math.min(125,size*Math.max(1,count)/1048576*1000));
    for(const record of this.connections.values())if(record.id>=0)send(record.connection,message);
  }
  diagnostics(){return {role:this.peer?(this.host?'host':'guest'):'solo',id:this.myId,seats:this.connections.size,room:this.code,
    rtc:[...this.connections.values()].filter(c=>c.id>=0).map(c=>c.connection.peerConnection?.connectionState),
    server:this.server?.peerConnection?.connectionState??null};}
  close(){this.closed=true;for(const record of this.connections.values())record.connection.close();this.connections.clear();this.server?.close();this.server=null;this.peer?.destroy();this.peer=null;this.inputs={};this.host=false;this.myId=0;this.code='';}
}
