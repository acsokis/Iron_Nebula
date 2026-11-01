import { defineConfig } from 'vite';
import {cp} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
export default defineConfig(({command})=>({
  base: './',
  plugins:[{name:'production-csp',transformIndexHtml(html){return html.replace('__DEV_CONNECT__',command==='serve'?'http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*':'').replace('__DEV_STYLE__',command==='serve'?"'unsafe-inline'":'');}},
    {name:'release-public-assets',apply:'build',async writeBundle(){await cp(resolve('public'),resolve('dist'),{recursive:true,filter:path=>!basename(path).startsWith('.')&&!path.endsWith('.import')});}}],
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 700, copyPublicDir:false },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
}));
