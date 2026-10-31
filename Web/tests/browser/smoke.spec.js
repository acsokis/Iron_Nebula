import {test,expect} from '@playwright/test';
test('boots real WebGL 2 and launches flight',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('/?test=1');await expect(page.locator('#loading')).toBeHidden({timeout:30000});
  await expect(page.locator('#menu')).toBeVisible();
  const info=await page.evaluate(()=>window.__IRON_NEBULA__.renderer());expect(info.webgl).toContain('WebGL 2');
  await page.screenshot({path:'test-results/menu.png'});
  await page.click('#solo');await expect(page.locator('#hud')).toBeVisible();
  await page.keyboard.down('Space');await page.waitForTimeout(600);await page.keyboard.up('Space');
  const state=await page.evaluate(()=>window.__IRON_NEBULA__.state());expect(state.phase).toBe('playing');expect(state.shots.length).toBeGreaterThan(0);
  await page.screenshot({path:'test-results/flight.png'});
  expect(errors).toEqual([]);
});
