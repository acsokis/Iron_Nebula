import {test,expect} from '@playwright/test';
const boot=async(page,query='')=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`/?test=1${query}`);try{await expect(page.locator('#loading')).toBeHidden({timeout:60000});}catch(error){throw new Error(`${error.message}\nLoading: ${await page.locator('#loading').innerText()}\nBrowser errors: ${errors.join('; ')}`);}};
test('GI, lighting, HDR fallback and audio settings are real controls',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await boot(page);
  await page.click('#solo');await page.click('#settings-toggle');
  await page.locator('#gi').uncheck();await page.locator('#lighting').uncheck();
  expect(await page.evaluate(()=>window.__IRON_NEBULA__.renderer().giEnabled)).toBe(false);
  expect(await page.evaluate(()=>window.__IRON_NEBULA__.renderer().lightingEnabled)).toBe(false);
  await page.locator('#gi').check();await page.locator('#lighting').check();
  if(await page.locator('#hdr-lighting').isEnabled()){
    await page.locator('#hdr-lighting').uncheck();expect(await page.evaluate(()=>window.__IRON_NEBULA__.renderer().hdrLighting)).toBe(false);
    await page.locator('#hdr-lighting').check();expect(await page.evaluate(()=>window.__IRON_NEBULA__.renderer().hdrLighting)).toBe(true);
  }
  const diag=await page.evaluate(()=>window.__IRON_NEBULA__.renderer());if(!diag.hdrDisplayAvailable)await expect(page.locator('#hdr-display')).toBeDisabled();
  await page.locator('#music-volume').fill('0.45');await page.locator('#sfx-volume').fill('0.6');
  await page.screenshot({path:'test-results/lighting-settings.png'});
  await page.locator('#settings [data-close]').click();await page.waitForTimeout(150);
  expect(await page.evaluate(()=>window.__IRON_NEBULA__.audio().state)).toBe('running');
  expect(errors).toEqual([]);
});
test('controller hints switch between Xbox, DualSense and keyboard on actual input',async({page})=>{
  await page.addInitScript(()=>{window.testPad=null;Object.defineProperty(navigator,'getGamepads',{value:()=>window.testPad?[window.testPad]:[]});});
  await boot(page,'&render=off');
  await page.evaluate(()=>window.testPad={id:'Xbox Wireless Controller',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))});
  await expect(page.locator('body')).toHaveAttribute('data-profile','xbox');
  await expect(page.locator('#solo [data-button="A"]')).toBeVisible();
  await page.evaluate(()=>{window.testPad=null;});await expect(page.locator('body')).toHaveAttribute('data-profile','keyboard');
  await page.evaluate(()=>window.testPad={id:'DualSense Wireless Controller (054c-0ce6)',index:1,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))});
  await expect(page.locator('body')).toHaveAttribute('data-profile','dualsense');
  await expect(page.locator('#solo [data-button="cross"] svg')).toBeVisible();
  await page.screenshot({path:'test-results/dualsense-menu.png'});
  await page.keyboard.press('ArrowDown');await expect(page.locator('body')).toHaveAttribute('data-profile','keyboard');
});
test('phone controller pairs over real WebRTC and releases input on disconnect',async({browser})=>{
  test.setTimeout(90000);
  const desktopContext=await browser.newContext({viewport:{width:1440,height:1000}}),phoneContext=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  try{
    const desktop=await desktopContext.newPage(),phone=await phoneContext.newPage();await boot(desktop);
    await desktop.click('#phone-toggle');await expect(desktop.locator('#phone-code')).toHaveText(/^[A-Z2-9]{14}$/,{timeout:20000});
    const code=await desktop.locator('#phone-code').textContent();
    await phone.goto(`/?test=1&controller=${code}`);await expect(phone.locator('[data-phone-status]')).toContainText('Connected',{timeout:20000});
    await expect.poll(()=>desktop.evaluate(()=>window.__IRON_NEBULA__.phone().paired)).toBe(true);
    await phone.locator('[data-phone-button="7"]').hover();await phone.mouse.down();
    await expect.poll(()=>desktop.evaluate(()=>window.__IRON_NEBULA__.phone().input.fire)).toBe(true);
    await expect(desktop.locator('body')).toHaveAttribute('data-profile','phone');
    await phone.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await expect.poll(()=>desktop.evaluate(()=>window.__IRON_NEBULA__.phone().input.fire)).toBe(false);
    await phone.mouse.up();await phone.mouse.down();
    await expect.poll(()=>desktop.evaluate(()=>window.__IRON_NEBULA__.phone().input.fire)).toBe(true);
    await phone.mouse.up();
    await expect.poll(()=>desktop.evaluate(()=>window.__IRON_NEBULA__.phone().input.fire)).toBe(false);
    await phone.screenshot({path:'test-results/phone-controller.png'});
    await phone.locator('[data-phone-exit]').click();
    await expect.poll(()=>desktop.evaluate(()=>window.__IRON_NEBULA__.phone().paired)).toBe(false);
    await expect.poll(()=>desktop.evaluate(()=>window.__IRON_NEBULA__.phone().input.x)).toBe(0);
  }finally{await desktopContext.close();await phoneContext.close();}
});
test('six separate browsers exchange real P2P movement, shots and ready state',async({browser})=>{
  test.setTimeout(300000);const contexts=[],pages=[];
  try{
    for(let i=0;i<6;i++){const context=await browser.newContext({viewport:i===0?{width:1280,height:850}:{width:640,height:480}});contexts.push(context);const page=await context.newPage();pages.push(page);await boot(page,'&render=off');}
    const host=pages[0];await host.evaluate(()=>window.__IRON_NEBULA__.renderFrame());await host.locator('#callsign').fill('HOST');await host.click('#host');
    await expect(host.locator('#room-code')).toHaveText(/^[A-Z2-9]{10}$/,{timeout:20000});const code=await host.locator('#room-code').textContent();
    for(let i=1;i<6;i++){
      const page=pages[i];await page.locator('#callsign').fill(`PILOT ${i+1}`);await page.click('#join-open');await page.fill('#join-code',code);await page.click('#join-confirm');
      await expect.poll(()=>host.evaluate(()=>window.__IRON_NEBULA__.state().players.length),{timeout:20000}).toBe(i+1);
    }
    await host.click('#start-party');for(const page of pages)await expect(page.locator('#hud')).toBeVisible({timeout:15000});
    await host.evaluate(()=>window.__IRON_NEBULA__.scenario({unlocked:31,level:7}));
    for(let i=0;i<6;i++)await pages[i].evaluate(i=>window.__IRON_NEBULA__.drive({x:0,y:.12,fire:true,precision:false,weapon:i%5,revision:1}),i);
    await expect.poll(()=>host.evaluate(()=>new Set(window.__IRON_NEBULA__.state().players.map(p=>p.weapon)).size),{timeout:15000}).toBe(5);
    await expect.poll(()=>host.evaluate(()=>new Set(window.__IRON_NEBULA__.state().shots.filter(s=>s.friendly).map(s=>s.owner)).size),{timeout:15000}).toBe(5);
    const diag=await host.evaluate(()=>window.__IRON_NEBULA__.network());expect(diag.rtc).toHaveLength(5);expect(diag.rtc.every(s=>s==='connected')).toBe(true);
    await host.evaluate(()=>window.__IRON_NEBULA__.renderFrame());await host.screenshot({path:'test-results/six-player-p2p.png'});
    await host.evaluate(()=>window.__IRON_NEBULA__.scenario({phase:'shop',credits:1500}));
    expect(await host.evaluate(()=>window.__IRON_NEBULA__.state().players.length)).toBe(6);
    for(let i=0;i<5;i++)await pages[i].evaluate(()=>window.__IRON_NEBULA__.drive({x:0,y:0,fire:false,precision:false,ready:true}));
    await pages[5].evaluate(()=>window.__IRON_NEBULA__.drive({x:0,y:0,fire:false,precision:false,ready:false}));
    await host.waitForTimeout(400);expect(await host.evaluate(()=>window.__IRON_NEBULA__.state().phase)).toBe('shop');
    await pages[5].evaluate(()=>window.__IRON_NEBULA__.drive({x:0,y:0,fire:false,precision:false,ready:true}));
    await expect.poll(()=>host.evaluate(()=>window.__IRON_NEBULA__.state().sector),{timeout:10000}).toBe(2);
    for(const page of pages)await expect.poll(()=>page.evaluate(()=>window.__IRON_NEBULA__.state().sector)).toBe(2);
  }finally{for(const context of contexts)await context.close();}
});
