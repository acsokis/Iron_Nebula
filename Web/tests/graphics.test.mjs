import test from 'node:test';
import assert from 'node:assert/strict';
import {Texture,Vector2} from 'three';
import {Renderer} from '../src/renderer.js';

test('enemy and parallax mirroring reverses sampled texture coordinates',()=>{
  const original=new Texture(),state={textures:{scout:original},mirrors:new Map()};
  const flipped=Renderer.prototype.oriented.call(state,'scout',true);flipped.updateMatrix();original.updateMatrix();
  for(const x of [0,.25,.7,1]){
    assert.ok(Math.abs(flipped.transformUv(new Vector2(x,.5)).x-(1-x))<1e-8);
    assert.equal(original.transformUv(new Vector2(x,.5)).x,x);
  }
});
