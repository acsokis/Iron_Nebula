import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,addPlayer,startRun,stepWorld,neutralInput,validInput,validSnapshot,buyUpgrade,hurtPlayer,WEAPONS} from '../src/world.js';
import {packet,readPacket,RateGate,validIceServers,cleanCode,cleanName,fragmentPacket,PacketAssembler,packSnapshot} from '../src/protocol.js';
const party=()=>{const w=createWorld(12345);for(let i=0;i<6;i++)assert.equal(addPlayer(w,i,`P${i}`),true);startRun(w);return w;};
test('six seats, unique IDs and lobby-only admission',()=>{
  const w=createWorld();for(let i=0;i<6;i++)assert.equal(addPlayer(w,i,'PILOT'),true);
  assert.equal(addPlayer(w,6,'EXTRA'),false);assert.equal(addPlayer(w,0,'DUPLICATE'),false);
  startRun(w);assert.equal(addPlayer(w,5,'LATE'),false);
});
test('six independent pilots move and fire every weapon',()=>{
  const w=party();w.unlocked=31;w.waveTimer=1000;const commands={};
  for(const p of w.players){p.level=7;commands[p.id]={...neutralInput(1),fire:true,y:.1,revision:1,weapon:p.id%5};}
  for(let tick=0;tick<140;tick++)stepWorld(w,commands);
  assert.equal(w.players.filter(p=>p.y>250+Math.floor(p.id/2)*270).length,6);
  assert.equal(new Set(w.shots.filter(s=>s.friendly).map(s=>s.owner)).size,5); // Beam has no projectile.
  assert.equal(w.players.find(p=>p.weapon===4).beam,true);
  assert.equal(new Set(w.players.map(p=>p.weapon)).size,5);
  assert.equal(validSnapshot(JSON.parse(JSON.stringify(w))),true);
});
test('damage is personal, duplicate hits respect invulnerability',()=>{
  const w=party(),p=w.players[3],other=w.players[0];p.invuln=0;const shield=p.shield;
  assert.equal(hurtPlayer(w,p),true);assert.equal(p.shield,shield-1);assert.equal(other.shield,2);
  assert.equal(hurtPlayer(w,p),false);
});
test('actual projectile and beam collisions credit their owner',()=>{
  for(let weapon=0;weapon<5;weapon++){
    const w=createWorld(10);addPlayer(w,0);startRun(w);w.unlocked=31;w.waveTimer=999;
    const p=w.players[0];p.weapon=weapon;p.revision=1;
    w.enemies.push({id:900,kind:'heavy',bossType:0,x:900,y:p.y,radius:100,health:10000,maxHealth:10000,width:130,speed:0,age:0,timer:1000,phase:0,name:'TARGET'});
    for(let i=0;i<130;i++)stepWorld(w,{0:{...neutralInput(i+1),fire:true,weapon,revision:1}});
    assert.ok(p.damage>0,WEAPONS[weapon].name);assert.ok(w.enemies[0].health<10000);
  }
});
test('all-ready barrier advances all three sectors and ends in victory',()=>{
  const w=party();for(let sector=1;sector<=3;sector++){
    assert.equal(w.sector,sector);w.bossStage=4;stepWorld(w,{});assert.equal(w.phase,'shop');
    const commands=Object.fromEntries(w.players.map(p=>[p.id,{...neutralInput(),ready:p.id!==5}]));
    stepWorld(w,commands);assert.equal(w.phase,'shop');commands[5].ready=true;stepWorld(w,commands);
    assert.equal(w.phase,sector===3?'victory':'playing');
  }
});
test('shop is host-authoritative and cannot duplicate purchases',()=>{
  const w=party();w.phase='shop';w.credits=1000;
  assert.equal(buyUpgrade(w,'lance',1),false);assert.equal(w.credits,1000);
  assert.equal(buyUpgrade(w,'lance',0),true);assert.equal(w.credits,650);
  assert.equal(buyUpgrade(w,'lance',0),false);assert.equal(w.credits,650);
  assert.equal(buyUpgrade(w,'__proto__'),false);
});
test('rejects malformed, oversized and incompatible network input',()=>{
  const normal=neutralInput();assert.equal(validInput(normal),true);
  for(const input of [{...normal,x:NaN},{...normal,x:2},{...normal,seq:-1},{...normal,target:{x:1e10,y:200}},{...normal,weapon:99}])assert.equal(readPacket(packet('input',{input})),null);
  assert.equal(readPacket({...packet('input',{input:normal}),version:999}),null);
  assert.equal(readPacket(packet('input',{input:normal,padding:'x'.repeat(5000)})),null);
  assert.equal(readPacket(packet('world',{world:{players:[]}})),null);
  assert.equal(readPacket({version:1,build:'0.9.13-web',kind:'execute',script:'alert(1)'}),null);
});
test('sequence and rate limits reject replay/flood',()=>{
  const gate=new RateGate(3);assert.equal(gate.accept(1000,1),true);assert.equal(gate.accept(1001,1),false);
  assert.equal(gate.accept(1002,2),true);assert.equal(gate.accept(1003,3),false);assert.equal(gate.accept(2001,3),true);
});
test('ICE config permits only bounded STUN/TURN declarations',()=>{
  assert.equal(validIceServers([{urls:'stun:example.com:3478'}]).length,1);
  for(const value of [[{urls:'javascript:alert(1)'}],[{urls:'https://example.com'}],Array(7).fill({urls:'stun:a'}),[{urls:'turn:a',credential:'x'.repeat(600)}]])assert.throws(()=>validIceServers(value));
  assert.equal(cleanCode('ABCD-EFGH-JK'),'ABCDEFGHJK');assert.equal(cleanCode('<script>'),null);
  assert.equal(cleanName('PILOT\u0000\n'), 'PILOT');
});
test('world state remains bounded after an extended six-pilot run',()=>{
  const w=party();w.unlocked=31;for(const p of w.players){p.health=p.maxHealth=1000;p.invuln=1000;p.level=7;}
  for(let i=0;i<4000;i++){const commands=Object.fromEntries(w.players.map(p=>[p.id,{...neutralInput(i+1),fire:true,ready:true,revision:1,weapon:p.id%5}]));stepWorld(w,commands);}
  assert.ok(w.shots.length<=600);assert.ok(w.fx.length<=100);assert.ok(w.enemies.length<=64);assert.ok(w.players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('large snapshots survive the PeerJS JSON channel limit with bounded reassembly',()=>{
  const message=packet('world',{padding:'星'.repeat(24000)}),parts=fragmentPacket(message,1),assembler=new PacketAssembler();let restored;
  assert.ok(parts.length>1);for(const part of parts){assert.ok(new TextEncoder().encode(JSON.stringify(part)).length<16000);restored=assembler.push(part,1000);}
  assert.deepEqual(restored,message);
  assert.throws(()=>new PacketAssembler(4096).push(parts[0],1000));
  const duplicate=new PacketAssembler();duplicate.push(parts[0],1000);assert.throws(()=>duplicate.push(parts[0],1001));
  const timeout=new PacketAssembler();timeout.push(parts[0],1000);assert.throws(()=>timeout.push(parts[1],7000));
  assert.throws(()=>assembler.push({...parts[0],total:1000000},1000));
});
test('compact snapshots retain shot ownership without sending simulation internals',()=>{
  const w=party();w.unlocked=31;for(let i=0;i<60;i++)stepWorld(w,Object.fromEntries(w.players.map(p=>[p.id,{...neutralInput(i+1),fire:true}])));
  const packed=packSnapshot(w),decoded=readPacket(packet('world',{world:packed}));
  assert.ok(decoded);assert.equal(decoded.world.shots.length,w.shots.length);assert.deepEqual(decoded.world.shots.map(s=>s.owner),w.shots.map(s=>s.owner));
  assert.ok(JSON.stringify(packed).length<JSON.stringify(w).length);assert.ok(w.shots[0].vx>100);
  packed.shotData[0][5]=999;assert.equal(readPacket(packet('world',{world:packed})),null);
});
test('snapshot validation rejects shader/UI crash values and non-integer weapons',()=>{
  for(const mutate of [w=>w.players[0].weapon=.5,w=>w.players[0].x=Infinity,w=>w.time=NaN,w=>w.upgrades.engine=999,
    w=>w.players[0].name='x'.repeat(100),w=>w.players.push({...w.players[0]}),w=>w.fx.push({id:1,x:20,y:20,type:'flash',color:'url(https://bad)',size:20,age:0,life:1})]){
    const w=party();mutate(w);assert.equal(validSnapshot(w),false);
  }
});
