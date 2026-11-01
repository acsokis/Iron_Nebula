// Solid horizontal capsules for hull/world contact, separate from the smaller
// bullet-hell damage hitboxes. Players deliberately do not collide with players.
export const contact=(a,b)=>{
  const x=Math.max(0,Math.abs(a.x-b.x)-(a.half??0)-(b.half??0)),y=a.y-b.y,r=a.radius+b.radius;
  return x*x+y*y<r*r-1e-5;
};
export const canCollide=(a,b)=>a!==b&&!(a.id!==undefined&&a.id===b.id&&a.type===b.type)&&!(a.type==='player'&&b.type==='player');
export function sweep(a,dx,dy,b){
  const x=a.x-b.x,y=a.y-b.y,h=(a.half??0)+(b.half??0),r=a.radius+b.radius;let best=null;
  const candidate=(t,nx,ny)=>{if(t>=-1e-8&&t<=1&&dx*nx+dy*ny< -1e-8&&(!best||t<best.t))best={t:Math.max(0,t),nx,ny};};
  if(dy!==0)for(const side of [-1,1]){const t=(side*r-y)/dy,px=x+dx*t;if(px>=-h&&px<=h)candidate(t,0,side);}
  const aa=dx*dx+dy*dy;if(aa>1e-12)for(const end of [-h,h]){
    const ox=x-end,bb=2*(ox*dx+y*dy),cc=ox*ox+y*y-r*r,disc=bb*bb-4*aa*cc;
    if(disc>=0){const t=(-bb-Math.sqrt(disc))/(2*aa),px=x+dx*t-end,py=y+dy*t;
      // Only the outward half of each endcap belongs to the capsule boundary.
      if((end<=0&&px<=0)||(end>=0&&px>=0)||h===0)candidate(t,px/r,py/r);}
  }
  return best;
}
export function moveSolid(body,dx,dy,obstacles,bounds=null,onContact=()=>{}){
  if(bounds){dx=Math.max(bounds.minX,Math.min(bounds.maxX,body.x+dx))-body.x;dy=Math.max(bounds.minY,Math.min(bounds.maxY,body.y+dy))-body.y;}
  for(let iteration=0;iteration<4&&Math.hypot(dx,dy)>1e-6;iteration++){
    let first=null,other=null;
    for(const obstacle of obstacles){if(!canCollide(body,obstacle))continue;const hit=sweep(body,dx,dy,obstacle);if(hit&&(!first||hit.t<first.t)){first=hit;other=obstacle;}}
    if(!first){body.x+=dx;body.y+=dy;return;}
    const t=Math.max(0,first.t-1e-5);body.x+=dx*t;body.y+=dy*t;onContact(other);
    dx*=1-t;dy*=1-t;const inward=Math.min(0,dx*first.nx+dy*first.ny);dx-=inward*first.nx;dy-=inward*first.ny;
  }
}
export function corridorClear(a,b,body,obstacles){const start={...body,x:a.x,y:a.y};return !obstacles.some(o=>canCollide(body,o)&&(contact(start,o)||contact({...start,x:b.x,y:b.y},o)||sweep(start,b.x-a.x,b.y-a.y,o)));}
export function findFlightPath(start,goal,body,obstacles,{cell=64,minX=-256,maxX=2240,minY=190,maxY=920,budget=240}={}){
  if(corridorClear(start,goal,body,obstacles))return [goal];
  const columns=Math.floor((maxX-minX)/cell)+1,rows=Math.floor((maxY-minY)/cell)+1;
  const point=(x,y)=>({x:minX+x*cell,y:minY+y*cell}),key=(x,y)=>y*columns+x;
  const sx=Math.max(0,Math.min(columns-1,Math.round((start.x-minX)/cell))),sy=Math.max(0,Math.min(rows-1,Math.round((start.y-minY)/cell)));
  const open=[{x:sx,y:sy,g:0,f:0,parent:null,point:start}],cost=new Map([[key(sx,sy),0]]);let expanded=0;
  while(open.length&&expanded++<budget){open.sort((a,b)=>b.f-a.f);const node=open.pop();
    if(corridorClear(node.point,goal,body,obstacles)){const result=[goal];for(let n=node;n?.parent;n=n.parent)result.unshift(n.point);return result;}
    for(let y=node.y-1;y<=node.y+1;y++)for(let x=node.x-1;x<=node.x+1;x++){
      if(x<0||y<0||x>=columns||y>=rows||(x===node.x&&y===node.y))continue;
      const next=point(x,y),g=node.g+Math.hypot(next.x-node.point.x,next.y-node.point.y),id=key(x,y);
      if(g>=(cost.get(id)??Infinity)||!corridorClear(node.point,next,body,obstacles))continue;
      cost.set(id,g);open.push({x,y,g,f:g+Math.hypot(goal.x-next.x,goal.y-next.y),parent:node,point:next});
    }
  }
  return []; // Wait safely; never teleport or force a blocked waypoint.
}
export function reserveSpawn(candidate,reservations){if(reservations.some(b=>canCollide(candidate,b)&&contact(candidate,b)))return false;reservations.push(candidate);return true;}

