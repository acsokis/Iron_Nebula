import { defineConfig } from 'vite';
export default defineConfig(({command})=>({
  base: './',
  plugins:[{name:'production-csp',transformIndexHtml(html){return html.replace('__DEV_CONNECT__',command==='serve'?'http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*':'').replace('__DEV_STYLE__',command==='serve'?"'unsafe-inline'":'');}}],
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 700 },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
}));
