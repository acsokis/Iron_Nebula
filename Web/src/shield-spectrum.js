// Radix-2 FFT and a damped spectral wave equation on the shield perimeter.
// This is a bounded visual simulation; authoritative shield points stay in world.js.
export function fft(real,imag,inverse=false){
  const n=real.length;if(n<2||(n&(n-1))||imag.length!==n)throw new Error('FFT requires matching power-of-two arrays.');
  for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[real[i],real[j]]=[real[j],real[i]];[imag[i],imag[j]]=[imag[j],imag[i]];}}
  for(let size=2;size<=n;size*=2){const angle=(inverse?2:-2)*Math.PI/size;
    for(let start=0;start<n;start+=size)for(let j=0;j<size/2;j++){const c=Math.cos(angle*j),s=Math.sin(angle*j),a=start+j,b=a+size/2,tr=real[b]*c-imag[b]*s,ti=real[b]*s+imag[b]*c;
      real[b]=real[a]-tr;imag[b]=imag[a]-ti;real[a]+=tr;imag[a]+=ti;}}
  if(inverse)for(let i=0;i<n;i++){real[i]/=n;imag[i]/=n;}
}
export const voxelCount=(fraction,total)=>Math.round(Math.max(0,Math.min(1,Number.isFinite(fraction)?fraction:0))*total);
export class ShieldSpectrum{
  constructor(){this.real=new Float64Array(64);this.imag=new Float64Array(64);this.vr=new Float64Array(64);this.vi=new Float64Array(64);this.field=new Float32Array(64);}
  impulse(phase=0,strength=1){const r=new Float64Array(64),im=new Float64Array(64),center=((phase%1)+1)%1*64;
    for(let i=0;i<64;i++){const d=Math.min(Math.abs(i-center),64-Math.abs(i-center));r[i]=Math.exp(-d*d/8)*strength*24;}fft(r,im);
    for(let i=1;i<64;i++){this.vr[i]+=r[i];this.vi[i]+=im[i];}}
  step(dt){dt=Math.max(0,Math.min(.1,dt));const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps,damping=Math.exp(-h*4);
    for(let step=0;step<steps;step++)for(let k=1;k<64;k++){const frequency=70*Math.sin(Math.PI*k/64),f2=frequency*frequency;
      this.vr[k]=(this.vr[k]-this.real[k]*f2*h)*damping;this.vi[k]=(this.vi[k]-this.imag[k]*f2*h)*damping;this.real[k]+=this.vr[k]*h;this.imag[k]+=this.vi[k]*h;}
    const r=this.real.slice(),im=this.imag.slice();fft(r,im,true);for(let i=0;i<64;i++)this.field[i]=Math.max(-1,Math.min(1,r[i]));return this.field;
  }
}
