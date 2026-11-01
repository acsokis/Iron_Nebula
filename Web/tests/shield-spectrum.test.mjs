import test from 'node:test';
import assert from 'node:assert/strict';
import {fft,ShieldSpectrum,voxelCount} from '../src/shield-spectrum.js';

test('FFT round trip preserves a localized shield impulse',()=>{
  const real=Float64Array.from({length:64},(_,i)=>Math.exp(-((i-21)**2)/8)),original=real.slice(),imag=new Float64Array(64);
  fft(real,imag);fft(real,imag,true);
  for(let i=0;i<64;i++){assert.ok(Math.abs(real[i]-original[i])<1e-10);assert.ok(Math.abs(imag[i])<1e-10);}
  assert.throws(()=>fft(new Float64Array(7),new Float64Array(7)));
});
test('shield impact propagates and damps without unstable or persistent displacement',()=>{
  const spectrum=new ShieldSpectrum();spectrum.impulse(.25,1);for(let i=0;i<12;i++)spectrum.step(1/60);
  const early=[...spectrum.field],energy=early.reduce((sum,x)=>sum+x*x,0);assert.ok(energy>.0001);assert.ok(early.some((v,i)=>i!==16&&Math.abs(v)>.01));
  for(let i=0;i<600;i++)spectrum.step(1/60);
  assert.ok([...spectrum.field].every(Number.isFinite));assert.ok([...spectrum.field].reduce((sum,x)=>sum+x*x,0)<energy*.001);
});
test('health and shield percentages select the corresponding voxel population',()=>{
  for(const total of [1,397,2048]){assert.equal(voxelCount(1,total),total);assert.equal(voxelCount(0,total),0);assert.equal(voxelCount(.5,total),Math.round(total/2));assert.equal(voxelCount(2,total),total);assert.equal(voxelCount(NaN,total),0);}
});
