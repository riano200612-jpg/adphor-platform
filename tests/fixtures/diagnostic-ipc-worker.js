import {setTimeout as delay} from 'node:timers/promises';
import {createDiagnosticStage} from '../../qa/diagnostic-supervisor.js';
const stage=createDiagnosticStage();
for(let index=0;index<12;index++){
 await stage('Rápida '+index,()=>index);
}
await stage('Espera controlada',()=>delay(25));
if(process.argv.includes('--block')){
 await stage('Bloqueo sintético',()=>{while(true){}},100);
}
process.disconnect();
