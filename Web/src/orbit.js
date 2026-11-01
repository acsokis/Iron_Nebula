// Mirrored tiles meet at identical image edges: the original painted art can
// scroll forever without exposing a hard wrap seam or requiring a new backdrop.
export const wrap=(value,size)=>((value%size)+size)%size;
export function orbitCamera(time,pilot){return {x:wrap(time*14,3840),y:Math.sin(time/95)*22+(pilot? (pilot.y-540)*.035:0)};}
export function orbitTiles(time,pilot){
  const camera=orbitCamera(time,pilot),offset=camera.x,index=Math.floor(offset/1920),shift=offset%1920;
  return {camera,tiles:[0,1,2].map(i=>({x:960+(i-1)*1920-shift,y:540+camera.y,mirror:(index+i-1)%2!==0}))};
}
