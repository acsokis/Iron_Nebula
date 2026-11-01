import {WEAPONS} from './world.js';
const MIDI=n=>440*2**((n-69)/12);
export class AudioEngine{
  constructor(){this.enabled=true;this.music=.3;this.sfx=.55;this.musicSource='desktop';this.lastTick=0;this.lastShot=0;this.seen=new Set();this.voices=0;this.settings={};this.phase=null;this.lastUi=0;this.beat=-1;this.lastBeam=0;}
  setMusicSource(value){this.musicSource=value==='chip'?'chip':'desktop';this.desktopFailed=false;if(this.musicSource==='chip')this.desktop?.pause();}
  playDesktop(){if(!this.desktop||this.starting||this.desktopFailed||!this.enabled||this.music<=0||this.musicSource!=='desktop')return;
    this.starting=true;this.desktop.play().catch(()=>{this.desktopFailed=true;}).finally(()=>{this.starting=false;});}
  ui(kind='navigate'){if(!this.context||this.context.currentTime-this.lastUi<.045)return;this.lastUi=this.context.currentTime;this.tone(kind==='confirm'?880:440,.065,'square',.035,kind==='confirm'?1320:330);}
  async unlock(){
    if(!this.context){const Context=window.AudioContext??window.webkitAudioContext;if(!Context)return;
      const c=this.context=new Context(),master=this.master=c.createGain(),limiter=c.createDynamicsCompressor();master.gain.value=.5;
      limiter.threshold.value=-10;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.18;master.connect(limiter).connect(c.destination);
      this.fx=c.createGain();this.fx.gain.value=this.sfx;this.fx.connect(master);this.ambient=c.createGain();this.ambient.gain.value=this.music*.17;this.ambient.connect(master);
      this.desktop=new Audio(new URL('./audio/desktop-theme.mp3',document.baseURI).href);this.desktop.loop=true;this.desktop.preload='none';
      this.desktopGain=c.createGain();this.desktopGain.gain.value=this.music*.65;c.createMediaElementSource(this.desktop).connect(this.desktopGain).connect(master);
      this.desktop.addEventListener('error',()=>{this.desktopFailed=true;});
      const lowpass=c.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=430;lowpass.Q.value=.6;lowpass.connect(this.ambient);
      for(const hz of [43.65,65.4,87.5]){const osc=c.createOscillator(),gain=c.createGain();osc.type='triangle';osc.frequency.value=hz;gain.gain.value=.14;osc.connect(gain).connect(lowpass);osc.start();}
      const buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=buffer.getChannelData(0);let brown=0;
      for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.02)/1.02;data[i]=brown*3;}
      this.noiseBuffer=buffer;const noise=c.createBufferSource();noise.buffer=buffer;noise.loop=true;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=210;const gain=c.createGain();gain.gain.value=.12;noise.connect(filter).connect(gain).connect(this.ambient);noise.start();
    }await this.context.resume();this.playDesktop();
  }
  tone(frequency,duration=.1,type='square',gain=.08,end=frequency,pan=0,bus='fx'){
    if(!this.context||!this.enabled||this.voices>22)return;const c=this.context,t=c.currentTime,osc=c.createOscillator(),envelope=c.createGain(),panner=c.createStereoPanner();
    this.voices++;osc.type=type;osc.frequency.setValueAtTime(Math.max(20,frequency),t);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);
    envelope.gain.setValueAtTime(.0001,t);envelope.gain.exponentialRampToValueAtTime(gain,t+.006);envelope.gain.exponentialRampToValueAtTime(.0001,t+duration);
    panner.pan.value=Math.max(-1,Math.min(1,pan));osc.connect(envelope).connect(panner).connect(bus==='ambient'?this.ambient:this.fx);osc.start(t);osc.stop(t+duration+.02);
    osc.onended=()=>{this.voices--;osc.disconnect();envelope.disconnect();panner.disconnect();};
  }
  explosion(size=80,pan=0){
    if(!this.context||!this.enabled)return;const c=this.context,t=c.currentTime,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain(),panner=c.createStereoPanner();
    source.buffer=this.noiseBuffer;filter.type='lowpass';filter.frequency.setValueAtTime(1400,t);filter.frequency.exponentialRampToValueAtTime(70,t+.5);gain.gain.setValueAtTime(Math.min(.26,size/700),t);gain.gain.exponentialRampToValueAtTime(.0001,t+.55);panner.pan.value=pan;
    source.connect(filter).connect(gain).connect(panner).connect(this.fx);source.start();source.stop(t+.6);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();};
    this.tone(90,.35,'sawtooth',.09,25,pan);
  }
  update(w,active=true){
    if(!this.context)return;const c=this.context;this.master.gain.setTargetAtTime(this.enabled&&active?.48:0,c.currentTime,.12);
    const chip=this.musicSource==='chip'||this.desktopFailed;
    this.fx.gain.setTargetAtTime(this.sfx,c.currentTime,.05);this.ambient.gain.setTargetAtTime(this.music*(chip?.36:.035),c.currentTime,.4);
    this.desktopGain.gain.setTargetAtTime(this.music*.65,c.currentTime,.08);
    if(!active||!this.enabled||chip||this.music===0)this.desktop.pause();else if(this.desktop.paused)this.playDesktop();
    if(this.phase!==w.phase){this.phase=w.phase;const notes=w.phase==='playing'?[523,659,784]:w.phase==='shop'?[784,988,1175]:w.phase==='gameover'?[330,247,165]:[440,554];for(const [i,note]of notes.entries())this.tone(note,.1+i*.05,'square',.045,note*.95);}
    if(w.players.some(p=>p.beam)&&c.currentTime-this.lastBeam>.09){this.lastBeam=c.currentTime;this.tone(110,.12,'sawtooth',.025,165);}
    for(const shot of w.shots){if(this.seen.has(shot.id)||!shot.friendly)continue;this.seen.add(shot.id);
      if(c.currentTime-this.lastShot>.045){const freq=[820,190,580,220,110][shot.weapon];this.tone(freq,.09,shot.weapon===1?'sawtooth':'square',.045,shot.weapon===1?60:freq*.28,(shot.x/1920-.5)*.7);this.lastShot=c.currentTime;}}
    for(const fx of w.fx){if(this.seen.has(fx.id))continue;this.seen.add(fx.id);if(fx.type==='explosion')this.explosion(fx.size,(fx.x/1920-.5)*.6);else if(fx.type==='pickup'){this.tone(880,.12,'triangle',.07,1760);}else if(fx.type==='impact'&&fx.size>=70)this.tone(330,.2,'square',.08,70);}
    if(this.seen.size>3000){const live=new Set([...w.shots,...w.fx].map(x=>x.id));this.seen=live;}
    const beat=Math.floor(c.currentTime/.15);
    if(chip&&active&&this.enabled&&this.music>0&&beat!==this.beat){this.beat=beat;const step=beat%16,bar=Math.floor(beat/16)%4,root=[45,41,48,43][bar],melody=[12,19,24,19,15,19,22,19,12,15,19,24,22,19,15,19];
      this.tone(MIDI(root+melody[step]),.13,'square',.09,MIDI(root+melody[step]),step%2?.15:-.15,'ambient');
      if(step%2===0)this.tone(MIDI(root+(step%4===2?7:0)),.24,'triangle',.18,MIDI(root),-.25,'ambient');
      if(step%4===0)this.tone(95,.09,'sine',.15,28,0,'ambient');else this.tone(step%4===2?180:1800,.035,'square',.025,step%4===2?70:650,.3,'ambient');}
  }
}
