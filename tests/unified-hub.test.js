import test from 'node:test';
import assert from 'node:assert/strict';
import {UNIFIED_MODULES,unifiedModuleStatus,upcomingDueItems} from '../src/js/ui-unified-hub.js';

test('centro incluye los siete accesos y no inventa permisos operativos',()=>{
  assert.equal(UNIFIED_MODULES.length,7);
  const gated=unifiedModuleStatus({mode:'cloud',portoEnabled:false});
  assert.equal(gated.find(x=>x.id==='meetings').available,true);
  assert.match(gated.find(x=>x.id==='meetings').note,/sin calendario real/i);
  assert.equal(gated.find(x=>x.id==='pqrs').available,false);
  assert.equal(gated.find(x=>x.id==='reports').available,true);
  assert.equal(unifiedModuleStatus({portoEnabled:true}).find(x=>x.id==='pqrs').available,true);
});

test('plazos no mezclan copropiedades, cerrados ni fechas inválidas',()=>{
  const rows=[
    {id:'a',project_id:'porto',title:'A',status:'Pendiente',due_date:'2026-11-05'},
    {id:'b',project_id:'otra',title:'B',status:'Pendiente',due_date:'2026-11-04'},
    {id:'c',project_id:'porto',title:'C',status:'Cerrada',due_date:'2026-11-02'},
    {id:'d',project_id:'porto',title:'D',status:'Pendiente',due_date:'2026-11-01'},
    {id:'e',project_id:'porto',title:'E',status:'Pendiente',due_date:'sin fecha'}
  ];
  assert.deepEqual(upcomingDueItems(rows,'porto').map(x=>x.id),['d','a']);
  assert.deepEqual(upcomingDueItems(rows,'desconocida'),[]);
});
