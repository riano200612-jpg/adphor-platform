process.on('message',()=>{});
process.once('SIGTERM',()=>process.exit(2));
process.send({type:'ready',metadata:{kind:'sql',pid:process.pid}});
