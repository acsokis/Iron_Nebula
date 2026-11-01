// Independent indexed stream: combat RNG and decorative changes cannot scramble
// the physical field. Seed, index and the next timer live in the saved world.
function noise(seed,index){let h=(seed^Math.imul(index+1,0x9e3779b1))>>>0;h=Math.imul(h^(h>>>16),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return ((h^(h>>>16))>>>0)/4294967296;}
export function spaceEncounter(seed,index){
  const type=noise(seed,index*7),kind=type<.12?'station':type<.4?'wreck':'asteroid',radius=kind==='station'?95+noise(seed,index*7+1)*25:26+noise(seed,index*7+1)*45;
  return {kind,radius,y:250+noise(seed,index*7+2)*600,angle:kind==='station'?0:noise(seed,index*7+3)*Math.PI*2,
    speed:kind==='station'?70:110+noise(seed,index*7+4)*80,maxHealth:kind==='station'?24:Math.ceil(radius/12),delay:3+noise(seed,index*7+5)*3};
}
