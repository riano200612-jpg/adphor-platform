import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});
child.unref();
process.on('message',()=>process.exit(0));
process.send({pid:child.pid});
