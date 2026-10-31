import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',timeout:90000,workers:1,fullyParallel:false,
  use:{baseURL:'http://127.0.0.1:5173',viewport:{width:1440,height:1000},headless:true,
    launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']},
    screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer:[
    {command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:30000},
    {command:'node scripts/test-services.mjs',url:'http://127.0.0.1:9001/peerjs',reuseExistingServer:!process.env.CI,timeout:30000},
    {command:'npm run preview',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI,timeout:30000},
  ],
});
