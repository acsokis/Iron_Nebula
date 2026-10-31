import {WEAPONS} from './world.js';
const MIDI=n=>440*2**((n-69)/12);
export class AudioEngine{
  constructor(){this.enabled=true;this.music=.3;this.sfx=.55;this.lastTick=0;this.lastShot=0;this.seen=new Set();this.voices=0;this.settings={};}
  async unlock(){
    if(!this.context){const Context=window.AudioContext??window.webkitAudioContext;if(!Context)return;
      const c=this.context=new Context(),master=this.master=c.createGain(),limiter=c.createDynamicsCompressor();master.gain.value=.5;
      limiter.threshold.value=-10;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.18;master.connect(limiter).connect(c.destination);
      this.fx=c.createGain();this.fx.gain.value=this.sfx;this.fx.connect(master);this.ambient=c.createGain();this.ambient.gain.value=this.music*.17;this.ambient.connect(master);
      const lowpass=c.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=430;lowpass.Q.value=.6;lowpass.connect(this.ambient);
      for(const hz of [43.65,65.4,87.5]){const osc=c.createOscillator(),gain=c.createGain();osc.type='triangle';osc.frequency.value=hz;gain.gain.value=.14;osc.connect(gain).connect(lowpass);osc.start();}
      const buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=buffer.getChannelData(0);let brown=0;
      for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.02)/1.02;data[i]=brown*3;}
      this.noiseBuffer=buffer;const noise=c.createBufferSource();noise.buffer=buffer;noise.loop=true;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=210;const gain=c.createGain();gain.gain.value=.12;noise.connect(filter).connect(gain).connect(this.ambient);noise.start();
    }await this.context.resume();
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
    this.fx.gain.setTargetAtTime(this.sfx,c.currentTime,.05);this.ambient.gain.setTargetAtTime(this.music*(w.phase==='playing'?.2:.11),c.currentTime,.4);
    for(const shot of w.shots){if(this.seen.has(shot.id)||!shot.friendly)continue;this.seen.add(shot.id);
      if(c.currentTime-this.lastShot>.045){const freq=[820,190,580,220,110][shot.weapon];this.tone(freq,.09,shot.weapon===1?'sawtooth':'square',.045,shot.weapon===1?60:freq*.28,(shot.x/1920-.5)*.7);this.lastShot=c.currentTime;}}
    for(const fx of w.fx){if(this.seen.has(fx.id))continue;this.seen.add(fx.id);if(fx.type==='explosion')this.explosion(fx.size,(fx.x/1920-.5)*.6);else if(fx.type==='pickup'){this.tone(880,.12,'triangle',.07,1760);}else if(fx.type==='impact'&&fx.size>=70)this.tone(330,.2,'square',.08,70);}
    if(this.seen.size>3000){const live=new Set([...w.shots,...w.fx].map(x=>x.id));this.seen=live;}
    if(c.currentTime-this.lastTick>.28){this.lastTick=c.currentTime;const sequence=[45,52,57,64,60,57,52,48],note=sequence[Math.floor(w.time/.28)%sequence.length]+(w.sector-1)*2;
      if(w.phase==='playing'&&this.music>0)this.tone(MIDI(note),.23,'triangle',.08,MIDI(note),0,'ambient');}
  }
}
