import {capturePositions,resolveWorldMovement,solidBodies,reserveSpawn} from './space-physics.js';
import {spaceEncounter} from './space-field.js';
export const WIDTH=1920, HEIGHT=1080, MAX_PLAYERS=6;
export const COLORS=['#55e6ff','#8dff92','#ffc077','#c9a1ff','#ffe57f','#ff9bd8'];
export const WEAPONS=[
  {name:'PULSE',color:'#60dfff',interval:.22,speed:1180,damage:1},
  {name:'LANCE',color:'#bcf2ff',interval:.37,speed:1510,damage:2},
  {name:'ARC',color:'#78ffc0',interval:.25,speed:1030,damage:1},
  {name:'GATLING',color:'#ffb05b',interval:.065,speed:1430,damage:1},
  {name:'BEAM',color:'#c998ff',interval:.11,speed:0,damage:1},
];
export const SECTORS=[
  {name:'OUTER FRONTIER',background:'frontier',mini:'WARDEN',boss:'SENTINEL',color:'#63dfff',miniAt:32,bossAt:86},
  {name:'THE RIFT',background:'rift',mini:'RIFT GUARDIAN',boss:'RIFT COLOSSUS',color:'#bd9aff',miniAt:34,bossAt:92},
  {name:'INFERNO BELT',background:'inferno',mini:'INFERNO GUARDIAN',boss:'INFERNO TITAN',color:'#ff925b',miniAt:36,bossAt:100},
];
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const distance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
function random(w){let x=w.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;w.rng=x;return (x>>>0)/4294967296;}
const roll=(w,a,b)=>a+random(w)*(b-a);
export function createWorld(seed=87321){return {schema:1,build:'0.9.14-web',tick:0,rng:seed||1,nextId:1,
  phase:'lobby',sector:1,sectorTime:0,time:0,difficulty:1,bossStage:0,waveTimer:1,wave:0,endless:false,orbit:0,
  spaceSeed:(seed^0x50ace123)>>>0,spaceIndex:0,spaceClock:2,spaceGenerator:1,
  score:0,credits:0,earned:0,unlocked:1,kills:0,players:[],enemies:[],shots:[],rocks:[],pickups:[],fx:[],
  upgrades:{engine:0,power:0,drone:0,magnet:0},sectorKills:0};}
export function addPlayer(w,id,name='PILOT'){
  if(w.phase!=='lobby'||w.players.length>=MAX_PLAYERS||w.players.some(p=>p.id===id)||!Number.isInteger(id)||id<0||id>=6) return false;
  w.players.push({id,name:String(name).replace(/[\u0000-\u001f\u007f]/g,'').slice(0,20),x:280+(id%2)*180,y:250+Math.floor(id/2)*270,
    vx:0,vy:0,health:4,maxHealth:4,shield:2,maxShield:3,lives:3,level:1,weapon:0,timer:0,invuln:2,
    drone:false,droneTimer:0,beam:false,beamEnd:1800,ready:false,damage:0,hurt:0,revision:0});return true;
}
export function startRun(w,difficulty=1,endless=false){
  const seats=w.players.map(p=>({id:p.id,name:p.name})),fresh=createWorld(w.rng);
  Object.assign(w,fresh);w.difficulty=clamp(difficulty|0,0,2);w.endless=!!endless;
  for(const seat of seats)addPlayer(w,seat.id,seat.name);
  w.phase='playing';return w;
}
export function validInput(input){return !!input&&typeof input==='object'&&!Array.isArray(input)&&
  Number.isSafeInteger(input.seq)&&input.seq>0&&Number.isFinite(input.x)&&Number.isFinite(input.y)&&Math.abs(input.x)<=1&&Math.abs(input.y)<=1&&
  typeof input.fire==='boolean'&&typeof input.precision==='boolean'&&typeof input.ready==='boolean'&&
  Number.isSafeInteger(input.revision)&&input.revision>=0&&Number.isInteger(input.weapon)&&input.weapon>=-1&&input.weapon<=4&&
  (!input.target||(Number.isFinite(input.target.x)&&Number.isFinite(input.target.y)&&input.target.x>=100&&input.target.x<=1800&&input.target.y>=160&&input.target.y<=950));}
