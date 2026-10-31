import {PeerServer} from 'peer';
const app=PeerServer({host:'127.0.0.1',port:9001,path:'/peerjs',allow_discovery:false,concurrent_limit:50});
console.log('Local test-only signaling: http://127.0.0.1:9001/peerjs');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>process.exit(0));