export function solidBodies(world){return [
  ...world.players.filter(p=>p.lives>0).map(entity=>({id:entity.id,type:'player',x:entity.x,y:entity.y,radius:40,half:90,entity})),
  ...world.enemies.filter(e=>e.health>0).map(entity=>({id:entity.id,type:'enemy',x:entity.x,y:entity.y,radius:entity.radius,half:Math.max(0,entity.width/2-entity.radius),entity})),
  ...world.rocks.filter(r=>r.health>0).map(entity=>({id:entity.id,type:'rock',x:entity.x,y:entity.y,radius:entity.radius,half:0,entity}))];}
export const capturePositions=world=>new Map(solidBodies(world).map(b=>[`${b.type}:${b.id}`,{x:b.x,y:b.y}]));
const routes=new WeakMap();
export function resolveWorldMovement(world,previous,dt,onPlayerContact){
  const bodies=solidBodies(world);let cache=routes.get(world);if(!cache){cache=new Map();routes.set(world,cache);}
  const destinations=new Map(bodies.map(b=>[b,{x:b.x,y:b.y}]));
  for(const b of bodies){const old=previous.get(`${b.type}:${b.id}`);if(old){b.x=old.x;b.y=old.y;}}
  // Sequential swept moves use current reservations, so two crossing moving
  // actors cannot exchange places through each other between simulation ticks.
  const contacts=new Map();
  for(const b of bodies){const others=bodies.filter(o=>canCollide(b,o)),goal=destinations.get(b);let dx=goal.x-b.x,dy=goal.y-b.y;
    if(b.type==='enemy'&&b.entity.kind!=='boss'){
      const look={x:b.x-200,y:Math.max(210,Math.min(900,b.y+dy*20))};
      if(!corridorClear(b,look,b,others)){
        let route=cache.get(b.id);
        if(!route||world.tick>=route.next){route={path:findFlightPath(b,{x:b.x-400,y:Math.max(210,Math.min(900,b.entity.baseY??b.y))},b,others),next:world.tick+12+b.id%5};cache.set(b.id,route);}
        while(route.path.length&&Math.hypot(route.path[0].x-b.x,route.path[0].y-b.y)<18)route.path.shift();
        const waypoint=route.path[0];if(waypoint){const x=waypoint.x-b.x,y=waypoint.y-b.y,length=Math.hypot(x,y)||1;dx=x/length*b.entity.speed*dt;dy=y/length*b.entity.speed*dt;}else dx=dy=0;
      }else cache.delete(b.id);
    }
    moveSolid(b,dx,dy,others,b.type==='player'?{minX:130,maxX:1770,minY:180,maxY:930}:null,other=>{
      if(b.type==='player')contacts.set(b.id,[b.entity,other.entity]);else if(other.type==='player')contacts.set(other.id,[other.entity,b.entity]);
    });
    b.entity.x=b.x;b.entity.y=b.y;
  }
  for(const [player,other]of contacts.values())onPlayerContact(player,other);
  const live=new Set(world.enemies.map(e=>e.id));for(const key of cache.keys())if(!live.has(key))cache.delete(key);
}
