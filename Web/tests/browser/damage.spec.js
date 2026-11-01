import {test,expect} from '@playwright/test';

test('hull and fitted shield lose voxels on damage and rebuild on repair',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/?test=1');await expect(page.locator('#loading')).toBeHidden({timeout:60000});await page.click('#solo');
  await page.evaluate(()=>window.__IRON_NEBULA__.scenario({damageState:{health:4,shield:3}}));
  const object=key=>page.evaluate(key=>window.__IRON_NEBULA__.renderer().damage.objects.find(o=>o.key===key),key);
  await expect.poll(async()=>{const s=await object('shield0');return s?.remaining===s?.total&&s?.total>0;}).toBe(true);
  const hull=await object('player0'),shield=await object('shield0');expect(hull.remaining).toBe(hull.total);
  await page.evaluate(()=>window.__IRON_NEBULA__.scenario({damageState:{health:2,shield:1.5}}));
  await expect.poll(async()=>(await object('player0'))?.remaining).toBe(Math.round(hull.total*.5));
  await expect.poll(async()=>(await object('shield0'))?.remaining).toBe(Math.round(shield.total*.5));
  await expect.poll(()=>page.evaluate(()=>window.__IRON_NEBULA__.renderer().damage.fragments)).toBeGreaterThan(0);
  await expect.poll(async()=>(await object('shield0'))?.wave).toBeGreaterThan(.001);
  await page.screenshot({path:'test-results/voxel-damage.png'});
  await page.evaluate(()=>window.__IRON_NEBULA__.scenario({damageState:{health:4,shield:3}}));
  await expect.poll(async()=>(await object('player0'))?.remaining).toBe(hull.total);
  await expect.poll(async()=>(await object('shield0'))?.remaining).toBe(shield.total);
  await page.screenshot({path:'test-results/fitted-shield.png'});
  expect(errors).toEqual([]);
});
