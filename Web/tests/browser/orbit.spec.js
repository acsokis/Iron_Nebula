import {test,expect} from '@playwright/test';
test('orbit, tether option, desktop music and native pickup artwork work together',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?test=1');await expect(page.locator('#loading')).toBeHidden({timeout:60000});
  await page.click('#about-toggle');await expect(page.locator('#about')).toContainText('vizisiklo');await expect(page.locator('#about')).toContainText('acsokis');await page.keyboard.press('Escape');
  await page.click('#settings-toggle');await expect(page.locator('#tethered')).toBeChecked();await expect(page.locator('#flight-mode')).toHaveValue('orbit');
  await expect(page.locator('#music-source')).toHaveValue('desktop');await page.locator('#settings [data-close]').click();
  await page.click('#solo');await expect(page.locator('#native-wave')).toContainText('ORBIT 1');
  await expect.poll(()=>page.evaluate(()=>window.__IRON_NEBULA__.audio().desktopTime)).toBeGreaterThan(0);
  await page.mouse.move(700,420);await expect.poll(()=>page.evaluate(()=>window.__IRON_NEBULA__.control().input.target!==undefined)).toBe(true);
  const camera=await page.evaluate(()=>window.__IRON_NEBULA__.renderer().orbit.x);await page.waitForTimeout(200);await expect.poll(()=>page.evaluate(()=>window.__IRON_NEBULA__.renderer().orbit.x)).toBeGreaterThan(camera);
  await page.evaluate(()=>window.__IRON_NEBULA__.scenario({level:7,pickups:['credits','weapon','shield','repair','drone'].map((type,i)=>({id:9000+i,type,x:850+i*170,y:500,age:0}))}));
  await page.screenshot({path:'test-results/orbit-pickups.png'});
  await page.click('#settings-toggle');await page.locator('#tethered').uncheck();await page.selectOption('#music-source','chip');await page.locator('#settings [data-close]').click();
  await page.mouse.move(740,460);expect(await page.evaluate(()=>window.__IRON_NEBULA__.control().input.target)).toBeUndefined();
  await page.reload();await expect(page.locator('#loading')).toBeHidden({timeout:60000});await page.click('#settings-toggle');await expect(page.locator('#tethered')).not.toBeChecked();await expect(page.locator('#music-source')).toHaveValue('chip');
  await page.locator('#settings [data-close]').click();await page.click('#solo');
  await page.evaluate(()=>{localStorage.setItem('iron-nebula-web-solo-v1',JSON.stringify(window.__IRON_NEBULA__.state()));window.__IRON_NEBULA__.scenario({phase:'gameover'});});
  await expect(page.locator('#ending')).toBeVisible();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('iron-nebula-web-solo-v1'))).toBeNull();
  expect(errors).toEqual([]);
});
test('a real mobile touch drag continuously moves the ship and releases fire',async({browser})=>{
  const context=await browser.newContext({viewport:{width:844,height:500},isMobile:true,hasTouch:true});
  try{const page=await context.newPage();await page.goto('/?test=1');await expect(page.locator('#loading')).toBeHidden({timeout:60000});await page.click('#solo');
    const session=await context.newCDPSession(page),box=await page.locator('#game').boundingBox();
    const x=box.x+box.width*.35,y=box.y+box.height*.55;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    await expect.poll(()=>page.evaluate(()=>window.__IRON_NEBULA__.control().dragPointer!==null)).toBe(true);
    const before=await page.evaluate(()=>window.__IRON_NEBULA__.control().input.target.x);
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+160,y:y+30,id:1}]});
    await expect.poll(()=>page.evaluate(()=>window.__IRON_NEBULA__.control().input.target.x)).toBeGreaterThan(before+100);
    await expect.poll(()=>page.evaluate(()=>window.__IRON_NEBULA__.state().players[0].x)).toBeGreaterThan(400);
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(()=>page.evaluate(()=>window.__IRON_NEBULA__.control().input.fire)).toBe(false);expect(await page.evaluate(()=>window.scrollY)).toBe(0);
  }finally{await context.close();}
});
