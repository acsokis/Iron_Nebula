import test from 'node:test';
import assert from 'node:assert/strict';
import {contact,canCollide,moveSolid,corridorClear,findFlightPath,reserveSpawn,solidBodies} from '../src/space-physics.js';
import {createWorld,addPlayer,startRun,stepWorld} from '../src/world.js';

test('swept hull contact prevents high-speed tunneling and permits sliding',()=>{
  const wall={x:100,y:0,radius:20,half:0,type:'rock'},body={x:0,y:0,radius:10,half:10,type:'enemy'};
  moveSolid(body,1000,0,[wall]);assert.ok(body.x<=60.001);assert.equal(contact(body,wall),false);
  moveSolid(body,30,80,[wall]);assert.ok(body.y>0);assert.equal(contact(body,wall),false);
});
test('crossing actors cannot exchange sides, while players pass one another',()=>{
  const a={x:0,y:0,radius:10,half:0,type:'enemy'},b={x:100,y:0,radius:10,half:0,type:'enemy'};
  moveSolid(a,150,0,[b]);moveSolid(b,-150,0,[a]);assert.ok(a.x<b.x);assert.equal(contact(a,b),false);
  a.type=b.type='player';moveSolid(a,150,0,[b]);assert.ok(a.x>b.x);assert.equal(canCollide(a,b),false);
});
test('flight path validates swept corridors around obstacles and waits when blocked',()=>{
  const body={x:0,y:0,radius:12,half:8,type:'enemy'},goal={x:256,y:0},obstacle={x:128,y:0,radius:45,half:0,type:'rock'};
  const path=findFlightPath(body,goal,body,[obstacle],{cell:32,minX:0,maxX:288,minY:-128,maxY:128,budget:500});
  assert.ok(path.length>1);let previous=body;for(const point of path){assert.ok(corridorClear(previous,point,body,[obstacle]));previous=point;}
  assert.deepEqual(findFlightPath(body,goal,body,[{...obstacle,radius:500}],{budget:40}),[]);
});
test('simultaneous spawn reservations reject occupied body volume',()=>{
  const reservations=[];assert.ok(reserveSpawn({id:1,type:'enemy',x:0,y:0,radius:10,half:5},reservations));
  for(let i=2;i<20;i++)assert.equal(reserveSpawn({id:i,type:'enemy',x:0,y:0,radius:10,half:5},reservations),false);
  assert.equal(reservations.length,1);
});
test('seeded crowded gameplay preserves solid separation through every movement tick',()=>{
  const world=createWorld(23871);for(let i=0;i<6;i++)addPlayer(world,i);startRun(world);world.players.forEach(p=>p.invuln=1000);
  for(let tick=0;tick<1200;tick++){
    stepWorld(world,{});const bodies=solidBodies(world);
    for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)if(canCollide(bodies[i],bodies[j]))assert.equal(contact(bodies[i],bodies[j]),false,`tick ${tick}: ${bodies[i].type}${bodies[i].id}/${bodies[j].type}${bodies[j].id}`);
  }
});
