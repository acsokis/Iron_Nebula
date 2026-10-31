import {test,expect} from '@playwright/test';
test('production artifact enforces CSP and has no development mutation API',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('http://127.0.0.1:4173/?test=1');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
  expect(await page.evaluate(()=>window.__IRON_NEBULA__)).toBeUndefined();
  const csp=await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).not.toContain('unsafe-inline');expect(csp).not.toContain('unsafe-eval');expect(csp).not.toContain('127.0.0.1');
  expect(Number.parseFloat(await page.locator('.intro h1').evaluate(e=>getComputedStyle(e).fontSize))).toBeGreaterThan(40);
  await page.click('#solo');await expect(page.locator('#hud')).toBeVisible();await page.keyboard.down('Space');await page.waitForTimeout(300);await page.keyboard.up('Space');
  await page.screenshot({path:'test-results/production-flight.png'});expect(errors).toEqual([]);
});
test('a held confirm on controller connection cannot accidentally launch a run',async({page})=>{
  await page.addInitScript(()=>{window.testPad=null;window.padPolls=0;Object.defineProperty(navigator,'getGamepads',{value:()=>{window.padPolls++;return window.testPad?[window.testPad]:[];}});});
  await page.goto('/?test=1');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
  await page.evaluate(()=>{window.testPad={id:'Xbox controller',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:i===0,value:i===0?1:0}))};});
  await expect(page.locator('body')).toHaveAttribute('data-profile','xbox');await page.waitForTimeout(150);await expect(page.locator('#menu')).toBeVisible();
  const releasedAt=await page.evaluate(()=>{window.testPad.buttons[0]={pressed:false,value:0};return window.padPolls;});
  await page.waitForFunction(count=>window.padPolls>count,releasedAt);
  await page.evaluate(()=>{window.testPad.buttons[0]={pressed:true,value:1};});await expect(page.locator('#hud')).toBeVisible();
});
