// Generated periodic space plates scroll in their original orientation.
// A narrow overlap hides residual compression/edge differences, without mirroring.
export const wrap=(value,size)=>((value%size)+size)%size;
export function orbitCamera(time,pilot){return {x:wrap(time*14,3840),y:Math.sin(time/95)*22+(pilot? (pilot.y-540)*.035:0)};}
export function orbitTiles(time,pilot){
  const camera=orbitCamera(time,pilot),shift=camera.x%1920;
  return {camera,tiles:[0,1,2].map(i=>({x:960+(i-1)*1920-shift,y:540+camera.y,mirror:false}))};
}
