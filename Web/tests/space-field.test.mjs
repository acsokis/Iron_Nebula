import test from 'node:test';
import assert from 'node:assert/strict';
import {spaceEncounter} from '../src/space-field.js';
import {createWorld,addPlayer,startRun,stepWorld,validSnapshot} from '../src/world.js';

test('procedural field is reproducible and includes solid asteroid, wreck and station variants',()=>{
  const a=Array.from({length:100},(_,i)=>spaceEncounter(87321,i)),b=Array.from({length:100},(_,i)=>spaceEncounter(87321,i));
  assert.deepEqual(a,b);assert.equal(new Set(a.map(o=>o.kind)).size,3);assert.notDeepEqual(a[0],spaceEncounter(123,0));
});

test('a full debris population defers spawning without invalidating network snapshots',()=>{
  const w=createWorld(123);addPlayer(w,0);startRun(w);w.waveTimer=1000;w.spaceClock=0;
  w.rocks=Array.from({length:24},(_,i)=>({id:i+1,x:2200+i*30,y:300,radius:10,angle:0,health:4,speed:0}));
  for(let i=0;i<120;i++)stepWorld(w,{});
  assert.equal(w.rocks.length,24);assert.equal(w.spaceClock,0);assert.ok(validSnapshot(w));
});
test('near-field asteroids have health and enemy hulls spawn completely off the right edge',()=>{
  const w=createWorld(87321);addPlayer(w,0);startRun(w);w.players[0].invuln=10000;
  for(let i=0;i<150;i++)stepWorld(w,{});
  assert.ok(w.rocks.length>0);assert.ok(w.rocks.every(r=>r.health>0&&r.maxHealth>=r.health));
  const before=new Set(w.enemies.map(e=>e.id));w.waveTimer=0;stepWorld(w,{});
  for(const e of w.enemies.filter(e=>!before.has(e.id)))assert.ok(e.x-e.width/2>1920);
});
