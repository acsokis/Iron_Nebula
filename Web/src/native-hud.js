// Native UiRenderer's ASCII atlas and advances, kept at the same 1920x1080
// coordinates/scales. Browser controls remain real accessible DOM elements.
const advances=[21,19,32,40,36,57,46,19,23,23,34,36,19,22,19,28,36,36,36,36,36,36,36,36,36,36,19,19,36,36,36,30,54,42,41,39,44,34,33,44,46,26,22,41,34,58,49,47,38,47,40,34,35,45,41,60,41,39,36,22,28,22,35,31,25,37,39,32,39,37,25,39,40,20,20,38,20,59,40,38,39,39,28,31,27,40,36,53,36,36,30,27,33,27,36];
export class NativeHud{
  constructor(root,atlas){this.atlas=atlas;this.canvas=document.createElement('canvas');this.canvas.width=1920;this.canvas.height=1080;this.canvas.className='native-bitmap-hud';this.canvas.setAttribute('aria-hidden','true');root.prepend(this.canvas);this.c=this.canvas.getContext('2d');this.glyphs=new Map();}
  text(message,x,y,scale,color='#78edff'){
    const c=this.c,px=scale*1.08;
    for(const char of String(message).toUpperCase()){
      const code=char.charCodeAt(0),index=code>=32&&code<=126?code-32:31;
      if(index){const key=`${index}:${color}`;let glyph=this.glyphs.get(key);if(!glyph){glyph=document.createElement('canvas');glyph.width=72;glyph.height=88;const g=glyph.getContext('2d');g.drawImage(this.atlas,index%16*72,Math.floor(index/16)*88,72,88,0,0,72,88);g.globalCompositeOperation='source-in';g.fillStyle=color;g.fillRect(0,0,72,88);this.glyphs.set(key,glyph);}c.drawImage(glyph,Math.round(x),Math.round(y),72*px,88*px);}
      x+=advances[index]*px;
    }
  }
  tab(x,y,w,h){this.c.fillStyle='#020c1cc4';this.c.fillRect(x,y,w,h);this.c.strokeStyle='#429ac782';this.c.strokeRect(x+.5,y+.5,w-1,h-1);}
  bar(x,y,w,h,value,color){this.c.fillStyle='#142d43';this.c.fillRect(x,y,w,h);this.c.fillStyle=color;this.c.fillRect(x+2,y+2,(w-4)*Math.max(0,Math.min(1,value)),h-4);}
  draw(w,id){
    const c=this.c,p=w.players.find(p=>p.id===id);c.clearRect(0,0,1920,1080);if(!p)return;
    this.text(`0${w.sector}`,221,61,.35);this.text(['OUTER FRONTIER','THE RIFT','INFERNO BELT'][w.sector-1],276,69,.25,'#74ffd0');
    this.text(String(w.score).padStart(7,'0'),574,37,.46,'#ffffff');this.text(String(p.lives).padStart(2,'0'),1230,37,.46,'#ffffff');this.bar(1406,50,244,20,p.shield/p.maxShield,'#00bfff');
    this.tab(82,116,272,30);this.text(`HP ${p.health}/${p.maxHealth}`,93,116,.35,p.health<=1?'#ff6633':'#78edff');this.bar(239,124,97,10,p.health/p.maxHealth,'#3fd4f4');
    this.tab(731,116,340,30);this.text(`${w.endless?`ORBIT ${(w.orbit??0)+1} / `:''}WAVE ${String(w.wave).padStart(2,'0')}`,744,116,w.endless?.25:.35);this.bar(957,124,97,10,w.sectorTime/(w.sector===1?86:w.sector===2?92:100),'#78edff');
    this.tab(1100,113,254,37);this.text(`CR ${String(w.credits).padStart(5,'0')}`,1110,112,.39,'#ffd771');
    const colors=['#60dfff','#bcf2ff','#78ffc0','#ffb05b','#c998ff'];this.tab(1501,116,319,30);this.text(['PULSE','LANCE','ARC','GATLING','BEAM'][p.weapon],1515,116,.35,colors[p.weapon]);
    for(let i=0;i<7;i++){c.fillStyle=i<p.level?colors[p.weapon]:'#142d43';c.fillRect(1720+i*13,123,9,10);}
  }
}
