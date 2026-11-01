import {test,expect} from '@playwright/test';
test('hundreds of projectiles and smoke use bounded GPU batches',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/?test=1&render=off');await expect(page.locator('#loading')).toBeHidden({timeout:60000});await page.click('#solo');
  await page.evaluate(()=>window.__IRON_NEBULA__.scenario({enemies:[],shots:Array.from({length:300},(_,i)=>({id:5000+i,owner:i<200?0:-1,friendly:i<200,x:400+i%20*55,y:260+Math.floor(i/20)*35,px:400,py:260,vx:0,vy:0,weapon:i%4,radius:7,age:0,life:10,damage:1,pierce:1,hits:[],color:i<200?'#60dfff':'#ff946b'})),fx:Array.from({length:25},(_,i)=>({id:6000+i,type:'explosion',x:500+i%5*150,y:350+Math.floor(i/5)*90,size:60,age:.25,life:5,color:'#ff946b'}))}));
  await page.evaluate(()=>window.__IRON_NEBULA__.renderFrame());
  const info=await page.evaluate(()=>window.__IRON_NEBULA__.renderer());
  expect(info.gpuFx.backend).toBe('WebGL 2 instancing');expect(info.gpuFx.instances).toBeGreaterThanOrEqual(500);expect(info.gpuFx.draws).toBeLessThanOrEqual(6);expect(info.sceneDrawCalls).toBeLessThan(140);
  await page.screenshot({path:'test-results/gpu-projectiles-smoke.png'});
  await page.click('#settings-toggle');await page.selectOption('#effects-profile','performance');
  expect(await page.evaluate(()=>window.__IRON_NEBULA__.renderer().fxBudget)).toBe(24);await expect(page.locator('#gi')).not.toBeChecked();
  await page.selectOption('#effects-profile','high');await expect(page.locator('#shadows')).toBeChecked();
  await page.locator('#settings [data-close]').click();
  await page.evaluate(()=>window.__IRON_NEBULA__.scenario({shots:[],fx:[],enemies:['scout','interceptor','heavy'].map((kind,i)=>({id:7000+i,kind,x:1250,y:300+i*210,baseY:300+i*210,radius:34,width:120,health:4,maxHealth:4,speed:0,age:0,timer:999,phase:0,name:kind}))}));
  await page.evaluate(()=>window.__IRON_NEBULA__.renderFrame());await page.screenshot({path:'test-results/enemy-facing.png'});
  expect(errors).toEqual([]);
});
