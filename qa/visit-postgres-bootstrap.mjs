// Emits only synthetic fixture SQL. CI pipes this into its disposable database.
import {initializeVisitFixture} from './visit-lifecycle-fixture.js';
if(process.env.ADPHOR_ISOLATED_VISIT_TEST!=='true')throw Error('Isolated test opt-in required');
const quote=value=>typeof value==='boolean'?String(value):"'"+String(value).replaceAll("'","''")+"'";
await initializeVisitFixture({exec:async sql=>console.log(sql),query:async(sql,params)=>console.log(sql.replace(/\$(\d+)/g,(_,n)=>quote(params[Number(n)-1]))+';')});
