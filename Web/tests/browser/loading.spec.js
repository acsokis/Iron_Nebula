import {test,expect} from '@playwright/test';

test('visible preparation reports downloads before revealing the ready menu',async({page})=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/assets/spaceFrontier.webp',async route=>{await gate;await route.continue();});
  await page.goto('/?test=1',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#loading')).toBeVisible();
  await expect(page.locator('[data-loading-stage="textures"]')).toHaveAttribute('data-state','active',{timeout:30000});
  await expect(page.locator('#loading-percent')).not.toHaveText('0%');
  await expect(page.locator('#loading-bytes')).toContainText('MB');
  await page.screenshot({path:'test-results/preloading.png'});release();
  await expect(page.locator('#loading')).toBeHidden({timeout:60000});
  await expect(page.locator('#loading-progress')).toHaveJSProperty('value',1);await expect(page.locator('#menu')).toBeVisible();
});

test('failed preparation offers a working retry instead of a stalled progress bar',async({page})=>{
  await page.route('**/assets/manifest.json',route=>route.fulfill({status:503,body:'Unavailable'}));
  await page.goto('/?test=1');await expect(page.locator('#loading-retry')).toBeVisible();
  await expect(page.locator('#loading-label')).toContainText('interrupted');
  await page.unroute('**/assets/manifest.json');await page.click('#loading-retry');
  await expect(page.locator('#loading')).toBeHidden({timeout:60000});await expect(page.locator('#menu')).toBeVisible();
});