export const neutralInput=(seq=1)=>({seq,x:0,y:0,fire:false,precision:false,ready:false,revision:0,weapon:-1});
export function setWeapon(w,p,index){if(index>=0&&index<5&&(w.unlocked&(1<<index)))p.weapon=index;}
export function cycleWeapon(w,p,direction){let index=p.weapon;for(let i=0;i<5;i++){index=(index+direction+5)%5;if(w.unlocked&(1<<index))return index;}return p.weapon;}
function effect(w,type,x,y,color,size=35){w.fx.push({id:w.nextId++,type,x,y,color,size,age:0,life:type==='explosion'?1.6:.24});if(w.fx.length>100)w.fx.shift();}
function credit(w,amount){const gain=Math.max(0,Math.min(amount,[900,3000,5300][w.sector-1]-w.earned));w.earned+=gain;w.credits+=gain;}
function shot(w,p,x,y,vx,vy,weapon=p.weapon,damage=WEAPONS[weapon].damage){
  w.shots.push({id:w.nextId++,owner:p.id,friendly:true,x,y,px:x,py:y,vx,vy,weapon,damage:damage+w.upgrades.power,
    radius:weapon===1?9:6,pierce:weapon===1?3:1,hits:[],age:0,life:2.1,color:WEAPONS[weapon].color});
}
function enemyShot(w,e,angle,speed=330,radius=9){
  w.shots.push({id:w.nextId++,owner:-1,friendly:false,x:e.x-35,y:e.y,px:e.x-35,py:e.y,
    vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,weapon:0,damage:1,radius,age:0,life:5,color:w.sector===2?'#db92ff':'#ff946b'});
}
function fire(w,p){
  const weapon=WEAPONS[p.weapon],count=p.weapon===3?1:p.level;
  for(let i=0;i<count;i++){
    const row=i-(count-1)/2,spread=p.weapon===2?row*(p.precision?.026:.052):0;
    shot(w,p,p.x+85,p.y+row*14,Math.cos(spread)*weapon.speed,Math.sin(spread)*weapon.speed);
  }
  effect(w,'flash',p.x+90,p.y,weapon.color,p.weapon===1?38:23);
}
function spawnEnemy(w,boss=0){
  const kind=boss?'boss':['scout','interceptor','heavy'][Math.floor(random(w)*3)],tier=boss===2?2:1;
  const factor=[.78,1,1.32][w.difficulty]*(1+.65*(w.players.length-1))*(1+Math.min(20,w.orbit??0)*.15);
  const hp=Math.ceil((boss?(boss===2?145:75):kind==='heavy'?5:kind==='interceptor'?3:2)*(1+.35*(w.sector-1))*factor);
  const e={id:w.nextId++,kind,boss:tier,bossType:boss,x:boss?2240:2080,y:boss?540:roll(w,220,890),baseY:roll(w,260,820),
    radius:boss?(boss===2?155:120):kind==='heavy'?48:34,health:hp,maxHealth:hp,
    width:boss?(boss===2?370:295):kind==='heavy'?145:115,speed:boss?50:roll(w,150,250)+w.sector*20,
    age:0,timer:boss?1.4:roll(w,.8,2.2),phase:roll(w,0,6.28),name:boss?(boss===2?SECTORS[w.sector-1].boss:SECTORS[w.sector-1].mini):kind};
  const reservations=solidBodies(w);let placed=false;
  for(let attempt=0;attempt<24;attempt++){
    if(attempt)e.y=roll(w,boss?340:220,boss?740:890);
    if(reserveSpawn({id:e.id,type:'enemy',x:e.x,y:e.y,radius:e.radius,half:Math.max(0,e.width/2-e.radius)},reservations)){placed=true;break;}
  }
  if(!placed)return null;
  if(boss)w.bossStage=boss===1?1:3;
  w.enemies.push(e);return e;
}
function hitEnemy(w,e,damage,p){
  if(e.health<=0)return;
  const dealt=Math.min(e.health,damage);e.health-=damage;if(p)p.damage+=dealt;
  effect(w,'impact',e.x-e.radius,e.y,p?WEAPONS[p.weapon].color:'#a5ddff',14);
  if(e.health>0)return;
  w.kills++;w.sectorKills++;w.score+=e.kind==='boss'?e.bossType===2?6000:3000:100;
  effect(w,'explosion',e.x,e.y,SECTORS[w.sector-1].color,e.kind==='boss'?240:80);
  if(e.kind==='boss'){
    credit(w,e.bossType===2?450:250);w.bossStage=e.bossType===1?2:4;
  }else if(random(w)<.55){
    const type=random(w)<.6?'credits':['weapon','shield','repair','drone'][Math.floor(random(w)*4)];
    w.pickups.push({id:w.nextId++,x:e.x,y:e.y,type,age:0});
  }
}
export function hurtPlayer(w,p){
  if(p.lives<=0||p.invuln>0)return false;
  p.hurt++;p.invuln=p.shield>0?.65:1.6;
  if(p.shield>0)p.shield--;else p.health--;
  effect(w,'impact',p.x,p.y,p.shield>0?'#65dfff':'#ff866d',80);
  if(p.health<=0){
    p.lives--;effect(w,'explosion',p.x,p.y,COLORS[p.id],115);p.beam=false;
    if(p.lives>0){p.health=p.maxHealth;p.invuln=3;p.level=Math.max(1,p.level-1);
      const reservations=solidBodies(w);for(let i=0;i<30;i++){const candidate={id:p.id,type:'player',x:220+i%5*180,y:230+Math.floor(i/5)*130,radius:40,half:90};
        if(reserveSpawn(candidate,reservations)){p.x=candidate.x;p.y=candidate.y;break;}}
    }
  }return true;
}
function segmentDistance(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return (x-a.x-dx*t)**2+(y-a.y-dy*t)**2;}
export function stepWorld(w,inputs,dt=1/60){
  dt=clamp(dt,0,1/30);w.tick++;w.time+=dt;
  for(const f of w.fx)f.age+=dt;w.fx=w.fx.filter(f=>f.age<f.life);
  for(const p of w.players)p.ready=!!inputs[p.id]?.ready;
  if(w.phase==='shop'){
    if(w.players.length&&w.players.every(p=>p.ready)){
      if(w.sector===3&&!w.endless){w.phase='victory';return;}
      if(w.sector===3){w.sector=1;w.orbit=(w.orbit??0)+1;}else w.sector++;
      w.sectorTime=0;w.bossStage=0;w.earned=0;w.wave=0;w.sectorKills=0;w.waveTimer=1;w.phase='playing';
      w.enemies=[];w.shots=[];w.rocks=[];w.pickups=[];
      for(const p of w.players){p.ready=false;p.x=280+(p.id%2)*180;p.y=250+Math.floor(p.id/2)*270;p.invuln=3;
        if(p.lives<=0){p.lives=1;p.health=p.maxHealth;}}
    }return;
  }
  if(w.phase!=='playing')return;
  w.sectorTime+=dt;
  const alive=w.players.filter(p=>p.lives>0);
  if(!alive.length){w.phase='gameover';return;}
  const previousPositions=capturePositions(w);
  for(const p of alive){
    const i=inputs[p.id]??neutralInput();p.invuln=Math.max(0,p.invuln-dt);p.timer-=dt;p.precision=i.precision;
    if(i.revision>p.revision){setWeapon(w,p,i.weapon);p.revision=i.revision;}
    let x=i.x||0,y=i.y||0;const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
    if(i.target&&length<.01){const spring=i.precision?12:18,decay=Math.exp(-spring*dt),ox=p.x-i.target.x,oy=p.y-i.target.y,ix=p.vx+spring*ox,iy=p.vy+spring*oy;
      p.x=i.target.x+(ox+ix*dt)*decay;p.y=i.target.y+(oy+iy*dt)*decay;p.vx=(p.vx-spring*ix*dt)*decay;p.vy=(p.vy-spring*iy*dt)*decay;
    }else{const speed=(i.precision?260:550)*(1+.08*w.upgrades.engine),blend=1-Math.exp(-dt*(length<.01?14:9));p.vx+=(x*speed-p.vx)*blend;p.vy+=(y*speed-p.vy)*blend;p.x+=p.vx*dt;p.y+=p.vy*dt;}
    p.x=clamp(p.x,100,1800);p.y=clamp(p.y,160,950);p.beam=i.fire&&p.weapon===4;
  }
  const sector=SECTORS[w.sector-1];w.waveTimer-=dt;
  if(w.bossStage===0&&w.sectorTime>=sector.miniAt)spawnEnemy(w,1);
  if(w.bossStage===2&&w.sectorTime>=sector.bossAt)spawnEnemy(w,2);
  if(w.bossStage===4){w.phase='shop';for(const p of w.players)p.ready=false;w.shots=[];return;}
  if(w.waveTimer<=0&&w.enemies.length<22&&!w.enemies.some(e=>e.kind==='boss'&&e.health>0)){
    w.wave++;for(let i=0;i<Math.min(5,2+Math.floor(w.sectorTime/25));i++)spawnEnemy(w);w.waveTimer=Math.max(1.3,3.4-.2*w.sector);
  }
  w.spaceSeed??=(w.rng^0x50ace123)>>>0;w.spaceIndex??=0;w.spaceClock=Math.max(0,(w.spaceClock??2)-dt);
  if(w.spaceClock<=0&&w.rocks.length<24){const encounter=spaceEncounter(w.spaceSeed,w.spaceIndex++),rock={id:w.nextId++,x:2180,...encounter,health:encounter.maxHealth};
    if(reserveSpawn({...rock,type:'rock',half:0},solidBodies(w))){w.rocks.push(rock);w.spaceClock=encounter.delay;}else w.spaceClock=.4;}
  for(const e of w.enemies){
    e.age+=dt;e.timer-=dt;
    if(e.kind==='boss'){e.x=Math.max(1530,e.x-e.speed*dt);e.y=540+Math.sin(e.age*.8)*255;}
    else {e.x-=e.speed*dt;e.y+=Math.sin(e.age*2.3+e.phase)*dt*65;}
  }
  for(const r of w.rocks){r.x-=(r.speed??145)*dt;if(r.kind!=='station')r.angle+=dt*.2;}
  resolveWorldMovement(w,previousPositions,dt,(player)=>hurtPlayer(w,player));
  for(const p of alive){
    const i=inputs[p.id]??neutralInput();
    if(p.beam){
      p.beamEnd=1880;let target,rock;
      for(const e of w.enemies)if(e.health>0&&e.x>p.x+85&&Math.abs(e.y-p.y)<e.radius+12&&e.x-e.radius<p.beamEnd){target=e;p.beamEnd=e.x-e.radius;}
      for(const r of w.rocks)if(r.health>0&&r.x>p.x+85&&Math.abs(r.y-p.y)<r.radius&&r.x-r.radius<p.beamEnd){rock=r;target=null;p.beamEnd=r.x-r.radius;}
      if(p.timer<=0){if(target)hitEnemy(w,target,1+w.upgrades.power,p);if(rock)rock.health-=1+w.upgrades.power;p.timer=WEAPONS[4].interval;}
    }else if(i.fire&&p.timer<=0){fire(w,p);p.timer=WEAPONS[p.weapon].interval;}
    if(p.drone||w.upgrades.drone){p.droneTimer-=dt;const target=w.enemies.filter(e=>e.health>0&&e.x>p.x).sort((a,b)=>distance(a,p)-distance(b,p))[0];
      if(target&&p.droneTimer<=0){const angle=Math.atan2(target.y-(p.y-65),target.x-(p.x-70));shot(w,p,p.x-70,p.y-65,Math.cos(angle)*1000,Math.sin(angle)*1000,0,1+w.upgrades.drone);p.droneTimer=.5-.06*w.upgrades.drone;}}
  }
  for(const e of w.enemies){
    const target=alive[Math.floor((e.id+w.time/3)%alive.length)];
    if(e.timer<=0&&e.x<1900&&target){
      const angle=Math.atan2(target.y-e.y,target.x-e.x),boss=e.kind==='boss',pattern=boss?Math.floor(e.age/5)%3:0;
      const count=boss?(pattern===0?(e.health<e.maxHealth*.5?11:7):18):e.kind==='heavy'?3:1;
      for(let j=0;j<count;j++){
        const direction=pattern===0?angle+(j-(count-1)/2)*(boss?.11:.14):e.age*.58+j*Math.PI*2/count;
        // Ring pattern deliberately leaves a readable lane toward the pilot.
        const delta=Math.atan2(Math.sin(direction-angle),Math.cos(direction-angle));
        if(pattern===2&&Math.abs(delta)<.28)continue;
        enemyShot(w,e,direction,boss?(pattern===0?290:225)+w.sector*20:320+w.sector*25,boss?9:8);
      }
      e.timer=boss?(pattern===0?.65:.9):2.2;
    }
  }
  for(const s of w.shots){
    s.age+=dt;s.px=s.x;s.py=s.y;s.x+=s.vx*dt;s.y+=s.vy*dt;
    if(s.friendly){
      for(const e of w.enemies){if(e.health<=0||s.hits.includes(e.id)||segmentDistance(e.x,e.y,{x:s.px,y:s.py},s)>(s.radius+e.radius)**2)continue;
        hitEnemy(w,e,s.damage,w.players.find(p=>p.id===s.owner));s.hits.push(e.id);if(--s.pierce<=0){s.life=0;break;}}
      for(const r of w.rocks)if(s.life>0&&r.health>0&&segmentDistance(r.x,r.y,{x:s.px,y:s.py},s)<(s.radius+r.radius)**2){r.health-=s.damage;s.life=0;effect(w,r.health<=0?'explosion':'impact',r.x,r.y,'#ffb46e',r.health<=0?r.radius:18);}
    }else for(const p of alive)if(segmentDistance(p.x,p.y,{x:s.px,y:s.py},s)<(s.radius+25)**2&&hurtPlayer(w,p)){s.life=0;break;}
  }
  for(const item of w.pickups){
    item.age+=dt;const p=alive.reduce((a,b)=>distance(item,a)<distance(item,b)?a:b);item.x-=65*dt;
    const d=Math.sqrt(distance(item,p));if(d<240+w.upgrades.magnet*80){const pull=dt*clamp(600-d,30,450)/(d||1);item.x+=(p.x-item.x)*pull;item.y+=(p.y-item.y)*pull;}
    if(distance(item,p)<65**2){
      if(item.type==='credits')credit(w,45);if(item.type==='weapon')p.level=Math.min(7,p.level+1);
      if(item.type==='repair')p.health=Math.min(p.maxHealth,p.health+1);if(item.type==='shield')p.shield=Math.min(p.maxShield,p.shield+1);if(item.type==='drone')p.drone=true;
      item.age=999;effect(w,'pickup',item.x,item.y,COLORS[p.id],45);
    }
  }
  w.enemies=w.enemies.filter(e=>e.health>0&&e.x>-250);w.rocks=w.rocks.filter(r=>r.health>0&&r.x>-150);
  w.pickups=w.pickups.filter(p=>p.age<18&&p.x>-100);
  w.shots=w.shots.filter(s=>s.age<s.life&&s.x>-100&&s.x<2100&&s.y>-100&&s.y<1200).slice(-600);
}
export const SHOP=[
  {id:'lance',title:'LANCE',detail:'Piercing heavy projectile',price:350,weapon:1},
  {id:'arc',title:'ARC',detail:'Wide plasma spread',price:450,weapon:2},
  {id:'gatling',title:'GATLING',detail:'Rapid fire cannon',price:600,weapon:3},
  {id:'beam',title:'BEAM',detail:'Continuous energy ray',price:850,weapon:4},
  {id:'repair',title:'TEAM REPAIR',detail:'Restore every living hull',price:180},
  {id:'shield',title:'TEAM SHIELDS',detail:'Recharge every living shield',price:180},
  {id:'engine',title:'ENGINE',detail:'Shared speed upgrade / max 3',price:350},
  {id:'power',title:'WEAPON POWER',detail:'Shared damage upgrade / max 3',price:500},
  {id:'drone',title:'SUPPORT DRONES',detail:'Independent auto-targeting',price:550},
  {id:'magnet',title:'PICKUP MAGNET',detail:'Extended collection radius',price:250},
];
export function buyUpgrade(w,id,requester=0){
  const item=SHOP.find(i=>i.id===id);if(!item||requester!==0||w.phase!=='shop'||w.credits<item.price)return false;
  if(item.weapon!==undefined){if(w.unlocked&(1<<item.weapon))return false;w.unlocked|=1<<item.weapon;}
  else if(id==='repair'){if(w.players.every(p=>p.health===p.maxHealth||p.lives<=0))return false;for(const p of w.players)if(p.lives>0)p.health=p.maxHealth;}
  else if(id==='shield'){if(w.players.every(p=>p.shield===p.maxShield||p.lives<=0))return false;for(const p of w.players)if(p.lives>0)p.shield=p.maxShield;}
  else {if(w.upgrades[id]>=3)return false;w.upgrades[id]++;}
  w.credits-=item.price;return true;
}
export function migrateSoloSave(w){return w?.schema===1&&w.build==='0.9.13-web'?{...w,build:'0.9.14-web',endless:false,orbit:0}:w;}
export function validSnapshot(w){
  const number=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max,integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
  const point=o=>o&&number(o.x,-5000,5000)&&number(o.y,-3000,3000),id=o=>integer(o.id,1,Number.MAX_SAFE_INTEGER),color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
  if(w&&(w.endless!==undefined&&typeof w.endless!=='boolean'||w.orbit!==undefined&&!integer(w.orbit,0,1000000)))return false;
  if(w&&(w.spaceSeed!==undefined&&!integer(w.spaceSeed,0,4294967295)||w.spaceIndex!==undefined&&!integer(w.spaceIndex,0,Number.MAX_SAFE_INTEGER)||w.spaceClock!==undefined&&!number(w.spaceClock,-1,10)))return false;
  if(!w||w.schema!==1||w.build!=='0.9.14-web'||!integer(w.tick,0,Number.MAX_SAFE_INTEGER)||!['lobby','playing','shop','gameover','victory'].includes(w.phase)||
    !integer(w.sector,1,3)||!integer(w.difficulty,0,2)||!number(w.time,0,1e8)||!number(w.sectorTime,0,1e8)||!integer(w.unlocked,1,31)||
    !number(w.score,0,1e12)||!number(w.credits,0,1e9)||!w.upgrades||!['engine','power','drone','magnet'].every(k=>integer(w.upgrades[k],0,3)))return false;
  if(!['players','enemies','shots','rocks','pickups','fx'].every(k=>Array.isArray(w[k])&&w[k].length<=({players:6,enemies:64,shots:600,rocks:64,pickups:200,fx:100}[k])))return false;
  if(!w.players.every(p=>point(p)&&integer(p.id,0,5)&&integer(p.weapon,0,4)&&integer(p.level,1,7)&&number(p.vx,-5000,5000)&&number(p.vy,-5000,5000)&&
    number(p.health,0,10000)&&number(p.maxHealth,1,10000)&&integer(p.lives,0,20)&&number(p.shield,0,20)&&typeof p.name==='string'&&p.name.length<=20)||new Set(w.players.map(p=>p.id)).size!==w.players.length)return false;
  if(!w.enemies.every(e=>point(e)&&id(e)&&['boss','scout','interceptor','heavy'].includes(e.kind)&&number(e.width,10,600)&&number(e.radius,1,300)&&number(e.health,0,1e8)&&number(e.maxHealth,1,1e8)&&number(e.age,0,1e8)&&typeof e.name==='string'&&e.name.length<=60))return false;
  if(!w.shots.every(s=>point(s)&&id(s)&&integer(s.owner,-1,5)&&typeof s.friendly==='boolean'&&integer(s.weapon,0,4)&&number(s.vx,-5000,5000)&&number(s.vy,-5000,5000)&&number(s.radius,1,50)&&color(s.color)))return false;
  if(!w.rocks.every(r=>point(r)&&id(r)&&number(r.radius,1,200)&&number(r.angle,-1e8,1e8)&&number(r.health,0,1e5)&&
    (r.maxHealth===undefined||number(r.maxHealth,1,1e5))&&(r.speed===undefined||number(r.speed,0,300))&&(r.kind===undefined||['asteroid','wreck','station'].includes(r.kind))))return false;
  if(!w.pickups.every(p=>point(p)&&id(p)&&['credits','weapon','shield','repair','drone'].includes(p.type)))return false;
  return w.fx.every(f=>point(f)&&id(f)&&['flash','explosion','impact','pickup'].includes(f.type)&&color(f.color)&&number(f.size,0,500)&&number(f.age,0,5)&&number(f.life,.01,5));
}
